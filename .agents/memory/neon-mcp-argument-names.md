---
name: Nombres de argumentos del MCP Neon
description: Diferencia entre firmas documentadas y el esquema real de herramientas Neon.
---

Si Neon rechaza los argumentos camelCase del skill, usar los nombres snake_case que indique su error de validación.

**Why:** La herramienta de eliminación de ramas rechazó `projectId` y `branchId`, aunque el skill los documentaba, y exigió `project_id` y `branch_id`. El intento rechazado no ejecutó la eliminación.

**How to apply:** Ante `Invalid arguments`, consultar el esquema que devuelve el proveedor y corregir exclusivamente los nombres. No repetir cambios de datos ni asumir que el primer intento se ejecutó.