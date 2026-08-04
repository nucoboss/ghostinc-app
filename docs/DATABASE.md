# Base de datos local: PostgreSQL y migraciones

Estado: verificado por `DB-001` (2026-08-01).

## Arranque

```bash
docker compose up -d postgres backend frontend
docker compose ps          # postgres y backend deben estar "healthy"
curl http://localhost:4000/health/ready   # {"status":"ok"}
```

- PostgreSQL del proyecto (servicio `postgres`) **no publica puertos al host**; solo el backend dentro de la red de Compose lo alcanza.
- El contenedor del backend ejecuta `node dist/scripts/migrate.js` antes de arrancar el servidor; las migraciones se aplican sobre `postgres:5432/ghostinc`.
- `postgres-test` (puerto `127.0.0.1:55432`, loopback) es exclusivo de la suite de tests con `TEST_DATABASE_URL`.

## Migraciones

- Fuente única: archivos `.sql` ordenados en `backend/migrations/`.
- Nunca se modifica una migración aplicada; cualquier cambio es un archivo nuevo (`NNN_descripcion.sql`).
- `schema_migrations` registra `name` + `applied_at`; cada migración se ejecuta en una transacción.
- Ejecución manual idempotente (no reaplica lo ya registrado):

```bash
# Desde el host, contra la base dev a través del contenedor backend:
docker compose exec -e DATABASE_URL=postgresql://ghostinc:ghostinc_local@postgres:5432/ghostinc \
  backend node dist/scripts/migrate.js

# Contra una base aislada nueva (ej. ghostinc_verify):
docker compose exec postgres psql -U ghostinc -d postgres -c "CREATE DATABASE ghostinc_verify;"
docker compose exec -e DATABASE_URL=postgresql://ghostinc:ghostinc_local@postgres:5432/ghostinc_verify \
  backend node dist/scripts/migrate.js
```

## Diagnóstico

```bash
docker compose exec postgres psql -U ghostinc -d ghostinc \
  -c "SELECT * FROM schema_migrations ORDER BY applied_at;"

# Restricciones del esquema (verificadas en DB-001 y ampliadas por IAM-002):
# - users.credit_balance >= 0 (CHECK)
# - credit_ledger.delta <> 0 (CHECK)
# - api_keys.key_hash UNIQUE
# - FKs: api_keys/credit_ledger/api_requests/billing_events -> users
```

## Backup y restauración en base separada (verificado)

El respaldo no se versiona; vive fuera del repositorio.

```bash
# 1. Dump de la base (ej. ghostinc_verify) hacia un archivo temporal:
docker compose exec -T postgres pg_dump -U ghostinc -d ghostinc_verify > /tmp/ghostinc_verify.dump

# 2. Crear la base de restauración (base separada, sin tocar datos existentes):
docker compose exec postgres psql -U ghostinc -d postgres -c "CREATE DATABASE ghostinc_restore;"

# 3. Restaurar:
docker compose exec -T postgres psql -U ghostinc -d ghostinc_restore < /tmp/ghostinc_verify.dump

# 4. Evidencia:
docker compose exec postgres psql -U ghostinc -d ghostinc_restore \
  -c "SELECT (SELECT count(*) FROM users) AS usuarios, (SELECT count(*) FROM credit_ledger) AS ledger;"
```

El procedimiento fue verificado originalmente en `DB-001`; desde `IAM-002`, la evidencia compara usuarios y ledger porque organizaciones y membresías ya no existen.

## Fixtures

- `backend/test/fixtures/basic.sql`: datos mínimos sintéticos (sin RUT reales ni secretos) para demos y pruebas.
- La suite automatizada siembra datos vía helpers en `backend/test/helpers/db.ts` (`seedUser`), con `key_hash` generados por HMAC en cada ejecución.

## Notas de inmutabilidad del ledger

- El código solo inserta en `credit_ledger` (reserva/compensación con `reference_id`); no hay `UPDATE`/`DELETE` sobre filas previas (invariante de negocio).
- Pendiente evaluado: reforzar la inmutabilidad a nivel de base (triggers) como parte de hardening futuro; no se agregó en `DB-001` por alcance.
