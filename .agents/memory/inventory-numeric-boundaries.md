---
name: Fronteras numéricas de inventario
description: Distinguir cantidades físicas de movimientos firmados y validar cada frontera según su semántica.
---

Una cantidad física negativa de rollo no equivale a un movimiento firmado
negativo del libro: la primera es un estado inválido; el segundo puede representar
legítimamente una salida. No instales prohibiciones globales sobre asientos
firmados para corregir cantidades físicas.

**Why:** Una activación aceptó `-2` para METRO y KILO porque el helper de unidades
discretas retorna sin validar esas unidades. Prohibir todo número negativo habría
corrompido la semántica válida del libro sin cerrar necesariamente cada productor
de estado físico.

**How to apply:** Verifica toda frontera numérica según su semántica: contrato
HTTP/schema, servicio productor, persistencia y consumidores, para todas las
unidades. Prueba explícitamente cero, negativos, decimales y límites; no tomes un
helper parcial como evidencia de no negatividad global.