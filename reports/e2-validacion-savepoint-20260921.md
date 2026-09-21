# A+C: procedencia INSERT segura ante SAVEPOINT

**Primera corrida efectiva: 51/51 PASS, más 5 suplementos separados PASS, exit 0. Hubo una preparación anterior abortada por error del loader antes de ejecutar cualquier caso; se conserva íntegra. Ambos clústeres aislados fueron destruidos con verificación independiente. No habilita apertura.**

## Autorización y fuentes

Se leyó literalmente la nueva autorización previamente guardada por coordinación en `e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-subtransacciones-savepoint.txt`. La coordinación aclaró que se permiten objetos DDL auxiliares propios A+C. Se preservaron las condiciones previas, fixture, casos y evidencia anterior.

Base inspeccionada: `ff152eb93fc704183fcaf27aa79bd212b0644eca`. Candidato funcional exacto: **`31804125a1e752bde128d72e9fd44d23972ffff1`**, comprometido y revisado por coordinación antes de `git archive`. No se modificó código funcional después de fijarlo.

Se revisaron los tres SQL preparados, el informe corregido anterior (47 PASS, cuatro FAIL SAVEPOINT), las condiciones y revisión del harness, el runner corregido y las memorias de evidencia diferida, evidencia histórica, pagos dirigidos, secuencias y conservación del artefacto.

Había tres comparaciones de pertenencia usando `xmin` contra `txid_current() % 4294967296`: finalización del abono (línea original 94), prueba retenida (178) y guarda de aplicación tardía (334). Se corrigen las tres. `02` y `03` no tenían ese supuesto. La búsqueda en TypeScript de API/scripts no encontró otra comparación equivalente A+C: `credit-abono-evidence.ts` delega la finalización mediante el `Tx` recibido. Los usos de xmin para verificación de caché y txid para nombres de fixtures son ajenos. Las copias históricas permanecen intactas.

## Corrección inicial

Se añaden dos columnas propias A+C, `e2_insert_xid xid8`, una en cada fuente (`movimientos_credito` y `cobros_credito_pendientes_e1`). No hay DEFAULT ni backfill: filas históricas quedan NULL.

Una función trigger compartida, `e2_stamp_insert_transaction`, y dos triggers BEFORE INSERT OR UPDATE establecen:

- INSERT: siempre reemplazar cualquier valor suministrado por `pg_current_xact_id()`, identificador completo de la transacción superior.
- UPDATE: siempre conservar `OLD.e2_insert_xid`, ignorando intentos de alterar el marcador. Una versión nueva de una fuente vieja no se convierte en una recepción nueva.

Las tres comprobaciones usan esa procedencia en vez de xmin. La reversión elimina triggers/función/columnas bajo sus bloqueos y condiciones existentes, sin CASCADE. El preflight SQL verifica las dos columnas, triggers y cuerpo exacto de la función. El preflight TypeScript incluye columnas, triggers y hashes actualizados de las funciones modificadas; no se ejecutó su ruta runtime. No se añade tabla ni estado de sesión ni cambio de flags.

## Argumento de seguridad y límites

El marcador pertenece a la fila de origen, no a la versión MVCC de su header. Se escribe por un trigger normal en la misma operación:

1. Un hijo activo y uno liberado reciben el mismo xid8 superior. RELEASE no lo cambia. ROLLBACK TO revierte la fila/marcador junto con la escritura. Una fuente previa al SAVEPOINT conserva su identidad.
2. Un escritor ajeno tiene otro identificador completo. MVCC no expone sus escrituras no confirmadas; después de confirmar, el marcador distinto rechaza la fuente. Se mantienen los FOR SHARE existentes.
3. UPDATE de fuente histórica conserva NULL; UPDATE de fuente confirmada conserva el xid8 anterior. UPDATE de fuente nueva mantiene su identidad de INSERT. INSERT ON CONFLICT DO UPDATE termina conservando el marcador anterior por la rama UPDATE.
4. Un campo SQL xid8 conserva la época a través del wrap de XID de 32 bits. VACUUM/freezing del header no altera ese dato. No se reconstruye época desde xmin, no se usa visibilidad de snapshot como pertenencia y no se usa xmin >= topxid.
5. DML directo no puede falsificar el marcador: INSERT lo sobrescribe y UPDATE conserva OLD. El modelo presupone catálogo/triggers de confianza, igual que las guardas A+C existentes. No pretende resistir al propietario/superusuario que desactive triggers, cambie su orden/cuerpo, altere session_replication_role, haga restauraciones físicas o modifique directamente el catálogo. Un nuevo trigger capaz de escribir el marcador exige revisión del contrato; la ACL/endurecimiento global no queda probado.
6. No se ofrece garantía ante reutilización completa de xid8 de 64 bits ni restauración externa que cambie la identidad del clúster. Se cubre el wraparound ordinario de XID32 dentro del mismo clúster PostgreSQL.

Se descartó `pg_xact_status` sobre xmin reconstruido: una tupla congelada puede conservar xmin bruto antiguo que coincida con un XID reutilizado en curso. Ni `pg_snapshot_xip` ni la visibilidad de esa tupla resuelven su época.

## Compatibilidad estática y alcance

La creación de las dos tablas de evidencia se mantiene antes del nuevo DDL para conservar el rechazo atómico `42P07` esperado al instalar dos veces. La fixture sintética borra/recrea el esquema completo. Los contadores de los casos siguen refiriéndose a las cinco tablas existentes; no hay una tabla extra. La consulta de catálogo del caso preflight observa las dos tablas de evidencia sin excluir la comprobación adicional de procedencia que ahora realiza el SQL exacto. No se editaron expectativas ni casos.

La coordinación aprobó el diseño y la corrida después de revisión independiente. La preparación abortada y la primera corrida efectiva se distinguen abajo. La corrida efectiva validó instalación y preflight SQL exacto; no se ejecutó preflight TypeScript runtime. No hubo simulación práctica de wraparound.

Checks estáticos: `git diff --check`, correspondencia de todos los hashes de cuerpos SQL contra el preflight TypeScript y transpile de sintaxis TypeScript: PASS. No es typecheck completo ni ejecución de la aplicación. Hashes y estado en `e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/static-review.json`. El INSERT posicional de retenidos del harness conserva sus expresiones originales; PostgreSQL permite omitir columnas finales sin lista explícita, dejando la columna añadida con NULL antes del trigger.

## Revisión previa y exportación exacta

La coordinación resolvió la duda del INSERT posicional con documentación oficial PostgreSQL 16: [INSERT](https://www.postgresql.org/docs/16/sql-insert.html), “or the first N column names, if there are only N columns supplied by VALUES”. La referencia fue suministrada por coordinación; este worker no realizó HTTP.

Se exportaron por `git archive` desde el commit funcional los mismos SQL, dependencias, fixture y `cases.mjs` anteriores, más el TypeScript modificado. Antes de initdb, el runner comparó cada archivo con `git show` de esa revisión. Los casos y fixture conservan sus hashes. La [revisión previa](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/review-before-execution.txt), [exportación verificada](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/export-review.json) y [manifiesto](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/run-1790014245585/manifest.json) registran identidad y hashes.

## Historia: preparación abortada por infraestructura del runner

Preparación abortada: `run-1790014245585`, proceso **exit 1**. El runner nuevo reutilizó el cuerpo anterior mediante un módulo `data:` con sustituciones explícitas de identidad. **Fue un error de implementación del runner nuevo:** aunque sustituyó `import.meta.url` por la URL del archivo, el import dinámico de `pg` usa una ruta absoluta de filesystem que el resolvedor del módulo `data:` no puede resolver.

Error conservado íntegro en [terminal.json](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/run-1790014245585/terminal.json): `Failed to resolve module specifier "/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js" ... Invalid relative URL or base scheme is not hierarchical.` No es un error de SQL ni evidencia contra la corrección.

El fallo ocurrió después de crear el clúster/base nuevos, **antes de conectar mediante pg, antes de verificar identidad SQL, antes de cargar fixture y antes del primer caso**. Se ejecutaron solamente initdb, arranque privado, CREATE DATABASE y limpieza. Resultado de la matriz:

- 51 casos previstos: **0 ejecutados, 0 PASS, 0 FAIL individuales, 51 bloqueados**.
- Una entrada de resumen `harness: FAIL`.
- Suplementos preparados: **no ejecutados**; estaban condicionados a 51 PASS.
- No hubo instalación del SQL candidato, preflight SQL ni control negativo.
- Se informó y se detuvo sin reparar. Posteriormente coordinación autorizó explícitamente reparar solo el loader, porque ningún caso ni SQL candidato se había ejecutado.

Los logs originales permanecen completos, incluidos el mensaje extenso con la URL data y los comandos de cleanup. No se cambiaron expectativas, fixture ni casos.

El typecheck solicitado **PASS, exit 0**: `tsc -p artifacts/api-server/tsconfig.json --noEmit --incremental false`, sin build/import de DB y sin salida de errores. Evidencia: `typecheck-exit.txt` y `typecheck.log` en el directorio nuevo. Los checks de sintaxis de runner/suplemento y el modo de verificación de exportación pasaron, pero no detectaron el fallo posterior de resolución del módulo data.

## Aislamiento y destrucción de la preparación abortada

PostgreSQL **16.10**, directorio recién creado `/tmp/e2-ac-savepoint-pg16-wgU5Ef`, socket privado bajo ese directorio, puerto de socket `56439`, `listen_addresses=''`, permisos de socket 0700, rol `e2_owner`, base `e2_ac_synthetic` desde template0, entorno saneado y parámetros explícitos. La comprobación SQL `inet_server_addr() IS NULL` no llegó a ejecutarse; no se afirma ese resultado. El comando de arranque sí fijó ausencia de TCP.

El `finally` funcionó pese al fallo:

- DROP DATABASE WITH (FORCE): **exit 0**.
- Parada del clúster propio: **exit 0**.
- `pg_ctl status`: **exit 3**, sin servidor.
- PID **4157** ausente; socket ausente; directorio raíz eliminado.
- `cleanupError: null`.

La [verificación independiente posterior](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/cleanup-independent-check.json) volvió a comprobar ausencia de PID, socket y directorio y los estados de destrucción. No hay clúster pendiente de cleanup.

## Reparación autorizada del loader y primera corrida efectiva

La coordinación precisó que reparar infraestructura antes del primer caso no constituye corregir un caso fallido ni iterar el SQL. Se conservó `run.mjs` fallido y se creó `run-first-cases.mjs`: únicamente transforma los imports absolutos de `pg` y `cases.mjs` a URL `file:`. No modifica SQL, TypeScript funcional, casos ni fixture.

Antes de iniciar PostgreSQL, se verificaron los tres imports dinámicos (`pg`, casos y suplemento) desde un módulo data bajo el mismo resolvedor, sin instanciar clientes ni invocar casos. [Verificación offline: PASS](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/loader-repair-offline-check.json). Se repitió la comprobación byte por byte de la exportación contra el commit funcional fijo. No se repitió typecheck ni se ejecutó build.

Primera corrida efectiva: **`run-1790014406658`, exit 0**. [Terminal completo](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/run-1790014406658/terminal.json): exactamente **51 casos PASS**, sin FAIL, bloqueados ni omitidos. El conjunto intacto consta de los 49 casos previos y los dos controles iniciales anteriores.

| Casos | Cobertura | Resultado |
|---|---|---|
| 1–6 | Control SQL antiguo negativo, instalación/reversión/reinstalación, duplicado atómico, preflight exacto, guardas CLOSED | PASS |
| 7–10 | Ordinario UNUSED/PARTIAL/FULL y dirigido FULL | PASS |
| 11–20 | Rechazos de finalización/prueba ausente, fuente o clasificación inválida | PASS |
| 21–27 | Fallos inducidos sin huérfanos, reintento UUID, replay/duplicado y aplicación tardía | PASS |
| 28–39 | Inmutabilidad, aplicación futura legítima, prueba retenida y negativos | PASS |
| 40–45 | Fuente antes/después de SAVEPOINT, ordinaria/retenida, hijo activo/liberado | PASS |
| 46–47 | Caracterización de reverso DEFERRED/IMMEDIATE | PASS observacional |
| 48–51 | Concurrencia UUID COMMIT/ROLLBACK, productor contra reversión y preservación de evidencia | PASS |

En particular, los cuatro casos que fallaban anteriormente (41,43,44,45) pasan ahora sin cambiar expectativas. El caso 47 sigue siendo una caracterización de aceptación de reverso en frontera A+C tras IMMEDIATE, **no garantía de integridad global ni autorización de devolución**.

Solo después de 51 PASS, en el mismo clúster privado con esquema sintético recreado desde la misma fixture e instalador, se ejecutaron [cinco suplementos separados](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/run-1790014406658/supplement.json), todos PASS:

1. Fuente histórica NULL: intento UPDATE de falsificar marcador no lo modifica; atestación rechazada.
2. INSERT con marcador suministrado: sobrescrito con xid8 superior real.
3. Fuente confirmada: UPDATE conserva OLD y atestación en nueva transacción se rechaza.
4. ROLLBACK TO elimina fuente/marcador y permite reinsertar misma clave; RELEASE permite atestación.
5. Abono en hijo liberado: marcador conserva identidad aun con UPDATE malicioso; aplicación después de finalización e IMMEDIATE rechazada.

No se suman a los 51. No se alteró código como respuesta a casos/suplementos. La garantía de wrap XID32 proviene del dato persistente xid8; no se simuló una vuelta de cuatro mil millones de transacciones.

## Destrucción de la primera corrida efectiva

Clúster PostgreSQL16 nuevo, directorio `/tmp/e2-ac-savepoint-firstcases-pg16-9lHpDS`; rol `e2_owner`, base `e2_ac_synthetic`, socket privado, puerto `56439`, sin TCP. Antes de fixture, antes de recrear esquema para los 49 casos y antes del suplemento se comprobaron base/rol/data_directory/socket/puerto/listen_addresses e `inet_server_addr() IS NULL`. Los comandos/respuestas completos se conservan en el nuevo `commands.log`.

- DROP DATABASE WITH (FORCE): **exit 0**; parada propia **exit 0**.
- `pg_ctl status`: **exit 3**; PID **4377** ausente.
- Socket y raíz eliminados; `cleanupError: null`.
- [Comprobación independiente posterior](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/first-cases-cleanup-independent-check.json): ausencia de PID/socket/raíz confirmada.

No se usó DB API, HTTP, clones E1/E10, paquetes, runtime preflight, workflows ni bundle. No se abrió captura/devolución. La autorización nueva, memorias de coordinación y cambios ajenos no se incluyen en los commits de evidencia de este worker.

## Límites finales

PASS acredita únicamente esta fixture sintética parcial y frontera A+C en PostgreSQL16.10: no catálogo operativo E1 completo, HTTP/backend, permisos endurecidos, FIFO completo, frontend ni apertura/captura/devolución reales. No se ejecutó el preflight TypeScript contra una base. Sus cambios pasan typecheck y verificación estática de hashes, no una validación runtime. Ninguno de los dos clústeres queda pendiente de cleanup.

## Cierre de coordinación

La autorización literal fue la primera escritura de esta solicitud:
[autorizacion-propietario-subtransacciones-savepoint.txt](e2-apertura-limitada/evidencia-a-c/autorizacion-propietario-subtransacciones-savepoint.txt).

- Revisión funcional exacta validada: `31804125a1e752bde128d72e9fd44d23972ffff1`.
- Evidencia de la preparación abortada, sin casos ejecutados: `5a991cf75a3ca16f5baf580747d5a6a0aea97261`.
- Evidencia de la primera corrida efectiva, **51/51 PASS** y **5/5 suplementos PASS**: `7e10e4694fcb8a704cfb34af13f73578bedd0f40`.
- No se cambiaron SQL, TypeScript funcional, casos ni fixture después de fijar la revisión; comparación contra ese commit sin diferencias.

Comprobación independiente de cierre a **2026-09-21T18:15:50.491Z**:
PID API **132**, mismo inicio **2026-09-21 17:26:03 UTC**, ejecutando
`artifacts/api-server/dist/index.mjs`. Hashes completos:

```text
bundle:
3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98
runtime-preflight.mjs:
9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f
```

Los dos directorios y PIDs de PostgreSQL desechables siguen ausentes.
Evidencia: [main-final-integrity.json](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/main-final-integrity.json).
No se reinició la API ni se cambió su bundle, configuración o guardas de apertura.