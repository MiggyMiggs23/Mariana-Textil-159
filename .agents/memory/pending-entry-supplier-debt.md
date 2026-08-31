---
name: Deuda de Entradas con costos pendientes
description: Regla contable confirmada para decidir cuándo nace la cuenta por pagar de una Entrada sin costos.
---

Una Entrada con proveedor y costos pendientes no genera una COMPRA estimada.
La recepción puede finalizar y el cargo nace únicamente al capturar el costo
real.

**Why:** El 31 de agosto de 2026 se confirmó explícitamente conservar el cargo
diferido. Bloquear la recepción o inventar una deuda provisional cambiaría la
operación y requeriría otra decisión contable.

**How to apply:** En cambios de Entradas, proveedores y costos pendientes,
preservar la recepción sin costo y crear una sola COMPRA append-only cuando el
importe real quede completo.