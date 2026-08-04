# IAM-008: Administración local y retiro de Auth0

Estado: `DONE`

Dependencias: `IAM-005`, `IAM-006`, `IAM-007`.

## Alcance

- Listar, bloquear y desbloquear usuarios locales desde `/admin`.
- Guardar rol global `user`/`admin` en PostgreSQL con auditoría y MFA reciente.
- Invitar al primer admin y a cuentas existentes mediante enlaces de creación de contraseña.
- Retirar SDK, variables, rutas y documentación operativa Auth0 solo después de validar el reemplazo.
- Probar usuario común, admin, bloqueo, recuperación y rollback antes del corte.

## Criterios de aceptación

- Exactamente un flujo de autenticación queda activo después del corte.
- El admin inicial vive en PostgreSQL y no tiene contraseña predefinida.
- No quedan secretos Auth0 ni rutas que dependan de su tenant.

## Implementación

- `/admin/users` lista identidades locales, invita cuentas por email, bloquea/desbloquea y cambia roles mediante Fastify con token interno, sesión admin y MFA reciente.
- Las mutaciones administrativas se serializan y revalidan al actor dentro de la transacción; no permiten autobloqueo/autodemoción ni eliminar al último admin activo. Revocan sesiones y auditan actor y transición.
- El bootstrap CLI crea únicamente el primer admin, sin contraseña predefinida, y rechaza admins o identidades preexistentes.
- SDK, clientes, rutas, variables y dependencia npm de Auth0 retirados. `docs/AUTH0.md` queda solo como evidencia histórica.
- Inventario, invitación, corte y rollback documentados en `docs/AUTH-CUTOVER.md`; nunca se sincronizan roles por coincidencia de email.

## Verificación

- Backend: migración, typecheck, 107 tests y build en verde.
- Frontend: instalación limpia, typecheck, 73 tests y build en verde.
- Compose local y producción validan; stack reconstruido con frontend, backend y PostgreSQL saludables.
- `/api/account/authentication-methods` y `/api/account/password-reset` responden `404` en el artefacto reconstruido.
- Pruebas negativas: usuario no admin, MFA vencida, autobloqueo/autodemoción, bootstrap repetido, coincidencia de email y mutaciones administrativas concurrentes.
