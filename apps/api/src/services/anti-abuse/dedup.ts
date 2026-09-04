/**
 * Geo-temporal deduplication for citizen reports.
 *
 * Signature = sha256( type || normalized_text || geo_cell || time_bucket )
 *
 * Where:
 *   - normalized_text: lowercased, NFKD, accents stripped, whitespace collapsed,
 *     truncated to 100 chars.
 *   - geo_cell: H3 cell at resolution 8 (~460m edge). Lightweight without
 *     pulling the h3 library: we use a custom grid based on lat/lng rounding,
 *     replaceable with `h3-js` in S2.
 *   - time_bucket: floor(timestamp / 5min) — same incident within 5 min collapses.
 *
 * When a duplicate signature arrives:
 *   - Increment counter on existing DedupSignature.
 *   - Return the existing reportId.
 *   - Caller MUST NOT create a new report; instead, add this submission as
 *     "evidence" (boosting confidence) to the original.
 */

import { createHash } from "node:crypto";
import type { LatLng } from "./geofence";

export interface DedupInput {
  type: string;                  // "damage" | "blocked_road" | ...
  text: string;
  point: LatLng;
  timestamp: Date;
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const GEO_CELL_DEG = 0.005;      // ~555m at equator, ~540m at lat 8°

/**
 * Light-weight geo cell — replace with h3-js in S2 if/when added.
 * Returns "<latIdx>_<lngIdx>".
 */
function geoCell(point: LatLng): string {
  const latIdx = Math.round(point.lat / GEO_CELL_DEG);
  const lngIdx = Math.round(point.lng / GEO_CELL_DEG);
  return `${latIdx}_${lngIdx}`;
}

/**
 * Normalize free-text for deduplication.
 * Collapses casing, accents, whitespace; truncates to 100 chars.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")  // strip combining marks (accents)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function computeSignature(input: DedupInput): string {
  const bucket = Math.floor(input.timestamp.getTime() / FIVE_MIN_MS);
  const cell = geoCell(input.point);
  const normalizedText = normalizeText(input.text);
  const material = `${input.type}|${normalizedText}|${cell}|${bucket}`;
  return createHash("sha256").update(material, "utf8").digest("hex");
}

/**
 * Result of dedup check.
 */
export type DedupResult =
  | { kind: "new"; signature: string }
  | { kind: "duplicate"; signature: string; reportId: string; count: number };

/**
 * Stateless: only computes the signature. The actual lookup against
 * DedupSignature table happens in the AntiAbusePipeline orchestrator.
 */
export function buildSignature(input: DedupInput): string {
  return computeSignature(input);
}
