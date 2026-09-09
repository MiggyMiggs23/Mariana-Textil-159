# Bucles del motor de inventario

Lista definitiva de bucles de producción que llaman operaciones mutantes del
motor. La regla es que todos los pares, incluidos los implícitos, se bloqueen en
una sola llamada antes del ciclo.

| Flujo | Operación interna | Estado |
| --- | --- | --- |
| Crear ticket, líneas normales | `venderRollo` | Completo: producto + ubicación del ticket |
| Crear ticket, bolsas metreadas | `consumirBolsasFifo` | Completo: producto + ubicación del ticket |
| Cancelar ticket | `revertirMovimiento` | Completo: pares producto + ubicación leídos de todas las ventas |
| Cobrar o autorizar salidas para venta a cliente | `venderRollo` | Completo: producto + ubicación de origen de cada salida, no la ubicación del ticket; al agrupar salidas de varios orígenes, ordena determinísticamente por origen y rollo antes de bloquear todos los pares |
| Cancelar salida para venta a cliente con movimientos | `revertirMovimiento` | Completo: producto + ubicación leídos del propio movimiento; orden determinista por producto, ubicación y movimiento, con todos los pares bloqueados en una sola llamada antes del ciclo |
| Salida directa a mostrador | `salidaMostrador` | Completo: pares reales de todos los rollos antes de bloquear filas |
| Enviar salida | `moverRollo` | Completo: origen + tránsito para cada producto |
| Recibir salida | `recibirTransferencia` | Completo: ubicación real de tránsito + destino; relectura estable antes de `FOR UPDATE` |
| Confirmar faltantes de auditoría | `ajustarRollo` | Completo: pares reales de todos los candidatos; se revalidan tras bloquear filas |
| Resolver sobrantes de auditoría | `transferirRolloInmediato` / `recibirTransferencia` | Completo: origen real + destino auditado; se revalidan tras bloquear filas |

Los handlers de ajuste y reverso en `routes/inventario.ts` ejecutan exactamente
una operación por transacción. No recorren colecciones y, por tanto, el candado
interno del motor cubre su único par.

No hay otro bucle de producción que llame una operación mutante exportada por el
motor. Los ciclos internos de `inventario.ts` hacen cálculos o primitivas de
persistencia dentro de operaciones que ya poseen sus candados.
