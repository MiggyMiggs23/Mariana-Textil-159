---
name: Enums usados por índices parciales
description: Orden seguro para reemplazar un enum PostgreSQL referenciado por predicados de índices.
---

Antes de cambiar una columna a un enum de reemplazo, retirar dentro de la misma transacción cualquier índice parcial cuyo predicado contenga constantes tipadas al enum anterior. Recrearlo solo después de completar el cambio y renombrar el enum nuevo.

**Why:** PostgreSQL intenta conservar la expresión del predicado con el tipo viejo durante `ALTER COLUMN TYPE`, lo que puede producir comparaciones entre dos enums nominalmente distintos y abortar la migración.

**How to apply:** Inventariar índices parciales y otras expresiones dependientes del enum; hacer `DROP` antes del cambio de tipo y `CREATE` después. Una transacción garantiza que un fallo restaure la definición previa.