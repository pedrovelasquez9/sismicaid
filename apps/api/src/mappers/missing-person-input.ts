import type { MissingPersonStatus } from "@sismicaid/shared";

// Contrato de entrada que producen los mappers PUROS de personas desaparecidas
// (venezuelatebusca, encuentralos, ...). El job de ingesta consume esto para el
// upsert. La PII ya viene removida aquí: NUNCA hay cédula, foto, contacto del
// reportante/buscador, GPS exacto ni rawPayload. La edad exacta de menores ya
// viene enmascarada (age=null cuando isMinor).
export interface MissingPersonReportInput {
  sourceName: string;
  externalId: string;
  fullName: string;
  normalizedName: string;
  age: number | null;
  isMinor: boolean;
  gender: string | null;
  lastSeenLocation: string | null;
  lastSeenState: string | null;
  status: MissingPersonStatus;
  hospitalName: string | null;
  healthStatus: string | null;
  foundBy: string | null;
  description: string | null;
  sourceUrl: string;
  reportedAt: Date | null;
}
