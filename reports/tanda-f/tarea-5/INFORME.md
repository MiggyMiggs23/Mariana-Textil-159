# Tanda F — tarea 5: diagnóstico de reversos

## Alcance y ejecución

Se verificó la lista actual de `replit.md:863–878`. Se ejecutaron diez casos contra **tanda_f_reversal** exclusivamente, en PostgreSQL privado 16, puerto 55440. Identidad de proceso, directorio y conexión registrada en cada caso y comprobada antes de cada transacción. El guard real `REQUIRE_ISOLATED_TEST_DATABASE` validó preparación y separación respecto de `tanda_f_witness`. No se cambió código operativo, triggers, permisos ni compuertas. No se arrancó ninguna aplicación.

Las invocaciones son de los **productores reales** (`crearSalida`, `enviarSalida`, `recibirSalida`, `crearTicket`, `cancelarTicket`, `ajustarRollo`, `venderRollo`, `revertirMovimiento`) contra PostgreSQL real; **no son llamadas HTTP ni una prueba de autorización del router**. El actor es el ADMIN sintético nativo. Los rollos tienen proveedor, entrada y recepción nativos del manifiesto. Cantidades reducidas a 10 y ajustes de 2, sin alterar la secuencia del ejemplo.

Cada paso se confirmó en transacción independiente y se consultaron después rollo, movimientos firmados, documento y balances por producto/sitio/unidad. `available_roll_sum` incluye DISPONIBLE; `inventory_roll_sum` incluye DISPONIBLE y EN_TRANSITO. No se agregan unidades distintas. El caché coincidió con el ledger después de todos los pasos: **eso no demuestra integridad del estado del rollo**.

## Resultado por vía

| Caso | Resultado real | Paso iniciador y evidencia |
|---|---|---|
| 1 RECEPCION después de traslado | REPRODUCIDO | Reverso 7370: rollo 6233 queda PROGRAMADO, 0, en B; discrepancia nueva ledger−rollos A=−10, B=+10. Se ensayó RECEPCION, no una segunda variante ALTA. |
| 2 VENTA administrativa tras restitución | REPRODUCIDO | Tras vender 6234 en B, reverso salida 7471 lo hace DISPONIBLE en B y suma 10 en A. Reverso venta 7475 agrega otros 10 en B sin otro rollo. La primera alteración ocurre al revertir 7471; la venta amplifica el respaldo contable. |
| 3 Ticket parcial y remanente trasladado | BLOQUEADO, no reproducido | `crearTicket` rechaza `METREADO_NO_HABILITADO`: el producto sintético no permite venta por metro. No se habilitó el producto ni se fabricó ticket/venta. No hubo ticket ni traslado ni cancelación. Esta evidencia no prueba que la vía sea segura. |
| 4 TRANSFERENCIA_SALIDA recibida | REPRODUCIDO | Reverso 7478 agrega 10 a A conservando el rollo 6236 en B y la salida RECIBIDA. Se ensayó después de recibir, no la variante previa en T. |
| 5 TRANSFERENCIA_ENTRADA recibida | REPRODUCIDO | Reverso 7486 deja rollo 6237 EN_TRANSITO, 10, en B y documento RECIBIDA; resta 10 del ledger B. No se ensayó la variante entrada a T antes de recepción. |
| 6 Ajuste positivo consumido por BAJA | REPRODUCIDO, persistencia confirmada | 10→12→BAJA 0→reverso 7488: PostgreSQL **acepta y confirma −2 DISPONIBLE** en rollo 6238. No hubo rechazo de constraint. Es defecto de cantidad/estado incluso cuando la variación ledger−rollos no cambia. |
| 7 Ajuste negativo antes de otra BAJA | REPRODUCIDO | 10→8→BAJA 0→reverso 7491: rollo 6239 queda 2 DISPONIBLE, mientras BAJA −8 sigue vigente. Sumas no detectan esta dependencia semántica. |
| 8 BAJA manual EN_TRANSITO | REPRODUCIDO | Envío a T, BAJA, reverso 7496: 6240 queda 10 DISPONIBLE en ubicación técnica T=8 y salida EN_TRANSITO. Sumas se conservan, estado no. |
| 9 Reverso de CANCELACION | REPRODUCIDO | Ajuste +2, reverso, reverso de cancelación 7499: rollo 6241 permanece 10; ledger/caché de KILO en A sube de 80 a 82, rollos quedan 80. |
| 10 DEVOLUCION histórica | BLOQUEADO, sin filas | Consulta real `count(*) where tipo='DEVOLUCION'` devuelve 0. No se inventó un productor ni una fila histórica. No se afirma reproducción ni PASS. |

## Interpretación y límites

Ocho reproducciones confirmadas; dos bloqueadas/no reproducidas. Todos los casos terminaron en segundos, por debajo del límite individual de doce minutos. El clúster ya estaba disponible al comenzar, por lo que no fue necesario esperar cuatro minutos.

Los casos 1–8 usan rollos diferentes del mismo producto METRO, de forma secuencial. **No parten de un balance global limpio después del caso 1**: cada JSON incluye su baseline y cada paso; `comparisons.json` resta la discrepancia del paso anterior para no atribuir a otro caso un defecto acumulado. Los movimientos del rollo y documentos permiten separar causalidad. Caso 9 usa KILO independiente. No se hizo teardown ni se corrigieron los estados resultantes.

## Evidencia y reproducción

- `case-1.json` … `case-10.json`: transacciones, errores, identidades, snapshots reales.
- `comparisons.json`: conciliación por paso, incluyendo cambio de discrepancia respecto del paso previo.
- `reconciliation.sql`: SQL exacto con parámetro `$1` producto.
- `run.ts`, `run-case.sh`: ejecutar **un caso** con `bash reports/tanda-f/tarea-5/run-case.sh N`; timeout 720 segundos. Requiere una copia desechable nativa fresca con el mismo manifiesto en el mismo nombre/puerto; no repetir sobre rollos ya consumidos.
- `node reports/tanda-f/tarea-5/analyze.mjs`: recalcular comparaciones sin conectar a ninguna base.

Se preservó el guard y la separación de base; el runner no instala fixtures ni modifica configuración. El primer intento de cargar TS falló antes de conectar por formato CJS; se declaró ESM únicamente en la carpeta del diagnóstico y se ejecutó correctamente. No se considera ese error evidencia de una vía.