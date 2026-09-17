---
name: Naturaleza de los movimientos de crédito
description: Decisión aprobada para no confundir creación/cancelación de deuda con corrección o dinero recibido.
---

Todo movimiento nuevo debe declarar exactamente una de cuatro naturalezas: ingreso físico, devolución física, corrección contable u operación de crédito sin movimiento de dinero. La venta a crédito y su reverso automático sin dinero pertenecen a la cuarta, no a corrección contable. Una recaptura sin dinero nuevo no es ingreso físico.

**Why:** El propietario confirmó expresamente que clasificar cada venta como corrección contaminaría los reportes basados en naturaleza y repetiría la confusión entre recapturas y cobros reales.

**How to apply:** Es una decisión de diseño aprobada, no prueba de que esté implementada. Consultar `reports/e1-bloque0-decisiones-aprobadas.md` para la matriz por productor y comprobar el código antes de afirmar cumplimiento. No reclasificar históricos automáticamente ni deducir movimiento de dinero por signo, tipo de registro o medio de pago.