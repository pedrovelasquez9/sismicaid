---
name: Sprint epic
about: Track a sprint from the enterprise roadmap
title: "[Sprint N] <título>"
labels: ["sprint", "epic"]
---

## Objetivo del sprint

<una frase>

## Branch

`feat/sprint-N-<slug>`

## Entregables

- [ ] <feature 1>
- [ ] <feature 2>
- [ ] <feature 3>

## Schema changes

- [ ] Migración Prisma: `<nombre>`
- [ ] Sin breaking changes a modelos existentes

## Verificación al cierre (criterios objetivos)

- [ ] `pnpm typecheck` verde
- [ ] `pnpm --filter @sismicaid/api test` verde
- [ ] `pnpm audit --audit-level=high --prod` sin findings
- [ ] CodeQL sin alertas críticas/altas nuevas
- [ ] Smoke test manual ejecutado y documentado
- [ ] <criterio específico del sprint>

## Docs

- [ ] Actualizar `docs/ROADMAP_ENTERPRISE.md` con fecha de cierre y SHA
- [ ] Si toca seguridad: revisar `docs/THREAT_MODEL.md`
- [ ] Si toca SLOs: actualizar `docs/SLO.md`

## Post-mortem (si aplica)

<vacío al abrir; llenar tras incidents en el sprint>
