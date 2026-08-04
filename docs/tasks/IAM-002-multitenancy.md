# IAM-002: Sincronización y aislamiento de cuentas individuales

Estado: `DONE` (2026-08-04)

Dependencias: `IAM-008`, `SEC-001`.

## Objetivo

Conectar las identidades locales con cuentas individuales sin depender de datos enviados por el navegador. El único rol global es `admin` para operadores de Ghostinc.

## Alcance

- Usar el `user_id` de la sesión local validada como identidad canónica.
- Asociar API keys, créditos, consumo y facturación directamente al usuario.
- Migrar o retirar `organizations` y `memberships` mediante nuevas migraciones.
- Crear helpers de autorización reutilizables.
- Exigir `user_id` derivado del `sub` autenticado en consultas del portal.
- Añadir auditoría de cambios sensibles de cuenta.
- Probar aislamiento entre dos usuarios.

## Criterios de aceptación

- Un usuario nunca puede seleccionar otra identidad mediante parámetros.
- Ninguna consulta devuelve datos, claves, créditos o pagos de otro usuario.
- El rol global `admin` se almacena en PostgreSQL, se administra mediante operaciones auditadas y exige MFA.
- Tests negativos cubren lectura y escritura cruzadas entre usuarios.

## Verificación

```bash
npm test
cd backend
npm test
npm run typecheck
```

## Implementación

- Migración `005_account_isolation.sql`: `api_keys`, `credit_ledger`, `api_requests` y `billing_events` pertenecen directamente a `users`; se retiraron `organizations` y `memberships`.
- El saldo vive en `users.credit_balance` y la reserva/compensación bloquea la clave y el usuario en una transacción.
- `requireSessionUser` deriva la identidad exclusivamente de la sesión validada; `requireAdminActor` conserva rol global y MFA reciente.
- El overview administrativo y el bootstrap usan cuentas individuales.
- Tests negativos verifican aislamiento de claves, saldos, ledger, consumo y administración entre dos usuarios.

## Verificación ejecutada

- Backend: typecheck correcto y 113/113 tests.
- Frontend: typecheck, build y 73/73 tests.
- Migración aplicada en bases test y local; stack Docker healthy.
