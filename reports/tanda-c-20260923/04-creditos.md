# Tanda C — tarea 4: diagnóstico de aplicaciones de crédito

## Estado y alcance

Diagnóstico finalizado **sin corrección**. MAIN ejecutó el operador de solo
lectura y conservó su salida íntegra en
`reports/tanda-c-20260923/04-creditos-live.json`; terminó `PASS` y stderr quedó
vacío. SHA-256 de la salida:
`f2e1468fac50605965a20aa07caa3d0113d8a724c5be6a00af737f31eaf7229f`.
El script ejecutado queda identificado por SHA-256
`032365fa2c6beb961c889a145524c1f4f37249a635d804710a66539ecca19f42`.

La ventana fue `2026-09-23T07:56:25.265Z`–`2026-09-23T07:56:27.152Z`;
el snapshot estable corresponde a `2026-09-23 07:56:25.822688+00`
(`97613:97613:`). La conexión efectiva fue `heliumdb`, OID `16384`.
Se confirmaron `default_transaction_read_only=on`,
`transaction_read_only=on`, aislamiento `repeatable read` y
`search_path=pg_catalog`. La transacción terminó con `ROLLBACK`, reportó cero
escrituras y el pin permaneció sin cambios.

El proceso fijado fue PID 191, start ticks `32616`, con bundle efectivo
`artifacts/api-server/dist-e2-20260927/index.mjs` y SHA-256
`008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
El operador obtuvo `DATABASE_URL` únicamente de `/proc/191/environ` en memoria,
usó `pg` directo y no importó la aplicación ni el singleton de
`@workspace/db`. Las relaciones operativas se consultaron como
`public.<tabla>` y las funciones sensibles desde `pg_catalog`.

## Hallazgo estático

`aplicaciones_credito` es evidencia append-only de cuánto de un `ABONO` se
asignó a una `VENTA_CREDITO`. El trigger declarado
`validate_credit_application` bloquea al cliente, exige ABONO y venta del mismo
cliente y rechaza un ABONO revertido. Para el límite de una aplicación nueva
resta **todas** las aplicaciones inmutables previas del ABONO. Su subconsulta
solo excluye por un `REVERSO` cuyo `movimiento_origen_id` sea el ABONO; no
excluye una aplicación porque la venta destino haya sido revertida.

Por tanto, una aplicación histórica hacia una venta revertida puede seguir
ocupando presupuesto de almacenamiento del ABONO ante el trigger. Eso es
distinto del saldo financiero actual: el proyector canónico calcula deuda y
favor desde el ledger, trata el reverso enlazado de una venta como reducción del
cargo y declara que `immutableAppliedCents` es evidencia de almacenamiento que
**no se resta** de la proyección financiera. El agregado SQL
`negative_signed_ledger_amount` del operador es solo una sonda del total firmado;
la propia salida marca que **no equivale al favor canónico**.

También son conceptos distintos:

- una aplicación histórica completa;
- evidencia E1 de origen/sitio/naturaleza/operación;
- finalización E2 de una recepción física;
- saldo o favor calculado por el ledger.

La existencia de una aplicación no completa E1/E2 ni demuestra los saldos
inmediatamente posteriores requeridos por un recibo histórico.

## Referencias técnicas 51–53 y límite histórico

En este snapshot los tres IDs existen, pero **no corresponden a un ajuste**:
51 es `VENTA_CREDITO`; 52 y 53 son `ABONO`. Los tres tienen una aplicación,
ninguno tiene reverso enlazado y ninguno conserva los campos E1 requeridos. Que
el texto de metadata exista no lo convierte en evidencia formal.

Este resultado no identifica ni desmiente por sí solo el movimiento histórico
descrito anteriormente como “ajuste 51”. Un ID aislado puede haber sido
reutilizado después de una purga. Como esta consulta no fijó una huella histórica
de identidad y fecha contra la evidencia anterior, no se atribuye la fila actual
al caso histórico ni se afirma que aquel ajuste haya sido reparado, revertido o
eliminado.

El operador no convirtió `metadata` a JSON ni supuso que fuera válida. Tampoco
usó un estado del ticket: una reversión solo se reconoció por un movimiento
`REVERSO` enlazado mediante `movimiento_origen_id`.

La comprobación no se limita a 51–53: clasifica **todos** los `AJUSTE` con
importe negativo y entrega conteo, monto e IDs técnicos para el total, activos,
revertidos y carentes de evidencia E1 formal. “Activo” significa que no existe
un movimiento `REVERSO` cuyo `movimiento_origen_id` apunte al ajuste;
“revertido” exige ese enlace y no se deduce de tickets ni metadata.

En este diagnóstico, un ajuste negativo tiene **evidencia E1 formal** solo si:

1. conserva `sitio_origen_id`, `naturaleza`, `operacion_productor` y
   `operacion_clave`;
2. cuando está disponible el esquema E1 esperado, existe una fila real en
   `operaciones_credito_e1` con el mismo productor, clave, naturaleza y actor;
3. el productor/naturaleza es compatible con un AJUSTE:
   `AJUSTE_MANUAL` o `BAJA_INCOBRABLE` con `CORRECCION_CONTABLE`.
4. por tratarse de una corrección contable sin dinero real,
   `sesion_caja_id` es nula y `origen_justificacion` no está vacía.

El operador separa campos faltantes, operación E1 no encontrada y clase E1
incompatible, además del contexto/justificación inválido. `metadata`, sea nula o
no, no cuenta como evidencia formal y no se parsea. Una aplicación tampoco
suple E1: el trigger solo admite `ABONO` como origen, no `AJUSTE`. E2 finaliza
ABONOs físicos y tampoco convierte un AJUSTE en ABONO.

## Causa

La causa técnica probable tiene dos capas que no deben fusionarse:

1. **Presupuesto inmutable del trigger:** el límite de almacenamiento suma
   aplicaciones históricas aunque su venta destino tenga un reverso enlazado.
2. **Semántica financiera posterior:** el ledger sí reduce/cancela la venta por
   su reverso y no usa las aplicaciones inmutables como una segunda resta.
3. **Evidencia incompleta:** un ajuste negativo o un movimiento sin E1/E2 puede
   producir efecto financiero, pero no prueba recepción, sitio, sesión, reparto
   ni saldos históricos de recibo.

Esto puede producir una divergencia entre “favor financiero disponible” y
“capacidad que el trigger permite documentar en nuevas aplicaciones”. El
snapshot actual no contiene aplicaciones hacia ventas revertidas y, por tanto,
no materializa ese caso; la definición activa del trigger conserva el riesgo
estructural para un caso futuro.

## Alternativas de solución y consecuencias

1. **Conservar el histórico y separar capacidad de evidencia (recomendada para
   análisis).** Mantener `aplicaciones_credito` intacta y hacer explícita una
   capacidad de documentación que no se confunda con favor. Consecuencia:
   preserva auditoría, pero una aplicación nueva puede seguir bloqueada mientras
   no exista un mecanismo append-only autorizado para liberar o compensar
   presupuesto.
2. **Agregar una compensación append-only para aplicaciones anuladas por
   reverso de venta.** El trigger restaría el neto de aplicaciones y
   compensaciones verificadas, sin actualizar/borrar filas originales.
   Consecuencia: alinea capacidad futura y reversos conservando trazabilidad,
   pero exige nuevo modelo, concurrencia, guardas, migración, lectores y
   definición precisa de qué reversos habilitan compensación. No debe inferir
   E1/E2 ni fabricar evidencia de un ajuste histórico.
3. **Purga excepcional de datos de prueba 51–53 bajo procedimiento separado.**
   Consecuencia: elimina el caso si realmente es dato de prueba, pero contradice
   la conservación ordinaria y requiere autorización, respaldo y ensayo
   específicos. No corrige el defecto general del trigger ni autoriza borrar
   aplicaciones financieras reales.

No se recomienda cambiar el trigger para ignorar silenciosamente ventas
revertidas sin conservar una compensación auditable, ni convertir una fila
actual en el ajuste histórico por coincidencia de ID, parsear metadata incierta
o reconstruir evidencia ausente.

## Resultado LIVE

| Medición | Resultado |
|---|---:|
| Movimientos del ledger | 4 |
| Ventas a crédito | 2 |
| Abonos | 2 |
| Ajustes, de cualquier signo | 0 |
| Ajustes negativos totales / activos / revertidos | 0 / 0 / 0 |
| Monto de ajustes negativos | $0.00 |
| Aplicaciones | 3 |
| Importe aplicado | $18,000.00 |
| Aplicaciones hacia ventas revertidas | 0 |
| Importe aplicado hacia ventas revertidas | $0.00 |
| ABONOs/ventas afectados por ese caso | 0 / 0 |
| Aplicaciones de ABONOs revertidos | 0 |
| ABONOs activos sobre límite de almacenamiento | 0 |
| Clientes con saldo firmado negativo | 0 |
| Sonda de saldo firmado negativo | $0.00 |

La función activa del trigger fue `validate_credit_application`, mediante
`aplicaciones_credito_validas`, habilitado `O`, con SHA-256
`e252a702bf156671410ce41c0ebc7c10845fd1cd34fdc9ed53c91b723081769d`.
La inspección confirmó que suma todas las aplicaciones del ABONO, filtra el
reverso del ABONO y **no filtra el reverso de la venta**. Por ello, el conteo
cero actual no elimina el riesgo estructural.

Los objetos E1 y E2 existen. Las columnas E1 esperadas sí fueron reconocidas.
El esquema E2 disponible no coincidió con el conjunto de columnas que este
operador conoce, de modo que `finalizationCount` quedó `null`; no se interpreta
como cero ni como ausencia de finalización.

**Conclusión:** actualmente hay tres aplicaciones por $18,000.00, ninguna
dirigida a una venta revertida, y no hay ajustes negativos. No se observó hoy la
divergencia investigada ni el supuesto ajuste 51. Esto no demuestra que casos
anteriores hayan sido corregidos: falta una huella histórica que vincule las
filas actuales con aquellos registros. El trigger todavía presenta la omisión
estructural respecto del reverso de la venta.

## Límites

Los conteos prueban únicamente el snapshot citado. El operador no ejecutó el
proyector TypeScript y no presenta la suma firmada como favor canónico. No emitió
recibos, no reconstruyó aplicaciones, no corrigió filas ni preparó una purga.
Esta finalización solo leyó el JSON producido por MAIN; no volvió a consultar la
DB ni ejecutó API, workflows, reinicios, bundle, gates o commits.