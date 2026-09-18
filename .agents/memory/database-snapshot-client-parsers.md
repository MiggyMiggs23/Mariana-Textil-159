---
name: Comparación de filas entre clientes PostgreSQL
description: Evitar diferencias falsas en hashes por decodificación distinta de fechas y tipos.
---

Para comparar filas leídas con pg y con una transacción Drizzle, usar una representación canónica producida por PostgreSQL en ambos lados, en lugar de hashear objetos decodificados por clientes diferentes.

**Why:** Una fecha puede llegar como Date en pg y como texto en Drizzle. Los hashes difieren aunque las filas sean idénticas, lo que provoca abortos falsos de una comprobación de conservación.

**How to apply:** Leer la misma proyección textual de la fila desde SQL, ordenar las filas antes de hashear y mantener una zona horaria consistente. Comprobar también los conteos por separado y conservar los chequeos específicos de valores, fechas y autores.

Para diagnosticar una rama de fechas, comprobar también el parser efectivo de la consulta, no solamente el parser global del pool ni el nombre SQL del tipo.

**Why:** Drizzle node-postgres puede sobrescribir el parser DATE por consulta aunque use el mismo pool que pg directo. Además, omitir el modo de una columna `date()` no implica obtener un objeto Date. Confundir ambos accesos lleva a declarar viva una rama que recibe exclusivamente texto.

**How to apply:** Verificar la versión instalada, el decodificador de la columna y la sesión del ORM con una prueba pura de valores wire; distinguir después normalización de calendario y conversión de zona en la interfaz.

En verificaciones estructurales, tampoco asumir que cualquier array SQL llega como un array JavaScript.

**Why:** `current_schemas(false)` devuelve `name[]`; el cliente usado en una migración lo entregó como texto PostgreSQL, aunque el esquema era correcto. Compararlo con un array produjo un aborto de preflight antes del DDL.

**How to apply:** Proyectar tipos de catálogo poco comunes mediante `to_json(...)` o una conversión SQL explícita y verificar la estructura recibida. No relajar la comprobación de identidad ni dividir manualmente el texto de un array SQL.