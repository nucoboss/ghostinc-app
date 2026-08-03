# Mercado Pago Checkout Pro

Documento de continuidad para implementar la compra puntual de créditos con Mercado Pago Chile.

## Decisiones confirmadas

- Proveedor inicial: Mercado Pago Chile.
- Integración: Checkout Pro alojado, no Checkout API embebido.
- Moneda: CLP, con montos enteros y sin decimales.
- Modelo comercial inicial: paquetes prepagados; no hay suscripción ni recarga automática en el lanzamiento.
- Los créditos comprados se acumulan y no vencen.
- Un crédito permite solicitar una página válida de hasta 10 registros agregados, incluso cuando el resultado está vacío.
- Las futuras suscripciones serán para monitoreo, reportes y servicio humano, separadas del saldo API.

La comisión informada como referencia es 3,19% + IVA con disponibilidad inmediata o 2,89% + IVA con disponibilidad en 10 días. Debe confirmarse en la cuenta y no sustituye la definición tributaria de la venta.

## Decisiones pendientes

- Cantidad de créditos y precio definitivo de cada paquete.
- Tratamiento de IVA, boleta o factura y proveedor de documentos tributarios.
- Política de devolución cuando el cliente ya consumió parte de los créditos.
- Tratamiento de contracargos y saldo insuficiente para revertir créditos.
- Plazo de expiración de una preferencia de pago.

`BILL-001` permanece bloqueada hasta resolver precios, tributación y devoluciones.

## Arquitectura objetivo

```text
Usuario autenticado
  -> Next.js inicia compra
  -> backend crea orden pendiente en PostgreSQL
  -> backend POST /checkout/preferences
  -> navegador abre init_point
  -> usuario paga en Mercado Pago
  -> Mercado Pago POST webhook público al backend
  -> backend valida firma
  -> backend GET /v1/payments/{id}
  -> valida pago contra la orden
  -> acredita ledger y saldo en una transacción
  -> dashboard muestra el estado actualizado
```

La ruta de retorno del navegador solo informa el estado. Nunca acredita créditos. El webhook tampoco se considera prueba suficiente por sí mismo: después de validar su firma, el backend consulta el pago directamente a Mercado Pago.

El inicio de compra requiere una sesión local válida y debe llegar al backend por una ruta interna protegida. El webhook requiere una ruta pública y estrecha, por ejemplo `/webhooks/mercado-pago`, publicada explícitamente por Caddy sin exponer otras rutas internas.

## Creación de preferencia

Crear una preferencia por cada intento de compra mediante `POST /checkout/preferences`. El navegador solo envía el identificador del paquete; precio, moneda y créditos se obtienen desde PostgreSQL.

Campos mínimos previstos:

- `items[0].id`: código interno del paquete.
- `items[0].title`: nombre comercial del paquete.
- `items[0].quantity`: `1`.
- `items[0].currency_id`: `CLP`.
- `items[0].unit_price`: precio entero guardado en servidor.
- `external_reference`: ID interno de la orden, máximo 64 caracteres y solo letras, números, guiones o guiones bajos.
- `back_urls.success`, `back_urls.pending` y `back_urls.failure`: páginas HTTPS del dashboard.
- `auto_return`: `approved`.

Usar el `init_point` devuelto para iniciar Checkout Pro. La referencia actual indica no usar `sandbox_init_point` para las pruebas de integración.

Se recomienda configurar la URL y el evento `Payments` desde **Your integrations > Webhooks**, en vez de definir una URL distinta por preferencia. La URL de la preferencia tiene precedencia y solo debe usarse si existe una necesidad concreta.

## Validación del pago

Después de recibir una notificación `payment.created` o `payment.updated`, consultar `GET /v1/payments/{id}` y verificar como mínimo:

- `status` es `approved` antes de acreditar.
- `external_reference` corresponde a una orden pendiente del usuario.
- Importe y moneda coinciden exactamente con la copia inmutable de la orden.
- El pago pertenece a la cuenta receptora esperada.
- El paquete sigue correspondiendo a la copia de precio y créditos guardada al crear la orden.
- El ID de pago no fue procesado anteriormente.

Los valores de precio y créditos recibidos desde el navegador, metadata o descripciones de Mercado Pago nunca son autoridad. La orden interna conserva una copia de esos valores para que un cambio posterior del paquete no altere una compra en curso.

Estados pendientes, en proceso o rechazados no acreditan créditos. Un pago aprobado genera exactamente un movimiento inmutable en `credit_ledger`.

## Webhooks

Validar antes de procesar:

- Header `x-signature`.
- Header `x-request-id`.
- Query parameter `data.id`.
- HMAC-SHA256 con el secreto de webhooks y comparación en tiempo constante.

El SDK oficial de Node.js incluye `WebhookSignatureValidator`; debe evaluarse durante la implementación para evitar mantener una validación criptográfica propia.

El endpoint debe aceptar solo el evento esperado, limitar cuerpo y frecuencia, y no registrar headers secretos ni payloads personales. Tras validar la firma, la fuente de verdad es `GET /v1/payments/{id}` con el Access Token del backend.

Mercado Pago espera `200` o `201` en un máximo de 22 segundos y reintenta las notificaciones no confirmadas. Cada evento y cada pago deben procesarse de forma idempotente para que cualquier repetición sea segura.

Importante para pruebas: según la documentación actual, los pagos creados con credenciales de prueba no envían notificaciones. La recepción se prueba desde el simulador de **Your integrations > Webhooks**. `localhost` no puede recibir webhooks; usar staging HTTPS o un túnel temporal aprobado para desarrollo.

## Persistencia prevista

Agregar migraciones nuevas; no modificar migraciones aplicadas.

- `credit_packages`: código estable, nombre, créditos, precio CLP, estado y versión comercial.
- `payment_orders`: usuario, paquete, copia de precio/créditos, estado, referencia externa, preference ID y payment ID.
- `billing_events`: evento externo único, tipo, estado de procesamiento y timestamps, sin guardar secretos.
- `credit_ledger`: referencia única a la orden o pago que originó la acreditación o reversa.

La confirmación de pago debe bloquear la orden y, en una sola transacción, marcarla acreditada, insertar el movimiento del ledger y actualizar el saldo. Restricciones únicas sobre el ID de pago y la referencia del ledger constituyen la última defensa ante reintentos concurrentes.

Reembolsos y contracargos generan movimientos compensatorios; nunca editan ni eliminan movimientos anteriores.

## Endpoints de Mercado Pago

- `POST /checkout/preferences`: crear preferencia y obtener `init_point`.
- `GET /checkout/preferences/{id}`: consultar una preferencia.
- `GET /v1/payments/{id}`: verificar estado y detalle de un pago.
- `GET /merchant_orders/{id}`: conciliación avanzada si resulta necesaria.
- `POST /v1/payments/{id}/refunds`: reembolso total o parcial.
- `GET /v1/payments/{id}/refunds`: conciliación de reembolsos.
- `GET /v1/chargebacks/{id}`: consultar contracargos.

Base URL: `https://api.mercadopago.com`. Todas las llamadas privadas usan `Authorization: Bearer <ACCESS_TOKEN>` desde el backend.

## Secretos previstos

Durante la implementación se añadirán, como mínimo:

- `MERCADO_PAGO_ACCESS_TOKEN`: exclusivo del backend.
- `MERCADO_PAGO_WEBHOOK_SECRET`: exclusivo del backend.
- `MERCADO_PAGO_COLLECTOR_ID`: identificador esperado para validar el receptor del pago.

No agregar valores reales al repositorio, frontend, logs ni documentación. Mantener credenciales de prueba y producción separadas y cargar producción desde el mecanismo de secretos del despliegue.

## Orden de implementación

1. Resolver precios, tributación, devoluciones y contracargos.
2. Completar `SEC-001`, `SEC-002`, `IAM-002` y la propiedad individual de saldo/ledger requerida por `BILL-001`.
3. Crear migraciones para paquetes y órdenes de pago.
4. Añadir configuración validada y SDK oficial de Node.js al backend.
5. Implementar creación autenticada e idempotente de órdenes y preferencias.
6. Publicar únicamente el webhook y validar su firma.
7. Verificar pagos contra Mercado Pago y acreditar transaccionalmente.
8. Añadir páginas de retorno e historial en el dashboard.
9. Implementar reembolsos y conciliación.
10. Probar webhooks repetidos, reordenados, inválidos y concurrentes antes de habilitar producción.

## Criterios mínimos de salida

- El cliente no puede modificar precio, moneda ni créditos.
- Un pago aprobado acredita una sola vez aunque lleguen múltiples eventos.
- Un evento falso o con firma inválida no consulta ni modifica una orden.
- Estados no aprobados no acreditan.
- Reembolsos y contracargos conservan historial mediante compensaciones.
- El retorno del navegador no acredita.
- Access Token y secreto de webhook nunca llegan al navegador ni a logs.
- Existen pruebas automatizadas negativas y de concurrencia.
- La conciliación detecta pagos aprobados cuyo webhook no fue procesado.

## Referencias oficiales

- [Checkout Pro](https://www.mercadopago.cl/developers/es/docs/checkout-pro/overview.md)
- [Referencia de endpoints Checkout Pro](https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro/overview.md)
- [Crear preferencia](https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro/preferences/create-preference/post.md)
- [Notificaciones de pago](https://www.mercadopago.cl/developers/es/docs/checkout-pro/payment-notifications.md)
- [Referencia general](https://www.mercadopago.cl/developers/es/reference.md)
- [SDK oficial para Node.js](https://github.com/mercadopago/sdk-nodejs)
