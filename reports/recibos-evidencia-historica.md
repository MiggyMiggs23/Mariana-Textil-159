# Evidencia histórica para recibos de dinero

Fecha de revisión: 2026-09-14.

## Alcance

Revisión de movimientos existentes y su evidencia guardada. Consultas ejecutadas en transacciones `READ ONLY`, terminadas con `ROLLBACK`. No se registraron movimientos, no se crearon usuarios y no se rellenaron datos.

Este informe no acredita la implementación ni las pruebas de emisión, impresión o reimpresión de recibos.

## Resultado

| Movimiento | Total | Aplicación completa guardada | Aplicación incompleta | Evidencia completa para el recibo solicitado | Evidencia insuficiente para el recibo |
|---|---:|---:|---:|---:|---:|
| Abono de cliente | 0 | 0 | 0 | 0 | 0 |
| Pago a proveedor | 3 | 3 | 0 | 0 | 3 |

No hay abonos de cliente que permitan evaluar casos históricos de esa variante.

**Aplicación completa** significa que se conservaron los documentos de destino, los importes aplicados y los saldos antes/después. **Evidencia completa para el recibo** exige además los otros datos históricos solicitados, incluidos el remanente explícito, el saldo total posterior y el sitio de la operación.

## Evidencia que sí existe

Los tres pagos a proveedor tienen filas de aplicación y auditoría de su registro. Las asignaciones auditadas conservan `pagoProveedorId`, `compraProveedorId`, `importe`, `saldoAntes` y `saldoDespues`.

Se verificó la correspondencia de destinos e importes entre la auditoría y las aplicaciones actuales. También existe identificación del movimiento, proveedor y actor, además de importe, forma de pago y fechas.

La vinculación con la auditoría no se basó únicamente en el ID: se comprobaron los datos del movimiento para evitar atribuirle evidencia histórica de otro registro cuyo identificador pudiera haberse reutilizado después de una purga. Resultado: tres correspondencias, ninguna ausente y ninguna ambigua.

## Evidencia faltante

| Dato no conservado para el recibo | Pagos afectados |
|---|---:|
| Saldo a favor o dinero sin aplicar explícito después del pago, incluso cuando fuera cero | 3 |
| Saldo total con el proveedor inmediatamente después del pago | 3 |
| Sitio operativo donde se registró el pago | 3 |

Son **los mismos tres pagos** en las tres categorías, no nueve pagos diferentes.

Se revisaron tanto los datos JSON del evento como las columnas de sitio de auditoría. No se usó la asignación actual del usuario para suplir el sitio histórico.

La falta de un folio propio de recibo **no se cuenta como evidencia histórica perdida**: ese folio corresponde a la nueva emisión documental. No debe confundirse con el folio del movimiento, entrada o factura.

## Mensaje previsto para estos casos

> No se puede emitir el recibo de este pago porque no quedaron registrados el saldo a favor o dinero sin aplicar, el saldo total posterior y el sitio de la operación. El desglose de aplicación a documentos sí está registrado.

El mensaje deberá enumerar los faltantes efectivos de cada movimiento. No debe atribuir ausencia de aplicaciones a estos tres pagos: sí las tienen.

## Límites

- No se consultaron proyecciones actuales para sustituir importes históricos.
- No se asumió un saldo a favor de cero por diferencia aritmética.
- No se reconstruyó el saldo posterior con movimientos posteriores.
- No se recuperaron ni rellenaron datos faltantes.
- No se emitieron recibos ni se ejecutaron las pruebas funcionales del formato nuevo en esta revisión.