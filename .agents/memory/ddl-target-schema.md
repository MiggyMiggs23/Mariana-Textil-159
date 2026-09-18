---
name: Esquema destino explícito en migraciones
description: Separar un search_path seguro de lectura del esquema donde una migración crea objetos.
---

Las migraciones deben declarar explícitamente el esquema destino, mediante nombres calificados o un `SET LOCAL search_path` dentro de su transacción.

**Why:** Un arnés aislado daba prioridad a `pg_catalog` para resolver lecturas de forma segura. El DDL sin esquema intentó crear allí una tabla y PostgreSQL devolvió 42501 incluso con un superusuario que tenía permisos completos sobre `public`. No era un problema de ACL.

**How to apply:** Ante un rechazo de DDL, comprobar el esquema efectivo y el mensaje exacto antes de cambiar privilegios. No habilitar modificaciones de catálogos del sistema ni debilitar el arnés. Conservar separado el destino de creación del orden de resolución usado por lectores.