# IAM-005: Registro y recuperación por correo

Estado: `DONE` (2026-08-03)

Dependencias: `IAM-004`, cuenta Resend y dominio remitente validado para la prueba real.

## Alcance

- Solicitud de alta con respuesta genérica y rate limit.
- Enlace de un solo uso para crear contraseña segura.
- Recuperación y cambio de contraseña con revocación total de sesiones.
- API server-side de Resend con `RESEND_API_KEY` y remitente validados en configuración.
- API keys distintas por ambiente, sin secretos ni contenido sensible en logs.
- Pruebas con transporte simulado; prueba real de entrega antes de cerrar.

## Criterios de aceptación

- No se puede enumerar si un correo existe.
- Enlaces usados, vencidos o reemplazados son rechazados.
- El navegador nunca envía precio, rol ni privilegios durante el alta.
- Las pruebas automatizadas usan un transporte simulado y nunca envían correos reales.

## Implementación

- Backend: `services/email.ts` con transporte simulado (`emailOutbox`) y Resend (`https://api.resend.com/domains` con cache de 24 h para validar remitente); `services/auth-tokens.ts` emite/consume tokens de 30 min hasheados y cambia contraseña, revoca sesiones, consume el token y registra auditoría en una sola transacción.
- Rutas internas en `backend/src/routes/auth.ts`: `POST /internal/auth/register` y `/recovery` con rate limit 3/min por cliente y respuesta genérica; el envío se desacopla de la respuesta y sus fallos no enumeran cuentas. `/set-password` valida 12–128 caracteres y traduce `invalid_token`/`invalid_password`.
- Config en `backend/src/config.ts`: `APP_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (ambos-o-ninguno; obligatorios en producción).
- BFF: `src/app/api/auth/register|recovery|set-password/route.ts` con origen exacto, Fetch Metadata y header personalizado; propaga la IP confiable al rate limiter interno.
- Páginas: `/registrarme`, `/recuperar` y `/crear-contrasena` con formularios clientes compartidos. El token viaja en el fragmento `#token=...`, se elimina inmediatamente con `history.replaceState` y nunca llega a HTTP, logs ni SSR.
- Env/compose: `RESEND_API_KEY`/`RESEND_FROM_EMAIL`/`APP_BASE_URL` en `.env.example`, `backend/.env.example`, `compose.yaml` y `compose.production.yaml`.

## Verificación

- Backend: 76/76 tests (uso único, reemplazo, consumo concurrente, no enumeración y rate limit) + typecheck + build.
- Frontend: 57/57 tests (BFF, CSRF, IP de cliente y smoke) + typecheck + build.
- `docker compose config --quiet` en ambos manifests.
- E2E local: login y dashboard 200, rotación 200, logout 200, token anterior 401 y origen cruzado 403.

## Prueba real

- Dominio remitente validado mediante la API de Resend y backend recreado con `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.
- Alta real: Resend informó `delivered`; el enlace activó la cuenta, verificó el correo, almacenó Argon2id y quedó consumido.
- Login real: la cuenta activada accedió al dashboard.
- Recuperación real: Resend informó `delivered`; el enlace cambió la contraseña, consumió el token y revocó la sesión anterior. Un login posterior creó una sesión nueva.
- No se registraron ni documentaron API keys, contraseñas ni tokens de enlace/sesión.
