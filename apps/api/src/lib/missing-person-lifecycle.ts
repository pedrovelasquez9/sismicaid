import { prisma } from "../db";

// Ciclo de vida de los reportes de personas (S6): honra borrados upstream.
// Compartido por AMBOS jobs (vtb, encuentralos). Se ejecuta DESPUÉS del upsert y
// ANTES de FetchRun.create. Es el "absent-sweep":
//   (a) registros ausentes este run (lastSeenAt < runMark) -> missedRuns += 1
//   (b) missedRuns >= 3 y aún no stale -> stale=true + staleSince=now
//   (c) purga DURA: stale con staleSince < now-30d -> deleteMany
// (El present-path de cada job ya resetea missedRuns/stale en cada upsert.)
//
// SAFETY VALVE (triple, contra falso mass-stale/purge):
//   1) status === "success" (no fetch error / no partial);
//   2) fullSync === true (NO un run capado: vtb se capa por VTB_MAX_PAGES y solo
//      ve ~1200 de ~34.8k -> un sweep ahí estancaría los otros ~33k);
//   3) itemsFound >= max(1, 0.5 * activeCountBefore) (un fetch truncado/anómalo
//      que devuelve <50% del set activo NO puede estanciar/purgar en masa).
// Si cualquiera falla -> se OMITE todo el sweep (no se toca ninguna fila).

const STALE_THRESHOLD = 3; // missedRuns >= 3 (3 corridas ausentes ~ 90 min a 30 min de cadencia)
const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 días tras volverse stale
const MIN_RETURN_RATIO = 0.5;

export interface AbsentSweepParams {
  sourceId: string;
  runMark: Date; // misma marca usada como lastSeenAt en los upserts del run
  status: "success" | "partial" | "failed";
  fullSync: boolean; // true solo si se enumeró la fuente completa (no capado)
  itemsFound: number;
  now?: Date; // inyectable para pruebas
}

export interface AbsentSweepResult {
  ran: boolean;
  skippedReason: string | null;
  activeBefore: number;
  missedIncremented: number;
  newlyStale: number;
  purged: number;
}

export async function runAbsentSweep(p: AbsentSweepParams): Promise<AbsentSweepResult> {
  const now = p.now ?? new Date();
  const activeBefore = await prisma.missingPersonReport.count({
    where: { sourceId: p.sourceId, stale: false },
  });
  const base: AbsentSweepResult = {
    ran: false,
    skippedReason: null,
    activeBefore,
    missedIncremented: 0,
    newlyStale: 0,
    purged: 0,
  };

  // --- SAFETY VALVE ---
  if (p.status !== "success") return { ...base, skippedReason: `status=${p.status}` };
  if (!p.fullSync) return { ...base, skippedReason: "no full sync (run capado/parcial)" };
  const minReturn = Math.max(1, Math.floor(MIN_RETURN_RATIO * activeBefore));
  if (p.itemsFound < minReturn) {
    return { ...base, skippedReason: `under-return (itemsFound=${p.itemsFound} < ${minReturn})` };
  }

  // (a) ausentes este run -> missedRuns += 1. Los presentes tienen lastSeenAt ===
  //     runMark (el upsert lo fijó), así que `lt` los excluye correctamente.
  const incremented = await prisma.missingPersonReport.updateMany({
    where: { sourceId: p.sourceId, lastSeenAt: { lt: p.runMark } },
    data: { missedRuns: { increment: 1 } },
  });

  // (b) >= 3 perdidas y aún activas -> stale + staleSince.
  const staled = await prisma.missingPersonReport.updateMany({
    where: { sourceId: p.sourceId, missedRuns: { gte: STALE_THRESHOLD }, stale: false },
    data: { stale: true, staleSince: now },
  });

  // (c) purga dura: stale con staleSince anterior a 30 días.
  const purgeCutoff = new Date(now.getTime() - PURGE_AFTER_MS);
  const purged = await prisma.missingPersonReport.deleteMany({
    where: { sourceId: p.sourceId, stale: true, staleSince: { lt: purgeCutoff } },
  });

  return {
    ran: true,
    skippedReason: null,
    activeBefore,
    missedIncremented: incremented.count,
    newlyStale: staled.count,
    purged: purged.count,
  };
}

// Resumen compacto para registrar en FetchRun.errorMessage (campo de texto libre).
export function summarizeSweep(r: AbsentSweepResult): string {
  if (!r.ran) return `sweep: OMITIDO (${r.skippedReason ?? "?"}; activos=${r.activeBefore})`;
  return `sweep: activos=${r.activeBefore} missed+=${r.missedIncremented} stale+=${r.newlyStale} purgados=${r.purged}`;
}
