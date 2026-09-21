# A+C: procedencia INSERT segura ante SAVEPOINT

**Intento único terminal FAIL del runner antes del primer caso. Los 51 casos quedaron bloqueados, no fallidos ni aprobados individualmente. Base aislada destruida y destrucción verificada. No habilita apertura.**

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

La coordinación aprobó el diseño y la corrida única después de revisión independiente. La matriz de 51 casos sigue sin resultado, por el fallo del runner descrito abajo. No se afirma PASS de instalación, preflight SQL/TypeScript o semántica PostgreSQL. No hubo simulación práctica de wraparound.

Checks estáticos: `git diff --check`, correspondencia de todos los hashes de cuerpos SQL contra el preflight TypeScript y transpile de sintaxis TypeScript: PASS. No es typecheck completo ni ejecución de la aplicación. Hashes y estado en `e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/static-review.json`. El INSERT posicional de retenidos del harness conserva sus expresiones originales; PostgreSQL permite omitir columnas finales sin lista explícita, dejando la columna añadida con NULL antes del trigger.

## Revisión previa y exportación exacta

La coordinación resolvió la duda del INSERT posicional con documentación oficial PostgreSQL 16: [INSERT](https://www.postgresql.org/docs/16/sql-insert.html), “or the first N column names, if there are only N columns supplied by VALUES”. La referencia fue suministrada por coordinación; este worker no realizó HTTP.

Se exportaron por `git archive` desde el commit funcional los mismos SQL, dependencias, fixture y `cases.mjs` anteriores, más el TypeScript modificado. Antes de initdb, el runner comparó cada archivo con `git show` de esa revisión. Los casos y fixture conservan sus hashes. La [revisión previa](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/review-before-execution.txt), [exportación verificada](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/export-review.json) y [manifiesto](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/run-1790014245585/manifest.json) registran identidad y hashes.

## Resultado terminal: fallo de infraestructura del runner

Ejecución única: `run-1790014245585`, proceso **exit 1**. El runner nuevo reutilizó el cuerpo anterior mediante un módulo `data:` con sustituciones explícitas de identidad. **Fue un error de implementación del runner nuevo:** aunque sustituyó `import.meta.url` por la URL del archivo, el import dinámico de `pg` usa una ruta absoluta de filesystem que el resolvedor del módulo `data:` no puede resolver.

Error conservado íntegro en [terminal.json](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/run-1790014245585/terminal.json): `Failed to resolve module specifier "/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js" ... Invalid relative URL or base scheme is not hierarchical.` No es un error de SQL ni evidencia contra la corrección.

El fallo ocurrió después de crear el clúster/base nuevos, **antes de conectar mediante pg, antes de verificar identidad SQL, antes de cargar fixture y antes del primer caso**. Se ejecutaron solamente initdb, arranque privado, CREATE DATABASE y limpieza. Resultado de la matriz:

- 51 casos previstos: **0 ejecutados, 0 PASS, 0 FAIL individuales, 51 bloqueados**.
- Una entrada de resumen `harness: FAIL`.
- Suplementos preparados: **no ejecutados**; estaban condicionados a 51 PASS.
- No hubo instalación del SQL candidato, preflight SQL ni control negativo.
- No se corrigió el runner ni se reintentó, respetando la orden de no depurar/repetir contra el fallo.

Los logs originales permanecen completos, incluidos el mensaje extenso con la URL data y los comandos de cleanup. No se cambiaron expectativas, fixture ni casos.

El typecheck solicitado **PASS, exit 0**: `tsc -p artifacts/api-server/tsconfig.json --noEmit --incremental false`, sin build/import de DB y sin salida de errores. Evidencia: `typecheck-exit.txt` y `typecheck.log` en el directorio nuevo. Los checks de sintaxis de runner/suplemento y el modo de verificación de exportación pasaron, pero no detectaron el fallo posterior de resolución del módulo data.

## Aislamiento y destrucción verificada

PostgreSQL **16.10**, directorio recién creado `/tmp/e2-ac-savepoint-pg16-wgU5Ef`, socket privado bajo ese directorio, puerto de socket `56439`, `listen_addresses=''`, permisos de socket 0700, rol `e2_owner`, base `e2_ac_synthetic` desde template0, entorno saneado y parámetros explícitos. La comprobación SQL `inet_server_addr() IS NULL` no llegó a ejecutarse; no se afirma ese resultado. El comando de arranque sí fijó ausencia de TCP.

El `finally` funcionó pese al fallo:

- DROP DATABASE WITH (FORCE): **exit 0**.
- Parada del clúster propio: **exit 0**.
- `pg_ctl status`: **exit 3**, sin servidor.
- PID **4157** ausente; socket ausente; directorio raíz eliminado.
- `cleanupError: null`.

La [verificación independiente posterior](e2-apertura-limitada/evidencia-a-c/postgresql-validacion-savepoint-20260921/cleanup-independent-check.json) volvió a comprobar ausencia de PID, socket y directorio y los estados de destrucción. No hay clúster pendiente de cleanup.

No se usó DB API, HTTP, clones E1/E10, paquetes, runtime preflight, workflows ni bundle. No se abrió captura/devolución. La autorización nueva y el cambio ajeno en `reports/e2-correccion-sql-y-registro-arranques-20260921.md` no se incluyen en el commit. Cualquier nueva ejecución requiere decisión de coordinación; esta tarea termina sin validación PostgreSQL del candidato.