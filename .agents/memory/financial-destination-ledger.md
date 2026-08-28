---
name: Destinos financieros desde el ledger
description: Regla para que cuentas y cuadre fiscal no omitan abonos, saldos a favor ni reversos.
---

Las cuentas destino deben derivarse de un solo modelo de lectura que combine pagos POS y movimientos canónicos de crédito. Los pagos usan su fecha efectiva; los abonos se distribuyen según sus aplicaciones, el remanente queda como saldo global y los reversos compensan con signo contrario sin borrar evidencia.

**Why:** Un modelo basado solo en pagos POS omite cobros posteriores. Vincular un abono directamente a un ticket tampoco representa el flujo real: los abonos pueden no tener ticket, dividirse entre ventas y luego revertirse.

**How to apply:** Reutilizar la misma proyección para tarjetas, detalle, exportación y cuadre fiscal. Incluir solo ventas activas; una aplicación ligada a un ticket cancelado vuelve a saldo global. Para cartera, ignorar aplicaciones cuyo abono fue reversado; para filtros por sitio, atribuir solo partes aplicadas a ventas activas de ese sitio.