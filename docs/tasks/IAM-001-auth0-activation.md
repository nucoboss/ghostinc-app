# IAM-001: Activar y validar tenant Auth0

Estado: `SUPERSEDED` (2026-08-03)

Decisión posterior: Auth0 se retira y se reemplaza por autenticación propia con email, contraseña, sesiones opacas, roles PostgreSQL y TOTP. La evidencia de esta tarea se conserva como historial, pero sus pendientes ya no deben ejecutarse.

## Objetivo

Activar los flujos ya implementados de registro, login, MFA y administración.

## Acción humana previa

- Crear aplicación Regular Web Application.
- Habilitar Google Social Connection.
- Crear aplicación M2M para Management API.
- Crear rol `admin` y asignarlo al primer operador.
- Entregar secretos mediante un canal seguro, nunca por chat o Git.

## Trabajo del agente después del desbloqueo

- Configurar variables locales y de OCI sin registrarlas en Git.
- Instalar la Action de roles y MFA descrita en `AUTH0.md`.
- Validar registro y login con Google.
- Validar usuario registrado en `/dashboard`.
- Validar administrador en `/admin` con MFA.
- Validar usuario sin rol en `/acceso-denegado`.
- Validar listado, bloqueo y desbloqueo desde Management API.

## Criterios de aceptación

- No existe acceso administrativo sin MFA y rol `admin`.
- Cookies de sesión son Secure, HTTP-only y SameSite apropiado en producción.
- Ningún secreto aparece en bundle, HTML o logs.
- Bloquear un usuario impide nuevos accesos.

## Verificación

Seguir íntegramente `docs/AUTH0.md` y registrar evidencia sin tokens ni datos personales.

Verificación automatizada local ejecutada el 2026-08-02:

- `/cuenta` responde correctamente y `/auth/login` inicia la autorización externa.
- `/dashboard` y `/admin` redirigen al login sin sesión.
- Typecheck, build y 30/30 pruebas frontend finalizan correctamente.
- Las variables requeridas están presentes, los clientes web y M2M son distintos, el claim de roles es el esperado y el secreto de sesión cumple la longitud requerida.
- Management API entrega token con `read:users`, `update:users` y `read:roles`; la lectura de usuarios y del rol `admin` responde correctamente.

Validación manual informada por el responsable del tenant el 2026-08-02:

- Aplicación web, URLs locales y Google Social Connection configurados.
- Registro/login con Google, callback y acceso autenticado comprobados.
- Actions de roles y MFA desplegadas y aplicadas.
- El rol `admin` quedó asignado únicamente a la identidad Google del operador; la identidad heredada de Database Connection quedó sin privilegios y bloqueada.
- Un inicio administrativo nuevo exigió enrolamiento TOTP y abrió `/admin` correctamente.
- Un usuario común desbloqueado inició sesión, accedió a `/dashboard` sin MFA administrativo y recibió acceso denegado en `/admin`.
- Un usuario de prueba bloqueado fue rechazado al intentar una sesión nueva desde incógnito. El callback genérico del SDK se reemplazó por `/error-de-acceso` para explicar el rechazo sin mostrar detalles internos.
- El acceso desde `/cuenta` fuerza `prompt=select_account` para evitar que la sesión SSO de Google elija silenciosamente la última identidad usada en el navegador.

Pendiente local:

- Habilitar Auth0 My Account API con `User-delegated Access: Per-app authorization`, mantener `Client Access` deshabilitado y autorizar los scopes mínimos documentados.
- Renovar la sesión del usuario común y validar enrolamiento, confirmación y eliminación de TOTP opcional desde `/dashboard/profile`.
- Revisar protecciones de ataque del tenant y revocación de una sesión activa.

Pendiente para staging o producción:

- Mantener Application Login URI vacío en local y configurarlo con `https://DOMINIO/cuenta` recién en staging o producción; Auth0 no acepta localhost HTTP en ese campo.
- Sustituir Auth0 Development Keys por credenciales OAuth Google propias antes de staging o producción.
- Confirmar cookies `Secure`, HTTP-only y SameSite sobre HTTPS y ejecutar la rotación controlada de secretos.
