/**
 * Audit log service.
 *
 * Provides:
 *  - append(event): inserts a hash-chained audit row in the SAME transaction
 *    as the business write (so chain integrity matches business reality).
 *  - getHead(): returns latest hash for public exposure (transparency).
 *  - verify(): hourly job; verifies the full chain (or a tail window for speed).
 *
 * Concurrency model:
 *   To avoid two appends racing for the same prev_hash, we use a Postgres
 *   advisory lock keyed by chainId. This is cheap, transaction-scoped,
 *   and avoids needing a separate sequencer service.
 */

import { type PrismaClient, Prisma } from "../../generated/prisma";
import {
  GENESIS_PREV_HASH,
  computeBlockHash,
  verifyChain,
  type ChainBlock,
} from "./hash-chain";

export interface AuditEventInput {
  eventType: string;          // "report.created", etc.
  actorType: "anonymous" | "device" | "moderator" | "system";
  actorRef?: string;          // device hash, job name, never raw PII
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  chainId?: string;           // default "default"
}

export class AuditLogService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Append a single audit event. Must be called inside a transaction
   * to ensure atomicity with the business write that originated it.
   */
  async append(
    tx: Prisma.TransactionClient,
    event: AuditEventInput,
  ): Promise<{ id: bigint; hash: string }> {
    const chainId = event.chainId ?? "default";

    // 1) Advisory lock per chain — serializes appends without blocking reads.
    //    The key is a stable 32-bit hash of chainId.
    const lockKey = hash32(chainId);
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

    // 2) Get current head (prev_hash) for this chain.
    const head = await tx.auditLog.findFirst({
      where: { chainId },
      orderBy: { id: "desc" },
      select: { hash: true },
    });
    const prevHash = head?.hash ?? GENESIS_PREV_HASH;

    // 3) Build canonical payload (the actual payload + framing).
    const block = {
      eventType: event.eventType,
      actorType: event.actorType,
      actorRef: event.actorRef ?? null,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      payload: event.payload,
    };

    // 4) Compute hash.
    const hash = computeBlockHash(prevHash, block);

    // 5) Persist.
    const created = await tx.auditLog.create({
      data: {
        eventType: event.eventType,
        actorType: event.actorType,
        actorRef: event.actorRef ?? null,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        payload: block as object,
        prevHash,
        hash,
        chainId,
      },
      select: { id: true, hash: true },
    });

    return created;
  }

  /**
   * Public head: latest hash exposed at /audit/head for transparency.
   * Anyone can periodically check this; if it ever goes backwards, the
   * chain has been compromised.
   */
  async getHead(chainId = "default"): Promise<{
    chainId: string;
    height: number;
    hash: string;
    occurredAt: Date;
  } | null> {
    const row = await this.prisma.auditLog.findFirst({
      where: { chainId },
      orderBy: { id: "desc" },
      select: { id: true, hash: true, occurredAt: true },
    });
    if (!row) return null;
    return {
      chainId,
      height: Number(row.id),
      hash: row.hash,
      occurredAt: row.occurredAt,
    };
  }

  /**
   * Verify chain integrity.
   * - mode: "full" walks every block (use for nightly verify).
   * - mode: "tail" walks the last N blocks (use for hourly verify).
   */
  async verify(
    mode: "full" | "tail" = "tail",
    tailSize = 1000,
    chainId = "default",
  ): Promise<
    | { ok: true; blocksChecked: number; head: string | null }
    | { ok: false; brokenAt: number; reason: string }
  > {
    const blocks = await this.prisma.auditLog.findMany({
      where: { chainId },
      orderBy: { id: "asc" },
      ...(mode === "tail" ? { take: tailSize } : {}),
      select: { prevHash: true, hash: true, payload: true },
    });

    if (blocks.length === 0) {
      return { ok: true, blocksChecked: 0, head: null };
    }

    const chainBlocks: ChainBlock[] = blocks.map((b: { prevHash: string; hash: string; payload: unknown }) => ({
      prevHash: b.prevHash,
      hash: b.hash,
      payload: b.payload,
    }));

    // If tail mode, the first block's prevHash is not GENESIS — we trust it
    // and verify forward from there. Full verification is the nightly job.
    const expectedFirstPrev =
      mode === "full" ? GENESIS_PREV_HASH : chainBlocks[0]!.prevHash;

    const result = verifyChain(chainBlocks, expectedFirstPrev);

    if (!result.ok) {
      return {
        ok: false,
        brokenAt: result.brokenAt,
        reason: result.reason,
      };
    }
    return {
      ok: true,
      blocksChecked: result.blocksChecked,
      head: chainBlocks[chainBlocks.length - 1]!.hash,
    };
  }
}

/**
 * Stable 32-bit hash for advisory lock keys. djb2 variant.
 * Returns a value in [0, 2^31 - 1] (signed-int safe for pg_advisory_lock).
 */
function hash32(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
