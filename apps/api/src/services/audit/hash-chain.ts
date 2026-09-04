/**
 * Hash chain primitives for SismicAid audit log.
 *
 * Append-only, tamper-evident sequence. Each block:
 *   hash = sha256( prev_hash || canonical_json(payload) )
 *
 * "Canonical" means deterministic: keys sorted lexicographically,
 * no whitespace, NFC-normalized strings, UTC timestamps in ISO 8601.
 *
 * Genesis block has prev_hash = 64 zeros.
 *
 * Inspired by Kelvin's ARAP-SR Sprint 5 contingent-claims chain.
 */

import { createHash } from "node:crypto";

export const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Canonical JSON serialization.
 * - Object keys sorted lexicographically (recursive).
 * - No insignificant whitespace.
 * - undefined values are omitted (not serialized as null).
 * - Dates serialized as ISO 8601 UTC.
 * - BigInt serialized as string with suffix "n" to avoid confusion with number.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (Array.isArray(value)) return value.map(sortDeep);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (obj[key] === undefined) continue;
      out[key] = sortDeep(obj[key]);
    }
    return out;
  }
  return value;
}

/**
 * Compute hash for a single block.
 * The "block" is the tuple (prev_hash, canonical_payload).
 */
export function computeBlockHash(prevHash: string, payload: unknown): string {
  if (!/^[0-9a-f]{64}$/.test(prevHash)) {
    throw new Error(
      `Invalid prevHash: must be 64 lowercase hex chars, got ${prevHash.length}`,
    );
  }
  const canonical = canonicalize(payload);
  return createHash("sha256")
    .update(prevHash, "utf8")
    .update("|", "utf8") // separator avoids ambiguity if payload starts with hex
    .update(canonical, "utf8")
    .digest("hex");
}

/**
 * Verify a contiguous slice of the chain.
 * Returns {ok: true} or {ok: false, brokenAt: index, expected, got}.
 *
 * Note: caller must pass blocks in order. Use the DB index (chainId, id)
 * for sequential reads.
 */
export interface ChainBlock {
  prevHash: string;
  hash: string;
  payload: unknown;
}

export type VerificationResult =
  | { ok: true; blocksChecked: number }
  | {
      ok: false;
      brokenAt: number;
      expected: string;
      got: string;
      reason: "hash_mismatch" | "prev_mismatch";
    };

export function verifyChain(
  blocks: ChainBlock[],
  expectedFirstPrev: string = GENESIS_PREV_HASH,
): VerificationResult {
  let prevHash = expectedFirstPrev;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.prevHash !== prevHash) {
      return {
        ok: false,
        brokenAt: i,
        expected: prevHash,
        got: block.prevHash,
        reason: "prev_mismatch",
      };
    }
    const computed = computeBlockHash(block.prevHash, block.payload);
    if (computed !== block.hash) {
      return {
        ok: false,
        brokenAt: i,
        expected: computed,
        got: block.hash,
        reason: "hash_mismatch",
      };
    }
    prevHash = block.hash;
  }
  return { ok: true, blocksChecked: blocks.length };
}
