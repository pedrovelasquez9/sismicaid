// apps/api/src/lib/geo.ts
// Difumina una coordenada redondeándola a una rejilla de 0.001° (~110 m).
// Determinista: el mismo reporte siempre cae en la misma celda (no "salta").
// Privacidad: por defecto el público no recibe la coordenada exacta de una
// persona (SECURITY_AND_PRIVACY.md). El usuario puede optar por exacta al
// reportar; en ese caso NO se difumina.
export function roundToGrid(coord: number): number {
  return Math.round(coord * 1000) / 1000;
}
