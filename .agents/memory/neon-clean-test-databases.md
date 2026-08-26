---
name: Bases limpias en ramas temporales de Neon
description: Cómo aislar pruebas cuando la base heredada de una rama temporal no contiene el esquema completo.
---

Si la base predeterminada de una rama temporal de Neon hereda un esquema parcial, no truncarla ni asumir que representa el entorno de la aplicación. Crear una base vacía dentro de esa misma rama y aplicar ahí el esquema y el seed actuales antes de probar.

**Why:** Una rama temporal puede apuntar al proyecto correcto y aun así heredar una base predeterminada incompleta; las pruebas fallan con relaciones faltantes aunque el aislamiento por rama sea correcto.

**How to apply:** Obtener una conexión a la base nueva de la rama, ejecutar el flujo normal de push y seed del proyecto y usar esa URL únicamente como `TEST_DATABASE_URL`. Revisar también las guardias de nombre de cada suite: si exigen nombres distintos, crear una base vacía por suite dentro de la misma rama en vez de relajar la protección.