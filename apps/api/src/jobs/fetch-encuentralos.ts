import { fileURLToPath } from "node:url";
import { prisma } from "../db";
import { mapEncuentralos, type EncuentralosRawPerson } from "../mappers/encuentralos";
import { safeGet } from "../lib/safe-fetch";
import { runAbsentSweep, summarizeSweep } from "../lib/missing-person-lifecycle";

// Ingesta de encuentralos.tecnosoft.dev (API JSON pública de desaparecidos).
// Mirror de fetch-venezuelatebusca.ts: fetch -> parse -> map (PURO, PII removida)
// -> upsert por (sourceId, externalId) -> absent-sweep (S6) -> fetch_run SIEMPRE
// -> update lastCheckedAt.
//
// PRIVACIDAD/SEGURIDAD: safeGet (host allowlist + redirect:"manual" + timeout +
// UA no-IA). rawResponseSnapshot SIEMPRE null. El mapper descarta foto/GPS/contacto
// y enmascara la edad de menores.

const SOURCE_NAME = "Encuéntralos";
const JOB_NAME = "fetch:encuentralos";
const SITE_ORIGIN = "https://encuentralos.tecnosoft.dev";
const ALLOWED_HOST = "encuentralos.tecnosoft.dev"; // allowlist SSRF (hardcodeado)
const API_PATH = "/api/personas";
// La API capa `limit` a 100. Paginación por limit/offset; full sync ~ total/100.
const PAGE_SIZE = Number(process.env.ENC_PAGE_SIZE ?? 100);
// Tope de seguridad por corrida. Un run CAPADO NO es full sync -> el absent-sweep
// (S6) se OMITE (no falso mass-stale). Súbelo para un sync completo (~96k => ~962 págs).
const MAX_PAGES = Number(process.env.ENC_MAX_PAGES ?? 60);
const PAGE_DELAY_MS = Number(process.env.ENC_PAGE_DELAY_MS ?? 200); // cortesía con la fuente

// --- Parser JSON (defensivo, sin `any`) ---

export interface EncuentralosPage {
  persons: EncuentralosRawPerson[];
  total: number | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return isRecord(v) ? v : undefined;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function ageVal(v: unknown): number | string | null {
  return typeof v === "number" || typeof v === "string" ? v : null;
}

// Copia SOLO los campos consumidos. foto/ultima_lat/ultima_lng/cedula/
// reporta_contacto/pv_contacto NO se copian a propósito (PII) — ni llegan al mapper.
function toRawPerson(o: Record<string, unknown>): EncuentralosRawPerson {
  return {
    id: str(o.id),
    nombre: str(o.nombre),
    edad: ageVal(o.edad),
    sexo: str(o.sexo),
    descripcion: str(o.descripcion),
    ultima_ubicacion: str(o.ultima_ubicacion),
    ultima_vez: str(o.ultima_vez),
    estado: str(o.estado),
    creado: str(o.creado),
    pv_por: str(o.pv_por),
    pv_lugar: str(o.pv_lugar),
    pv_salud: str(o.pv_salud),
    pv_relacion: str(o.pv_relacion),
  };
}

export function parseEncuentralos(text: string): EncuentralosPage {
  const root = asRecord(JSON.parse(text) as unknown);
  const itemsRaw = root?.["items"];
  const persons = Array.isArray(itemsRaw) ? itemsRaw.filter(isRecord).map(toRawPerson) : [];
  const total = typeof root?.["total"] === "number" ? (root["total"] as number) : null;
  return { persons, total };
}

// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEncPage(offset: number): Promise<EncuentralosPage> {
  const url = `${SITE_ORIGIN}${API_PATH}?limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await safeGet(url, ALLOWED_HOST, "application/json");
  return parseEncuentralos(await res.text());
}

export async function runEncuentralosFetch(): Promise<void> {
  const source = await prisma.officialSource.findUnique({ where: { name: SOURCE_NAME } });
  if (!source) throw new Error(`Falta la fuente '${SOURCE_NAME}'. Corre seed:sources primero.`);

  const startedAt = new Date();
  const runMark = startedAt;
  let itemsFound = 0;
  let created = 0;
  let updated = 0;
  let errorMessage: string | null = null;
  let status: "success" | "partial" | "failed" = "success";
  let pagesFetched = 0;
  let cappedPages = false;
  let sweepNote: string | null = null;

  try {
    // Paginación robusta: avanza el offset por la cantidad REALMENTE devuelta
    // (la API capa limit a 100) y termina al vaciarse o alcanzar `total`.
    const collected: EncuentralosRawPerson[] = [];
    let offset = 0;
    let total: number | null = null;
    for (;;) {
      const page = await fetchEncPage(offset);
      pagesFetched++;
      if (page.total != null) total = page.total;
      if (page.persons.length === 0) break; // sin más datos -> full sync
      collected.push(...page.persons);
      offset += page.persons.length;
      if (total != null && offset >= total) break; // alcanzado el total -> full sync
      if (pagesFetched >= MAX_PAGES) {
        cappedPages = true;
        break;
      }
      if (PAGE_DELAY_MS > 0) await sleep(PAGE_DELAY_MS);
    }
    itemsFound = collected.length;

    const existing = await prisma.missingPersonReport.findMany({
      where: { sourceId: source.id },
      select: { externalId: true },
    });
    const existingSet = new Set(existing.map((e) => e.externalId));

    for (const raw of collected) {
      try {
        const input = mapEncuentralos(raw);
        await prisma.missingPersonReport.upsert({
          where: { sourceId_externalId: { sourceId: source.id, externalId: input.externalId } },
          create: { ...input, sourceId: source.id, lastSeenAt: runMark, missedRuns: 0, stale: false, staleSince: null },
          update: { ...input, lastSeenAt: runMark, missedRuns: 0, stale: false, staleSince: null },
        });
        if (existingSet.has(input.externalId)) updated++;
        else created++;
      } catch (e) {
        status = "partial";
        errorMessage = `${errorMessage ?? ""}\n${raw.id ?? "?"}: ${(e as Error).message}`.trim();
      }
    }

    if (cappedPages) {
      errorMessage = `${errorMessage ? errorMessage + "\n" : ""}sync parcial: tope ENC_MAX_PAGES=${MAX_PAGES} alcanzado`;
    }

    // S6 absent-sweep con safety valve. fullSync = !cappedPages.
    try {
      const sweep = await runAbsentSweep({
        sourceId: source.id,
        runMark,
        status,
        fullSync: !cappedPages,
        itemsFound,
      });
      sweepNote = summarizeSweep(sweep);
    } catch (e) {
      sweepNote = `sweep error: ${(e as Error).message}`;
      if (status === "success") status = "partial";
    }
  } catch (e) {
    status = "failed";
    errorMessage = `${errorMessage ? errorMessage + "\n" : ""}${(e as Error).message}`.trim();
    sweepNote = "sweep: OMITIDO (fetch falló)";
  }

  if (sweepNote) errorMessage = `${errorMessage ? errorMessage + "\n" : ""}${sweepNote}`;

  await prisma.fetchRun.create({
    data: {
      sourceId: source.id,
      jobName: JOB_NAME,
      status,
      startedAt,
      finishedAt: new Date(),
      itemsFound,
      itemsCreated: created,
      itemsUpdated: updated,
      errorMessage,
      // rawResponseSnapshot se OMITE a propósito -> NULL en DB (no re-persistir PII).
    },
  });
  await prisma.officialSource.update({
    where: { id: source.id },
    data: { lastCheckedAt: new Date(), status: status === "failed" ? "degraded" : "active" },
  });

  console.log(
    `encuentralos fetch: ${status} — páginas ${pagesFetched}, encontrados ${itemsFound}, ` +
      `creados ${created}, actualizados ${updated}` +
      (cappedPages ? ` (sync parcial, tope ${MAX_PAGES} páginas)` : "") +
      (sweepNote ? ` | ${sweepNote}` : "") +
      (errorMessage ? ` (notas: ${errorMessage})` : ""),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runEncuentralosFetch()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
