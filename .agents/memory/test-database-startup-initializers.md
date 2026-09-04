---
name: Inicializadores en bases de prueba
description: Preparación necesaria cuando una integración depende de restricciones procedurales instaladas al arrancar la API.
---

En una base Neon vacía, aplicar el esquema declarativo y el seed puede no instalar funciones o triggers creados por los inicializadores de arranque. Antes de ejecutar integraciones que verifican esas restricciones, arrancar la API una vez contra la base aislada y cerrarla cuando ya esté atendiendo solicitudes. Si se usa el comando de producción que ejecuta la salida compilada, recompilar primero: una compilación anterior puede reinstalar silenciosamente la versión vieja de un trigger aunque el TypeScript ya esté corregido.

**Why:** Integraciones financieras fallaron una vez porque faltaba un trigger procedimental y otra porque el arranque ejecutó una copia compilada obsoleta del inicializador. Las pruebas aprobaron después de aplicar los inicializadores actuales.

**How to apply:** Solo en una rama Neon desechable y con una base cuya identidad sea distinta de development. Ejecutar push, seed e inicializadores actuales antes de confiar en ella; verificar en la base la función o trigger crítico cuando la prueba dependa de él. Al arrancar la API en modo test, conservar `DATABASE_URL` como la aplicación y pasar la aislada por `TEST_DATABASE_URL` para que el guard pueda comprobar que son distintas. Si el arranque limpio falla, no ejecutar la suite ni tocar development.