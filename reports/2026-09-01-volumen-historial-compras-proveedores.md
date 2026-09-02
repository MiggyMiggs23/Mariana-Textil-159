# Volumen — Historial de compras a proveedores

Fecha: 2026-09-01  
Zona horaria: America/Mexico_City

## Medición

La medición de solo lectura en development encontró:

- 10 entradas con proveedor.
- 13 renglones por entrada/producto.
- 3 sitios con actividad.
- 1.30 productos por entrada.
- Periodo observado: 2026-08-29 a 2026-09-01.

El periodo es corto y corresponde al arranque operativo, por lo que no se usa como pronóstico exacto. Al extrapolar el ritmo observado a siete sitios se obtienen aproximadamente 3,000 renglones al año. Para diseño y capacidad se adopta un margen conservador de **5,000 renglones por año**.

## Decisión

El historial es permanente y no tiene un límite natural. Se ordena, filtra y pagina en el servidor, con 50 renglones por página y máximo de 100. Traer todo al navegador dejaría de ser razonable al acumular varios años y haría crecer memoria, tiempo de transferencia y ordenamiento en cada teléfono.

## Índices

- `rollos(recepcion_id, producto_id)`: faltaba para unir cada entrada con sus líneas agregadas sin recorrer todos los rollos.
- `entradas(fecha, id)`: permite recorrer el orden cronológico estable usado por omisión.

Los filtros existentes conservan los índices individuales de `entradas.proveedor_id`, `entradas.ubicacion_id` y `entradas.fecha`. Los ordenamientos por nombre, color y cantidad ocurren sobre el conjunto ya filtrado y agrupado; con el volumen anual estimado no justifican estructuras duplicadas ni índices funcionales adicionales.