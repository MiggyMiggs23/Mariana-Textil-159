---
name: Inicializadores en bases de prueba
description: Preparación necesaria cuando una integración depende de restricciones procedurales instaladas al arrancar la API.
---

En una base aislada vacía, aplicar el esquema declarativo y el seed puede no instalar funciones o triggers creados por los inicializadores de arranque. Antes de ejecutar integraciones que verifican esas restricciones, arrancar la API una vez contra la base aislada y cerrarla cuando ya esté atendiendo solicitudes. Si se usa el comando de producción que ejecuta la salida compilada, recompilar primero: una compilación anterior puede reinstalar silenciosamente la versión vieja de un trigger aunque el TypeScript ya esté corregido.

En PostgreSQL local desechable, esta imagen no garantiza `/run/postgresql`: iniciar con un socket explícito dentro del directorio temporal (`postgres -k <directorio>`), usar en la URL el rol propietario creado por `initdb` y crear una segunda base local alcanzable para `DATABASE_URL`. La guardia de pruebas comprueba ambas conexiones y rechaza tanto una URL ficticia como la misma identidad de base.

**Why:** Integraciones financieras fallaron por triggers ausentes y por una copia compilada obsoleta. La preparación local también falló repetidamente por el socket inexistente, el rol implícito incorrecto y una URL de aplicación inalcanzable antes de llegar a la suite.

**How to apply:** Usar una rama Neon o clúster local desechable, siempre con identidad distinta de development. Ejecutar push, seed e inicializadores actuales antes de confiar en ella. En modo test, `DATABASE_URL` debe apuntar a otra base alcanzable y `TEST_DATABASE_URL` a la aislada para que la guardia compruebe identidades distintas. Si el arranque limpio falla, no ejecutar la suite ni tocar development.