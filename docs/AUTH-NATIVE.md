# Autenticación propia

Decisión aprobada el 2026-08-03. Este documento define el contrato objetivo que sustituirá Auth0 mediante `IAM-003` a `IAM-008`.

## Límites de responsabilidad

```text
Navegador
  -> Next.js /api/auth/* y páginas
  -> Fastify /internal/auth/* con X-Internal-Token
  -> PostgreSQL

Fastify -> Resend API
```

- Fastify es la autoridad de identidad y único dueño de tablas de usuarios, credenciales, sesiones, roles y MFA.
- Next.js valida formularios, aplica controles CSRF, llama al backend privado y emite/elimina la cookie de sesión.
- El navegador nunca recibe el token interno, hashes, secretos TOTP ni tokens Resend.
- `/internal/auth/*` no se publica mediante el proxy de producción.

## Registro y recuperación

1. El usuario envía un email; la respuesta es siempre genérica.
2. Fastify normaliza con `trim().toLowerCase()`, aplica límites y crea 32 bytes aleatorios.
3. PostgreSQL almacena solo `SHA-256(token)`, propósito, usuario, expiración y uso.
4. Resend entrega un enlace construido exclusivamente desde `APP_BASE_URL`.
5. El enlace vence en 30 minutos, es de un uso e invalida enlaces anteriores del mismo propósito.
6. La página permite crear una contraseña; no inicia sesión automáticamente.
7. El reset de contraseña usa el mismo patrón, revoca todas las sesiones y envía una notificación.

Los tokens no se registran, no se incluyen en analytics y se eliminan de la URL antes de mostrar formularios posteriores. Las páginas usan `Cache-Control: no-store` y `Referrer-Policy: no-referrer`.

## Contraseñas

- Biblioteca mantenida `argon2`; algoritmo Argon2id.
- Parámetros iniciales: memoria 19.456 KiB, tiempo 2, paralelismo 1, hash 32 bytes.
- Guardar la cadena PHC completa y rehashear después de un login cuando cambien los parámetros.
- Longitud entre 12 y 128 caracteres y máximo 1.024 bytes UTF-8.
- Permitir Unicode y gestores de contraseñas; no imponer reglas de composición.
- Rechazar contraseñas comunes o comprometidas mediante lista local/versionada, sin enviarlas a terceros.

## Sesiones

- Token opaco de 32 bytes; PostgreSQL conserva únicamente SHA-256.
- Duración absoluta de 8 horas e inactividad máxima de 30 minutos.
- Actualizar actividad como máximo una vez cada 5 minutos.
- Rotar después de login, MFA, cambio de contraseña o privilegios.
- Revocar al cerrar sesión, bloquear usuario, cambiar contraseña, cambiar rol o recuperar MFA.
- Cookie de producción: `__Host-id`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`.
- En local se usa un nombre sin prefijo `__Host-` y sin `Secure`; nunca se reutiliza la cookie local en producción.

## CSRF y origen

Toda mutación del BFF requiere:

- Método distinto de GET y `Content-Type: application/json`.
- `Origin` exactamente igual a `APP_BASE_URL`.
- `Sec-Fetch-Site: same-origin` cuando esté presente.
- Header `X-Ghostinc-Request: 1`.
- Reautenticación y MFA reciente para rol, bloqueo, reset MFA y futuras operaciones sensibles de billing.

## MFA

- TOTP RFC 6238 mediante `otpauth`: SHA-1, 6 dígitos, 30 segundos, ventana de ±1 período.
- Secreto de 20 bytes, pendiente hasta confirmar un código válido.
- Cifrado AES-256-GCM con nonce aleatorio de 12 bytes, tag, versión y `user_id` como AAD.
- Clave de cifrado fuera de PostgreSQL; producción usa el flujo de secretos definido en `SEC-004`.
- Rechazar transaccionalmente el mismo período TOTP ya aceptado.
- Diez códigos de recuperación de al menos 128 bits, visibles una vez y almacenados como HMAC-SHA-256 con pepper independiente.
- Un administrador no obtiene sesión `full` sin TOTP y no puede eliminar su MFA por autoservicio.

## Administración y recuperación

- Roles globales permitidos: `user` y `admin`; registro público siempre crea `user`.
- El primer admin se crea con una CLI que emite una invitación de registro; nunca inserta una contraseña.
- Alta/baja de admin exige administrador con MFA reciente, auditoría y revocación de sesiones del afectado.
- Recuperación normal usa email y códigos de recuperación.
- Pérdida total de MFA administrativo requiere acceso operativo al host, CLI auditada, motivo explícito, revocación de sesiones y nuevo enrolamiento; no existe bypass web.

## Contratos

Rutas públicas Next BFF:

```text
POST /api/auth/register
POST /api/auth/set-password
POST /api/auth/login
POST /api/auth/mfa
POST /api/auth/logout
GET  /api/auth/session
POST /api/auth/password/forgot
POST /api/auth/password/reset
POST /api/account/totp
POST /api/account/totp/verify
DELETE /api/account/totp
POST /api/account/recovery-codes/regenerate
```

Fastify implementa equivalentes bajo `/internal/auth/*`. Todos exigen `X-Internal-Token`; llamadas con sesión reciben el token opaco mediante `X-Session-Token`. Los errores públicos no distinguen usuario inexistente, email pendiente, contraseña incorrecta o cuenta bloqueada.

Estados de login:

- `authenticated`: sesión completa para usuario sin MFA pendiente.
- `mfa_required`: challenge temporal que solo permite verificar MFA o cerrar sesión.
- `invalid_credentials`: respuesta genérica sin indicar el motivo.

## Límites iniciales

- Registro/reset: 3 por email-hash/hora y 10 por IP/hora.
- Login: 5 por cuenta/15 minutos y 20 por IP/15 minutos.
- TOTP/recuperación: 5 intentos/5 minutos; destruir challenge después de 10 fallos.
- Un enlace activo por propósito y mínimo 60 segundos entre reenvíos.
- La implementación en memoria solo se permite con una réplica; Redis será obligatorio al escalar.

## Threat model STRIDE

| Amenaza | Ejemplo | Mitigación obligatoria |
|---|---|---|
| Spoofing | Credential stuffing o token robado | Argon2id, rate limit, MFA admin, sesiones rotadas |
| Tampering | Cambiar rol/user_id desde navegador | Identidad derivada de sesión; rol solo en PostgreSQL |
| Repudiation | Admin niega bloqueo/reset | `auth_events` inmutable con actor, acción y request ID |
| Information disclosure | Enumerar emails o filtrar tokens | Respuestas genéricas, hashes, redacción y `no-store` |
| Denial of service | Saturar Argon2 o correo | Límites previos al hash, cuotas por IP/email y timeout Resend |
| Elevation of privilege | Sesión user reutilizada como admin | MFA obligatorio, rotación al cambiar nivel y autorización en cada operación |

Riesgos adicionales: replay de enlaces/TOTP, fijación de sesión, CSRF, dominio remitente falso, compromiso de backups, pérdida de clave TOTP y abuso del procedimiento de recuperación. Cada uno requiere prueba negativa antes de `IAM-008`.

## Resend

- Variables previstas: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `APP_BASE_URL`.
- La API key existe solo en Fastify y se separa por ambiente.
- Producción exige dominio remitente verificado con SPF/DKIM y política DMARC revisada.
- No registrar destinatarios completos, cuerpos, enlaces ni respuestas que contengan datos personales.
- Tests automatizados usan un adaptador simulado; nunca envían correo real.

## Corte de Auth0

`IAM-008` retiró el SDK, rutas y variables Auth0. Fastify es la única autoridad de identidad y no se sincronizan cuentas ni privilegios por coincidencia de email. El inventario, invitación, validación y rollback se describen en `AUTH-CUTOVER.md`.
