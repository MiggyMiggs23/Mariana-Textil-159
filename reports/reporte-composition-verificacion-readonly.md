# Verificación numérica de composición de Reportes (solo lectura)

## Estado

**COMPARACIÓN FINAL COMPLETADA — SOLO LECTURA.** Se ejecutó con
`REPORT_SCOPE_COMPLETE=1 --final --scope-complete` después de recibir el
contrato explícito de alcance completo. La lectura terminó en una sola
transacción `READ ONLY REPEATABLE READ`; no se hicieron escrituras ni se
iniciaron workflows.

## Script

`artifacts/api-server/src/scripts/verify-report-composition-readonly.ts`

No es un módulo `.test`: así evita la guardia que deshabilita la base de datos
de la aplicación en los procesos de prueba. El arnés:

1. crea una copia temporal del código legacy desde `BASELINE_REF` (`HEAD^` por
   omisión), sin sustituir archivos vigilados;
2. importa el código actual y el legacy en el mismo proceso;
3. toma una sola conexión y ejecuta
   `READ ONLY REPEATABLE READ`;
4. redirige el pool de la aplicación exclusivamente a esa conexión y rechaza
   `INSERT`, `UPDATE`, `DELETE`, DDL, inicializadores y otras sentencias de
   escritura;
5. descubre, mediante `SELECT`, un año con ventas cobradas/autorizadas reales
   en al menos dos sitios. Prefiere 2026 y, si no hay población, selecciona el
   año observado más reciente. No crea ni copia filas;
6. ejecuta legacy y actual para global, sitio 1 y sitio 2 con el mismo rango;
7. compara Ventas/cancelaciones contra Control, pero compara CajaDiferencias
   standalone contra `getDifferences` actual. Control no se trata como un
   segundo consumidor de caja;
8. compara abonos por filtros actuales de fecha/sitio/fuente y filas/totales
   semánticos. La paginación puede diferir cuando el lado nuevo lee todas las
   páginas;
9. registra en el informe solo números, IDs, hashes y estados; no guarda filas,
   URLs, credenciales, nombres de cajeros ni nombres de clientes.

## Métricas exigidas

Cada alcance contiene objetos con dos valores numéricos explícitos, `old` y
`new`, para:

- Ventas y tickets;
- cancelaciones: conteo e importe;
- caja: conteo de faltantes, importe faltante y diferencia neta;
- abonos incongruentes: conteo e importe;
- escenario adicional de umbral de caja
  (`umbralCorte=500`, `umbralTienda=500`, agrupación mensual). La comparación
  normal de CajaDiferencias usa los parámetros reales del consumidor
  (`0`, `0`, agrupación semanal).

Las filas completas de cancelación y las filas comunes de abonos se comparan
en memoria con `deepEqual` después de eliminar únicamente campos de enlace
(`*Href`) y normalizar sus nombres de origen. El informe guarda los conteos y
hashes de ambos lados, nunca los datos personales de las filas.

## Resultado de la ejecución extendida

La ejecución final quedó registrada con:

- `baselineRef`: `52cebd73dfe6aa11dfad4df048552b1d023c0a37`;
- año seleccionado: `2026`;
- alcances: global, sitio 1 y sitio 2;
- estado: `READ_ONLY_SNAPSHOT_COMPLETED`;
- secciones preservadas inspeccionadas: `ventas`, `utilidad`, `inventario`,
  `mapas-calor`, `color`, `compras`, `clientes`, `pagos-dirigidos` y
  `que-comprar`;
- secciones/tablas faltantes: ninguna; los nueve IDs de sección estuvieron
  presentes en ambos lados y cada tabla coincidente conserva su conteo.

La comparación por identidad empareja KPI por `id`, tablas/gráficas por `id`,
columnas por `key` y filas por clave de negocio más columnas compartidas. Las
53 tablas genéricas de cada alcance (18 `ventas`, 13 `utilidad`, 4 `inventario`, 0
`mapas-calor`, 3 `color`, 7 `compras`, 6 `clientes`, 1 `pagos-dirigidos` y 1
`que-comprar`) conservaron sus IDs y conteos en ambos lados; el informe
registra este desglose en `genericTablePreservation`.

Las métricas numéricas principales y las filas semánticas de caja, abonos,
cancelaciones y alertas coincidieron en los tres alcances. Las columnas
visibles de `ventas.cancelaciones` conservan exactamente el layout legacy;
`ticketId`, `canceladoAt` y `documentoHref` permanecen únicamente en el
payload de filas para evidencia/Control y no se publican como columnas de
Ventas. La columna visible `folio` conserva `hrefKey: "documentoHref"` para
abrir el ticket exacto mediante el renderer nuevo. No hay columnas nuevas sin
autorización: al comparar las columnas visibles compartidas por clave de
negocio, `ventas.identityEqual` y `ventas.actualMetricEqual` son verdaderos.

En `compras`, la salida legacy tenía un KPI duplicado `compras` además de
`costo`. El verificador permite su eliminación únicamente bajo R01 después de
afirmar `old compras.value === old costo.value`; esa excepción queda en
`authorizedStructuralExceptions`. Las diferencias posicionales crudas se
conservan en `rawNumericDifferences`, pero no se clasifican como cambios de
dinero. Los valores existentes emparejados por ID fueron:

- global: `costo=543533`, `cantidad-metro=29279`, `rollos=226`,
  `concentracion=73.13263408109535`;
- sitio 1: `costo=146033`, `cantidad-metro=14279`, `rollos=76`,
  `concentracion=56.003095190813035`;
- sitio 2: `costo=0`, `rollos=0`, `concentracion=0` (sin KPI
  `cantidad-metro`).

En los tres alcances `compras.identityEqual` y `compras.actualMetricEqual`
son verdaderos. Cualquier cambio real de importe/cantidad/conteo se reportaría
en `actualMetricDifferences`; no se enmascara por posición ni por una
normalización de filas. Los valores emparejados y existentes quedan además
en `comparison.actualMetricSnapshot.kpis` y los totales compartidos en
`comparison.actualMetricSnapshot.tableTotals`.
`genericRawStructuralEqual` queda en `false` únicamente por la eliminación
autorizada del KPI legacy duplicado R01; `genericSectionsEqual` usa la
comparación por identidad y queda en `true`.

### Mapa completo de fuentes

El conteo total no se limita a las 53 tablas genéricas. El campo
`composedSourceMap` confirma los IDs y conteos del mapa compuesto real:
`53` tablas y `13` gráficas genéricas, `2` tablas y `2` gráficas de
Diferencias de Caja, y la fuente X04 con `1` tabla y `3` gráficas. El total
es `56` tablas y `18` gráficas (`53+2+1` y `13+2+3`). La captura de datos
reales de caja pertenece al snapshot principal; X04 tiene además una
ejecución aislada de datos reales documentada abajo.

### Evidencia X04 aislada

Sin repetir las 53 comprobaciones numéricas, el modo
`--x04-only --final --scope-complete` comparó el `compareStores` legacy y
actual para el global exacto del año 2026 dentro de otra única transacción
`READ ONLY REPEATABLE READ`. `sourceRawEqual=true` y
`sourceTotalsEqual=true`; ambos lados devolvieron 3 tiendas, 3 puntos diarios
y los mismos totales completos: ventas/subtotal `103302.00`, costo
`86822.00`, margen `16480.00`, tickets `4`, ticket promedio `25825.50`,
cancelaciones `0`, metros `4986.000`, efectivo `103302.00`, transferencia y
crédito `0.00`, facturado `0.00`, diferencia de caja `0.00` y participación
`100.00` (los demás campos raw también se comparan en el informe privado).

La exportación compuesta `x04-comparativo-tiendas` produjo sus 12 columnas,
3 filas y Total General, con `sourceOwnedTotals=true` y
`exportTotalsEqual=true`: usa los totales y desgloses propiedad de
`compareStores` y no los recomputa. El resumen está en
`/tmp/reportes-composition-x04-final.json`; sus payloads privados están en
`/tmp/reportes-composition-x04-final.json.payloads.json` con modo `0600`.
Este pase numérico es distinto de las comprobaciones parciales de contrato UI
read-only, que pasaron con autenticación y respuestas interceptadas sin login ni
escrituras de DB. No son una E2E autenticada viva ni una publicación.

### Resultado UI parcial y límites

El navegador pasó las cinco pestañas normales y Comparar en las cinco sobre
`TIENDA` y `BODEGA`, con un solo selector de sitio. También pasaron el sitio
seleccionado, los parámetros GET de XLSX/PDF, las tres rutas legacy,
`ADMIN`/`PROPIA`, `non-ADMIN` con Comparar deshabilitado para `TODAS`, y
`non-ADMIN` sin Control. Mobile de 402 px no presentó overflow de documento.
La forma inicial del mock de caja se corrigió durante la captura; no era un
defecto de la aplicación.

Las filas capturadas de cancelaciones, abonos, ajustes y detalle de corte
fueron cero: se validaron sus contratos, pero no hubo click-through real de
documentos. Tampoco hubo E2E autenticada viva ni bytes reales de descarga de
XLSX/PDF. La vista previa real del screenshot tool mostró login, esperado para
una sesión no autenticada, y no prueba los reportes. Este resultado UI es
independiente y no se suma artificialmente a la evidencia separada de las 53
tablas genéricas, caja/cancelaciones y X04.

Los paths, celdas numéricas, conteos estructurales y hashes están en
`/tmp/reportes-composition-final.json`; los payloads completos están únicamente
en `/tmp/reportes-composition-final.json.payloads.json` con modo `0600`.

### Escenario de cancelación no persistido

El escenario se ejecutó dentro de un CTE por sentencia, usando el SQL
compartido de `loadCancellationRows`, dos productos reales con unidades
distintas (`METRO` y `KILO`) y sin insertar filas. Incluyó un caso con fecha
contabilizada dentro del rango y fecha de cancelación fuera del rango; también
comprobó la exclusión de un cancelado sin timestamp contabilizado/pago y de un
caso con fecha contabilizada fuera del rango. En global, sitio 1 y sitio 2,
legacy Sales, current Sales y current Control produjeron exactamente un ticket
único, importe `150`, y dos filas/líneas semánticas. Los resúmenes por
modalidad fueron `ROLLOS: 1 ticket / 100` y `METRAJE: 1 ticket / 50`; por eso
la suma de tickets por categoría es `2`, distinta del conteo global único de
tickets `1`. El resumen se conserva como métricas separadas y no se confunden.

Las filas crudas no son `deepEqual` porque legacy no expone las columnas
adicionales del consumidor actual; esa diferencia de forma se registra como
`rawRowsEqualBeforeShapeMapping: false`. Después de comparar solamente los
campos semánticos comunes (`folio`, modalidad, motivo, sitio, líneas e
importe), `rowsEqualAcrossConsumers: true`. Control no tiene tabla de resumen
por modalidad (`controlCategoryTablePresent: false`) porque su consumidor
actual solo consume las filas de cancelación; esto no se trata como una fuente
de caja ni como una diferencia oculta.

## Comandos autorizados

Captura inicial (si se necesita repetirla):

```sh
pnpm --filter @workspace/api-server exec tsx \
  src/scripts/verify-report-composition-readonly.ts --capture-before
```

Comparación final:

```sh
REPORT_SCOPE_COMPLETE=1 pnpm --filter @workspace/api-server exec tsx \
  src/scripts/verify-report-composition-readonly.ts \
  --final --scope-complete
```

Comparación aislada X04 (sin repetir las comprobaciones genéricas):

```sh
REPORT_SCOPE_COMPLETE=1 pnpm --filter @workspace/api-server exec tsx \
  src/scripts/verify-report-composition-readonly.ts \
  --x04-only --final --scope-complete
```

La captura inicial escribe `/tmp/reportes-composition-before.json` y la
comparación final `/tmp/reportes-composition-final.json`. Cada ejecución
también escribe el payload completo de las fuentes en
`<salida>.payloads.json` con modo `0600`, para mocks locales de navegador; ese
archivo no se imprime ni se incluye en el informe resumido. Se puede elegir
otro destino no persistente con `REPORT_VERIFY_OUTPUT` y
`REPORT_VERIFY_PAYLOAD_OUTPUT`. Si falta `DATABASE_URL`, si no aparecen dos
sitios con valores reales o si falta el contrato final, el proceso se bloquea;
no hay fallback sintético silencioso.

## Bloqueadores conocidos

- La población de `development` puede no contener dos sitios con ventas
  cobradas/autorizadas en un mismo año. En ese caso el script reportará el
  bloqueo exacto y no usará CTEs sintéticos como sustituto de datos reales.
- La ejecución final seleccionó 2026 y dos sitios reales, con tres alcances:
  global, sitio 2 y sitio 1. El resumen está en
  `/tmp/reportes-composition-final.json`; los payloads privados están en
  `/tmp/reportes-composition-final.json.payloads.json`.
- Control no exige ni lee tablas de caja. La única fuente de caja comparada es
  la llamada standalone de `CajaDiferencias` a `getDifferences`, con el
  alcance construido por `applyReportScope`/`resolveReportRange`.
