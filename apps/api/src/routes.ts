import type { FastifyInstance } from "fastify";
import { getStatus } from "./services/status";
import { getSeismicEvent, listSeismicEvents, parseSeismicFilters } from "./services/seismic";
import { getCurrentTsunami, listCoastalZones } from "./services/tsunami";
import { isRecommendationContext, listRecommendations } from "./services/recommendations";
import { createReport, isReportType, isUrgency, listReports } from "./services/reports";
import { createReportSchema } from "./validation/report";
import { isResourceType, listResources } from "./services/resources";
import { listNeeds } from "./services/needs";
import { listTrappedPersons, resolveTrappedPerson } from "./services/trapped-persons";
import { searchMissingPersons } from "./services/missing-persons";

// Rutas públicas de docs/API.md (todas implementadas en el MVP).

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/status", async () => getStatus());

  app.get("/api/seismic-events", async (req) => listSeismicEvents(parseSeismicFilters(req.query)));

  app.get("/api/seismic-events/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = await getSeismicEvent(id);
    if (!event) return reply.code(404).send({ error: "not_found" });
    return event;
  });

  app.get("/api/tsunami-alerts/current", async () => getCurrentTsunami());

  app.get("/api/coastal-zones", async () => listCoastalZones());

  app.get("/api/recommendations", async (req) => {
    const ctx = (req.query as Record<string, string | undefined>).context;
    const context = ctx && isRecommendationContext(ctx) ? ctx : undefined;
    return listRecommendations(context);
  });

  app.get("/api/reports", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const reportTypes = q.reportTypes
      ? q.reportTypes.split(",").map((s) => s.trim()).filter(isReportType)
      : undefined;
    return listReports({
      state: q.state || undefined,
      reportType: q.reportType && isReportType(q.reportType) ? q.reportType : undefined,
      reportTypes: reportTypes && reportTypes.length ? reportTypes : undefined,
      urgency: q.urgency && isUrgency(q.urgency) ? q.urgency : undefined,
    });
  });

  // Rate limit estricto solo en reportes (anti-spam, SECURITY_AND_PRIVACY.md).
  app.post(
    "/api/reports",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = createReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "validation_error",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      const dto = await createReport(parsed.data);
      return reply.code(201).send(dto);
    },
  );

  app.get("/api/trapped-persons", async () => listTrappedPersons());

  // Acción de moderación: marcar zona como rescatada. Protegida por token
  // compartido (no hay auth aún). Devuelve 401 sin token válido.
  app.patch("/api/reports/:id/resolve", async (req, reply) => {
    const token = req.headers["x-moderation-token"];
    const expected = process.env.MODERATION_TOKEN;
    if (!expected || token !== expected) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { id } = req.params as { id: string };
    const dto = await resolveTrappedPerson(id);
    if (!dto) return reply.code(404).send({ error: "not_found" });
    return dto;
  });

  app.get("/api/resources", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return listResources({
      state: q.state || undefined,
      type: q.type && isResourceType(q.type) ? q.type : undefined,
    });
  });

  app.get("/api/needs", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return listNeeds({ state: q.state || undefined, category: q.category || undefined });
  });

  // Meta-buscador de personas desaparecidas. Solo lectura, reactivo (requiere ?q=).
  // Rate-limit 30/min (más holgado que reportes: un buscador hace varias consultas).
  // El input se sanea y solo llega a Prisma como `contains` parametrizado.
  app.get(
    "/api/missing-persons",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) => searchMissingPersons((req.query as Record<string, string | undefined>).q ?? ""),
  );
}
