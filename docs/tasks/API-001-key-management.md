# API-001: Ciclo de vida de API keys

Estado: `BLOCKED`

Dependencias: `IAM-002`, `SEC-002`.

## Objetivo

Reemplazar los placeholders de `/dashboard/keys` por gestión real y segura de credenciales comerciales.

## Alcance

- Crear API key con entropía criptográfica.
- Mostrar la clave completa una sola vez.
- Listar solo prefijo, últimos cuatro caracteres, estado y último uso.
- Rotar, expirar y revocar.
- Añadir scopes y allowlist opcional de IP.
- Limitar cantidad de claves por usuario y plan.
- Auditar actor, fecha y operación.
- Impedir que el operador admin vea claves completas existentes.

## Criterios de aceptación

- La base almacena únicamente HMAC.
- Una clave revocada deja de funcionar inmediatamente.
- Rotación permite una ventana explícita y acotada si el producto la requiere.
- Todas las operaciones validan el usuario propietario derivado de sesión.

## Verificación

```bash
npm test
cd backend
npm test
npm run build
```
