---
name: Inicializadores en bases de prueba
description: Preparación necesaria cuando una integración depende de restricciones procedurales instaladas al arrancar la API.
---

En una base Neon vacía, aplicar el esquema declarativo y el seed puede no instalar funciones o triggers creados por los inicializadores de arranque. Antes de ejecutar integraciones que verifican esas restricciones, arrancar la API una vez contra la base aislada y cerrarla cuando ya esté atendiendo solicitudes. Confirmar que el arranque realmente termine: actualmente una base recién creada puede fallar al reservar el cliente de sistema con `id=1`, incluso sin seed.

**Why:** Una integración de aplicaciones de pago falló en una base recién preparada porque faltaba un trigger procedimental; la misma prueba aprobó 2/2 después del arranque normal de la API.

**How to apply:** Solo en una rama Neon desechable y con una base cuya identidad sea distinta de development. Ejecutar push y arranque de API antes de confiar en ella; aplicar seed solo después de confirmar que no compite con identificadores reservados. Si el arranque limpio falla, no ejecutar la suite ni tocar development: usar una base aislada ya inicializada o reportar el bloqueo.