/**
 * Shared types — frontier between @sismicaid/api and @sismicaid/web.
 *
 * NEVER import Prisma types here. NEVER import anything Node-only.
 * This file must compile in browser context.
 */

// ============================================================
// Audit log — public head endpoint /audit/head
// ============================================================

export interface AuditHeadDto {
  chainId: string;
  height: number;
  hash: string;         // hex sha256
  occurredAt: string;   // ISO 8601 UTC
}

// ============================================================
// Push subscription — POST /push/subscribe
// ============================================================

export interface PushSubscribeDto {
  endpoint: string;
  p256dh: string;
  auth: string;
  geoScope: {
    state?: string;     // ISO 3166-2:VE code, e.g. "VE-A" (Distrito Capital)
    h3Cells?: string[]; // optional list of H3 r6 cells the user cares about
  };
  topics: {
    sismos: boolean;
    tsunami: boolean;
    ayuda: boolean;
  };
}

export interface PushSubscribeResponseDto {
  id: string;
  createdAt: string;
}

// ============================================================
// Safety check — Sprint 4
// ============================================================

export type SafetyStatus = "safe" | "need_help";
export type TriageColor = "red" | "yellow" | "green" | "black";

export interface SafetyCheckCampaignDto {
  id: string;
  triggerEventId: string;
  startedAt: string;
  expiresAt: string;
  /**
   * H3 cells r6 describing the affected area (used by client to decide if
   * to prompt the user). Cells are opaque strings — client compares its
   * own approximate cell against this set.
   */
  affectedH3Cells: string[];
}

export interface SafetyCheckResponseDto {
  campaignId: string;
  status: SafetyStatus;
  h3Cell: string;       // r9; client computes from rough location
  triageColor?: TriageColor;
  notes?: string;       // ≤280 chars, sin PII
}

/**
 * Heatmap aggregate response (k-anonymity enforced server-side; cells with
 * fewer than k=5 responders are omitted).
 */
export interface SafetyHeatCellDto {
  h3Cell: string;       // r7
  safeCount: number;
  needHelpCount: number;
}

// ============================================================
// Anti-abuse outcomes (surfaced to client for UX)
// ============================================================

export type ReportRejectionReason =
  | "outside_venezuela"
  | "rate_limited"
  | "blocked"
  | "validation";

export interface ReportRejectedDto {
  rejected: true;
  reason: ReportRejectionReason;
  retryAfterSec?: number;
  hint?: string;        // user-facing localized message key
}

export interface ReportAcceptedDto {
  rejected: false;
  reportId: string;
  /**
   * If "merge", the report was attached as evidence to an existing report.
   * The client should still treat it as success.
   */
  outcome: "new" | "merge";
  /**
   * Confidence band the report enters with. UI may show different styling.
   */
  confidence: "community" | "verified";
}

export type ReportSubmitResponseDto = ReportAcceptedDto | ReportRejectedDto;

// ============================================================
// CAP 1.2 (Common Alerting Protocol) — Sprint 3 emits, Sprint 6 federates
// ============================================================

export interface CapAlertDto {
  identifier: string;                 // unique
  sender: string;                     // "sismicaid.org"
  sent: string;                       // ISO 8601 UTC
  status: "Actual" | "Exercise" | "System" | "Test" | "Draft";
  msgType: "Alert" | "Update" | "Cancel" | "Ack" | "Error";
  scope: "Public" | "Restricted" | "Private";
  info: CapInfoDto[];
}

export interface CapInfoDto {
  language: "es-VE" | "en-US";
  category: "Geo" | "Met" | "Safety" | "Security" | "Rescue" | "Fire" | "Health" | "Env" | "Transport" | "Infra" | "CBRNE" | "Other";
  event: string;                      // human label, e.g. "Sismo M5.2"
  urgency: "Immediate" | "Expected" | "Future" | "Past" | "Unknown";
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  certainty: "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";
  effective?: string;
  expires?: string;
  headline: string;
  description?: string;
  instruction?: string;
  web?: string;
  area: CapAreaDto[];
}

export interface CapAreaDto {
  areaDesc: string;
  polygon?: string[];                 // CAP polygon strings
  circle?: string[];                  // "lat,lon radius_km"
  geocode?: Array<{ valueName: string; value: string }>;
}
