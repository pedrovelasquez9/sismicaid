import { normalizeName } from "./normalize-name";

// Helpers PUROS de saneo para la ingesta de personas desaparecidas.
// Defensa en profundidad: aunque el mapper ya descarta los campos de contacto
// estructurados (reporter, finder phone/email), el texto libre (description,
// finder) puede contener teléfonos/emails/cédulas pegados a mano. Los removemos
// ANTES de persistir.

// Patrones de contacto/identificación a eliminar del texto libre.
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
// Cédula/pasaporte venezolano: V-12345678, E12345678, J-31000000, etc.
const CEDULA_RE = /\b[vejgp]-?\d{6,9}\b/gi;
// Teléfonos: +58..., 0414-..., secuencias largas de dígitos con separadores.
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;
// Dígitos sueltos largos (cédula sin prefijo / IDs).
const LONG_DIGITS_RE = /\b\d{6,}\b/g;

// Limpia espacios y signos de puntuación colgantes tras remover tokens.
function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;:])\1+/g, "$1")
    .replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "")
    .trim();
}

// Remueve emails/URLs/teléfonos/cédulas del texto libre. Devuelve null si queda
// vacío (para que el campo sea NULL en DB, no "").
export function scrubText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const scrubbed = String(raw)
    .replace(EMAIL_RE, " ")
    .replace(URL_RE, " ")
    .replace(CEDULA_RE, " ")
    .replace(PHONE_RE, " ")
    .replace(LONG_DIGITS_RE, " ");
  const out = tidy(scrubbed);
  return out.length > 0 ? out : null;
}

// Estados de Venezuela (canónicos) + alias frecuentes en los registros
// comunitarios (Vargas = La Guaira; Caracas = Distrito Capital).
const VE_STATES = [
  "Amazonas",
  "Anzoátegui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolívar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Distrito Capital",
  "Falcón",
  "Guárico",
  "La Guaira",
  "Lara",
  "Mérida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Táchira",
  "Trujillo",
  "Yaracuy",
  "Zulia",
] as const;

// alias normalizado -> estado canónico
const STATE_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["vargas", "La Guaira"],
  ["la guaira", "La Guaira"],
  ["caraballeda", "La Guaira"],
  ["maiquetia", "La Guaira"],
  ["caracas", "Distrito Capital"],
  ["distrito federal", "Distrito Capital"],
  ["dtto capital", "Distrito Capital"],
];

// Lista pre-normalizada (estado canónico, token a buscar) — los estados primero,
// luego los alias. Se elige la primera coincidencia.
const STATE_MATCHERS: ReadonlyArray<readonly [string, string]> = [
  ...VE_STATES.map((s) => [normalizeName(s), s] as const),
  ...STATE_ALIASES.map(([token, canonical]) => [normalizeName(token), canonical] as const),
];

// Best-effort: detecta el estado venezolano mencionado en un texto de ubicación.
// Devuelve el nombre canónico o null. Solo pista para dedup suave (no autoritativo).
export function extractState(text: string | null | undefined): string | null {
  if (!text) return null;
  const haystack = normalizeName(text);
  if (!haystack) return null;
  for (const [token, canonical] of STATE_MATCHERS) {
    if (haystack.includes(token)) return canonical;
  }
  return null;
}

// Allowlist de esquema para sourceUrl: solo http(s). Rechaza javascript:/data:/
// file: etc. Si la URL es inválida o de otro esquema, devuelve `fallback`.
// Importante porque cada fuente construye su propia URL de detalle.
export function httpUrlOr(url: string | null | undefined, fallback: string): string {
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") return url;
    } catch {
      // URL inválida -> fallback
    }
  }
  return fallback;
}

// Normaliza el género a una etiqueta estable (femenino/masculino) o null.
// Acepta vocabulario en español e inglés (las fuentes usan "male"/"female").
export function normalizeGender(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const g = raw.trim().toLowerCase();
  if (!g) return null;
  if (g === "f" || g.startsWith("fem") || g.startsWith("female") || g.includes("mujer")) return "femenino";
  if (g === "m" || g.startsWith("masc") || g.startsWith("male") || g.includes("hombre")) return "masculino";
  return null;
}
