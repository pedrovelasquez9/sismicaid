# Roadmap Enterprise  SismicAid

> Plan de hardening enterprise-grade y funcionalidades esenciales de respuesta a emergencias.
> Estructurado en 6 sprints, cada uno un PR cohesivo y mergeable de forma independiente.
> Cada sprint cierra con verificación empírica antes de avanzar.

## Acuerdos con el maintainer

Este roadmap fue ajustado tras la revisión técnica de @pedrovelasquez9 sobre el Sprint 1 (issue #8). Cambios negociados respecto a la propuesta original:

- **No reemplazar lo existente.** Cuando el repo ya tiene una solución (outbox, cache, rate-limit, fuzzing por `roundToGrid`), los sprints siguientes EXTIENDEN, no reemplazan.
- **Decisiones arquitectónicas antes que código.** Cuando una funcionalidad nueva tiene implicaciones de privacidad o producto (safety check estado-server vs cliente-only), se decide con el maintainer en un issue separado antes de construir.
- **Sprint 4 reunificación familiar: ELIMINADO.** SPEC 3.3 prohíbe registro de personas desaparecidas. El riesgo (menores, suplantación, agresores) es muy alto.
- **Sprint 6 multicanal: ACOTADO.** WhatsApp Business API + Twilio + Bridgefy quedan fuera (costo/complejidad sin ROI para MVP). `wa.me` ya cubre el caso. A11y e i18n van como PRs propios graduales.
- **Infra opcional en Sprint 2.** CDN/OTel/status page/synthetic monitoring se evalúan caso por caso por costo y mantenimiento; no son gating.

## Principios

1. **Verificar primero, nunca asumir.** Ninguna capacidad se da por hecha sin prueba reproducible (smoke test, métrica, log).
2. **Slices pequeños.** Cada sprint puede mergearse y desplegarse de forma independiente, sin breaking changes.
3. **No reemplazar lo que funciona.** Extender outbox/cache/rate-limit/fuzzing existentes; no introducir sistemas paralelos.
4. **No inventar datos oficiales.** USGS y NOAA/PTWC siguen siendo las únicas fuentes oficiales. Todo lo ciudadano queda explícitamente etiquetado.
5. **Mobile-first, offline-first, low-bandwidth-first.** En sismo M6+ la red móvil se degrada o cae.
6. **Privacidad por defecto.** Ubicación fuzzed server-side vía `roundToGrid` (~1km, determinista) como fuente única; sin nombres; retención acotada.

---

## Sprint 1  Fundación enterprise (PR #1)

**Objetivo:** capa fundacional sobre la que se construyen los siguientes sprints. Sin nuevas features visibles al usuario; toda la inversión es en confiabilidad, seguridad e integridad de datos.

**Branch:** `feat/sprint-1-enterprise-foundation`

**Entregables:**
- **Audit log con hash chain SHA-256** (append-only, verificable)  fundación para todos los reportes y cambios.
- **Pipeline anti-abuso** para reportes ciudadanos: geofence Venezuela (bbox + polígono), deduplicación geo-temporal, sistema de reputación por device key anónimo. NO incluye rate-limit propio (lo provee `@fastify/rate-limit` global) ni fuzzing propio (lo provee `roundToGrid` en `lib/geo.ts`).
- **Pipeline NO se conecta a POST /api/reports en este PR.** El wire-up se hace en PR de seguimiento tras alinear política unificada.
- **Schema extendido** (Prisma): `audit_log`, `push_subscription`, `safety_check_campaign`, `safety_check_response`, `reporter_reputation`, `dedup_signature`, `notification_outbox`.
- **CI/CD hardening**: CodeQL, npm audit, gitleaks, Dependabot, branch protection rules documentadas.
- **Documentación operacional**: threat model (STRIDE), SLOs/SLIs, runbook de incident response.
- **Issue/PR templates** para mantener el flujo de slices pequeños.

**Verificación al cierre:**
- `pnpm typecheck` verde.
- Tests del hash chain en `node:test` (14 casos: tampering, deletion, reorder detectados).
- `pnpm build` verde.
- Migración Prisma generada y aplicable a una base limpia (validada con Postgres 16 efímero).

---

## Sprint 2  Resiliencia y observabilidad (PR #2)

**Objetivo:** que la app no se caiga cuando más se necesita. Extender lo que ya existe (`apps/web/src/lib/outbox.ts`, `apps/web/src/lib/cache.ts`, `@vite-pwa/astro`), no reemplazarlo.

**Branch:** `feat/sprint-2-resilience-observability`

**Entregables core:**
- **Extender outbox existente con IndexedDB + background sync.** Los reportes que hoy se encolan en `outbox.ts` pasan a IndexedDB para persistencia entre sesiones del navegador; reintentos por `backgroundSync` cuando vuelve la conectividad.
- **Extender cache existente** con políticas stale-while-revalidate por endpoint (sismos, ayuda, recomendaciones).
- **Degradación progresiva**: detección `navigator.connection.effectiveType` (2G/3G/4G)  modo lite sin mapa.

**Entregables opcionales (caso por caso por costo/mantenimiento):**
- **Observabilidad**: OpenTelemetry traces (Fastify  Prisma), Prometheus metrics, structured logs (pino) con correlation ID.
- **Synthetic monitoring**: probes desde Caracas/Maracaibo/Miami.
- **CDN edge caching** (Cloudflare): solo si el origen empieza a saturarse en pruebas de carga.
- **Status page pública** (`status.sismicaid.org`): GitHub Pages, actualizada por workflow.
- **SLO dashboard** (Grafana Cloud free): si las métricas Prometheus se implementan.

**Verificación:**
- Lighthouse PWA score 95.
- Smoke test offline: reporte se encola en IndexedDB y se envía al reconectar.
- Cache existente sigue funcionando sin regresión.

---

## Sprint 3  Alerta temprana y notificación geocercada (PR #3)

**Objetivo:** la función que salva vidas. Notificación push en segundos cuando USGS/PTWC emite evento relevante. Reutiliza la infraestructura de ingesta existente.

**Branch:** `feat/sprint-3-push-alerts-cap`

**Entregables:**
- **Web Push API**: VAPID keys, opt-in UI, endpoint de suscripción con scope geográfico.
- **Reutiliza `jobs/fetch-ptwc.ts` y `seed:coastal-zones`** existentes para tsunami; push como capa nueva sobre ellos.
- **Servicio CAP 1.2** (Common Alerting Protocol): builder de envelopes estándar para emitir y consumir alertas oficiales.
- **Broadcast geocercado**: al ingerir evento USGS M4.5, calcular radio de impacto (PGA estimada por ley de atenuación)  suscriptores en radio reciben push en <30s.
- **Throttling de alertas (anti-republicación)**: deduplicación de eventos USGS; revisiones de magnitud NO generan re-push. Cap por usuario (max 1/min).
- **Topic feeds**: suscripciones por estado, por tipo (sismo, tsunami, ayuda).

**Verificación:**
- Test end-to-end: evento mock USGS M5.2 en Caracas  suscriptor de prueba recibe push en <30s.
- Validación CAP 1.2 contra schema oficial.
- Revisión de magnitud sobre evento ya pusheado NO genera nuevo push (test específico).

---

## Sprint 4  Safety Check (PR #4)  REQUIERE DECISIÓN ARQUITECTÓNICA PREVIA

**Estado:** EN PAUSA hasta cerrar issue arquitectónico con maintainer.

**Decisión pendiente:** SismicAid ya tiene `/emergencia` con flujo "Estoy a salvo" en versión cliente-only (privacy by default, sin estado en servidor). La propuesta original era agregar estado en servidor (72h, heatmap H3, k-anonimato) para coordinación agregada. **Antes de construir nada, se decide explícitamente con el maintainer cuál modelo prevalece**, en issue separado.

**Branch (cuando se decida):** `feat/sprint-4-safety-check`

**Posibles entregables (sujetos a decisión):**
- Si el modelo es estado-en-servidor: Safety Check campaign + responses + heatmap k-anonymity, expiración 72h, triage médico START opcional, routing a refugio más cercano sobre `/ayuda`.
- Si el modelo es cliente-only: mejoras a `/emergencia` existente (UX, accesibilidad), sin estado de servidor.

**Reunificación familiar: ELIMINADA del roadmap.** SPEC 3.3 lo prohíbe. Riesgo de menores, suplantación, agresores es muy alto.

**Verificación:**
- A definir según decisión arquitectónica.

---

## Sprint 5  Capas oficiales y matching oferta-demanda (PR #5)

**Objetivo:** datos densos sobre el mapa. Coordina cambios de schema de `recursos`/`necesidades` con el maintainer ANTES de tocar tablas existentes.

**Branch:** `feat/sprint-5-layers-resource-matching`

**Entregables:**
- **Capa USGS ShakeMap** (intensidad estimada por celda) sobre Leaflet del mapa sísmico existente.
- **Capa de fallas geológicas**: Boconó, San Sebastián, El Pilar (GeoJSON de FUNVISIS si disponible; fallback USGS Quaternary Faults).
- **Capa de infraestructura crítica**: hospitales, bomberos, refugios oficiales de Protección Civil (dataset estático versionado).
- **Capa tsunami**: zonas de inundación modeladas para costa caribeña venezolana (PTWC + DEM SRTM).
- **Matching oferta-demanda**: cuando se crea oferta de recurso, sistema sugiere necesidades a <2km en últimas 24h con score. Notificación a coordinadores (no usuarios). Solapa con `/necesidades`, `/ayuda`, "ofrecer ayuda" existentes  diseñar como capa de orquestación encima, no reemplazo.

**Entregable previo necesario:**
- Issue de coordinación con maintainer sobre schema de `recursos`/`necesidades` antes de tocar tablas existentes.

**Verificación:**
- Test del algoritmo de matching con dataset sintético.
- Validación visual de las 4 capas en mapa.
- Sin breaking changes a `/necesidades` y `/ayuda` existentes.

---

## Sprint 6  Federación CAP + Accesibilidad (PR #6)

**Objetivo:** abrir el ecosistema. Multicanal pesado (WhatsApp Business API, Twilio, mesh) queda FUERA por costo/complejidad sin ROI para MVP.

**Branch:** `feat/sprint-6-federation-a11y` (a11y e i18n probablemente como PRs separados)

**Entregables:**
- **API CAP federada**: feed público de alertas en formato CAP 1.2 consumible por otras apps y medios.
- **A11y WCAG 2.2 AA** (probablemente PR propio, gradual): auditoría completa, soporte screen reader ES/PT, targets táctiles 44px, modo alto contraste, modo de una sola mano.
- **i18n** (probablemente PR propio): estructura para añadir warao y wayuunaiki post-MVP.

**Fuera de scope (acordado con maintainer):**
- WhatsApp Business API chatbot. Ya hay `wa.me` ligero en `/emergencia`.
- SMS gateway (Twilio).
- Mesh / offline P2P (Bridgefy).
- Webhook con Protección Civil / Cruz Roja / 171: requiere acuerdo institucional; si surge, va como PR aparte.

**Verificación:**
- Test del feed CAP contra validador oficial.
- Pa11y / axe-core sin violaciones AA en al menos las páginas principales (`/`, `/sismos`, `/reportar`, `/ayuda`, `/emergencia`).

---

## Trazabilidad post-sprint

Cada sprint cierra con un commit `docs(roadmap): close sprint N` que actualiza este documento con:
- Fecha real de merge.
- Commit SHA de cierre.
- Métricas de verificación obtenidas.
- Tech debt residual y backlog que se mueve al siguiente sprint.