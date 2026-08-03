# Docker y operación

## Topología local

`compose.yaml` crea una red privada y un volumen persistente llamado `postgres_data`.

```text
localhost:3002 -> frontend:3000 -> backend:4000 -> PJUD
                                  -> postgres:5432
localhost:4000 -> backend:4000    # solo desarrollo
```

## Contenedor frontend

Archivo: `Dockerfile`

Base: `node:22-alpine`.

Etapas:

1. `dependencies`: instala dependencias con `npm ci`.
2. `builder`: compila Next.js en modo `standalone`.
3. `runner`: copia únicamente el servidor standalone, archivos estáticos y `public`.

Características:

- Ejecuta como usuario no privilegiado `nextjs`.
- Escucha en `3000` dentro del contenedor.
- Usa `BACKEND_INTERNAL_URL=http://backend:4000`.
- No contiene el código ni las dependencias del backend.
- Tiene health check HTTP sobre `/`.

Reconstruir solo frontend:

```bash
docker compose build frontend
docker compose up -d frontend
```

## Contenedor backend

Archivo: `backend/Dockerfile`

Base: `node:22-alpine`.

Etapas:

1. `builder`: instala dependencias y compila TypeScript.
2. `runner`: instala solo dependencias de producción y copia `dist` y migraciones.

Características:

- Ejecuta como usuario no privilegiado `api`.
- Escucha en `4000` dentro del contenedor.
- Ejecuta migraciones antes de iniciar Fastify.
- Usa timeout para PJUD y pool limitado de PostgreSQL.
- Tiene health check sobre `/health/ready`.

Variables principales:

- `DATABASE_URL`
- `FRONTEND_ORIGIN`
- `PJUD_API_BASE_URL`
- `PJUD_API_KEY`
- `API_KEY_PEPPER`

Reconstruir solo backend:

```bash
docker compose build backend
docker compose up -d backend
```

Crear temporalmente una organización y API key:

```bash
docker compose exec \
  -e BOOTSTRAP_ORG_NAME="Cliente inicial" \
  -e BOOTSTRAP_CREDITS=1000 \
  backend node dist/scripts/bootstrap.js
```

La clave se muestra una vez. No ejecutes bootstrap mediante logs compartidos o pipelines públicos.

## Contenedor PostgreSQL

Imagen: `postgres:16-alpine`.

Características:

- No publica el puerto en el host.
- Persiste en el volumen `postgres_data`.
- Inicia antes del backend mediante health check.
- Sus credenciales locales tienen valores por defecto solo para desarrollo.

Comprobar migraciones:

```bash
docker compose exec postgres \
  psql -U ghostinc -d ghostinc -c "SELECT * FROM schema_migrations;"
```

Backup manual local:

```bash
docker compose exec -T postgres \
  pg_dump -U ghostinc -d ghostinc -Fc > ghostinc.dump
```

La restauración debe probarse en una base separada. En producción se requiere backup cifrado y automatizado hacia OCI Object Storage.

## Contenedor proxy

Archivo: `deploy/Caddyfile`.

Imagen: `caddy:2.10-alpine`.

Solo existe en `compose.production.yaml`.

Características:

- Publica TCP `80`, TCP `443` y UDP `443`.
- Gestiona TLS del origen.
- Envía `/api/v1/*` y `/health/*` al backend.
- Envía el resto al frontend.
- Comprime respuestas y elimina el header `Server`.
- Persiste certificados en `caddy_data` y configuración en `caddy_config`.

Cloudflare debe usar `Full (strict)`. La Security List de OCI y el firewall deben restringir el origen a rangos de Cloudflare cuando sea posible.

## Compose local

Comandos habituales:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose down
```

Validar el manifiesto:

```bash
docker compose config --quiet
```

## Compose de producción

Usa imágenes publicadas en GHCR, sin puertos de host para frontend, backend o PostgreSQL.

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f compose.production.yaml pull
docker compose --env-file .env.production -f compose.production.yaml up -d
```

No guardes `.env.production` en Git. Usa contraseñas URL-safe mientras `DATABASE_URL` se construya mediante interpolación de Compose.

## Diagnóstico

Estado:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs --since=10m frontend backend postgres
```

Health:

```bash
curl http://localhost:4000/health/live
curl http://localhost:4000/health/ready
curl http://localhost:3002
```

Si PJUD corre en el host Linux, Compose usa `host.docker.internal` mediante `host-gateway`.
