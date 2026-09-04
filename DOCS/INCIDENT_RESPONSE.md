# Incident Response Runbook — SismicAid

Procedimiento para incidents en producción. Mantener corto, accionable, sin ambigüedad.

## Severidades

| Sev | Definición | Tiempo de respuesta | Comunicación |
|---|---|---|---|
| **P1** | Servicio caído en ventana de emergencia, o audit chain comprometido, o datos de personas atrapadas filtrados | < 15 min | Status page actualizada inmediato + comunicación a usuarios suscritos |
| **P2** | Degradación severa fuera de ventana de emergencia, SLO mensual en riesgo crítico | < 1h | Status page actualizada |
| **P3** | Bug funcional sin impacto en SLO | < 24h | Ticket interno |

## Rol on-call

En MVP solo-developer, el on-call es el dueño del repo + un buddy designado. Rotación cuando exista equipo.

Herramientas mínimas para el on-call:
- Acceso SSH al VPS o consola del proveedor.
- Acceso al dashboard de Cloudflare.
- Acceso a las VAPID keys (read-only, en password manager con MFA).
- Status page write access.
- Permiso de hotfix branch + bypass de branch protection (solo P1).

## Procedimiento P1

```
T+0       Detección (alerta automática o reporte de usuario)
T+0       Acknowledge alerta — detiene paging
T+2 min   Actualizar status page: "Investigating"
T+5 min   Diagnóstico inicial: ¿API? ¿CDN? ¿DB? ¿upstream USGS?
T+10 min  Mitigation o escalation
T+15 min  Update status page con primer mitigation status
...       Updates cada 15 min hasta resolved
T+resolved  Status page → Resolved
T+24h     Post-mortem público en docs/post-mortems/YYYY-MM-DD-titulo.md
```

## Diagnóstico rápido por síntoma

### "La web no carga"

```bash
# 1. ¿Edge responde?
curl -I https://sismicaid.org

# 2. ¿Origen responde?
curl -I https://origin.sismicaid.org/health

# 3. ¿API responde?
curl https://api.sismicaid.org/health

# 4. ¿DB responde?
ssh vps "psql -U sismicaid -c 'SELECT 1'"
```

Caída en cada capa apunta a fix distinto:
- Edge ko → Cloudflare status, fallback DNS a origen directo.
- Origen ko → reiniciar Astro server, revisar disk space.
- API ko → `pm2 logs sismicaid-api`, restart.
- DB ko → revisar conexiones, restart Postgres (último recurso).

### "Reportes no se aceptan"

```bash
# Tail de logs API
ssh vps "pm2 logs sismicaid-api --lines 100 | grep -i 'POST /reports'"

# ¿Anti-abuse demasiado agresivo?
psql -c "SELECT reason, count(*) FROM dedup_signature WHERE created_at > now() - interval '1h' GROUP BY reason"
```

Si rate limit es el culpable → ajustar dinámicamente vía env var sin redeploy:
```bash
ssh vps "pm2 set sismicaid-api:RATE_LIMIT_REPORTS_PER_MIN 10 && pm2 restart sismicaid-api"
```

### "Push no llegan"

```bash
# ¿Outbox creciendo?
psql -c "SELECT count(*), max(created_at) FROM notification_outbox WHERE delivered_at IS NULL"

# ¿Worker corriendo?
ssh vps "pm2 status sismicaid-push-worker"
```

### "Audit chain falla verificación"

**P1 inmediato.** No tocar la DB.

1. Tomar snapshot inmediato de la tabla `audit_log` antes de cualquier acción.
2. Ejecutar `pnpm --filter @sismicaid/api run audit:diagnose` que reporta primer block con hash inválido.
3. Investigar cómo se introdujo el cambio (¿migración manual? ¿bug en service?).
4. **No truncar ni recomputar el chain en producción.** El log es evidencia; se preserva.
5. Crear nuevo chain con génesis nuevo, dejar el anterior sellado.

## Mitigaciones de emergencia

### Modo solo-lectura

Si el API está siendo abusado o tiene bug en escritura:

```bash
ssh vps "pm2 set sismicaid-api:READ_ONLY_MODE true && pm2 restart sismicaid-api"
```

La app frontend detecta el flag y oculta los formularios de reporte, mostrando banner.

### Modo degradado (sin mapa)

Si el origen del mapa (OSM tiles) está caído:

```bash
# Toggle de feature flag vía env
ssh vps "pm2 set sismicaid-web:DISABLE_MAP true && pm2 restart sismicaid-web"
```

App muestra listas en lugar de mapas; aviso visible al usuario.

### Bypass de CDN (emergencia)

Si Cloudflare está caído y el origen aguanta:
- DNS swing: cambiar A record de `sismicaid.org` directo al origen.
- TTL bajo (60s) en configuración base permite swing rápido.

## Post-mortem template

Cada P1 cierra con un post-mortem público (`docs/post-mortems/YYYY-MM-DD-slug.md`):

```markdown
# Incident YYYY-MM-DD — <título>

**Severidad:** P1
**Inicio:** <ISO timestamp>
**Detección:** <T+? min>
**Mitigation:** <T+? min>
**Resolution:** <T+? min>
**Total impact:** <duración + usuarios afectados estimados>

## Resumen
<2 párrafos>

## Timeline
- T+0
- T+...

## Causa raíz
<5 whys o equivalente>

## Qué funcionó
- <bullets>

## Qué falló
- <bullets>

## Acciones correctivas
- [ ] <con owner y fecha>
- [ ] <con owner y fecha>

## Lecciones aprendidas
<bullets>
```

Sin culpas, foco en sistema. Se publica abierto: la transparencia construye confianza, que es lo que esta app necesita para ser útil.

## Drills

Trimestralmente, ejercitar:
1. Matar el container del API en horario laboral.
2. Bloquear el feed USGS upstream (firewall rule).
3. Llenar disco al 95%.
4. Simular tampering en audit_log (en staging).

Cada drill genera reporte breve: ¿la alerta disparó? ¿en cuánto tiempo? ¿el runbook sirvió?
