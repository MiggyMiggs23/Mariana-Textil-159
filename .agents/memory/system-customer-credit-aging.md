---
name: Cliente sistema y aging de crédito
description: Reglas de integridad para reservar Venta a Público y mantener consistente el aging derivado del ledger.
---

Al reservar el cliente sistema con id 1, una instalación existente puede tener un cliente real con ese id. Ese cliente debe reasignarse a un nuevo id junto con todas sus referencias antes de insertar el registro protegido; nunca se debe renombrar o convertir silenciosamente.

**Why:** La migración debe ser segura para instalaciones con datos históricos y no apropiarse de tickets o movimientos de un cliente real.

**How to apply:** Cualquier migración futura que reserve identificadores debe detectar colisiones y reubicar referencias dentro de una transacción.

En el aging de crédito, un REVERSO ligado a ticket cancela primero el cargo del mismo ticket; pagos y ajustes negativos se aplican FIFO. No permitir ligar ajustes negativos nuevos a tickets, pero incluir los vínculos legados en FIFO. Los ajustes positivos son nuevos cargos fechados y deben aparecer en cartera.

**Why:** Tratar todos los negativos como pagos FIFO puede dejar vencida una venta cancelada o subestimar cartera; ignorar ajustes positivos hace que aging y saldo diverjan.

**How to apply:** Toda métrica, semáforo y exportación de cartera debe usar la misma asignación: reverso por ticket, después FIFO para abonos/ajustes negativos, incluyendo ajustes positivos como cargos.