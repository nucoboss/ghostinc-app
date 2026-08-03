# REL-001: Puerta de salida a producción

Estado: `BLOCKED`

Dependencias: `APP-002`, `BILL-001`, `OPS-001`, `OPS-002` y cierre o aceptación temporal de los controles P0.

## Objetivo

Promover una versión validada en staging a producción únicamente con evidencia técnica y operativa suficiente.

## Alcance

- Revisar los criterios de salida de `SECURITY-ROADMAP.md`.
- Ejecutar pruebas negativas de autenticación, autorización, créditos y pagos.
- Confirmar backup, restauración, alertas, runbooks y rollback.
- Confirmar imágenes firmadas/escaneadas, SHA o digest desplegado y SBOM.
- Validar Cloudflare, TLS, headers y aislamiento del origen OCI.
- Registrar versión, migraciones, responsables y evidencia de aprobación.

## Criterios de aceptación

- No queda ningún control P0 abierto sin aceptación de riesgo fechada y responsable.
- Backup y rollback fueron probados contra la versión candidata.
- Staging ejecuta el mismo artefacto inmutable que se promueve.
- Health checks y monitoreo detectan una degradación simulada.
- La promoción no requiere editar secretos ni manifiestos manualmente.

## Verificación

- Ejecutar la suite completa de frontend, backend e integración.
- Ejecutar el checklist de seguridad y operación con evidencia enlazada.
- Desplegar por digest, verificar salud y ensayar rollback controlado.
