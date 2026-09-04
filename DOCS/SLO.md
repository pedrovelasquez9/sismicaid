# SLOs / SLIs — SismicAid

Service Level Objectives, indicadores y error budgets. Estos son los contratos operacionales del sistema.

## Ventanas

Dos ventanas de medición distintas:

- **Ventana normal** (sin evento sísmico M≥4.5 en últimas 6h): operación de baseline.
- **Ventana de emergencia** (24h tras evento M≥5.0 en VE o tsunami activo): operación bajo carga catastrófica.

Los SLOs en ventana de emergencia son **más estrictos**, no más laxos. El sistema existe para esa ventana.

## SLOs

### 1. Disponibilidad de lectura (homepage + /sismos)

- **SLI:** `(2xx + 3xx) / total` requests del CDN edge.
- **SLO normal:** 99.9% trimestral (43m de error budget/mes).
- **SLO emergencia:** 99.95% en ventana.
- **Cómo se mide:** logs Cloudflare → Prometheus.

### 2. Latencia p95 lectura

- **SLI:** Time to First Byte de la edge, en p95.
- **SLO normal:** < 500ms desde Venezuela.
- **SLO emergencia:** < 800ms (asumiendo red degradada).
- **Cómo se mide:** RUM (Real User Monitoring) + probes sintéticos.

### 3. Aceptación de reporte ciudadano

- **SLI:** `accepted_reports / submitted_reports` (excluye los rechazados por anti-abuse, que son éxitos).
- **SLO:** 99.0% normal, 99.5% emergencia.
- **SLO de latencia:** p95 < 2s para confirmación al usuario.
- **Cómo se mide:** métricas backend Fastify.

### 4. Frescura del feed USGS

- **SLI:** `now() - max(usgs_event.ingested_at)` cuando hay eventos publicados USGS más recientes.
- **SLO:** lag p95 < 15 min normal, < 5 min emergencia (cron acelera a 1 min en ventana).
- **Cómo se mide:** comparación de timestamps en job de ingesta.

### 5. Tiempo de entrega de push (Sprint 3+)

- **SLI:** `push_delivered_at - event_published_at`.
- **SLO:** p95 < 30s desde publicación USGS hasta delivery confirmado por el navegador.
- **Cómo se mide:** instrumentación end-to-end con correlation ID.

### 6. Integridad del audit log

- **SLI:** verificación de hash chain corre cada hora, debe pasar.
- **SLO:** 100%. Si falla, incident P1 inmediato.
- **Cómo se mide:** job `verify-audit-chain`, alerta en fallo.

## Error budgets

Cuando un SLO se queme >50% del budget mensual:
- **Freeze de features** en el área correspondiente.
- Sprint siguiente se dedica a recuperar el budget antes de avanzar.

Esto se aplica también si pasamos a ventana de emergencia con el budget normal ya gastado: la prioridad inmediata es recuperar disponibilidad.

## Alertas (por gravedad)

**P1 — page inmediato (24/7):**
- SLO de disponibilidad emergencia roto.
- Audit chain falla verificación.
- Ingesta USGS sin datos nuevos > 30 min en ventana emergencia.
- 5xx rate > 5% durante 5 min.

**P2 — notificación en horario laboral:**
- SLO normal en riesgo (>30% budget consumido en una semana).
- Latencia p95 lectura > 1s sostenida 15 min.
- Cola de outbox push > 1000 mensajes.

**P3 — ticket sin alerta:**
- Lighthouse PWA score cae < 90.
- Dependencia con CVE alta en `npm audit`.

## Observabilidad implementada por sprint

| SLO | Instrumentación | Sprint |
|---|---|---|
| Disponibilidad lectura | Cloudflare Analytics | S2 |
| Latencia p95 | RUM (web-vitals lib) + Checkly synthetic | S2 |
| Aceptación reporte | Fastify hooks → Prometheus | S1 (skeleton), S2 (dashboard) |
| Frescura USGS | Métrica custom en job | S2 |
| Push delivery | Correlation ID end-to-end | S3 |
| Audit integrity | Job hourly + alert | S1 |

## Status page

`status.sismicaid.org` muestra:
- Estado por componente (web, API, ingesta USGS, ingesta PTWC, push).
- Incidents recientes con post-mortem público.
- Métricas de disponibilidad últimos 30/90 días.

Hosted en GitHub Pages, actualizada por GitHub Action que lee de Prometheus.
