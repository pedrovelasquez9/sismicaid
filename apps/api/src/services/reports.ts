import type { CitizenReportDTO, ReportType, Urgency } from "@sismicaid/shared";
import { REPORT_TYPE, URGENCY } from "@sismicaid/shared";
import { prisma } from "../db";
import type { CitizenReport } from "../generated/prisma";
import type { CreateReportParsed } from "../validation/report";
import { roundToGrid } from "../lib/geo";

// DTO público seguro: NO expone privateContact, descripción, coordenadas ni
// evidencia (SECURITY_AND_PRIVACY.md). El tipo CitizenReportDTO ya lo garantiza.
function toDTO(r: CitizenReport): CitizenReportDTO {
  return {
    id: r.id,
    reportType: r.reportType,
    title: r.title,
    publicSafeSummary: r.publicSafeSummary,
    state: r.state,
    municipality: r.municipality,
    locationPrecision: r.locationPrecision,
    urgency: r.urgency,
    verificationStatus: r.verificationStatus,
    createdAt: r.createdAt.toISOString(),
  };
}

export function isReportType(v: string): v is ReportType {
  return (REPORT_TYPE as readonly string[]).includes(v);
}

export function isUrgency(v: string): v is Urgency {
  return (URGENCY as readonly string[]).includes(v);
}

export interface ReportFilters {
  state?: string;
  reportType?: ReportType;
  // Grupo de tipos (para /ayuda y /necesidades). Tiene prioridad sobre reportType.
  reportTypes?: ReportType[];
  urgency?: Urgency;
}

export async function listReports(f: ReportFilters): Promise<CitizenReportDTO[]> {
  const reports = await prisma.citizenReport.findMany({
    where: {
      verificationStatus: { notIn: ["rejected", "duplicate"] },
      ...(f.state ? { state: f.state } : {}),
      ...(f.urgency ? { urgency: f.urgency } : {}),
      ...(f.reportTypes?.length
        ? { reportType: { in: f.reportTypes } }
        : f.reportType
          ? { reportType: f.reportType }
          : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return reports.map(toDTO);
}

export async function createReport(input: CreateReportParsed): Promise<CitizenReportDTO> {
  // Privacidad por defecto: salvo que el usuario elija "exact", difuminamos las
  // coordenadas a ~110 m ANTES de persistir, así nunca guardamos la posición
  // exacta de quien no la consintió (SECURITY_AND_PRIVACY.md).
  const blur = input.locationPrecision !== "exact";
  const latitude = input.latitude == null ? null : blur ? roundToGrid(input.latitude) : input.latitude;
  const longitude = input.longitude == null ? null : blur ? roundToGrid(input.longitude) : input.longitude;
  const r = await prisma.citizenReport.create({
    data: {
      reportType: input.reportType,
      title: input.title,
      description: input.description ?? null,
      state: input.state,
      municipality: input.municipality ?? null,
      parish: input.parish ?? null,
      latitude,
      longitude,
      locationPrecision: input.locationPrecision,
      urgency: input.urgency,
      evidenceUrl: input.evidenceUrl ?? null,
      reportSourceType: input.reportSourceType,
      privateContact: input.privateContact ?? null,
      // Se publica inmediatamente como ciudadano/no verificado; nunca como oficial.
      // Moderación posterior puede rechazar/duplicar sin bloquear la publicación.
      verificationStatus: "pending",
    },
  });
  return toDTO(r);
}
