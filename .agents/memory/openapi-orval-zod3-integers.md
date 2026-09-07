---
name: Enteros OpenAPI con Orval y Zod 3
description: Compatibilidad del generador Zod al declarar números enteros en contratos OpenAPI.
---

En este workspace, evitar `type: integer` en esquemas OpenAPI que pasan por el generador Zod actual; declarar `type: number` y reforzar `.int()` en la validación del servidor cuando el dato deba ser entero.

**Why:** El generador emite `zod.int()`, pero la versión Zod 3 instalada no expone esa función y rompe el typecheck de las librerías.

**How to apply:** Después de agregar un campo entero, ejecutar codegen inmediatamente. Conservar mínimos, máximos y unicidad en OpenAPI, y usar un esquema extendido en el servidor para exigir enteros en el límite de entrada.