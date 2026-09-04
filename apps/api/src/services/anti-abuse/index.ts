/**
 * Anti-abuse pipeline.
 *
 * Orchestrates three checks for citizen reports:
 *   1. Geofence (cheap, no DB)  reject if outside VE.
 *   2. Reputation (DB read)  reject if blocked.
 *   3. Dedup (DB read)  collapse if duplicate (same incident submitted twice).
 *
 * Returns one of:
 *   - { kind: "accept", signature, reputationBand }  caller creates new report.
 *   - { kind: "merge", existingReportId, signature, newCount }  caller attaches
 *     this submission as evidence to the existing report.
 *   - { kind: "reject", reason }  caller returns 403/422 depending on reason.
 *
 * NOT included in this pipeline (by design, after maintainer review):
 *   - Rate limiting: handled by `@fastify/rate-limit` at the route layer.
 *     The 300/min global + 5/min on POST /api/reports config in src/index.ts
 *     is the single source of truth.
 *   - Location fuzzing: handled by `lib/geo.ts` (`roundToGrid`, ~1km grid).
 *     Callers must apply `roundToGrid` before persisting trapped_person
 *     locations (SECURITY_AND_PRIVACY.md).
 *
 * Every accept/merge/reject is recorded in the audit log by the caller 
 * this service stays focused and does not import AuditLogService to keep
 * the dependency graph one-way.
 */

import type { PrismaClient } from "../../generated/prisma";
import { geofenceVenezuela, type LatLng } from "./geofence";
import { ReputationService } from "./reputation";
import { buildSignature, type DedupInput } from "./dedup";

export interface AntiAbuseInput {
  type: string;
  text: string;
  point: LatLng;
  timestamp: Date;
  deviceKey: string;
}

export type AntiAbuseOutcome =
  | {
      kind: "accept";
      signature: string;
      reputationBand: "high" | "normal" | "low";
    }
  | {
      kind: "merge";
      signature: string;
      existingReportId: string;
      newCount: number;
    }
  | {
      kind: "reject";
      reason:
        | "outside_venezuela"
        | "reporter_blocked";
      detail?: string;
    };

export class AntiAbusePipeline {
  private readonly reputation: ReputationService;

  constructor(private readonly prisma: PrismaClient) {
    this.reputation = new ReputationService(prisma);
  }

  async checkReport(input: AntiAbuseInput): Promise<AntiAbuseOutcome> {
    // 1) Geofence  outside VE means likely noise or test traffic.
    const geo = geofenceVenezuela(input.point);
    if (!geo.allowed) {
      return {
        kind: "reject",
        reason: "outside_venezuela",
        detail: geo.reason,
      };
    }

    // 2) Reputation  blocked device keys are silently filtered.
    const rep = await this.reputation.get(input.deviceKey);
    if (rep.blocked) {
      return {
        kind: "reject",
        reason: "reporter_blocked",
        detail: rep.blockedReason ?? undefined,
      };
    }
    const band = ReputationService.band(rep);
    if (band === "blocked") {
      return { kind: "reject", reason: "reporter_blocked" };
    }

    // 3) Dedup  same incident reported again within window collapses.
    const dedupInput: DedupInput = {
      type: input.type,
      text: input.text,
      point: input.point,
      timestamp: input.timestamp,
    };
    const signature = buildSignature(dedupInput);
    const existing = await this.prisma.dedupSignature.findUnique({
      where: { signature },
    });

    if (existing) {
      const updated = await this.prisma.dedupSignature.update({
        where: { signature },
        data: { count: { increment: 1 }, lastSeen: new Date() },
      });
      return {
        kind: "merge",
        signature,
        existingReportId: existing.reportId,
        newCount: updated.count,
      };
    }

    return {
      kind: "accept",
      signature,
      reputationBand: band,
    };
  }

  /** Convenience accessor for callers that need reputation effects post-accept. */
  get reputationService(): ReputationService {
    return this.reputation;
  }
}