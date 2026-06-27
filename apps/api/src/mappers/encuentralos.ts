import type { MissingPersonStatus } from "@sismicaid/shared";
import { normalizeName } from "../lib/normalize-name";
import { extractState, httpUrlOr, normalizeGender, scrubText } from "../lib/missing-person-scrub";
import { deriveExternalId } from "../lib/external-id";
import { clean, parseAge, parseDate } from "./raw-helpers";
import type { MissingPersonReportInput } from "./missing-person-input";

// Mapper PURO de encuentralos.tecnosoft.dev (API JSON /api/personas) ->
// MissingPersonReportInput. No hace red ni DB.
//
// PRIVACIDAD: descarta foto y GPS exacto (ultima_lat/ultima_lng); cédula y
// reporta_contacto ya vienen null en la fuente; pv_contacto (contacto del que
// reportó la prueba de vida) se DESCARTA (no se declara siquiera). Conserva el
// NOMBRE del buscador como prueba de vida. Enmascara la edad de menores.

const SOURCE_NAME = "Encuéntralos";
const SITE_ORIGIN = "https://encuentralos.tecnosoft.dev";

// Fila cruda del JSON. Solo declaramos lo que consumimos. Campos PII/visuales
// (foto, ultima_lat, ultima_lng, cedula, reporta_contacto, pv_contacto) se OMITEN
// del tipo a propósito -> el parser del job no los copia y el mapper no los toca.
export interface EncuentralosRawPerson {
  id?: string | null;
  nombre?: string | null;
  edad?: number | string | null;
  sexo?: string | null;
  descripcion?: string | null;
  ultima_ubicacion?: string | null;
  ultima_vez?: string | null;
  estado?: string | null;
  creado?: string | null;
  // Prueba de vida (proof-of-life). pv_contacto (contacto) se descarta.
  pv_por?: string | null; // quién la encontró (nombre/rol)
  pv_lugar?: string | null; // lugar donde fue vista (a menudo hospital)
  pv_salud?: string | null; // estado de salud
  pv_relacion?: string | null; // relación del que reporta
}

// Vocabulario de estado -> enum de 3 valores. La fuente usa español ("desaparecido")
// pero soportamos inglés por robustez. Si `estado` viene vacío, se refina por la
// presencia de campos de prueba de vida (conservador: "found", nunca inventa
// "hospitalized" sin señal explícita).
export function mapEncuentralosStatus(
  estado: string | null | undefined,
  hasProofOfLife: boolean,
): MissingPersonStatus {
  const s = (estado ?? "").trim().toLowerCase();
  if (
    s === "found" ||
    s.includes("encontrad") ||
    s.includes("localizad") ||
    s.includes("recuperad") ||
    s.includes("reunid")
  ) {
    return "found";
  }
  if (s === "hospitalized" || s.includes("hospitaliz") || s.includes("en hospital")) return "hospitalized";
  if (s === "missing" || s.includes("desaparecid") || s.includes("perdid")) return "missing";
  if (s === "") return hasProofOfLife ? "found" : "missing";
  return "missing"; // sin mapear -> conservador
}

export function mapEncuentralos(raw: EncuentralosRawPerson): MissingPersonReportInput {
  const fullName = clean(raw.nombre) ?? "";
  const normalizedName = normalizeName(fullName);
  const reportedAt = parseDate(clean(raw.ultima_vez) ?? clean(raw.creado));

  const ageNum = parseAge(raw.edad);
  const isMinor = ageNum != null && ageNum < 18;

  const pvPor = clean(raw.pv_por);
  const pvLugar = clean(raw.pv_lugar);
  const pvSalud = clean(raw.pv_salud);
  const pvRelacion = clean(raw.pv_relacion);
  const hasProofOfLife = pvPor != null || pvLugar != null || pvSalud != null || pvRelacion != null;

  const nativeId = clean(raw.id);
  // Sin id nativo -> id opaco derivado de campos NO-PII. En la práctica todos traen `id`.
  const externalId = nativeId ?? deriveExternalId("enc", normalizedName, reportedAt?.toISOString());
  const sourceUrl = httpUrlOr(
    nativeId ? `${SITE_ORIGIN}/p/${encodeURIComponent(nativeId)}` : `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/`,
  );

  // scrubText en TODO texto libre: la ubicación/hospital/salud también pueden
  // traer teléfonos/emails/cédulas escritos a mano (visto en datos reales).
  const lastSeen = scrubText(raw.ultima_ubicacion);

  return {
    sourceName: SOURCE_NAME,
    externalId,
    fullName,
    normalizedName,
    // MÁSCARA DE MENORES EN INGESTA: la edad exacta de un menor jamás llega a la DB.
    age: isMinor ? null : ageNum,
    isMinor,
    gender: normalizeGender(raw.sexo),
    lastSeenLocation: lastSeen,
    lastSeenState: extractState(lastSeen),
    status: mapEncuentralosStatus(raw.estado, hasProofOfLife),
    hospitalName: scrubText(pvLugar), // lugar de prueba de vida (a menudo hospital)
    healthStatus: scrubText(pvSalud),
    // Conserva el NOMBRE del buscador/relación; el contacto (pv_contacto) ni se lee.
    foundBy: scrubText(pvPor ?? pvRelacion),
    description: scrubText(raw.descripcion),
    sourceUrl,
    reportedAt,
  };
}
