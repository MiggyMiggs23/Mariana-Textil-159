---
name: Pagos dirigidos y evidencia de aplicación
description: Regla de identidad y autoridad para pagos dirigidos dentro del ledger de crédito.
---

Un pago dirigido de cliente apunta al movimiento de venta exacto aprobado, no a todos los cargos que compartan ticket. Las aplicaciones de crédito append-only conservan la evidencia histórica de enlaces, pero nunca limitan ni reconstruyen el saldo vigente.

**Why:** Un ticket puede contener más de un movimiento de crédito, y una reproyección por fecha efectiva puede cambiar el destino FIFO de pagos anteriores sin que sea válido reescribir su evidencia histórica.

**How to apply:** Derivar el marcador dirigido únicamente de una solicitud aprobada y usar la proyección completa bajo el lock del cliente para disponibilidad, saldos y límites. Validar estructura y conservación por fuente al insertar evidencia, no capacidad acumulada por destino.