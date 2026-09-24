# Tarea 3 — mes ampliado: PASS

## Resultado real

Se completaron **30 fechas consecutivas, 2026-09-23 a 2026-10-22**, en PostgreSQL
real exclusivo, puerto **55443**, base `tanda_ga_month`. Son fechas de un
**reloj de procesos controlado**, no treinta días de tiempo real transcurrido.
Se usaron los productores reales del código congelado y los siete sitios
del fixture: **tres tiendas y cuatro bodegas**, con productos nativos
**METRO, KILO, PIEZA y BOLSA**. No se cambió código de producto.

La carga es un supuesto sintético modesto, **no volumen comercial observado**.
Se ejecutó en tres etapas acotadas de diez días, conservando el estado y
avanzando el reloj sólo hacia fechas posteriores. No hubo SQL de reescritura
histórica, apertura de compuertas ni modificación de la regla de una sesión por
tienda y fecha. No se usó la base app ni la copia mensual compartida 55442.

| Operación | Cantidad |
|---|---:|
| Entradas reales, una por sitio y día | 210 |
| Transferencias inmediatas bodega→tienda | 120 |
| Tickets de contado cobrados | 360 |
| Notas de crédito autorizadas | 360 |
| Abonos sobre crédito | 360 |
| Anticipos | 90 |
| Salidas E4 | 90 |
| Tickets adicionales creados y cancelados sin cobro | 90 |
| Cortes diarios cerrados | 90 |
| Aperturas mediante productor | 87 |
| Sesiones iniciales del fixture utilizadas | 3 |
| Pasos con antes/después y expectativas verificadas | **2667** |

## Conciliaciones

- Cada paso contiene las **28 celdas sitio/producto/unidad**, rollos individuales,
  caché, ledger, saldo y movimientos del cliente, sesiones, pagos, retiros y cortes.
  Se verificaron deltas independientes del escenario y coincidencia
  **físico = caché = ledger** en todas las celdas después de cada paso.
- Por cada unidad nativa, sin sumar unidades incompatibles: inicial **560**;
  entradas **+8400**; ventas **−1800**; transferencias netas **0**;
  cancelaciones netas **0**; final **7160**.
- Cliente: **360 cargos de crédito por 540000.00** y **450 movimientos ABONO
  por −540100.00**, incluyendo anticipos. Saldo neto final **−100.00**:
  saldo a favor de 100, no deuda pendiente.
- El efectivo esperado se contrastó por operación: cobro +1500, abono +importe,
  anticipo +100, E4 −100, cero para las operaciones sin dinero. Cada sesión nueva
  comienza con fondo de 5000.
- **90 cortes únicos**, todos cerrados con diferencia cero. La comprobación SQL
  final de sólo lectura demuestra **30 sesiones cerradas y 30 fechas por tienda**,
  y **30 registros de compuerta diaria conservados por tienda**.
- Se intentó reabrir después de cada cierre y se exigió
  `SESSION_ALREADY_EXISTS_TODAY`. Ninguna compuerta fue eliminada.
- La comprobación final detectó **cero inversiones de timestamp** en el ledger
  de crédito del cliente de prueba.

## Evidencia y alcance

- `summary.json`: resultados compactos, conteos, conciliación final PostgreSQL
  en transacción `READ ONLY` y SHA256 de los tres archivos principales.
- `results.json`: identidad exclusiva, snapshots inicial/final y treinta días PASS.
- `journal.jsonl.gz`: diario completo, miembros gzip concatenados;
  lectura con `gzip -cd`. No se mezcló evidencia del intento previo.
- `cuts.jsonl`: antes/después de los 90 cortes.
- `progress.txt`: progreso por día de esta ejecución.
- `clock/proof.json`: comprobación previa de PostgreSQL `now()` y Node `Date`,
  con temporizadores monotónicos reales.
- `clock/fresh-restore.json`: entrega de la restauración fresca hecha por MAIN.
- `run.ts`, `build.mjs`, `summarize.mjs`: arnés, compilación y verificación final.

El abono usa el handler final de producción con actor y PostgreSQL reales,
**no acredita cobertura HTTP ni middleware**. Las transferencias usan el
productor inmediato real, no el flujo documental completo de salidas.
Las cancelaciones son de tickets **no cobrados**, no reembolsos.
Los cierres representan conteos simulados exactos, no arqueos humanos reales.

## Intento previo preservado

`failed-attempt-clock-resume/` conserva byte por byte el intento previo con
29 días completos, interrupción por timeout y error de reloj del arnés al
reanudar el día 30. **No se presenta como defecto de producto ni como PASS**.
No se reparó su historia: MAIN restauró una copia fresca y el intento aceptado
se ejecutó desde cero. El arnés corregido no restablece el reloj de una fecha
ya en curso y admite pausas explícitas en límites diarios.

## Reproducción (sólo después de preparar otra copia fresca)

MAIN controla la restauración y el arranque del postmaster exclusivo; el launcher
lee las credenciales privadas, nunca incluidas en resultados. No volver a ejecutar
la prueba del reloj contra una simulación en curso.

```sh
node reports/tanda-g-ampliada/tarea-3/build.mjs
node reports/tanda-g-ampliada/tarea-3/clock/launch.mjs harness --through-day=10
node reports/tanda-g-ampliada/tarea-3/clock/launch.mjs harness --resume --through-day=20
node reports/tanda-g-ampliada/tarea-3/clock/launch.mjs harness --resume --through-day=30
node reports/tanda-g-ampliada/tarea-3/summarize.mjs
```