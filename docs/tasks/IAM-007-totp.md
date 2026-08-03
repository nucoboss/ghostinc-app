# IAM-007: TOTP y códigos de recuperación

Estado: `BLOCKED`

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
