# Prompt F — resultado y límites

## Implementado

Una pantalla de detalle para ABONO, REVERSO y AJUSTE, endpoint y tipos ampliados, enlaces desde estado de cuenta, nota, rollo/Kardex y bitácora, navegación original/reverso y regreso al renglón del cliente. No hay acciones nuevas de escritura ni cálculo financiero en el navegador.

La jerarquía da prioridad a movimiento, importe y cliente. Se reutilizan tarjetas, tablas e insignias del sistema; los iconos y colores semánticos tienen explicación junto al código. Las secciones sin aplicación se omiten. El reparto revertido se identifica como evidencia histórica inactiva.

Las referencias de auditoría se verifican con identidad completa. Los registros antiguos incompletos no se atribuyen a un movimiento por coincidencia de ID. Las futuras llamadas de auditoría conservan datos de identidad, sin modificar el cálculo o la acción financiera.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| Typecheck raíz con el runner completo | PASS, cero errores |
| Bibliotecas scanned-code, number-format, metered-pricing, db, api-client-react, api-zod | Cero errores cada una |
| Etapa libraries; api-server; mariana-textil; scripts | Cero errores cada una |
| Codegen repetido | PASS, hashes idénticos de todos los archivos generados |
| Backend, contratos, referencias y arranque | 25/25 |
| Navegación frontend | 6/6 |
| Procedencia y aislamiento de fixtures | 3/3 |
| SELECT reales del detalle mediante EXPLAIN sin ANALYZE | PASS; se volvió a comprobar solo la consulta que cambió |
| Casos archivados 45, 48 y 50, a 402 y 1280 px | 6/6 |
| Casos sintéticos de esfuerzo, a 402 y 1280 px | 6/6, separados de la evidencia real |
| Guarda de aritmética financiera y mutante con resta de un centavo | PASS |
| Arranque de inspección API, frontend y healthz | PASS |

Los últimos ajustes de tamaño móvil del importe y visibilidad del usuario registrador sin fecha de captura se comprobaron con el typecheck del frontend; no se repitió el recorrido completo por esos cambios de presentación.

## Evidencia de navegador

- `verification-report.json`: casos reales **archivados**, mediante el componente productivo y respuestas obtenidas del constructor canónico sobre el respaldo leído.
- `verification-report-synthetic.json`: reparto múltiple, ajustes positivos/negativos, nombres de 150 caracteres y cantidades grandes **artificiales**, identificados como tales.
- `app-entry-402.jpg`: la ruta real de la app muestra el login esperado sin sesión.
- Las capturas y pruebas aisladas no son una E2E autenticada.
- No se restauró el respaldo, no se crearon usuarios/sesiones y no se ejecutaron mutaciones de negocio para probar.

## Datos reales que no se pueden acreditar

La base actual tiene cero movimientos de crédito. El cliente 7 existe, pero no conserva los movimientos citados en el documento. Los respaldos locales permitieron comprobar un abono revertido, su reverso y una recaptura aplicada; no proporcionaron un abono real repartido entre varias notas, un ajuste real ni los casos reales vinculados de nombre largo e importe grande. Esos requisitos de verificación **siguen pendientes**, no se sustituyen por la prueba sintética.

## Servicios y mantenimiento

El entorno se reinició automáticamente durante el trabajo. Se recuperaron API y frontend mediante un arranque optativo de inspección de desarrollo, revisado para evitar escrituras durante la carga de módulos y el arranque.

Con `API_INSPECTION_BOOT=1` quedan pausados los inicializadores, el backfill de compras y el monitor automático de mínimos. Las operaciones normales y permisos de los usuarios no cambian; el modo no convierte todos los endpoints en consultas libres de escrituras. No se hicieron logins ni GET con sesión, que podrían renovarla. La reactivación del mantenimiento debe ser explícita, no automática dentro de una entrega sin escrituras.

No se modificaron movimientos históricos, el veto de notas, la regla de saldo a favor, FIFO, impresión, asimetría de sitios, corte de caja ni vencimientos.