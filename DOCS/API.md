# API.md

## Endpoints públicos iniciales

### GET /api/status

Devuelve:

- estado general
- última actualización sísmica
- última actualización tsunami
- cantidad de eventos recientes
- alertas activas
- fuentes degradadas

### GET /api/seismic-events

Filtros:

- `from`
- `to`
- `minMagnitude`
- `maxMagnitude`
- `minDepth`
- `maxDepth`
- `source`
- `hasTsunamiFlag`
- `alertLevel`
- `bbox`

### GET /api/seismic-events/:id

Devuelve detalle normalizado del evento.

### GET /api/tsunami-alerts/current

Devuelve estado actual de tsunami.

### GET /api/coastal-zones

Devuelve zonas costeras y estado de alerta.

### GET /api/resources

Devuelve recursos disponibles.

### GET /api/needs

Devuelve necesidades activas.

### POST /api/reports

Crea reporte ciudadano pendiente.

### GET /api/recommendations

Devuelve recomendaciones por contexto.

### GET /api/missing-persons

Búsqueda por nombre en registros comunitarios de personas desaparecidas.

Query:

- `q` — nombre a buscar. Mínimo 2 y máximo 80 caracteres; se normaliza (minúsculas, sin acentos) y se eliminan comodines.
- `q` vacío o con menos de 2 caracteres (tras normalizar) devuelve `200` con `groups: []`.

Reglas:

- Rate limit: 30 solicitudes por minuto.
- Resultados agrupados por nombre normalizado. `possibleSamePerson` es una pista suave (misma edad y estado en ≥2 fuentes distintas); nunca fusiona registros.
- Cada resultado lleva `source`, `sourceUrl` (deep link a la fuente), `trustLevel = community_pending` y `verified = false`.
- Menores: `age = null` y `ageLabel = "menor de edad"` (la edad exacta nunca se expone).

Campos del resultado: `id`, `fullName`, `age`, `ageLabel`, `isMinor`, `gender`, `lastSeenLocation`, `status` (`missing` | `found` | `hospitalized`), `hospitalName`, `healthStatus`, `foundBy`, `description`, `source`, `sourceUrl`, `reportedAt`, `lastSeenAt`, `trustLevel`, `verified`.

Respuesta de ejemplo:

```json
{
  "query": "ramon torres",
  "total": 2,
  "truncated": false,
  "groups": [
    {
      "normalizedName": "ramon alirio gavidia torres",
      "displayName": "Ramón Alirio Gavidia Torres",
      "possibleSamePerson": true,
      "results": [
        {
          "id": "a1b2...",
          "fullName": "Ramón Alirio Gavidia Torres",
          "age": 60,
          "ageLabel": "60 años",
          "isMinor": false,
          "gender": "masculino",
          "lastSeenLocation": "Caracas, Distrito Capital",
          "status": "missing",
          "hospitalName": null,
          "healthStatus": null,
          "foundBy": null,
          "description": null,
          "source": "Venezuela Te Busca",
          "sourceUrl": "https://venezuelatebusca.com/?person=...",
          "reportedAt": "2026-06-20T00:00:00.000Z",
          "lastSeenAt": "2026-06-26T22:30:00.000Z",
          "trustLevel": "community_pending",
          "verified": false
        },
        {
          "id": "c3d4...",
          "fullName": "Ramón A. Gaviria Torres",
          "age": 60,
          "ageLabel": "60 años",
          "isMinor": false,
          "gender": "masculino",
          "lastSeenLocation": "Caracas",
          "status": "hospitalized",
          "hospitalName": "Hospital Vargas",
          "healthStatus": "estable",
          "foundBy": "familiar",
          "description": null,
          "source": "Encuéntralos",
          "sourceUrl": "https://encuentralos.tecnosoft.dev/p/123",
          "reportedAt": "2026-06-25T00:00:00.000Z",
          "lastSeenAt": "2026-06-26T22:31:00.000Z",
          "trustLevel": "community_pending",
          "verified": false
        }
      ]
    }
  ]
}
```

Un resultado de menor de edad luce: `"age": null, "ageLabel": "menor de edad", "isMinor": true`.