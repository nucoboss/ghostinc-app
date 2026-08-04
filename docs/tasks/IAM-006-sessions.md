# IAM-006: Login, sesiones y BFF

Estado: `DONE` (2026-08-03)

Dependencia: `IAM-004`.

## Alcance

- Login email/contraseña y logout mediante rutas Next BFF hacia Fastify interno.
- Cookie opaca HTTP-only, SameSite y Secure en HTTPS; sesión validada en PostgreSQL.
- Límites absolutos y de inactividad, rotación y revocación.
- Protección CSRF por Origin, Fetch Metadata, JSON y header personalizado.
- Reemplazar helpers, layouts y Server Actions Auth0 sin reducir autorización.

## Criterios de aceptación

- Usuarios bloqueados, sesiones vencidas o revocadas no acceden.
- Ninguna credencial o token aparece en URL, HTML, storage o logs.
- Tests negativos cubren fijación de sesión, CSRF y acceso sin sesión.

## Implementación

### Backend (Fastify, solo `/internal/auth/*`, nunca publicado)

- `POST /internal/auth/login`: valida credenciales con error genérico, rate limit 10/min por cliente y eventos `login`/`login_failed`. Requiere contraseña definida y usuario no bloqueado.
- `POST /internal/auth/session` y `/internal/auth/session/rotate`: validan el token opaco contra `auth_sessions` con `FOR UPDATE`; revocan por inactividad, límite absoluto o bloqueo; rotan el hash dentro de la ventana configurada.
- `POST /internal/auth/logout`: revocación idempotente con evento `logout`.
- `GET /internal/admin/users` y acciones `block`/`unblock`/`role`: listado y gestión local; el actor se resuelve desde la sesión y debe ser `admin`.
- Política configurable: `SESSION_ABSOLUTE_SECONDS` (28 800), `SESSION_INACTIVITY_SECONDS` (1 800), `SESSION_ROTATION_SECONDS` (900).
- El token solo se guarda como hash SHA-256; nunca en texto plano.

### Frontend (Next BFF)

- `POST /api/auth/login`, `/api/auth/session` y `/api/auth/logout` con chequeo CSRF (Origin/Referer/Sec-Fetch-Site contra `APP_BASE_URL`).
- Cookie `ghostinc_session` HTTP-only, SameSite=lax, Secure en HTTPS, Max-Age según límite absoluto.
- `getCurrentSession()` para Server Components: valida la sesión en el backend y devuelve el usuario; sin cookie o con sesión inválida devuelve `null`.
- `requireAdmin()` nativo sobre el rol `global_role` de PostgreSQL; redirige a login o `/acceso-denegado`.
- Página `/auth/login` con formulario email/contraseña (sin Auth0), `LogoutButton` que rota y revoca antes de cerrar.
- `dashboard/*`, `admin/*` y `/cuenta` migrados a identidad nativa; `error-de-acceso` enlaza al login propio.

### Retiro de Auth0

- Eliminados `src/proxy.ts` (middleware Auth0), `account-security.tsx` y usos de `auth0!.getSession()` en layouts, dashboard y admin.
- La dependencia y rutas de cuenta Auth0 se conservaron temporalmente; `IAM-008` las retiró después de validar el reemplazo nativo.

## Verificación ejecutada

- Backend: `npm run typecheck`, `npm run build` y `npm test` (66/66) sobre PostgreSQL de prueba.
- Nuevos tests de sesión: fijación (tokens distintos por login), expiración por inactividad y absoluta, rotación (el token anterior queda inválido), revocación por logout y bloqueo, rate limit, eventos de auditoría y rechazo de cuerpos extra.
- Frontend: `npm run typecheck`, `npm test` (47/47) y `npm run build`.
- Tests BFF: CSRF cross-origin y sin señal de origen, body estricto, mapeo de 401/429/502, cookie con HttpOnly/SameSite/Max-Age, rotación con renovación de cookie y limpieza al revocar.
- Integración con `docker compose up -d --build`:
  - Login vía BFF 200 con cookie opaca; cross-origin 403; credenciales inválidas 401.
  - `/dashboard` con sesión renderiza el usuario; sin sesión redirige a `/auth/login?returnTo=/dashboard`; `/admin` redirige con `returnTo`.
  - Rotación real: la cookie vieja devuelve 401 tras rotar y la nueva funciona.
  - Logout limpia la cookie y el dashboard vuelve a redirigir.
  - `/admin` y `/admin/users` funcionan con rol `admin` sobre identidad local.
- `docker compose config --quiet` y `compose.production.yaml config --quiet`: válidos.

## Notas

- La verificación E2E creó el usuario local `dev@ghostinc.cl` (contraseña `demo-password-2026`) en la base local para probar el flujo real; no es una cuenta de producción.
- La puerta TOTP para sesiones privilegiadas de admin queda para `IAM-007`/`IAM-008`; mientras tanto `requireAdmin` valida el rol en PostgreSQL.
- `checkSession` rota solo cuando el llamador puede reescribir la cookie (rutas BFF); los Server Components validan sin rotación, por lo que la rotación se aplica en login, logout y `/api/auth/session`.
