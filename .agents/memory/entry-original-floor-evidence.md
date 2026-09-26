---
name: Piso original de Entrada
description: El documento de Entrada usa evidencia del piso de recepción, nunca la ubicación física actual del rollo.
---

La última columna del documento de Entrada es **Piso**, por línea de producto. Conservar el sitio en la cabecera y no dividir las líneas, alterar cantidades ni rediseñar la impresión. Si un producto ingresó en varios pisos, mostrar sus nombres distintos en la misma celda.

**Why:** `rollos.piso_id` y su nombre asociado representan el piso actual; reubicar un rollo o renombrar un piso no debe cambiar lo que el documento acredita sobre su recepción. Los movimientos de recepción antiguos no conservan ese dato y los conteos de inventario o auditorías posteriores no lo prueban retrospectivamente.

**How to apply:** Conservar, dentro del evento de creación de la Entrada y de su misma transacción, evidencia versionada por rollo y producto con ID y nombre del piso configurado al ingresar. Leer solo evidencia inequívoca de ese evento. Para históricos sin evidencia suficiente mostrar **Sin evidencia**, nunca inferir desde el piso actual ni desde la ausencia de reubicaciones registradas. **Sin piso** se reserva para un nulo explícitamente guardado al recibir. Probar una recepción en dos pisos, reubicar un rollo y comprobar que el documento conserva ambos pisos originales. Mantener estas reglas en el código fuente duradero, no únicamente en overlays de compilaciones congeladas.