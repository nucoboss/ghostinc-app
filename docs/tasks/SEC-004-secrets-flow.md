# SEC-004: Flujo seguro de variables y secretos

Estado: `BLOCKED`

Dependencia: `SEC-003`.

## Objetivo

Definir e implementar cómo se generan, almacenan, entregan, rotan y revocan credenciales sin exponerlas en Git, logs ni argumentos de procesos.

## Alcance

- Inventariar variables públicas, configuración sensible y secretos por entorno.
- Usar GitHub Environment `production` para aprobación y secretos de despliegue.
- Usar OCI Vault o un mecanismo equivalente como fuente de secretos de runtime.
- Entregar secretos al host por un canal que no los imprima ni los incluya en argumentos visibles.
- Crear `.env.production` con propietario dedicado y permisos `600`, sin sobrescribirlo con placeholders.
- Separar development, staging y production con credenciales independientes.
- Documentar bootstrap, rotación, revocación, recuperación y responsable de cada secreto.
- Añadir controles para impedir commits de `.env*` no permitidos y redacción en CI.

## Criterios de aceptación

- Ningún secreto aparece en Git, artefactos, logs o salida de workflows.
- El workflow puede desplegar sin transportar el contenido de `.env.production` en comandos SSH.
- Rotar un secreto tiene un procedimiento probado y una ventana de rollback.
- Los permisos del archivo y directorio de runtime son mínimos.
- Existe una matriz variable-entorno-propietario-origen sin incluir valores.

## Verificación

- Ejecutar secret scanning sobre historial y cambios actuales.
- Ejecutar un despliegue de staging con valores de prueba y revisar logs completos.
- Rotar un secreto no crítico en staging y demostrar que el valor anterior queda revocado.
