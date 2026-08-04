# Auth0: autenticación, MFA y administración

> **Documento histórico retirado.** Auth0 fue reemplazado por autenticación propia mediante `IAM-003` a `IAM-008`. No usar este documento como guía operativa ni reactivar sus rutas, aplicaciones o secretos.

Auth0 Universal Login gestiona el registro con Google, login, MFA y sesiones. Ghostinc no recibe ni almacena contraseñas ni secretos TOTP.

El producto usa cuentas individuales. Clientes y administradores ingresan mediante el mismo `/auth/login`; el rol global `admin` existe únicamente para operadores de Ghostinc y se administra en Auth0.

## Flujo de acceso

```text
/cuenta
  -> /auth/login
  -> Auth0 Universal Login
  -> /auth/callback
  -> usuario convencional: /dashboard
  -> rol admin + TOTP: /admin
```

- `/dashboard/*` exige una sesión válida.
- `/dashboard/profile` permite administrar seguridad de la cuenta.
- `/admin/*` exige sesión, rol global `admin` y el MFA impuesto por el Login Flow.
- No existe un formulario ni credenciales administrativas separadas.

## Aplicación web

En Auth0 crea una aplicación `Regular Web Application`.

URLs locales:

- Allowed Callback URL: `http://localhost:3002/auth/callback`
- Allowed Logout URL: `http://localhost:3002`
- Allowed Web Origin: `http://localhost:3002`

Deja `Application Login URI` vacío en desarrollo: Auth0 exige HTTPS para ese campo. Inicia siempre el flujo desde `http://localhost:3002/cuenta`. Configura esa URI únicamente en staging o producción con una URL HTTPS, por ejemplo `https://DOMINIO/cuenta`.

URLs de producción:

- Allowed Callback URL: `https://DOMINIO/auth/callback`
- Allowed Logout URL: `https://DOMINIO`
- Allowed Web Origin: `https://DOMINIO`

Configura `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` y `AUTH0_SECRET`. El dominio no lleva `https://`. Genera el secreto de sesión con:

```bash
openssl rand -hex 32
```

## Método de registro del MVP

El MVP habilita una conexión para la aplicación web:

- Google Social Connection, normalmente `google-oauth2`.

Configura el nombre real mediante `AUTH0_GOOGLE_CONNECTION` si difiere del valor predeterminado. El registro con correo y contraseña mediante Database Connection queda fuera del MVP y podrá habilitarse en una tarea futura.

Las Auth0 Development Keys de Google sirven únicamente para desarrollo. Antes de staging o producción configura en la conexión Google un OAuth Client ID y Client Secret propios, con los redirect URI indicados por Auth0; no almacenes esos valores en Git ni en el frontend.

La página `/cuenta` ofrece un único ingreso para usuarios y administradores, además de registro con Google. La recuperación de credenciales ocurre directamente con Google.

## Rol administrador

1. Crea el rol `admin` en Auth0.
2. Crea el primer usuario desde Auth0 Dashboard.
3. Asigna el rol `admin` únicamente a operadores autorizados.
4. No uses una lista de correos como sustituto de RBAC.

## Login Flow

Usa dos Actions `Login / Post Login` separadas y desplegadas. El grafo debe quedar:

```text
Start
  -> Ghostinc add roles claim
  -> Ghostinc admin MFA
  -> Complete
```

### Claim de roles

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://ghostinc.cl";
  if (event.authorization) {
    api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization.roles);
  }
};
```

`AUTH0_ROLES_CLAIM` debe ser exactamente `https://ghostinc.cl/roles`.

### MFA administrativo

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const roles = event.authorization?.roles ?? [];
  if (roles.includes("admin")) {
    api.multifactor.enable("google-authenticator", {
      allowRememberBrowser: false
    });
  }
};
```

Después de crear o modificar una Action hay que ejecutar **Deploy**, añadirla al trigger `post-login` y ejecutar **Apply**. Una Action visible en Library pero no aplicada al grafo no se ejecuta.

## MFA

Activa `One-time Password` en el tenant y exige TOTP a administradores mediante la Action. No habilites SMS como alternativa administrativa ni configures MFA obligatorio a nivel tenant, porque para clientes es opcional.

El primer login administrativo muestra un QR. Debe escanearse desde Contraseñas de iOS o una aplicación Authenticator, no desde la cámara normal. Si se asocia al registro incorrecto, restablece MFA desde el usuario en Auth0 y repite el enrolamiento.

Configura protección contra credenciales filtradas, detección de ataques y límites de intentos en Auth0.

### MFA opcional de clientes

Activa `Auth0 My Account API`, deja Client Access deshabilitado y configura `User-delegated Access` como `Per-app authorization`. Autoriza únicamente la Regular Web Application con:

- `read:me:authentication_methods`
- `create:me:authentication_methods`
- `delete:me:authentication_methods`
- `read:me:factors`

El portal solicita audience `https://AUTH0_DOMAIN/me/` y `offline_access`. Un usuario puede listar, enrolar, confirmar y eliminar su TOTP desde `/dashboard/profile`. La respuesta de enrolamiento contiene temporalmente el QR y código manual en el navegador; Ghostinc no los persiste ni registra.

Los administradores no pueden eliminar su MFA desde el portal. Deben usar el procedimiento controlado de reset en Auth0.

## Management API

Crea una segunda aplicación `Machine to Machine` para Auth0 Management API.

Permisos mínimos:

- `read:users`
- `update:users`
- `read:roles`

Configura `AUTH0_MANAGEMENT_CLIENT_ID` y `AUTH0_MANAGEMENT_CLIENT_SECRET`. No reutilices el cliente de la aplicación web.

El panel permite listar, bloquear y desbloquear usuarios, y consultar el rol administrativo. No permite borrar identidades ni cambiar roles para reducir el impacto de una sesión administrativa comprometida.

La autorización administrativa consulta primero `AUTH0_ROLES_CLAIM`. Si el claim no está disponible, verifica por `sub` la asignación vigente mediante Management API. Nunca usa una lista de correos.

## Comportamiento seguro

- Sin variables Auth0, `/admin` permanece bloqueado.
- Sin sesión, `/admin` redirige a Universal Login.
- Sin rol `admin`, redirige a `/acceso-denegado`.
- Cada página y Server Action valida el rol en servidor. Si el claim de sesión no está disponible, consulta la asignación del rol mediante Management API y falla cerrado si Auth0 no responde.
- La sesión usa cookies HTTP-only administradas por el SDK.
- La sesión absoluta dura 8 horas y expira tras 30 minutos de inactividad.
- Las operaciones de usuarios ocurren en servidor mediante credenciales M2M.
- My Account API opera con un token delegado del usuario; nunca usa las credenciales M2M.

## Desarrollo local

Compose sirve el frontend en `http://localhost:3002`. Usa siempre `localhost`, sin `www`, `.com` ni `127.0.0.1`, para conservar cookies y `state` OAuth en el mismo origen.

Después de cambiar audience, scopes, Actions o permisos, cierra la sesión e inicia un flujo nuevo. No reutilices callbacks ni el botón Atrás: `state` es de un solo uso.

El navegador mantiene dos sesiones distintas: la cookie de Ghostinc/Auth0 y la sesión propia de Google. Cerrar Ghostinc no elimina las credenciales ni necesariamente cierra Google. Por eso `/cuenta` inicia Google con `prompt=select_account`, de modo que una sesión previa no seleccione silenciosamente la última identidad usada. En equipos compartidos, además hay que cerrar la sesión de Google o usar una ventana privada nueva.

El Compose local fuerza IPv4 y DNS públicos para evitar timeouts observados entre Docker, el resolver del router y los endpoints de Auth0. Producción no depende de este ajuste local.

Errores frecuentes:

- `Callback URL mismatch`: falta guardar `http://localhost:3002/auth/callback` en Allowed Callback URLs.
- `The state parameter is invalid`: callback antiguo, origen diferente o cookie de transacción ausente.
- Advertencia por acceso directo a Universal Login: no abras el dominio Auth0 manualmente; con `Application Login URI` vacío en local, inicia desde `http://localhost:3002/cuenta`.
- Se abre la última cuenta Google: iniciar desde `/cuenta` con “Ingresar o cambiar cuenta”; no reutilizar una pestaña que conserve un flujo OAuth anterior.
- `fetch failed` o timeout: revisar logs del frontend y conectividad DNS de Docker.
- `/admin` devuelve acceso denegado: comprobar rol `admin`, Deploy y Apply del Login Flow, y scopes M2M.
- My Account API solicita renovar acceso: cerrar sesión e ingresar nuevamente para emitir el token con audience `/me/`.

## Validación previa a producción

- Probar registro con Google, login, logout y callback.
- Probar usuario sin rol.
- Probar administrador con MFA.
- Probar enrolamiento y eliminación TOTP de un cliente convencional.
- Probar que un administrador no pueda eliminar su TOTP desde el portal.
- Probar bloqueo y desbloqueo.
- Revocar una sesión y verificar su cierre.
- Rotar ambos client secrets y `AUTH0_SECRET` mediante un procedimiento controlado.
- Confirmar que ningún secreto aparece en HTML, logs o bundles del navegador.
