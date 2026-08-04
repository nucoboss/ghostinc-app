# Ghostinc

Ghostinc consulta información pública asociada a empresas chilenas. La API comercial objetivo agregará antecedentes de PJUD, otras fuentes públicas y datos normalizados en SQL, mientras la búsqueda gratuita permanece limitada a PJUD.

## Estado actual

- Landing y búsqueda gratuita operativas.
- Portal API, cuenta, playground, créditos y monitoreo montados como frontend demo.
- Backend Fastify operativo con una ruta gratuita interna y una ruta comercial autenticada por API key.
- Reserva y devolución transaccional de créditos implementada.
- PostgreSQL y migraciones iniciales operativos.
- Imágenes Docker de frontend y backend verificadas.
- Compose local y Compose de producción disponibles.
- Pipeline CI/CD preparado para GitHub, GHCR y una VM en OCI.
- Caddy preparado como único punto público detrás de Cloudflare.

La autenticación nativa con contraseñas Argon2id, sesiones opacas, MFA TOTP, recuperación y administración local está implementada. La emisión web de API keys y la integración de Mercado Pago Chile todavía están pendientes.

## Inicio rápido

Requisitos:

- Docker Engine y Docker Compose.
- Servicio PJUD accesible en `localhost:18080`, o configurar `PJUD_API_BASE_URL`.

Levantar el stack:

```bash
docker compose up -d --build
```

Comprobar servicios:

```bash
docker compose ps
curl http://localhost:4000/health/ready
```

Accesos locales:

- Web: <http://localhost:3002>
- Cuenta: <http://localhost:3002/cuenta>
- Portal API: <http://localhost:3002/dashboard>
- Perfil y seguridad: <http://localhost:3002/dashboard/profile>
- Playground privado: <http://localhost:3002/dashboard/playground>
- Administración: <http://localhost:3002/admin>
- Backend local: <http://localhost:4000>

Detener servicios sin borrar datos:

```bash
docker compose down
```

No uses `docker compose down -v` salvo que quieras eliminar definitivamente la base local.

## Verificación

Frontend:

```bash
npm ci
npm run typecheck
npm run build
```

Backend:

```bash
cd backend
npm ci
npm run typecheck
npm run build
```

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Docker y operación](docs/DOCKER.md)
- [Backlog y pendientes](docs/BACKLOG.md)
- [Cola de tareas para agentes](docs/AGENT-TASKS.md)
- [Autenticación nativa](docs/AUTH-NATIVE.md)
- [Corte y migración de identidad](docs/AUTH-CUTOVER.md)
- [Pagos con Mercado Pago Checkout Pro](docs/MERCADO-PAGO.md)
- [Programa de seguridad OWASP SAMM](docs/SECURITY-ROADMAP.md)
- [Despliegue OCI y Cloudflare](deploy/README.md)
- [Política para reportar vulnerabilidades](SECURITY.md)

## Estructura

```text
.
├── src/                     # Frontend Next.js y BFF
├── backend/                 # API Fastify, migraciones y servicios
├── docs/                    # Arquitectura, operación y seguridad
├── deploy/                  # Caddy y guía OCI/Cloudflare
├── .github/workflows/       # CI y despliegue
├── compose.yaml             # Stack local
└── compose.production.yaml  # Stack OCI
```

## Principios

- Las credenciales de PJUD nunca llegan al navegador.
- PostgreSQL y backend no se publican directamente en producción.
- La búsqueda gratuita tiene filtros y límite impuestos por backend.
- Las solicitudes comerciales fallidas no consumen créditos.
- Los RUT no se almacenan en el registro de consumo actual.
- Ningún placeholder de cuenta o pago debe habilitarse en producción sin completar los controles de seguridad definidos.
