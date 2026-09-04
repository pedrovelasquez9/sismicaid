# Threat Model — SismicAid

Modelo STRIDE aplicado a SismicAid. Revisar al inicio de cada sprint que introduzca capacidades nuevas.

## Activos críticos

| Activo | Sensibilidad | Impacto si comprometido |
|---|---|---|
| Reportes ciudadanos (ubicación aprox, descripción) | Media | Pánico inducido, mala asignación de rescate |
| Reportes de personas atrapadas | Alta | Riesgo a la vida si manipulado o filtrado |
| Suscripciones push (endpoint + geo) | Media | Tracking de usuarios, spam |
| Audit log | Crítica | Pérdida de capacidad forense post-evento |
| Feed oficial USGS/PTWC cacheado | Alta | Desinformación masiva si suplantado |
| Credenciales DB / VAPID / API keys | Crítica | Compromiso total |

## Actores de amenaza

1. **Troll individual** — quiere generar pánico o ruido. Bajo skill, alto volumen.
2. **Campaña coordinada** — actor estatal o no-estatal con objetivos políticos. Múltiples IPs, narrativas coherentes, timing alineado con eventos reales.
3. **Atacante criminal** — busca explotar emergencia para fraude (falsos refugios, phishing post-sismo).
4. **Scraper / botnet** — consume capacidad sin contribuir; vector de DoS no intencional.
5. **Insider** — colaborador con acceso a moderación; bajo riesgo en MVP (sin team), pero diseñar para cuando exista.

## STRIDE por componente

### Endpoint de reporte (`POST /reports`)

| Amenaza | Vector | Mitigación (sprint) |
|---|---|---|
| **S**poofing | Reporte falso con identidad de Protección Civil | Etiquetado obligatorio "no verificado" desde DB; oficial requiere flag `verified_by` con audit (S1) |
| **T**ampering | Modificación posterior de reporte | Audit log inmutable con hash chain (S1) |
| **R**epudiation | Reportador niega haber enviado | Device key persistente + audit log con hash (S1) |
| **I**nfo disclosure | Geolocalización exacta del reportador | Server-side fuzzing a ~200m antes de persistir (S1) |
| **D**oS | Inundación de reportes desde una IP | Rate limit por IP + device key + geofence (S1); CDN edge cache (S2) |
| **E**oP | Reportador eleva su reporte a "oficial" | RBAC estricto, flag `source` enum cerrado, audit (S1) |

### Push notifications

| Amenaza | Vector | Mitigación |
|---|---|---|
| Spoofing | Atacante envía alertas falsas | VAPID privado en secret manager, jamás en repo; rotación documentada (S3) |
| Information disclosure | Endpoint push contiene info de usuario | Sólo almacenar endpoint + p256dh + auth, sin metadata personal (S3) |
| DoS | Atacante satura broadcast | Cap por usuario (1/min), throttling global, dead-letter queue (S3) |

### Audit log

| Amenaza | Vector | Mitigación |
|---|---|---|
| Tampering | Atacante con acceso DB modifica historial | Hash chain SHA-256 con verificación periódica + export diario a almacenamiento WORM (S1; WORM en S2) |
| Repudiation | "El log fue alterado" | Verificación pública: hash del último bloque expuesto en `/audit/head` (S1) |

### Pipeline de ingesta USGS/PTWC

| Amenaza | Vector | Mitigación |
|---|---|---|
| Tampering en tránsito | MitM cambia evento | TLS pinning a hosts USGS/PTWC; verificación de feed signature donde exista (S2) |
| Spoofing | Atacante simula respuesta USGS | DNS-over-HTTPS, alerting si magnitud o frecuencia se sale del baseline (S2) |
| DoS upstream | USGS caído | Fallback a EMSC + GeoNet; última versión cacheada con timestamp visible (S2) |

## Confianza de reportes — niveles

| Nivel | Criterio | Render |
|---|---|---|
| `official` | Origen verificado: USGS, PTWC, Protección Civil con webhook firmado | Sin badge, fuente visible |
| `verified` | Reporte ciudadano cruzado con ≥2 fuentes independientes + score reputación >50 | Badge "verificado" |
| `community` | Reporte ciudadano estándar | Badge ámbar "sin verificar" |
| `quarantined` | Falla anti-abuse: dedup, geofence, rate limit, o score <0 | Oculto por defecto, visible para moderadores |

## Política de retención

| Dato | Retención | Justificación |
|---|---|---|
| Reporte ciudadano operacional | 90 días | Operativo agudo; agregados quedan |
| Agregado anónimo (heatmap) | Indefinido | Sin PII después de k-anonymity |
| Audit log | 2 años | Investigación forense, accountability |
| Push subscription | Hasta unsubscribe o 18 meses sin actividad | Higiene de base |
| Safety check status | 72h | Estado agudo; tras esto se borra |
| IP de reporte | 30 días (cifrada con clave rotada) | Anti-abuse, no investigación |

## Modelo de privacidad para personas atrapadas

- **Sin nombres** en ningún punto visible.
- **Ubicación**: round a celda H3 nivel 9 (~150m) en el cliente antes de enviar; el server vuelve a aplicar fuzzing.
- **Reporte solo accesible** vía API con paginación y rate limit; no hay endpoint que liste todos.
- **Borrado** cuando rescatado=true + 7 días.
- **Reunificación familiar** (S4) usa flujo separado autenticado, no expone datos al público.

## Revisión

Este documento se revisa:
- Antes de iniciar cualquier sprint que toque endpoints públicos o nuevos datos.
- Tras cualquier incident report (`docs/INCIDENT_RESPONSE.md`).
- Trimestralmente como mínimo.
