# IAM-004: Identidad local y primitivas criptográficas

Estado: `DONE` (2026-08-03)

Dependencia: `IAM-003`.

## Alcance

- Nueva migración para usuarios locales, tokens, sesiones, credenciales TOTP, recuperación y auditoría.
- Hash Argon2id, tokens aleatorios, hashes de sesión y cifrado versionado de secretos.
- CLI de un solo uso para invitar al primer administrador; nunca sembrar contraseñas en SQL.
- Pruebas unitarias, de expiración, replay, concurrencia y revocación.

## Criterios de aceptación

- La base nunca almacena contraseñas, tokens de sesión/enlace ni códigos de recuperación en texto plano.
- Cambiar contraseña, bloquear o cambiar privilegios revoca sesiones activas.
- Migraciones desde cero y sobre la base actual finalizan correctamente.

## Verificación ejecutada

- `002_local_identity.sql` aplicada desde cero y sobre la base local existente.
- `npm run typecheck` y `npm run build`: correctos.
- `npm test`: 47/47 pruebas backend correctas sobre PostgreSQL efímero.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- Bootstrap administrativo ejecutado en base efímera: un usuario `admin` y un token de invitación almacenado como hash de 32 bytes.
- Backend local saludable después de aplicar la migración.

## Entregables

- Tablas para tokens, sesiones, TOTP, recovery codes y eventos de autenticación.
- Argon2id, tokens opacos, AES-256-GCM y HMAC para códigos de recuperación.
- Operaciones transaccionales que revocan sesiones al cambiar contraseña, bloquear o cambiar rol.
- CLI `npm run bootstrap:admin` para emitir una invitación inicial sin sembrar contraseñas.
