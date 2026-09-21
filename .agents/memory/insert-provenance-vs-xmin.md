---
name: Procedencia de inserción y subtransacciones
description: Por qué xmin y el estado de un XID reconstruido no prueban que una fuente nació en la transacción actual.
---

No sustituir una prueba de inserción propia por `xmin`, por desigualdades de XID
ni por visibilidad MVCC combinada con `pg_xact_status` de una época inferida.

**Why:** Un SAVEPOINT asigna un sub-XID distinto del identificador superior.
Además, una tupla antigua congelada puede conservar su xmin bruto de 32 bits:
tras reutilización, atribuirle la época actual puede asociarla a un identificador
en curso aunque sea una fila histórica visible. Un UPDATE también crea una
versión nueva sin que la fuente haya nacido en esa transacción.

**How to apply:** Cuando el contrato exija procedencia de INSERT, conservar una
marca completa del nivel superior, asignada por la base al insertar y no
rejuvenecida mediante UPDATE. La ausencia histórica de marca debe fallar cerrada,
no rellenarse con la transacción de una migración. Revisar conjuntamente las
guardas de finalización y de escrituras posteriores a restricciones IMMEDIATE.
Separar esta garantía frente a DML de una supuesta defensa frente a un propietario
capaz de desactivar triggers o alterar el esquema.