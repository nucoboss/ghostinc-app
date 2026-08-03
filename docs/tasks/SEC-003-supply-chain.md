# SEC-003: Hardening de CI y contenedores

Estado: `BLOCKED` (implementación local completa; falta primer commit/push y ejecución real de CI/GHCR)

Dependencia: `SEC-001` (ambas tareas modifican CI y no deben ejecutarse en paralelo).

## Objetivo

Elevar la seguridad de la cadena de suministro y producir imágenes verificables.

## Alcance

- Fijar GitHub Actions por SHA inmutable.
- Añadir dependency review y secret scanning compatible con el repositorio.
- Escanear frontend y backend con Trivy o Grype.
- Generar SBOM SPDX o CycloneDX por imagen.
- Firmar imágenes GHCR con Cosign usando identidad OIDC.
- Añadir `no-new-privileges`, filesystem de solo lectura y `tmpfs` donde sea compatible.
- Añadir límites razonables de CPU y memoria en producción.
- Fijar imágenes base por digest y documentar actualización automatizada.
- Evitar que un hallazgo crítico llegue al job de despliegue.

## Restricciones

- Mantener migraciones y escritura temporal funcionales.
- No almacenar claves de firma estáticas si puede usarse OIDC keyless.
- No ejecutar scanners con permisos innecesarios.

## Criterios de aceptación

- CI publica SBOM para ambas imágenes.
- Una vulnerabilidad crítica bloquea publicación.
- El despliegue usa imágenes firmadas o verifica firma antes de iniciar.
- Compose sigue validando y los health checks funcionan.

## Verificación

```bash
docker compose config --quiet
docker compose --env-file .env.production.example -f compose.production.yaml config --quiet
docker compose build
docker compose up -d
docker compose ps
```

## Entregables

- Workflows endurecidos.
- Compose endurecido.
- Documentación de actualización y excepción de vulnerabilidades.

## Implementación

- Todos los Actions externos están fijados por SHA; Dependabot actualiza semanalmente Actions, npm y digests Docker.
- Dependency Review bloquea severidad alta y TruffleHog busca secretos verificados.
- Cada imagen se construye y escanea con Trivy antes de publicar; `CRITICAL` corregible devuelve error.
- Syft genera un SBOM SPDX JSON por imagen y BuildKit adjunta SBOM/provenance al manifiesto multi-arquitectura `linux/amd64,linux/arm64`.
- Cosign firma cada digest mediante GitHub OIDC y lo verifica al publicar y antes del despliegue.
- Producción consume referencias `image@sha256`, serializa despliegues y exige `OCI_SSH_KNOWN_HOSTS` en vez de confiar en `ssh-keyscan`.
- Imágenes base Node, PostgreSQL y Caddy están fijadas por digest. Los runtimes eliminan npm/corepack/yarn y ejecutan con filesystem raíz de solo lectura, `no-new-privileges`, `tmpfs` y límites de CPU, memoria y PID.
- Política de actualización y excepciones en `docs/SUPPLY-CHAIN.md`; actualmente no hay excepciones Trivy.

## Verificación local ejecutada

- `actionlint` 1.7.10 (archivo verificado por SHA-256): workflows válidos.
- Frontend: typecheck, 57/57 tests y build correctos.
- Backend: typecheck, 76/76 tests y build correctos; ambos `npm audit --audit-level=high` sin vulnerabilidades.
- `docker compose config --quiet` y manifest de producción con `.env.production.example`: correctos.
- `docker compose build`, `up -d`, health checks y `/health/ready`: correctos.
- Trivy 0.70.0 encontró inicialmente `CVE-2026-59873` crítico en npm global; se eliminó npm del runtime. Reescaneo final: frontend 0 críticos, backend 0 críticos.
- Syft 1.50.0: SBOM SPDX 2.3 generado para frontend (87 paquetes) y backend (109 paquetes).
- Ambas imágenes respondieron 200 ejecutadas con root filesystem de solo lectura, `no-new-privileges`, `tmpfs` y límites de recursos.

## Bloqueo para cierre

- Git fue inicializado en `main` y `origin` apunta al repositorio remoto vacío `nucoboss/ghostinc-app`; todos los archivos previstos están staged. `.env`, factura PDF, `*.tsbuildinfo` y `backend/dist` están ignorados.
- El índice staged pasó TruffleHog 3.96.0: 0 secretos verificados y 0 no verificados.
- Falta autorización explícita para crear el commit inicial y hacer push. No existe `gh` local, pero Git HTTPS está configurado; las credenciales se resolverán al subir.
- Para pasar a `DONE`: commit/push de `main`, observar CI, comprobar SBOM, manifests ARM64, firmas Cosign y que un crítico bloquee el publish. Los pushes no despliegan OCI.
- Antes del primer despliegue manual: leer `docs/OCI-SERVER.local.md`, preparar directorio y `.env.production`, registrar `OCI_SSH_KNOWN_HOSTS`, configurar secrets/environment de GitHub y validar backup/rollback según las tareas de despliegue pendientes.
