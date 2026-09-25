# Tarea 3 — detenida antes de construir

## Decisión recibida, transcripción literal

Reglas: el rollo solo se acepta de vuelta si regresa completo, con los mismos metros, kilos, piezas o bolsas con que salió; nunca se acepta con menos. Regresa al inventario con su misma serie, en la tienda que lo recibe. Si la nota todavía tiene deuda, se cancela la deuda por ese rollo. Si la nota ya está liquidada, se devuelve el dinero de la caja abierta del día, solo ADMIN y con motivo obligatorio. Nunca se deja saldo a favor. Los cambios físicos por otra tela o color se arreglan en persona y no se registran aquí. La devolución es un movimiento nuevo, no un reverso: no toca el corte original ni edita la venta.

Antes de construir, dime si esto choca con alguna regla vigente y detente si el choque es de dinero.

## Resultado previo a implementación

DETENIDA_POR_DECISIÓN_MONETARIA. No se construyó ni se abrió la devolución.
La nueva decisión acota la anterior sobre devolución de dinero, pero no se presume que autorice abrir la devolución E5 que el mismo mensaje mantiene cerrada.

- La regla anterior de devolución de recepción exige importe íntegro nunca aplicado. Una nota liquidada puede haberse pagado mediante aplicaciones: no equivale a una recepción nunca aplicada.
- Una nota parcialmente pagada no tiene definido qué parte del valor del rollo cancela deuda y qué ocurre con el excedente sobre su saldo. No se inventa efectivo ni saldo a favor.
- Debe aclararse si devolver mercancía es una operación monetaria separada de E5, y cómo se trata una venta liquidada por transferencia frente a la salida de efectivo de la caja receptora.

La revisión y su bloqueo se comunicaron al propietario antes de cualquier construcción. No hay SQL, mutación de datos, activación ni candidato que liberar para esta tarea.

Fuentes: autorización literal de esta carpeta; tarea 3 del archivo adjunto; reglas de devolución en `replit.md` y `reports/prompt-u-respuestas-2026-09-18.md`.