# Mariana Textil — revisión posterior a la liberación

26 de septiembre de 2026. Informe único para el propietario. Los directorios tarea-1 a tarea-4 son anexos de evidencia, no entregas pendientes.

## Resultado y versión activa

Liberadas en la aplicación activa del workspace: corrección del 500 al cobrar simultáneamente, impresión del corte, estado de error de Conciliación, permiso de Recalcular y limpieza de efectos al cambiar la modalidad de salida. Se conservan las correcciones anteriores de ContadorA, consultas paralelas, login simultáneo, alias SQL, recuperación y paginación de crédito.

No se republicó un despliegue externo. Se verificó la aplicación servida por los workflows existentes:

- `/api/healthz`: HTTP 200, `{"status":"ok"}`.
- API: `dist-owner-cash-v10-20260926/index.mjs`; SHA256 `dafb028d684e3de6f04232908c5fa5054c9bb1757d5dc4bb7f40eb2a29585df1`; proceso observado 18287.
- Interfaz servida: `dist-postreview-final-20260926`; index SHA256 `92f6123346e12d569a724840102d9fff57f915086a8f0e48d4c5b7ccf774bf72`.
- Manifiestos `api.sha256` y `frontend.sha256` comprobados al arrancar. Se conserva el arranque de inspección, sin inicializadores ni mantenimiento automático.
- No se aplicaron migraciones ni fixtures de esta campaña a la base de la aplicación.
- Construcción desde fuentes congeladas de la versión liberada, no desde todo HEAD. Una modificación API y tres archivos frontend. Inventarios y pruebas en los anexos.

## 1. Recorrido financiero — aprobado, con defecto de impresión corregido

En copia desechable: contado 1,000; crédito autorizado 1,000; abono efectivo 250; recibo efectivo E5 de 300 retenido sin reducir deuda; propuesta de 200 sin efecto financiero; aplicación ADMIN de 200; dirigido por transferencia 100; remate 10 × 40 = 400; gasto de caja 25; traslado físico con recepción; cierre no vacío.

Comprobación independiente HTTP y PostgreSQL READ ONLY: caja esperada y contada **1,925**, diferencia **0**; crédito **450**, disponible **49,550**, saldo a favor **0**. E5 recibido **400**, aplicado **300**, retenido **100**. Las aplicaciones sin dinero no duplicaron ingresos.

33 escrituras confirmadas; 1,088 respuestas HTTP; cero 5xx. Capturas de los estados y documentos conservadas en `tarea-1/`.

Defecto encontrado: “Imprimir Corte” producía PDF vacío. El diálogo estaba directamente bajo body y las reglas de impresión lo ocultaban. Se corrigió visibilidad y centrado exclusivo de impresión. Reprueba nativa del mismo corte: PDF de 3 páginas, 180,517 bytes, título, total 1,925 y última salida −25; todo el texto dentro de la página, sin recorte. No se repitieron movimientos.

Límite: las capturas PDF E5 tomadas después de retirarse su bandera temporal de impresión no acreditan un PDF válido. Se conservaron las capturas/clics nativos, pero no se afirma impresión física E5. Recibos E3 y documento de salida sí tienen texto PDF extraído.

Evidencia: `tarea-1/informe.md`, `tarea-1/retest-impresion.md`, `tarea-1/cut-print-retest-1790416705549/`.

## 2. Concurrencia — fallo real conservado; corrección y reprueba aprobadas

Primera corrida: seis usuarios, dos cajeros, tres escáneres de auditoría y ADMIN en reportes; los actores restantes continuaron durante 195.779 segundos tras el fallo.

Paso exacto fallido: cajero 236, Cobrar → Efectivo → Confirmar Pago, ticket sintético 16, POST `/api/tickets/16/cobrar`, 10:07:46.046 UTC, request-id `overlap-1790417248674-236-31`. HTTP 500 en 1,070 ms, simultáneo al cobro del otro cajero. Lectura posterior: no cobrado, cero pagos, caja del actor en cero. No se reintentó la operación incierta.

Causa: trigger instalado `e5_serialize`, rechazo explícito 40001 “E5: grafo ocupado”. El endpoint tomaba bloqueos de ticket/caja antes de llegar al trigger. Corrección en `routes/pos.ts`: adquirir el mismo bloqueo transaccional E5 como primera sentencia de la transacción, antes de los bloqueos de filas. Sin reintentos de escritura, sin relajar triggers, permisos ni reglas monetarias. Pruebas nativas reproducen rojo anterior y verde corregido, incluyendo rollback por fallo de auditoría y doble cobro del mismo ticket.

Reprueba con la API corregida y la interfaz final: **196.075 segundos**, seis actores, **24 cobros nuevos** (12 por cajero), tres auditores con 25 escaneos cada uno y 25 navegaciones de reportes del ADMIN. Se verificaron los 24 tickets y el aumento de 12,000 por caja. Las seis identidades siguieron válidas.

**1,307 respuestas HTTP, cero 500 y cero 401 autenticados.** p95 HTTP **1,728 ms**, máximo **2,956 ms**. Se registraron también 96 cancelaciones de solicitudes del navegador `ERR_ABORTED`, distintas de errores del servidor; no se ocultan. La primera corrida tuvo 11 solicitudes mayores a 2 segundos y máximo 2,755 ms. No se afirma ausencia de latencia ni capacidad ilimitada.

Capturas/timeline iniciales y finales conservados. El ticket 16 no fue reutilizado ni su journal borrado; la reprueba usó tickets nuevos. La copia completa fue destruida al terminar.

Evidencia: `tarea-2/informe.md`, `tarea-2/cash-regression/results.json`, `tarea-2/overlap-1790418825995/{result.json,timeline.jsonl}`.

## 3. Permisos — avance parcial, no matriz terminada

Universo original: 433 celdas. Pendientes iniciales: 381 directas / 401 combinadas. Se cerraron **4 directas y 12 combinadas nuevas**. Pendientes finales: **377 directas / 389 combinadas**.

Las cuatro directas usan actores sintéticos con el prerrequisito de ver y sin editar, etiquetados como variantes, no como perfiles originales. Hubo denegación exacta y control positivo con igual cuerpo y destino. Las combinadas cubren escaneo, cobro, cancelación de salida y generación de venta desde salida. TERMINAL tenía permiso efectivo permitido para generar venta: se verificó el positivo, no se falseó una denegación.

Se corrigió el botón y el handler Recalcular para respetar `conciliacion/autorizar`. Prueba de componente real roja contra versión liberada y verde contra candidata, con permisos auténticos de seis roles y controles positivo/negativo. La reproducción nativa del botón en un usuario sin permiso quedó limitada por ausencia de discrepancias elegibles; esa limitación no se oculta.

Pendientes directas/combinadas:

| Motivo | Directas | Combinadas |
|---|---:|---:|
| Operación no definida/mapeada: decisión de negocio | 351 | 351 |
| E5: permiso OR y restricciones de perfil | 6 | 6 |
| Barrera E11 | 15 | 15 |
| Estado legacy 409 | 5 | 5 |
| Variantes de permisos sin su propia evidencia UI | 0 | 4 |
| Confirmación de auditoría no elegible, estado ABIERTA | 0 | 5 |
| Revertir sin contraparte UI ADMIN identificada | 0 | 3 |
| **Total** | **377** | **389** |

No se abrieron compuertas E11/legacy para “hacer pasar” pruebas. No se decidió que un permiso genérico sin operación deba crear una función nueva. La ausencia de Revertir no se calificó automáticamente como bypass: falta definir su exposición/contraparte.

Evidencia exacta por celda, perfiles, capturas, negativos y positivos: `tarea-3/final-ledger.json`, `tarea-3/remaining-exact-cells.json`, `tarea-3/resultado.md`, `tarea-3/native-ui-informe.md`.

## 4. Revisión independiente — dos defectos corregidos, límites explícitos

Inventario: 77 registros UI y 322 API; revisión acotada de ocho superficies de error y reglas relacionadas de replit.md. **No equivale a ejecutar todas las pantallas o certificar el sistema completo.**

- Conciliación mostraba “Las existencias coinciden con el kardex” ante fallo de consulta. Ahora muestra error/reintento y bloquea reparación con datos fallidos, incluso tras un refetch con datos anteriores. Regresión montada y QueryClient real.
- SalidaNueva retenía temporizadores al cambiar modalidad. Se separó la rama de transferencia en un componente con ciclo de vida propio. Router real: antes 1→1→2→2, dos temporizadores tras desmontaje; después 1→0→1→0, ninguno tras desmontaje. No se atribuye un crash de React que no ocurrió.
- Pendiente: Recalcular puede resolver reparación y fallar al leer la respuesta. Se probó el flujo del handler, pero falta prueba SQL dirigida de persistencia tras commit. No se afirma daño o escritura parcial demostrada.
- Otros productores financieros usan órdenes de bloqueos diferentes. No se generalizó el bloqueo de cobros a todos ni se afirma eliminar todos los posibles 40001.

Pruebas finales de componente, QueryClient, permiso y lifecycle; build/typecheck aprobados. Fallos de harness y suites no ejecutables conservados en el anexo, sin maquillarlos como aprobados.

Evidencia: `tarea-4/informe.md`, `tarea-4/final-candidate.json`, `tarea-4/final-source-inventory.json`.

## Commits separados

| Tarea | Commit | Contenido |
|---|---|---|
| 1 | c3f95813 | Recorrido financiero, capturas y corrección de impresión |
| 2 | 11c9096e | Cobro concurrente, regresión nativa y reprueba |
| 3 | 70043b85 | Guard de Recalcular y matriz/evidencia |
| 4 | 864f5820 | Error de Conciliación y ciclo de vida de SalidaNueva |
| 5 | etiqueta postrelease-review-20260926-final | Informe, activación y destrucción de copias |

Las tareas independientes no requirieron orden numérico de commit. La tarea 4 precede al guard de tarea 3 para mantener separados ambos cambios de Conciliación. Los bundles integrados se activaron juntos tras pruebas.

## Copias destruidas

Se eliminó únicamente la rama propia `br-calm-wildflower-ax5d3p8e` con sus tres bases; consulta posterior confirmó 404. Seis puertos privados cerrados. Se eliminaron dumps, credenciales, URLs privadas y logs crudos temporales. Archivo sanitizado de 290 operaciones, sin cuerpos ni credenciales; journal incierto histórico preservado, no reintentado.

Prueba: `cleanup.json` e `infra/terminal-evidence-archive.json`. La base de la aplicación y otras ramas no se modificaron durante la limpieza.

## Lista corta para el propietario, en orden

1. Recarga la aplicación. Dos cajeros entren y hagan cobros reales simultáneos durante su trabajo normal; comprobar un solo cobro y recibo por ticket.
2. Abre un corte ya cerrado → Ver corte → Imprimir Corte: debe verse el contenido completo, total y última salida, no una hoja vacía.
3. Revisa Conciliación con los perfiles correspondientes: Recalcular requiere autorización. Un fallo de consulta debe mostrar error, nunca afirmar que todo coincide.
4. Cambia entre transferencia y venta en Nueva salida y regresa; verifica que cada modalidad muestre sus controles correctos.
5. En crédito revisa paginación y exportación completa. En abonos revisa recibo, aplicado y retenido sin duplicar ingresos.

Detenido: matriz residual desglosada arriba; definición de acciones no operativas y exposición de Revertir; auditoría no elegible; confirmación SQL del caso de respuesta incierta de Recalcular; impresión física E5. No se pide al propietario validar cientos de celdas ni resolver fallos técnicos por ensayo.