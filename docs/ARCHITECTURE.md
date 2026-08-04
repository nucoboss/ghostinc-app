# Arquitectura

## Componentes

### Frontend

Next.js sirve la aplicación pública, la página canónica `/buscar`, el portal API y un BFF en `/api/causas`. El BFF recibe por POST una consulta `rut` o `company`, la valida y llama a la ruta gratuita interna del backend. Esto evita exponer el término consultado en URLs, la URL interna o las credenciales del proveedor.

### Backend

Fastify concentra reglas de negocio, validación, rate limiting, consumo de créditos, acceso a PostgreSQL y agregación de fuentes públicas. PJUD es la primera fuente, no el límite del producto.

La API comercial objetivo combinará adaptadores de tres tipos:

- PJUD y otras APIs públicas.
- Scrapers aislados por fuente, con timeout y límites propios.
- Datos públicos previamente normalizados en tablas SQL.

Cada adaptador transforma su respuesta a contratos internos versionados. La capa de agregación conserva la procedencia y fecha de obtención, normaliza campos y elimina duplicados antes de paginar. Una fuente externa se trata siempre como entrada no confiable; sus errores y payloads no se exponen directamente al cliente.

Las fuentes se clasifican por contrato:

- Esenciales: PJUD y las tablas SQL principales. Todas deben responder para que la consulta sea facturable.
- Complementarias: scrapers y servicios públicos de menor disponibilidad. Su fallo no invalida el núcleo de la respuesta.

Si falla una fuente esencial, el backend no entrega resultados, devuelve un error temporal y compensa el crédito reservado. Si solo falla una fuente complementaria, entrega una respuesta parcial, consume el crédito e informa el estado de cada fuente sin revelar errores internos. Puede utilizarse una copia reciente indicando `stale` y su fecha de obtención.

### Identidad y administración

Decisión del 2026-08-03: Ghostinc reemplazó Auth0 por autenticación propia. Fastify es la autoridad de identidad y el único componente con acceso a credenciales, sesiones, roles y MFA en PostgreSQL. Next.js actúa como BFF: recibe formularios, llama rutas internas con el token de servicio y maneja una cookie de sesión opaca HTTP-only; nunca almacena contraseñas ni consulta directamente las tablas de autenticación.

El alta comienza con un correo y un enlace de un solo uso para crear contraseña. El login posterior usa email y contraseña. El rol global `admin` se almacena en PostgreSQL y exige TOTP antes de obtener una sesión privilegiada; usuarios comunes pueden habilitar TOTP opcional. Contraseñas usan Argon2id, tokens y sesiones se guardan solo como hashes, y secretos TOTP se cifran con una clave externa a la base.

Las rutas de autenticación de Fastify permanecen bajo `/internal/auth/*` y nunca se publican por Caddy. El frontend consulta además métricas mediante `/internal/admin/*` usando un token de servicio independiente.

Rutas relevantes:

- `GET /health/live`: proceso activo.
- `GET /health/ready`: backend y PostgreSQL disponibles.
- `POST /internal/v1/causas/search`: búsqueda gratuita por RUT o razón social para el BFF; requiere `X-Internal-Token`.
- `GET /api/v1/causas/rut/:rut`: API comercial con `X-API-Key`.

La ruta interna no se publica mediante Caddy en producción.

### PostgreSQL

El producto comercial usa cuentas individuales: cada usuario local corresponde a un cliente y es dueño de sus API keys, créditos, consumo y facturación. El rol global `admin` se reserva a operadores de Ghostinc; no existen roles, equipos ni membresías entre clientes.

Las tablas `organizations` y `memberships` fueron retiradas por `IAM-002`: cada usuario local es dueño directo de sus API keys, créditos, consumo y facturación (`user_id` como identidad canónica derivada de la sesión, nunca de parámetros).

El esquema actual contiene:

- `users`: identidad local con contraseña, estado, rol global, saldo de créditos y auditoría nativa.
- `api_keys`: hash HMAC, prefijo, últimos caracteres y ciclo de vida, vinculadas a un usuario.
- `credit_ledger`: movimientos inmutables de créditos por usuario.
- `api_requests`: telemetría comercial sin almacenar el RUT, por usuario.
- `billing_events`: eventos idempotentes de Mercado Pago y su estado de procesamiento, por usuario.
- `schema_migrations`: migraciones aplicadas.

### Caddy y Cloudflare

Cloudflare actúa como proxy público. Caddy termina TLS en OCI y es el único contenedor con puertos públicos.

- `/api/v1/*` se dirige al backend.
- `/health/*` se dirige al backend.
- El resto se dirige al frontend.

PostgreSQL, backend y frontend se comunican por la red privada de Compose.

## Flujo gratuito

```text
Navegador
  -> Next.js POST /api/causas {kind, query}
  -> Backend POST /internal/v1/causas/search (token interno)
  -> PJUD por RUT o por nombre jurídico
     estado=abiertas&participacion=demandado&limit=10
  -> Next.js
  -> Navegador
```

El backend no acepta filtros del cliente y aplica siempre las condiciones gratuitas. La búsqueda por nombre se ejecuta únicamente sobre registros upstream con `persona='JURIDICA'`; las personas naturales solo pueden consultarse por RUT.

## Flujo comercial

La API comercial entrega una página lógica de hasta 10 registros normalizados por solicitud. Una página válida consume un crédito incluso cuando no encuentra registros: confirmar que no existen resultados también es el resultado del servicio y evita búsquedas masivas gratuitas. Los RUT inválidos, errores internos y fallos que impiden completar la consulta no consumen créditos. Cada página adicional requiere una nueva solicitud y un nuevo crédito; la API no entrega una cantidad ilimitada de registros en una sola respuesta.

```text
Cliente API
  -> Cloudflare
  -> Caddy /api/v1/*
  -> Backend
  -> valida API key
  -> reserva 1 crédito en PostgreSQL
  -> consulta PJUD, fuentes públicas y tablas SQL
  -> normaliza, atribuye, deduplica y pagina hasta 10 registros
  -> registra telemetría
  -> responde al cliente
```

Si una fuente esencial falla, el backend devuelve el crédito mediante un movimiento compensatorio. El fallo de una fuente complementaria produce una respuesta parcial facturable. Un reintento idempotente no puede producir un segundo cargo. La clave completa no se almacena; se compara un HMAC calculado con `API_KEY_PEPPER`.

La búsqueda gratuita permanece limitada a PJUD, con los filtros y el límite actuales, hasta que exista una decisión explícita para ampliar su alcance.

## Límites de confianza

- Internet a Cloudflare: tráfico no confiable.
- Cloudflare a Caddy: restringir por firewall a rangos Cloudflare.
- Caddy a frontend/backend: red privada de Compose.
- Frontend a backend interno: requiere token de servicio aun dentro de la red privada; el backend no tiene puerto público.
- Backend a APIs públicas y scrapers: fuentes externas no confiables, con timeout, límites y aislamiento por adaptador.
- Backend a PostgreSQL: red privada y credenciales de servicio.

## Persistencia y consistencia

El saldo se actualiza dentro de una transacción con bloqueo del usuario propietario (`FOR UPDATE` sobre `api_keys` y `users`). El ledger conserva la razón de cada movimiento. Este diseño evita dobles consumos concurrentes, pero requiere pruebas de concurrencia antes de producción.

Las migraciones se ejecutan al iniciar el backend. Son idempotentes por nombre y se registran en `schema_migrations`. Antes de usar múltiples réplicas debe añadirse un advisory lock o un job de migración independiente.

## Escalamiento futuro

- Separar migraciones del arranque de la API.
- Añadir Redis para rate limiting distribuido y trabajos asíncronos.
- Incorporar una cola para webhooks, reportes y conciliación de pagos.
- Exportar métricas OpenTelemetry.
- Ejecutar múltiples réplicas de backend detrás del proxy.
- Mover PostgreSQL a OCI Database o un servicio administrado si el volumen lo exige.
