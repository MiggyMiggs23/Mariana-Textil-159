---
name: Enteros y UUID OpenAPI con Orval y Zod 3
description: Compatibilidad del generador Zod al declarar enteros y UUID en contratos OpenAPI.
---

En este workspace, evitar `type: integer` en esquemas OpenAPI que pasan por el generador Zod actual; declarar `type: number` y reforzar `.int()` en la validación del servidor cuando el dato deba ser entero.

**Why:** El generador emite `zod.int()`, pero la versión Zod 3 instalada no expone esa función y rompe el typecheck de las librerías.

**How to apply:** Después de agregar un campo entero, ejecutar codegen inmediatamente. Conservar mínimos, máximos y unicidad en OpenAPI, y usar un esquema extendido en el servidor para exigir enteros en el límite de entrada.

La misma incompatibilidad afecta a `type: string, format: uuid`: el generador puede emitir `zod.uuid()`, inexistente en Zod 3.

**Why:** La generación de un contrato con identificadores UUID produjo llamadas propias de Zod 4 aunque el proyecto seguía usando Zod 3; el contrato de negocio era correcto y el fallo estaba en la compatibilidad del generador.

**How to apply:** Mientras se conserve este generador, expresar el UUID mediante `type: string` y un `pattern` equivalente, sin relajar la validación. Si se extiende el parser del servidor, la forma compatible es `z.string().uuid()`. Ejecutar codegen y comprobar las librerías antes de integrar los consumidores.