import { fileURLToPath } from "node:url";
import { prisma } from "../db";
import { mapVtb, type VtbRawPerson } from "../mappers/venezuelatebusca";
import { safeGet } from "../lib/safe-fetch";
import { runAbsentSweep, summarizeSweep } from "../lib/missing-person-lifecycle";

// Ingesta de venezuelatebusca.com (registro comunitario de desaparecidos).
// Mirror de fetch-ptwc.ts: fetch -> parse -> map (PURO, PII removida) -> upsert
// por (sourceId, externalId) -> fetch_run SIEMPRE -> update lastCheckedAt.
//
// PRIVACIDAD/SEGURIDAD:
// - fetch SOLO al host hardcodeado (allowlist) -> sin SSRF (no hay URL de usuario).
// - User-Agent descriptivo NO-IA (el robots del sitio solo bloquea bots de IA).
// - rawResponseSnapshot SIEMPRE null (no re-persistir PII de la respuesta).
// - El mapper puro descarta cédula/foto/contacto y enmascara la edad de menores.
//
// El absent-sweep (missedRuns/stale/purga + safety valve) es S6 y NO está aquí;
// el present-path resetea missedRuns/stale en cada upsert.

const SOURCE_NAME = "Venezuela Te Busca";
const JOB_NAME = "fetch:venezuelatebusca";
const SITE_ORIGIN = "https://venezuelatebusca.com";
const ALLOWED_HOST = "venezuelatebusca.com"; // allowlist SSRF (hardcodeado)
const DATA_PATH = "/_root.data"; // loader React Router (turbo-stream, text/x-script)
// Tope de seguridad de páginas por corrida (~20 registros/página). Súbelo para un
// sync completo (~34.8k => ~1745 páginas). Ver "ASSUMPTION" abajo. Un run CAPADO
// NO es full sync -> el absent-sweep (S6) se OMITE (no falso mass-stale).
const MAX_PAGES = Number(process.env.VTB_MAX_PAGES ?? 60);
const PAGE_DELAY_MS = Number(process.env.VTB_PAGE_DELAY_MS ?? 200); // cortesía con la fuente

// ---------------------------------------------------------------------------
// PARSER turbo-stream (lógica frágil AISLADA con contrato claro de entrada/salida).
// El loader /_root.data devuelve el formato deduplicado de React Router: un arreglo
// plano donde los valores numéricos son ÍNDICES dentro del mismo arreglo y las
// claves de objeto vienen como "_<idx>". Negativos = centinela (undefined/null).
// Reconstruimos el árbol y navegamos routes/_index.data.persons.
// ---------------------------------------------------------------------------

export interface VtbPage {
  persons: VtbRawPerson[];
  hasMore: boolean;
  totalCount: number | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return isRecord(v) ? v : undefined;
}

function decodeTurboStream(arr: unknown[]): unknown {
  const cache = new Map<number, unknown>();
  function deref(ref: unknown): unknown {
    if (typeof ref !== "number") return ref;
    if (ref < 0) return null; // centinela (undefined/null/hole) -> null
    if (cache.has(ref)) return cache.get(ref);
    const v = arr[ref];
    if (Array.isArray(v)) {
      const out: unknown[] = [];
      cache.set(ref, out); // set antes de poblar: corta posibles ciclos
      for (const e of v) out.push(deref(e));
      return out;
    }
    if (isRecord(v)) {
      const out: Record<string, unknown> = {};
      cache.set(ref, out);
      for (const k of Object.keys(v)) {
        const keyIdx = Number(k.startsWith("_") ? k.slice(1) : k);
        const keyName = String(deref(keyIdx));
        // Guarda anti prototype-pollution: ignora claves peligrosas.
        if (keyName === "__proto__" || keyName === "constructor" || keyName === "prototype") continue;
        out[keyName] = deref(v[k]);
      }
      return out;
    }
    cache.set(ref, v); // literal (string/number/boolean/null)
    return v;
  }
  return deref(0);
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function ageVal(v: unknown): number | string | null {
  return typeof v === "number" || typeof v === "string" ? v : null;
}

// Toma SOLO los campos que consumimos. idNumber/photoUrl/reporter/sources/tips se
// IGNORAN aquí a propósito (PII) — ni siquiera llegan al objeto raw del mapper.
function toRawPerson(o: Record<string, unknown>): VtbRawPerson {
  return {
    id: str(o.id),
    firstName: str(o.firstName),
    lastName: str(o.lastName),
    age: ageVal(o.age),
    gender: str(o.gender),
    lastSeen: str(o.lastSeen),
    description: str(o.description),
    status: str(o.status),
    hospitalName: str(o.hospitalName),
    hospitalStatus: str(o.hospitalStatus),
    foundNote: str(o.foundNote),
    finder: str(o.finder),
    createdAt: str(o.createdAt),
    updatedAt: str(o.updatedAt),
  };
}

export function parseVtbTurboStream(text: string): VtbPage {
  const arr = JSON.parse(text) as unknown[];
  if (!Array.isArray(arr)) throw new Error("venezuelatebusca: respuesta no es un arreglo turbo-stream");
  const root = asRecord(decodeTurboStream(arr));
  const routeData = asRecord(asRecord(root?.["routes/_index"])?.["data"]);
  const personsRaw = routeData?.["persons"];
  const persons = Array.isArray(personsRaw) ? personsRaw.filter(isRecord).map(toRawPerson) : [];
  const pagination = asRecord(routeData?.["pagination"]);
  const hasMore = pagination?.["hasMore"] === true;
  const totalCount = typeof routeData?.["totalCount"] === "number" ? (routeData["totalCount"] as number) : null;
  return { persons, hasMore, totalCount };
}

// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVtbPage(page: number): Promise<VtbPage> {
  const url = `${SITE_ORIGIN}${DATA_PATH}?page=${page}`;
  // safeGet: host allowlist + redirect:"manual" (3xx -> error) + timeout + UA no-IA.
  const res = await safeGet(url, ALLOWED_HOST, "text/x-script, text/html;q=0.9");
  return parseVtbTurboStream(await res.text());
}

export async function runVenezuelaTeBuscaFetch(): Promise<void> {
  const source = await prisma.officialSource.findUnique({ where: { name: SOURCE_NAME } });
  if (!source) throw new Error(`Falta la fuente '${SOURCE_NAME}'. Corre seed:sources primero.`);

  const startedAt = new Date();
  const runMark = startedAt; // marca de "presente en esta corrida" (lastSeenAt)
  let itemsFound = 0;
  let created = 0;
  let updated = 0;
  let errorMessage: string | null = null;
  let status: "success" | "partial" | "failed" = "success";
  let pagesFetched = 0;
  let cappedPages = false;
  let sweepNote: string | null = null;

  try {
    // Enumeración por páginas siguiendo pagination.hasMore.
    const collected: VtbRawPerson[] = [];
    let page = 1;
    for (;;) {
      const { persons, hasMore } = await fetchVtbPage(page);
      pagesFetched++;
      collected.push(...persons);
      if (!hasMore || persons.length === 0) break;
      if (page >= MAX_PAGES) {
        cappedPages = true;
        break;
      }
      page++;
      if (PAGE_DELAY_MS > 0) await sleep(PAGE_DELAY_MS);
    }
    itemsFound = collected.length;

    // created vs updated: prefetch de externalIds ya existentes para esta fuente.
    const existing = await prisma.missingPersonReport.findMany({
      where: { sourceId: source.id },
      select: { externalId: true },
    });
    const existingSet = new Set(existing.map((e) => e.externalId));

    for (const raw of collected) {
      try {
        const input = mapVtb(raw);
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
      // Dentro del try `status` es success|partial (failed solo se asigna en el
      // catch). No es un fallo, pero deja constancia de que NO fue un sync completo
      // (relevante para el absent-sweep de S6, que NO debe purgar tras esto).
      errorMessage = `${errorMessage ? errorMessage + "\n" : ""}sync parcial: tope VTB_MAX_PAGES=${MAX_PAGES} alcanzado`;
    }

    // S6 absent-sweep (stale + purga 30d). fullSync = !cappedPages -> un run capado
    // NUNCA dispara el sweep (la safety valve también lo bloquearía). Aislado en su
    // try para que un fallo del sweep no marque como fallida una ingesta correcta.
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
      // rawResponseSnapshot se OMITE a propósito -> NULL en DB. NUNCA guardamos la
      // respuesta cruda (re-introduciría PII ya removida por el mapper).
    },
  });
  await prisma.officialSource.update({
    where: { id: source.id },
    data: { lastCheckedAt: new Date(), status: status === "failed" ? "degraded" : "active" },
  });

  console.log(
    `venezuelatebusca fetch: ${status} — páginas ${pagesFetched}, encontrados ${itemsFound}, ` +
      `creados ${created}, actualizados ${updated}` +
      (cappedPages ? ` (sync parcial, tope ${MAX_PAGES} páginas)` : "") +
      (sweepNote ? ` | ${sweepNote}` : "") +
      (errorMessage ? ` (notas: ${errorMessage})` : ""),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runVenezuelaTeBuscaFetch()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
