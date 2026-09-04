# Auditoría de separación Ticket / Nota — Bloque 1

## Residuos de cruce retirados

- POS ofrecía una casilla `Venta a crédito` dentro de una Nota, permitiendo por omisión una Nota de contado. Se eliminó: elegir Nota implica crédito.
- POS consultaba y bloqueaba por límite antes de emitir. El plazo sí pertenece al POS, pero la disponibilidad se decide al autorizar en Caja; se retiró ese cruce.
- El contrato aceptaba `credito` independiente de `documentoTipo`. Se eliminó del input público; el servidor deriva crédito exclusivamente de `NOTA`.
- El motor permitía `NOTA` con `credito=false`, y conservaba el plazo vacío. Ahora toda Nota exige 7/15/30/60 y todo Ticket rechaza plazo/crédito.
- El cobro aceptaba `CREDITO` y hasta convertía un Ticket en Nota (`convertidoANotaPorCobro`). Ese camino se elimina en el bloque de autorización transaccional, conservando el registro aquí para que la auditoría sea rastreable.
- Venta a Público podía emitir Nota mediante datos de entrega aunque no admite crédito. Se cerró ese camino: una Nota exige un cliente de crédito.

## Contrato vigente

`Ticket (Contado)` nunca lleva plazo. `Notas (Crédito)` siempre lleva un plazo elegido en POS, precargado únicamente desde `clientes.diasCredito`; elegir otro valor solo se envía con esa venta y no escribe el perfil.