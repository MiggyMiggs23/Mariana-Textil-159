# Prompt O — corrección de fechas de vencimiento

## Estado

Implementación y verificaciones de código terminadas. API y frontend activados en desarrollo mediante reinicio normal autorizado expresamente por el propietario. Los inicializadores terminaron sin errores y el backfill de compras registró cero inserciones. Evidencia: `activation-api.log` y `activation-web.log`. La vista previa posterior al reinicio cargó correctamente y mostró login/401; esto no sustituye la comprobación autenticada de la nota y su impresión.

## Reproducción antes y después

Se consultó la nota real 1000 con transacciones READ ONLY / REPEATABLE READ. La nota 1005 no existe actualmente. No se crearon usuarios, sesiones ni datos de prueba en la base.

| Paso | Antes | Después |
| --- | --- | --- |
| `tickets.fecha_vencimiento::text` | `2026-10-16` | `2026-10-16` |
| `movimientos_credito.fecha_vencimiento::text` | `2026-10-16` | `2026-10-16` |
| Esquema productivo del detalle, serializado | `2026-10-16T00:00:00.000Z` | `2026-10-16` |
| Formateo del componente en Ciudad de México | `15/10/2026` | `16/10/2026` |
| Proyección y formateador de impresión existentes | `16/10/2026` | `16/10/2026` |

La `T` y la `Z` nacían al serializar el Date creado por el esquema. Aunque OpenAPI declaraba `format: date`, Orval con `useDates: true` trataba esa fecha como un instante. El transformador de generación ahora conserva los días mediante `CalendarDate`; los `date-time` siguen siendo instantes.

La comparación anterior ejecutó los esquemas y funciones reales sobre valores leídos de la base. **No es una observación HTTP autenticada.** La reproducción inicial ejecutó el parseo extraído del componente real; la regresión posterior también renderizó el componente real con React SSR y datos de prueba en memoria.

## Consumidores

- Detalle de nota, Cobros, Alertas, Notificaciones, desglose de crédito de Caja y primer vencimiento del cliente reutilizan `formatDateOnlyMx`.
- La función compartida y los archivos productivos de impresión permanecen sin cambios.
- Cartera conserva `dueAt`/`primerVencimiento` como etiquetas de calendario; sus cálculos de días comparan ordinales de días con el día actual de Ciudad de México.
- Alertas conserva `fechaVencimiento` como cadena después de validar la respuesta y mantiene los cálculos calendarios de días restantes/vencidos.
- El estado de cuenta XLSX añade la columna `Fecha de vencimiento` como texto `YYYY-MM-DD`. Se verificaron los bytes producidos por el constructor real y las celdas después de volver a abrir el archivo.
- Los filtros afectados por el nuevo tipo de contrato se validan como cadenas antes de construir límites internos de SQL. Se preservó la semántica previa: límites de México en Entradas/Kardex y límites históricos UTC de Salidas. No se cambió qué intervalo selecciona Salidas.

## Comprobaciones ejecutadas en esta sesión

- Contratos generados: 5 pruebas aprobadas, incluyendo detalle de nota/ticket, cobros, movimientos, notificaciones/alertas, primer vencimiento y separación de `date-time`.
- Render real del componente y formato calendario: 3 pruebas aprobadas bajo Ciudad de México.
- Contratos de impresión: 17 pruebas aprobadas; no se modificó la impresión productiva.
- Calendario/aging: 27 pruebas aprobadas en zona del sistema, Ciudad de México y Tokio; incluyen día 1, fin de mes, año bisiesto y vencimiento del mismo día.
- Asignación de crédito, estado de cuenta y riesgo de alertas: pruebas enfocadas aprobadas.
- Compatibilidad de filtros de Entradas/Kardex/Salidas: 9 pruebas aprobadas; además se repitieron las 3 de Salidas al restaurar expresamente sus límites históricos.
- Contrato de ticket: 2 pruebas aprobadas con vencimiento de tipo cadena.
- XLSX real en memoria: celdas `2026-01-01`, `2026-01-31`, `2024-02-29`, `2026-10-16`, aprobadas en tres zonas horarias. No fue una descarga autenticada.
- `pnpm run typecheck` completo: cero errores.
- Codegen repetido: archivos generados estables.
- Builds de API y frontend: aprobados sin arrancar la API.
- Revisión final: sin bloqueantes funcionales o de alcance.

Evidencia: `reproduction-before.*`, `reproduction-after.*`, `excel-verification.json`, `typecheck-final.log`, `codegen.log`, `api-build.log` y `web-build.log`.

## Límites explícitos

La vista previa real mostró login y HTTP 401, sin sesión disponible. **La comprobación en navegador con la nota real y su impresión no está aprobada.** No se inició sesión para simularla.

No se alteró el cálculo de vencimiento al autorizar, POS ni los documentos impresos. Las verificaciones se ejecutaron sin escrituras de prueba; posteriormente se autorizó y ejecutó el reinicio normal con sus inicializadores habituales. No se crearon usuarios, sesiones ni movimientos de prueba. No se publicó una versión.

No se afirma que toda la suite histórica del repositorio esté aprobada: una ejecución exploratoria de otros contratos antiguos presentó discrepancias de fixtures/aserciones ajenas a la corrección; no se modificaron indiscriminadamente. La evidencia de aprobación se limita a las verificaciones nombradas arriba.