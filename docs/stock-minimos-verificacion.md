# Stock mínimo y «Qué comprar»: verificación corregida

Fecha: 2026-09-11. Las correcciones de los ocho hallazgos fueron autorizadas por el dueño. No se activó la función en ningún sitio durante esta verificación.

## Resultado

Corregidos los hallazgos de historia, periodo, venta real, conciliación, procedencia de episodios, señal de inmovilidad, enlaces y captura con sitio apagado. Pruebas focalizadas: reporte 10 aprobadas; motor 12 aprobadas y 1 omitida; notificaciones 4 aprobadas; interfaz 6 aprobadas. Total focalizado: 32 aprobadas y 1 omisión explícita de reconstrucción real. Typecheck completo aprobado después de las últimas correcciones.

No se ejecutaron SQL manual, usuarios temporales, modificaciones del motor de inventario ni cambios de reglas monetarias. La ampliación de esquema se aplica mediante la migración aditiva habitual. No se presenta una prueba simulada como entrega o persistencia real.

## Los doce puntos solicitados

| Punto | Resultado | Alcance comprobado |
|---|---|---|
| 1. Typecheck y codegen | Aprobado | Typecheck completo final con salida 0. La regeneración sin diferencias se comprobó en la primera implementación; estas correcciones no cambiaron OpenAPI ni archivos generados. |
| 2. Suites | Aprobadas las focalizadas; integración pendiente | 32 pruebas focalizadas aprobadas y una omitida. Las pruebas generales seguras previas siguen sin cambios ajenos; no se ejecutaron suites que requieren DB aislada o crean usuarios. |
| 3. Sitio apagado | Parcial | Cortocircuito y rechazo de PUT con SITE_DISABLED/409 probados sin DB. Navegador: no solicita lista ni muestra productos. No se compararon todas las cifras de un tablero real. |
| 4. Captura y mínimo vacío | Aprobado con API simulada | Interruptor, PUT numérico y borrado con null; mock con estado reflejó el nuevo mínimo y déficit tras guardar. Esto no acredita persistencia real. |
| 5. Destinatarios y enlace | Parcial | Activos asignados más ADMIN/SUPERVISOR, sin duplicados, en pruebas sintéticas. En navegador el enlace eligió el sitio del encabezado y destacó el producto; PROPIA no pudo sobrepasar su alcance. No se bajó inventario ni se entregó una alerta real. |
| 6. No repetir | Parcial | Episodio estable y reapertura tras recuperación aprobados con datos sintéticos. Concurrencia y persistencia real pendientes. |
| 7. Reconstruir caché | No ejecutado | Se conserva la separación de tablas y el motor no fue modificado. No se ejecutó reconstruirCacheExistencias contra PostgreSQL. |
| 8. Historia individual | Aprobado sin DB | Recepciones establecen historia aunque no haya salidas; límites de meses en Ciudad de México probados. En navegador una fila insuficiente no apagó otra con historia. |
| 9. Consumo y venta real | Aprobado sin DB | Consumo conserva salidas físicas; venta real exige VENTA con documento de venta reconocido. SALIDA_MOSTRADOR no basta. Advertencia visible y sin suma entre sitios. |
| 10. Evidencia | Aprobado con datos sintéticos | Prueba que invoca el reporte y su endpoint de evidencia con el mismo pool simulado, incluyendo movimientos anteriores al periodo: historia, cobertura, venta y meses coinciden. La conciliación detecta filas alteradas. Episodios anteriores se muestran separados y no incrementan el conteo del periodo. |
| 11. Constante de historia | Aprobado con alcance limitado | Una constante HISTORY_MIN_MONTHS controla elegibilidad; la prueba anterior cambió 3 a 4 solo en memoria y mantuvo las mediciones. La comparación trimestral usa un trimestre fijo y no cambia con ese umbral. |
| 12. Teléfono | Aprobado con API simulada | A 390×844 se revisaron captura, controles, desplazamiento horizontal, apertura/desplazamiento/cierre del diálogo de evidencia. La sección añadida posteriormente de episodios anteriores se verificó por contrato y typecheck. |

## Correcciones y regresiones relevantes

- Primera observación desde entradas o salidas del par, no únicamente desde consumo.
- Meses de historia evaluados en el calendario de Ciudad de México; datos previos a observación no se rellenan con ceros ficticios.
- Venta real documentada separada de salidas físicas; cancelaciones excluidas y movimientos deduplicados.
- Caídas bajo mínimo contadas por aperturas dentro del periodo. Texto: «en el periodo». Episodios arrastrados son contexto separado.
- Reporte y evidencia cargan el mismo historial hasta la fecha final y comparten normalización y cálculo. Una prueba invoca ambas funciones públicas con movimientos anteriores a la fecha inicial.
- Conciliación contrasta celdas mensuales, venta, cobertura, historia y episodios contra los datos base; se prueba detección de alteraciones.
- Procedencia del episodio: MOVIMIENTO cuando hay cruce demostrable; CONFIGURACION solo para el producto editado, o para el sitio habilitado; SNAPSHOT cuando no hay causa demostrable. No se inventa un movimiento histórico.
- PUT con sitio apagado rechaza antes de consultar producto o escribir mínimo/auditoría.
- Enlace de alerta consume sitio/producto mediante el selector del encabezado respetando alcance; muestra existencia, mínimo y déficit.
- noMovimiento se interpreta con su nombre canónico. Los contratos de notificaciones conservan el destino de pagos dirigidos y la familia ALERTA de stock mínimo.

## Incidencias durante la corrección

La primera tanda de esta corrección tuvo dos fallos: la expectativa de un límite de historia y una expresión regular antigua del enlace de pagos dirigidos. Se revisó el calendario local y se corrigió la prueba de límite; el contrato ahora admite saltos de línea sin dejar de exigir el destino correcto. Ambas suites pasaron después. La revisión adicional detectó diferencias de ventana de historial y atribución de causa a otros productos; también fueron corregidas dentro de la autorización y cubiertas por regresiones. No se corrigieron reglas ajenas.

## Pendientes reales

- Entrega real de alertas, recuperación y concurrencia en PostgreSQL.
- Persistencia después de reconstruirCacheExistencias.
- Integraciones que necesitan una base de pruebas autorizada sin creación de usuarios temporales.
- Evaluación audible de notificaciones, no realizada por el navegador automatizado.

No se creó responsable/encargado. Esa posibilidad permanece como decisión futura en replit.md. Se trasladó únicamente Mes × color; ninguna tabla ni pestaña fue retirada.
