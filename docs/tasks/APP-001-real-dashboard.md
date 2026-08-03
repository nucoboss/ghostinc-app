# APP-001: Dashboard con datos reales

Estado: `BLOCKED`

Dependencias: `IAM-002`, `API-001`.

## Objetivo

Eliminar métricas demostrativas del portal de clientes y conectarlo a datos autorizados de su cuenta individual.

## Alcance

- Resumen de saldo, consumo, errores y latencia.
- Actividad paginada sin exponer RUT completo.
- API keys reales.
- Ledger e historial de recargas.
- Exportación CSV autorizada.
- Estados vacíos y errores sin datos falsos.

## Criterios de aceptación

- No queda ninguna cifra demo en rutas autenticadas.
- Cada métrica se calcula para el usuario derivado de sesión.
- Paginación y exportación tienen límites.
- Logs y respuestas ocultan datos sensibles.

## Verificación

```bash
npm run typecheck
npm test
npm run build
```
