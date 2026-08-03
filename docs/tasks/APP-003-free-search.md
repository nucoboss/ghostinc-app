# APP-003: Búsqueda gratuita canónica y privada

Estado: `DONE` (verificado 2026-08-01).

## Objetivo

Publicar `/buscar` como ruta canónica y permitir consultas gratuitas por razón social de empresa o por RUT, manteniendo la búsqueda nominal de personas naturales deshabilitada.

## Implementación

- Nueva página `/buscar`; portada y navegación enlazan a esa ruta.
- Dos modos: `company` (razón social) y `rut` (persona o empresa).
- Autocompletado empresarial con debounce de 250 ms, cancelación de requests obsoletos y sugerencias de razón social, RUT y cantidad de causas. Variantes de nombre se limpian y deduplican por RUT.
- Migración upstream `c41e78f6a9d2` normaliza 2.849 nombres jurídicos (espacios repetidos y punto accidental separado al final); el importador aplica la misma regla para evitar reincidencia.
- El upstream `api-causas-pjud` agrega `GET /api/v1/causas/empresa/nombre`, siempre filtrado por `persona='JURIDICA'`; no acepta parámetros para incluir naturales.
- Migración upstream `7b9df2a86d11` agrega índice GIN trigram parcial para razones sociales jurídicas.
- Navegador y BFF usan `POST /api/causas`; el término no aparece en URL/historial/logs de proxy.
- BFF -> backend usa `POST /internal/v1/causas/search`, protegido con `X-Internal-Token` y body estricto.
- Rate limit gratuito: 20/min por IP de Cloudflare validada; `x-forwarded-for` del cliente no se confía.
- Logs Fastify contienen método, plantilla de ruta, status y latencia, nunca URL concreta ni payload. Uvicorn upstream desactiva access logs con parámetros sensibles.
- Payload PJUD validado en backend y BFF; respuesta incompleta/no JSON -> 502 estable.
- 404 upstream -> resultado vacío; carga nueva retira resultados anteriores; AbortController se cierra al desmontar; fechas inválidas no rompen render.

## Verificación

- Frontend: 27/27 tests, typecheck, build, audit 0.
- Backend: 34/34 tests, typecheck, build, audit 0.
- Upstream: 8/8 pytest, Ruff, Bandit y pip-audit (0 vulnerabilidades).
- Compose válido en ambos proyectos.
- Smoke real: `/buscar` 200; búsqueda jurídica 4 resultados; búsqueda por RUT 48 totales/10 mostrados.
- Caso de regresión: `SOCIEDAD CONTRACTUAL MINERA EL ABRA` quedó en un nombre único, RUT `96701340-4`, con 46 causas distintas. Backup previo local: `/tmp/opencode/api-pjud-before-name-normalization.dump`.
- Logs frontend/backend/upstream inspeccionados: sin RUT ni razón social consultada.

## Archivos principales

- `src/app/buscar/page.tsx`
- `src/components/search-form.tsx`
- `src/app/api/causas/route.ts`
- `src/lib/causas.ts`
- `backend/src/routes/causas.ts`
- `backend/src/lib/internal-auth.ts`
- `~/NUCO-Projects/api-causas-pjud/app/api/v1/endpoints/causas.py`
- `~/NUCO-Projects/api-causas-pjud/alembic/versions/7b9df2a86d11_add_company_name_search_index.py`
