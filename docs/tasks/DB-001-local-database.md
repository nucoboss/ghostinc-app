# DB-001: PostgreSQL local reproducible

Estado: `DONE` (verificado 2026-08-01). Runbook en `docs/DATABASE.md`.

## Objetivo

Dejar PostgreSQL y las migraciones funcionando de forma reproducible en local antes de ampliar el modelo de datos.

## Alcance

- Validar `compose.yaml` y el health check de PostgreSQL.
- Ejecutar todas las migraciones sobre una base vacía y aislada sin borrar el volumen habitual del desarrollador.
- Verificar `schema_migrations`, restricciones, ledger y operaciones atómicas existentes.
- Crear fixtures mínimos sin RUT ni secretos reales para pruebas automatizadas.
- Documentar arranque, diagnóstico, backup y restauración local en una base separada.
- Confirmar que PostgreSQL no publica puertos al host.

## Restricciones

- No usar `docker compose down -v` sobre el proyecto local habitual.
- No modificar migraciones ya aplicadas; cualquier cambio usa un nuevo SQL ordenado.
- No incorporar dumps ni datos personales al repositorio.

## Criterios de aceptación

- Una base vacía llega al esquema actual sin intervención manual.
- Una segunda ejecución no reaplica migraciones.
- Backend y PostgreSQL reportan estado saludable.
- Existe evidencia de una restauración local en una base separada.

## Verificación

```bash
docker compose config --quiet
docker compose up -d postgres backend
docker compose ps
docker compose exec postgres \
  psql -U ghostinc -d ghostinc -c "SELECT * FROM schema_migrations ORDER BY applied_at;"
curl http://localhost:4000/health/ready
```

## Ejecución (2026-08-01)

- `compose.yaml` válido; `postgres`, `backend` y `frontend` en estado `healthy`.
- Base aislada `ghostinc_verify` creada en la misma instancia (sin borrar el volumen dev): migración `001_initial.sql` aplicada; segunda ejecución no-op (idempotencia confirmada).
- Restricciones verificadas con casos negativos: `credit_balance >= 0`, `delta <> 0`, `key_hash` UNIQUE, `memberships.role` CHECK y FK `api_keys.organization_id`.
- Fixtures sintéticos en `backend/test/fixtures/basic.sql` (sin RUT ni secretos reales).
- Backup/restauración demostrados: `pg_dump ghostinc_verify` → `ghostinc_restore`; conteos idénticos (3 orgs, 2 claves, 1 ledger, 1 migración).
- PostgreSQL dev sin puertos publicados al host (`docker compose ps`: `5432/tcp` interno); solo `postgres-test` publica loopback `127.0.0.1:55432` para tests.
- Ledger: el código solo inserta (reserva/compensación); reforzar con triggers queda pendiente de hardening futuro (anotado en `docs/DATABASE.md`).
