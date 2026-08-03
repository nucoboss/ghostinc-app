# IAM-002: Sincronización y aislamiento de cuentas individuales

Estado: `BLOCKED`

Dependencias: `IAM-008`, `SEC-001`.

## Objetivo

Conectar las identidades locales con cuentas individuales sin depender de datos enviados por el navegador. El único rol global es `admin` para operadores de Ghostinc.

## Alcance

- Usar el `user_id` de la sesión local validada como identidad canónica.
- Asociar API keys, créditos, consumo y facturación directamente al usuario.
- Migrar o retirar `organizations` y `memberships` mediante nuevas migraciones.
- Crear helpers de autorización reutilizables.
- Exigir `user_id` derivado del `sub` autenticado en consultas del portal.
- Añadir auditoría de cambios sensibles de cuenta.
- Probar aislamiento entre dos usuarios.

## Criterios de aceptación

- Un usuario nunca puede seleccionar otra identidad mediante parámetros.
- Ninguna consulta devuelve datos, claves, créditos o pagos de otro usuario.
- El rol global `admin` se almacena en PostgreSQL, se administra mediante operaciones auditadas y exige MFA.
- Tests negativos cubren lectura y escritura cruzadas entre usuarios.

## Verificación

```bash
npm test
cd backend
npm test
npm run typecheck
```
