# Programa de seguridad OWASP SAMM

El marco correcto es **OWASP SAMM** (Software Assurance Maturity Model). Ghostinc usará SAMM para gobernar el programa y OWASP ASVS más OWASP API Security Top 10 para convertirlo en requisitos técnicos verificables.

## Estado inicial

Controles presentes:

- Backend y frontend separados.
- PostgreSQL no expuesto por Compose.
- Usuario no privilegiado en imágenes propias.
- TLS y proxy de origen preparados.
- Helmet, CORS y rate limiting iniciales.
- Validación del dígito verificador del RUT.
- API key almacenada como HMAC, no en texto plano.
- Saldo actualizado transaccionalmente.
- Reembolso de créditos ante fallo de proveedor.
- Timeout para llamadas a PJUD y demás fuentes externas.
- Auditoría de dependencias sin vulnerabilidades conocidas al momento de esta revisión.
- BFF para mantener credenciales y rutas internas fuera del navegador.
- Validación administrativa repetida en páginas y Server Actions.
- Auth0 fue validado localmente, pero una decisión posterior lo reemplaza por autenticación propia; el diseño está dividido en `IAM-003` a `IAM-008`.

Brechas conocidas:

- La autenticación propia cubre identidad local, alta/recuperación por correo, login, sesiones opacas con límites/rotación/revocación y administración local (`IAM-004`, `IAM-005`, `IAM-006`); falta TOTP (`IAM-007`) antes del cutover completo.
- No existe todavía aislamiento por cuenta individual en endpoints de portal.
- La búsqueda gratuita y la API comercial de causas tienen esquemas estrictos; falta extender el control a futuras rutas de cuenta y billing.
- No hay suite de pruebas automatizadas de seguridad.
- No hay threat model ni inventario formal de datos.
- Los secretos aún se entregan como variables de entorno; la nueva autenticación requerirá además clave de cifrado TOTP y peppers independientes.
- CI usa acciones por tag y no por SHA inmutable.
- No hay SAST, DAST, escaneo de imágenes, SBOM ni firma de artefactos.
- No hay monitoreo centralizado ni procedimiento de incidentes.
- No hay backups automatizados ni restauración probada.
- Falta restringir el origen OCI exclusivamente a Cloudflare.
- No existe CSP final para el frontend.
- No se ha completado revisión legal y de privacidad.

## Objetivo SAMM

Objetivo previo a producción: nivel 1 consistente en las cinco funciones de negocio. Objetivo posterior al lanzamiento: nivel 2 en prácticas críticas de diseño, implementación, verificación y operaciones.

## Governance

### Strategy and Metrics

- [ ] Nombrar un responsable de seguridad del producto.
- [ ] Definir activos críticos: credenciales, saldos, identidad, datos de consulta y billing.
- [ ] Definir métricas mensuales: vulnerabilidades abiertas, tiempo de corrección, cobertura de pruebas y dependencias obsoletas.
- [ ] Establecer SLA: crítico 24 horas, alto 7 días, medio 30 días.

Evidencia esperada: tablero de métricas, responsables y revisión mensual.

### Policy and Compliance

- [ ] Política de desarrollo seguro.
- [ ] Política de secretos y rotación.
- [ ] Política de retención y eliminación de datos.
- [ ] Evaluación de normativa chilena aplicable a datos personales y judiciales.
- [ ] Acuerdos de tratamiento con proveedores.

Evidencia esperada: políticas versionadas y aprobación registrada.

### Education and Guidance

- [ ] Capacitación anual OWASP Top 10 y API Security Top 10.
- [ ] Checklist de revisión para autenticación, autorización y billing.
- [ ] Guía de respuesta segura a errores y logging.

## Design

### Threat Assessment

- [ ] Crear diagramas de flujo de datos y límites de confianza.
- [ ] Ejecutar threat modeling STRIDE para búsqueda gratuita, API pagada, cuenta, pagos y despliegue.
- [ ] Revisar abuso: enumeración masiva de RUT, scraping, agotamiento de créditos, paginación abusiva, replay de webhooks y acceso cruzado entre cuentas.
- [ ] Actualizar el threat model en cambios de arquitectura.

Evidencia esperada: amenazas, mitigaciones, owner y estado residual.

### Security Requirements

- [ ] Adoptar OWASP ASVS como catálogo de requisitos.
- [ ] Adoptar OWASP API Security Top 10 para endpoints comerciales.
- [ ] Definir requisitos de MFA, sesiones, rotación de claves, rate limits y auditoría.
- [ ] Definir recuperación de cuenta/MFA y bootstrap del primer administrador sin contraseñas predefinidas.
- [ ] Definir RPO, RTO y retención.

### Secure Architecture

- [ ] Mantener backend y base de datos fuera de Internet.
- [ ] Restringir origen a Cloudflare.
- [ ] Aplicar mínimo privilegio a OCI, GitHub y PostgreSQL.
- [ ] Diseñar aislamiento explícito por `user_id` local en consultas SQL.
- [ ] Evaluar row-level security como defensa adicional.
- [ ] Separar jobs de migración del proceso web antes de escalar réplicas.

## Implementation

### Secure Build

- [ ] Añadir lint y pruebas obligatorias.
- [ ] Añadir SAST, secret scanning y dependency review.
- [ ] Generar SBOM CycloneDX o SPDX por imagen.
- [ ] Escanear imágenes con Trivy o Grype.
- [ ] Firmar imágenes con Cosign y verificar firmas en despliegue.
- [ ] Fijar GitHub Actions por SHA.
- [ ] Fijar imágenes base por digest y automatizar actualizaciones.

### Secure Deployment

- [ ] Obtener secretos desde OCI Vault.
- [ ] Rotar `API_KEY_PEPPER`, PJUD key, SSH y base de datos mediante procedimiento documentado.
- [ ] Ejecutar contenedores con filesystem de solo lectura cuando sea viable.
- [ ] Añadir `no-new-privileges`, límites de CPU/memoria y capacidades Linux mínimas.
- [ ] Separar ambientes de desarrollo, staging y producción.
- [ ] Añadir aprobación manual y rollback probado en producción.

### Defect Management

- [ ] Etiquetar hallazgos por severidad y componente.
- [ ] Evitar publicar detalles explotables antes del parche.
- [ ] Registrar causa raíz y prueba de regresión.
- [ ] Revisar vulnerabilidades aceptadas y su vencimiento.

## Verification

### Architecture Assessment

- [ ] Revisar trimestralmente límites de confianza y exposición de red.
- [ ] Validar que `/internal/*` no sea accesible desde Internet.
- [ ] Revisar autorización y acceso a datos entre cuentas.

### Requirements-driven Testing

- [ ] Tests unitarios de RUT, API key y créditos.
- [ ] Tests concurrentes para impedir saldo negativo o doble cobro.
- [ ] Tests de devolución ante timeout, 4xx y 5xx de cada fuente externa.
- [ ] Tests de cobro para cero resultados, páginas adicionales, reintentos idempotentes y fallos parciales de fuentes.
- [ ] Tests del rol global `admin` y aislamiento entre usuarios.
- [ ] Tests idempotentes para webhooks de pago.
- [ ] Tests de expiración, revocación y rotación de API keys.

### Security Testing

- [ ] DAST con OWASP ZAP sobre staging.
- [ ] Pruebas de BOLA, BFLA, mass assignment y rate-limit bypass.
- [ ] Fuzzing de parámetros públicos.
- [ ] Revisión manual antes de habilitar billing.
- [ ] Pentest externo antes de manejar clientes reales a escala.

## Operations

### Incident Management

- [ ] Definir severidades, contactos y canal de escalamiento.
- [ ] Crear runbooks para fuga de clave, fraude de créditos, acceso cruzado entre cuentas y caída total o parcial de fuentes.
- [ ] Preparar revocación masiva de API keys.
- [ ] Ejecutar un tabletop exercise antes del lanzamiento.

### Environment Management

- [ ] Inventario de activos, versiones y responsables.
- [ ] Parches mensuales de VM e imágenes; críticos fuera de ciclo.
- [ ] Backup cifrado diario y restauración trimestral probada.
- [ ] Sincronización de reloj y retención protegida de logs.
- [ ] Escaneo continuo de OCI y GHCR.

### Operational Management

- [ ] Métricas de disponibilidad, latencia, errores, consumo y fraude.
- [ ] Alertas por errores de autenticación, ráfagas, saldo anómalo y fallos de compensación.
- [ ] Redactar API keys, tokens, RUT y datos personales en todos los logs. La búsqueda gratuita ya usa POST y plantillas de ruta; falta resolver el RUT en el path público de la API comercial.
- [ ] Correlación mediante request ID sin registrar payload sensible.
- [ ] Runbooks de rollback, restauración y rotación de secretos.

## Controles API prioritarios

Antes de publicar `/api/v1`:

- [ ] Autenticación robusta de API keys y comparación constante.
- [ ] Autorización por scope y propietario de cuenta.
- [ ] Límites de tamaño, tipo y rango para todos los parámetros.
- [ ] Rate limiting distribuido por key, usuario e IP.
- [ ] Cuotas de gasto y límite diario configurables.
- [ ] Respuestas de error sin datos internos.
- [ ] Protección contra consumo ilimitado de PJUD, scrapers y demás fuentes externas.
- [ ] Limitar cada respuesta comercial a una página de hasta 10 registros y cobrar como máximo una vez por solicitud idempotente.
- [ ] Inventario y retiro planificado de versiones antiguas.
- [ ] OpenAPI sincronizado con implementación.

## Criterio de salida a producción

La salida no debe aprobarse hasta que:

1. Todos los ítems de prioridad 0 estén cerrados o tengan una aceptación de riesgo firmada y con vencimiento.
2. Exista threat model revisado.
3. Autenticación, autorización y pagos tengan pruebas negativas.
4. Backup y restauración estén demostrados.
5. CI genere y escanee artefactos reproducibles.
6. Existan alertas y un runbook de incidentes.
7. El origen OCI no sea accesible fuera de Cloudflare y administración autorizada.
