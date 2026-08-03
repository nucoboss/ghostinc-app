# SEC-004: Flujo seguro de variables y secretos

Estado: `IN_PROGRESS` (implementación local completa; verificación de rotación en staging pendiente de `OPS-002`)

Dependencia: `SEC-003` (DONE).

## Objetivo

Definir e implementar cómo se generan, almacenan, entregan, rotan y revocan credenciales sin exponerlas en Git, logs ni argumentos de procesos.

## Alcance

- Inventariar variables públicas, configuración sensible y secretos por entorno.
- Usar GitHub Environment `production` para aprobación y secretos de despliegue.
- Usar OCI Vault o un mecanismo equivalente como fuente de secretos de runtime.
- Entregar secretos al host por un canal que no los imprima ni los incluya en argumentos visibles.
- Crear `.env.production` con propietario dedicado y permisos `600`, sin sobrescribirlo con placeholders.
- Separar development, staging y production con credenciales independientes.
- Documentar bootstrap, rotación, revocación, recuperación y responsable de cada secreto.
- Añadir controles para impedir commits de `.env*` no permitidos y redacción en CI.

## Criterios de aceptación

- Ningún secreto aparece en Git, artefactos, logs o salida de workflows.
- El workflow puede desplegar sin transportar el contenido de `.env.production` en comandos SSH.
- Rotar un secreto tiene un procedimiento probado y una ventana de rollback.
- Los permisos del archivo y directorio de runtime son mínimos.
- Existe una matriz variable-entorno-propietario-origen sin incluir valores.

## Verificación

- Ejecutar secret scanning sobre historial y cambios actuales.
- Ejecutar un despliegue de staging con valores de prueba y revisar logs completos.
- Rotar un secreto no crítico en staging y demostrar que el valor anterior queda revocado.

## Implementación ejecutada (2026-08-03)

- Matriz completa de variables sin valores en `docs/ENV-MATRIX.md` (entorno, origen, servicio consumidor, invariantes).
- Flujo de bootstrap, rotación, revocación, rollback, permisos `600` y responsables en `docs/SECRETS-FLOW.md`.
- Job `env-file-guard` en `.github/workflows/ci.yml`: falla si se trackea un `.env*` que no sea `*.env.example`.
- `deploy/README.md` actualizado: secretos OCI viven en GitHub Environment `production` (con `Required reviewers` recomendado), `.env.production` se instala por canal seguro con `install -m 600 -o root -g root` y el workflow nunca transporta su contenido.
- Confirmado por código: el workflow despliega sin leer el contenido de `.env.production` (solo digests, compose y Caddyfile por SCP/SSH).

## Verificación local ejecutada

- Guard `env-file-guard` validado localmente: 0 archivos `.env*` no-example trackeados (`.env.example` raíz y backend pasan correctamente).
- `docker compose config --quiet` y `docker compose --env-file .env.production.example -f compose.production.yaml config --quiet`: correctos.
- Gitleaks sobre el árbol: hallazgos solo en `.env` (local, ignorado) y `.next/` (artefacto ignorado); 0 hallazgos en archivos trackeados.

## Pendiente humano para cerrar

- Crear Environment `production` en GitHub y cargar `OCI_HOST`, `OCI_USER`, `OCI_SSH_KEY`, `OCI_DEPLOY_PATH`, `OCI_SSH_KNOWN_HOSTS`.
- Despliegue de staging con valores de prueba y rotación demostrada (`OPS-002`).
