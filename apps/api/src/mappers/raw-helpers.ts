// Helpers PUROS compartidos por los mappers de personas (vtb, encuentralos).

// Trim + null si queda vacío (para que el campo sea NULL en DB, no "").
export function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}

// Edad entera plausible o null. Rango defensivo [0,130].
export function parseAge(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 130) return null;
  return Math.trunc(n);
}

export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
