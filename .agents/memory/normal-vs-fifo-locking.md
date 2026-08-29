---
name: Ventas completas frente a consumo FIFO
description: Regla de concurrencia cuando una misma existencia admite venta completa y consumo parcial FIFO.
---

Una operación que vende una unidad física completa debe bloquearla antes de validar su cantidad y conservar ese bloqueo hasta registrar la venta. El consumo parcial FIFO debe usar el mismo orden estable de bloqueo.

**Why:** Validar primero y bloquear después permite que un consumo FIFO concurrente reduzca la unidad entre ambos pasos; la venta completa puede entonces cobrar la cantidad original pero registrar únicamente el remanente.

**How to apply:** Cuando una existencia admita modalidades completa y parcial, ordena y bloquea las filas seleccionadas antes de comprobar disponibilidad/cantidad. Mantén validación, mutación y movimientos dentro de la misma transacción, y prueba la carrera completa-vs-FIFO.