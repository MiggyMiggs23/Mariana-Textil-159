# Tanda F — Tarea 2: inventario en navegador real

## Resultado: PARCIAL, sin descuadre observado en lo ejecutado

**PASS:** programación de contenedor, entrada con series, traslado y recepción entre tiendas sintéticas, cancelación de otra salida en tránsito y traslado/recepción adicional con KILO, PIEZA y BOLSA.

**BLOQUEADO:** venta parcial con sobrante. Los cuatro productos sintéticos tienen `se_vende_por_metro=false`; la consulta de todo el catálogo devuelve **cero productos activos habilitados** para ese modo. No se habilitaron productos, gates ni permisos. No hubo venta parcial, sobrante, cancelación de venta ni devolución de mercancía; no se presenta la cancelación de traslado como sustituto equivalente.

## Aislamiento y ejecución

- Chromium real, Playwright 1.55, origen exclusivo `http://127.0.0.1:43820`; solicitudes externas bloqueadas. ADMIN natural, sin alterar su matriz.
- API privada 43821, PostgreSQL privado 55440, base **tanda_f_browser**, directorio `.local/tanda-f/cluster`. `db.mjs` comprueba identidad de proceso/API y base; consultas con `default_transaction_read_only=on`.
- Mutaciones exclusivamente por controles UI. **Ningún productor directo/API mutante**, SQL mutante, corrección de aplicación o cambio de configuración.
- Contenedor/entrada y rollos nuevos sintéticos; proveedor importador 227; productos 2078–2081; tiendas 836–838. El sitio virtual 8 «En tránsito» es el sitio canónico elegido por la aplicación, no una tienda adicional escogida por el operador.
- Evidencia temporal continua en `progress.txt`, capturas mucho más frecuentes que cada tres minutos, desde 04:04 hasta 04:10 UTC; conciliación final 04:11. No se arrancaron ni detuvieron servidores, workflows o cluster. MAIN conserva responsabilidad del teardown.
- Cliente 8 no seleccionado ni modificado por esta tarea: deuda del ledger **$1,200 en cada snapshot**, incluyendo final. No se contaminaron ventas/abonos de Tarea 1.

## Recorrido y conciliación por paso

En cada snapshot se comparan **12 combinaciones producto/unidad/tienda**: suma de cantidad de rollos DISPONIBLE, caché `existencias.cantidad_total` y suma firmada de `movimientos.cantidad`. Nunca se suman cantidades de unidades diferentes.

| Paso | Operación real / resultado | METRO por tiendas 836 / 837 / 838 | Snapshot |
|---|---|---|---|
| Baseline posterior a Tarea 1 | Estado heredado conciliado | 70 / 70 / 60 | `00-baseline.json` |
| Contenedor #00001, ID 3 | Programado 20 METRO, 2 rollos, importador 227; no añade stock todavía | 70 / 70 / 60 | `01-container.json` |
| Revisión de entrada | Modal previo a confirmación; **todavía no hay entrada** | 70 / 70 / 60 | `02-entry.json` |
| Confirmar entrada 471 / TFA-000002 | Series **10000741 y 10000742**, IDs 6329/6330, 10 METRO cada una. Contenedor RECIBIDO y enlazado a entrada 471 | 90 / 70 / 60 | `03-entry-confirmed.json` |
| Traslado salida 29 / TFA-000001 | Serie 10000741 de tienda 1 a tránsito virtual, 10 METRO | 80 / 70 / 60 | `04-transfer.json` |
| Recepción salida 29 | Serie 10000741 disponible en tienda 2 | 80 / 80 / 60 | `05-reception.json` |
| Intento natural modo METREADO | Producto no aparece entre elegibles; sin escritura de venta | 80 / 80 / 60 | `06-partial-blocked.json` |
| Segunda salida 30 / TFA-000002 | Serie 10000742, 10 METRO, de tienda 1 a tránsito | 70 / 80 / 60 | `07-transfer-cancel-before.json` |
| Cancelar salida 30 con motivo | Serie 10000742 regresa DISPONIBLE a tienda 1; documento CANCELADA y movimientos compensatorios, no borrado | 80 / 80 / 60 | `08-cancelled.json` |
| Salida 31 / TFA-000003 | Tienda 1 → tienda 3: **10 KILO**, **10 PIEZA**, **10 BOLSA**, cada uno en su propia línea | Sin cambio METRO | `09-multiunit-transit.json` |
| Recepción salida 31 | Cada una de esas tres unidades: tienda 1 **70**, tienda 2 **80**, tienda 3 **90** | 80 / 80 / 60 | `10-multiunit-received.json` |

Antes del traslado adicional, KILO, PIEZA y BOLSA mantienen cada una 80/80/80. En tránsito pasan cada una a 70/80/80, con sus propios 10 en sitio virtual 8; recepción produce 70/80/90. No se interpreta «30» como cantidad de mercancía.

`assert.mjs` ejecutado: **132 combinaciones por snapshot/tienda/producto conciliadas**, saldo cliente 8 constante, y rollos EN_TRANSITO contra ledger de sitio 8 por unidad. `assertions.json` conserva resultados. El caché histórico del sitio virtual no se capturó en cada paso: **no se afirma esa comparación histórica**. `final-audit.json` sí captura todos los cachés de productos sintéticos, incluido tránsito; cantidades y conteos finales de rollos coinciden, tránsito termina en cero en las cuatro unidades.

## Evidencia visual principal

Todas en `evidence/`, con PNG y texto visible:

- `04-container-created`, `07-roll-capture`, `08b-entry-confirmed`: contenedor, captura de dos rollos y entrada efectivamente guardada.
- `10-transfer-captured`, `11-transfer-submit`, `14-reception-preview`, `15-received`: traslado y recepción de la primera serie.
- `16-partial-mode`, `18-partial-product-result`: interfaz METREADO sin producto elegible.
- `23-cancel-dialog`, `24-cancelled`: cancelación de traslado con motivo y resultado.
- `26-multiunit-preview`, `27-multiunit-transfer`, `28-multiunit-reception`, `29-multiunit-received`: unidades diferenciadas. Se inspeccionó visualmente la captura 28: cantidades independientes de kg, bolsas y piezas.

## Bloqueos, límites y observaciones de interfaz

1. **Venta parcial:** consulta auténtica de catálogo, cero activos con venta por metro habilitada (`partialCatalog` y `final-audit.partialEnabledCount`). El código congelado del POS filtra por esa propiedad en METREADO. No se creó entrada con producto habilitado porque no existe uno en esta copia; no se cambió el catálogo para conseguir un PASS.
2. **Venta completa alternativa no realizada:** se preparó una nota con la serie recibida y «Venta a Público», sin seleccionar cliente 8. UI indica «Venta a Público no admite compras a crédito» y mantiene Confirmar Venta deshabilitado. Se conservan `20-full-sale-public-preview` y captura de error del locator. No nació documento de venta; no se forzó el botón ni se creó otro cliente para eludir el bloqueo.
3. **Cancelación de venta/devolución con sobrante:** detenidas por falta de venta parcial precedente. Solo se certifica cancelación de salida EN_TRANSITO. La salida ya recibida no ofreció Cancelar (`17-received-transfer-detail`). No se invocó una devolución de inventario directa. La revisión de superficies Salidas/POS no proporcionó una devolución de mercancía aplicable a una venta inexistente. La devolución física de crédito identificada en Cobros es una operación monetaria distinta; no se confundió con devolución de rollos ni se ejecutó.
4. **Omisión visual de totales, no mezcla de unidades:** captura 26 muestra las líneas KILO/PIEZA/BOLSA correctamente, pero el resumen inferior de la captura de salida solo expone METROS/KILOS. El detalle guardado 27 expone KILOS y BOLSAS, omite total PIEZAS aunque conserva la línea de 10 piezas. Recepción 28 sí muestra las cuatro categorías. No se observó suma de piezas/bolsas dentro de metros o kilos; es una omisión de presentación a revisar, no un descuadre de DB demostrado.
5. Hubo reintentos de automatización antes de confirmar entrada (selector de contenedor se desmontó) y un intento inicial de abrir METREADO fuera de la pestaña Notas. Se conservaron capturas de error. No se duplicó contenedor ni entrada; entrada real única ID 471. El nombre `08-entry-saved` corresponde al modal de revisión, **no** a éxito de escritura; la evidencia definitiva es `08b-entry-confirmed`.

## Estado entregado

- 10000741 disponible en tienda 2; 10000742 disponible en tienda 1.
- 994000101/KILO, 994000201/PIEZA y 994000301/BOLSA disponibles en tienda 3.
- Contenedor recibido; dos salidas recibidas (29,31), una cancelada (30); ningún rollo sintético queda en tránsito.
- No se declara recorrido completo ni ausencia universal de fallos: resultados limitados a estos pasos, productos y copia.
- Scripts mutantes son evidencia y **no deben volver a ejecutarse** sobre esta base. Un único commit propio incluye exclusivamente `reports/tanda-f/tarea-2/`; obtener hash con `git log -1 --format=%H -- reports/tanda-f/tarea-2`.