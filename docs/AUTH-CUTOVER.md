# Corte de identidad nativa

Este runbook conserva el procedimiento de migración y rollback de `IAM-008`. Fastify es la única autoridad de identidad; Auth0 no forma parte del runtime.

## Inventario

1. Exportar fuera de Git la lista mínima de correos que requieren invitación. No copiar identificadores, tokens, hashes ni secretos Auth0 al repositorio.
2. No crear usuarios ni asignar privilegios por coincidencia automática de email.
3. El primer administrador se crea una sola vez con `npm run bootstrap:admin`; el comando falla si ya existe un admin o la identidad objetivo existe.
4. Las demás cuentas se invitan desde `/admin/users`. Todas nacen con rol `user`; un admin con MFA reciente asigna roles posteriormente y cada cambio queda auditado.

## Validación previa

- Usuario común: invitación, creación de contraseña, login, recuperación y TOTP opcional.
- Administrador: login con contraseña, TOTP obligatorio y acceso a `/admin`.
- Administración: listado, invitación, bloqueo/desbloqueo, cambio de rol y revocación de sesiones.
- Negativas: usuario no admin rechazado, autobloqueo/autodemoción rechazados, tokens de invitación de un uso y recovery codes no reutilizables.

## Corte

1. Desplegar las imágenes inmutables que no contienen SDK ni rutas Auth0.
2. Confirmar que el manifiesto no consume variables `AUTH0_*` y que las rutas históricas responden `404`.
3. Validar los flujos nativos anteriores con cuentas de prueba del ambiente.
4. Eliminar `AUTH0_*` del archivo del host y de cualquier gestor de secretos del ambiente sin imprimir sus valores.
5. Revocar las aplicaciones web/M2M y credenciales en el tenant Auth0. Esta acción es humana y se registra fuera de Git.

## Rollback

Para el primer corte se registra como rollback el último digest con autenticación nativa, sesiones opacas y MFA administrativo ya validados (`IAM-007`). Ese artefacto se ejecuta sin variables `AUTH0_*`, por lo que sus rutas históricas fallan cerradas y no habilitan una segunda autoridad. Después de estabilizar `IAM-008`, todo rollback debe apuntar a un digest nativo sin Auth0.

Las migraciones de identidad nativa son aditivas, por lo que no se revierten ni se eliminan usuarios, contraseñas, sesiones o MFA. Después del rollback se repiten health checks, login común, login admin con MFA y recuperación. Si la identidad nativa sigue indisponible, se bloquea el acceso y se investiga; no se reactiva Auth0 de forma automática.
