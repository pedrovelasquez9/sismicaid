/**
 * Reporter reputation.
 *
 * Anonymous, persistent score 0–100 per device key. Used to:
 *   - Auto-promote reports from high-score reporters to "verified" if they
 *     cross with another independent source (Sprint 5).
 *   - Block at score 0 — likely abuse pattern.
 *   - Quarantine new reporters until they have a small track record.
 *
 * Score updates:
 *   +5 when a report is verified by moderator or by cross-source.
 *   -10 when a report is quarantined / marked false by moderator.
 *   -3 when a report is auto-rejected by anti-abuse (dedup/geofence).
 *
 * Device key:
 *   sha256( SERVER_SECRET_SALT || browser_fingerprint )
 * The salt is rotated annually; old keys become un-linkable, which is the
 * point — the system needs continuity within a year but no longer.
 */

import type { PrismaClient } from "../../generated/prisma";

export const SCORE_INITIAL = 50;
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const SCORE_BLOCK_THRESHOLD = 5;

export const SCORE_DELTA = {
  verified: 5,
  quarantined: -10,
  autoRejected: -3,
  reportAccepted: 1,         // small positive nudge for staying within limits
} as const;

export type ReputationSignal = keyof typeof SCORE_DELTA;

export interface ReputationState {
  deviceKey: string;
  score: number;
  reportsTotal: number;
  blocked: boolean;
  blockedReason: string | null;
}

export class ReputationService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(deviceKey: string): Promise<ReputationState> {
    const row = await this.prisma.reporterReputation.upsert({
      where: { deviceKey },
      create: { deviceKey, score: SCORE_INITIAL },
      update: { lastSeenAt: new Date() },
    });

    return {
      deviceKey: row.deviceKey,
      score: row.score,
      reportsTotal: row.reportsTotal,
      blocked: row.blockedAt !== null,
      blockedReason: row.blockedReason,
    };
  }

  async apply(
    deviceKey: string,
    signal: ReputationSignal,
  ): Promise<ReputationState> {
    const delta = SCORE_DELTA[signal];
    const current = await this.prisma.reporterReputation.upsert({
      where: { deviceKey },
      create: { deviceKey, score: SCORE_INITIAL },
      update: { lastSeenAt: new Date() },
    });

    const newScore = clamp(current.score + delta, SCORE_MIN, SCORE_MAX);
    const shouldBlock =
      newScore <= SCORE_BLOCK_THRESHOLD && current.blockedAt === null;

    const updated = await this.prisma.reporterReputation.update({
      where: { deviceKey },
      data: {
        score: newScore,
        reportsTotal:
          signal === "reportAccepted" ? { increment: 1 } : undefined,
        reportsVerified:
          signal === "verified" ? { increment: 1 } : undefined,
        reportsQuarantined:
          signal === "quarantined" ? { increment: 1 } : undefined,
        ...(shouldBlock
          ? {
              blockedAt: new Date(),
              blockedReason: `auto: score reached ${newScore} via ${signal}`,
            }
          : {}),
      },
    });

    return {
      deviceKey: updated.deviceKey,
      score: updated.score,
      reportsTotal: updated.reportsTotal,
      blocked: updated.blockedAt !== null,
      blockedReason: updated.blockedReason,
    };
  }

  /**
   * Confidence band derived from score.
   *   - "high":   score ≥ 70 AND reports_total ≥ 5
   *   - "normal": score 30–69, or score ≥ 70 with < 5 reports (new)
   *   - "low":    score 5–29
   *   - "blocked": below threshold or explicitly blocked
   */
  static band(state: ReputationState): "high" | "normal" | "low" | "blocked" {
    if (state.blocked) return "blocked";
    if (state.score >= 70 && state.reportsTotal >= 5) return "high";
    if (state.score >= 30) return "normal";
    return "low";
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
