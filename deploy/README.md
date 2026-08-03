# Despliegue en OCI detrás de Cloudflare

## OCI

1. Crea una VM Ubuntu 24.04 con IP pública reservada.
2. Instala Docker Engine y el plugin Docker Compose.
3. Crea el directorio indicado por el secreto `OCI_DEPLOY_PATH`.
4. Copia `.env.production.example` como `.env.production` y reemplaza todos los secretos.
5. Abre TCP 80 y 443 en la Security List y en el firewall de la VM.
6. No publiques los puertos de PostgreSQL, frontend o backend.
7. Si GHCR es privado, ejecuta una vez `docker login ghcr.io` en la VM.

## Cloudflare

1. Crea un registro A para `DOMAIN` apuntando a la IP reservada de OCI.
2. Activa el proxy naranja.
3. Configura SSL/TLS en `Full (strict)`.
4. Activa Always Use HTTPS y HTTP/3.
5. Limita el acceso al origen a los rangos IP de Cloudflare cuando el dominio esté estable.
6. Crea reglas de rate limiting adicionales para `/api/v1/*` si el plan de Cloudflare lo permite.

## GitHub

Configura estos secretos del repositorio:

- `OCI_HOST`: IP o hostname de la VM.
- `OCI_USER`: usuario SSH.
- `OCI_SSH_KEY`: clave SSH privada de despliegue.
- `OCI_DEPLOY_PATH`: ruta absoluta del despliegue, por ejemplo `/opt/ghostinc`.

Cada push a `main` publica dos imágenes en GHCR y actualiza Compose en OCI. Las migraciones se ejecutan al iniciar el backend y son idempotentes.

## Primera API key

Antes de conectar la gestión de cuentas, crea una organización y su primera clave desde la VM:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec \
  -e BOOTSTRAP_ORG_NAME="Cliente inicial" \
  -e BOOTSTRAP_CREDITS=1000 \
  backend node dist/scripts/bootstrap.js
```

La clave se muestra una sola vez. La base de datos conserva únicamente un hash HMAC.

## Backups

Configura un backup diario cifrado de PostgreSQL hacia OCI Object Storage. Prueba la restauración periódicamente; un volumen Docker no reemplaza una política de backups.
