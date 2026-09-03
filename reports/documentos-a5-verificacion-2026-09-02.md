# Verificación de documentos A5

Fecha: 2 de septiembre de 2026

## Formatos finales

| Documento | Papel CSS | Orientación | Tinta |
|---|---|---|---|
| Entrada | Carta, 216 × 279 mm | Vertical | Color |
| Nota de contado | A5, 148 × 210 mm | Vertical | Color |
| Nota de crédito | A5, 148 × 210 mm | Vertical | Color |
| Salida | A5, 210 × 148 mm | Horizontal | Diseño a color |

Entrada conserva su tamaño, encabezado, diseño y paginación de 23 productos. El único
criterio compartido añadido a su tabla de productos es el perímetro negro completo.

## Capacidades medidas

- **Nota de contado: 14 productos por hoja.** En Chromium a 96 dpi, la caja A5 útil
  mide 793.70 px de alto: encabezado 112 px, datos 126 px, cabecera de tabla 22 px,
  14 renglones de 24 px y pie reservado de 170 px suman 766 px.
- **Nota de crédito: 8 productos por hoja.** En la rasterización a 120 dpi, encabezado,
  datos de crédito y cabecera de tabla terminan cerca de 375 px; ocho renglones completos
  terminan cerca de 600 px y la reserva de totales/pie inicia cerca de 635 px. El noveno
  renglón cruzaba esa reserva y quedaba partido. El pagaré conserva 10 px (7.5 pt) con
  interlineado de 12 px (9 pt).
- **Salida: 10 productos por hoja.** Aunque la altura nominal de un renglón es 17 px,
  el perímetro de 0.35 mm ocupa aproximadamente 20 px efectivos al rasterizar el PDF.
  Encabezado 154 px, datos 52 px, cabecera 22 px, diez renglones efectivos y pie 82 px
  suman 510 px dentro de 559.37 px. Con 11 o más se recorta el pie.

Las tres capacidades se calculan por separado y son distintas: **14 contado, 8 crédito
y 10 Salida**. No se redujo el encabezado de Salida ni el texto legal para forzar más
renglones.

## Evidencia PDF

Los PDFs se generaron desde los componentes reales montados, con respuestas GET
interceptadas, identidad ADMIN simulada y sin mutaciones de base de datos. Chromium usó
`printBackground`, `preferCSSPageSize`, cero márgenes y sin encabezado/pie del navegador.

| Archivo | Páginas físicas | Resultado |
|---|---:|---|
| `a5-print-evidence/nota-contado-1-linea.pdf` | 2 | Una hoja por copia, 14 casillas dibujadas |
| `a5-print-evidence/nota-contado-14-lineas.pdf` | 2 | Capacidad exacta, una hoja por copia |
| `a5-print-evidence/nota-credito-9-lineas.pdf` | 4 | División 8+1 por copia; ningún renglón partido |
| `a5-print-evidence/nota-credito-11-lineas.pdf` | 4 | División 8+3 por copia; ningún renglón partido |
| `a5-print-evidence/nota-credito-15-lineas.pdf` | 4 | División 8+7 por copia; ningún renglón partido |
| `a5-print-evidence/salida-1-linea.pdf` | 1 | Diez casillas; pie completo |
| `a5-print-evidence/salida-10-lineas.pdf` | 1 | Capacidad exacta; pie completo |

`pdfinfo` confirmó A5 de 420 × 594.96 puntos para notas y A5 horizontal de
594.96 × 420 puntos para Salidas. `pdftotext -layout` confirmó el pagaré únicamente en
las últimas hojas de crédito. La rasterización completa con `pdftoppm` confirmó las
firmas de las notas, filas completas y observaciones, dos totales y las tres firmas de
Salida.

## Diseño de Salida y QR

La Salida restauró exactamente el tratamiento visual previo a la conversión monocromática:
el título dice únicamente “Salida”; ORIGEN y DESTINO muestran los nombres completos de
las ubicaciones; el logo está a color, con azul de marca en título, barra y cabecera de
tabla, y folio rojo. El QR conserva su zona de silencio y un recuadro blanco adicional
de 2 mm. La impresora
puede convertir este diseño a grises al imprimir sobre papel de color; el documento no
aplica filtros ni sustituye el logo por una versión gris.

## Posición del bloque de totales

El hueco visto en la muestra tenía dos causas relacionadas: el noveno renglón invadía la
reserva fija del pie y el bloque legal estaba anclado abajo mientras los totales arrancaban
arriba. Se redujo la capacidad de crédito a ocho y ahora el recibo/pagaré y los totales
comienzan juntos inmediatamente después de la tabla. La firma permanece anclada al borde
inferior para dejar espacio físico para firmar. Las muestras de 9, 11 y 15 líneas no
muestran superposición ni un renglón huérfano.

## Verificación física pendiente

Este entorno no puede colocar papel en una impresora ni operar la pistola del mostrador.
Por ello no se afirma una prueba física inexistente. Antes de adopción operativa se debe:

1. Imprimir una nota de cada tipo en A5 blanco desde la bandeja.
2. Imprimir una Salida en cada color de papel usado por sitio, en monocromático y sin
   escalado del controlador.
3. Escanear el QR con la pistola real y confirmar que abre la recepción de esa Salida.
4. Adjuntar la foto de la Salida sobre papel de color una vez realizada esa prueba.

La comprobación automatizada sí cubre tamaño, orientación, número de páginas, ausencia de
hojas fantasma, paginación continua, pagaré en última hoja, perímetros y recuadro blanco.
La lectura óptica sobre papel real queda deliberadamente fuera de lo declarado.