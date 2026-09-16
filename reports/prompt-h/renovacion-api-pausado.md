# Renovación — API pausada durante respaldo y restauración

## Veredicto

**PASS — respaldo + restauración ejecutados con la API detenida.**

Esta renovación ejecutó únicamente el Bloque 2 con el script verificado
`scripts/src/prompt-h-block2-backup-restore.mts`, seguido de la reparación del
reporte Markdown para conservar la comparación expandida de las 60 tablas. No se
reinició la API ni ningún workflow. No se ejecutaron Drive, preflight, purga,
seed, identidad de aplicación ni escrituras en la base fuente.

## Verificación de pausa y ausencia de escritores antes de la captura

La compuerta se evaluó antes de abrir la transacción de respaldo. La consulta a
`pg_stat_activity` fue de solo lectura y excluyó únicamente la sesión propia
del verificador. El criterio es fail-closed: cualquier otro backend cliente,
backend activo/en transacción, backend nombrado o transacción abierta habría
detenido la ejecución. No se terminó ninguna sesión.

- Captura de compuerta UTC: `2026-09-16T03:42:45.135Z`
- Captura de compuerta Ciudad de México: `2026-09-15 21:42:45`
- Base verificada: `heliumdb`
- PostgreSQL verificado: `16.10`
- Procesos API encontrados: `0`
- Listeners en puerto 8080: `0`
- Otros backends cliente: `0`
- Backends activos o en transacción: `0`
- Backends nombrados inesperados: `0`
- Transacciones abiertas inesperadas: `0`
- Escritores inesperados: **0 — PASS**

La compuerta fue **PASS**. La ejecución posterior mantuvo la fuente en una
transacción `REPEATABLE READ READ ONLY` con `pg_export_snapshot()`; el dump
se realizó desde esa instantánea. El script no contiene una ruta de reinicio de
API/workflow.

## Captura fuente y respaldo nuevo

- Base fuente: `heliumdb`
- PostgreSQL fuente: `16.10`
- Snapshot UTC: `2026-09-16T03:42:48.408Z`
- Snapshot Ciudad de México: `2026-09-15 21:42:48`
- Directorio privado nuevo: `.local/backups/prompt-h-block2-20260915214248-7517`
- Snapshot privado: `.local/backups/prompt-h-block2-20260915214248-7517/source-snapshot.json`
- Metadatos de restauración actuales: `.local/backups/prompt-h-block2-20260915214248-7517/restore-metadata.json`
- Dump custom completo: `.local/backups/prompt-h-block2-20260915214248-7517/prompt-h-block2-20260915214248-7517.dump`
- Tamaño: `440802` bytes
- SHA-256: `da7d3f7f342756511c6a04d000f0f4f4fa3feea6b9caad21e6abec5213dffb22`
- Formato: `pg_dump --format=custom --create --blobs`
- Ownership y ACL: incluidos

## Restauración local desechable

- Exit code de `pg_restore`: `0`
- Cluster: `.local/backups/prompt-h-block2-20260915214248-7517/restore-cluster`
- PID postmaster observado tras la restauración: `7557`
- Socket Unix: `/tmp/prompt-h-block2-20260915214248-7517-7517`
- Base restaurada: `restore_disposable_20260915214248-7517`
- Base administrativa: `restore_admin_20260915214248-7517`
- Listener TCP: deshabilitado; socket Unix-only verificado: **PASS**
- Rol superusuario local de restauración: `postgres`

El cluster, el socket, el dump y todos los metadatos permanecen en sus rutas
privadas. No se eliminó ninguna base desechable, cluster ni archivo de respaldo.

## Comparación dinámica verificada

El reporte Markdown vigente de Bloque 2 es
`reports/prompt-h/block2-restore.md`. Fue reparado desde la evidencia privada
capturada y contiene las **60 filas** de comparación tabla por tabla; no se
volvieron a ejecutar dump ni restore durante esa reparación.

| Evidencia | Fuente | Restaurado | Resultado |
|---|---:|---:|---|
| Tablas dinámicas | 60 | 60 | PASS |
| Conteo + hash canónico por tabla | 60 | 60 | PASS |
| Columnas/defaults | 604 | 604 | PASS |
| Constraints | 286 | 286 | PASS |
| Índices | 218 | 218 | PASS |
| Funciones | 49 | 49 | PASS |
| Triggers no internos + estado enabled | 14 | 14 | PASS |
| Definiciones de secuencias | 45 | 45 | PASS |

Las listas de discrepancias `tables`, `columns`, `constraints`,
`indexes`, `functions`, `triggers`, `sequences`,
`tableCountsAndCanonicalRowHashes` y `sequenceStateAfterDump` están
vacías. `sequenceChangedDuringDump` es `false`.
La evidencia persistida contiene hashes y metadatos; no contiene filas crudas ni
credenciales.

## Freshness posterior al respaldo

Se ejecutó una comprobación acotada de solo lectura posterior al respaldo. No
es el preflight de Bloque 3: comparó solamente el conjunto dinámico, conteos,
huellas canónicas por tabla y estado de secuencias contra el snapshot privado.

- Evidencia: `.local/backups/prompt-h-block2-20260915214248-7517/freshness-postbackup.json`
- Captura posterior UTC: `2026-09-16T03:43:19.714Z`
- Captura posterior Ciudad de México: `2026-09-15 21:43:19`
- Snapshot base Ciudad de México: `2026-09-15 21:42:48`
- Tablas: `60 / 60`, diferencias: `0`
- Secuencias: `45 / 45`, diferencias: `0`
- Resultado: **SOURCE_UNCHANGED_SINCE_BACKUP**

## Preservación y límites

Antes de reemplazar los outputs se copiaron, sin moverlos, los artefactos
vigentes a `reports/prompt-h/history-paused-213056/`:

- `block2-restore.md`
- `block2-restore-metadata.json`
- `block2-drive-verification.json`
- `block3-preflight.md`
- `block3-preflight-metadata.json`
- `resultado-bloques-2-3.md`
- `renovacion-api-pausado.md`

Los directorios de respaldo y clusters anteriores permanecen intactos. En esta
renovación no se ejecutaron `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`,
`setval`, `ALTER SEQUENCE`, `RESTART IDENTITY`, purge, reset de IDs,
Drive, preflight ni operación de identidad. La fuente no recibió escrituras.
Drive y Bloque 3 quedan pendientes para el agente principal; no se ejecutaron
en este turno.
