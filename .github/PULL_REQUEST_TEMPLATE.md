## ¿Qué cambia?

<descripción breve, una o dos frases>

## ¿Por qué?

<motivación; referencia al issue/sprint>

Closes #<issue>

## Tipo de cambio

- [ ] `feat`: nueva funcionalidad
- [ ] `fix`: corrección de bug
- [ ] `docs`: solo documentación
- [ ] `refactor`: sin cambio funcional
- [ ] `test`: agrega o ajusta tests
- [ ] `chore`: tooling, CI, dependencias

## Checklist de dominio (reglas del repo)

- [ ] No invento ni simulo datos oficiales (USGS/PTWC)
- [ ] `tsunami_flag` de un sismo NO se trata como alerta activa
- [ ] No confundo magnitud con intensidad en ningún copy ni cálculo
- [ ] No expongo nombres ni direcciones privadas en respuestas públicas
- [ ] Reportes ciudadanos quedan etiquetados como no verificados
- [ ] Mobile-first respetado; verificado en viewport 360×640
- [ ] Dark mode respetado (sin Tailwind, variables CSS existentes)

## Checklist enterprise

- [ ] Cambios al schema generan migración Prisma versionada
- [ ] Eventos relevantes escriben al audit log (`AuditLogService.append`)
- [ ] Endpoints nuevos pasan por anti-abuse pipeline si reciben input ciudadano
- [ ] Métricas / logs estructurados emitidos para los caminos relevantes
- [ ] Tests añadidos para lógica no trivial

## Verificación local

```
pnpm typecheck
pnpm --filter @sismicaid/api test
pnpm build
```

Resultado:

```
<pegar salida resumen>
```

## Smoke test manual

<lista de pasos ejecutados y resultado>

## Capturas / evidencia

<si toca UI>

## Notas de despliegue

<si requiere variables nuevas, migraciones, rotación de secrets, etc.>
