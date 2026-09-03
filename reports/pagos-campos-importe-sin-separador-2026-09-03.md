# Campos de importe aún sin separador de miles

Fecha: 3 de septiembre de 2026

Esta revisión excluye los tres diálogos corregidos en este cambio:

- Pago global a proveedor.
- Abono global de cliente.
- Solicitud de pago dirigido.

Los siguientes campos continúan usando captura numérica nativa sin separador de miles.
Se reportan para decidir un alcance posterior; **no se modificaron en este commit**.

## Ajustes de saldo

- `src/pages/cliente-detail.tsx` — Ajuste de saldo de cliente, importe positivo o
  negativo.
- `src/pages/proveedor-detail.tsx` — Ajuste de saldo de proveedor, importe positivo o
  negativo.

Estos dos casos requieren una variante que admita signo; el campo compartido de pagos
rechaza negativos deliberadamente y no debe reutilizarse sin definir ese comportamiento.

## Cobros y caja

- `src/pages/cobros.tsx` — Fondo inicial de apertura de caja.
- `src/pages/cobros.tsx` — Importe de una línea de cobro de ticket.
- `src/pages/cobros.tsx` — Monto de una salida operativa de dinero.

## Precios y costos

- `src/pages/precios/detail.tsx` — Nuevo precio de lista.
- `src/pages/pos.tsx` — Precio unitario editable de una línea de venta.
- `src/pages/productos.tsx` — Precio sugerido.
- `src/pages/entradas.tsx` — Costo por unidad durante la recepción.
- `src/pages/entradas-pendientes-costo.tsx` — Costo pendiente por producto.
- `src/pages/entradas-pendientes-costo.tsx` — Costo pendiente por rollo.

## Límites de crédito

- `src/pages/cliente-detail.tsx` — Límite de crédito.
- `src/pages/clientes.tsx` — Límite de crédito al crear o editar un cliente.

## Otros importes monetarios

- `src/pages/caja/cuenta-destino-detalle.tsx` — Monto de diferencia Más/Menos en el
  cuadro fiscal.

No se incluyeron cantidades físicas, dimensiones, metros, kilos, bolsas ni rollos: son
mediciones, no importes monetarios, y requieren reglas de captura diferentes.