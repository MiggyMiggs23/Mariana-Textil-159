# Paginación y carga anual de crédito

## Estado
La paginación ya está incluida en el frontend seleccionado `dist-sidebar-order-20261001`. No fue necesario modificar el producto. Se verificaron hashes del build seleccionado y equivalencia con las fuentes congeladas; 19 comprobaciones de presentación, impresión, exportación y procedencia aprobaron.

## Medición terminada
Evidencia válida: `run-eyvl53/result.json`, estado COMPLETED, proceso exit 0, cleanupPassed true. Los intentos anteriores conservan errores del arnés y no forman parte de las estadísticas finales.

Carga nueva completamente sintética en PostgreSQL local desechable: 2,575 clientes más el cliente sistema, 54,750 tickets/líneas/rollos, 41,063 pagos y 13,687 movimientos de crédito. Tres tiendas, 50 tickets diarios por tienda durante 365 días, del 2025-09-27 al 2026-09-26. Es una carga histórica SQL de rendimiento, no certificación de productores contables.

API congelada seleccionada y frontend seleccionado servidos en procesos aislados. Para el control sin paginación se sustituyó solo el booleano de presentación en el JavaScript servido por el proxy de prueba; no se alteró el build original. Tres navegadores nuevos con login real por modalidad. Medición: navegación anual hasta reporte visible más dos frames; login fuera del intervalo.

| Modalidad | Mínimo | Mediana | Máximo |
|---|---:|---:|---:|
| Paginación actual | 2.032 s | 2.696 s | 3.981 s |
| Control sin paginación, misma carga | 8.936 s | 9.609 s | 12.141 s |

Reducción observada de mediana: aproximadamente 72%. API: mediana 0.746 s con paginación y 0.914 s en el control; no se cambió la consulta. La mediana visual cumple 3 s, el máximo todavía no. Son tres muestras por modalidad, primero activada y después desactivada, no una garantía de latencia ni un experimento aleatorizado.

La medición histórica de 11.792 s se hizo en Neon con clientes heredados y otra versión. No debe atribuirse toda la diferencia respecto a ella a la paginación.

## Integridad
- Respuestas financieras completas iguales entre las seis muestras; mismos totales visibles y del API.
- Pantalla: 50 filas de 2,575 clientes y 50 de 13,687 cuentas por cobrar; ordenamiento sobre todos los datos.
- XLSX real: conteos completos de todas las tablas, incluidos los 2,575 clientes y 13,687 movimientos FIFO.
- PDF real: contiene los 2,575 identificadores sintéticos esperados en ambas modalidades. Esta comprobación no cuenta estructuralmente cada fila de cada tabla; la integridad de filas se verificó en XLSX y el flujo completo del exportador.
- Sin errores JavaScript ni respuestas HTTP fallidas dentro del intervalo medido.
- Base real no consultada ni modificada. Procesos y base desechables eliminados; no se cambiaron código de producción, consultas, permisos, índices ni workflows.