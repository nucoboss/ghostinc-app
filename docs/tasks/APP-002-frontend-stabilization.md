# APP-002: Estabilización del frontend

Estado: `BLOCKED`

Dependencia: `APP-001`.

## Objetivo

Corregir y cerrar la experiencia frontend sobre contratos y datos reales antes de integrar pagos y desplegar staging.

## Alcance

- Inventariar y corregir defectos reproducibles en escritorio y móvil.
- Eliminar datos demostrativos, acciones sin efecto y estados incoherentes.
- Cubrir carga, vacío, error, sesión expirada, saldo insuficiente y proveedor no disponible.
- Comunicar con claridad el alcance y los filtros de la consulta PJUD del MVP.
- Revisar navegación por teclado, foco, etiquetas y contraste de los flujos principales.
- Mantener login y logout mediante navegación normal a `/auth/*`.
- Añadir pruebas de componentes y flujos críticos sin depender de servicios reales.

## Criterios de aceptación

- Inicio, búsqueda, cuenta y dashboard funcionan en móvil y escritorio.
- Ninguna vista autenticada presenta cifras o resultados ficticios.
- Los errores no filtran detalles internos y permiten recuperación.
- Los errores de proveedor distinguen una indisponibilidad temporal de una consulta sin resultados.
- Typecheck, tests y build finalizan correctamente.

## Verificación

```bash
npm run typecheck
npm test
npm run build
```
