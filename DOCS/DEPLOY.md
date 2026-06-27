# DEPLOY.md — Despliegue en un VPS

Guía para desplegar **Sismicaid** en un VPS Linux (ej. Ubuntu 22.04)
con PostgreSQL local, la API Node detrás de nginx, y el frontend estático
servido por nginx. Topología recomendada: **un solo dominio**, con `/api/`
proxyado al backend (evita CORS, mismo origen).

## 0. Requisitos en el VPS

```bash
# Node 20+ y pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
sudo corepack enable && corepack prepare pnpm@9.7.0 --activate
```

## 1. Base de datos

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE sismicaid;
CREATE USER ltt WITH PASSWORD 'CAMBIA_ESTA_CLAVE';
GRANT ALL PRIVILEGES ON DATABASE sismicaid TO ltt;
ALTER DATABASE sismicaid OWNER TO ltt;
SQL
```

## 2. Código y dependencias

```bash
sudo mkdir -p /var/www/sismicaid && sudo chown $USER /var/www/sismicaid
git clone <TU_REPO> /var/www/sismicaid
cd /var/www/sismicaid
pnpm install          # genera el cliente Prisma vía postinstall
```

## 3. Configurar la API

Crea `apps/api/.env` (NO se comitea):

```ini
DATABASE_URL=postgres://ltt:CAMBIA_ESTA_CLAVE@localhost:5432/sismicaid
HOST=127.0.0.1            # detrás de nginx
PORT=3000
CORS_ORIGIN=https://TU_DOMINIO   # opcional si mismo origen; recomendable fijarlo
```

## 4. Migraciones, seeds y primera ingesta

```bash
cd /var/www/sismicaid
pnpm --filter @sismicaid/api exec prisma migrate deploy   # crea las 10 tablas
pnpm --filter @sismicaid/api seed:sources
pnpm --filter @sismicaid/api seed:coastal-zones
pnpm --filter @sismicaid/api seed:recommendations
pnpm --filter @sismicaid/api fetch:usgs                   # datos sísmicos reales
pnpm --filter @sismicaid/api fetch:ptwc                   # estado tsunami

# Búsqueda de personas (registros comunitarios) — primer sync.
# En producción usa un tope alto para un sync COMPLETO: es necesario para la
# detección de bajas/stale (S6); un run capado omite el barrido a propósito.
VTB_MAX_PAGES=2000 pnpm --filter @sismicaid/api fetch:venezuelatebusca
ENC_MAX_PAGES=2000 pnpm --filter @sismicaid/api fetch:encuentralos
```

## 5. La API como servicio (systemd)

`/etc/systemd/system/ltt-api.service`:

```ini
[Unit]
Description=Sismicaid API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/var/www/sismicaid
ExecStart=/usr/bin/pnpm --filter @sismicaid/api start
EnvironmentFile=/var/www/sismicaid/apps/api/.env
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

> Ajusta la ruta de `pnpm` con `which pnpm` si no es `/usr/bin/pnpm`.
> La API corre con `tsx` (sin paso de build frágil); maneja SIGTERM y cierra
> Prisma limpiamente.

```bash
sudo chown -R www-data:www-data /var/www/sismicaid
sudo systemctl daemon-reload && sudo systemctl enable --now ltt-api
curl -s http://127.0.0.1:3000/health   # {"ok":true}
```

## 6. Ingesta periódica (cron)

Los jobs de fetch deben correr periódicamente. `crontab -e`:

```cron
*/10 * * * * cd /var/www/sismicaid && /usr/bin/pnpm --filter @sismicaid/api fetch:usgs >> /var/log/ltt-fetch.log 2>&1
*/10 * * * * cd /var/www/sismicaid && /usr/bin/pnpm --filter @sismicaid/api fetch:ptwc >> /var/log/ltt-fetch.log 2>&1
*/30 * * * * cd /var/www/sismicaid && VTB_MAX_PAGES=2000 /usr/bin/pnpm --filter @sismicaid/api fetch:venezuelatebusca >> /var/log/ltt-fetch.log 2>&1
*/30 * * * * cd /var/www/sismicaid && ENC_MAX_PAGES=2000 /usr/bin/pnpm --filter @sismicaid/api fetch:encuentralos >> /var/log/ltt-fetch.log 2>&1
```

> Búsqueda de personas: los dos jobs corren cada 30 min (más suave que los sísmicos).
> `VTB_MAX_PAGES` / `ENC_MAX_PAGES` deben ir altos (~2000) para un sync **completo**:
> el barrido de bajas (stale + purga a 30 días) solo se ejecuta tras un sync completo;
> un run capado lo omite a propósito para no marcar como ausentes a decenas de miles
> de registros que no se alcanzaron a leer. La purga de registros viejos es un paso
> dentro del propio job (sin infraestructura extra). Solo `fetch` nativo: **sin Docker
> ni navegador headless** en producción.

## 7. Construir el frontend

`PUBLIC_API_URL` se **inyecta en build** (Vite). Para mismo origen, apunta al
dominio público; las llamadas irán a `https://TU_DOMINIO/api/...`.

```bash
cd /var/www/sismicaid
PUBLIC_BASE_PATH=/sismicaid \
PUBLIC_API_URL=https://TU_DOMINIO/sismicaid \
pnpm --filter @sismicaid/web build
# salida estática: apps/web/dist
```

## 8. nginx

`/etc/nginx/sites-available/sismicaid`:

```nginx
server {
  listen 80;
  server_name TU_DOMINIO;

  root /var/www/sismicaid/apps/web/dist;
  index index.html;

  # API al backend (mismo origen -> sin CORS)
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # sitio estático (Astro genera un archivo por ruta)
  location / {
    try_files $uri $uri/ =404;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sismicaid /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 8.b Despliegue bajo un subpath (p. ej. `TU_DOMINIO/sismicaid`)

Si compartes el dominio con otros proyectos por ruta, define `PUBLIC_BASE_PATH`
**en el build** (ajusta enlaces internos, assets y PWA) y apunta `PUBLIC_API_URL`
al subpath:

```bash
cd /var/www/sismicaid
PUBLIC_BASE_PATH=/sismicaid \
PUBLIC_API_URL=https://TU_DOMINIO/sismicaid \
  pnpm --filter @sismicaid/web build
```

nginx (en el `server` del dominio, junto a tus otros proyectos):

```nginx
# API bajo el subpath -> backend (/sismicaid/api/status -> 127.0.0.1:3000/api/status)
location /sismicaid/api/ {
  proxy_pass http://127.0.0.1:3000/api/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

# Frontend estático bajo el subpath
location /sismicaid/ {
  alias /var/www/sismicaid/apps/web/dist/;
  try_files $uri $uri/ /sismicaid/index.html;
}
```

nginx usa *longest-prefix match*, así que `/sismicaid/api/` gana sobre
`/sismicaid/` automáticamente. El Service Worker queda con scope `/sismicaid/`.

## 9. TLS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d TU_DOMINIO
```

## 10. Actualizar el despliegue

```bash
cd /var/www/sismicaid
git pull
pnpm install
pnpm --filter @sismicaid/api exec prisma migrate deploy
PUBLIC_API_URL=https://TU_DOMINIO pnpm --filter @sismicaid/web build
sudo systemctl restart ltt-api
```

## Notas

- **Recursos/necesidades** se cargan por moderación (panel `/admin`, pendiente);
  no se siembran datos de ejemplo para no publicar información falsa.
- **PTWC**: confirmar el feed del Caribe venezolano (`TSUNAMI_FEED_URL`) antes de
  considerar el módulo de tsunami listo para producción.
- Rate limit en memoria (instancia única). Para múltiples instancias, usar un
  store Redis en `@fastify/rate-limit`.
- Para escalar la ingesta o evitar cron, mover los jobs a un worker dedicado.
