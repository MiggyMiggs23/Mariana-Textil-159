# Bloque 7 — Comparación de duplicidades entre reportes

**Estado:** informe de comparación pendiente de aprobación para cualquier retiro adicional.  
**Corte de código:** `HEAD` `76d9c58` (`2026-09-12 01:15:43 UTC`).  
**Alcance de esta tarea:** lectura de código, documentación y revisión de historia Git. No se modificó código de la aplicación, no se retiró ninguna tabla, no se retiró ninguna pestaña y no se ejecutaron verificaciones de runtime.

## Decisión que sí está autorizada

La conversación anterior autorizó **únicamente** el movimiento de **Mes × color**. Esa autorización no se extiende a las tablas o gráficos con coincidencia parcial, ni a ningún retiro futuro. Por ello este documento:

- documenta el movimiento que ya aparece en el árbol actual;
- entrega por primera vez la comparación detallada solicitada por el Bloque 7, porque no se encontró un reporte completo anterior de esta comparación;
- no convierte el resumen histórico de `replit.md` ni la autorización de Mes × color en aprobación retroactiva de otros cambios;
- conserva como recomendación todas las tablas y gráficos que no son una coincidencia completa.

La regla de origen es el archivo adjunto **`attached_assets/Pasted--Prompt-para-Replit-Agent-Motor-de-stock-m-nimo-y-repor_1789172788993.txt`**, Bloque 7, líneas 82–90: revisar primero, retirar solo después de aprobación y avisar si una pestaña queda sin contenido propio. El mismo prompt excluye Ventas, Utilidad y Márgenes, Clientes y Crédito, Pagos Dirigidos, Diferencias de Caja y Comparativo entre Sitios (líneas 86–88); este informe no los analiza.

## Resultado ejecutivo

| Hallazgo | Resultado verificable |
|---|---|
| Coincidencia completa (`FULL`) | **Una:** Mes × color. Es el único gráfico autorizado para moverse y el historial muestra que pasó de Mapas de Calor a Qué comprar. |
| Coincidencias parciales (`PARTIAL`) | Hay señales y dimensiones compartidas entre Qué comprar y tablas/gráficos de Color, Inventario, Mapas y Compras, pero cambian la granularidad, el periodo, el significado de la cantidad, el alcance por sitio, la modalidad o la procedencia. No son seguros para retirar. |
| Sin coincidencia (`NONE`) | Costos, proveedores, alternativas de proveedor, aumentos de precio, pérdidas extraordinarias y cierres diarios no aparecen como el mismo dato en Qué comprar. |
| Tablas retiradas | **Ninguna.** |
| Pestañas retiradas | **Ninguna.** |
| Estado de un reporte Bloque 7 previo | **No se encontró un reporte comparativo completo previo.** Existe documentación de verificación de stock mínimo y un resumen en `replit.md`, pero no la matriz original vs. Qué comprar con evidencia por tabla/gráfico. |

El resumen preexistente en `replit.md:749` dice que se trasladó únicamente Mes × color y que no se retiró ninguna tabla ni pestaña. `docs/stock-minimos-verificacion.md:1-26` documenta la verificación del motor y del reporte Qué comprar, no el inventario comparativo de Bloque 7; su cierre también registra que ninguna tabla ni pestaña fue retirada. Se conserva esa evidencia como antecedente, no como sustituto de este informe ni como autorización para ampliar el alcance.

## Cómo se clasificó el solapamiento

- **FULL:** mismo artefacto conceptual, mismos ejes o grano y mismo propósito. Es el caso en que sería razonable mover una sola copia.
- **PARTIAL:** comparte una dimensión, señal o decisión, pero no el mismo conjunto de hechos. Cambiar la pestaña eliminaría información, cambiaría el significado de una cifra o impediría comparar el resultado original.
- **NONE:** no existe el mismo resultado; compartir etiquetas como SKU, color o cantidad no basta.

Cuando una coincidencia es parcial, la propuesta es **conservar el original y conservar Qué comprar**. No se recomienda resolver una coincidencia parcial eliminando una tabla.

## Qué contiene actualmente Qué comprar

El nuevo reporte no es solo una tabla de ventas. Su backend construye un renglón por producto y sitio con:

- identidad: SKU, tela, color, unidad y sitio;
- doce columnas `consumoMesNN`;
- venta real al cliente;
- existencia, mínimo, días de cobertura de existencia y del mínimo;
- déficit observado (explícitamente no es una cantidad a pedir);
- meses de historia, días observados, señal de no movimiento, meses sin movimiento, bajo mínimo y episodios bajo mínimo;
- observación/sugerencia y URL de evidencia.

La definición de esos campos está en `artifacts/api-server/src/lib/reportes-que-comprar.ts:386-453` y las columnas en `:914-949`. La UI confirma el grano y las columnas en `artifacts/mariana-textil/src/components/reportes/que-comprar-report.tsx:518-554`. El sistema advierte que consumo y venta real son cifras diferentes (`.../que-comprar-report.tsx:466-476`): consumo incluye salidas y traslados del sitio; venta real solo usa la venta documentada al cliente.

Qué comprar también contiene el gráfico `mes-color` (`reportes-que-comprar.ts:889-913`) y lo presenta como venta real al cliente por mes y color (`que-comprar-report.tsx:666-674`). Su evidencia de renglón conserva ecuación, filtros, movimientos, episodios, episodios arrastrados, eventos y conciliación (`reportes-que-comprar.ts:969-1018, 1117-1163`; UI `que-comprar-report.tsx:768-905`).

## Matriz comparativa completa

Las líneas citadas son del árbol actual, salvo donde se indica expresamente un archivo histórico de Git. “Qué comprar” se refiere al backend `buildQueComprarReport` y a la UI específica, no a una interpretación del título.

### Análisis de Color

| Pestaña / artefacto original | Evidencia original y campos | Qué comprar: evidencia y campos comparables | Solapamiento | Diferencia que impide retirarlo | Acción propuesta |
|---|---|---|---|---|---|
| `color-tela` — gráfico Color × tela | `artifacts/api-server/src/lib/reportes-inventory.ts:219-231`. Matriz `color` × `tela`, cantidad de ventas, más tablas por color/tela/modalidad/unidad y sin movimiento. | `reportes-que-comprar.ts:410-418, 449-452` conserva tela y color por producto-sitio y consumo mensual; el único heatmap nuevo es mes × color (`:900-912`). | **PARTIAL** | Qué comprar no genera una matriz tela × color ni agrega por tela; su mes × color tiene otra dimensión temporal y su heatmap usa venta real documentada. | Conservar `color-tela`; no trasladar ni borrar. |
| `ranking-color` — Ranking color por tela, modalidad y unidad | `reportes-inventory.ts:222-230`. Campos: color, tela, modalidad, unidad, cantidad y ventas. | `reportes-que-comprar.ts:932-946` tiene color, tela y unidad por producto-sitio, consumo mensual, venta real al cliente, existencia y señales; no tiene modalidad ni ranking agregado por color. | **PARTIAL** | La tabla original responde qué color/tela/modalidad vendió; Qué comprar responde qué producto-sitio necesita contexto de compra. La cantidad original proviene de tickets filtrados; el consumo nuevo incluye salidas y traslados. | Conservar ranking y tabla de Qué comprar. No tratar color compartido como duplicidad. |
| `color-sitio` — Color por sitio | `reportes-inventory.ts:227-231`. Agrupa color, sitio, modalidad, unidad y cantidad. | El renglón nuevo tiene sitio, producto, color, unidad, consumo por mes, venta real y existencia (`reportes-que-comprar.ts:410-430`). | **PARTIAL** | Qué comprar no es un agregado color-sitio y no expone modalidad; añade mínimo/cobertura/evidencia y separa consumo de venta real. | Conservar `color-sitio`; no retirar. |
| `sin-movimiento-90` — Sin movimiento ≥90 días | `reportes-inventory.ts:225-231`. Lista color, tela, unidad y último movimiento; el corte es 90 días y no tiene modalidad. | Qué comprar marca `noMovimiento` y `mesesSinMovimiento` por producto-sitio, calculados como meses consecutivos finales sin consumo (`reportes-que-comprar.ts:314-323, 407-430`). | **PARTIAL** | No es el mismo grano ni el mismo corte: uno es producto/color sin sitio explícito y fecha de último movimiento; el otro es producto-sitio, meses finales de consumo y además contexto de mínimo. | Conservar ambos; si se desea unificar la nomenclatura, hacerlo en una propuesta futura separada, no retirar. |

### Inventario y Rotación

| Pestaña / artefacto original | Evidencia original y campos | Qué comprar: evidencia y campos comparables | Solapamiento | Diferencia que impide retirarlo | Acción propuesta |
|---|---|---|---|---|---|
| `existencia-producto` — treemap | `artifacts/api-server/src/lib/reportes-inventory.ts:359-362`. Visualiza existencia por SKU, con cantidad. | Qué comprar muestra `existenciaActual` en cada renglón producto-sitio (`reportes-que-comprar.ts:418-425, 934-939`), pero no treemap. | **PARTIAL** | Un campo de existencia no sustituye el treemap ni su lectura visual por SKU; además Qué comprar queda restringido a sitios habilitados para stock mínimo. | Conservar treemap y columna de existencia. |
| `cierres-diarios` — Cierre diario de inventario | `reportes-inventory.ts:261-274, 362`. Línea diaria reconstruida desde existencia y movimientos, condicionada a conciliación. | Qué comprar tiene meses y periodo observado, no cierre diario ni reconstrucción diaria. | **NONE** | No existe el eje día ni la conciliación de cierres en Qué comprar. | No mover ni retirar. |
| `existencia-actual` — Existencia actual y rotación por modalidad | `reportes-inventory.ts:233-254, 363`. Campos: cantidad, rollos, valor, salida ROLLOS, salida METRAJE, coberturas separadas, clasificación y estimaciones de falta de existencia. | Qué comprar: existencia, mínimo, cobertura de existencia y mínimo, consumo mensual y venta real (`reportes-que-comprar.ts:401-445, 932-946`). | **PARTIAL** | Qué comprar no expone valor, conteo de rollos, clasificaciones ROLLOS/METRAJE ni días sin existencia estimados; su cobertura usa consumo histórico por sitio y no reemplaza coberturas por modalidad. | Conservar la tabla de rotación completa y la de Qué comprar. |
| `perdidas-extraordinarias` — Pérdidas extraordinarias | `reportes-inventory.ts:292-320, 364`. Motivo MERMA/ROBO/MUESTRA, producto, sitio, cantidad y costo congelado. | No hay motivo de pérdida, ajuste extraordinario ni costo en la tabla de Qué comprar (`reportes-que-comprar.ts:928-949`). | **NONE** | Qué comprar no pretende auditar pérdidas ni costo. | No mover ni retirar. |
| `comprado-vendido` — Comprado vs vendido | `reportes-inventory.ts:282-290, 365`. Comprado, vendido y ajuste negativo por producto/tela/color/unidad/sitio. | Qué comprar tiene consumo mensual, venta real y producto-sitio (`reportes-que-comprar.ts:410-451`), pero no comprado, relación, diferencia ni ajuste negativo. | **PARTIAL** | La tabla original contrasta entradas contra salidas; Qué comprar explica reposición con historia, mínimo y cobertura. El consumo puede incluir traslado y no equivale a comprado ni a venta real. | Conservar la comparación comprado-vendido; no eliminarla. |
| `sin-movimiento` — Inventario sin movimiento | `reportes-inventory.ts:321-324, 366`. SKU, tela, color, unidad, último movimiento y banda de antigüedad. | Qué comprar marca no movimiento y meses finales por producto-sitio (`reportes-que-comprar.ts:407-430, 942-946`). | **PARTIAL** | El original conserva fecha y banda (<30, 30–59, 60–89, 90–179, 180+); Qué comprar muestra una señal mensual y no sustituye la antigüedad de inventario. | Conservar ambos; no borrar la banda de antigüedad. |

### Mapas de Calor

| Pestaña / artefacto original | Evidencia original y campos | Qué comprar: evidencia y campos comparables | Solapamiento | Diferencia que impide retirarlo | Acción propuesta |
|---|---|---|---|---|---|
| `mes-producto` — Mes × SKU | Antes del movimiento, `git show 9fc5517^:artifacts/api-server/src/lib/reportes-inventory.ts`, líneas 194–217; era un heatmap de cantidad mensual por SKU. En el árbol actual `reportes-inventory.ts:194-217` sigue generando `mes-producto`. | La tabla nueva tiene doce columnas de consumo por producto-sitio (`reportes-que-comprar.ts:914-918, 932-946`), pero no un heatmap por SKU. | **PARTIAL** | Comparte la tendencia mensual y el identificador de producto, pero cambia de gráfico agregado por SKU a tabla por producto-sitio; además el heatmap original usa líneas de tickets y Qué comprar separa consumo de venta real. | Conservar `mes-producto`; no reemplazarlo por columnas de Qué comprar. |
| `mes-color` — Mes × color | Antes: `git show 9fc5517^:artifacts/api-server/src/lib/reportes-inventory.ts:194-217`; `make("mes-color", "color")` usaba meses, color y cantidad. | Ahora: `reportes-que-comprar.ts:889-913` construye `id: "mes-color"`, título “Mes × color · venta real al cliente”, eje `color`/`mes` y cantidad de movimientos de venta real. UI: `que-comprar-report.tsx:666-674`. | **FULL — MOVED** | Es el mismo cruce visual y propósito de estacionalidad por color. La fuente está deliberadamente afinada: en Qué comprar solo cuentan movimientos `VENTA` con documento POS reconocido (`reportes-que-comprar.ts:20-34, 284-290`), no cualquier remoción física. | **Mantener el movimiento ya autorizado.** No agregar otra copia y no retirar tablas parciales. |
| `mes-tela` — Mes × tela | `reportes-inventory.ts:194-217` genera el heatmap actual con eje tela, mes y cantidad. | Qué comprar incluye tela como identidad de fila y consumo mensual, no un heatmap agregado por tela (`reportes-que-comprar.ts:410-451, 914-918`). | **PARTIAL** | El eje tela aparece como atributo del renglón, pero no como la serie agregada del gráfico; no son intercambiables. | Conservar `mes-tela`. |
| `mes-sitio` — Mes × sitio | `reportes-inventory.ts:194-217` genera el heatmap actual con eje sitio, mes y cantidad. | Qué comprar es por producto-sitio, de modo que el sitio aparece en cada fila, pero no existe heatmap agregado por sitio (`reportes-que-comprar.ts:776-887, 900-949`). | **PARTIAL** | La tabla no responde la tendencia mensual total de cada sitio y el alcance de Qué comprar depende de sitios habilitados. | Conservar `mes-sitio`. |
| Tablas de Mapas de Calor | La rama `mapas-calor` devuelve `tables: []` (`reportes-inventory.ts:194-217`). | Qué comprar sí devuelve una tabla y un heatmap (`reportes-que-comprar.ts:920-949`). | **NONE** para tablas | No hay tabla original que retirar de esta pestaña. | No crear ni retirar tablas en Mapas de Calor. |

### Compras

| Pestaña / artefacto original | Evidencia original y campos | Qué comprar: evidencia y campos comparables | Solapamiento | Diferencia que impide retirarlo | Acción propuesta |
|---|---|---|---|---|---|
| `costo-por-rollo` — Costo unitario por rollo y compra | `artifacts/api-server/src/lib/reportes-commercial.ts:99-119, 154-157`. Línea de costo unitario por fecha y detalle de folio, proveedor, rollo, costo unitario y total. | Qué comprar no tiene costo, proveedor, folio ni serie (`reportes-que-comprar.ts:928-949`). | **NONE** | Es recepción y costo histórico; no es consumo ni cobertura. | No mover ni retirar. |
| `compras-por-rollo` | `reportes-commercial.ts:156-157`. Folio, fecha, proveedor, SKU, tela, color, unidad, serie, cantidad y costos. | Qué comprar solo comparte identidad de producto/color/unidad, no hechos de recepción ni costo. | **NONE** | El renglón producto-sitio no prueba una compra ni contiene rollo/serie. | No retirar. |
| `proveedores` — Compras por proveedor | `reportes-commercial.ts:107-109, 158`. Proveedor, unidad, rollos, costo y concentración. | No hay proveedor, rollos recibidos ni concentración en Qué comprar. | **NONE** | Decisión de abastecimiento por proveedor y costo no está cubierta. | No mover ni retirar. |
| `productos` — Compras por producto | `reportes-commercial.ts:110-111, 159`. Cantidad recibida, rollos, costo, costo de referencia metreado, estado y rollos de referencia. | Qué comprar tiene SKU/tela/color/unidad y cantidades de consumo/venta, pero no cantidad recibida, rollos ni costos (`reportes-que-comprar.ts:932-946`). | **PARTIAL** | Comparte la identidad del producto, no el hecho económico: recepción entrante vs. salida/venta y cobertura. | Conservar la tabla de compras por producto y la tabla nueva. |
| `telas` — Compras por tela y unidad | `reportes-commercial.ts:112, 160`. Cantidad, rollos y costo de recepciones por tela. | Qué comprar no agrega por tela ni muestra costo/rollos de recepción. | **NONE** | Que una fila tenga tela como atributo no reproduce compras por tela. | No retirar. |
| `colores` — Compras por color y unidad | `reportes-commercial.ts:113, 161`. Cantidad, rollos y costo recibidos por color/unidad. | Qué comprar muestra color/unidad por producto-sitio, consumo y venta, sin entradas, rollos ni costo. | **PARTIAL** | Solo coincide el eje de identidad; la cantidad tiene dirección contraria y no es un duplicado de compras recibidas. | Conservar tabla de compras por color. |
| `incrementos` — Aumentos mayores a 10% | `reportes-commercial.ts:114-117, 162`. Fecha, SKU, proveedor, costo anterior/actual e incremento. | Qué comprar no calcula precio ni incremento. | **NONE** | Es una alerta de costo de compra, no una señal de existencia o movimiento. | No mover ni retirar. |
| `alternativas-proveedor` — Alternativas de proveedor | `reportes-commercial.ts:120-125, 163`. Proveedor, costo unitario y ahorro potencial por SKU/tela/color/unidad. | Qué comprar no consulta proveedores, precios ni ahorro. | **NONE** | No hay ningún campo comparable de proveedor/costo. | No mover ni retirar. |

## Evidencia específica de Mes × color: qué se movió y qué no

1. **Estado original.** En el padre de `9fc5517`, la rama de Mapas construía cuatro heatmaps: `mes-producto`, `mes-color`, `mes-tela` y `mes-sitio` (`git show 9fc5517^:artifacts/api-server/src/lib/reportes-inventory.ts`, líneas 194–217).
2. **Cambio exacto.** El commit `9fc5517` quitó únicamente `make("mes-color", "color")` del arreglo de gráficos de Mapas. El diff es una sustitución de la lista de gráficos; no borra la consulta, las tablas de Color, la rama de Inventario ni ninguna tabla de Compras.
3. **Destino actual.** La implementación de Qué comprar crea un solo chart `id: "mes-color"` con eje color/mes y `venta real al cliente` (`reportes-que-comprar.ts:889-913`). La UI lo muestra en la tarjeta “Venta real al cliente por mes y color” (`que-comprar-report.tsx:666-674`).
4. **Cambio de semántica documentado.** El mapa original sumaba `ticket_lineas.cantidad` dentro del alcance de ventas de Reportes (`reportes-inventory.ts:198-214`, estado actual para los otros mapas). El nuevo mapa parte de movimientos de ledger clasificados como venta real (`reportes-que-comprar.ts:20-34, 889-908`), excluye `SALIDA_MOSTRADOR` como prueba de venta y mantiene consumo físico separado. Por eso es el mismo artefacto visual (`FULL`) pero no debe describirse como una copia literal de la consulta antigua.
5. **Nada más fue retirado.** La navegación conserva las pestañas Mapas de Calor, Análisis de Color, Compras y Qué comprar (`artifacts/mariana-textil/src/pages/reportes.tsx:22-34`). La rama Mapas conserva tres gráficos (`reportes-inventory.ts:217`), Análisis de Color conserva un gráfico y tres tablas (`:228-231`), Inventario conserva sus gráficos/tablas (`:359-366`) y Compras conserva un gráfico y siete tablas (`reportes-commercial.ts:155-164`).

## Comparación de campos y trazabilidad

| Campo o capacidad | Reportes originales | Qué comprar | Diferencia operativa |
|---|---|---|---|
| Grano | Depende del artefacto: SKU, color/tela, sitio, producto o recepción; varias vistas agregadas. | Un renglón por `productoId + ubicacionId` (`reportes-que-comprar.ts:776-887`). | Qué comprar no sustituye agregados por color/tela/sitio ni detalle de recepción. |
| Historia temporal | Mapas usa buckets del periodo seleccionado, 12 o 24 según rango (`reportes-inventory.ts:196-217`). | Siempre construye 12 meses hacia la fecha final y columnas `consumoMesNN` (`reportes-que-comprar.ts:727-728, 914-918`). | Ventana y medida no son idénticas; una no debe borrar la otra. |
| Cantidad | Principalmente `ticket_lineas.cantidad`, entradas recibidas o salidas por modalidad según pestaña. | Consumo suma salidas de venta, mostrador y transferencia; venta real se separa y solo acredita VENTA documentada (`reportes-que-comprar.ts:230-290, 950-956`). | “Cantidad” sin su fuente no es comparable. |
| Venta real al cliente | Los reportes operativos de ventas parten de tickets contabilizados; no llevan el conjunto de evidencia de stock mínimo. | Campo `ventaRealCliente` y mapa mes × color; documentado como señal de compra (`reportes-que-comprar.ts:418, 934-935, 950-952`). | Qué comprar distingue venta de salida física para no convertir traslado en venta. |
| Inventario | Inventario muestra cantidad, rollos, valor, coberturas por modalidad, conciliación y pérdidas estimadas (`reportes-inventory.ts:233-280, 359-366`). | Existencia, mínimo, coberturas, déficit observado y estados de mínimo (`reportes-que-comprar.ts:401-446, 934-946`). | Hay campos comunes, pero las preguntas y reglas son distintas. |
| Compra y costo | Compras conserva folios, proveedores, costos, referencias y alternativas (`reportes-commercial.ts:155-164`). | No tiene costo ni proveedor. | No hay autorización para retirar información económica de Compras. |
| Evidencia | Las tablas originales no tienen el drill-down de episodios de stock mínimo. | URL por renglón, movimientos, episodios, episodios previos, eventos y conciliación (`reportes.ts:61-104`; `reportes-que-comprar.ts:1034-1163`). | La evidencia nueva explica la sugerencia; no reemplaza la trazabilidad de compras, cierres o pérdidas. |
| Sugerencia | Inventario histórico tenía coberturas y clasificación; no evidencia de mínimo por producto-sitio. | Sugerencias solo desde `HISTORY_MIN_MONTHS = 3`, por renglón; las mediciones no esperan el umbral (`reportes-que-comprar.ts:5-13, 341-384`). | La falta de historia no justifica ocultar o eliminar los reportes existentes. |

## Propuesta de acciones (sin ejecutar)

1. **Aceptar como ya autorizado únicamente Mes × color:** mantenerlo en Qué comprar y mantener intactos los otros tres mapas. No crear una copia en Mapas.
2. **No retirar tablas por coincidencia parcial:** conservar las tres tablas de Análisis de Color, las cuatro de Inventario y Rotación y las siete de Compras.
3. **No retirar ninguna pestaña:** todas conservan contenido propio; en especial Mapas mantiene Mes × SKU, Mes × tela y Mes × sitio, además de su KPI de meses.
4. **No reinterpretar el déficit como pedido:** la propia columna lo marca como “Déficit observado contra mínimo (no pedido)” (`reportes-que-comprar.ts:939`) y la advertencia lo repite (`:953`).
5. **Si se solicita una nueva ronda de deduplicación:** aprobar cada artefacto por separado, usando la matriz anterior y un diff de código antes de tocarlo. Una aprobación genérica de “Qué comprar” no autoriza retirar compras, rotación o análisis de color.
6. **Antes de cualquier retiro futuro:** actualizar primero una matriz aprobada, comprobar que la pestaña conserva contenido propio y registrar el archivo, líneas, commit y autorización exacta. Hasta entonces, preservar todo.

## Veredicto

La comparación confirma **un solo `FULL` autorizado y ya movido (Mes × color)**. Todo lo demás es `PARTIAL` o `NONE`; no hay base para retirar tablas ni pestañas. Este informe entrega la comparación que estaba pendiente, pero **no ejecuta ni retroaprueba** ningún retiro distinto del movimiento de Mes × color ya autorizado. Las pestañas ajenas indicadas por el prompt quedaron fuera del análisis.
