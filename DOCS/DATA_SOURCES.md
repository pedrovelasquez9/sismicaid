# DATA_SOURCES.md

## Principio

El backend debe alimentarse de fuentes oficiales o verificables. No se deben inventar datos ni presentar reportes ciudadanos como oficiales.

## Fuentes iniciales

### USGS Earthquake Catalog

Uso:

- Eventos sísmicos recientes.
- Magnitud.
- Profundidad.
- Coordenadas.
- Hora.
- MMI/CDI si está disponible.
- Alert level.
- Tsunami flag.

Reglas:

- Guardar `external_id`.
- Guardar `raw_payload`.
- Actualizar evento si ya existe.
- Mostrar fuente y fecha.

### NOAA / Tsunami.gov / PTWC

Uso:

- Boletines de tsunami.
- Estado de alerta.
- Áreas afectadas.
- Cancelaciones.
- Hora de emisión.

Reglas:

- No tratar `tsunami_flag` como alerta activa.
- Mostrar estado y fuente.
- Mostrar si los datos están desactualizados.

### FUNVISIS

Uso:

- Fuente venezolana oficial de sismos y recomendaciones.

Reglas:

- Integrar cuando se confirme formato estable.
- Si no hay API estable, tratar como fuente manual/verificable hasta tener adaptador confiable.

## Búsqueda de personas (registros comunitarios)

Meta-buscador por nombre sobre registros comunitarios públicos de personas desaparecidas tras el terremoto. Estos datos **no son oficiales**: se muestran siempre como **"no verificado — registro comunitario"** (`trustLevel = community_pending`) y con enlace directo a la fuente. La consulta es **reactiva** (la inicia el familiar al buscar un nombre); no hay directorio navegable. Ver `SECURITY_AND_PRIVACY.md` para la postura de privacidad y la excepción acotada.

### venezuelatebusca.com

Uso:

- Registro comunitario público de desaparecidos (~34.8k registros).
- Nombre, edad, último lugar visto, estado, hospital y prueba de vida.

Reglas:

- `robots.txt` permite la agregación de búsqueda (solo bloquea bots de IA): usar un User-Agent descriptivo no-IA.
- Ingesta por `fetch` del loader turbo-stream `/_root.data?page=N` (SSR de React Router); paginar siguiendo `hasMore`.
- `trustLevel = community_pending` (NUNCA oficial); mostrar fuente, fecha y enlace al registro.
- No persistir cédula, foto, contacto del reportante ni GPS exacto; enmascarar la edad de menores.

### encuentralos.tecnosoft.dev

Uso:

- Registro comunitario público; API JSON `GET /api/personas` (`?q=` para búsqueda, `?limit=&offset=` para paginar).
- Incluye campos de prueba de vida / hospital.

Reglas:

- `trustLevel = community_pending`; mostrar fuente, fecha y enlace.
- Ingesta vía fetch nativo; descartar foto, GPS exacto y contacto del reportante.
- Mismo saneo de PII y enmascarado de menores que el resto de fuentes comunitarias.

### desaparecidosterremotovenezuela.com (DIFERIDO)

- API protegida con reCAPTCHA v3; no se integra en v1.
- Pendiente: outreach al mantenedor para un feed oficial; como fallback, un worker aislado fuera del VPS (nunca navegador headless en producción).

### ayudave.moonlightnetwork.net (EXCLUIDO)

- Datos en `localStorage` por dispositivo, sin base de datos consultable: no es agregable.

## Estados de fuente

- `active`
- `degraded`
- `disabled`

## Niveles de confianza

- `official`
- `verified`
- `community_pending`
- `outdated`
- `rejected`