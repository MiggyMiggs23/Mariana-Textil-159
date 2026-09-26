# Diagnóstico inicial de estabilidad — 2026-09-26

## Reloj fiscal SQL autorizado y aplicado — fixture solamente, V8 intacto

Tras comunicación de la causa por MAIN, se aplicó **únicamente en `priority_fiscal_20260926`** un cambio de expresión en `e11_graph`: el `clock_timestamp()` del gate de periodo se sustituye por la constante confiable de la simulación `'2026-10-02T18:00:00.000Z'::timestamptz`. No usa timestamp enviado por clientes. Comparación de fuente, whitelist, grafo, actores, evidencias, triggers y resto de función permanecen byte por byte iguales.

Guardas: identidad efectiva de BD y host distinto al application DB, lock E11 de seguridad, preimagen exacta `751271d21509f86c435e706a46f6a29e08e6f499d92684b0cb62107b2892fefe`, postimagen exacta `2a3286ecc129daefa258bc3bdeefee3a84d218c666fb50bbd01a614b28a9dee2`; OID/owner/ACL y definiciones de triggers intactos. COMMIT y catálogo posterior verificados. Condición READ ONLY confirma DIA24sep, SEMANA21sep y MES01sep cerrados bajo el reloj de ensayo.

Prueba PostgreSQL nativa con definición instalada actual copiada a schema propio: **DIA24sep, SEMANA21sep y MES01sep no vacíos confirman COMMIT**, además de los tres periodos agosto y resolver corregido. Tombstone sin auditoría continúa rechazado P0001. FKs E11 y triggers de actor/birth/procedencia/grafo activos; schema eliminado; cero DML público o intenciones HTTP nuevas.

Artefactos en `reports/priority-fiscal-20260926/`: `apply-fixture-clock.mjs`, `fixture-clock-before.sql`, `fixture-clock-after.sql`, `fixture-clock-migration-result.json`, `fixture-clock-installed-functions.json`, `fixture-clock-native-results.json`. **NO es migración de release**: SQL canónico productivo y API/UI V8 no cambiaron; ninguna aplicación/reinicio/build nuevo. MAIN puede continuar ahora, resolviendo primero la intención WEEK pendiente por su protocolo exacto antes de emitir otro UUID.

## Nueva SEMANA 503: causa exacta comunicable, sin corrección aplicada

Intención `c09460d3-dd10-445f-8bae-4b48fbcd3ef9`, F237, SEMANA inicio2026-09-21. El hash de P0001 observado al COMMIT06:41:58.846, `2758515d7a2fd0dacde69944bb2b7fc80a89ee4d8a058cab55afa9c817b53b96`, coincide exactamente con **`E11: periodo abierto/fuente modificada al congelar`** en `e11_graph` instalado, línea103 de su definición. Es la condición `end_date AT TIME ZONE America/Mexico_City > clock_timestamp() OR rows_json IS DISTINCT FROM e11_fuente(...)`.

Se discriminan las dos ramas por lectura directa READ ONLY a06:43:13.626, bajo el lock exacto del productor:

- Reloj PostgreSQL real: **2026-09-26T06:43:13.626Z**.
- Fin de la semana: **2026-09-28T06:00:00Z**, por lo que PostgreSQL correctamente la considera **ABIERTA**.
- Reloj Node/browser de la copia: **2026-10-02T18:00:00Z**, por lo que la aplicación la considera cerrada.
- Hash de fuente SQL actual **coincide exactamente** con `66b800223a1e8df3fc84ac7e82f589f6df5a60192fe97167e6fc91b3fdd441c4`; una venta. No es evidencia de fuente cambiada ni de prohibición de reutilizar factura entre periodos.
- Cero operaciones/resoluciones/snapshots de esta intención bajo lock. Sigue PENDIENTE observado, no cierre durable; conservar journal y resolver por protocolo.

Evidencia: `week-error-hash-match.json`, `week-error-installed-functions.json`, `week-clock-readonly.json` bajo `reports/priority-fiscal-20260926/`.

**Reproducción nativa confirmada, sin corregir función alguna:** se amplió el harness propio con timestamp de aplicación02oct y fuente no vacía24sep; SEMANA21sep falla en COMMIT P0001 con **el mismo hash**, cero snapshot nuevo. Las tres pruebas previas DIA/SEMANA/MES agosto siguen confirmando usando la misma venta entre periodos. Por eso el GREEN anterior no cubría la discrepancia de relojes: agosto está cerrado tanto para el reloj real como para el congelado. Schema propio destruido; FKs E11/triggers/grafo activos; cero DML público. Evidencia `week-clock-native-repro.json`.

Dirección estrecha a comunicar **antes de autorizar**: corregir únicamente el entorno de simulación, no la política productiva de periodo cerrado. Si se mantiene el escenario fiscal al02oct, el gate SQL de esa copia debe usar explícitamente el mismo reloj de ensayo, con guardas de identidad de copia y pre/posthash; nunca sustituir por `congeladoEn` enviado por el cliente ni desactivar comparación de fuente/triggers. Alternativa: reloj real consistente y fixtures en periodos realmente cerrados, en otra copia preparada, sin reescribir evidencia existente. Septiembre MES también termina después del reloj PG actual y sufrirá el mismo desacuerdo. No se aplicó ningún ajuste de reloj, función ni business code en esta investigación.

## Corrección autorizada después de comunicar — V8 listo para MAIN, no arrancado

MAIN confirmó comunicación previa de las tres causas. Se corrigieron exclusivamente los dos lectores y el alias autorizado.

- Admisión compartida `lib/read-workload.ts`: máximo tres tareas entre precios y comportamiento; cada producto conserva sus dos lectores de costo concurrentes y luego historial (máximo seis consultas internas). Orden completo estable; error explícito sin DTO parcial, cero inventado ni retries. Detalle de comportamiento consulta sólo el cliente pedido y su ledger canónico. No se alteraron proyecciones monetarias, unidades, filtros, permisos ni criterios de fecha de recepción.
- Diferencial contra V6 con 103 clientes/productos y ledger no vacío: comportamiento pico103→3, precios206→6; igualdad de DTO completo/orden/filtros. Detalle una lectura de ledger, cero clientes ajenos; inexistente no consulta ledger. Evidencia `reports/priority-fiscal-20260926/read-fanout-regression.json`. Trece tests canónicos de precios/costo por metro/comportamiento y dos de admisión compartida pasan; typecheck completo pasa.
- Migración fiscal **ya aplicada**, sólo `CREATE OR REPLACE public.e11_recovery_check()`, alias `r`→`resolution_row` en primera consulta. Preimagen `5f4323afaf6225e79a78dc581e3b350fe71dbe202831c07829ed8daf6681c1ca`, postimagen `520001178556703d8cda64dcfcda7911f7331c9e5f3e2c41107a8c7777b196bc`. Ensayo de reemplazo+ROLLBACK restauró preimagen exacta; segundo tx COMMIT verificó postimagen exacta. Reejecución reconoció únicamente postimagen conocida. OID/owner/ACL/triggers intactos; cero DML público. Script `apply-recovery-alias.mjs`, SQL antes/después y evidencia `recovery-alias-migration-result.json`. Canonical `reports/e11/01-preparado.sql` recibe sólo ese cambio de alias.
- PostgreSQL nativo: schema privado destruido al terminar, tablas/checks/índices, FKs E11 y triggers reales de actor/birth/procedencia/grafo diferido. Resolver viejo falla **en COMMIT 55000**, no persiste operación; corregido confirma con la **misma intención/resolutor del test**. Snapshots DIA/SEMANA/MES no vacíos confirman con un tombstone válido ya presente; tombstone sin auditoría sigue fallando P0001. Fechas controladas agosto2026 sólo dentro del schema de ensayo. Ninguna intención pública nueva ni resolución del journal real. Evidencia `recovery-native-pg-results.json`; FKs de tablas base ajenas a E11 no se copiaron.
- Regresión PostgreSQL de estabilidad V8: baseline1PASS/4FAIL, candidato5PASS/0FAIL/0omitidas; harness primero rechazó el nombre fiscal no allowlisted, se amplió explícitamente sólo a `priority_fiscal_20260926`, sin eludir identidad/aislamiento. Artefacto V7 retenido como ensayo anterior; **usar V8**. Pruebas offline baseline4FAIL/candidato5PASS.
- Auditoría de las 19 funciones instaladas: no queda otro choque estático record/alias. El único `p` coincidente está dentro de SQL dinámico, donde no se sustituyen variables PL/pgSQL. El grafo instalado ya tiene aliases estáticos desambiguados; el archivo preparado histórico contiene aliases anteriores en ese grafo, por lo que **no debe aplicarse el esquema completo como migración**. No se alteró otra función instalada. Esto no prueba retrospectivamente la causa del snapshot original.

**Único candidato de entrega:** `artifacts/api-server/dist-priority-stability-combined-v8-20260926/index.mjs`, SHA256 `1de24ede8cad2ee2290987c6d718e85937515f3a7a7e306c7d32d155613c065e`. Diez fuentes sobre baseline: seis previas autorizadas más precios, comportamiento, ruta cliente y helper compartido. Exactamente cuatro deltas contra V6. Ruta clientes se obtiene del frozen con sólo import y llamada de detalle modificados; no se incorpora HEAD completo. Linaje `reports/priority-20260926/stability-combined-v8/candidate.json`; configuración fiscal `reports/priority-fiscal-20260926/candidate-v8.json` retiene UI autorizada.

Para MAIN: `reports/priority-fiscal-20260926/launch-private-v8.mjs` usa wrapper observado (cinco hooks solamente), SHA256 diagnóstico `8846ae19105467727b01b66fb4183747ef132a22cedfa8349e34cfdb68bf290d`, `candidate-v8-observed.json`. Sintaxis comprobada; **no iniciado ni reiniciado por este agente**. Conservar evidencia antigua antes del reemplazo. Resolver por API las intenciones originales y del resolutor; no crear UUID público nuevo hasta terminal. Browser debe verificar lecturas/costos/permisos y completar conciliaciones; auditoría concurrente sigue en copia original con reloj normal.

## Causa identificada antes de corregir — resolver 55000 y saturaciones de lecturas

### Error fiscal: choque de alias SQL con variable PL/pgSQL, no xmin ni timeout

El hash observado `0b55c3b8807d06ab42de29e42cb4902a0955c37327979b62db084d73e4e4dbca` coincide **exactamente** con el mensaje PostgreSQL `record "r" is not assigned yet` (SQLSTATE 55000). No es un literal RAISE de negocio; por eso buscar sólo cadenas RAISE no lo encontraba.

La definición instalada leída del catálogo fiscal, `public.e11_recovery_check`, coincide con el defecto visible en `reports/e11/01-preparado.sql:361-383`:

- Declara variable PL/pgSQL `r record` en línea 363.
- Recorre tombstones con `o` en línea 365.
- Antes de asignar `r`, usa **el mismo nombre `r` como alias SQL** de `e11_resoluciones` y referencias `r.actor_original_id`, etc., en líneas 366-369.
- La primera asignación al record `r` ocurre mucho después, `FOR r IN ...`, línea 383. El resolvedor de nombres de PL/pgSQL intenta acceder al record aún sin asignar.
- `e11_graph` invoca ese validador (`:574`); trigger de grafo es `DEFERRABLE INITIALLY DEFERRED` (`:824`). El resolver inserta el tombstone y auditoría, termina callback, pero el validador aborta **en COMMIT**.

Prueba determinista **READ ONLY**, sin DDL persistente ni tablas de negocio: DO con `DECLARE r record` + alias catálogo `pg_class r` produce **55000 y el mismo hash exacto**; alias distinto `catalog_row` pasa. Evidencia `reports/priority-fiscal-20260926/55000-readonly-alias-repro.json`. Definiciones efectivas archivadas desde catálogo en `55000-record-r-functions.json`.

Observer: a 06:12:37.389 trabajo parseado; COMMIT a 06:12:37.421 falla 55000; `work-transaction-rejected` a 06:12:37.460 contiene la misma causa. Pool en ese COMMIT: total12, idle11, waiting0. Por tanto **este fallo del resolver no es saturación ni PgBouncer**. `e11Execute` traduce a resultado incierto porque sólo considera errores clase23/40 rollback probado; no se deben agregar reintentos de escritura ni generalizar todos los55000 como éxito. La captura prueba el resolver actual; no demuestra por sí sola que el POST de snapshot anterior tuviera idéntica causa oculta.

Corrección estrecha a proponer después de comunicar: desambiguar alias/variable de esa función, preservando todas sus comprobaciones, mediante artefacto SQL y aplicación aislada/autorizada. **No se modificó ni instaló función alguna en esta investigación.** Mantener journal/UUID original y resolver sólo por circuito aprobado.

### Presión de pool: dos fan-outs distintos comprobados, no fuga sostenida

Ventana observada 06:12:15–06:12:40: 5.217 consultas enviadas, 1.140 adquisiciones fallidas, waiting máximo2.576. Regresa a total12/idle12/waiting0/préstamos0. No hay evidencia de fuga persistente de BEGIN en esta reproducción: esa hipótesis previa queda descartada para estos episodios.

| SQL fingerprint | Consultas enviadas | Fuente exacta V6 |
|---|---:|---|
| `68c2daa143c1be779155b884a2de5c294c2f492ac19f2e6581df60d886338f23` | 971 | `routes/precios.ts:49-57`, currentCost: cantidad/costo/estado de rollos por producto |
| `205129f88c9a5948ae2b837cf8d53cf2be69133876686f66d66a5ea2bf6ef515` | 969 | `lib/metered-reference-cost.ts:158-171`, rollos+entradas por producto y fecha |
| `c4cff6adcf6ecc287a30f071f85edabdb7064049d120ca520a92d942a2194a51` | 968 | `routes/precios.ts:153-158`, última modificación de precio |
| `d3cf7b2b5c44a772a4750e553e4ba1b103b03dee881e186077499a54cc90a637` | 1.967 | `lib/credit-aging-read-model.ts:31`, query canónico individual global invocado por `payment-behavior.ts:91` |

Los tres primeros hashes se reconstruyeron exactamente desde SQL generado por Drizzle; el cuarto coincide con template de sourcemap V6.

**Precios:** `routes/precios.ts:196` lanza `Promise.all(products.map(presentProduct))` sin límite. Cada producto lanza a su vez dos consultas concurrentes (`:135-138`) y luego una tercera de historial (`:153`). En ventana 06:12:15–29: 3.485 adquisiciones, 530 fallidas, waiting pico2.469; las consultas individuales enviadas terminan sin error. La cola rebasa timeout antes de llegar a ejecutar muchas consultas.

**Comportamiento de pago:** aun pedir UN cliente (`routes/clientes.ts:1021`) llama `loadPaymentBehaviorList()` de TODOS y sólo después hace `.find`. `lib/payment-behavior.ts:84-92` selecciona todos los clientes y dispara `Promise.all` con ledger individual para cada uno. En ventana 06:12:29–36: 2.617 adquisiciones, 610 fallidas, waiting pico2.576 y 1.967 ledgers efectivamente enviados. Este lector es diferente de la lista E11 optimizada: el fix de E11 no lo modifica.

Precios/payment-behavior/metered-reference-cost son idénticos entre V6 y fuentes actuales; rutas clientes citadas se cotejaron en sourcemap (HEAD completo difiere y no se usó como linaje). `Promise.all` rechaza ante primer fallo pero no cancela las consultas ya encoladas; explica presión residual después de un HTTP500.

Mapa completo de 36 fingerprints observados y cantidades: `reports/priority-fiscal-20260926/observer-shape-source-map.json`; 18 mapeados exactamente a fuente (incluidos los cuatro que concentran4.875 consultas), 18 auxiliares conservados como no mapeados, sin inventar atribución. El observer no lleva requestId en cada query: la asignación de ventanas HTTP se apoya en secuencia proporcionada por MAIN y fingerprints específicos.

Dirección de corrección a comunicar, aún no ejecutada: lector individual real para detalle de comportamiento; carga masiva canónica o concurrencia acotada para lista completa; precálculos/bulk o límite estricto de concurrencia para precios, preservando filtros, costos ponderados, edad de recepción, dinero y orden global. No elevar pool ni aplicar retries masivos como sustituto. **Cero cambios de negocio/DDL en esta etapa; MAIN debe comunicar estas causas antes de autorizar siguiente corrección.**

## Reapertura fiscal V6 — intención incierta, sin mutación ni replay

Solicitud `b52512fe-ec67-40a2-a42c-d60d6342a476`, intención original `b2548914-0933-4a8f-a67d-b925b0a8df68`, actor F 237, POST `/api/e11/conciliaciones` respondió 503 `RESULTADO_INCIERTO` a 05:59:20.091. Browser confirmó después 26 límites A/F correctos; no se atribuye esta nueva incidencia al N+1 ya corregido.

**Lectura directa autorizada y cerrada a 06:07:25 UTC:** únicamente `priority_fiscal_20260926`, transacción `READ ONLY`, lock transaccional de la MISMA clave del productor `E11:237:SNAPSHOT:b2548914-0933-4a8f-a67d-b925b0a8df68`, adquirido mediante try-lock. Bajo ese lock: cero filas de operación, resolución y snapshot de esa intención. Una conexión PG ajena estaba idle, sin transacción ni bloqueadores. Evidencia: `reports/priority-fiscal-20260926/uncertain-readonly.json`; script reproducible `inspect-uncertain-readonly.mjs`. No se cambió BD ni se invocó HTTP de escritura.

Esto corresponde a **PENDIENTE al momento de observar**, no a una resolución durable `CERRADA_SIN_EFECTO`. No se libera/quita el journal, no se repite con UUID nuevo y no se ejecuta resolución. Tampoco constituye por sí solo diagnóstico de por qué abortó.

**Clasificación exacta de fuente:** `e11Execute` sólo genera ese resultado cuando su callback ya terminó trabajo y validación (`workCompleted=true`) y la promesa de la transacción rechaza con error sin SQLSTATE reconocido de clase 23/40. El error raíz no se conserva en `E11OutcomeError` por privacidad. Por eso hay que observar COMMIT/ROLLBACK y la causa antes de reemplazarla, no inferir que el snapshot jamás empezó por un timeout de adquisición. La respuesta de la captura llegó aproximadamente un segundo después del timestamp incorporado en su requestId suministrado; no se puede adjudicarle automáticamente un timeout de 5 s visto después.

**Reloj congelado:** `browser-clock.js` reemplaza Date, pero no temporizadores ni `performance`. `pg-pool@3.14.0/index.js:219,251,313,410` usa `setTimeout`, sin `Date.now` en ese módulo; la hipótesis «Date congela el timeout de adquisición de pg-pool» no concuerda con esta fuente. Esto no descarta otros efectos de entorno/PgBouncer; no se cambia reloj.

**Candidato adicional a discriminar, no causa probada:** el driver Drizzle abre `BEGIN` después de adquirir conexión pero antes de entrar al try/finally que libera (`node-postgres/session.cjs:214-229`, bundle V6 `:42230-42249`). Si BEGIN rechaza, esa estructura no ejecuta release. Se requiere evidencia acquire → BEGIN fallido → ausencia de release con préstamo persistente; no se modifica driver por hipótesis. También diferenciar pool lleno con préstamos activos, espera externa/PgBouncer y socket fallido.

**Instrumentación preparada, no arrancada:**

- `reports/priority-fiscal-20260926/api-bootstrap-observed.mjs` mantiene reloj fiscal y guardas de copia; importa observer antes del candidato.
- `candidate-observed.json` apunta a copia diagnóstica `fiscal-diagnostic-observed.mjs` junto al API V6, SHA256 `2253ca16ae34c3bfa197a17267d370e896fcd9d7719c547337e23c7362593fb3`; original V6 intacto. Cinco hooks observacionales solamente, sin alterar consultas/decisiones/retries.
- `fiscal-observer.mjs`: acquire inicio/fin, clientId/PID, préstamo/release/removal/end, query inicio/fin con hash/verb (sin SQL/params), causas saneadas antes de enmascarar resultado, fase E11 e intención hasheada, pool total/idle/waiting, actividad PG por conexión directa read-only aparte. Tiempos monotónicos y hora real derivada de `performance.timeOrigin+performance.now`, inmunes a Date congelado.
- Salida saneada: `/tmp/priority-fiscal-20260926/sanitized-pool-observer.ndjson`. MAIN debe conservar evidencia del proceso anterior antes del reinicio; el reinicio pierde estado del pool y no demuestra que la causa se corrigió.
- Source map de copia diagnóstica sigue siendo el padre sin hooks y se declara así; no usarla como nuevo release ni presumir offsets de líneas idénticos. Wrapper sólo para diagnóstico autorizado.

Próximo paso: MAIN arranca wrapper observado después de captura; comenzar con lecturas/autenticación y seguimiento de préstamos, manteniendo la intención en cuarentena. No reejecutar snapshot ni nuevo UUID sin autorización explícita posterior. Auditoría concurrente debe ensayarse en copia original con reloj normal, no en este reloj fiscal. **Causa raíz del nuevo episodio todavía no probada; no se aplicó corrección especulativa.**

## Cierre de PG y composición autorizada — listo para arranque de MAIN

Tras confirmación de MAIN de parada del baseline y autorización explícita de `priority_20260926`, se ejecutó harness PG sólo en schemas aleatorios propios, eliminados en `finally`; ninguna fila existente de aplicación se tocó. **Baseline: 1 pase/4 fallos (incluye fallo agregado del padre); candidato: 5 pases/0 fallos/0 omitidas.**

Resultado diferencial real: baseline hace 201 consultas para 100 clientes y bloquea renovación; candidato hace 2 y reproduce exactamente DTO/hash del proyector individual con deuda/abono no vacíos. Renovación concurrente termina manteniendo protección de DELETE/logout. Un 40001 PostgreSQL auténtico, forzado por actualización concurrente del usuario tras snapshot, se revierte y reintenta una sola vez; entrega única y reautorización posterior. Sesión eliminada permanece rechazada.

El primer harness PG v5 detectó dos problemas del ensayo, no ocultados: bundling de driver aislado dejaba una clase Drizzle sin inicializar y el estímulo anterior de expiración ya no provocaba 40001 bajo KEY SHARE. Se corrigió el harness externalizando driver instalado y moviendo la barrera al FOR SHARE de usuario que deliberadamente se conserva. Evidencia fallida v5 retenida; v6 obtuvo RED/GREEN. No se cambió código funcional entre v5/v6.

**Candidato final compuesto:** `artifacts/api-server/dist-priority-stability-combined-v6-20260926/index.mjs`, SHA256 `f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97`.

Manifiesto/hashes/sourcemaps/pruebas: `reports/priority-20260926/stability-combined-v6/candidate.json`. Incluye exactamente las cinco fuentes de estabilidad más `lib/clientes-listado.ts` autorizado SHA256 `35ec356f44e7d1c057932449f6afd2acbc9871d358639d5fa04f7836e5bbfec9`; archivo actual coincide con overlay. No reconstruye HEAD íntegro. Typecheck API completo pasa. UI retenida `dist-noche-task7-inventory-20260926`, sin cambio de comportamiento fail-closed.

Listo para que MAIN arranque este candidato y el propietario de navegador complete validaciones; no activado ni iniciado por este agente. Este estado reemplaza el bloqueo PG histórico descrito abajo, no sustituye la verificación UI ni afirma liberación productiva.

## Implementación posterior autorizada — candidato offline, pendiente de PostgreSQL y navegador

MAIN confirmó que comunicó causa/fuentes/40001 al usuario antes de autorizar corrección. Se preparó **sin activar** `artifacts/api-server/dist-priority-stability-v4-20260926/index.mjs`; manifiesto, hashes de entradas/salidas y sourcemaps en `reports/priority-20260926/stability-v4/candidate.json`.

Delta exacto contra API congelada: cinco módulos (`e11-repository`, `e11-runtime`, `credit-aging-read-model`, middleware `auth`, route `e11`). Builder `reports/priority-20260926/build-stability.mjs` comprueba fuentes emitidas y excluye explícitamente los tres cambios de ordenación agregada del HEAD ajenos a esta tarea. No incluye overlay independiente de listado general de clientes.

- Lista financiera: una consulta de directorio y una consulta bulk de **todos los ledgers canónicos**, en el mismo tx, con proyector existente. Conserva DTO completo ordenado, hash de revisión completo y semántica de invalidación de cursores; no calcula dinero con SUM ni recorta historial a la página.
- Sesión: lectura de identidad usa `FOR KEY SHARE` sólo para sesión, conservando protección contra DELETE/logout y permitiendo renovación no-clave. Usuario/perfil/advisory/entrega autorizada conservan locks. Renovación sólo avanza expiración de una sesión vigente; evita sobrescribir una renovación más reciente con una fecha anterior. No se cambian duraciones ni se amplía sesión expirada.
- Lecturas GET explícitas: máximo dos intentos ante **40001 exclusivamente**, reiniciando todo trabajo/identidad después del rechazo de la transacción y su rollback. Sin retry de escrituras, timeouts, deadlocks, unicidad, entrega o resultado incierto. La entrega sigue reautorizada y fail-closed.
- UI no alterada: el duplicado ya muestra «Serie ya registrada» y «Escaneado por [autor original]» (`auditorias-inventario.tsx:649-650` y test existente `auditorias-inventario-site.test.tsx:269-289`). Se corrige la causa backend de la interferencia; no se permite mostrar datos tras revocación real. Falta corroboración del navegador del propietario.

Verificación ejecutada sin BD: 76 pruebas E11 pasan; typecheck API completo pasa. Regresión ejecutada contra fuentes congeladas: baseline **4 fallos/1 pase**; candidato **5 pases**. Incluye 2.575 clientes, DTO/revisión/cursor global, lock elegido, retry acotado y ausencia de entrega tras revocación. Los archivos de evidencia offline están en el directorio `stability-v4`.

**Bloqueo de liberación:** no se ha recibido confirmación de parada del proceso runaway ni autorización/identidad de la nueva BD desechable para ejecutar pruebas PG. Se dejó harness compilado baseline/candidato `*-stability.pg.test.cjs`, con sourcemaps. Requiere explícitamente `E11_STABILITY_PG_APPROVED=fresh-disposable-after-main-stop`, `TEST_DATABASE_URL` y `E11_STABILITY_TEST_DATABASE`; verifica base objetivo, crea sólo schema de ensayo aleatorio y lo destruye al finalizar, sustituye import de DB global por guardas que fallan y usa pool propio máximo tres. No inicia API ni ejecuta inicializadores de aplicación. Ensaya proyección no vacía/paridad, renovación concurrente con lock, DELETE bloqueado, 40001 real por barrera y reautorización tras logout. Sin aprobación omite prueba; **omisión no equivale a éxito PG**.

No se denomina este candidato «release-ready» hasta PG GREEN, composición independiente con el overlay de listado general y validación de navegador por su propietario. Las secciones inferiores documentan el razonamiento previo a la autorización.

## Actualización urgente: fingerprints identificados tras evidencia de MAIN

Esta sección actualiza la incertidumbre del diagnóstico inicial inferior; no modifica código. MAIN suministró observación saneada nueva: tres `40001` a 04:57:46; timeouts UPDATE de 35 s posteriores; pool total 12/idle 9/waiting 0; PID 1447 con transacción de 35 s y luego 100 s, bloqueando 1442 por transactionid y 1443 por tuple; alternancia de dos SELECT de ~25 ms miles de veces incluso con navegador pausado.

**Identificación exacta offline usando la normalización SHA256 de `reports/priority-20260926/pool-observer.mjs` y SQL de la fuente congelada:**

| Fingerprint | Fuente y significado |
|---|---|
| `a4ae17ded936f10b5b6eb0f7614a8d1ef96a9aa8b315af6d77b06398311e79ce` | `src/lib/e11-repository.ts:34-36`: SELECT de sesión vigente `FOR SHARE`. Los nuevos `40001` sí prueban fallo de serialización en esta lectura, no deadlock `40P01`. |
| `c3c0ff4c53e74a92c59e60a7719e536d831b2dd15dbb032515c6128efb374c14` | SQL generado `UPDATE sesiones SET expira_at ... WHERE id ...`, correspondiente a `src/middlewares/auth.ts:114-117`. Hash reconstruido con identificadores entre comillas y parámetros PostgreSQL. |
| `1bed07d4986f858e6c1d629f4b04a47cb2308a196abb3f431a612d13f93b4d86` | `src/lib/e11-repository.ts:159-160`: lectura de ficha financiera de un cliente. |
| `8ed359165303279e31eab056e450065c57fb1c052bb9321f3b57d00afea6aab9` | Ledger **congelado**, `src/lib/credit-aging-read-model.ts:183-219`: historial completo de ese cliente mediante tx. |

**Culpable de la secuencia larga identificado en fuente: `e11FinanceClients`, `src/lib/e11-repository.ts:168-172`.** Selecciona TODOS los IDs de clientes no sistema y recorre secuencialmente cada uno llamando `e11FinanceClient`: una ficha y un ledger por cliente. Es un patrón **1 + 2N consultas**, no un bucle infinito de refresco de autorización. La paginación ocurre DESPUÉS de esperar todo el recorrido (`src/routes/e11.ts:103-105`, helper `page:61-63`); solicitar una página pequeña no limita el trabajo ni libera antes la transacción.

Esta lectura corre dentro del trabajo SERIALIZABLE de `e11Execute:448-458`, que ya tiene `FOR SHARE` de usuario y sesión. Conserva dichos locks mientras recorre todos los clientes. Cada consulta individual puede durar sólo 25 ms y no alcanzar timeout SQL; el total puede durar minutos. Por ejemplo, 2.000 clientes a 25 ms por consulta serían aproximadamente 100 s, sin contar el resto del trabajo; es una estimación, no una cardinalidad medida. El intervalo `idle in transaction` con query_age de milisegundos es compatible con el espacio entre consultas sucesivas, no demuestra cliente abandonado.

**Conclusión ahora sustentada:** existe una lectura financiera A con N+1 secuencial de alcance global, paginación tardía y retención prolongada de locks de autenticación; los fingerprints suministrados identifican exactamente sus dos consultas repetidas. La observación de pool con nueve conexiones libres descarta saturación de capacidad en esas muestras: aumentar el pool no resuelve la espera del UPDATE detrás del lock. Pausar/cerrar navegador no cancela por sí solo el trabajo backend, que continúa hasta agotar el array.

Para cerrar toda la atribución operacional, MAIN debe confirmar que los dos fingerprints alternantes pertenecen al PID 1447 y correlacionar su request con `/e11/finanzas/clientes`; los fingerprints sin PID no bastan para unirlos formalmente al bloqueador. La fuente y patrón ya identifican el recorrido largo. El `40001` en SELECT de sesión es un segundo mecanismo confirmado; su relación con cada pantalla de duplicado requiere todavía requestId/tiempo. No generalizar esta prueba a todas las muestras históricas ni a conciliaciones no ejecutadas.

**Corrección aún no aplicada.** Comunicar primero: «La lista financiera A calcula fichas e historiales de todos los clientes antes de paginar, dentro de una transacción que retiene bloqueos de sesión; esto permite que renovar sesión/login quede esperando aunque sobren conexiones. También se confirmó conflicto de serialización al leer sesión. No es un bucle infinito ni falta de capacidad del pool en la captura». Después diseñar una corrección acotada que preserve proyección canónica, cursores/revisión, autorización fresca y privacidad; no limitar arbitrariamente el ledger ni omitir revalidación.

## Dictamen previo a cualquier corrección

**Hay evidencia de fallos de adquisición de conexiones y lectura SQL; todavía no está probado qué retiene las conexiones ni cuál solicitud originó la pantalla global del duplicado.** No es correcto declarar un deadlock, un defecto de permisos de Contador A, una fuga de conexiones o un error propio de conciliación como causa raíz confirmada.

Inspección exclusivamente offline: fuentes, sourcemap y evidencia archivada. No se consultó BD, no se leyeron logs de workflows/servidor, no se inició aplicación ni se modificó código. Única escritura: este informe. La copia privada anterior ya no existe; los experimentos propuestos requieren otra copia aislada, a cargo del responsable de infraestructura.

## Evidencia y linaje

- `reports/noche-20260926/tarea-7/runtime/diagnosis.json:2-11`: estado previo `BLOCKED_ROOT_CAUSE_NOT_PROVEN`; resumen saneado de MAIN: 14 query-read timeouts, 18 acquisition timeouts, 16 fallos de actualización de expiración y 6 de último acceso. Es evidencia previamente suministrada, no una nueva lectura de logs. No contiene SQLSTATE que permita probar `40001`/`40P01`.
- `tarea-5/resultado.md:16-18`: identidad A 503 y rutas prohibidas 500 incluso sin tráfico SPA del mismo navegador; login intermitente. Conciliaciones detenidas **antes de escribir**, por ausencia de periodos cerrados con factura auténtica. Por tanto no existe aquí reproducción de fallo del algoritmo de conciliación.
- `tarea-4/resultado.md:11-19`: duplicado conserva una sola fila y autor/piso originales; falla la UI global con `REVISION_OBSOLETA`. El 409 de la primera prueba del sexto usuario no demuestra límite; recuperación independiente sí demostró `AUDIT_PARTICIPANT_LIMIT`.
- API congelada: `artifacts/api-server/dist-auditoria-colaborativa-final-20260925/index.mjs`, SHA256 comprobado offline `e62a79333d0ee1433c114656af980e33ff420b728688a121ee586efdfab1b30d`. Se inspeccionó su `index.mjs.map`, no se ejecutó el bundle.
- HEAD inspeccionado: `8cdb6c4a710838897833eb1809da95317f7d4dc9`. Comparación directa de `sourcesContent` contra `git show HEAD`: 246 fuentes API/DB comparables, **16 distintas**. Las identidades E11, middleware/login, runtime, repositorio E5, pool, manejador global y auditoría citados abajo coinciden con congelado. No debe reconstruirse HEAD completo como si fuera el candidato.
- Diferencias detectadas: `lib/db/src/schema/{enums,pos}.ts`, `lib/db/src/lib/clientes-schema.ts`; bajo `artifacts/api-server/src/`: `routes/{index,clientes}.ts`, `lib/{credit-allocation,credit-aging-read-model,inventario,e7-read-model,clientes-aging,credit-evidence,credit-movement-detail,cuentas-destino-export,admin-analytics,reportes-commercial,reportes-sales}.ts`.
- Diferencia exacta del adaptador ledger: `lib/credit-aging-read-model.ts:45,195,251` cambia en HEAD `json_agg(json_build_object(...))` por agregado con `ORDER BY a.id`. No incorpora conexión secundaria ni cambia el adaptador transaccional. Las demás diferencias enumeradas no se atribuyen al runtime congelado.

Las referencias `src/...` siguientes son relativas a `artifacts/api-server`; los números del ledger corresponden a la fuente congelada embebida (mantiene numeración en HEAD).

## Mecanismos concretos y grado de certeza

### 1. Por qué puede aparecer 500 en una ruta que debía terminar 403

`src/middlewares/auth.ts:79-98,114-124` lee sesión, **actualiza su expiración en cada solicitud** y luego espera una transacción E11 de identidad, antes de continuar hacia autorización. Cualquier fallo de infraestructura en ese prefijo evita llegar al rechazo esperado. `src/app.ts:108-112` convierte errores no clasificados en 500. Dentro de `/e11`, `src/routes/e11.ts:143-162` convierte desconocidos en 503 `DEPENDENCIA_NO_DISPONIBLE`.

**Confirmado:** las diferencias 500/503 son compatibles con distintos manejadores del mismo fallo de dependencia. **No demostrado:** que todos los errores archivados correspondan al mismo query o que los permisos estén mal. El documento estático elimina tráfico de esa SPA, no el de otras sesiones o trabajos de la copia.

### 2. Contención entre identidad, actividad de sesión y login

`src/lib/e11-repository.ts:21-39` toma advisory compartido `E11:security`, luego `FOR SHARE` sobre usuario, sesión y perfil. `e11AuthIdentity:59-61` lo hace en transacción. El `UPDATE sesiones` del middleware y `UPDATE usuarios.ultimoAcceso` del login (`src/routes/auth.ts:116-136`) pueden esperar esos locks de fila. Login hace inserción de sesión, actualización del usuario y auditoría en la misma transacción; después abre otra identidad (`:138-139`).

`e11Execute:448-458` retiene locks de identidad durante **todo el trabajo SERIALIZABLE**; `:470-476` reautoriza y entrega dentro de otra transacción. Una proyección costosa, espera de E5 o conciliación larga puede prolongar esos locks, retrasar actualizaciones de sesión/login y ocupar conexiones que otras solicitudes necesitan.

**Hipótesis prioritaria:** esperas largas más concurrencia amplifican presión de pool. No hay ciclo demostrado: la actualización de expiración termina antes de abrir identidad y las transacciones de trabajo/entrega son secuenciales, no anidadas. Advisory compartido no serializa identidades entre sí; sus lectores sí pueden esperar un escritor exclusivo. Asignación de perfil (`:80-84`) usa exclusividad y debe incluirse en el grafo de bloqueos.

### 3. Identidad tiene carga propia y puede fallar aun sin ledger

`src/routes/e11.ts:38,45-58,65`: `/identidad` pasa por `requireSession` y también por `e11Execute`. Con E11 habilitado, son una actualización de expiración y **tres transacciones secuenciales de identidad**: middleware, trabajo SERIALIZABLE, entrega. El handler de identidad no consulta ledger.

Una actualización de la sesión que se confirma después del snapshot SERIALIZABLE y antes del `FOR SHARE` es un escenario candidato a `40001`; requiere capturar el SQLSTATE y fase para demostrarlo. No justificar reintentos automáticos con un simple timeout.

### 4. Pool y ciclo de vida: capacidad no equivale a fuga

`lib/db/src/index.ts:119-144`: pool singleton, máximo predeterminado 30, adquisición 5 s, statement server 30 s, query cliente 35 s, idle 30 s. `reports/noche-20260926/tarea-2/launch-private.mjs:27` fija `DB_POOL_MAX=12` para aquel proceso privado; no demuestra que todos los procesos posteriores tuvieran exactamente esa configuración efectiva.

`src/lib/e11-runtime.ts:27-33` delega en `db.transaction` y pasa **el mismo tx** al ledger. `src/lib/e5-repository.ts:84` declara efectos dentro del tx del caller; sus llamadas ledger (`:58,143,200`) reciben ese tx. No se encontró préstamo anidado en esas rutas.

El adaptador Drizzle actualmente instalado (`node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.20.0_pg@8.22.0/node_modules/drizzle-orm/node-postgres/session.js:180-194`) adquiere conexión, hace COMMIT/ROLLBACK y libera en `finally`. Esta comprobación es del driver instalado, no una igualdad de linaje del driver congelado. Un rollback que espera también prolonga el préstamo antes del `finally`; no es prueba de una conexión jamás liberada. Hay que distinguir adquisición, consulta, commit y rollback.

### 5. Ledger y conciliación: candidatos de duración, no causas ya acreditadas

Ledger congelado `src/lib/credit-aging-read-model.ts:154-175` permite lector global por defecto, pero `:179-220` usa exclusivamente `tx.execute`; E11 usa este último. El query trae historial completo, joins dirigidos y subconsultas correlacionadas de aplicaciones. Es un candidato a medir por cardinalidad/plan, no un N+1 probado de conexiones. `src/lib/e11-repository.ts:162-163` proyecta todo el ledger en memoria dentro del trabajo.

Conciliación `src/lib/e11-repository.ts:227-249` exige capacidad `FISCAL_CONCILIAR`, periodo cerrado, lock advisory por periodo, fuente vigente e inserta evidencia **una sentencia por venta** dentro del tx. A recibe capacidades financieras/E5 y F la de conciliación (`:41-46`): no atribuirle a A la obligación de conciliar ni ampliar permisos para resolver el síntoma. Los inserts secuenciales pueden alargar snapshots grandes, pero tarea 5 no llegó a ejecutarlos; no explican retrospectivamente sus fallos sin otra evidencia.

### 6. Pantalla global durante duplicado

`artifacts/mariana-textil/src/lib/e11-session.tsx:49-53,95-101` consulta identidad cada 15 s, sin retry, y reemplaza hijos de negocio si falla identidad/disponibilidad. `src/routes/e11.ts:154-157` mapea `40001`, `40P01` **y `23505`** al mismo `REVISION_OBSOLETA`: ese texto no identifica un deadlock ni la petición que falló.

El escaneo `src/lib/auditoria-inventario.ts:258-269,280-310` usa `onConflictDoNothing`, conserva autor original y responde `duplicado` según si insertó. Concuerda con la fila única archivada. Por tanto hay una ruta global independiente capaz de producir la pantalla durante el duplicado; falta correlación HTTP/temporal para atribuírsela. No repetir el escaneo ya persistido ni presentar una pantalla de conflicto como prueba de rechazo por cupo.

## Evidencia discriminante a obtener después, sin aplicar corrección todavía

1. MAIN/infra: nueva copia aislada, linaje congelado verificado, reloj/periodos cerrados y documentos auténticos del ensayo. Registrar sólo configuración no secreta efectiva por proceso (pool/timeouts/gates), no URL ni cookies. No reutilizar identidad de entorno destruido.
2. Instrumentación candidata, pendiente de autorización: requestId, ruta, fase (`session-read`, `session-touch`, `identity-auth`, `work`, `commit`, `delivery`, `rollback`), duración, SQLSTATE y causa saneada; sin SQL con valores, sesiones, credenciales o datos de clientes. Conservar error original y error de rollback separadamente.
3. Responsable BD en copia: pool `totalCount/idleCount/waitingCount`, tiempo de préstamo, `pg_stat_activity` con edad de transacción, estado/wait_event y `pg_blocking_pids`, más clase de lock; sin query/valores sensibles. Espera de fila con bloqueador de identidad confirma contención; espera advisory distingue escritor E11/E5; activo sin bloqueos orienta a plan/CPU/I/O; `idle in transaction` o préstamos sin retorno requieren investigar ciclo de vida. Acquisition timeout por sí solo no distingue esas causas.
4. Aislar carga: A solo, F solo, ADMIN solo; luego 2 sesiones mismo usuario, usuarios distintos y concurrencia creciente. Separar `/identidad`, lectura financiera A y snapshot F. Comparar pool 12 y 30 **sólo como experimento controlado**, no como arreglo ni prueba de capacidad productiva. Incluir tiempos de cola y percentiles.
5. Reproducción de conflicto SERIALIZABLE en harness aislado: barrera entre comienzo/snapshot de identidad y `FOR SHARE`, actualización concurrente de expiración; exigir SQLSTATE real y rollback. Comparar con simple lock timeout. Para duplicado, dos contextos sobre nueva serie sintética y captura conjunta de respuesta scan e identidad: fila única + scan correcto + identidad fallida establece propagación global; scan fallido sin identidad fallida exige otro diagnóstico.
6. Ledger: plan/tiempos sobre copia auténtica con cardinalidad conocida, separando reader transaccional/global y proyección JS. Conciliación: día/semana/mes cerrados y escala de ventas, medir consulta fuente e inserts; probar NO_CUADRA con ADMIN sin alterar históricos ni fabricar éxito vacío.

## Comunicación previa al cambio

La causa inmediata respaldada es fallo de dependencia de BD antes/durante autorización, con una UI global que bloquea el recorrido al fallar identidad. La causa raíz de las esperas sigue abierta. **No se autoriza ni se ha realizado corrección en este diagnóstico.** No elevar pool, añadir retries indiscriminados, relajar identidad/permisos ni conservar datos sensibles tras identidad fallida como supuesta solución. Cualquier propuesta posterior debe apoyarse en fase/SQLSTATE/grafo de espera y componerse desde el API congelado, con delta explícito, no desde HEAD entero.