# Tarea 1 — resultado real y ventana liberada

## Resultado

Se clasificaron las **64 celdas con operación identificada**: **63 solicitudes autenticadas** y una celda no enviada porque su permiso efectivo ahora permite la operación. Siete roles autenticados con `/auth/me`; actores sintéticos creados sólo en la copia.

| Evidencia | Resultado |
|---|---:|
| Denegación del guard de acción exacto | 39 |
| Intercepción E11 | 15 |
| Guard exterior diferente | 4 |
| Puerta/estado legacy 409 | 5 |
| Permiso efectivo distinto del baseline | 1 |
| Observaciones de navegador autenticado | 65 |
| Observaciones detenidas por timeout | 8 |
| Controles positivos API ADMIN | 9/9 |
| **Cierres nuevos UI+API con control real elegible** | **20** |
| Cierres API nuevos sobre las 381 pendientes | **0** |
| **Pendiente final API / combinado** | **381 / 401** |
| Sin operación, sin decisión inventada | **357** |

La matriz final por celda está en `final-ledger.json`; `owner-357.csv` mantiene las preguntas originales. No se declara terminada la matriz ni se resta una intercepción exterior del saldo de guards pendientes.

## Entorno y seguridad

MAIN cedió ventana exclusiva de escritura en `noche_20260926`. Se verificaron la identidad PostgreSQL y la URL efectiva del PID API en su entorno, frente al manifest privado. API `127.0.0.1:18227`, navegador `127.0.0.1:18228`; build congelado e identidad en el manifest de tarea 2. No se arrancó, reinició ni alteró ningún servicio desde esta tarea.

Las escrituras fueron creación de seis actores sintéticos y fixtures operativos en esa copia, sesiones reales y nueve controles positivos. Cada denegación conserva fingerprints de todas las tablas públicas excepto sesiones, antes y después: **sin cambios de negocio**; cambios de bitácora se distinguen explícitamente. No se modificó matriz, puerta E11/E3, perfiles de negocio, esquema ni base activa. No hay fix de producción, commit ni liberación.

Fixtures nuevos: entrada con seis rollos, entrada pendiente, tres reimpresiones, auditoría, contenedor, dos salidas cliente, salida extraordinaria, ticket pendiente, camioneta, chofer y equipo. Los nueve positivos posteriores al navegador editaron/cancelaron/revirtieron/revisaron/costearon esos fixtures; otros workers no deben asumirlos intactos. Las credenciales sólo están bajo `/tmp/noche-20260926/`, no en informes.

## Botón real y límites

Los 20 cierres nuevos combinan: respuesta exacta del guard elegido; fingerprint sin escritura; mismo recurso elegible visible para ADMIN; botón de acción ADMIN visible y habilitado; control ausente en sesión del rol negado; positivo ADMIN HTTP 2xx y captura. Cubren captura de costos, cancelación de salida, revisión de etiqueta y edición/cancelación de contenedor. Se abrieron formularios reales de captura de costos y de edición de chofer/equipo; la edición de contenedor abre su formulario inline, no un diálogo. No se confunde ausencia de diálogo con ausencia de acción.

Las capturas `ui-*.jpg`, `browser-results.json`, `direct-requests.json`, `positive-controls.json` y `fixtures.json` documentan la ejecución. Las observaciones iniciales durante carga se repitieron y sólo las marcadas `finalObservation` pueden cerrar celdas. Ocho esperas de UI terminaron en timeout y permanecen bloqueadas; no son evidencia de seguridad ni defectos de producto demostrados.

**TERMINAL:salidas_venta:crear** posee permiso efectivo en Mariana en esta copia; se registró drift del baseline y no se envió una mutación pretendiendo que estaba denegada. No se revocó el permiso para producir un verde.

Quedan sin control positivo elegible enlazado varios flujos que exigen selección de sitio/caja, transición de auditoría o navegación adicional; no se hizo pasar un botón genérico por su acción. E11 sigue bloqueando CONTADOR antes del guard interno, permisos `ver` siguen antecediendo a `editar`, y la ruta de pagos legacy no se habilitó artificialmente.

## Incidencias del corredor

El preflight inicial esperaba TEST_DATABASE_URL pero el bootstrap publicado usa DATABASE_URL: se corrigió a la variable efectiva documentada antes de cualquier escritura. Creación inicial de SISTEMAS rechazó sitio asignado (400); se respetó el rol global con sitio null. La consulta inicial de rollos supuso una columna inexistente; se sustituyó por los IDs de la respuesta auténtica de la entrada. No son fallos de la aplicación. `runtime-error.json` conserva el último error preparatorio, anterior a la ejecución final exitosa.

La primera ronda de fingerprints por tabla excedió el timeout del shell después de 31 resultados; se reanudó omitiendo celdas registradas y usando un único SELECT por snapshot para evitar latencia remota. El resultado terminal contiene 64 IDs únicos, sin duplicación de solicitudes registradas.

## Fin

`window-released.json` libera la ventana para MAIN y los demás workers. No quedan procesos del corredor de permisos activos. La copia pertenece a MAIN: no se destruyó unilateralmente porque las demás tareas aún la necesitan. MAIN debe destruirla al terminar la campaña general.