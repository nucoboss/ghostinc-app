# SEC-001: Base automatizada de pruebas

Estado: `DONE` (verificado 2026-08-01)

## Objetivo

Crear una suite reproducible para backend y frontend que cubra los controles críticos existentes antes de continuar con funcionalidades comerciales.

## Alcance

- Configurar un runner de tests compatible con TypeScript.
- Probar normalización y validación de RUT en frontend y backend.
- Probar ruta gratuita: filtros inmutables, límite 10, RUT inválido y fallo PJUD.
- Probar ruta comercial: API key ausente, clave inválida, saldo insuficiente, consumo exitoso y devolución ante error.
- Probar token interno administrativo correcto e incorrecto.
- Añadir prueba concurrente que demuestre que el saldo nunca queda negativo.
- Añadir smoke tests de render para `/`, `/cuenta` y bloqueo de `/admin` sin Auth0.
- Integrar tests en `.github/workflows/ci.yml`.

## Restricciones

- No llamar a PJUD real desde tests.
- Usar PostgreSQL efímero o el servicio PostgreSQL de CI.
- No debilitar funciones para facilitar mocks.
- No incluir secretos reales ni snapshots con RUT reales.

## Criterios de aceptación

- Una consulta fallida no consume créditos.
- Dos solicitudes concurrentes no gastan más saldo del disponible.
- Los parámetros enviados por el cliente no alteran la modalidad gratuita.
- El endpoint interno devuelve `401` sin token.
- CI falla si cualquier prueba falla.

## Verificación (ejecutada el 2026-08-01)

Backend (`cd backend`, con `TEST_DATABASE_URL=postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test`):

- `npm test`: 24/24 pasan, 3 ejecuciones consecutivas estables (~8 s).
- `npm run typecheck` y `npm run build`: sin errores.

Frontend (raíz):

- `npm test`: vitest 2 archivos, 9 pruebas, pasan.
- `npm run typecheck` y `npm run build`: sin errores.

Infraestructura:

- `docker compose config --quiet`: válido (incluye servicio `postgres-test`).
- CI (`ci.yml`): jobs frontend y backend ejecutan `npm test`; el job backend levanta `postgres:16-alpine` con la base `ghostinc_test` (nombre con "test", requerido por el guard de `test/helpers/setup.ts`) y migra antes de correr tests.

## Hallazgos corregidos

1. **Orden de evaluación ESM bajo `tsx --test`**: un `top-level await` en `test/helpers/setup.ts` liberaba la evaluación de imports hermanos, por lo que `src/config.ts` (singleton con parseo de env) se evaluaba antes de fijar `PJUD_API_BASE_URL` y los tests golpeaban el PJUD real local. Solución: `setup.ts` solo sincrónico; los helpers de DB cargan `src/db.ts` y `src/services/credits.ts` con imports dinámicos; cada archivo de test arranca su propio stub y fija el env antes de importar `app.js`.
2. **Deadlock en operaciones de crédito (SQLSTATE `40P01`)**: con 20 solicitudes concurrentes, `reserveCredit` (`SELECT ... FOR UPDATE OF k, o` + `UPDATE`) y `logApiRequest` (FK checks en filas bloqueadas) producían deadlocks reales (7/20 respuestas 500). Solución en producción: reintento con jitter (máx. 3 intentos) sobre `40P01` en `reserveCredit`, `refundCredit` y `logApiRequest` (`backend/src/services/credits.ts`). El test de concurrencia ahora verifica 5×200 y 15×402 con saldo exacto 0 y 5 entradas de ledger.

## Notas

- `tsconfig.json` raíz excluye `backend/` (paquete separado con su propio typecheck); antes lo incluía por `**/*.ts`.
- El stub de PJUD (`test/helpers/pjud-stub.ts`) se monta en `/api/v1` y registra ruta + query de cada request recibido.
- `TEST_DATABASE_URL` (o `DATABASE_URL`) es obligatoria para `npm test` del backend; el guard rechaza bases cuyo nombre no contenga "test".

## Entregables

- Runner backend: `node:test` + `tsx --test` (`backend/package.json`, `tsconfig.test.json`).
- Runner frontend: vitest (`package.json` raíz, `vitest.config.ts`, stubs de `server-only`, `next/link`, `next/navigation`).
- Tests: `backend/test/{rut,free-route,paid-route,admin,concurrency}.test.ts`, helpers `setup.ts`, `pjud-stub.ts`, `db.ts`; frontend `src/lib/rut.test.ts`, `src/app/smoke.test.tsx`.
- Servicio `postgres-test` en `compose.yaml` (puerto host 55432, loopback).
- CI actualizado con `npm test` en ambos jobs.
- `BACKLOG.md` y `AGENT-TASKS.md` actualizados.
