# A+C: corrección SQL y validación PostgreSQL aislada

**Instalación corregida: PASS. Validación completa: FAIL por cuatro casos SAVEPOINT. No habilita apertura.**

## Revisión, autorización y corrección

- Autorización actual, guardada previamente por la coordinación: [texto literal](e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-correccion-sql-y-registro-arranques.txt).
- Condiciones anteriores: [autorización](e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-validacion-postgresql.txt) y [revisión previa del harness](e2-apertura-limitada/evidencia-a-c/postgresql-validacion/review-before-execution.txt).
- Revisión corregida exacta, comprometida **antes** de validar: `d3b3154753563adc1a64ee1427518a6e6a0a22d6`.
- Único cambio funcional: agrupar con paréntesis la expresión `CASE` dentro del `IF` de `01-install-evidence-prepared.sql`, líneas 103–104. No cambia sus alternativas ni reglas.
- SHA-256 del instalador corregido: `d32471cdf0ee50aa4066fe439034aaa2b43150e441b936674f5bb983870c17a5`.
- Revisión negativa original: `f8818255bcb11784c422cc559c3273e1f2e25aa9`; SHA-256 del instalador original: `dd99574f022b4d325a73238bf0d1e348e015003d2dad3ebc9de00ede8b094cbd`.

Se revisaron íntegros los tres SQL preparados A+C: instalación, reversión y preflight. El único `CASE` dentro de un `IF` PL/pgSQL era el corregido. Los dos `CASE` de `03` pertenecen a expresiones SQL normales, no al parser de condiciones `IF`. Se revisaron también dependencias, orden de creación/eliminación y cierre transaccional. No se modificaron SQL E1 ni lógica de negocio/backend. Instalación, reversión vacía, reinstalación y preflight exacto funcionaron en PostgreSQL **16.10**; no se encontraron otros impedimentos de instalación en esta fixture.

## Procedencia exacta y aislamiento

Se exportaron con `git archive` los tres SQL, las mismas dependencias de referencia/guardas del candidato anterior y su `cases.mjs`/`fixture.sql`, desde la revisión corregida. El nuevo runner comparó **cada archivo byte por byte con `git show` de esa revisión** antes de iniciar PostgreSQL. Importó la copia exportada de `cases.mjs`, sin editar ni omitir casos; fixture y casos conservan sus bytes anteriores. Los hashes de todas las entradas, runner y autorizaciones están en el [manifiesto](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/run-1790012446485/manifest.json). La comprobación previa está en [review-before-execution.json](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/review-before-execution.json).

El [runner nuevo](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/run.mjs) mantiene la estrategia anterior: `initdb` nuevo, base `e2_ac_synthetic` desde `template0`, usuario propio `e2_owner`, entorno saneado y parámetros de conexión explícitos. Ningún secreto, URL ni configuración heredada de la API se usa.

- Directorio privado: `/tmp/e2-ac-corrected-pg16-1CQSkm`.
- Socket privado: `/tmp/e2-ac-corrected-pg16-1CQSkm/socket`; puerto de ese socket: `56439`.
- Sin listener TCP: `listen_addresses=''`, `inet_server_addr() IS NULL`.
- Nombre de base, usuario, directorio de datos, socket, puerto y listener comprobados antes del primer DDL de fixture y antes del reinicio completo **del esquema sintético**, no de la API.
- No conexiones a `helium`/`heliumdb`, base API ni clones E1/E10. No comparación consultando la API.
- Los binarios PostgreSQL y `pg` ya estaban disponibles; no se instaló ningún paquete.

El control negativo ejecutó el SQL original intacto, exclusivamente en este clúster. Reprodujo `syntax error at end of input`; se comprobó posteriormente ausencia de tablas, funciones y triggers A+C. A continuación se ejecutó la versión corregida exacta. No se alteró el candidato durante la prueba.

## Resultado y cobertura completa

Ejecución: `run-1790012446485`. El proceso llegó a estado terminal y devolvió **exit 1**. Hay **51 casos: 47 PASS y 4 FAIL**, más una entrada resumen `harness: FAIL` (no es un quinto fallo independiente). Los 49 casos del harness anterior se ejecutaron completos, más el control negativo y la fase inicial instalación/reversión/reinstalación. No hubo casos bloqueados u omitidos del harness anterior.

Resultados individuales, mensajes/códigos y detalles: [terminal.json](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/run-1790012446485/terminal.json). Los números siguientes siguen su orden:

| Casos | Verificación | Resultado |
|---|---|---|
| 1 | Sintaxis original falla; instalación original sin objetos residuales A+C | PASS |
| 2 | Fixture CLOSED: instalación exacta, reversión vacía y reinstalación | PASS |
| 3 | Instalación duplicada rechazada atómicamente, objetos preservados | PASS |
| 4 | Preflight `03` exacto contra catálogo prístino | PASS |
| 5 | Reversión rechazada sin guarda CLOSED | PASS |
| 6 | Guardas cerradas E1C01/E1P01 rechazan fuentes sintéticas | PASS |
| 7–10 | Ordinario UNUSED/PARTIAL/FULL y dirigido FULL; importes/destinos/evidencia | PASS |
| 11 | COMMIT diferido sin finalización | Rechazo esperado: PASS |
| 12 | IMMEDIATE antes de insertar fuente sin finalización | Rechazo esperado: PASS |
| 13 | COMMIT diferido sin prueba UNUSED | Rechazo esperado: PASS |
| 14–18 | Fuente inválida: naturaleza, forma, destino, sitio o sesión | Rechazos esperados: PASS |
| 19–20 | Proyector incorrecto y dirigido UNUSED | Rechazos esperados: PASS |
| 21–24 | Fallo inducido tras movimiento, aplicación, finalización FULL o prueba UNUSED; sin huérfanos | PASS |
| 25 | Reintento UUID tras rollback; replay confirmado rechazado | PASS |
| 26 | Finalizador duplicado en misma transacción rechazado; no idempotente | PASS |
| 27 | Aplicación tardía tras IMMEDIATE rechazada por guarda BEFORE | PASS |
| 28–33 | UPDATE/DELETE/TRUNCATE de ambas tablas de evidencia | Rechazos esperados: PASS |
| 34 | Aplicación en transacción posterior permitida en frontera A+C | PASS |
| 35–36 | Prueba retenida tipada y rollback inducido después de ella | PASS |
| 37–39 | Retenido antiguo, ausente o con cliente incorrecto | Rechazos esperados: PASS |
| 40, 42 | Fuente ordinaria/retenida creada antes de SAVEPOINT | PASS |
| 41, 43 | Fuente ordinaria/retenida creada después de SAVEPOINT | **FAIL** |
| 44–45 | Fuente ordinaria/retenida en subtransacción, después RELEASE SAVEPOINT | **FAIL** |
| 46 | Reverso con restricciones DEFERRED: rechazo observado | Caracterización: PASS |
| 47 | Reverso tras restricciones IMMEDIATE: aceptación observada, luego rollback | Caracterización: PASS; **no garantiza integridad global** |
| 48–49 | Dos escritores mismo UUID, primero COMMIT/ROLLBACK, bloqueo real y un solo resultado persistido | PASS |
| 50 | Productor contra reversión: espera ACCESS EXCLUSIVE; rechazo sin cierre, evidencia intacta | PASS |
| 51 | Reversión con guarda CLOSED y evidencia existente: rechazo sin pérdida | PASS |

### Hallazgos que impiden un PASS global

Los cuatro fallos SAVEPOINT son rechazos `P0001` de fuentes válidas dentro de la transacción, según la expectativa explícita del harness anterior:

- Ordinario: `E2: finalization requires its new physical ABONO in this transaction`.
- Retenido: `E2: retained proof requires its new physical receipt in this transaction`.

Se producen tanto con el SAVEPOINT activo como después de liberarlo. Los controles donde la fuente precede al SAVEPOINT pasan. La comparación `xmin` de la fuente contra `txid_current()` del nivel superior es incompatible con estos casos de subtransacción. **No se corrigió esta lógica**, porque la autorización de corrección se limita a sintaxis/impedimentos de instalación. Requiere decisión y alcance adicionales. Los casos fallidos hicieron rollback y verificaron los conteos base; el harness continuó con el resto.

El ensayo observacional de reverso tras `SET CONSTRAINTS ALL IMMEDIATE` acepta el reverso en esta frontera A+C, mientras el diferido lo rechaza. Su PASS significa que se caracterizó el comportamiento esperado por el harness, **no** que se haya demostrado la integridad del sistema completo ni una vulnerabilidad explotable en producción. Ambos ensayos se revierten; no se activó devolución.

## Omisiones y límites

La fixture sigue siendo **sintética parcial**, no un clon ni la base real. Conserva tipos/relaciones necesarios para A+C, pero omite actores, sesiones, sitios, dependencias operativas completas, dominios enum, catálogo E1 completo, bloqueos e inmutabilidad permanentes E1 de aplicaciones y validadores de reversos. Los SQL E1 de referencia exportados no equivalen a instalar todo E1.

No se probó backend HTTP, FIFO completo, apertura/captura/devolución real, frontend, permisos/roles endurecidos, otras versiones PostgreSQL, ni el preflight TypeScript (solo el `03` SQL exacto). Concurrencia demuestra la frontera A+C y unicidad sintética, no serialización completa del negocio. No se instalaron/removieron guardas reales para habilitar capturas: únicamente fixtures en el clúster nuevo. No se cambiaron flags, workflow, runtime-preflight, build ni bundle, y no se reinició API.

## Destrucción e integridad de evidencia

La limpieza se ejecutó en `finally` aunque la suite resultó FAIL:

- `DROP DATABASE e2_ac_synthetic WITH (FORCE)`: **exit 0**.
- Parada del clúster propio: **exit 0**.
- `pg_ctl status`: **exit 3**, sin servidor.
- PID PostgreSQL **2478** ausente; socket ausente.
- Directorio privado eliminado; `cleanupError: null`, `rootRemoved: true`.
- Comprobación independiente después de terminar el runner: [cleanup-independent-check.json](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/cleanup-independent-check.json).

Evidencia nueva: [directorio de validación](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/), [comandos y respuestas PostgreSQL](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/run-1790012446485/commands.log), [preflight exacto](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/run-1790012446485/exact03.log), [catálogo](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-corregida-20260921/run-1790012446485/catalog-rendering.json).

La [evidencia FAIL anterior](e2-apertura-limitada/evidencia-a-c/postgresql-validacion/resultado.md) permanece intacta. La coordinación verificó previamente PID 132 y SHA-256 completo del bundle; esta tarea no necesitó interactuar con esa API. La corrección de sintaxis no es autorización de apertura y los fallos de contrato quedan informados, sin reparación fuera de alcance.