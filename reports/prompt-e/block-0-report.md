# Prompt E — Bloque 0: reproducción y medición

**Fecha de ejecución:** 2026-09-16 01:30–01:32 UTC  
**Resultado de reproducción:** **no reproducido** en el flujo real montado y en PDF Chromium.  
**Estado global de verificación:** **NO PASS / incompleto**. El no reproducir la página blanca o el desplazamiento no equivale a un PASS general: las etiquetas incumplen la banda de seguridad de 5 mm (la tinta del borde/fondo llega a 0 mm en las cuatro orillas). No se modificó aplicación, CSS, harness, configuración, dimensiones, contenido ni capacidades. No se ejecutó `pnpm run typecheck` (fuera de este bloque).

## Alcance y seguridad de la ejecución

Se usaron los componentes/rutas reales con `media: print` y la captura CDP `Page.printToPDF`. Las respuestas HTTP fueron exclusivamente fixtures interceptadas por Fetch dentro de Chromium. Antes de ejecutar se inspeccionaron los tres harnesses: solo permiten `GET` de `auth/me`, notificaciones y lecturas de documentos; una ruta no prevista recibe 404 y no se reenvía al API real. No hubo usuarios, sesiones, autenticación real, escrituras ni cambios de base de datos.

Parámetros de exportación en todos los casos: escala `1` (100 %), márgenes CDP `0`, `preferCSSPageSize: true`, fondos activados y encabezado/pie del diálogo desactivados. Chromium: `Chrome/152.0.7977.64`, Linux x64, Node `v24.13.0`, ejecutable `/repl/tools/bin/chromium`.

El PDF es evidencia de paginación CSS de Chromium; la Wasp WPL308 y el diálogo nativo no se ejecutaron. Esto deja la comprobación física pendiente, sin atribuir el resultado al controlador ni al tamaño de papel.

## Casos ejecutados

| Documento | Ruta/fixture | Expectativa de fixture/harness | Páginas DOM del navegador | Páginas PDF emitidas | Estado del harness (no global) |
|---|---|---:|---:|---:|---|
| Etiqueta mínima | `/entradas/9100/etiquetas`, baseline-1-label | 1 etiqueta | 1 | 1 | PASS harness |
| Etiquetas paginadas | `/entradas/9200/etiquetas`, regression-25-labels | 25 etiquetas | 25 | 25 | PASS harness |
| Etiquetas con portal adicional | misma ruta, portal montado simulado | 25 etiquetas | 25 activas de 2 portales montados | 25 | PASS harness |
| Salida mínima | `/salidas/84001/documento/salida`, salida-count-1 | 1 | 1 (aserción del harness) | 1 | PASS harness |
| Salida límite paginado | `/salidas/84011/documento/salida`, salida-count-11-boundary | 2 | 2 (aserción del harness) | 2 | PASS harness |
| Entrada mínima | `/entradas/71001/documento`, entrada-count-1 | 1 | 1 | 1 | PASS harness |
| Entrada paginada | `/entradas/71011/documento`, entrada-measured-11-rows | 3 | 3 | 3 | PASS harness |

El harness de Salida también ejecutó `count-10` como control: DOM/PDF `1/1`, PASS harness.

### Incidencia independiente conservada

El probe existente `entrada/overflowPages` (`24` filas) tiene `expectedPageCount: 4` en `laser-document-fixtures.mjs`; ese `4` es una **expectativa fija del fixture/harness**, no un numerador de páginas leído de un PDF ni una cifra declarada por el documento. El harness pasa esa expectativa a `waitForMountedRoute` como `expectedDomPageCount` y después compara el DOM real; observó `5` páginas DOM y falló (`5 !== 4`) antes de llamar a `Page.printToPDF`. Por tanto, para este caso no existe un PDF emitido ni un “Página n de 4” que pueda llamarse paginación real del documento. Se conserva en `entrada-harness.txt` y `entrada-selected-report.json`; no se tomó como la reproducción de página blanca. El probe paginado `measured11` sí emitió y fue inspeccionado de forma independiente. No se ocultó ni se convirtió ese fallo en PASS.

## Medición independiente de tinta y texto

Se procesó cada PDF con PyMuPDF, se renderizó cada página a 96 DPI y se midió la caja completa de píxeles no blancos (RGB mínimo `<250`). La coordenada `topMm` es el primer píxel de tinta real; las cuatro holguras son tinta a cada borde de la hoja. La coordenada de texto es el `y` mínimo de las palabras PDF y se reporta por separado. La cuantización del raster de 96 DPI es aproximadamente 0.265 mm por píxel.

La medición completa de **cada página** (incluidos tamaño, cajas, holguras, texto, número de imágenes y texto normalizado) está en `measurements.json`; el texto página por página está en `page-text.md`; los PNG renderizados están en `rendered/`.

Tamaños físicos observados en el PDF: Entrada `215.900 × 279.061` mm, Salida `210.000 × 148.000` mm y Etiqueta `99.822 × 69.850` mm. Se registran como medición del artefacto generado, sin alterar la configuración solicitada ni inferir una causa de papel.

| PDF | Páginas | Primer píxel de tinta `topMm` por página | Texto `minY` por página | Holguras tinta L/T/R/B (mm) |
|---|---:|---|---|---|
| `etiqueta-baseline-1-label.pdf` | 1 | `[0.000]` | `[6.540]` | `0.000 / 0.000 / 0.000 / 0.000` |
| `etiquetas-regression-25-labels.pdf` | 25 | `[0.000 × 25]` | `[6.540 × 25]` | `0.000 / 0.000 / 0.000 / 0.000` en todas |
| `etiquetas-regression-25-labels-simulated-mounted-portal.pdf` | 25 | `[0.000 × 25]` | `[6.540 × 25]` | `0.000 / 0.000 / 0.000 / 0.000` en todas |
| `salida-count-1.pdf` | 1 | `[5.292]` | `[5.953]` | `5.292 / 5.292 / 5.292 / 5.292` |
| `salida-count-10.pdf` | 1 | `[5.292]` | `[5.953]` | `5.292 / 5.292 / 5.292 / 5.292` |
| `salida-count-11-boundary.pdf` | 2 | `[5.292, 5.292]` | `[5.953, 5.953]` | `5.292 / 5.292 / 5.292 / 5.292` en ambas |
| `entrada-count-1.pdf` | 1 | `[5.292]` | `[11.245]` | `5.292 / 5.292 / 5.556 / 5.821` |
| `entrada-measured-11-rows.pdf` | 3 | `[5.292, 5.292, 5.292]` | `[11.245, 11.245, 8.764]` | `5.292 / 5.292 / 5.556 / 5.821` en todas |

### Comparación de la primera página contra las siguientes

- **Etiquetas:** la tinta y el texto comienzan en la misma coordenada en las 25 páginas (`0.000` y `6.540` mm respectivamente). No hay hoja inicial adicional ni desplazamiento de la primera etiqueta. La tinta a `0.000` corresponde al borde/fondo visible del diseño y queda registrada, no descartada.
- **Salida de 11:** tinta `5.292` mm en página 1 y 2; texto `5.953` mm en ambas. No hay offset de primera página.
- **Entrada de 11:** tinta `5.292` mm en las tres páginas; texto `11.245` mm en páginas 1–2 y `8.764` mm en la continuación de series (página 3). La página 3 empieza antes, no hay contenido inicial desplazado hacia abajo; la tinta periférica permanece idéntica.
- **Casos mínimos:** cada uno tiene una sola página PDF no vacía, por lo que no existe una página blanca adicional que separar del supuesto desplazamiento interno.

Los PDF renderizados inspeccionados visualmente (`entrada-count-1` página 1, `entrada-measured-11-rows` página 3, `salida-count-1` página 1 y etiqueta baseline) muestran contenido visible y completo, sin hoja blanca previa. Los textos y firmas esperados también aparecen en `page-text.md`:

- Entrada: series, folio y las firmas `RECIBIDO POR`, `REVISADO POR`, `AUTORIZADO POR` donde corresponde.
- Salida: renglones, observaciones, totales y `Revisó`, `Entregó`, `Recibió` en cada página.
- Etiquetas: título tela/color, SKU, serie, cantidad, unidad y `MARIANA TEXTIL` por etiqueta.

## Márgenes físicos observados

Los PDF de Entrada y Salida conservan al menos 5 mm de tinta a los cuatro bordes en todas las páginas (`5.292` mm como mínimo medido). En las etiquetas el borde/fondo alcanza los cuatro límites del raster (`0` mm): **falla el criterio de banda de seguridad de 5 mm**. Se reporta como criterio independiente y no se interpreta como página blanca ni como causa del offset que se buscaba reproducir. No se modificó el diseño.

## Veredicto y límite

**La página blanca al inicio o el espacio desplazado sobre el primer contenido no se reprodujo en esta ejecución.** Los conteos navegador/PDF coinciden con la expectativa del harness en los casos emitidos y las coordenadas de tinta de la primera página coinciden con las siguientes cuando hay continuación. Eso no convierte la ejecución en PASS global: las etiquetas fallan las bandas de seguridad de 5 mm y el probe `overflowPages` no produjo PDF por la discrepancia de páginas DOM. Por la instrucción del Bloque 0, se detiene aquí: no se aplica corrección a ciegas y no se diagnostica una causa de `visibility`/altura retenida sin una reproducción observable. En consecuencia, no se recogió el diagnóstico geométrico de estilos ocultos del arnés, que solo se activa tras una aserción PDF fallida; no hubo tal reproducción.

La impresión física en Wasp WPL308 y láser sigue pendiente.

## Archivos y comandos

PDF y evidencia bajo `reports/prompt-e/`:

- `etiqueta-baseline-1-label.pdf`, `etiquetas-regression-25-labels.pdf` y `etiquetas-regression-25-labels-simulated-mounted-portal.pdf`.
- `salida-count-1.pdf`, `salida-count-10.pdf`, `salida-count-11-boundary.pdf`.
- `entrada-count-1.pdf`, `entrada-measured-11-rows.pdf`.
- `measurements.json`, `page-text.md`, `rendered/` y reportes JSON de cada harness.
- Logs conservados como archivos rastreables `.txt` (el repositorio ignora `*.log`): `labels-harness.txt`, `salida-harness.txt`, `entrada-harness.txt`, `entrada-measured11-harness.txt`.

Comandos ejecutados contra la aplicación ya montada:

```sh
node artifacts/mariana-textil/src/pages/entrada-etiquetas-pdf-regression.test.mjs
LASER_DOCUMENT_PDF_ARTIFACT_DIR=/tmp/prompt-e-salida \
  node artifacts/mariana-textil/src/pages/laser-documents-pdf-regression.test.mjs
LASER_OTHER_DOCUMENT_PDF_ARTIFACT_DIR=/tmp/prompt-e-entrada \
LASER_DOCUMENT_KINDS=entrada LASER_DOCUMENT_CASES=count1,overflowPages \
  node artifacts/mariana-textil/src/pages/laser-other-documents-pdf-regression.test.mjs
LASER_OTHER_DOCUMENT_PDF_ARTIFACT_DIR=/tmp/prompt-e-entrada-measured11 \
LASER_DOCUMENT_KINDS=entrada LASER_DOCUMENT_CASES=measured11 \
  node artifacts/mariana-textil/src/pages/laser-other-documents-pdf-regression.test.mjs
```

El último comando y las mediciones independientes se usaron para conservar evidencia paginada aun cuando el probe `overflowPages` del comando anterior tuvo la discrepancia DOM `5` contra la expectativa fija del fixture/harness `4`.
