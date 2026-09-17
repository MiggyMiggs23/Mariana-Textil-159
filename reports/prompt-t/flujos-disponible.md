# Revisión de flujos existentes que pueden dejar un rollo DISPONIBLE

> Documento histórico del cierre de T. La advertencia de reactivación seguida
> de reverso de la misma baja fue corregida posteriormente por autorización
> expresa: ambos órdenes quedan excluidos entre sí para esa baja y ese rollo.
> Estado vigente y otros hallazgos: `../single-roll-return/verificacion.md`.

Revisión de código realizada durante Prompt T. No es una prueba operativa con
mercancía real. Los reversos existentes se conservan por instrucción expresa
del usuario; no se agregan restricciones a esos reversos.

## Resultado

No se encontró un temporizador, tarea de fondo o inicializador que por sí solo
devuelva rollos a DISPONIBLE. Sí existen cambios de estado como efectos
secundarios de otras operaciones autorizadas:

1. **Confirmar una auditoría:** antes de esta entrega, un sobrante EN_TRANSITO
   podía recibirse automáticamente dentro de `confirmAuditoria`, sin una
   recepción individual. Asimismo se reubicaba inmediatamente el sobrante
   disponible de otro sitio. Son los efectos retirados expresamente por el
   Tema 2, no cambios derivados de esta revisión adicional.
2. **Revertir un movimiento:** `revertirMovimiento` calcula el estado restaurado
   mediante `estadoAntesDe`. Revertir un ajuste puede pasar de BAJA a DISPONIBLE.
   No exige una decisión adicional de “el rollo reapareció”: la decisión es
   corregir el movimiento. Incluye las rutas generales y de salida
   extraordinaria. Se conserva sin cambios.
3. **Cancelar una venta o una salida de venta:** sus flujos llaman al mismo
   reverso de movimientos. La disponibilidad vuelve como consecuencia de
   cancelar el documento, no mediante la nueva reactivación de faltantes.
   Se conserva sin cambios. En particular, el motor general decide el estado
   a partir del tipo del movimiento y el estado actual; no debe confundirse
   este mecanismo con una constatación física de reaparición.
   **También al cancelar un traslado EN_TRANSITO**, `cancelarSalida` llama a
   `recibirTransferencia` para devolver sus rollos al origen y a DISPONIBLE.
   Se pide un piso de retorno válido cuando corresponde, pero no se espera
   otra operación independiente de recepción física. Es un efecto secundario
   de la cancelación, que se conserva sin cambios.
4. **Recibir un traslado:** la recepción normal llama a `recibirTransferencia`
   y devuelve el rollo a DISPONIBLE. Hay una decisión explícita de recepción;
   no es un proceso autónomo.
5. **Ventas parciales:** el remanente se conserva DISPONIBLE si su cantidad no
   llegó a cero. Es consecuencia de la venta parcial; no reactiva un faltante.
6. **Entradas y activación de programados:** crean o activan disponibilidad por
   una captura/recepción explícita, no por reaparición de un rollo dado de baja.

## Fuentes revisadas

- `artifacts/api-server/src/lib/inventario.ts`: `crearEntrada`, `activarRollo`,
  transferencia inmediata, `recibirTransferencia`, consumos parciales,
  `revertirMovimiento` y `estadoAntesDe`.
- `artifacts/api-server/src/lib/auditoria-inventario.ts`: `confirmAuditoria`.
- `artifacts/api-server/src/lib/salidas.ts`: recepción y cancelación.
- `artifacts/api-server/src/lib/pos.ts`: cancelación del ticket.
- `artifacts/api-server/src/routes/inventario.ts`: rutas autenticadas de
  activación y reversos, incluida salida extraordinaria.

**Distinción operativa:** el reverso corrige un registro que no debió existir;
la reactivación registra que un faltante apareció posteriormente. No se
reinterpretan las cancelaciones históricas como reactivaciones.

## Interacción que merece atención, sin cambiar las vías existentes

El reverso general suma la cantidad inversa del ajuste a la cantidad actual.
Si se revierte una baja antigua **después** de haber recuperado su cantidad
mediante una reactivación, esa operación podría volver a sumar la cantidad de
la baja. No se presenta como una prueba ejecutada contra datos reales: es una
consecuencia identificada al revisar el motor conservado. No se agregó un
bloqueo a los reversos originales, siguiendo la instrucción del usuario.