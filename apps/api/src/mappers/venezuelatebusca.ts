import type { MissingPersonStatus } from "@sismicaid/shared";
import { normalizeName } from "../lib/normalize-name";
import { extractState, httpUrlOr, normalizeGender, scrubText } from "../lib/missing-person-scrub";
import { deriveExternalId } from "../lib/external-id";
import { clean, parseAge, parseDate } from "./raw-helpers";
import type { MissingPersonReportInput } from "./missing-person-input";

// Mapper PURO de venezuelatebusca.com -> MissingPersonReportInput.
// No hace red ni DB (así los tests de api siguen verdes y es testeable a mano).
//
// PRIVACIDAD: NUNCA recibe ni deriva la cédula. Descarta foto (photoUrl), contacto
// del reportante (reporter{name,phone,email}), sources[] y tips[]. NUNCA devuelve
// rawPayload. La edad exacta de menores se enmascara aquí (age=null cuando <18).

const SOURCE_NAME = "Venezuela Te Busca";
const SITE_ORIGIN = "https://venezuelatebusca.com";

// Fila cruda tal como sale del loader turbo-stream (window.__reactRouterContext /
// /_root.data). Solo declaramos lo que consumimos. NO declaramos idNumber (cédula):
// el parser del job NO la copia y el mapper NUNCA la toca -> imposible derivar un
// id a partir de ella (R1-B2). photoUrl/reporter/sources/tips también se descartan.
export interface VtbRawPerson {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  age?: number | string | null;
  gender?: string | null;
  lastSeen?: string | null;
  description?: string | null;
  status?: string | null;
  hospitalName?: string | null;
  hospitalStatus?: string | null;
  foundNote?: string | null;
  finder?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// Vocabulario de estado -> enum de 3 valores. La fuente guarda el estado en
// inglés ("missing"/"found") pero soportamos también español por robustez.
// El estado de la fuente es autoritativo; la presencia de hospital NO lo cambia.
export function mapVtbStatus(raw: string | null | undefined): MissingPersonStatus {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "found" || s.includes("encontrad") || s.includes("localizad")) return "found";
  if (s === "hospitalized" || s.includes("hospitaliz") || s.includes("en hospital")) return "hospitalized";
  if (s === "missing" || s.includes("desaparecid")) return "missing";
  return "missing"; // sin mapear / vacío -> conservador
}

export function mapVtb(raw: VtbRawPerson): MissingPersonReportInput {
  const firstName = clean(raw.firstName) ?? "";
  const lastName = clean(raw.lastName) ?? "";
  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();

  const ageNum = parseAge(raw.age);
  const isMinor = ageNum != null && ageNum < 18;

  const normalizedName = normalizeName(fullName);
  const reportedAt = parseDate(raw.createdAt);

  const nativeId = clean(raw.id);
  // Sin id nativo -> id opaco derivado de campos NO-PII (nombre + fecha). NUNCA
  // de la cédula (R1-B2). En la práctica todos los registros traen `id`.
  const externalId = nativeId ?? deriveExternalId("vtb", normalizedName, reportedAt?.toISOString());
  const sourceUrl = httpUrlOr(
    nativeId ? `${SITE_ORIGIN}/?person=${encodeURIComponent(nativeId)}` : `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/`,
  );

  // scrubText en TODO texto libre: la ubicación/hospital/salud también pueden
  // traer teléfonos/emails/cédulas escritos a mano (visto en datos reales).
  const lastSeen = scrubText(raw.lastSeen);

  return {
    sourceName: SOURCE_NAME,
    externalId,
    fullName,
    normalizedName,
    // MÁSCARA DE MENORES EN INGESTA: la edad exacta de un menor jamás llega a la DB.
    age: isMinor ? null : ageNum,
    isMinor,
    gender: normalizeGender(raw.gender),
    lastSeenLocation: lastSeen,
    lastSeenState: extractState(lastSeen),
    status: mapVtbStatus(raw.status),
    hospitalName: scrubText(raw.hospitalName),
    healthStatus: scrubText(raw.hospitalStatus),
    // Conserva el NOMBRE del buscador (prueba de vida) pero remueve teléfono/email/cédula.
    foundBy: scrubText(clean(raw.finder) ?? clean(raw.foundNote)),
    description: scrubText(raw.description),
    sourceUrl,
    reportedAt,
  };
}
