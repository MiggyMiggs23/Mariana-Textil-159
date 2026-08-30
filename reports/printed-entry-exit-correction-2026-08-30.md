# Corrección de documentos impresos — Entrada y Salida

Fecha: 30 de agosto de 2026

## Diagnóstico medido

La causa no era el tamaño de letra.

- **Entrada:** la caja exacta de `216 × 279 mm` quedaba pegada al límite de
  `@page`. Se conservó `@page` carta y se dio a la caja impresa una tolerancia de
  `0.5 mm` por eje (`215.5 × 278.5 mm`) para absorber el redondeo de milímetros
  a píxeles de Chromium.
- **Salida:** además del mismo riesgo de redondeo, diez filas reservadas
  desbordaban la hoja A6 por aproximadamente `71 px` (`18.8 mm`). Se conservó
  `@page` en `148 × 105 mm`, se redujo únicamente la caja impresa a
  `147.5 × 104.5 mm` y se recalculó la capacidad con el nuevo pie.

No se redujo ninguna tipografía.

## Capacidades verificadas

### Entrada

- Caja medida: `814.48 × 1052.59 px`.
- Capacidad: **23 líneas**.
- Geometría al límite: encabezado `162 px`, datos `139 px`, tabla `631.59 px`,
  pie `96 px` y franja `16 px`.
- Logo y QR: `112 × 112 px`.

### Salida

- Caja medida: `557.47 × 394.95 px`.
- Capacidad: **5 rollos**.
- Geometría al límite: encabezado `114 px`, datos `47.05 px`, tabla
  `149.95 px` y pie `84 px`.
- Logo y QR: `112 × 112 px`.

## Columna Producto

La medición se hizo contra las 154 filas de la hoja `Productos` del catálogo
aprobado `attached_assets/catalogo-mariana-textil_1787419404085.xlsx`.

- Ancho útil: `106 px`.
- Mediana: `47.08 px`.
- Percentil 90: `103.65 px`.
- Percentil 95: `115.66 px`.
- Máximo: `155.96 px`.
- Caben completos: **141 de 154** nombres.
- Los 13 nombres extremos conservan elipsis; no envuelven ni invaden Color,
  Rollos, Cantidad, SKU o Serie.

## PDF de evidencia

| Caso | Resultado | Archivo |
|---|---:|---|
| Entrada, una línea | 1 hoja | [entrada-1-linea.pdf](task73-print-pdfs/entrada-1-linea.pdf) |
| Entrada, capacidad exacta | 1 hoja, 23 líneas | [entrada-23-lineas.pdf](task73-print-pdfs/entrada-23-lineas.pdf) |
| Entrada, capacidad + 1 | 2 hojas, 24 líneas | [entrada-24-lineas.pdf](task73-print-pdfs/entrada-24-lineas.pdf) |
| Salida, un rollo | 1 hoja | [salida-1-rollo.pdf](task73-print-pdfs/salida-1-rollo.pdf) |
| Salida, capacidad exacta | 1 hoja, 5 rollos | [salida-5-rollos.pdf](task73-print-pdfs/salida-5-rollos.pdf) |
| Salida, capacidad + 1 | 2 hojas, 6 rollos | [salida-6-rollos.pdf](task73-print-pdfs/salida-6-rollos.pdf) |

Los PDF se generaron con `printBackground`, tamaño CSS preferido y sin
encabezado/pie del navegador. `pdfinfo` confirmó `1/1/2` y `1/1/2` páginas.
`pdftotext -layout` confirmó contenido no vacío, encabezado y las tres firmas en
cada página real, sin hoja final en blanco.

## Historial funcional

1. `84dd29c` — Entrada: tolerancia, logo compartido, capacidad y pie repetido.
2. Este commit — Salida: encabezado, título, columnas, firmas, capacidad y
   evidencia final.