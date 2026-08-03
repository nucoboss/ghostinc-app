# Cola de tareas para agentes

Este documento es la fuente de ejecución. `BACKLOG.md` conserva la visión de producto; cada archivo bajo `docs/tasks/` define una unidad de trabajo cerrada.

## Protocolo del agente

1. Seleccionar la primera tarea `READY` del carril principal cuyas dependencias estén completas. El carril de despliegue puede avanzar en paralelo si no modifica los mismos archivos.
2. Leer `ARCHITECTURE.md`, `SECURITY-ROADMAP.md` y el archivo de la tarea.
3. No inventar credenciales, precios, políticas legales ni servicios externos.
4. No marcar una tarea completa sin ejecutar todos sus comandos de verificación.
5. Actualizar el estado de esta tabla y la sección afectada de `BACKLOG.md`.
6. Documentar cualquier migración, variable de entorno o decisión nueva.
7. No reducir controles de autenticación, autorización o aislamiento para facilitar una demo.

## Estados

- `READY`: puede ejecutarse con el repositorio actual.
- `BLOCKED`: requiere una tarea, credencial o decisión previa.
- `IN_PROGRESS`: un agente la está ejecutando.
- `DONE`: criterios y verificación completos.
- `SUPERSEDED`: una decisión posterior reemplazó la tarea; no debe ejecutarse.

## Ruta principal: producto local (MVP: fuente única PJUD)

Decisión de producto (2026-08-01): el MVP consulta PJUD por RUT o razón social jurídica usando la API propia `api-causas-pjud`. La agregación multi-fuente (`SRC-001`, `API-002`) queda **post-MVP** y no bloquea el lanzamiento.

| Orden | ID | Estado | Tarea | Dependencias |
|---:|---|---|---|---|
| 1 | SEC-001 | DONE | [Base automatizada de pruebas](tasks/SEC-001-tests.md) | Ninguna |
| 2 | DB-001 | DONE | [PostgreSQL local reproducible](tasks/DB-001-local-database.md) | Ninguna; ejecutar después de SEC-001 por orden acordado |
| 3 | SEC-002 | DONE | [Validación estricta de API](tasks/SEC-002-api-validation.md) | SEC-001 |
| 4 | APP-003 | DONE | [Búsqueda gratuita canónica y privada](tasks/APP-003-free-search.md) | SEC-001, SEC-002 |
| 5 | IAM-001 | SUPERSEDED | [Activar y validar tenant Auth0](tasks/IAM-001-auth0-activation.md) | Reemplazada por autenticación propia el 2026-08-03 |
| 6 | IAM-003 | DONE | [Diseño de autenticación propia](tasks/IAM-003-native-auth-design.md) | SEC-001, SEC-002 |
| 7 | IAM-004 | DONE | [Identidad local y primitivas criptográficas](tasks/IAM-004-local-identity.md) | IAM-003 |
| 8 | IAM-005 | DONE | [Registro y recuperación por correo](tasks/IAM-005-email-auth.md) | IAM-004; cuenta y dominio remitente Resend |
| 9 | IAM-006 | DONE | [Login, sesiones y BFF](tasks/IAM-006-sessions.md) | IAM-004 |
| 10 | IAM-007 | BLOCKED | [TOTP y códigos de recuperación](tasks/IAM-007-totp.md) | IAM-006, SEC-004 |
| 11 | IAM-008 | BLOCKED | [Administración local y retiro de Auth0](tasks/IAM-008-auth0-cutover.md) | IAM-005, IAM-006, IAM-007 |
| 12 | IAM-002 | BLOCKED | [Sincronización y aislamiento de cuentas](tasks/IAM-002-multitenancy.md) | IAM-008, SEC-001 |
| 13 | API-001 | BLOCKED | [Ciclo de vida de API keys](tasks/API-001-key-management.md) | IAM-002, SEC-002 |
| 14 | APP-001 | BLOCKED | [Dashboard con datos reales](tasks/APP-001-real-dashboard.md) | IAM-002, API-001 |
| 15 | APP-002 | BLOCKED | [Estabilización del frontend](tasks/APP-002-frontend-stabilization.md) | APP-001 |
| 16 | BILL-001 | BLOCKED | [Pagos y créditos](tasks/BILL-001-payments.md) | IAM-002, APP-001 y decisiones humanas |
| 17 | SRC-001 | BLOCKED | [Inventario de fuentes públicas](tasks/SRC-001-public-sources-inventory.md) | Post-MVP; SEC-002; espera API de otras fuentes operativa (humano) |
| 18 | API-002 | BLOCKED | [Agregación de fuentes públicas](tasks/API-002-multisource-aggregation.md) | Post-MVP; SEC-001, SEC-002, DB-001, SRC-001 |

## Ruta paralela: despliegue y OCI

Esta ruta puede avanzar después de `SEC-001` mientras continúa el producto local. No autoriza una salida pública hasta completar la puerta `REL-001`.

| Orden | ID | Estado | Tarea | Dependencias |
|---:|---|---|---|---|
| 1 | SEC-003 | BLOCKED | [Hardening de CI y contenedores](tasks/SEC-003-supply-chain.md) | Repo conectado y cambios staged; falta commit/push autorizado y validar CI/GHCR/OIDC |
| 2 | SEC-004 | BLOCKED | [Flujo seguro de variables y secretos](tasks/SEC-004-secrets-flow.md) | SEC-003 |
| 3 | DEP-001 | BLOCKED | [Artefactos de despliegue OCI ARM64](tasks/DEP-001-oci-deployment.md) | SEC-003, SEC-004 |
| 4 | OPS-002 | BLOCKED | [Slot de staging en OCI](tasks/OPS-002-oci-staging.md) | DEP-001, dominio y credenciales de staging |
| 5 | OPS-001 | BLOCKED | [Backups y observabilidad OCI](tasks/OPS-001-operations.md) | OPS-002, definición humana de RPO/RTO |
| 6 | REL-001 | BLOCKED | [Puerta de salida a producción](tasks/REL-001-production-gate.md) | APP-002, BILL-001, OPS-001, OPS-002, controles P0 |

## Secuencia acordada (MVP)

1. `SEC-001`, `DB-001` y `SEC-002` completadas (base de pruebas, DB reproducible y contratos estrictos).
2. Sustituir Auth0 mediante `IAM-003` a `IAM-008`; continuar con aislamiento de cuentas (`IAM-002`), ciclo de vida de API keys (`API-001`) y dashboard real (`APP-001`).
3. Estabilizar el frontend con `APP-002`.
4. Ejecutar `BILL-001` solo después de resolver precios, tributación y devoluciones.
5. En paralelo, avanzar el carril OCI: `SEC-003`, `SEC-004`, `DEP-001`, luego staging (`OPS-002`), backup/restauración (`OPS-001`) y promoción únicamente mediante `REL-001`.
6. Post-MVP: multi-fuente con `SRC-001` y `API-002`.
