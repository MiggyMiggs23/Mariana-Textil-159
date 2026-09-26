# Tarea 3 — permisos sobre release vigente

## Resultado final autoritativo

**4 cierres directos nuevos y 12 combinados nuevos. Restan 377 directas y 389 combinadas.** Universo: 433 celdas. El saldo inicial era 381/401; las secciones posteriores conservan la cronología, no sustituyen este saldo final.

`final-ledger.json` enlaza cada cierre con rol, fixture, sitio, petición/cuerpo, control positivo, captura real y clasificación de frontera. `remaining-exact-cells.json` conserva todos los IDs aún abiertos. Constructor reproducible: `node reports/postrelease-review-20260926/tarea-3/finalize-native.mjs`.

- **Directas nuevas (4):** TERMINAL/CAJA/SUPERVISOR/BODEGA `permisos:editar`, actores nuevos con prerrequisito ver concedido y editar denegado. No se afirma que el actor original alcance ese guard.
- **Combinadas nuevas (12):** 2 escaneo de auditoría (TERMINAL/CAJA); 4 Cobrar (TERMINAL/SUPERVISOR/BODEGA/SISTEMAS); 1 cancelar salida (CAJA); 5 generar venta desde salida (TERMINAL/CAJA/SUPERVISOR/BODEGA/SISTEMAS).
- En cuatro negativas de generar venta, la API rechaza el guard seleccionado y la UI niega acceso/control. TERMINAL tiene permiso efectivo concedido y **sí generó** la venta de salida2 con el mismo control visible/habilitado documentado: cierre positivo, no falsa negativa.
- Cuando la UI niega mediante un guard de vista antecesor se documenta así. El guard API de acción se prueba **independientemente**; no se dice que el botón fue ocultado exclusivamente por su flag de acción.
- **12 operaciones positivas API exitosas**, además del positivo administrativo de variantes. Una primera prueba scan devolvió400 por piso de escritorio incorrecto; no se cuenta como éxito y se conserva.
- **Defecto corregido:** Recalcular habilitado para actor sin `conciliacion/autorizar`, con regresión montada RED/GREEN. MAIN integró el overlay; commit y liberación corresponden a MAIN. No se atribuye evidencia de discrepancia real en DB ni cierre matricial a ese test controlado.

### Detenido y siguiente acción concreta

| Grupo | Directas pendientes | Combinadas pendientes | Motivo / acción |
|---|---:|---:|---|
| Campos sin operación definida | 351 | 351 | Definir operación y botón reales o confirmar que el campo no aplica. No inventar reglas ni retirar campos unilateralmente. |
| Lectura E5 compuesta | 6 | 6 | Consumidor dinámico OR confirmado; separar capacidad compuesta/perfil de guard individual caja_abonos/ver. |
| CONTADOR E11 | 15 | 15 | Frontera vigente anterior al guard legacy. No deshabilitar E11 para fabricar cobertura. |
| Clientes finanzas legacy | 5 | 5 | Puerta409 vigente; flujo legacy no abierto artificialmente. |
| Variantes permisos editar | 0 | 4 | API directa cerrada; sin captura UI específica de esos actores configurados. |
| Confirmar auditoría | 0 | 5 | Auditoría ABIERTA no elegible para confirmar; ausencia de botón no prueba autorizar. |
| Revertir salida | 0 | 3 | API positiva funciona, pero no se encuentra contraparte UI ADMIN en pantalla liberada. Falta definir exposición/mapeo; no clasificarlo como defecto de permisos confirmado. |
| **Total** | **377** | **389** | **Parcial, no completado.** |

### Recuperación acotada de escaneo

La primera llamada usó piso3 de inventario y fue rechazada `DESKTOP_ACCESS_FLOOR_REQUIRED`. Se leyó la auditoría auténtica (cero escaneos) y catálogo de pisos; el navegador había seleccionado Planta Alta, piso4, obligatorio para escritorio. Se repitieron **ambas negativas exactas** TERMINAL/CAJA con cuerpo corregido y lectura de auditoría antes/después sin cambios; luego ADMIN escaneó exitosamente con ese mismo cuerpo. Evidencia: `audit-access-floor-negatives.json` y `native-positive-journal.json`. No hubo repetición ciega de una operación incierta ni SQL de fixtures.

**Fin:** corredores terminados, sin operaciones pendientes de respuesta. No se requieren más recorridos completos de navegador. MAIN puede hacer su commit de tarea3 y destruir la copia cuando finalice el resto de la campaña.

---

## Cronología y procedencia

**Parcial, no cerrado.** La matriz histórica autorizada está en `reports/noche-20260926/tarea-1`, aunque la numeración actual de esta tarea es 3.

## Ejecutado en la copia nueva

API `127.0.0.1:18337`, base `postreview_permissions_20260926`. Antes de cualquier fixture se comprobó la variable de conexión efectiva del PID contra el manifest privado y `current_database()`. La conexión SQL del runner fuerza `default_transaction_read_only=on`; todas las altas de actores y fixtures se realizaron por API. No se tocó la base activa ni se arrancó/reinició servicio.

- Siete roles autenticados y comprobados con `/auth/me`.
- 64 celdas clasificadas; **63 solicitudes autenticadas**.
- **39 denegaciones del guard exacto**, con fingerprints antes/después de todas las tablas públicas salvo sesiones: ninguna modificación de negocio.
- 15 intercepciones E11, 4 denegaciones exteriores de otro permiso y 5 bloqueos legacy/estado 409: **no prueban el guard seleccionado**.
- Una celda `TERMINAL:salidas_venta:crear` tiene permiso efectivo concedido. No se revocó ni se envió como falsa prueba de denegación.
- Fixtures nativos nuevos: entrada con rollos, entrada pendiente de costo, camioneta, chofer, equipo, contenedor, auditoría, reimpresiones, salida extraordinaria, dos salidas cliente y ticket.

## Saldos exactos

| Concepto | Cantidad |
|---|---:|
| Universo | 433 |
| Cierre directo histórico | 52 |
| Cierre combinado histórico | 32 |
| Directas pendientes | **381** |
| Combinadas pendientes | **401** |
| Nuevos cierres directos | **0** |
| Nuevos cierres combinados | **0** |
| Pendientes directas con operación mapeada | 24 |
| Pendientes combinadas con operación mapeada | 44 |
| Sin semántica de operación resuelta | 357 |

Las 39 denegaciones frescas corresponden a celdas ya cerradas directamente en el baseline. Repetirlas no reduce 381.

Se inspeccionaron las 357 celdas no mapeadas contra `sourcesContent` del sourcemap del **bundle API liberado**, no contra HEAD. El escaneo no encontró consumidores literales módulo/acción en los helpers examinados. Esto **no** demuestra inexistencia de consumidores dinámicos, no autoriza inventar operaciones y no convierte una celda en aprobada. El detalle y hash están en `release-consumer-inventory.json`.

## UI y controles positivos pendientes

`browser-request.json` entrega al único propietario de navegador las rutas, fixtures y roles representativos. Los recursos siguen elegibles: no se consumieron todavía mediante positivos ADMIN que cancelen, reviertan o cobren. Se requiere registrar sitio asignado, selección operativa, perfil y recurso idéntico, además del botón real habilitado para actor permitido y oculto/deshabilitado para actor denegado.

No se declara discrepancia UI/API sin esa evidencia conjunta. No hubo corrección de aplicación, overlay, build, commit ni liberación atribuida a esta tarea. E11 y las puertas legacy se conservaron: quitarlas para alcanzar un guard interior sería cambiar restricciones de negocio.

## Evidencia

`inventory.json`, `execution-ledger.json`, `direct-requests.json`, `auth-me.json`, `fixtures.json`, `cases.json` y `runtime-summary.json`. Credenciales exclusivamente en manifest privado bajo `/tmp/postrelease-review-20260926/postreview_permissions_20260926/`.

La copia no se destruyó: pertenece a MAIN y conserva fixtures para el navegador coordinado.

## Continuación: defecto de control Recalcular

**Defecto confirmado en componente real, candidato corregido; no liberado.** La página liberada ofrece `Recalcular` habilitado para SISTEMAS aun cuando su permiso efectivo `conciliacion/autorizar` es falso. Es el sentido **UI permite / API deniega**, no un bypass API demostrado. La API liberada exige explícitamente ese permiso antes del handler. La prueba monta la página real con ReactDOM/JSDOM y el helper real de permisos del árbol congelado; los datos de usuario son los `/auth/me` auténticos de esta copia. La discrepancia de inventario de la prueba es controlada, no se afirma que sea un registro vivo ni evidencia de navegador completo.

Overlay separado en `permission-overlay/artifacts/mariana-textil/src/pages/conciliacion.tsx`, derivado del candidato congelado de tarea 4 con hash previo obligatorio. No se modificó el archivo compartido ni el árbol de tarea 4. MAIN debe integrar este overlay **después** de tarea 4 y construir el candidato aprobado. Conserva el estado de error/reintento de tarea 4. Añade únicamente el permiso existente al botón y al handler; no cambia autorización API, matriz ni reglas de sitio.

`permission-mounted.test.mjs`: RED en release af0541 y en candidato tarea 4, por SISTEMAS sin autorización con botón habilitado; GREEN en overlay. Incluye los seis roles reales, sesión aún no resuelta, ADMIN, permiso configurado para no-ADMIN, mutación válida, pending y error de refetch. Evidencia `permission-released-red.txt`, `permission-mounted-red.txt`, `permission-mounted-green.txt`. Estos resultados no se descuentan de 381/401.

## Continuación: consumidores dinámicos y causa de las 357

La matriz administrativa dibuja cuatro campos por módulo, sin catálogo de acciones operativas aplicables: página congelada `permisos.tsx`, iteración `ALL_MODULES` y controles puedeVer/Crear/Editar/Autorizar. Por eso un campo almacenado/configurable no implica que exista operación de negocio para él. No se eliminó ningún campo ni se inventó una operación.

**Corrección de alcance del escaneo literal:** sí existen consumidores dinámicos. En particular `routes/e5.ts` resuelve `caja_abonos` y `clientes_finanzas`, y consulta `cash.puedeVer || client.puedeVer`; frontend `lib/e5-authorization.ts` replica el OR. Esto identifica un consumidor real de las **seis celdas `caja_abonos:ver`** entre las 357, pero no un guard exclusivo de ese campo: también intervienen la puerta E5, perfiles y el permiso alternativo. Deben probarse por ruta real `/e5/contexto` sin alterar permisos, distinguiendo denegación compuesta de acción directa seleccionada.

Otros consumidores revisados: E9 usa cortes ver/crear, remate usa marcar_remate autorizar, helpers de choferes/equipos/camionetas restringen crear/editar. No convierten los campos restantes de esos módulos en operaciones nuevas. `routes/permisos.ts` sí compara dinámicamente los cuatro campos para impedir autoescalamiento SISTEMAS: es una protección administrativa transversal, no una operación distinta por cada módulo/acción.

No se declara que las otras 351 carezcan definitivamente de consumidores: queda revisión individual de rutas, capacidades y UI. Todo continúa pendiente en el ledger hasta prueba exacta.

## Coordinación actual

MAIN notificó candidato final `92f612` con el overlay de permisos integrado y probado. Esa notificación no se usa como evidencia adicional de cierre matricial. MAIN conserva los commits separados: primero fuente de tarea 4, después permiso de tarea 3. Esta tarea no modifica `conciliacion.tsx` compartido.

Durante la ventana exclusiva de 180 segundos de tarea 2 se suspenden HTTP y acceso a base de datos de esta tarea; se espera la solicitud de navegador posterior. Los saldos siguen **381 directas / 401 combinadas**. Los campos cuya operación no está definida quedan **bloqueados por definición/decisión de negocio**, no aprobados ni descartados por falta de consumidor literal.

## Continuación posterior a ventana: cuatro directas adicionales

**Saldo actualizado: 377 directas / 401 combinadas.** Cuatro nuevos guards exactos demostrados para `TERMINAL/CAJA/SUPERVISOR/BODEGA:permisos:editar`, con actores sintéticos **separados** cuyo prerrequisito `permisos/ver=true` se concedió por override API y cuyo `editar=false` se conservó. No se modificaron actores originales, matriz de rol ni puertas. Es una variante explícita de prerrequisitos; el baseline original continúa bloqueado por `ver`.

Cada request válido contra un usuario objetivo sintético distinto obtuvo 403 del guard exacto de editar, sin cambios de negocio en snapshots completos antes/después. ADMIN ejecutó exitosamente el mismo endpoint/cuerpo/objetivo. Evidencia: `variant-results.json`, `variant-positive.json`, `variant-journal.json`; contabilizado separadamente en `execution-ledger.json`. No se cuentan cierres UI para estas variantes.

Setup nativo completado una vez: cuatro participaciones de auditoría1 (ADMIN/SUPERVISOR/BODEGA/SISTEMAS, HTTP200) y apertura de caja1 sitio1 fondo0 (HTTP201). `browser-targeted-ready.json` entrega los controles ahora elegibles a `postrelease-browser-finish`. Aún no se consumieron mediante scan/cobro/cancelación/generación.

E5 dinámico: ADMIN HTTP200 en contexto de cliente8/sitio1; TERMINAL/CAJA/SUPERVISOR/BODEGA denegación OR de consulta, SISTEMAS restricción de perfil y CONTADOR E11. No se contabilizan como guards independientes `caja_abonos/ver`. La tentativa inicial omitió query obligatoria y ADMIN respondió400; se conserva en `e5-initial-invalid-query.json`, no se disfraza de control positivo. La ejecución corregida está en `e5-dynamic-results.json`.