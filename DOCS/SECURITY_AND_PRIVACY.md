# SECURITY_AND_PRIVACY.md

## Reglas críticas

- No exponer contacto privado.
- No exponer direcciones privadas exactas.
- No publicar nombres de víctimas.
- No publicar datos de menores.
- No publicar fotos sin moderación si contienen datos sensibles.
- Eliminar metadatos EXIF de imágenes.
- Sanitizar todo input ciudadano.
- Rate limit en reportes.
- Todo reporte ciudadano entra como `pending`.
- Toda información pública debe indicar fuente y verificación.

## DTO público

Los endpoints públicos deben devolver DTOs seguros, nunca entidades internas completas.

## Reportes ciudadanos

Campos privados:

- `private_contact`
- datos internos de moderación
- IP si se registra
- metadatos de imagen

## Búsqueda de personas — postura de privacidad

El meta-buscador de personas desaparecidas es una **excepción acotada y deliberada** a las reglas "no publicar nombres de víctimas" y "no publicar datos de menores", justificada porque:

- (a) Los datos ya son **públicos** en registros comunitarios externos; la app solo los agrega y enlaza.
- (b) La consulta es **reactiva**: la inicia el familiar al buscar un nombre concreto; no hay directorio navegable ni exposición proactiva.
- (c) Cada resultado lleva **deep link** a la fuente original para verificación.
- (d) PII minimizada: **NUNCA** se persiste cédula, contacto del reportante/buscador, foto, GPS exacto ni `raw_payload`.
- (e) Edad de menores **enmascarada** a "menor de edad" tanto en la base de datos (`age = NULL`, `is_minor = true`) como en la API.
- (f) **Scrub** de emails/teléfonos/cédulas en el texto libre (descripción, ubicación, hospital, prueba de vida) como defensa en profundidad.
- (g) Retención: un registro ausente de la fuente pasa a `stale` tras 3 corridas de sync completo y se **purga** (borrado duro) 30 días después; los `stale` no aparecen en la búsqueda.
- (h) Controles de seguridad: allowlist de hosts + `redirect: manual` (anti-SSRF), rate limit (30/min), query parametrizada sin comodines, y User-Agent descriptivo no-IA.

Todo resultado se marca como **"no verificado — registro comunitario"** (`trustLevel = community_pending`, `verified = false`); nunca como oficial.

## Hardening pendiente (no bloqueante)

Notas de la revisión de seguridad (R1) para una iteración futura; no bloquean v1:

- **N1**: envolver el barrido de bajas (stale + purga) en una transacción para atomicidad.
- **N2**: en la válvula de seguridad del barrido, usar el conteo de `external_id` distintos devueltos (no el total de filas) para mayor robustez.
- **N3**: añadir un tope de tamaño/ítems por respuesta de ingesta (defensa ante una fuente que crezca sin control).
- **N4**: el texto de ubicación/hospital puede contener detalle a nivel de calle; evaluar un recorte adicional si se requiere.