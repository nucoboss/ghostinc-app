# Matriz de variables de entorno (SEC-004)

Matriz sin valores. Los valores viven solo en `.env` local, `.env.production` del host OCI y los secretos de GitHub Environment `production`.

Convenciones de origen:

- `Código`: default declarado en `backend/src/config.ts` o lectura directa en frontend; no requiere instalación.
- `Host file`: variable interpolada por Docker Compose desde `.env.production` en el host (nunca viaja en comandos SSH del workflow).
- `GH env`: secreto de GitHub Environment `production`.
- `GitHub secret`: secreto del repositorio usado por CI (valores de prueba exclusivamente).

## Backend (contenedor `backend`)

| Variable | Secreto | Entornos | Origen | Consumida por |
|---|---|---|---|---|
| `NODE_ENV` | No | dev/test/prod | Código | `config.ts` |
| `HOST` | No | todos | Código | `config.ts` |
| `PORT` | No | todos | Código | `config.ts` |
| `DATABASE_URL` | Sí | dev/test/prod | Host file (compose) | `config.ts` |
| `FRONTEND_ORIGIN` | No | todos | Host file (compose) | `config.ts` |
| `PJUD_API_BASE_URL` | No | todos | Host file (compose) | `config.ts` |
| `PJUD_API_KEY` | Sí | todos | Host file | `config.ts` |
| `API_KEY_PEPPER` | Sí | todos | Host file | `config.ts` |
| `INTERNAL_SERVICE_TOKEN` | Sí | todos | Host file | `config.ts` |
| `SESSION_ABSOLUTE_SECONDS` | No | todos | Código/Host file | `config.ts` |
| `SESSION_INACTIVITY_SECONDS` | No | todos | Código/Host file | `config.ts` |
| `SESSION_ROTATION_SECONDS` | No | todos | Código/Host file | `config.ts` |
| `APP_BASE_URL` | No | todos | Host file (compose) | `config.ts` |
| `RESEND_API_KEY` | Sí | prod (obligatorio) | Host file | `config.ts` |
| `RESEND_FROM_EMAIL` | No | prod (obligatorio) | Host file | `config.ts` |
| `ADMIN_EMAIL` | Sensible | scripts | Invocación interactiva | `create-admin-invite.ts` |
| `BOOTSTRAP_ORG_NAME` | No | scripts | Invocación interactiva | `bootstrap.ts` |
| `BOOTSTRAP_CREDITS` | No | scripts | Invocación interactiva | `bootstrap.ts` |

## Frontend (contenedor `frontend`)

| Variable | Secreto | Entornos | Origen | Consumida por |
|---|---|---|---|---|
| `NODE_ENV` | No | todos | Imagen | cookie/session |
| `BACKEND_INTERNAL_URL` | No (red interna) | todos | Host file (compose) | BFF (`auth-backend.ts`, `admin-api.ts`) |
| `INTERNAL_SERVICE_TOKEN` | Sí | todos | Host file | BFF (`auth-backend.ts`, `admin-api.ts`) |
| `APP_BASE_URL` | No | todos | Host file | `session.ts`, `csrf.ts` |
| `SESSION_ABSOLUTE_SECONDS` | No | todos | Host file | `csrf.ts` |
| `AUTH0_DOMAIN` | No | legacy dev/prod | Host file | `auth0.ts` (retirar en IAM-008) |
| `AUTH0_CLIENT_ID` | No | legacy dev/prod | Host file | `auth0.ts` (retirar en IAM-008) |
| `AUTH0_CLIENT_SECRET` | Sí | legacy dev/prod | Host file | `auth0.ts` (retirar en IAM-008) |
| `AUTH0_SECRET` | Sí | legacy dev/prod | Host file | `auth0.ts` (retirar en IAM-008) |
| `AUTH0_ROLES_CLAIM` | No | legacy dev/prod | Código | `admin-auth.ts` (retirar en IAM-008) |
| `AUTH0_GOOGLE_CONNECTION` | No | legacy dev/prod | Código | (retirar en IAM-008) |
| `AUTH0_DATABASE_CONNECTION` | No | legacy dev/prod | Código | (retirar en IAM-008) |
| `AUTH0_MANAGEMENT_CLIENT_ID` | No | legacy dev/prod | Host file | `auth0-management.ts` (retirar en IAM-008) |
| `AUTH0_MANAGEMENT_CLIENT_SECRET` | Sí | legacy dev/prod | Host file | `auth0-management.ts` (retirar en IAM-008) |

## Postgres y Caddy (contenedores `postgres` y `proxy`)

| Variable | Secreto | Entornos | Origen | Consumida por |
|---|---|---|---|---|
| `POSTGRES_DB` | No | todos | Host file | postgres/compose |
| `POSTGRES_USER` | No | todos | Host file | postgres/compose |
| `POSTGRES_PASSWORD` | Sí | todos | Host file | postgres/compose |
| `DOMAIN` | No | prod | Host file | Caddy/compose |
| `ACME_EMAIL` | No | prod | Host file | Caddy |

## Despliegue (imágenes y OCI)

| Variable | Secreto | Entornos | Origen | Consumida por |
|---|---|---|---|---|
| `FRONTEND_IMAGE` | No (digest) | prod | Host file | compose.production |
| `BACKEND_IMAGE` | No (digest) | prod | Host file | compose.production |
| `OCI_HOST` | Sensible | prod | GH env | deploy.yml |
| `OCI_USER` | Sensible | prod | GH env | deploy.yml |
| `OCI_SSH_KEY` | Sí | prod | GH env | deploy.yml |
| `OCI_SSH_KNOWN_HOSTS` | No (publico) | prod | GH env | deploy.yml |
| `OCI_DEPLOY_PATH` | No | prod | GH env | deploy.yml |

## Invariantes

- Los valores de los secretos existen únicamente en: `.env` local (modo 600, sin copias), `.env.production` en el host (modo 600, propietario `root` o el usuario de despliegue, nunca en Git) y GitHub Environment `production`.
- `.env.example` (raíz y backend) y `.env.production.example` contienen solo placeholders y se sincronizan manualmente con esta matriz.
- CI recibe únicamente valores de prueba no sensibles (`ci-only-pepper...`, etc.); ningún secreto real entra al repositorio ni a los workflows.
- El contenido de `.env.production` no se transporta en comandos SSH ni argumentos de procesos; se instala y rota por el canal definido en `docs/SECRETS-FLOW.md`.
- Rotación de credenciales Auth0 (legacy) y Resend: ver responsables y procedimiento en `docs/SECRETS-FLOW.md`.
