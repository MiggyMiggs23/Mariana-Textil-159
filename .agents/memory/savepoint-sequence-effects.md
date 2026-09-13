---
name: Efectos de secuencias en pruebas con savepoints
description: Un rollback de filas no garantiza que una comprobación deje intactas las secuencias.
---

No considerar una creación de documento “sin efectos” solo porque se revierte mediante SAVEPOINT. Los nextval de las secuencias de documento, líneas y auditoría sobreviven al rollback.

**Why:** La conservación de auditoría y configuración puede exigir más que igualdad de filas; un ticket de prueba puede consumir secuencias de tablas protegidas aunque todas sus inserciones se reviertan.

**How to apply:** Hacer las creaciones completas en una base desechable autorizada. Restaurarla otra vez antes de reutilizarla como referencia exacta. En el origen protegido, limitar la comprobación a contadores transaccionales cuando no se autoricen esos efectos, y declarar que no se creó un documento completo.