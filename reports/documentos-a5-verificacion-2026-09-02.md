# Verificación de documentos A5

Fecha: 2 de septiembre de 2026

## Formatos finales

| Documento | Papel CSS | Orientación | Tinta |
|---|---|---|---|
| Entrada | Carta, 216 × 279 mm | Vertical | Color |
| Nota de contado | A5, 148 × 210 mm | Vertical | Color |
| Nota de crédito | A5, 148 × 210 mm | Vertical | Color |
| Salida | A5, 210 × 148 mm | Horizontal | Monocromática |

Entrada conserva su tamaño, encabezado, diseño y paginación de 23 productos. El único
criterio compartido añadido a su tabla de productos es el perímetro negro completo.

## Capacidades medidas

- **Nota de contado: 14 productos por hoja.** En Chromium a 96 dpi, la caja A5 útil
  mide 793.70 px de alto: encabezado 112 px, datos 126 px, cabecera de tabla 22 px,
  14 renglones de 24 px y pie reservado de 170 px suman 766 px.
- **Nota de crédito: 10 productos por hoja.** El pagaré usa 10 px (7.5 pt) con
  interlineado de 12 px (9 pt). Encabezado 112 px, datos 118 px, cabecera 22 px,
  10 renglones de 24 px y pie legal/totales de 300 px suman 792 px.
- **Salida: 10 productos por hoja.** Aunque la altura nominal de un renglón es 17 px,
  el perímetro de 0.35 mm ocupa aproximadamente 20 px efectivos al rasterizar el PDF.
  Encabezado 154 px, datos 52 px, cabecera 22 px, diez renglones efectivos y pie 82 px
  suman 510 px dentro de 559.37 px. Con 11 o más se recorta el pie.

Las tres capacidades se calculan por separado. Crédito y Salida coinciden en diez por
restricciones distintas; no se redujo el encabezado de Salida ni el texto legal para
forzar una diferencia artificial.

## Evidencia PDF

Los PDFs se generaron desde los componentes reales montados, con respuestas GET
interceptadas, identidad ADMIN simulada y sin mutaciones de base de datos. Chromium usó
`printBackground`, `preferCSSPageSize`, cero márgenes y sin encabezado/pie del navegador.

| Archivo | Páginas físicas | Resultado |
|---|---:|---|
| `a5-print-evidence/nota-contado-1-linea.pdf` | 2 | Una hoja por copia, 14 casillas dibujadas |
| `a5-print-evidence/nota-contado-14-lineas.pdf` | 2 | Capacidad exacta, una hoja por copia |
| `a5-print-evidence/nota-credito-1-linea.pdf` | 2 | Pagaré en la última y única hoja de cada copia |
| `a5-print-evidence/nota-credito-11-lineas.pdf` | 4 | Dos hojas por copia; pagaré solo en las hojas 2 y 4 |
| `a5-print-evidence/salida-1-linea.pdf` | 1 | Diez casillas; pie completo |
| `a5-print-evidence/salida-10-lineas.pdf` | 1 | Capacidad exacta; pie completo |

`pdfinfo` confirmó A5 de 420 × 594.96 puntos para notas y A5 horizontal de
594.96 × 420 puntos para Salidas. `pdftotext -layout` confirmó el pagaré únicamente en
las últimas hojas de crédito. La rasterización completa con `pdftoppm` confirmó las
firmas de las notas, y observaciones, dos totales y las tres firmas de Salida.

## Monocromático, iniciales y QR

La Salida usa negro y grises, logo monocromático, encabezados oscuros, etiquetas en
negritas y perímetros negros; ningún significado depende del color. Las iniciales grandes
proceden de `ubicaciones.iniciales`. El QR tiene zona de silencio propia y un recuadro
blanco adicional de 2 mm.

## Verificación física pendiente

Este entorno no puede colocar papel en una impresora ni operar la pistola del mostrador.
Por ello no se afirma una prueba física inexistente. Antes de adopción operativa se debe:

1. Imprimir una nota de cada tipo en A5 blanco desde la bandeja.
2. Imprimir una Salida en cada color de papel usado por sitio, en monocromático y sin
   escalado del controlador.
3. Escanear el QR con la pistola real y confirmar que abre la recepción de esa Salida.
4. Adjuntar la foto de la Salida sobre papel de color una vez realizada esa prueba.

La comprobación automatizada sí cubre tamaño, orientación, número de páginas, ausencia de
hojas fantasma, paginación continua, pagaré en última hoja, perímetros, recuadro blanco e
iniciales. La lectura óptica sobre papel real queda deliberadamente fuera de lo declarado.