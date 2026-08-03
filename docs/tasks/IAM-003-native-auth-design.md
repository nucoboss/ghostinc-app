# IAM-003: Diseño de autenticación propia

Estado: `DONE` (2026-08-03)

Dependencias: `SEC-001`, `SEC-002`.

## Objetivo

Definir contratos y amenazas antes de almacenar contraseñas, sesiones o secretos TOTP en Ghostinc.

## Alcance

- Fastify será la autoridad de identidad y único componente con acceso a tablas de autenticación.
- Next.js será BFF, manejará formularios y emitirá la cookie opaca del navegador.
- Registro: email, enlace de un solo uso, creación de contraseña y login posterior.
- Login: email y contraseña; TOTP obligatorio para `admin` y opcional para usuarios.
- Definir alta del primer admin, recuperación, bloqueo, revocación, cambio de rol y pérdida de MFA.
- Modelar amenazas de enumeración, credential stuffing, fijación/robo de sesión, CSRF, replay de enlaces y códigos TOTP.
- Definir contratos de endpoints, errores genéricos, rate limits y auditoría sin datos sensibles.

## Decisiones técnicas

- Contraseñas con Argon2id mediante una biblioteca mantenida; no implementar el algoritmo.
- Sesiones opacas aleatorias; PostgreSQL almacena solo SHA-256 del token.
- Tokens de alta/reset aleatorios, de un uso, expirables y almacenados solo como hash.
- TOTP RFC 6238 mediante biblioteca open source; secretos cifrados con AES-256-GCM y clave externa a PostgreSQL.
- Diez códigos de recuperación de un uso almacenados como HMAC.
- Correo transaccional mediante la API server-side de Resend; enlaces y tokens siguen bajo control de Ghostinc.

## Criterios de aceptación

- Threat model y contratos revisados antes de crear migraciones.
- Ningún endpoint público de Fastify nuevo; el navegador usa exclusivamente el BFF.
- Política documentada para admin inicial, recuperación MFA y compromiso de credenciales.
- Parámetros criptográficos, expiraciones, cookies y límites definidos y verificables.

## Verificación

- Revisión contra OWASP ASVS, Password Storage, Session Management, Forgot Password y MFA Cheat Sheets.
- Confirmar que `IAM-004` a `IAM-008` no conservan dependencias funcionales de Auth0.

Verificación ejecutada el 2026-08-03:

- Límites de servicio, contratos, expiraciones, cookies, CSRF, rate limits y recuperación documentados en `docs/AUTH-NATIVE.md`.
- Threat model STRIDE cubre registro, login, sesiones, correo, MFA y privilegios.
- Resend definido como transporte; Fastify conserva autoridad sobre tokens y estado.
- `IAM-004` a `IAM-008` separan construcción y corte para evitar dos sistemas activos al finalizar.
