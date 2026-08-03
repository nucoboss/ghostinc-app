# IAM-008: Administración local y retiro de Auth0

Estado: `BLOCKED`

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
