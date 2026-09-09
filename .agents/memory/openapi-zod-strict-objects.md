---
name: Objetos OpenAPI estrictos en Zod
description: Diferencia entre additionalProperties false en OpenAPI y el comportamiento del parser Zod generado.
---

No asumir que `additionalProperties: false` producirá un objeto Zod que rechace claves desconocidas. El generador puede crear un `z.object(...)` con comportamiento strip: la petición se acepta y las claves extra se descartan.

**Why:** Un endpoint de atribución aceptó un actor enviado por el cliente con HTTP 200 porque el parser generado eliminó el campo antes de validar, aunque el contrato OpenAPI lo prohibía.

**How to apply:** En entradas donde claves extra intenten controlar actor, fecha, autorización, importes derivados u otros campos sensibles, envolver el esquema generado con `.strict()` en la frontera del servidor y probar explícitamente que una clave desconocida devuelve error.