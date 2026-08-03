# OPS-002: Slot de staging en OCI

Estado: `BLOCKED`

Dependencias: `DEP-001`, dominio de staging y credenciales de entorno disponibles.

## Objetivo

Habilitar un espacio aislado de staging en el host OCI compartido para validar Ghostinc antes de producción.

## Alcance

- Revisar Security Lists/NSG y limitar origen a Cloudflare y administración autorizada.
- Crear directorio y usuario de runtime con permisos mínimos.
- Configurar Nginx y TLS para el dominio de staging.
- Bloquear `/internal/*` y no publicar PostgreSQL ni puertos de backend directamente.
- Instalar secretos de staging mediante el flujo definido en `SEC-004`.
- Desplegar imágenes ARM64 por SHA/digest sin alterar otros proyectos del host.
- Verificar consumo de disco, logs, límites y convivencia con servicios existentes.

## Criterios de aceptación

- Solo Nginx es accesible públicamente.
- Frontend responde por HTTPS y backend está disponible únicamente por rutas aprobadas.
- `/internal/*`, PostgreSQL y puertos de contenedores no son accesibles desde Internet.
- Los servicios preexistentes permanecen activos y saludables.
- El despliegue y rollback de staging están documentados.

## Verificación

```bash
docker compose ps
curl -fsS https://<dominio-staging>/
curl -fsS https://<dominio-staging>/health/ready
```

Verificar desde una red externa que los puertos internos y `/internal/*` están bloqueados.
