# SEC-002: Validación estricta de API

Estado: `DONE` (verificado 2026-08-01)

## Objetivo

Eliminar validaciones implícitas y definir contratos estrictos para todas las rutas Fastify.

## Alcance

- Añadir esquemas de params, query, headers y respuestas.
- Limitar `limit`, `offset`, fechas, competencia, participación, estado, texto y tipo de causa.
- Rechazar propiedades desconocidas.
- Normalizar errores `400`, `401`, `402`, `404`, `429` y `5xx` sin filtrar detalles internos.
- Definir tipos compartidos sin duplicar contratos manualmente.
- Preparar generación OpenAPI, sin publicar documentación no revisada.
- Añadir límites de body y timeouts explícitos.

## Fuente autoritativa del contrato

El upstream es un servicio propio: `~/NUCO-Projects/api-causas-pjud` (`API.md`). Sus valores oficiales:

- `limit`: int 1–500 (default 50); `offset`: int >= 0.
- `participacion`: `ambas` | `demandante` | `demandado`.
- `competencia`: `laboral` | `civil` | `cobranza` | `penal`.
- `estado`: `abiertas` | `cerradas` o un estado específico (`Tramitación`, `Concluido`, etc.).
- `tipo_causa`: `O` | `M` | `E` | `I`.
- `fecha_desde`/`fecha_hasta`: `YYYY-MM-DD`; `include_abogados`: `true`|`false`; `q`: máx 200.
- Envelope de respuesta: `data.summary` + `data.causas[]` (no `data[]`).

## Implementación

- `backend/src/schemas/causas.ts`: esquemas JSON (params, query estricta con `additionalProperties: false`, headers de API key, respuestas de error) y tipo `PaidQuery` compartido.
- `backend/src/routes/causas.ts`: esquemas por ruta; la ruta gratuita sigue fijando `estado=abiertas`, `participacion=demandado`, `limit=10` e ignorando filtros externos (sin schema de query).
- `backend/src/app.ts`:
  - `setErrorHandler`: `400` validación → `{error:"invalid_request", details[]}`; `429` → `{error:"rate_limited"}`; `404` → `{error:"not_found"}`; `5xx` → `{error:"internal_error"}` con log del detalle solo en servidor. Sin stack, SQL, URLs ni credenciales en el cuerpo.
  - `setNotFoundHandler` para 404 con forma estable.
  - `ajv.customOptions.removeAdditional: false` (Fastify por defecto elimina props desconocidas; ahora se rechazan).
  - `bodyLimit: 4096`, `requestTimeout: 20 s` (mayor al timeout de PJUD de 15 s), `keepAliveTimeout: 5 s`.
- `backend/test/helpers/pjud-stub.ts`: envelope real (`data.summary`/`data.causas`) según `API.md`.

## Verificación (ejecutada 2026-08-01)

- `npm test`: 29/29 (2 ejecuciones consecutivas estables). Casos nuevos: 12 parámetros fuera de contrato rechazados con 400 sin consumir créditos ni llamar a PJUD; passthrough completo de parámetros válidos a PJUD; 404/429/5xx normalizados; header `x-api-key` corto → 400.
- `npm run typecheck`, `npm run build`: sin errores.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Smoke contra el servicio real local (`localhost:18080`): búsqueda gratuita devuelve envelope real; RUT inválido → 400; query fuera de contrato → 400; ruta inexistente → 404.
- Comportamientos preservados: `401 missing_api_key`, `402 invalid_key_or_balance`, `404/502 upstream_error`, compensación de créditos, deadlock retry, concurrencia 5×200/15×402.

## Notas

- Los esquemas JSON son la fuente de verdad preparada para generación OpenAPI; la publicación de documentación queda pendiente de revisión (ver `SRC-001`/`API-002`).
- La whitelist en `backend/src/services/pjud.ts` se conserva como defensa en profundidad (mismo set de parámetros).
- Documento de errores y contratos: `docs/API.md`.

## Entregables

- Esquemas y tipos compartidos (`backend/src/schemas/causas.ts`).
- Tests positivos y negativos (29 totales en backend).
- Documentación de errores (`docs/API.md`).
- Estados actualizados en `AGENT-TASKS.md` y `BACKLOG.md`.
