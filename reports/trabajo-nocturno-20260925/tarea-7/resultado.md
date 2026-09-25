# Tarea 7 — conciliación de matriz, pendiente de nueva copia

## Resultado verificable

`node reports/trabajo-nocturno-20260925/tarea-7/matrix-audit.mjs` terminó con código 0 sobre HEAD `f50c4613decb72e0dd6820b753c593a1f13913fc` al iniciar esta conciliación. Insumos históricos: `reports/tanda-g-ampliada/task1/runtime-cell-classification.json` (SHA-256 `5f0d1e0ffc75de7202a1a113a06c5e13057ffe7b0b2c165515608bd8aceb8784`) y `reports/tanda-h/permissions/direct-requests.json` (SHA-256 `eea9402af769921fc136f480e116ad0f7e80c060b29fe30ab5c1823871004124`). Los resultados por **cada celda** y la ruta histórica cuando existe están en `ledger.json`; los **357 campos sin operación identificada** y la pregunta individual para el propietario, en `owner-357.csv`. Este ejecutable es una conciliación de evidencias ya obtenidas, **no** una nueva prueba autenticada ni una nueva observación de UI.

| Clasificación única rol:módulo:acción | Celdas | Tratamiento |
|---|---:|---|
| Universo residual histórico | 433 | No equiparar con número de rutas |
| API, denegación del guard exacto previamente verificada | 52 | Cobertura histórica, no nueva |
| API guard exacto pendiente | 381 | 357 sin operación, 18 guard exterior, 6 puerta legacy |
| Guard exacto **y** control de acción UI previamente verificados | 12 | Cobertura histórica, no nueva |
| UI+API pendiente | 421 | Incluye las 381 anteriores y 40 con API directa pero sin UI específica |
| Nuevas celdas cerradas esta tarea | **0** | Ocho requests frescos tras handoff; todos interceptados por guards exteriores |

La campaña H ya ejecutó 24 requests autenticados para 24 de las 381 celdas (15 interceptados por E11, 5 por puerta legacy con 409, 4 por otros guards exteriores). **Ninguna** alcanzó el guard de acción seleccionado. Esas 24 tentativas no se suman a 52 ni se descuentan de 381/421. Tanda H registró 23 observaciones UI, seis clics de edición y 11 controles positivos ADMIN; esas observaciones no resuelven una celda cuyo guard API seleccionado no se alcanzó. Las capturas antiguas están en `reports/tanda-h/permissions/ui-*.jpg` y las observaciones en `browser-results.json`. Para las 40 con API directa y UI pendiente, `ledger.json` conserva las rutas/capturas antiguas cuando existen, **sin afirmar** que una captura de página pruebe el botón real; cinco celdas de `salidas_venta:crear` ni siquiera tienen ruta de UI atribuida en el baseline. Se requiere comprobar con el control elegible visible/oculto en sesión del rol correspondiente.

El runner también comprueba que cada fila de H corresponde exactamente al rol, módulo y acción del baseline, que un 403 exterior o un 409 no se reclasifiquen como guard interior y que no existan escrituras de negocio en las denegaciones registradas. Cinco pruebas con **defecto introducido** fallan como corresponde: falso guard interior, mutación de tickets bajo denegación, UI cerrada sin API, respuesta 200 declarada denegada y request duplicado. Son pruebas de integridad del ledger, **no** mutaciones de permisos ni pruebas funcionales del servidor.

## Límite y reanudación segura

### Nuevo handoff 25/09: ocho solicitudes autenticadas ejecutadas

MAIN declaró finalizada tarea 5/6 y cedió exclusivamente su copia desechable `night56_test` a tarea 7. Se ejecutó **una sola vez** `node reports/trabajo-nocturno-20260925/tarea-7/auth-tranche.mjs --execute` (código 0; fuente SHA-256 `ccdfcb082795c6614faf8c60fb8232fbe92f08514dc1f29376d26360ecb23803`). Preflight comprobó `tarea-5/ownership.json`: cluster privado y base efectiva `night56_test` en 55526, API PID de `ready.json` cuyo entorno apunta exactamente a esa base/43926, healthz 200 y existencia de `e11_perfiles/e11_operaciones`. No se utilizó `night56_witness` ni una base de aplicación. Credencial ADMIN privada de `private.local/night-t56/credentials.json`; se crearon seis usuarios **sintéticos** mediante `POST /users` dentro de esta copia (TERMINAL, CAJA, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR), cada cual autenticó login HTTP 200 y `/auth/me` HTTP 200 con rol correcto. No se asignó perfil ContadorA/F ni se mezclaron cuentas de tarea 6.

| Casos concretos | Solicitudes | Respuesta | Evidencia de recurso y no escritura |
|---|---:|---|---|
| CONTADOR, editar camioneta/chofer/equipo | 3 | 403 `PERFIL_DENEGADO` E11 anterior al guard seleccionado | Tres recursos nuevos reales creados por ADMIN; fingerprints de sus tablas intactos; ADMIN PATCH positivo 200 para cada uno |
| TERMINAL/CAJA/SUPERVISOR/BODEGA, `permisos.editar` | 4 | 403 `permisos.ver` anterior a `editar` | Fila existente TERMINAL/dashboard; `permisos_rol` intacta; positivo de actualización omitido: no está autorizado escribir matriz |
| CONTADOR, `permisos.editar` | 1 | 403 `PERFIL_DENEGADO` E11 | Misma fila y fingerprint intacto |

Resultados individuales, HTTP, ID/URL, cuerpo de error y fingerprints en `auth-tranche-results.json`; progreso parcial en `auth-tranche-progress.json`. **Ocho** denegaciones autenticadas, **cero** alcanzaron el guard de la acción elegida: saldo pendiente directo sigue **381** y UI+API **421**. No son ocho celdas nuevas cerradas. Los siete roles naturales (ADMIN + seis sintéticos) autenticaron; tres controles ADMIN positivos confirman recursos/cuerpos válidos, no conceden al CONTADOR acceso. Este corredor no abrió navegador ni afirma cobertura de botones para estas ocho. `auth-tranche.mjs` bloquea segunda ejecución si existe resultado final; no repetir sin campaña nueva y coordinación expresa.

`reports/tanda-h/setup/teardown-verification.json` registra que la copia de la campaña H fue retirada. No se reinició workflow, servidor ni proxy; no se tocó la base de aplicación, identidades reales, permisos, puerta E3/E11, fuente compartida E5/E11 ni semántica de negocio. Las escrituras autorizadas se limitaron a usuarios sintéticos y fixtures/controles positivos en `night56_test`; cero escrituras de negocio de las ocho denegaciones según fingerprints específicos. No se demostró discrepancia UI/API corregible; no usar el 403 genérico como demostración de seguridad de otra acción.

Trabajo posterior: con autorización nueva y una copia PostgreSQL exclusiva, focalizar los guards aún no alcanzados o las 40 acciones UI pendientes; comparar fingerprint de tablas de negocio antes/después, registrar respuesta exacta, clic/ausencia del botón y captura, sin modificar matriz/gates. Si persiste la intercepción E11/E3 u otro guard exterior, reportar el bloqueo y no forzar el paso. Para cada fila de `owner-357.csv`, solicitar método/ruta, botón real y estado elegible, o confirmación expresa de que el campo carece de operación; no se inventó ninguna. No duplicar el recorrido de perfiles de tarea 6.