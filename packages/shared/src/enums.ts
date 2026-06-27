// Enums de dominio. Fuente: docs/SPEC.md sección 6 y docs/DATA_SOURCES.md.
//
// Cada enum se declara como array `as const` (valores en runtime) + un tipo
// derivado. Los arrays se usan para validación (Zod) y para el test de paridad
// con los enum de Prisma; el tipo es la unión literal para el resto del código.

export const TRUST_LEVEL = ["official", "verified", "community_pending", "outdated", "rejected"] as const;
export type TrustLevel = (typeof TRUST_LEVEL)[number];

export const SOURCE_TYPE = ["seismic", "tsunami", "civil_protection", "media", "manual", "missing_persons"] as const;
export type SourceType = (typeof SOURCE_TYPE)[number];

// Estado de un reporte de persona desaparecida. Solo 3 valores (sin "deceased");
// el vocabulario de cada fuente se mapea a estos en los mappers.
export const MISSING_PERSON_STATUS = ["missing", "found", "hospitalized"] as const;
export type MissingPersonStatus = (typeof MISSING_PERSON_STATUS)[number];

export const SOURCE_STATUS = ["active", "degraded", "disabled"] as const;
export type SourceStatus = (typeof SOURCE_STATUS)[number];

export const SEISMIC_STATUS = ["automatic", "reviewed", "deleted"] as const;
export type SeismicStatus = (typeof SEISMIC_STATUS)[number];

export const EVENT_TYPE = ["earthquake", "quarry_blast", "other"] as const;
export type EventType = (typeof EVENT_TYPE)[number];

export const ALERT_LEVEL = ["green", "yellow", "orange", "red", "unknown"] as const;
export type AlertLevel = (typeof ALERT_LEVEL)[number];

export const TSUNAMI_PROVIDER = ["NOAA_PTWC", "NOAA_NTWC", "LOCAL_AUTHORITY"] as const;
export type TsunamiProvider = (typeof TSUNAMI_PROVIDER)[number];

export const TSUNAMI_STATUS = ["information", "watch", "advisory", "warning", "canceled", "unknown"] as const;
export type TsunamiStatus = (typeof TSUNAMI_STATUS)[number];

export const COASTAL_RISK_LEVEL = ["none", "info", "watch", "warning", "canceled"] as const;
export type CoastalRiskLevel = (typeof COASTAL_RISK_LEVEL)[number];

export const RESOURCE_TYPE = [
  "shelter",
  "hospital",
  "collection_center",
  "water",
  "food",
  "charging_point",
  "communication",
  "transport",
  "volunteer_center",
] as const;
export type ResourceType = (typeof RESOURCE_TYPE)[number];

export const RESOURCE_STATUS = ["active", "saturated", "closed", "unknown"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUS)[number];

export const CAPACITY_STATUS = ["available", "limited", "full", "unknown"] as const;
export type CapacityStatus = (typeof CAPACITY_STATUS)[number];

export const LOCATION_PRECISION = ["exact", "approximate", "area"] as const;
export type LocationPrecision = (typeof LOCATION_PRECISION)[number];

export const VERIFICATION_STATUS = ["pending", "verified", "rejected", "outdated"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

export const URGENCY = ["low", "medium", "high", "critical"] as const;
export type Urgency = (typeof URGENCY)[number];

export const NEED_STATUS = ["open", "in_progress", "partially_covered", "covered", "outdated"] as const;
export type NeedStatus = (typeof NEED_STATUS)[number];

export const REPORT_TYPE = [
  "structural_damage",
  "blocked_road",
  "landslide",
  "trapped_person",
  "urgent_need",
  "available_resource",
  "active_shelter",
  "collection_center",
  "operational_hospital",
  "electrical_risk",
  "gas_leak",
  "no_signal_zone",
  "no_water_zone",
  "no_power_zone",
] as const;
export type ReportType = (typeof REPORT_TYPE)[number];

export const REPORT_SOURCE_TYPE = ["first_hand", "reported_by_other", "media", "authority", "volunteer"] as const;
export type ReportSourceType = (typeof REPORT_SOURCE_TYPE)[number];

export const REPORT_VERIFICATION_STATUS = [
  "pending",
  "in_review",
  "verified",
  "rejected",
  "duplicate",
  "outdated",
] as const;
export type ReportVerificationStatus = (typeof REPORT_VERIFICATION_STATUS)[number];

export const RECOMMENDATION_CONTEXT = [
  "earthquake_before",
  "earthquake_during",
  "earthquake_after",
  "tsunami",
  "coast",
  "damaged_building",
  "communications",
] as const;
export type RecommendationContext = (typeof RECOMMENDATION_CONTEXT)[number];

export const FETCH_STATUS = ["success", "partial", "failed"] as const;
export type FetchStatus = (typeof FETCH_STATUS)[number];
