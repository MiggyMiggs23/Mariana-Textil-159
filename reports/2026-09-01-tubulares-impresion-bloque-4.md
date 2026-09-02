# Corrección — Bloque 4: impresión de tubulares

Fecha: 2026-09-01

## Resultado

Se añadió una opción local y desmarcada por defecto, **Imprimir tubulares**, al cierre de venta. Sin seleccionarla, la solicitud de venta, el ticket normal de 80 mm y el flujo existente no cambian. Al seleccionarla, después de guardar la venta se imprime el ticket normal sin cambios y una tira adicional de 80 mm por cada color de líneas NORMAL identificadas, usando las líneas persistidas del detalle del ticket.

Las tiras incluyen folio, color, cada serie con su cantidad y el total. Si un color contiene rollos medidos en unidades distintas, presenta totales separados por Mts., Kg. y Bolsas; nunca suma unidades incompatibles. La agrupación es determinista y está cubierta por prueba pura. El cuerpo `TicketInput` no recibe el indicador.

## Decisiones conservadoras

1. **Venta metreada:** se excluye porque no tiene un rollo fuente identificado del cual obtener una etiqueta física. No se modifica cómo se registra la venta.
2. **Un solo color:** sí imprime su tira, porque marcar la casilla expresa la decisión consciente del operador.
3. **Decimales:** usa dos decimales porque es un documento de venta. La excepción de tres decimales permanece reservada a la etiqueta física del rollo.

## Verificación real

Se interceptaron únicamente lecturas del navegador; no se registraron ventas ni se modificó la base.

- Ticket `T-999` con seis rollos NORMAL en tres colores.
- Una línea METREADO adicional, correctamente excluida.
- Resultado: cuatro páginas, una de ticket y tres tubulares.
- Página física: 227.04 × 708.96 puntos, equivalente a 80 × 250 mm.
- Sin desbordamiento horizontal.
- Folio, color, series, cantidades y totales verificados.

[Descargar PDF del ticket y sus tres tubulares](./evidence/ticket-con-tubulares-80mm.pdf)

![Ticket con tubulares impresos](./evidence/ticket-con-tubulares.png)