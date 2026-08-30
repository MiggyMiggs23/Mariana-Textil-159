# Corrección final de Entrada: series y firmas

Fecha: 30 de agosto de 2026

## Resultado

La hoja global conserva el encabezado, metadatos, tabla y tipografía aprobados.
Los únicos cambios dentro de ella son:

- El pie de observaciones y firmas se trata como un bloque indivisible.
- Cuando **todo** el listado de series cabe en el espacio de filas vacías de la
  última hoja global, se imprime allí después de los productos y antes del pie.
  Nunca se incrusta solo una parte.

Las hojas exclusivas de series ya no repiten `ENTRADA`, logo, QR, borde grueso
ni conteo de rollos. Su franja de 40 px contiene únicamente:

- Folio de la Entrada.
- `LISTADO DE SERIES`.
- `Página X de Y`.

## Medición de hojas de series

Medición Chromium a 96 dpi:

- Caja fija: `814.48 × 1052.59 px`.
- Franja compacta: `40 px`.
- Renglón de serie: `24 px`.
- Capacidad segura: **40 renglones × 4 series = 160 series por hoja**.
- Con 40 renglones, la tabla termina en `1039 px`: quedan `13.59 px`.
- Con 41 renglones, la tabla termina en `1063 px`: rebasa la hoja por
  `10.41 px`.

La caja usa altura fija y `overflow: clip`; tabla, sección incrustada y pie
declaran que no pueden fragmentarse entre páginas.

## Caso de 750 rollos

La Entrada de referencia se construyó con 750 series únicas repartidas entre
dos productos.

- 1 hoja global.
- 5 hojas compactas de series.
- 6 páginas numeradas y 6 páginas con contenido.
- Las 750 series aparecen exactamente una vez.
- Ningún renglón aparece antes de la franja de su hoja.
- Las hojas de series no contienen título grande, logo ni QR.
- El documento anterior ocupaba 8 páginas numeradas y arrastraba renglones
  hasta una novena hoja; el nuevo ocupa 6.

[Abrir PDF de 750 rollos](task74-series-header-footer-correction-pdfs/entrada-750-rollos-2-productos.pdf)

## Pie indivisible y aprovechamiento

El pie completo mide `96 px`. En el límite global de 23 productos queda entre
`940.59` y `1036.59 px`, dentro de la caja de `1052.59 px`; las líneas y las
leyendas `RECIBIDO POR`, `REVISADO POR` y `AUTORIZADO POR` permanecen juntas en
la última hoja global.

Para incrustar series se reutiliza exclusivamente el espacio de renglones
globales vacíos:

- Cada renglón global libre aporta `25 px`.
- La sección incrustada reserva `68 px` para separación, título y cabecera.
- Cada renglón de series consume `24 px`.
- Con una línea global caben 20 renglones de series, hasta 80 series.
- A partir del renglón 21, todo el listado pasa a hojas compactas separadas.

Por decisión confirmada, una Entrada con una línea y una serie imprime producto,
serie, observaciones y firmas completas en una sola hoja.

## PDF de verificación

| Caso | Páginas | Series | Archivo |
|---|---:|---:|---|
| 1 producto, 1 serie | 1 | 1 | [entrada-1-linea-1-serie.pdf](task74-series-header-footer-correction-pdfs/entrada-1-linea-1-serie.pdf) |
| Límite incrustado: 80 rollos | 1 | 80 | [entrada-80-rollos-limite-incrustado.pdf](task74-series-header-footer-correction-pdfs/entrada-80-rollos-limite-incrustado.pdf) |
| Límite + 1: 84 rollos | 2 | 84 | [entrada-84-rollos-limite-mas-1.pdf](task74-series-header-footer-correction-pdfs/entrada-84-rollos-limite-mas-1.pdf) |
| 23 productos, pie completo | 2 | 23 | [entrada-23-productos-pie-completo.pdf](task74-series-header-footer-correction-pdfs/entrada-23-productos-pie-completo.pdf) |
| 750 rollos, 2 productos | 6 | 750 | [entrada-750-rollos-2-productos.pdf](task74-series-header-footer-correction-pdfs/entrada-750-rollos-2-productos.pdf) |

`pdfinfo` y `pdftotext -layout` confirmaron que el número de páginas físicas,
páginas con texto y paginación de la aplicación coincide en los cinco PDF.
Todos usan carta vertical de `612 × 791.04 pt`.

## Nota del laboratorio

El controlador visual del navegador agrega a sus exportaciones una hoja final
que contiene únicamente su cursor morado como imagen rasterizada de `94 × 88`
px. El objeto no existe en el DOM, persiste aun sin plugins de desarrollo y no
forma parte del build ni del documento. Se inspeccionó con `pdfimages` y se
confirmó que esa hoja no tenía texto ni contenido de Mariana Textil.

Los PDF enlazados conservan sin alteración todas las páginas numeradas de la
aplicación y excluyen únicamente esa hoja del cursor del laboratorio.

## Commits

1. Encabezado compacto, capacidad medida y contención de hojas de series.
2. Pie indivisible, aprovechamiento de la última hoja global, documentación y
   evidencia.