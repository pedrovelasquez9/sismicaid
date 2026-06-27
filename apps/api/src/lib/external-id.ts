import { createHmac } from "node:crypto";

// Deriva un externalId estable y opaco a partir de campos NO-PII, para registros
// que carezcan de un id nativo estable. PURO.
//
// IMPORTANTE (privacidad): los `parts` que reciba esta función deben ser SIEMPRE
// no-PII (p. ej. normalizedName que ya se muestra públicamente + reportedAt ISO).
// NUNCA se le debe pasar cédula/idNumber ni contacto: un HMAC con salt pública
// sobre una cédula (~27 bits) es recuperable offline desde un dump. Por eso esta
// función existe: cerrar esa vía. El salt no es secreto, solo da espacio de nombres.
const NAMESPACE = "sismicaid:people-search:external-id:v1";

export function deriveExternalId(prefix: string, ...parts: Array<string | null | undefined>): string {
  const seed = parts.map((p) => (p ?? "").trim()).join("|");
  const digest = createHmac("sha256", NAMESPACE).update(seed).digest("hex").slice(0, 24);
  return `${prefix}:${digest}`;
}
