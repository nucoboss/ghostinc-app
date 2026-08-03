# BILL-001: Pagos y créditos

Estado: `BLOCKED`

Dependencias: `IAM-002`, `APP-001`.

Bloqueos humanos: precios definitivos, política de devolución y requisitos tributarios.

## Objetivo

Implementar compra de créditos sin permitir duplicación, fraude ni inconsistencias de saldo.

El diseño de continuidad, endpoints y controles está en [`docs/MERCADO-PAGO.md`](../MERCADO-PAGO.md).

## Decisiones confirmadas

- Mercado Pago Chile como proveedor inicial y CLP como moneda.
- Prepago mediante paquetes de créditos; no habrá suscripción en esta fase.
- Los créditos comprados son acumulables y no vencen: solo disminuyen al usarse.
- Un crédito financia una página válida de hasta 10 registros del servicio disponible en el MVP.
- Una página sin resultados consume un crédito; una solicitud inválida o que no puede completarse no lo consume.
- Cada página adicional consume otro crédito y un reintento idempotente no duplica el cargo.
- Si PJUD no permite completar la consulta, no se entregan resultados y se compensa el crédito.
- Las futuras suscripciones corresponderán a monitoreo, reportes y servicio humano, fuera del alcance de este hito.

## Decisiones humanas pendientes

- Precios y cantidad definitiva de créditos por paquete.
- Impuestos y documentos tributarios.
- Política de devolución de compras.

## Alcance posterior

- Checkout alojado por el proveedor cuando sea posible.
- Webhooks firmados, idempotentes y tolerantes a reintentos.
- Conciliación entre pagos, ledger y saldo.
- Estados pendientes, pagados, fallidos y reembolsados.
- Recarga automática con límites configurables.
- Auditoría y alertas de fraude.
- Compra única sin recarga automática en el lanzamiento; la recarga por saldo mínimo queda como evolución posterior.

## Criterios de aceptación

- Repetir un webhook no duplica créditos.
- Solo un evento confirmado acredita saldo.
- Un reembolso genera movimiento compensatorio, nunca edición del ledger.
- Tests cubren reordenamiento y retraso de eventos.

## Verificación

Usar sandbox oficial del proveedor y una suite de webhooks firmados. No probar con tarjetas reales en CI.
