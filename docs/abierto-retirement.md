# Retiro futuro del estado `ABIERTO`

## Estado de esta decisión

`ABIERTO` se conserva temporalmente en la Parte 1. No representa existencia:
solo los rollos `DISPONIBLE` en un sitio se pueden tocar y vender ahí hoy.

La Parte 2 debe eliminar `ABIERTO` y `SALIDA_MOSTRADOR` como un solo cambio de
dominio. No se debe intentar corregir parcialmente esta inconsistencia mientras
el flujo metrado siga dependiendo del estado.

## Inconsistencia actual exacta

Para un rollo `DISPONIBLE` con `cantidad_actual = Q`, `salidaMostrador`:

1. cambia únicamente `estado` a `ABIERTO`;
2. deja `rollos.cantidad_actual = Q`;
3. inserta un movimiento `SALIDA_MOSTRADOR` con `cantidad = -Q`;
4. recalcula el caché desde la suma firmada del kardex.

El resultado es deliberadamente asimétrico: el kardex y
`existencias.cantidad_total` ya retiraron Q de existencia, pero la fila del
rollo `ABIERTO` todavía muestra Q. El rollo tampoco cuenta en `rollos_count`,
porque ese conteo incluye únicamente `DISPONIBLE`.

## Por qué no se elimina en la Parte 1

El POS metrado todavía valida y consume rollos `ABIERTO`. También existen una
ruta de salida a mostrador, filtros y etiquetas por estado, un diagnóstico de
rollos abiertos, enums y contratos generados, presentaciones del movimiento y
pruebas que fijan el comportamiento terminal.

Eliminar solo el enum, solo la ruta o solo el movimiento rompería el flujo
metrado o dejaría datos históricos imposibles de interpretar.

## Alcance obligatorio de la Parte 2

La eliminación futura debe hacerse en este orden:

1. Definir el reemplazo operativo del POS metrado sin depender de `ABIERTO`.
2. Auditar y migrar todos los rollos `ABIERTO` existentes conservando su
   trazabilidad histórica y sin volver a sumarlos a existencia.
3. Retirar `salidaMostrador`, su ruta, permiso documentado, OpenAPI, clientes y
   schemas generados.
4. Retirar `ABIERTO` de los enums y filtros de inventario/etiquetas, y retirar
   `SALIDA_MOSTRADOR` cuando los movimientos históricos ya tengan una estrategia
   de lectura compatible.
5. Retirar o reemplazar el diagnóstico de rollos abiertos y sus KPIs.
6. Actualizar POS, detalle de rollo/producto, movimientos, etiquetas y pruebas.
7. Reconstruir `existencias` y comprobar que las seis vistas de inventario
   siguen coincidiendo antes de aplicar el cambio a desarrollo.

## Regla durante la Parte 1

No sumar `ABIERTO` a existencia, no inferir existencia desde
`rollos.cantidad_actual` y no modificar este flujo como arreglo aislado. La
fuente autoritativa de `existencias.cantidad_total` sigue siendo el kardex; el
conteo físico disponible sigue siendo únicamente `DISPONIBLE`.