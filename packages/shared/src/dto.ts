// DTOs públicos que la API expone y la web consume.
// Regla (docs/SECURITY_AND_PRIVACY.md): nunca exponer entidades internas completas,
// contactos privados, ni direcciones exactas. Estos tipos son la frontera segura.

import type {
  AlertLevel,
  CapacityStatus,
  CoastalRiskLevel,
  EventType,
  LocationPrecision,
  NeedStatus,
  RecommendationContext,
  ReportSourceType,
  ReportType,
  ReportVerificationStatus,
  ResourceStatus,
  ResourceType,
  SeismicStatus,
  SourceStatus,
  TrustLevel,
  TsunamiProvider,
  TsunamiStatus,
  Urgency,
  VerificationStatus,
} from "./enums";

export interface SeismicEventDTO {
  id: string;
  source: string;
  status: SeismicStatus;
  eventType: EventType;
  place: string;
  country: string | null;
  latitude: number;
  longitude: number;
  depthKm: number | null;
  magnitude: number | null;
  magnitudeType: string | null;
  eventTimeUtc: string;
  eventTimeLocal: string | null;
  mmi: number | null;
  cdi: number | null;
  alertLevel: AlertLevel;
  tsunamiFlag: boolean;
  significance: number | null;
  feltReportsCount: number | null;
  detailUrl: string | null;
  updatedAt: string;
}

export interface TsunamiAlertDTO {
  id: string;
  source: string;
  provider: TsunamiProvider;
  status: TsunamiStatus;
  headline: string;
  description: string | null;
  affectedAreaText: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  relatedSeismicEventId: string | null;
  updatedAt: string;
}

// GET /api/tsunami-alerts/current — estado actual de tsunami (NUNCA derivado del
// tsunami_flag de un sismo; solo de boletines oficiales). `alert` null = sin
// alerta vigente según la última fuente consultada.
export interface CurrentTsunamiDTO {
  alert: TsunamiAlertDTO | null;
  lastCheckedAt: string | null;
  stale: boolean;
}

export interface CoastalZoneDTO {
  id: string;
  name: string;
  state: string;
  municipality: string | null;
  riskLevel: CoastalRiskLevel;
  updatedAt: string;
}

export interface ResourceDTO {
  id: string;
  type: ResourceType;
  name: string;
  state: string;
  municipality: string | null;
  parish: string | null;
  // Coordenadas solo cuando la precisión no expone una dirección privada.
  latitude: number | null;
  longitude: number | null;
  locationPrecision: LocationPrecision;
  status: ResourceStatus;
  capacityStatus: CapacityStatus;
  description: string | null;
  publicContact: string | null;
  verificationStatus: VerificationStatus;
  source: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

export interface NeedDTO {
  id: string;
  category: string;
  title: string;
  description: string | null;
  state: string;
  municipality: string | null;
  parish: string | null;
  locationPrecision: LocationPrecision;
  urgency: Urgency;
  quantity: string | null;
  status: NeedStatus;
  verificationStatus: VerificationStatus;
  source: string | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

export interface RecommendationDTO {
  id: string;
  context: RecommendationContext;
  title: string;
  body: string;
  priority: number;
}

// Entrada del formulario ciudadano (POST /api/reports).
// El contacto privado se acepta pero NUNCA se devuelve en DTOs públicos.
export interface CreateReportInput {
  reportType: ReportType;
  title: string;
  description?: string;
  state: string;
  municipality?: string;
  parish?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision: LocationPrecision;
  urgency: Urgency;
  evidenceUrl?: string;
  reportSourceType: ReportSourceType;
  privateContact?: string;
}

// Vista pública de un reporte: solo el resumen seguro y el estado de verificación.
export interface CitizenReportDTO {
  id: string;
  reportType: ReportType;
  title: string;
  publicSafeSummary: string | null;
  state: string;
  municipality: string | null;
  locationPrecision: LocationPrecision;
  urgency: Urgency;
  verificationStatus: ReportVerificationStatus;
  createdAt: string;
}

// Marcador de mapa de rescate. Expone coordenadas EXACTAS a propósito: es una
// emergencia y los rescatistas necesitan el sitio preciso (decisión de producto
// que sobre-escribe el difuminado de privacidad). Nunca nombres ni contacto.
export interface TrappedPersonMarkerDTO {
  id: string;
  // null cuando el reporte no trae coordenadas: aparece en la lista pero no
  // se pinta en el mapa (no inventamos ubicación).
  lat: number | null;
  lng: number | null;
  municipality: string | null;
  urgency: Urgency;
  verificationStatus: ReportVerificationStatus;
  resolved: boolean;
  createdAt: string;
}

export interface SourceStatusDTO {
  name: string;
  type: string;
  status: SourceStatus;
  trustLevel: TrustLevel;
  lastCheckedAt: string | null;
}

// GET /api/status — estado general honesto (sin inventar datos oficiales).
export interface StatusDTO {
  seismic: { lastUpdatedAt: string | null; recentCount: number };
  tsunami: { lastUpdatedAt: string | null; activeAlerts: number };
  sources: SourceStatusDTO[];
  degradedSources: string[];
}
