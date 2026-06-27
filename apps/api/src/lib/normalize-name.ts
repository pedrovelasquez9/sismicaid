// Normaliza un nombre para búsqueda insensible a acentos y mayúsculas.
// PURA, sin dependencias. Se usa en AMBOS lados (ingesta y query) para que un
// simple `contains` sobre normalizedName sea equivalente a una búsqueda
// acento-insensible sin extensiones de Postgres (unaccent).
//
// Pasos: NFD (separa marcas combinantes) -> elimina diacríticos U+0300–U+036F
// -> minúsculas -> colapsa espacios -> trim.
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
