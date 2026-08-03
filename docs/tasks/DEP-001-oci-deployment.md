# DEP-001: Artefactos de despliegue OCI ARM64

Estado: `BLOCKED`

Dependencias: `SEC-003`, `SEC-004`.

## Objetivo

Preparar Compose y CI/CD para el host OCI ARM64 compartido sin competir con Nginx ni exponer servicios internos.

## Alcance

- Crear un manifiesto u override OCI sin Caddy.
- Publicar frontend solo en `127.0.0.1:3002` y backend solo en `127.0.0.1:4000`.
- Mantener PostgreSQL exclusivamente en la red Docker.
- Construir y publicar imágenes `linux/arm64` identificadas por SHA o digest inmutable.
- Eliminar dependencia operativa de tags `latest`.
- Fijar identidad del host SSH sin `ssh-keyscan` no verificado.
- Añadir `concurrency`, health checks posteriores y rollback al SHA anterior.
- Mantener el archivo de secretos del host fuera de los artefactos subidos.

## Criterios de aceptación

- Compose valida con variables de ejemplo y no publica `80`, `443` ni PostgreSQL.
- Las dos imágenes declaran plataforma `linux/arm64`.
- Un fallo de health check restaura el despliegue anterior.
- Dos ejecuciones concurrentes no despliegan versiones fuera de orden.
- El workflow no imprime ni reemplaza secretos del host.

## Verificación

```bash
docker compose --env-file .env.production.example -f compose.production.yaml config --quiet
docker buildx imagetools inspect <imagen-frontend-por-sha>
docker buildx imagetools inspect <imagen-backend-por-sha>
```
