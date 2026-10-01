# Varios teléfonos por chofer

## Entregado
- Lista sin límite fijo de cantidad, agregar/quitar y mover al primer lugar.
- Etiqueta opcional corta; primero principal, conservado en el campo anterior para pantallas operativas.
- Búsqueda del directorio incluye todos los teléfonos. Tabla y tarjetas siguen mostrando solo el principal.
- Teléfonos heredados conservados como principal sin reescribir datos. Edición de nombre/estado no elimina secundarios; consumidores antiguos que editan solo el principal conservan los demás.
- No se modificaron Clientes, Proveedores ni Camionetas.

## Verificación
- Nueve pruebas montadas frontend; cinco pruebas de handlers/contratos; ocho pruebas nativas PostgreSQL/HTTP pasaron.
- PostgreSQL desechable verificó persistencia, auditoría, roles/permisos, concurrencia y rollback. Destruido al terminar.
- Navegador con respuestas HTTP sintéticas y persistencia simulada: cinco teléfonos, reapertura, búsqueda secundaria, quitar principal y conservar etiquetas. No equivale a E2E autenticado con base real. Captura y aserciones en capturas/.
- Migración real exclusivamente ADD COLUMN telefonos jsonb nullable sin default. Los cinco choferes existentes se conservaron íntegros; sin DML ni backfill. Prueba en migration-live.json.
- Builds congelados auditados; typechecks API/UI y bibliotecas pasaron.

## Activación
Ambos workflows RUNNING con guardas válidas; /api/healthz HTTP 200.
HTML servido coincide con candidato: 1fd0253335c25a19c2fc9fad9f39366ca2e23c5b531e3aae38f885e0967d9a48.
API: ae72cf8da6832f1a5275a2bdba689508ac1ee69639312a246785cb57fe5b44a7.
Sin publicación externa y sin activar cambios ajenos de HEAD.