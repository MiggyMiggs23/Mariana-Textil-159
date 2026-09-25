# Contrato de listado

GET `/api/clientes/listado`, permiso clientes/ver. GET `/clientes` no cambia.
Query: q (máx 200), sort (`nombre`, `rfc`, `telefono`, `limiteCredito`,
`saldoActual`, `movementCount`, `lastActivity`), direction (`asc`, `desc`),
period (`1m`, `3m`, `1y`, `all`), page (1), pageSize (50, máximo 100),
active (`true`/`false`, opcional).

Defaults: sort lastActivity, direction desc, period all.
Respuesta `{items: ClienteListadoItem[],total,page,pageSize}`.
Item extiende Cliente con movementCount (integer|null), lastActivity
(date-time|null). Sin permiso financiero: ambos null, sin saldos/límite,
y órdenes financieros se resuelven por nombre asc.
Última actividad es histórica completa; el periodo solo afecta al conteo.
Periodo móvil en calendario Ciudad de México.
No se cuentan dos veces el ticket y su movimiento VENTA_CREDITO.