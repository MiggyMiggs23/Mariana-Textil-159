---
name: Bases limpias en ramas temporales de Neon
description: Cómo aislar pruebas cuando la base heredada de una rama temporal no contiene el esquema completo.
---

Si la base predeterminada de una rama temporal de Neon hereda un esquema parcial, no truncarla ni asumir que representa el entorno de la aplicación. Comparar primero `current_database()` con el nombre usado por la aplicación; `neondb` no necesariamente corresponde a development. Crear una base vacía dentro de esa misma rama y aplicar ahí el esquema y el seed actuales antes de probar.

**Why:** Una rama temporal puede apuntar al proyecto correcto y aun así heredar una base predeterminada incompleta; las pruebas fallan con relaciones faltantes aunque el aislamiento por rama sea correcto. Además, el cliente `pg_dump` local puede ser anterior al servidor Neon y negarse a copiar el esquema.

**How to apply:** Confirmar base e identidad antes de cualquier escritura. Si no puede clonarse el esquema, generarlo desde la definición vigente del proyecto, validarlo en una base vacía y ejecutar después el seed. Usar esa URL únicamente como `TEST_DATABASE_URL`. Revisar también las guardias de nombre de cada suite: si exigen nombres distintos, crear una base vacía por suite dentro de la misma rama en vez de relajar la protección. Si la conexión pooled de la base heredada impone un `search_path` vacío, crear una base limpia y usar la conexión directa (sin `-pooler`) durante schema, seed y pruebas; el pooler de Neon rechaza `search_path` como parámetro de arranque.