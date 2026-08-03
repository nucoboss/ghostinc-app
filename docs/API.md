# API Ghostinc — contratos y errores

Contratos de la API expuesta por el backend (`backend/`). El upstream de datos es el servicio propio en `~/NUCO-Projects/api-causas-pjud`; los esquemas JSON en `backend/src/schemas/causas.ts` son la fuente de verdad (preparados para generación OpenAPI futura, aún no publicada).

## Endpoints

### `POST /api/causas` (BFF de búsqueda gratuita)

- Body estricto: `{ "kind": "company" | "rut", "query": string }`.
- `company`: 3–120 caracteres; upstream filtra obligatoriamente `persona='JURIDICA'`.
- `rut`: normalización y validación de dígito verificador; personas naturales solo por este modo.
- El BFF llama a `POST /internal/v1/causas/search` con `X-Internal-Token`; nunca se publica `/internal/*` por Caddy.
- Parámetros fijados por servidor (el cliente no puede sobreescribirlos): `estado=abiertas`, `participacion=demandado`, `limit=10`.
- El término viaja en body y no queda en URL, historial ni access logs.
- `POST /api/causas/sugerencias` acepta `{ "query": string }` y devuelve hasta 8 personas jurídicas con `nombre`, `rut` y `causas`; usa debounce/cancelación en el cliente y rate limit interno de 60/min.

### `GET /api/v1/causas/rut/:rut` (API comercial)

- Requiere `X-API-Key` (HMAC `pjud_...`).
- Query estricta (`additionalProperties: false`):

| Parámetro | Tipo / valores | Límites |
|---|---|---|
| `limit` | int | 1–500 |
| `offset` | int | >= 0 |
| `participacion` | enum | `ambas`, `demandante`, `demandado` |
| `competencia` | enum | `laboral`, `civil`, `cobranza`, `penal` |
| `estado` | string | 1–32 (ej. `abiertas`, `cerradas`, `Tramitación`) |
| `tipo_causa` | enum | `O`, `M`, `E`, `I` |
| `tribunal_id` | string | 1–64 |
| `q` | string | 1–200 |
| `fecha_desde` / `fecha_hasta` | date | `YYYY-MM-DD` |
| `include_abogados` | enum | `true`, `false` |

- Costo: 1 crédito por página válida de hasta 10 registros agregados (incluye cero resultados). Consultas inválidas y fallos esenciales del upstream: 0 créditos (con compensación).
- Respuesta exitosa (envelope del upstream): `data.summary` + `data.causas[]`.

## Errores normalizados

Toda respuesta de error usa `{ error: string, message: string, ... }`. Nunca incluyen stack, SQL, URLs internas ni credenciales.

| Código | `error` | Cuándo |
|---|---|---|
| 400 | `invalid_request` | Validación estricta falla; `details[]` con `field`, `keyword`, `message` |
| 400 | `invalid_rut` | RUT no válido |
| 401 | `missing_api_key` | Falta `X-API-Key` |
| 402 | `invalid_key_or_balance` | Credencial desconocida o sin créditos |
| 404 | `not_found` | Ruta inexistente |
| 404 | `upstream_error` | Upstream sin resultados |
| 429 | `rate_limited` | Límite de peticiones (gratuita: 20/min por IP; comercial: 120/min por API key) |
| 500 | `internal_error` | Error interno; detalle solo en logs del servidor |
| 502 | `upstream_error` | Fallo esencial del upstream |

## Límites de servidor

- `bodyLimit`: 4 KB; `requestTimeout`: 20 s (upstream: 15 s); `keepAliveTimeout`: 5 s.
- `X-Internal-Token` (comparación en tiempo constante) para `/internal/admin/*` y la búsqueda gratuita interna.
