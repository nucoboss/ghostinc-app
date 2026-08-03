# SRC-001: Inventario de fuentes públicas

Estado: `BLOCKED` — **post-MVP** (decisión de producto 2026-08-01: el MVP es fuente única PJUD).

Dependencia: `SEC-002` (completada 2026-08-01).

## Bloqueo humano pendiente

Para inventariar las fuentes complementarias se necesita la API de otras fuentes operativa y accesible para revisión (contrato, autenticación, límites, términos de uso). El dueño del repositorio `~/NUCO-Projects/api-causas-pjud` está ampliando/ajustando esa API; al quedar operativa y al retomarse la estrategia multi-fuente, se ejecuta `SRC-001` (cambiar estado a `READY` en `AGENT-TASKS.md` y validar la matriz con producto/seguridad/legal).

## Objetivo

Definir exactamente qué fuentes se integrarán, bajo qué contrato y con qué tratamiento antes de implementar la agregación comercial.

## Alcance

- Inventariar PJUD, tablas SQL primarias, servicios públicos y scrapers candidatos.
- Registrar propietario, URL oficial, autenticación, límites, disponibilidad y formato por fuente.
- Revisar términos de uso, tratamiento de datos, retención y restricciones de automatización.
- Clasificar cada fuente como esencial o complementaria con justificación.
- Definir campos, identificadores, procedencia, frescura y reglas preliminares de deduplicación.
- Definir timeout, reintentos, rate limit y comportamiento ante fallo por fuente.
- Crear fixtures sanitizados y contratos mock; no depender de servicios reales en CI.
- Dividir integraciones complejas en tareas por fuente antes de implementarlas.

## Criterios de aceptación

- Existe una matriz aprobada de fuentes sin credenciales ni datos personales.
- Cada fuente tiene autoridad de datos, criticidad y política de fallo explícitas.
- No queda ningún scraper autorizado solo por su accesibilidad técnica.
- Los contratos permiten implementar adaptadores sin inventar campos o semántica.
- Las decisiones legales o comerciales pendientes quedan registradas como bloqueos.

## Verificación

- Revisar la matriz con producto, seguridad y responsable legal.
- Validar fixtures contra los esquemas de `SEC-002`.
- Confirmar que ningún ejemplo contiene RUT completo, token o secreto real.
