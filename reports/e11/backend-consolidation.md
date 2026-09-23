# E11 backend — consolidación final 60/60

## Resultado

**CONSOLIDATED_COMPLETE_FROM_TERMINAL_CYCLES**: 60 IDs exactos, 60 mutantes y
60 ciclos terminales verde/rojo/restaurado. Esto consolida evidencia; no cambia
ningún manifiesto padre ni lo relabela como PASS. Los cuatro intentos parciales
padre conservan estado FAIL y el último conserva COMPLETE_EXPLICIT_SUBSET 23/23.

Cada verde y restaurado contiene el ID exacto, pass 1/fail 0 y salida 0. Cada
rojo contiene el ID exacto, fail 1, salida 1 y code ERR_ASSERTION. Los hashes de
logs, fuente, mutante y restauración coinciden byte a byte con sus manifiestos.

## Procedencia

### 31 históricos sin alcance al replay modificado — revisión manual de reachability

La conclusión de no-repetición es **manual**, no un call graph algorítmico:
se revisaron los cuerpos de tests y helpers/funciones alcanzados. Estos IDs no
llaman el cuerpo modificado de e11Replay ni APIs de recovery. La comprobación de
logs, cardinalidad, IDs y hashes sí es algorítmica.

- `E11-OFF-ALL-GATES`
- `E11-OFF-SECURITY-NO-SQL`
- `E11-OFF-ROLE-CHANGE-NO-SQL`
- `E11-CANONICAL-KEY-ORDER`
- `E11-HASH-CONTENT-SENSITIVE`
- `E11-MONEY-EXACT-CENTS`
- `E11-MONEY-REJECTS-NONCANONICAL`
- `E11-CALENDAR-DAY-OPTIONAL`
- `E11-CALENDAR-WEEK-MONDAY`
- `E11-CALENDAR-MONTH-BOUNDARY`
- `E11-CALENDAR-NO-DEADLINES`
- `E11-PERIOD-OPEN`
- `E11-RANGE-NONEMPTY`
- `E11-ADVANCE-CALENDAR`
- `E11-CAPABILITY-EXPLICIT`
- `E11-CURSOR-BINDS-IDENTITY-VERSION`
- `E11-CURSOR-BINDS-FILTERS`
- `E11-CURSOR-BINDS-SOURCE`
- `E11-PAGINATION-LIMIT`
- `E11-FISCAL-FACTURADO-NOT-COBRADO`
- `E11-FISCAL-DTO-WHITELIST`
- `E11-FISCAL-TOTAL-ALL-DOCUMENTS`
- `E11-FISCAL-CLIENTS-DISTINCT-SOURCE`
- `E11-PROFILE-HISTORY-APPEND-ORDER`
- `E11-SNAPSHOT-SOURCE-CHANGE-REQUIRES-REVISION`
- `E11-SNAPSHOT-FROZEN-SALES`
- `E11-SNAPSHOT-EVIDENCE-CAS`
- `E11-PERIOD-LIST-SEPARATE-OBLIGATIONS`
- `E11-IDENTITY-CONTADOR-DEFAULT-F`
- `E11-IDENTITY-A-EXPLICIT-CURRENT-VERSION`
- `E11-ROLE-CHANGE-REVOKES-A`

### 5 regresiones de replay revalidadas

- `E11-REPLAY-LOCK-NAMESPACE`
- `E11-REPLAY-SAME-BODY-NO-WORK`
- `E11-REPLAY-DIFFERENT-BODY-DENIED`
- `E11-ASSIGN-ADMIN-CAS-HISTORY`
- `E11-ASSIGN-STALE-CAS-NO-WRITE`

### 12 obligaciones previamente pendientes

- `E11-ROLE-REENTRY-STARTS-F`
- `E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY`
- `E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION`
- `E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT`
- `E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY`
- `E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION`
- `E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY`
- `E11-A-PREPARATION-DUPLICATE-NOTES-DENIED`
- `E11-LEGACY-DEFAULT-DENY-POLICY`
- `E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES`
- `E11-E5-A-CLOSED-WHILE-OFF`
- `E11-ERROR-BODY-IS-PRIVATE`

### 12 obligaciones recovery nuevas

- `E11-RECOVERY-QUERY-PENDING-NOT-404`
- `E11-RECOVERY-NORMALIZES-ORIGINAL-UUID`
- `E11-RECOVERY-USES-PRODUCER-REPLAY-NAMESPACE`
- `E11-RECOVERY-REQUIRES-FRESH-ADMIN`
- `E11-RECOVERY-RESOLVE-WRITES-TOMBSTONE-NO-EFFECT`
- `E11-RECOVERY-RESOLVE-CONFIRMED-WITHOUT-TOMBSTONE`
- `E11-RECOVERY-RESOLVE-REJECTS-STALE-ADMIN-VERSION`
- `E11-RECOVERY-RESOLVE-CAS-NO-WRITE`
- `E11-RECOVERY-RESOLUTION-REPLAY-IDEMPOTENT`
- `E11-RECOVERY-TOMBSTONE-BLOCKS-LATE-REQUEST`
- `E11-RECOVERY-POSTCOMMIT-PRIVATE-NONRECURSIVE`
- `E11-RECOVERY-TARGET-REJECTS-RECURSIVE-QUARANTINE`

## Alcance y aislamiento

La evidencia usa funciones productivas reales sobre captura SQL y transacciones
sintéticas rollback-capable. **No prueba PostgreSQL**, locks reales, aislamiento,
DDL, FK, triggers, driver, HTTP ni usuarios DB. El runner copia fuentes físicas,
comprueba realpaths del metafile y rechaza inputs workspace vivos. El único alias
explícito, @workspace/db, apunta a la copia física; no se aceptan ghost aliases.

La única diferencia física posterior al manifiesto final está en e11.test.ts y
es explícitamente type-only: tres assertions de tipos de callbacks y tres
anotaciones de parámetros. El auditor revierte esas cuatro ediciones, recupera
el SHA-256 histórico exacto y demuestra emit JavaScript idéntico con TypeScript.
No se finge igualdad de hash fuente. El JSON adjunto registra ambos hashes, el
delta, hashes de emit, bytes y SHA-256 de fuentes actuales, manifiestos y todos
los logs archivados.

El stdout efímero del shell 23/23 se perdió tras reiniciar el workspace. No hay
copia raw byte-idéntica, no se reconstruye ni se usa como evidencia. La
terminalidad 23/23 se verifica desde el manifiesto durable
COMPLETE_EXPLICIT_SUBSET y los 69 logs raw de sus 23 ciclos; la consolidación
completa verifica 202 logs raw y 5 manifiestos: 207 archivos durables.

La comprobación TypeScript API full-source final usa configFilePath absoluto,
rootDir workspace, projectReferences vacío y noEmit; terminó con cero
diagnósticos. No ejecuta tests.
