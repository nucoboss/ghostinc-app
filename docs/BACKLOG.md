# Backlog y pendientes

## Decisión de producto: alcance del MVP (2026-08-01)

El MVP consulta **causas vía PJUD por RUT o razón social jurídica** usando la API propia (`api-causas-pjud`), que ya está operativa y validada en local. La agregación multi-fuente (`SRC-001`, `API-002`) es **post-MVP** y no bloquea el lanzamiento. El resto del carril (cuenta, API keys, dashboard, pagos, despliegue OCI) se mantiene como está.

La capa gratuita (`APP-003`) está terminada: `/buscar` permite razón social solo para personas jurídicas y RUT para personas o empresas, con términos fuera de URLs/logs, token interno, rate limit y validación runtime end-to-end.

## Prioridad 0: antes de exponer producción

- [ ] Ejecutar la evaluación inicial OWASP SAMM descrita en `SECURITY-ROADMAP.md`.
- [x] Completar threat model y contratos de autenticación propia (`IAM-003`).
- [x] Implementar registro por email y contraseñas Argon2id con enlace de un solo uso (`IAM-005`).
- [x] Login con email/contraseña, sesiones opacas y BFF con límites, rotación y revocación (`IAM-006`).
- [ ] Implementar TOTP obligatorio para admin y opcional para usuarios.
- [ ] Migrar el esquema inicial a cuentas individuales vinculadas por `user_id` local.
- [ ] Reemplazar datos demo del dashboard por consultas reales y autorizadas.
- [x] Añadir esquemas estrictos de request y response a las rutas de causas Fastify (extender a futuras rutas al crearlas).
- [ ] Probar aislamiento entre cuentas y concurrencia de créditos.
- [ ] Mover secretos a OCI Vault o un mecanismo equivalente.
- [ ] Restringir OCI a rangos de Cloudflare y eliminar cualquier acceso público directo al origen.
- [ ] Configurar CSP, HSTS y headers finales en frontend y proxy.
- [ ] Automatizar backups cifrados y ejecutar una restauración de prueba.
- [ ] Configurar logs centralizados, métricas y alertas.
- [x] Incorporar una base automatizada de pruebas de frontend, backend e integración.
- [x] Validar PostgreSQL local, migraciones desde cero y restauración en una base separada.
- [x] Añadir esquema y primitivas de identidad local con Argon2id, sesiones opacas, cifrado TOTP y auditoría (`IAM-004`).
- [ ] Implementar un flujo seguro de variables y secretos para development, staging y production.
- [ ] Validar en staging OCI el mismo artefacto inmutable que se promoverá a producción.
- [ ] Revisar términos, privacidad, retención y tratamiento de datos judiciales.

## Prioridad 1: cuenta y API comercial

- [x] Implementar alta por enlace de correo y recuperación de contraseña (`IAM-005`).
- [x] Login con email/contraseña, sesiones opacas y administración local de usuarios (`IAM-006`).
- [ ] Implementar MFA TOTP obligatorio para admin y opcional para usuarios.
- [ ] Gestión real de cuenta individual y preferencias de seguridad.
- [ ] Crear, listar, rotar, expirar y revocar API keys.
- [ ] Mostrar la clave completa una sola vez.
- [ ] Añadir scopes e IP allowlist por clave.
- [ ] Implementar saldo, ledger y consumo real en dashboard.
- [ ] Definir precios y cantidad definitiva de créditos por paquete.
- [x] Elegir Mercado Pago Chile como proveedor inicial de pagos en CLP.
- [ ] Implementar checkout y webhooks firmados e idempotentes.
- [ ] Generar documentos tributarios e historial de pagos.
- [ ] Añadir alertas de saldo bajo; evaluar recarga automática después del lanzamiento.
- [ ] Conectar el playground a una sesión autenticada con límites propios.
- [ ] Agregar fuentes públicas complementarias y SQL conservando procedencia, frescura y deduplicación (post-MVP, `SRC-001`/`API-002`).
- [ ] Estabilizar el frontend sobre contratos y datos reales en móvil y escritorio.

## Prioridad 2: operación y experiencia

- [ ] Documentación OpenAPI pública y versionada.
- [ ] SDKs mínimos para Node.js y Python.
- [ ] Exportación CSV de consumo.
- [ ] Webhooks de eventos y alertas.
- [ ] Status page pública.
- [ ] Reportes y exportación PDF.
- [ ] Diseñar suscripción futura para monitoreo, reportes y servicio humano, separada de los créditos API.
- [ ] Filtros avanzados en el portal.
- [ ] Accesibilidad WCAG 2.2 AA y pruebas con teclado/lector.

## Decisiones pendientes

- Separar API keys de Resend para staging y producción cuando existan esos ambientes.
- Precios finales de los paquetes prepagados y tratamiento tributario.
- Política de devolución de compras de créditos sin vencimiento.
- Alcance y precio de la futura suscripción de monitoreo y reportes.
- Dominio definitivo para web y API.
- Repositorio GitHub, visibilidad de imágenes GHCR y estrategia de ambientes.
- Estrategia de backup, RPO y RTO.
- Requisitos legales y plazo de retención de telemetría.

## Completado

- [x] Frontend Next.js responsive.
- [x] Búsqueda gratuita conectada a PJUD mediante backend.
- [x] Filtros gratuitos impuestos por servidor.
- [x] Backend Fastify y PostgreSQL.
- [x] Hash HMAC de API keys.
- [x] Reserva y compensación de créditos.
- [x] Ledger, telemetría y esquema de billing.
- [x] Dockerfiles multi-stage con usuarios no privilegiados.
- [x] Compose local y producción.
- [x] Caddy, OCI y Cloudflare documentados.
- [x] CI/CD inicial con GitHub Actions y GHCR.
- [x] Panel administrativo protegido por rol `admin`.
- [x] Métricas internas de actividad y organizaciones.
- [x] Gestión Auth0 para listar, bloquear y desbloquear usuarios.
- [x] Integración Auth0 local validada y posteriormente reemplazada por decisión de autenticación propia del 2026-08-03.
- [x] Modelo comercial inicial definido como paquetes prepagados, acumulables y sin vencimiento.
- [x] Unidad de consumo definida como una página válida de hasta 10 resultados, incluidos cero resultados.
- [x] Arquitectura objetivo definida para agregar PJUD, scrapers y fuentes públicas almacenadas en SQL.
- [x] Política multifuente definida: fallos esenciales no cobran; fallos complementarios generan respuesta parcial facturable.

## Ejecución por agentes

Las tareas listas, dependencias y criterios verificables están en `AGENT-TASKS.md`. Un agente debe tomar únicamente tareas marcadas `READY`; las marcadas `BLOCKED` requieren primero una acción humana o una decisión de producto.

## Orden de ejecución acordado

Ruta principal de producto local:

1. `SEC-001`: base automatizada de pruebas. **DONE** (2026-08-01): backend 24/24 con `node:test`+tsx, frontend 9/9 con vitest, CI con `npm test`; hallazgo corregido: deadlock `40P01` en operaciones de crédito bajo concurrencia (retry con jitter en `backend/src/services/credits.ts`).
2. `DB-001`: PostgreSQL local y migraciones reproducibles. **DONE** (2026-08-01): migraciones idempotentes verificadas en base aislada `ghostinc_verify`, restricciones y backup/restauración demostrados; runbook en `docs/DATABASE.md`.
3. `SEC-002`: contratos y validación estricta de API. **DONE** (2026-08-01): esquemas JSON estrictos (query sin props desconocidas, enums y rangos según `API.md` del upstream propio), errores normalizados (400/401/402/404/429/5xx sin fugas), 29/29 tests, audit 0; contratos en `docs/API.md`.
4. `IAM-003` a `IAM-008`: autenticación propia, correo, sesiones, TOTP, administración local y retiro de Auth0.
5. `IAM-002` y `API-001`: aislamiento de cuentas y API keys sobre identidad local.
6. `APP-001` y `APP-002`: dashboard real y estabilización frontend.
7. `BILL-001`: Mercado Pago, solo después de resolver sus decisiones humanas.
8. Post-MVP: `SRC-001` (inventario) y `API-002` (agregación multi-fuente), sin bloquear el lanzamiento.

Ruta paralela de despliegue:

1. `SEC-003`: hardening de CI e imágenes. **DONE** (2026-08-03): commit raíz `1cbe13a` empujado a `main`; run `Build and deploy` 30830920036 con verify + publish success, imágenes multi-arch `amd64/arm64` firmadas con Cosign OIDC y SBOM SPDX por imagen; Trivy sin críticos; `deploy` omitido por diseño.
2. `SEC-004`: flujo seguro de variables, credenciales y secretos. **IN_PROGRESS** (2026-08-03): matriz en `docs/ENV-MATRIX.md`, flujo en `docs/SECRETS-FLOW.md`, guard `env-file-guard` en CI, secretos OCI movidos a Environment `production`; cierre pendiente de staging y credenciales OCI.
3. `DEP-001`: Compose y workflow OCI ARM64.
4. `OPS-002`: slot aislado de staging en OCI.
5. `OPS-001`: backups, restauración, observabilidad y runbooks.
6. `REL-001`: puerta de promoción a producción.

No se despliega públicamente la versión local incompleta. Staging comienza solo con artefactos ARM64 inmutables, secretos instalados por el flujo aprobado y rutas internas aisladas.
