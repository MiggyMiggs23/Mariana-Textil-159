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

La autorización de crédito debe bloquear la fila del cliente antes de leer el ledger y conservar el bloqueo hasta insertar el cargo.

**Why:** Dos cajas con tickets distintos pueden leer simultáneamente el mismo disponible y exceder el límite si la validación no se serializa por cliente.

**How to apply:** Mantener serialización transaccional explícita por cliente (advisory lock y `FOR UPDATE`) antes del saldo/cargo, con prueba concurrente en ubicaciones/sesiones distintas.

Los filtros de estado de cuenta deben aplicarse después de calcular el saldo corrido sobre todo el ledger; `saldoActual` siempre es el total histórico. Los PDF financieros deben paginar sin truncar filas.

**Why:** Filtrar antes de la ventana altera cada saldo y reporta un subtotal como actual; truncar silenciosamente hace que PDF y XLSX discrepen.

**How to apply:** Usar un CTE con la ventana completa y filtrar afuera. Verificar PDF con más filas que una página y conservar la primera y la última.