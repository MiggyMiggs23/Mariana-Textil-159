---
name: Restauraciones entre versiones PostgreSQL
description: Cómo verificar fielmente un dump lógico restaurado en una versión mayor de PostgreSQL.
---

Comparar tablas, conteos, columnas activas, constraints e índices mediante firmas semánticas ordenadas. No exigir igualdad de posiciones físicas internas ni de todas las filas crudas de `pg_constraint`.

**Why:** Una restauración lógica compacta los huecos de columnas eliminadas, y versiones nuevas pueden materializar `NOT NULL` en `pg_constraint` además de `pg_attribute`. Eso produce diffs catalogales aunque el esquema restaurado sea equivalente.

**How to apply:** Comparar columnas por tabla/nombre/tipo/nulabilidad/default/identidad; comparar CHECK, FK, PK y UNIQUE por definición; verificar `NOT NULL` columna por columna; comparar índices por nombre y definición.