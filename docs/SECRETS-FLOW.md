# SEC-004: Flujo seguro de variables y secretos

Este documento define cómo se generan, instalan, rotan y revocan credenciales para Ghostinc sin exponerlas en Git, logs ni argumentos de procesos.

## Principios

- Los secretos viven en tres y solo tres lugares:
  1. `.env` local del desarrollador (modo `600`, copiado del ejemplo, nunca subido).
  2. `.env.production` en el host OCI (modo `600`, propietario dedicado, nunca en Git).
  3. GitHub Environment `production` para secretos de despliegue (OCI).
- CI no conoce secretos reales; usa valores de prueba sustitutos.
- El contenido de `.env.production` **no** viaja en comandos SSH, argumentos de procesos ni logs del workflow.
- Desarrollo, staging y producción usan credenciales independientes.

## Inventario y permisos

Matriz completa (sin valores) en `docs/ENV-MATRIX.md`.

Permisos mínimos de runtime en el host:

```bash
install -m 600 -o root -g root /ruta/origen/.env.production /opt/ghostinc/.env.production
```

El contenedor backend ejecuta como `node` sobre filesystem de solo lectura con `tmpfs`; las variables se pasan por `environment` de Compose, no por archivo montado.

## Bootstrap del host (primera instalación)

1. En OCI: `mkdir -p /opt/ghostinc && chmod 700 /opt/ghostinc`.
2. El operador de despliegue copia desde su estación, por canal cifrado (SCP/SSH), el `.env.production` con los valores reales previamente generados con `openssl rand -hex 32` para cada secreto.
3. `install -m 600 -o root -g root .env.production $OCI_DEPLOY_PATH/.env.production`.
4. El workflow `deploy.yml` sube únicamente `compose.production.yaml`, `deploy/Caddyfile` y los digests; nunca lee ni espera el contenido del archivo `.env.production`.

## GitHub Environment `production`

- Secretos de despliegue OCI: `OCI_SSH_KEY`, `OCI_HOST`, `OCI_USER`, `OCI_DEPLOY_PATH`, `OCI_SSH_KNOWN_HOSTS`. Definidos como *repository secrets* del Environment `production`; el workflow `deploy` los consume desde ese Environment.
- Protección de entorno recomendada: `Required reviewers` para el job `deploy` (que solo se ejecuta con `workflow_dispatch` y `deploy=true`).

## Rotación de secretos

| Secreto | Responsable | Frecuencia | Procedimiento | Rollback |
|---|---|---|---|---|
| `API_KEY_PEPPER` | Dueño de producto/dev | Anual o ante compromiso | Generar nuevo valor, actualizar `.env.production` en host, `docker compose up -d backend`, regenerar HMACs no es posible (irreversible): **rotación solo compatible con nueva base** si cambia. Evitar rotar salvo necesario. | Restaurar valor anterior de backup del host y recrear contenedores |
| `INTERNAL_SERVICE_TOKEN` | Dev/sec | Al comprometerse | Generar `openssl rand -hex 32`, actualizar host, recrear servicios (frontend y backend juntos) | Restaurar valor anterior y recrear |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Dev | Al rotar en Resend | Renovar en panel Resend, actualizar `.env.production`, recrear backend | Valor anterior sigue válido en Resend hasta revocarlo allí |
| `POSTGRES_PASSWORD` | DevSec | Anual o compromiso | `ALTER USER` en contenedor PostgreSQL, actualizar `.env.production` y `DATABASE_URL` del backend, recrear | Restaurar contraseña anterior y `DATABASE_URL` |
| `PJUD_API_KEY` | Dev | Al rotar en PJUD | Actualizar `.env.production`, recrear backend | Valor anterior si PJUD lo acepta en ventana |
| `AUTH0_*` (legacy) | Dueño Auth0 | Retirar con IAM-008 | No rotar; eliminar en `IAM-008` | N/A (reemplazado por nativa) |

Cada rotación ejecuta:

```bash
# en el host, como operador
cd $OCI_DEPLOY_PATH
# editar .env.production sin exponer valor: uso de editor con variables, no echo
docker compose --env-file .env.production -f compose.production.yaml up -d
docker compose --env-file .env.production -f compose.production.yaml ps
```

Tras rotar un secreto **no crítico** en staging (pendiente `OPS-002`), se demuestra que el valor anterior queda revocado antes de aplicar a producción.

## Revocación

- Tokens de acceso de proveedores: revocación en el panel del proveedor (Resend), no solo en `.env`.
- Claves SSH de despliegue: revocar eliminando la clave del Environment, surtir nueva en el host.
- Sesiones/apps: para pérdida de `INTERNAL_SERVICE_TOKEN` se rota; en Auth0 se revoca el flujo recibiendo login fallido.

## Controles contra fugas

- `.gitignore` ignora `.env*` salvo `**/.env.example`.
- Workflow `ci.yml` añade job `secret-scan` (TruffleHog) y un paso de guard sobre `.env` (ver `SEC-003` hardening).
- Nunca imprimir variables en runbooks ni en pasos `run:`; GitHub redacta secretos en logs y falla comandos que los cuenten en `ENV` inline.
- Cualquier PR que toque `.env*` requiere revisión manual del propietario.

## Responsables

Por tarea: ver `docs/ENV-MATRIX.md` y sitios de credenciales en el proyecto. Cada secreto tiene un responsable declarado en la sección de rotación de este documento.

## Verificación

- Secret scanning sobre historial (`gitleaks detect --source=. --no-git`) con 0 hallazgos en archivos trackeados.
- `docker compose config --quiet` local y producción sin errores.
- Despliegue de staging con valores de prueba: pendiente `OPS-002`.