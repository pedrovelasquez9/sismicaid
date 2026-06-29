# SECURITY_AND_PRIVACY.md

## Reglas críticas

- No exponer contacto privado.
- No exponer direcciones privadas exactas por defecto; solo cuando el reportante lo elige explícitamente (ver abajo).
- No publicar nombres de víctimas.
- No publicar datos de menores.
- No publicar fotos sin moderación si contienen datos sensibles.
- Eliminar metadatos EXIF de imágenes.
- Sanitizar todo input ciudadano.
- Rate limit en reportes.
- Todo reporte ciudadano entra como `pending`.
- Toda información pública debe indicar fuente y verificación.

## Ubicación: difuminado por defecto, exacta a discreción del usuario

Por defecto, las coordenadas de un reporte ciudadano se **difuminan a una rejilla
de ~110 m** en el servidor (`roundToGrid`, `apps/api/src/lib/geo.ts`) **antes de
persistirse**. Así nunca guardamos la posición exacta de quien no la consintió.

Al reportar, el formulario ofrece una casilla **"Mostrar mi ubicación exacta"**
(`locationPrecision: "exact"`). Solo en ese caso se guarda y se publica la
coordenada precisa. Está pensada para emergencias de vida (persona atrapada),
donde los servicios de rescate necesitan el sitio exacto y una zona de ~110 m no
basta para acudir. El formulario explica la diferencia y deja la decisión al
reportante.

Implicaciones aceptadas cuando el usuario elige exacta:

- La ubicación exacta es pública, incluso para reportes aún sin verificar.
- Riesgo conocido: un reporte falso o malicioso podría publicar un pin exacto
  sobre una dirección real. Mitigaciones posibles a futuro: exigir verificación
  de moderador antes de revelar el pin, rate-limit más estricto para
  `trapped_person`, o servir exacto solo vía token de moderación.
- Sigue sin exponerse nombre ni contacto privado del reporte.

El marcador del mapa (`TrappedPersonMarkerDTO`) incluye `locationPrecision` para
que la UI comunique si el pin es exacto o aproximado. El resto de entidades
(recursos, necesidades, otros reportes) no expone coordenadas de personas.

## DTO público

Los endpoints públicos deben devolver DTOs seguros, nunca entidades internas completas.

## Reportes ciudadanos

Campos privados:

- `private_contact`
- datos internos de moderación
- IP si se registra
- metadatos de imagen