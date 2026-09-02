# Verificación de filtros combinables — Historial de compras y Reportes

## Criterio y migración

El criterio compartido contiene Tela, Color, Proveedor, Sitio y rango de fechas. Tela, Color, Proveedor y Sitio aceptan varias selecciones: se aplica OR dentro de cada grupo y AND entre grupos. Un grupo vacío no agrega una condición. Historial y Reportes usan el mismo tipo, serialización de URL y componente visual.

En Reportes se migraron al criterio compartido Tela, Color, Proveedor, Sitio y rango de fechas. Permanecen específicos: periodo (calcula ventanas relativas), modalidad (rollos/metraje), Producto (selección exacta de una pareja tela-color), unidad, usuario, cliente, forma de pago y facturado. Son dimensiones legítimas de reportes que el historial de compras no necesita. No contradicen el criterio nuevo: Producto sigue siendo útil en un reporte cuando se busca deliberadamente una pareja exacta, pero no se ofrece junto a Color como filtro principal del historial.

## URL e interfaz

Las selecciones se guardan como listas separadas por comas, por ejemplo `telas=Tafetán,Loneta&colores=Blanco,Crudo`. Al abrir o recargar, se restauran. Los valores mal formados o ausentes de los catálogos reales se descartan, se normaliza la dirección y se muestra un aviso. La barra muestra chips removibles, conteo de filtros activos, limpieza total y, en resultados vacíos, la combinación que no produjo compras. En pantallas angostas los controles viven en una hoja lateral compacta.

## Rendimiento

Medición de solo lectura sobre el volumen disponible de los últimos 12 meses: 10 entradas, 1,570 líneas de rollo y 10 productos. `EXPLAIN (ANALYZE, BUFFERS)` de la consulta anual agrupada y ordenada en servidor devolvió 13 renglones antes del límite y tardó **1.767 ms** de ejecución, con **1.665 ms** de planeación.

No se agregaron índices. Ya existen `entradas(fecha,id)`, `entradas(proveedor_id)`, `entradas(ubicacion_id)`, `rollos(recepcion_id,producto_id)` y `productos(tela,color)`, que cubren fecha/orden, proveedor, sitio, unión y catálogos de Tela/Color. Añadir variantes sobre las mismas columnas en este volumen solo aumentaría el costo de escritura.

El orden y la paginación permanecen en servidor. Los filtros no cambian esa decisión: la tabla crece indefinidamente y el navegador recibe como máximo 50 renglones por página. `resolveReadScope` se resuelve antes del criterio; para alcance PROPIA, el sitio autorizado reemplaza cualquier lista escrita en la URL.