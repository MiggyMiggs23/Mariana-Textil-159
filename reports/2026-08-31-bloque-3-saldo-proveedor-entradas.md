# Bloque 3 — Saldo de proveedor generado por Entradas

Fecha del diagnóstico: 2026-08-31.

## Síntoma reportado

Una Entrada nueva no parecía generar saldo por pagar al proveedor.

## Evidencia revisada antes de cambiar código

- Una Entrada con proveedor y costos completos crea una `COMPRA` dentro de la
  misma operación.
- Repetir la operación con el mismo `uuidCliente` devuelve la Entrada original
  y no duplica la compra.
- Registrar un pago de proveedor reduce el saldo.
- La captura posterior de costos crea o actualiza la compra sin crear nuevos
  movimientos de inventario.
- Las suites aisladas aprobaron 7 escenarios de Entradas y 11 de proveedores.
- En los datos actuales existe una Entrada completa con proveedor y su compra
  coincide; las otras cuatro Entradas con proveedor tienen costos pendientes.

## Causa

Las Entradas pendientes no tienen un importe conocido (`total_costo` es nulo).
La regla actual difiere el nacimiento de la cuenta por pagar hasta capturar
esos costos. Por eso esas cuatro Entradas no afectan todavía el saldo del
proveedor.

## Decisión confirmada

Se confirmó conservar el cargo diferido hasta capturar costos. La Entrada
pendiente no crea una deuda estimada ni bloquea la recepción; al registrar sus
costos, la compra nace por el importe real.

No fue necesario cambiar la regla contable. La corrección del Bloque 4 mantiene
visible el acceso a Costos pendientes y garantiza la creación idempotente de la
compra cuando se captura el importe.