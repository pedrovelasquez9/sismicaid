import type {
  MissingPersonGroupDTO,
  MissingPersonResultDTO,
  MissingPersonSearchResponseDTO,
} from "@sismicaid/shared";
import { prisma } from "../db";
import type { MissingPersonReport } from "../generated/prisma";
import { normalizeName } from "../lib/normalize-name";
import { httpUrlOr } from "../lib/missing-person-scrub";

// Búsqueda de personas desaparecidas (GET /api/missing-persons?q=).
// Reactiva: solo devuelve resultados ante un nombre explícito (no es un directorio).

const MAX_QUERY_LEN = 80;
const MIN_QUERY_LEN = 2;
const LIMIT = 100;

// Mapea fila -> DTO con la SEGUNDA guarda de menores (la primera es en ingesta):
// edad exacta de menor nunca se emite; se muestra "menor de edad".
function toResultDTO(r: MissingPersonReport): MissingPersonResultDTO {
  const age = r.isMinor ? null : r.age;
  const ageLabel = r.isMinor ? "menor de edad" : r.age != null ? `${r.age} años` : null;
  return {
    id: r.id,
    fullName: r.fullName,
    age,
    ageLabel,
    isMinor: r.isMinor,
    gender: r.gender,
    lastSeenLocation: r.lastSeenLocation,
    status: r.status,
    hospitalName: r.hospitalName,
    healthStatus: r.healthStatus,
    foundBy: r.foundBy,
    description: r.description,
    source: r.sourceName,
    // Guarda de esquema (defensa en profundidad; el ingest ya valida http(s)).
    sourceUrl: httpUrlOr(r.sourceUrl, ""),
    reportedAt: r.reportedAt ? r.reportedAt.toISOString() : null,
    lastSeenAt: r.lastSeenAt.toISOString(),
    trustLevel: "community_pending",
    verified: false,
  };
}

// Pista SUAVE (nunca fusiona filas): true si el grupo tiene filas de ≥2 fuentes
// DISTINTAS que comparten la MISMA edad no-nula Y el MISMO estado no-nulo.
// Menores (age null) no disparan la pista -> conservador.
function detectPossibleSamePerson(rows: MissingPersonReport[]): boolean {
  if (rows.length < 2) return false;
  const buckets = new Map<string, Set<string>>(); // "age|state" -> set de fuentes
  for (const r of rows) {
    if (r.isMinor || r.age == null || !r.lastSeenState) continue;
    const key = `${r.age}|${normalizeName(r.lastSeenState)}`;
    const set = buckets.get(key) ?? new Set<string>();
    set.add(r.sourceName);
    buckets.set(key, set);
  }
  for (const set of buckets.values()) if (set.size >= 2) return true;
  return false;
}

export async function searchMissingPersons(rawQ: string): Promise<MissingPersonSearchResponseDTO> {
  // Sanea: trim + cap 80 + normaliza. Se usa SOLO vía Prisma `contains`
  // parametrizado (sin inyección).
  const q = String(rawQ ?? "")
    .trim()
    .slice(0, MAX_QUERY_LEN);
  // Normaliza y ADEMÁS quita metacaracteres LIKE de Prisma (% _ \) — `contains`
  // NO los escapa, así que sin esto un usuario podría ampliar la búsqueda con
  // comodines (enumeración). Sigue siendo parametrizado (sin inyección SQL).
  const nq = normalizeName(q).replace(/[%_\\]/g, "");
  if (nq.length < MIN_QUERY_LEN) {
    return { query: q, groups: [], total: 0, truncated: false };
  }

  const rows = await prisma.missingPersonReport.findMany({
    where: { normalizedName: { contains: nq }, stale: false },
    orderBy: [{ normalizedName: "asc" }, { status: "asc" }],
    take: LIMIT,
  });
  const truncated = rows.length === LIMIT;

  // Agrupa por normalizedName preservando el orden de aparición.
  const byName = new Map<string, MissingPersonReport[]>();
  for (const row of rows) {
    const list = byName.get(row.normalizedName);
    if (list) list.push(row);
    else byName.set(row.normalizedName, [row]);
  }

  const groups: MissingPersonGroupDTO[] = [];
  for (const [normalizedName, groupRows] of byName) {
    const first = groupRows[0];
    if (!first) continue; // inalcanzable: el grupo siempre tiene ≥1 fila
    groups.push({
      normalizedName,
      displayName: first.fullName,
      results: groupRows.map(toResultDTO),
      possibleSamePerson: detectPossibleSamePerson(groupRows),
    });
  }

  return { query: q, groups, total: rows.length, truncated };
}
