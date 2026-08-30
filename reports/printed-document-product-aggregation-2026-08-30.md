# Agregación por producto en documentos impresos

Fecha: 30 de agosto de 2026

## Resultado

Los cambios afectan únicamente la representación impresa. El alta, baja,
movimientos y consulta de rollos conservan cada número de serie.

- **Salida:** imprime un renglón global por producto y no imprime series.
- **Entrada:** imprime primero sus globales aprobados y después un listado
  compacto de series agrupado por producto.
- **Contrato API:** no fue necesario extenderlo. `GET /entradas/:id` ya entrega
  `lineas` agregadas y `rollos` con serie, producto y cantidad. Se añadió
  cobertura para impedir que ese contrato se pierda.

## Salida A6

La rejilla del encabezado permanece en tres columnas y conserva su borde y
alineación. Logo y QR se redujeron juntos de 112 a 76 px; el folio permanece a
14 px y visible.

Medición Chromium a 96 dpi:

- Caja: `557.47 × 394.95 px`.
- Encabezado: `78 px`.
- Metadatos: `47 px`.
- Área de tabla con siete productos: `185.95 px`.
- Pie: `84 px`.
- Desborde: `0 px`.
- Capacidad segura: **7 productos por página**.

Se probó también una capacidad de ocho filas. Aunque Chromium todavía produjo
una sola página, la tabla desbordó `5 px`; por eso se rechazó y se conservó la
capacidad segura de siete.

Una salida de diez rollos repartidos en tres productos produjo exactamente tres
renglones:

- Producto 1: 2 rollos, `24.680 Mts.`
- Producto 2: 3 rollos, `37.020 Mts.`
- Producto 3: 5 rollos, `61.700 Mts.`
- Pie: 10 rollos, `123.400 Mts.`

No apareció ninguna serie en el DOM imprimible ni en el texto del PDF.

## Entrada carta

La hoja global conserva el encabezado, escala, metadatos, tabla y capacidad
aprobados:

- Caja: `814.48 × 1052.59 px`.
- Encabezado: `162 px`.
- Metadatos: `139 px`.
- Capacidad global: **23 productos por página**.
- Logo y QR: `112 × 112 px`.

Las hojas nuevas de series usan cuatro columnas de serie por renglón:

- Capacidad: **28 renglones por página**.
- Capacidad efectiva: hasta **112 series por página**.
- Tabla medida con 28 renglones: `608.5 px`.
- Desborde: `0 px`.

La paginación es continua sobre globales y series. El encabezado aparece en
todas las hojas. Las firmas aparecen únicamente en la última hoja global y no
en las hojas de series.

El escenario de veinte rollos y cinco productos produjo cinco renglones
globales y las veinte series agrupadas, en dos páginas. Incluyó productos en
metros, kilos y bolsas sin combinar unidades en un renglón ni imprimir un total
general mezclado.

## PDF de límites solicitados

| Caso | Hojas | Archivo |
|---|---:|---|
| Salida, 1 producto | 1 | [salida-1-producto.pdf](task74-product-aggregation-pdfs/salida-1-producto.pdf) |
| Salida, capacidad exacta de 7 | 1 | [salida-7-productos.pdf](task74-product-aggregation-pdfs/salida-7-productos.pdf) |
| Salida, capacidad + 1 | 2 | [salida-8-productos.pdf](task74-product-aggregation-pdfs/salida-8-productos.pdf) |
| Entrada, 1 producto y 1 serie | 2 | [entrada-1-producto-1-serie.pdf](task74-product-aggregation-pdfs/entrada-1-producto-1-serie.pdf) |
| Entrada, capacidad global de 23 | 2 | [entrada-23-productos-23-series.pdf](task74-product-aggregation-pdfs/entrada-23-productos-23-series.pdf) |
| Entrada, capacidad global + 1 | 3 | [entrada-24-productos-24-series.pdf](task74-product-aggregation-pdfs/entrada-24-productos-24-series.pdf) |

Entrada requiere al menos dos hojas aun en el caso mínimo porque el listado de
series se imprime después de la hoja global.

## PDF de agregación

| Caso | Hojas | Archivo |
|---|---:|---|
| Salida, 10 rollos y 3 productos | 1 | [salida-10-rollos-3-productos.pdf](task74-product-aggregation-pdfs/salida-10-rollos-3-productos.pdf) |
| Entrada, 20 rollos y 5 productos | 2 | [entrada-20-rollos-5-productos.pdf](task74-product-aggregation-pdfs/entrada-20-rollos-5-productos.pdf) |

Todos los PDF se exportaron con el tamaño CSS preferido, fondos habilitados y
sin encabezados o pies del navegador. `pdfinfo` confirmó carta
(`612 × 792 pt`) para Entrada y A6 apaisado (`420 × 298.08 pt`) para Salida.
El número de páginas con texto coincidió con el número físico en todos los
casos: no hubo hojas fantasma.

## Commits funcionales

1. `944c98f` — encabezado compacto y agregación de Salida.
2. Este commit — series de Entrada, contratos, documentación y evidencia final.