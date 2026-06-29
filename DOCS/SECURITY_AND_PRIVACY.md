# SECURITY_AND_PRIVACY.md

## Reglas críticas

- No exponer contacto privado.
- No exponer direcciones privadas exactas, salvo la excepción de personas atrapadas (ver abajo).
- No publicar nombres de víctimas.
- No publicar datos de menores.
- No publicar fotos sin moderación si contienen datos sensibles.
- Eliminar metadatos EXIF de imágenes.
- Sanitizar todo input ciudadano.
- Rate limit en reportes.
- Todo reporte ciudadano entra como `pending`.
- Toda información pública debe indicar fuente y verificación.

## Excepción: ubicación exacta de personas atrapadas

Los reportes de tipo `trapped_person` exponen su **ubicación exacta** en el mapa
de rescate (`GET /api/trapped-persons`), no difuminada. Es una decisión de
producto deliberada: es una emergencia de vida y los servicios de rescate
necesitan el sitio preciso; una ubicación aproximada a ~1 km es inútil para
acudir.

Implicaciones aceptadas:

- La ubicación exacta es pública, incluso para reportes aún sin verificar.
- Riesgo conocido: un reporte falso o malicioso publica un pin exacto sobre una
  dirección real. Mitigaciones posibles a futuro: exigir verificación de
  moderador antes de revelar el pin, rate-limit más estricto para
  `trapped_person`, o difuminar solo para el público y dar exacto vía token de
  moderación.
- Sigue sin exponerse nombre ni contacto privado del reporte.

El resto de entidades (recursos, necesidades, otros reportes) mantiene la regla
de ubicación aproximada.

## DTO público

Los endpoints públicos deben devolver DTOs seguros, nunca entidades internas completas.

## Reportes ciudadanos

Campos privados:

- `private_contact`
- datos internos de moderación
- IP si se registra
- metadatos de imagen