---
name: Comparación de filas entre clientes PostgreSQL
description: Evitar diferencias falsas en hashes por decodificación distinta de fechas y tipos.
---

Para comparar filas leídas con pg y con una transacción Drizzle, usar una representación canónica producida por PostgreSQL en ambos lados, en lugar de hashear objetos decodificados por clientes diferentes.

**Why:** Una fecha puede llegar como Date en pg y como texto en Drizzle. Los hashes difieren aunque las filas sean idénticas, lo que provoca abortos falsos de una comprobación de conservación.

**How to apply:** Leer la misma proyección textual de la fila desde SQL, ordenar las filas antes de hashear y mantener una zona horaria consistente. Comprobar también los conteos por separado y conservar los chequeos específicos de valores, fechas y autores.