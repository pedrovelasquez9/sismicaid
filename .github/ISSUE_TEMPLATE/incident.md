---
name: Incident report
about: Reportar un incidente productivo (post-mortem se hace en docs/post-mortems/)
title: "[INC-YYYY-MM-DD] <título>"
labels: ["incident"]
---

## Severidad

- [ ] P1 — servicio caído / datos comprometidos
- [ ] P2 — degradación severa / SLO en riesgo
- [ ] P3 — bug funcional sin impacto SLO

## Timeline

| Hito | Hora UTC | Notas |
|---|---|---|
| Detección |  |  |
| Acknowledge |  |  |
| Mitigation aplicada |  |  |
| Resolución |  |  |

## Síntomas observados

<qué vio el usuario / la métrica>

## Causa raíz (preliminar)

<si conocida; si no, escribir "TBD">

## Mitigation aplicada

<acción específica>

## Acción de seguimiento

- [ ] Post-mortem en `docs/post-mortems/YYYY-MM-DD-<slug>.md`
- [ ] Acciones correctivas creadas como issues separados
- [ ] Threat model revisado si aplica
- [ ] Runbook actualizado si surgió procedimiento nuevo
