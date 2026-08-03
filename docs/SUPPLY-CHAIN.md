# Cadena de suministro

## Imágenes

- Los `Dockerfile` y servicios de terceros fijan tag legible y digest inmutable.
- Dependabot revisa semanalmente npm, GitHub Actions y digests Docker; toda actualización debe pasar CI.
- GHCR publica únicamente el tag del SHA de Git. Producción consume `frontend@sha256:...` y `backend@sha256:...`, nunca `latest`.
- BuildKit adjunta provenance y SBOM; CI conserva además un SBOM SPDX JSON por imagen durante 30 días.

## Puerta de publicación

1. Construir una imagen `linux/amd64` local.
2. Ejecutar Trivy sobre vulnerabilidades `CRITICAL`; un hallazgo corregible bloquea el job antes del push.
3. Generar el SBOM SPDX.
4. Publicar el manifiesto `linux/amd64,linux/arm64` con attestations.
5. Firmar el digest con Cosign keyless y OIDC de GitHub Actions.
6. Verificar la firma al publicar y nuevamente antes del despliegue.

El job de despliegue requiere `OCI_SSH_KNOWN_HOSTS` con la identidad del host obtenida por un canal confiable; no usa `ssh-keyscan` durante la ejecución.
Los pushes a `main` publican y firman, pero no despliegan. Producción solo se activa manualmente mediante `workflow_dispatch` con `deploy=true`, después de preparar y aprobar el environment `production`.

## Excepciones

- No se aceptan excepciones silenciosas ni `continue-on-error` en dependency review, secret scanning, Trivy, SBOM o firma.
- Una excepción de vulnerabilidad requiere archivo `.trivyignore` versionado, identificador exacto, justificación, responsable y fecha de vencimiento. Actualmente no existen excepciones.
- Una alerta de secreto se resuelve revocando primero la credencial; eliminarla del historial no reemplaza la rotación.

## Runtime

Producción usa filesystem raíz de solo lectura, `no-new-privileges`, PID/CPU/memoria limitados y `tmpfs` mínimos. PostgreSQL y Caddy conservan escritura solo en sus volúmenes persistentes; frontend y backend escriben temporalmente solo en los mounts declarados.
