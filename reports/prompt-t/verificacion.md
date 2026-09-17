# Prompt T — entrega y verificación

Fecha: 2026-09-17.

## Resultado

Implementados los cuatro temas: impresión sin fragmentación, resolución individual de sobrantes por ADMIN, reactivación independiente de faltantes y avisos de cierre/pendientes.

Se conserva la decisión posterior al documento original: **no se bloquea ningún reverso preexistente ni se elimina la transición BAJA existente**. La reaparición es un hecho nuevo, con tipo de kardex propio, no una cancelación de la baja.

## Comprobaciones ejecutadas

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Referencia aislada `68568f62` | 354/354; cero fallos, canceladas, omitidas o pendientes | `baseline-suite.txt`, `baseline-exit.txt` |
| Suite original sobre la entrega | 354/354; cero fallos, canceladas, omitidas o pendientes | `current-suite.txt`, `current-suite-exit.txt` |
| `pnpm run typecheck` completo | Cero diagnósticos; todos los paquetes completados | `typecheck.txt`, `typecheck-exit.txt` |
| Motor y lógica de auditoría nuevos | 15/15 | `backend-tests.txt` |
| Componentes reales de interfaz | 6/6, en tres archivos | `frontend-tests.txt`, `frontend-restored-raw.txt` |
| Contrato nuevo de impresión | 1/1 | `print/contract-restored-green.txt` |
| Negativos semánticos del motor | Las 15 pruebas fallaron ante sus defectos; restauraciones verdes | `backend-negatives/` |
| Negativos semánticos de interfaz | 6/6 fallidas en copia aislada; 6/6 verdes al restaurarla | `frontend-mutant-raw.txt`, `frontend-restored-raw.txt` |
| Negativo del contrato nuevo de impresión | 0/1 con protección retirada; 1/1 restaurada | `print/contract-semantic-negative-report.json` |
| Contratos históricos de encabezado y escala | Los dos detectan sus defectos; archivo completo 4/4 al restaurar | `print/print-document-header-semantic-negative-report.json` |
| PDF real | Seis documentos de 2, 3 y 5 páginas, sin renglones ni firmas partidos; encabezado único | `print/auditoria-print-report.json`, PDFs y geometría en `print/` |
| Negativo de fragmentación PDF | Detectó una serie dividida entre páginas al retirar protección en copia aislada | `print/mutant-report.json`, `print/mutant-failure.txt` |
| Arranque de API | Compilación y esquema aditivo completados, servidor escuchando | `api-startup.txt` |
| Arranque de frontend | Vite listo; vista de acceso renderizada | `frontend-startup.txt`, `preview.jpg` |
| Consultas SQL reales de solo lectura | Dos auditorías, 72 resultados y tres contextos de reactivación | `sql-readonly-smoke.txt` |
| HTTP sin sesión | Salud 200; contexto de reactivación protegido con 401 | Comprobado desde el dominio de desarrollo |

La suite original conserva sus 354 casos. Dos contratos de impresión inicialmente fallaron porque inspeccionaban el archivo de la página anterior a la extracción del componente. Se cambió únicamente la ruta del archivo inspeccionado; se conservaron todas las aserciones de encabezado, QR y tamaños. Sus defectos semánticos también se verificaron en una copia aislada.

La evidencia negativa inicial basada solamente en cambiar un título no se acepta como prueba de comportamiento. La evidencia final de interfaz es la ejecución aislada de defectos sobre estado, navegación y origen enviado, con registros completos de fallo y restauración.

## Alcance y límites de las pruebas

- Las pruebas del motor ejecutan las funciones reales con dobles de transacción. No equivalen a ejecutar nuevas escrituras de mercancía contra PostgreSQL ni a completar una devolución y recepción autenticada de extremo a extremo.
- Las pruebas de interfaz montan componentes reales con servicios simulados. Verifican ambos accesos de reactivación, origen correcto, carga enviada, doble envío, errores, campos conservados y separación de sobrantes.
- La comprobación SQL usó la conexión configurada de la aplicación y `SET TRANSACTION READ ONLY`; no creó documentos, usuarios ni sesiones.
- La captura de la aplicación muestra la pantalla de acceso, no una operación autenticada. No se creó una sesión para obtenerla.
- No se crearon usuarios, ADMIN ni sesiones de prueba. No se editaron ni borraron movimientos, ajustes o registros históricos para preparar o limpiar pruebas.
- Las pruebas negativas finales se ejecutaron en copias aisladas, no alterando fuentes vigiladas de la aplicación.
- No se ejecutaron operaciones del Prompt P ni se cerró su Grupo 1.

## Impresión

Se conservaron Letter vertical, margen de 10 mm, diseño y densidad. Los conteos son resultados de la paginación natural, no cuotas de filas:

| Contenido | Páginas | Renglones |
|---|---:|---:|
| Compacto | 2 | 16 |
| Compacto | 3 | 56 |
| Compacto | 5 | 136 |
| Descripciones envueltas | 2 | 8 |
| Descripciones envueltas | 3 | 27 |
| Descripciones envueltas | 5 | 67 |

## Riesgo conservado y reportado

El análisis estático identificó una interacción importante: **revertir el ajuste de baja original después de reactivar el rollo puede volver a sumar su cantidad**. No se cambió ese reverso, conforme a la instrucción expresa de conservarlos todos.

También se identificaron cancelaciones y recepciones de documentos que restauran disponibilidad, incluida la cancelación de un traslado en tránsito, que devuelve al origen sin una recepción independiente. No se modificaron esos flujos. El detalle está en `flujos-disponible.md`.

Las reglas funcionales verificadas y la distinción entre reverso y reaparición están documentadas en `replit.md`.