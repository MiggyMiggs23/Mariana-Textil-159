# Cuentas Destino — verificación de presentación

## Resultado

- Orden: Cobranza → Matriz de Operaciones → Ventas. Encabezado, filtros, comparación, exportaciones y secciones posteriores conservados.
- Cobranza: tres tarjetas de efectivo; segunda fila con Cuentas No Fiscales, Cuentas Fiscales y Por cobrar. Seis tarjetas iguales, también a 402 px.
- Por cobrar conserva importe, subtítulo, borde punteado, color original y enlaces de periodo actual/anterior. No se suma a Cobrado.
- Ventas: tres tarjetas iguales a todo el ancho; contenido y fuentes conservados.
- Cinco iconos de destino con el mismo color, sin clasificación fiscal nueva; Por cobrar conserva su icono ámbar.
- Los dos porcentajes nuevos usan Cobrado como denominador; cero se muestra, no se oculta. Los porcentajes mantienen enlaces al detalle.
- «Caja en Tiempo Real» pasa a «Tiempo real» en el título y la referencia de regreso. No se cambia la barra lateral, rutas ni funcionamiento.

## Comprobaciones

- `pnpm run typecheck`: PASS completo, cero diagnósticos únicos, cero fallos de procesos.
- Pruebas enfocadas de Cuentas Destino, cobranza y centavos: 20/20.
- `git diff --check`: limpio.
- Cuatro estados antes y cuatro después: escritorio 1280 px y móvil 402 px, comparación encendida/apagada.
- Seis tarjetas iguales en cada estado; sin invasión entre importes y porcentajes.
- Importes anteriores y destinos de enlaces conservados; solo se agregan los dos porcentajes solicitados.
- `Ventas totales = Contado + Ventas a crédito` y `Total en efectivo = Efectivo facturado + Efectivo sin factura` comprobados en centavos con los datos de prueba.
- Inventario explícito de secciones, tablas, gráfica y enlaces, y tabla de todas las cifras antes/después en `before-after.html`.

## Alcance de la evidencia

Las capturas montan los componentes reales anteriores y actuales, con la misma respuesta sintética aislada. No son capturas de saldos reales ni una prueba autenticada. No se crearon usuarios ni sesiones; no se hicieron escrituras de base de datos ni llamadas a APIs financieras. Los enlaces se compararon por su destino canónico, sin ejecutar operaciones ni abrir detalles autenticados. Consultas, predicados, cálculos de importes, contratos API y exportaciones no se modificaron.