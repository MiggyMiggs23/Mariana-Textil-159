---
name: Conciliación de tarjetas y desgloses
description: Regla para mantener iguales los totales de tarjetas financieras y sus detalles paginados.
---

Una tarjeta financiera y su desglose deben compartir el mismo predicado de efectividad, la misma base de fecha y la misma fuente monetaria. En Crédito, la fuente monetaria sigue siendo el ledger inmutable; el estado documental solo determina qué cargos participan.

**Why:** Reutilizar únicamente el predicado no basta: sumar el total del documento en un lado y el movimiento ledger en el otro puede producir diferencias silenciosas aunque ambos conjuntos contengan los mismos folios.

**How to apply:** Al añadir o cambiar un desglose financiero, revisar en conjunto selección, rango temporal, ubicación, cancelaciones, fuente del importe y orden estable. Validar tanto cantidad como suma contra su tarjeta.