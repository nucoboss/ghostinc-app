# API-002: Agregación de fuentes públicas

Estado: `BLOCKED` — **post-MVP** (decisión de producto 2026-08-01: el MVP es fuente única PJUD vía `api-causas-pjud`).

Dependencias: `SEC-001`, `SEC-002`, `DB-001`, `SRC-001`.

## Objetivo

Implementar la API comercial que agrega PJUD, fuentes públicas complementarias y datos SQL sin perder procedencia, frescura ni consistencia de cobro.

## Alcance

- Definir un adaptador aislado por fuente con timeout, límites y errores tipados.
- Tratar PJUD y SQL primario como fuentes esenciales; las demás fuentes son complementarias.
- Normalizar registros conservando fuente, identificador original y fecha de obtención.
- Deduplicar con reglas deterministas y trazables.
- Paginar hasta 10 resultados agregados por crédito, incluidos cero resultados.
- No cobrar solicitudes inválidas ni fallos de fuentes esenciales.
- Entregar respuesta parcial facturable cuando solo falla una fuente complementaria.
- Hacer idempotentes los reintentos y preservar movimientos compensatorios del ledger.
- Persistir solo los datos permitidos y redactar RUT completos en logs y telemetría.

## Restricciones

- La búsqueda gratuita continúa limitada a PJUD y a sus filtros fijos actuales.
- No hacer scraping sin revisar términos, límites y tratamiento de datos de cada fuente.
- No mezclar credenciales ni lógica de transporte entre adaptadores.
- No atribuir a una fuente datos obtenidos desde otra.

## Criterios de aceptación

- Cada resultado informa procedencia y frescura.
- La deduplicación produce el mismo resultado ante el mismo conjunto de entradas.
- Fallar PJUD o SQL primario cuesta cero créditos.
- Fallar una fuente complementaria devuelve una respuesta parcial marcada y cobra como máximo una vez.
- Tests cubren cero resultados, más de 10 resultados, duplicados, timeout e idempotencia.

## Verificación

```bash
npm test
cd backend
npm run typecheck
npm test
npm run build
```
