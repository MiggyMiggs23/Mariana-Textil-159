# Bloque 4 — Plan financiero pendiente de autorización

Fecha de preparación: 2026-09-15. **No ejecutado.**

No se han corregido, eliminado ni recapturado los movimientos reales.

## Movimientos exactos

| Cliente | Nota / ticket interno | Cargo | Abono original | Reverso total propuesto | Recaptura propuesta |
|---|---|---:|---:|---:|---:|
| 6 | 1004 / 104 | 43 | 46: −$10,000.00 | +$10,000.00, origen 46 | −$10,000.00 |
| 7 | 1005 / 105 | 44 | 45: −$15,000.00 | +$15,000.00, origen 45 | −$15,000.00 |

Total: **$25,000.00**. Los signos son los del libro de crédito; los recibos
mostrarían importes recibidos positivos. Los IDs de los nuevos movimientos
serían asignados por la base al ejecutar; no se reservan ni se adivinan.

Las dos recapturas conservarían **EFECTIVO / CAJA_FISICA**. No representan
otra entrada física de dinero: sustituyen contablemente los abonos anulados.

## Fechas propuestas para las recapturas

Usar el instante real conservado en la metadata original, no mediodía:

- Abono 46: `2026-09-15T13:35:17.006-06:00`
  (`2026-09-15T19:35:17.006Z`). Posterior al cargo 43.
- Abono 45: `2026-09-15T13:34:10.192-06:00`
  (`2026-09-15T19:34:10.192Z`). Posterior al cargo 44.

La nueva `fechaCaptura` y la auditoría deben reflejar el momento real de la
corrección, no falsificar cuándo se ejecutó. El motivo/referencia debe
identificar el abono original y la corrección de fecha efectiva.

## Secuencia mediante el flujo existente

Después de autorización expresa, y con un actor real autorizado:

1. Revalidar los IDs, importes y ausencia de reverso previo. Volver a revisar
   el libro por si hubo operaciones concurrentes.
2. Registrar un reverso **total** de cada original mediante la operación
   `POST /clientes/{id}/pagos/{pagoId}/reversar`, con motivo explícito.
   No se permiten reversos parciales.
3. Registrar un abono normal por el mismo importe y destino mediante
   `POST /clientes/{id}/pagos`, con el instante explícito anterior.
   No usar una excepción dirigida para saltarse FIFO.
4. Verificar el reparto nuevo, auditoría y saldos. En el escenario consultado,
   la nota 1004 quedaría en **$5,750.00** y la 1005 en **$7,022.00**; el favor
   procedente de estos dos abonos quedaría aplicado. Revalidar este resultado
   si existen nuevos movimientos al ejecutar.
5. Conservar originales, reversos, recapturas y aplicaciones como evidencia.
   No modificar sus fechas históricas ni limpiar metadata.

Cada endpoint actual es transaccional, pero el conjunto de reverso y recaptura
son solicitudes distintas. Si la segunda falla, el reverso ya registrado no
se oculta ni se elimina: se informa y se completa únicamente la recaptura
pendiente, comprobando antes que no exista para evitar duplicados.

## Advertencia sobre fechas de reverso y reportes diarios

**El endpoint actual fecha el reverso con el instante del servidor al
ejecutarlo; no acepta una fecha efectiva de reverso proporcionada por el
cliente.** Este plan usa ese comportamiento, sin introducir una corrección
adicional no autorizada.

Por tanto, aunque los abonos nuevos quedarían correctamente fechados el día
15, este procedimiento **no reescribe ni reclasifica por sí solo el corte
histórico del día 14**: el ingreso erróneo permanece visible allí y su
compensación aparece el día de ejecución del reverso. No debe afirmarse que
todos los totales diarios o por sitio quedarían corregidos con esta operación.

Si se quiere además trasladar contablemente el ingreso entre días, hay que
definir y autorizar por separado la fecha efectiva del reverso y su tratamiento
en los cortes. No se ha implementado esa extensión ni se ha alterado Cobrado.

**Pendiente:** autorización expresa para ejecutar el plan descrito. Preparar
este documento no constituye autorización para escribir movimientos reales.