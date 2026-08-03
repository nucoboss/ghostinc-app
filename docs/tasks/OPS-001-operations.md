# OPS-001: Backups y observabilidad OCI

Estado: `BLOCKED`

Dependencia: `OPS-002`.

Bloqueo humano: definición de RPO/RTO.

## Objetivo

Preparar recuperación y monitoreo operativo antes de producción.

## Alcance

- Backup PostgreSQL cifrado hacia OCI Object Storage.
- Retención acorde a RPO/RTO.
- Job automático y alerta de fallo.
- Restauración documentada y probada en entorno separado.
- Métricas de disponibilidad, latencia, errores y compensaciones fallidas.
- Logs centralizados con redacción de tokens, API keys y RUT.
- Alertas por caída, fraude, agotamiento y errores de billing.
- Runbooks de incidente, rollback y restauración.

## Criterios de aceptación

- Existe evidencia de una restauración completa.
- Un backup fallido genera alerta.
- Ningún secreto ni RUT completo aparece en logs.
- Dashboard operativo diferencia frontend, backend, PostgreSQL y PJUD.

## Verificación

Ejecutar un simulacro de pérdida de base en staging y documentar tiempos reales de recuperación.
