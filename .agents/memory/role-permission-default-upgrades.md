---
name: Defaults de permisos en instalaciones existentes
description: Cómo actualizar matrices de permisos nuevas sin borrar personalizaciones administrativas.
---

Al introducir o corregir permisos predeterminados, actualizar las filas de rol que no tengan autor de modificación y preservar las filas con una personalización explícita.

**Why:** Una instalación existente puede conservar valores obsoletos creados por un seed anterior; usar solo `ON CONFLICT DO NOTHING` deja roles bloqueados o con acciones indebidas, mientras que sobrescribir todo elimina decisiones administrativas.

**How to apply:** En migraciones idempotentes de permisos, distinguir defaults del sistema de filas personalizadas mediante la marca de autor disponible; la UI debe consumir los permisos efectivos y no imponer excepciones rígidas por nombre de rol.