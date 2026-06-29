// apps/api/src/services/trapped-persons.ts
import type { TrappedPersonMarkerDTO } from "@sismicaid/shared";
import { prisma } from "../db";
import type { CitizenReport } from "../generated/prisma";

// DTO de mapa: coordenadas tal cual se guardaron (exactas si el reportante lo
// eligió, difuminadas a ~110 m en caso contrario). Sin nombres ni campos privados.
export function toMarkerDTO(r: CitizenReport): TrappedPersonMarkerDTO {
  return {
    id: r.id,
    lat: r.latitude == null ? null : (r.latitude as number),
    lng: r.longitude == null ? null : (r.longitude as number),
    locationPrecision: r.locationPrecision,
    municipality: r.municipality,
    urgency: r.urgency,
    verificationStatus: r.verificationStatus,
    resolved: r.resolvedAt != null,
    createdAt: r.createdAt.toISOString(),
  };
}

// Lista de marcadores para el mapa de rescate. Devuelve también resueltos:
// el cliente decide si los oculta (filtro de presentación).
export async function listTrappedPersons(): Promise<TrappedPersonMarkerDTO[]> {
  const rows = await prisma.citizenReport.findMany({
    where: {
      reportType: "trapped_person",
      verificationStatus: { notIn: ["rejected", "duplicate"] },
      // Incluye reportes sin coordenadas: aparecen en la lista (el mapa los
      // omite). Antes se excluían y nunca se veían, porque el formulario no
      // capturaba ubicación.
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toMarkerDTO);
}

// Marca un reporte como rescatado/cerrado. Devuelve null si no existe.
export async function resolveTrappedPerson(id: string): Promise<TrappedPersonMarkerDTO | null> {
  const existing = await prisma.citizenReport.findUnique({ where: { id } });
  if (!existing || existing.reportType !== "trapped_person") return null;
  const updated = await prisma.citizenReport.update({
    where: { id },
    data: { resolvedAt: new Date() },
  });
  return toMarkerDTO(updated);
}
