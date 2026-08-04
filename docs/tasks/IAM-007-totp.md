# IAM-007: TOTP y códigos de recuperación

Estado: `DONE`

Dependencias: `IAM-006`, `SEC-004`.

## Alcance

- Enrolamiento y confirmación TOTP mediante biblioteca RFC 6238 open source.
- MFA obligatorio para `admin` antes de emitir sesión completa.
- MFA opcional para usuarios con reautenticación para alta y baja.
- Secretos cifrados, rechazo de replay y códigos de recuperación de un uso.
- Procedimiento auditado de recuperación administrativa.

## Criterios de aceptación

- Un admin nunca obtiene sesión privilegiada sin segundo factor.
- Un código TOTP o de recuperación no puede reutilizarse.
- La clave de cifrado y pepper no se almacenan en PostgreSQL ni Git.

## Implementación

Backend:

- Migración `004_mfa.sql`: `auth_level` permite `password`/`mfa`/`full`; columnas `mfa_verified_at` y `mfa_failed_attempts`.
- `backend/src/services/auth-mfa.ts`: enrolamiento, confirmación, verificación con anti-replay (período ya usado rechazado transaccionalmente), códigos de recuperación de un uso (HMAC-SHA-256 con pepper) y regeneración.
- `loginUser` devuelve `mfa_required` para admins aunque no tengan TOTP y para usuarios con TOTP confirmado; indica si el admin debe enrolar y nunca emite `full` sin resolver el desafío.
- `verifyMfaChallenge` rota a `full`, fija `mfa_verified_at` y destruye el desafío tras 10 fallos.
- Rutas `/internal/auth/mfa/{enroll,confirm,verify,status,disable,regenerate-codes}` con rate limit por IP y `X-Internal-Token`.
- Los usuarios comunes deben confirmar su contraseña actual en cada alta o baja TOTP; una contraseña ausente o incorrecta no modifica las credenciales MFA.
- Confirmar TOTP revoca las demás sesiones abiertas. La regeneración de recovery codes exige una sesión `full` y TOTP confirmado, por lo que un challenge administrativo no puede usarla para omitir el enrolamiento.
- `requireAdminActor` (rutas admin) exige sesión con rol `admin` y MFA reciente (`ADMIN_MFA_REAUTH_SECONDS`).
- `backend/src/scripts/reset-admin-mfa.ts`: procedimiento auditado de recuperación (borra MFA, revoca sesiones y registra `mfa_admin_reset` con motivo).

Frontend (BFF):

- `POST /api/auth/login` distingue `authenticated` y `mfa_required`; guarda el token del desafío en cookie `__Host-mfa`/`ghostinc_mfa_challenge`.
- `POST /api/auth/mfa` resuelve el desafío y rota a cookie de sesión completa.
- `GET/POST /api/auth/session` descarta sesiones que no estén en nivel `full`.
- `LoginForm` muestra enrolamiento QR para el primer acceso administrativo y acepta TOTP o recovery code al resolver `mfa_required`.
- `GET/POST/DELETE /api/account/totp` y `POST /verify` usan el backend nativo con CSRF, cookie opaca y reautenticación para usuarios comunes.
- `/dashboard/profile` muestra estado, enrolamiento QR, recovery codes y baja TOTP; al desactivar revoca la sesión y vuelve al login.

Variables de entorno:

- `TOTP_ENCRYPTION_KEY`: 64 caracteres hexadecimales (clave AES-256-GCM, fuera de PostgreSQL).
- `RECOVERY_CODE_PEPPER`: mínimo 32 caracteres para hashear códigos de recuperación.
- `ADMIN_MFA_REAUTH_SECONDS`: ventana de MFA reciente para acciones de admin.

## Verificación

- `npm run typecheck`, `npm run build` y `TEST_DATABASE_URL=... npm test` en verde (96 tests backend; 69 frontend).
- `docker compose --env-file .env.production.example -f compose.production.yaml config --quiet` en verde.
- `docker compose up -d --build`: backend, frontend y PostgreSQL saludables; migración `004_mfa.sql` aplicada por el entrypoint.
- E2E local BFF: admin temporal -> `mfa_required` con enrolamiento -> QR/confirmación -> 10 recovery codes -> recovery code -> sesión `full` -> `/admin` 200. Usuario temporal y archivos con códigos eliminados al finalizar.
- Pruebas negativas: contraseña ausente/incorrecta en alta y baja, replay TOTP/recovery, concurrencia del mismo período, destrucción tras 10 fallos, revocación de sesiones anteriores y bloqueo de regeneración desde challenge admin.
