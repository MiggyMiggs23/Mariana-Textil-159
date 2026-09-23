# E11 — backend estable OFF preparado para MAIN

## Estado

Se prepararon 60 casos nativos aislados y 60 mutantes semánticos en
`artifacts/api-server/src/lib/e11.test.ts`, `reports/e11/backend-mutants.mjs` y
`reports/e11/run-backend-offline.mjs`. No se ejecutó ningún caso, app, API, SQL,
DB, workflow ni instalación. No se modificaron producción, contratos, OpenAPI,
generados, SQL ni evidencia E5. Todos los gates E11 y E5 continúan `false`.

El alcance dinámico es deliberadamente offline: funciones productivas reales con
actores, transacciones rollback-capable, respuestas y solicitudes SQL sintéticos.
Cubre OFF sin consultas, canonicalización e idempotencia, dinero exacto,
calendarios DIA/SEMANA/MES sin plazos, cursores atados a
identidad/filtros/fuente, replay, fuente fiscal `facturado` (no cobrado), DTO
fiscal whitelist, agregación y separación de capacidad A/E5 mientras OFF.
Los positivos susceptibles de fallar por excepción inesperada usan
`doesNotReject`/`doesNotThrow`, de modo que el mutante debe terminar como
`ERR_ASSERTION` y no como error de dominio aceptado.

El seam estable permite preparar conducta ON sin alterar los defaults OFF:
identidad CONTADOR sin sidecar como F, A explícito/versionado, asignación ADMIN con
CAS/historial/replay, rechazo CAS sin escrituras, revocación A→null y reingreso F,
segunda reautorización de entrega, parse dentro de la primera transacción, fallo de
entrega posterior al commit, default-deny legacy puro y middleware autenticado.
`NO_CUADRA` usa la función real con una transacción fake que revierte
decisión+aviso+notificación al fallar la notificación, permite reintentar el mismo
UUID y no duplica efectos en replay. La preparación A usa `e11Prepare`,
`e5Command`, `e5Repository`, `e5Context` y `liveActor` reales con ledger fake:
sólo produce `PROPONER`, sin recepción/aplicación/aprobación/rechazo, favor o
devolución. No se usan búsquedas regex sobre rutas como pruebas funcionales.

La transacción sintética acredita la unidad lógica y rollback del coordinador, no
la implementación de PostgreSQL. No acredita aislamiento SERIALIZABLE, locks
reales, FKs, triggers, DDL, fallos de COMMIT del driver, routing Express completo
ni ningún usuario DB. La frontera legacy sí se invoca como middleware con
request/response fake; no se afirma servidor HTTP integrado.

## Uso exclusivo de MAIN

```sh
# Cardinalidad, IDs y anclas; no ejecuta casos
node reports/e11/run-backend-offline.mjs --validate-only

# Bundle físico aislado/metafile; no ejecuta casos
node reports/e11/run-backend-offline.mjs --build-only

# MAIN, posteriormente: matriz completa
node reports/e11/run-backend-offline.mjs

# Continuación exacta nombrada
node reports/e11/run-backend-offline.mjs --ids E11-CURSOR-BINDS-SOURCE,E11-REPLAY-SAME-BODY-NO-WORK
```

`--ids` rechaza valores vacíos, desconocidos y duplicados; una selección parcial
termina `COMPLETE_EXPLICIT_SUBSET`, nunca PASS global. Cada caso genera raw logs
verde/rojo/restored-green y un manifiesto con selección, hashes de fuentes,
mutante, restaurado y logs. El runner copia inputs físicos, rechaza imports vivos
workspace según metafile, usa lista blanca de entorno sin credenciales y aplica
guardas de red/escritura. Setup, guardas o errores de dominio sin
`code: 'ERR_ASSERTION'` jamás cuentan como rojo.

## Continuación después del primer intento MAIN

El manifiesto `backend-2026-09-23T00-11-44.214Z` permanece `FAIL`. Conserva ocho
ciclos terminales, desde `E11-OFF-ALL-GATES` hasta
`E11-CALENDAR-DAY-OPTIONAL`, sobre el snapshot de test
`99822214…2ac20a`. El rojo de `E11-CALENDAR-WEEK-MONDAY` sí detectó el mutante,
pero salió directamente con `E11Error/VALIDACION`; el runner lo rechazó
correctamente porque no era `ERR_ASSERTION`.

No es defecto productivo. El mutante cambia el día válido de lunes a martes y la
expectativa positiva invocaba el periodo fuera de `assert.doesNotThrow`. Se
envolvió esa llamada positiva; se aplicó la misma corrección preventiva al límite
mensual equivalente. Al reconstruir ambas declaraciones anteriores se recupera
exactamente SHA-256 `99822214f91353bf1c6066557f0a5762f1b9392b661a6fa9efd6fd6efe2ac20a`.
Las ocho declaraciones ya acreditadas y todos los helpers son idénticos por AST;
el snapshot actual es `add3575e…2711`.

Restan exactamente estos 40 IDs, incluido el caso que no completó ciclo:

```sh
node reports/e11/run-backend-offline.mjs --ids E11-CALENDAR-WEEK-MONDAY,E11-CALENDAR-MONTH-BOUNDARY,E11-CALENDAR-NO-DEADLINES,E11-PERIOD-OPEN,E11-RANGE-NONEMPTY,E11-ADVANCE-CALENDAR,E11-CAPABILITY-EXPLICIT,E11-CURSOR-BINDS-IDENTITY-VERSION,E11-CURSOR-BINDS-FILTERS,E11-CURSOR-BINDS-SOURCE,E11-PAGINATION-LIMIT,E11-REPLAY-LOCK-NAMESPACE,E11-REPLAY-SAME-BODY-NO-WORK,E11-REPLAY-DIFFERENT-BODY-DENIED,E11-FISCAL-FACTURADO-NOT-COBRADO,E11-FISCAL-DTO-WHITELIST,E11-FISCAL-TOTAL-ALL-DOCUMENTS,E11-FISCAL-CLIENTS-DISTINCT-SOURCE,E11-PROFILE-HISTORY-APPEND-ORDER,E11-SNAPSHOT-SOURCE-CHANGE-REQUIRES-REVISION,E11-SNAPSHOT-FROZEN-SALES,E11-SNAPSHOT-EVIDENCE-CAS,E11-PERIOD-LIST-SEPARATE-OBLIGATIONS,E11-IDENTITY-CONTADOR-DEFAULT-F,E11-IDENTITY-A-EXPLICIT-CURRENT-VERSION,E11-ASSIGN-ADMIN-CAS-HISTORY,E11-ASSIGN-STALE-CAS-NO-WRITE,E11-ROLE-CHANGE-REVOKES-A,E11-ROLE-REENTRY-STARTS-F,E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY,E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION,E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT,E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY,E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION,E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY,E11-A-PREPARATION-DUPLICATE-NOTES-DENIED,E11-LEGACY-DEFAULT-DENY-POLICY,E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES,E11-E5-A-CLOSED-WHILE-OFF,E11-ERROR-BODY-IS-PRIVATE
```

## Continuación después del segundo intento MAIN

El manifiesto `backend-2026-09-23T00-14-05.276Z` también permanece `FAIL`.
Conserva otros catorce ciclos terminales, desde `E11-CALENDAR-WEEK-MONDAY`
hasta `E11-REPLAY-DIFFERENT-BODY-DENIED`, sobre el snapshot
`add3575e…2711`. Junto con el intento anterior hay 22 IDs acreditados.

El verde de `E11-FISCAL-FACTURADO-NOT-COBRADO` falló por una aserción de fixture
obsoleta, no por producto: la fuente fiscal real usa
`accountedDocumentPredicate`, cuyo contrato canónico incluye `t.cobrado=true`
para Tickets procesados por Caja y `autorizacion_estado='AUTORIZADA'` para Notas.
Se sustituyó la prohibición léxica de cualquier texto `cobrad` por verificaciones
precisas: `t.facturado=true`, predicado canónico de Ticket y ausencia de tablas
de pagos/aplicaciones dirigidas. No se relajaron congelación, fuente fiscal,
agregación ni DTO.

Se auditaron estáticamente los fixtures restantes contra las funciones reales y
las anclas únicas: secuencias de snapshot/evidencia, periodos, identidad fresca,
CAS/historial, revocación, ambas transacciones de `execute`, rollback/replay
`NO_CUADRA`, productor E5 real y frontera legacy. No se encontró otro desajuste
de preparación evidente. Al restaurar sólo la aserción fiscal anterior se
recupera exactamente `add3575ebb3e41aab6b259859a7e5487fbdc00d249211483566324894ef62711`;
los 22 tests acreditados y todos los helpers permanecen idénticos por AST. El
snapshot actual es `6710609f…da99`.

Restan exactamente estos 26 IDs, incluido el verde fiscal que no completó ciclo:

```sh
node reports/e11/run-backend-offline.mjs --ids E11-FISCAL-FACTURADO-NOT-COBRADO,E11-FISCAL-DTO-WHITELIST,E11-FISCAL-TOTAL-ALL-DOCUMENTS,E11-FISCAL-CLIENTS-DISTINCT-SOURCE,E11-PROFILE-HISTORY-APPEND-ORDER,E11-SNAPSHOT-SOURCE-CHANGE-REQUIRES-REVISION,E11-SNAPSHOT-FROZEN-SALES,E11-SNAPSHOT-EVIDENCE-CAS,E11-PERIOD-LIST-SEPARATE-OBLIGATIONS,E11-IDENTITY-CONTADOR-DEFAULT-F,E11-IDENTITY-A-EXPLICIT-CURRENT-VERSION,E11-ASSIGN-ADMIN-CAS-HISTORY,E11-ASSIGN-STALE-CAS-NO-WRITE,E11-ROLE-CHANGE-REVOKES-A,E11-ROLE-REENTRY-STARTS-F,E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY,E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION,E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT,E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY,E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION,E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY,E11-A-PREPARATION-DUPLICATE-NOTES-DENIED,E11-LEGACY-DEFAULT-DENY-POLICY,E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES,E11-E5-A-CLOSED-WHILE-OFF,E11-ERROR-BODY-IS-PRIVATE
```

## Continuación después del tercer intento MAIN

El manifiesto `backend-2026-09-23T00-16-53.924Z` permanece `FAIL`. Conserva
otros catorce ciclos terminales, desde `E11-FISCAL-FACTURADO-NOT-COBRADO`
hasta `E11-ROLE-CHANGE-REVOKES-A`, sobre `6710609f…da99`. En total hay 36 IDs
acreditados.

El mutante de reingreso sobrevivió porque el fixture devolvía sidecar `null`;
tanto producto como mutante reducían ese valor a F. Se cambió únicamente el
sidecar histórico del usuario no-CONTADOR a A. Así la obligación relevante queda
observable: el reingreso debe escribir F aun frente a A residual y jamás
resucitarlo. Al restaurar ese único valor se recupera exactamente
`6710609f3953946b7e9aeb991f1c4f5d7e231363ccd095eadcf052d60e8bda99`;
los 36 tests acreditados y todos los helpers permanecen idénticos por AST. El
snapshot actual es `75b800f5…c038`.

Mientras se estabiliza el contrato de cuarentena, restan exactamente estos doce
IDs para ejecución puntual:

```sh
node reports/e11/run-backend-offline.mjs --ids E11-ROLE-REENTRY-STARTS-F,E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY,E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION,E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT,E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY,E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION,E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY,E11-A-PREPARATION-DUPLICATE-NOTES-DENIED,E11-LEGACY-DEFAULT-DENY-POLICY,E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES,E11-E5-A-CLOSED-WHILE-OFF,E11-ERROR-BODY-IS-PRIVATE
```

### Cuarentena pendiente de interfaces productivas

No se consolidan todavía casos especulativos. Cuando estén expuestas las
interfaces finales, la cobertura ADMIN debe usar identidad fresca y funciones
reales para probar consulta y resolución atómica a tombstone, sin efecto de
negocio y sin traducir ausencia/estado a un 404 engañoso. La resolución y el
productor original deben tomar el mismo lock de la intención original
(actor/productor, operación y UUID), y el productor debe consultar el tombstone
después de adquirirlo y antes de cualquier efecto. Deben cubrirse: CAS/replay de
la resolución, reintento ADMIN idempotente, carrera donde gana la resolución,
request original tardía explícitamente bloqueada sin efectos, y rollback completo
si falla la escritura del tombstone. El lock no puede derivarse del actor ADMIN,
pues formaría otro namespace y no cerraría la carrera original.

La llegada de esas dependencias cambia los hashes físicos; antes de una matriz
consolidada deben revalidarse los casos afectados contra las interfaces y anclas
nuevas.

## Matriz final con recuperación estable

Las interfaces productivas de recuperación ya están disponibles. Se añadieron
doce casos conductuales y doce mutantes, sin inflar ni conservar artificialmente
la cardinalidad anterior: la matriz final contiene 60 obligaciones reales.

La infraestructura sintética conserva estado transaccional de operaciones,
resoluciones y efectos de negocio, pero invoca `e11Recovery`, `e11Resolve`,
`e11Replay`, identidad fresca, factory runtime, coordinador `e11Execute` y
serializadores reales. Cubre:

- consulta PENDIENTE para operación no observada, sin convertirla en 404;
- normalización lowercase del UUID original;
- lock exacto del namespace productor `E11:actor:accion:uuid`;
- ADMIN real fresco y versión de identidad vigente;
- resolución PENDIENTE a tombstone append-only sin efecto de negocio;
- resolución de operación CONFIRMADA sin reemplazar respuesta ni insertar otro
  tombstone;
- CAS de revisión sin escrituras;
- replay del UUID resolutor sin duplicar operación ni resolución;
- request productor tardío bloqueado antes de ejecutar su callback;
- fallo de entrega post-commit con cuerpo privado y estado ya confirmado;
- rechazo estructural de `RESOLUCION` como acción recuperable, evitando
  cuarentena recursiva.

Las expectativas positivas susceptibles a excepciones mutantes se envolvieron en
`doesNotReject`; las negativas validan código explícito. Los demás mutantes
terminan en aserciones de estado/metadata, no en errores de dominio que el runner
pudiera aceptar incorrectamente.

### Impacto sobre evidencia histórica

No se afirma igualdad de hashes productivos anteriores: `e11-repository.ts`
cambió y ahora su SHA-256 es
`d0672d27a900e75946e3c6ae28986432ec6077290e605e9a76ae5d3bd0ab2ec2`.
La comparación por AST de función deja intactas las obligaciones históricas que
no alcanzan recuperación ni el cuerpo modificado de `e11Replay`.

Cinco ciclos previamente acreditados sí requieren regresión porque alcanzan el
replay modificado (estado tombstone y UUID normalizado):
`E11-REPLAY-LOCK-NAMESPACE`, `E11-REPLAY-SAME-BODY-NO-WORK`,
`E11-REPLAY-DIFFERENT-BODY-DENIED`, `E11-ASSIGN-ADMIN-CAS-HISTORY` y
`E11-ASSIGN-STALE-CAS-NO-WRITE`. Se adaptaron únicamente los routers SQL fake
que ahora reciben la columna `estado`. Los otros 31 ciclos acreditados no se
repiten automáticamente: sus tests/helpers relevantes y las funciones
productivas que alcanzan permanecen semánticamente iguales por AST. Los doce
casos que ya estaban pendientes siguen pendientes, y se agregan los doce nuevos.

Por tanto, la ejecución consolidada necesaria tiene exactamente 29 IDs, con esta
procedencia: 5 regresiones por dependencia productiva alcanzada + 12 pendientes
del intento anterior + 12 obligaciones nuevas.

```sh
node reports/e11/run-backend-offline.mjs --ids E11-REPLAY-LOCK-NAMESPACE,E11-REPLAY-SAME-BODY-NO-WORK,E11-REPLAY-DIFFERENT-BODY-DENIED,E11-ASSIGN-ADMIN-CAS-HISTORY,E11-ASSIGN-STALE-CAS-NO-WRITE,E11-ROLE-REENTRY-STARTS-F,E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY,E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION,E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT,E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY,E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION,E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY,E11-A-PREPARATION-DUPLICATE-NOTES-DENIED,E11-LEGACY-DEFAULT-DENY-POLICY,E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES,E11-E5-A-CLOSED-WHILE-OFF,E11-ERROR-BODY-IS-PRIVATE,E11-RECOVERY-QUERY-PENDING-NOT-404,E11-RECOVERY-NORMALIZES-ORIGINAL-UUID,E11-RECOVERY-USES-PRODUCER-REPLAY-NAMESPACE,E11-RECOVERY-REQUIRES-FRESH-ADMIN,E11-RECOVERY-RESOLVE-WRITES-TOMBSTONE-NO-EFFECT,E11-RECOVERY-RESOLVE-CONFIRMED-WITHOUT-TOMBSTONE,E11-RECOVERY-RESOLVE-REJECTS-STALE-ADMIN-VERSION,E11-RECOVERY-RESOLVE-CAS-NO-WRITE,E11-RECOVERY-RESOLUTION-REPLAY-IDEMPOTENT,E11-RECOVERY-TOMBSTONE-BLOCKS-LATE-REQUEST,E11-RECOVERY-POSTCOMMIT-PRIVATE-NONRECURSIVE,E11-RECOVERY-TARGET-REJECTS-RECURSIVE-QUARANTINE
```

Snapshot final de tests:
`d3cb43f25ca5fea0dbaca3a7a59710178eef0d45ae3ae9aff56b1fdbdcd951ab`.

## Continuación después del intento final parcial MAIN

El manifiesto `backend-2026-09-23T00-29-54.702Z` permanece `FAIL` y conserva
seis ciclos terminales: las cinco regresiones de replay/asignación y
`E11-ROLE-REENTRY-STARTS-F`. En conjunto quedan 37 obligaciones acreditadas
sobre sus procedencias correspondientes.

El mutante de `E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY` sólo anulaba la
comparación de identidad. El fixture revoca A→F, por lo que la segunda defensa
real (`e11Capability`) siguió negando entrega y produjo el mismo outcome
post-commit esperado. No había defecto productivo ni de infraestructura: el
mutante no representaba la pérdida completa de reautorización.

Se corrigió únicamente el mutante para anular, dentro de su snapshot aislado,
ambas decisiones de la segunda transacción: igualdad de identidad y capacidad
vigente. Así la entrega ocurre y `assert.rejects` debe producir `ERR_ASSERTION`.
No cambió el test ni producción; el hash de tests sigue siendo exactamente
`d3cb43f25ca5fea0dbaca3a7a59710178eef0d45ae3ae9aff56b1fdbdcd951ab`.
El hash actual del catálogo de mutantes es
`fe84283c17f754b2b8a72572cc0d6f06267a990a455be0acc277c427eae4b0e3`.

Restan exactamente 23 IDs de la matriz final de 60:

```sh
node reports/e11/run-backend-offline.mjs --ids E11-RECOVERY-QUERY-PENDING-NOT-404,E11-RECOVERY-NORMALIZES-ORIGINAL-UUID,E11-RECOVERY-USES-PRODUCER-REPLAY-NAMESPACE,E11-RECOVERY-REQUIRES-FRESH-ADMIN,E11-RECOVERY-RESOLVE-WRITES-TOMBSTONE-NO-EFFECT,E11-RECOVERY-RESOLVE-CONFIRMED-WITHOUT-TOMBSTONE,E11-RECOVERY-RESOLVE-REJECTS-STALE-ADMIN-VERSION,E11-RECOVERY-RESOLVE-CAS-NO-WRITE,E11-RECOVERY-RESOLUTION-REPLAY-IDEMPOTENT,E11-RECOVERY-TOMBSTONE-BLOCKS-LATE-REQUEST,E11-RECOVERY-POSTCOMMIT-PRIVATE-NONRECURSIVE,E11-RECOVERY-TARGET-REJECTS-RECURSIVE-QUARANTINE,E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY,E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION,E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT,E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY,E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION,E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY,E11-A-PREPARATION-DUPLICATE-NOTES-DENIED,E11-LEGACY-DEFAULT-DENY-POLICY,E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES,E11-E5-A-CLOSED-WHILE-OFF,E11-ERROR-BODY-IS-PRIVATE
```

Auditoría estática del prefijo: las declaraciones, helpers alcanzados y fuentes
de los 37 ciclos terminales no cambiaron después de esos runs. Sólo cambió el
reemplazo aislado del mutante aún no acreditado. El ajuste posterior del barrel
de tipos no cambia schemas API ni cuerpos backend alcanzados por esta matriz.