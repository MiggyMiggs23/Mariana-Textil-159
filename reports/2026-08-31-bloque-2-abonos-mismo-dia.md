# Bloque 2 — Abonos registrados el mismo día

Fecha del diagnóstico: 2026-08-31.

## Síntoma reportado

Una venta a crédito y un abono registrados el mismo día parecían conservar el
saldo pendiente de la venta, aunque el efectivo sí aparecía en Caja.

## Evidencia revisada antes de cambiar código

- Caja registra cobros de tickets en `ticket_pagos`.
- Un abono de cartera se registra una sola vez como movimiento `ABONO` negativo
  en el libro de crédito, con su cuenta destino.
- La proyección FIFO actual consume todos los abonos globales sin excluir los
  ocurridos el mismo día que la venta.
- Estado de cuenta y Cartera usan actualmente la misma proyección completa.
- En los datos disponibles no existen pares históricos de venta a crédito y
  abono registrados el mismo día, ni movimientos con signo incorrecto.
- Los casos controlados parcial, exacto, sobrepago y día siguiente reducen el
  saldo esperado con el código actual.

## Diagnóstico

El síntoma no es reproducible en la versión actual y no hay evidencia para
atribuirlo a la fecha del mismo día. Antes del 27 de agosto coexistían sumas,
una función SQL de aging y aplicaciones persistidas como fuentes de lectura.
Esa divergencia fue retirada al unificar las pantallas sobre una sola
proyección del libro mayor.

No se hará una corrección financiera especulativa: cambiar FIFO o el orden de
aplicación sin una reproducción válida podría modificar saldos reales.

## Regresión conservada

La suite de asignación cubre explícitamente venta y abono del mismo día para
pago parcial, exacto y excedente, además del día siguiente. También comprueba
que el único `ABONO` sea la única fuente de pago de la proyección.