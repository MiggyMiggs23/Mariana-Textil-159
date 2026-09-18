# E10 operativo: respaldo + restauración desechable local

## Veredicto

**PASS**.

La autorización usada es `/home/runner/workspace/reports/e10-autorizacion-operativa-2026-09-18.md`. Esta ejecución se limitó a respaldo y
restauración local. No ejecutó Drive, preflight, purga, seed, identidad de
aplicación, ni reinicio de API/workflows. No se hicieron escrituras en la base
fuente. La aprobación de identidad de la aplicación queda separada para el
agente principal.

Cotejo de identidad de origen contra la evidencia
actual del pool vivo de la API: `/home/runner/workspace/reports/e10-operativo-2026-09-18/api-pool-identity.json`
(SHA-256 `1db50ff3afd3a8c7cd9825c3a271ab6678693b1bfdff4f7a8e55d736a9448bb5`):
**PASS**. La API podía
permanecer activa; cualquier cambio de secuencia durante la ventana causa FAIL.

## Fuente exacta del operador

- Archivo: `/home/runner/workspace/scripts/src/prompt-h-block2-backup-restore.mts`
- SHA-256 del archivo ejecutado: `12dda9d3562a42a304b25250d3564ad47a96bdc5d122663ea56cb51f3ad41972`
- Commit HEAD: `80eaa93d4300e86d9be54492e634f88f0c0abc90`
- Árbol del commit HEAD: `3365350be578e21245228889ba7a46465ce3750a`
- Padre del commit HEAD: `967b3abe6cbe34c588b11ca91ebddf1c6060186b`
- SHA-256 del diff binario del operador contra HEAD:
  `3338e99d8fa4721412ba38d448588d850d737c23969d8041090b5c3705ccf270`
- Árbol de trabajo limpio al capturar: **no**
- Estado porcelain v1: ` M scripts/src/prompt-h-block2-backup-restore.mts`, `?? reports/e10-autorizacion-operativa-2026-09-18.md`, `?? reports/e10-operativo-2026-09-18/api-pool-identity.json`, `?? reports/e10-operativo-2026-09-18/runner-interface.json`, `?? scripts/src/e10-api-pool-identity.mjs`, `?? scripts/src/e10-operational-runner.mjs`, `?? scripts/src/e10-operational-runner.test.mjs`

## Fuente y captura

- Base efectiva: `heliumdb`
- PostgreSQL: `16.10`
- Snapshot UTC: `2026-09-18T18:48:23.953Z`
- Snapshot Mexico City: `2026-09-18 12:48:23`
- Transacción: `REPEATABLE READ READ ONLY`; `pg_export_snapshot()` fue
  entregado a `pg_dump` y la transacción permaneció abierta hasta terminarlo.
- Tablas no sistémicas descubiertas dinámicamente: 66
- Triggers no internos descubiertos dinámicamente: 26;
  se compararon definición y estado habilitado de todos.
- La huella de filas es MD5 de una concatenación ordenada de MD5 de
  `to_jsonb(row)::text` canónico producido por PostgreSQL. No se guardaron
  filas crudas.

## Archivo

- Dump custom: `/home/runner/workspace/.local/backups/e10-operativo-20260918124823-63437/e10-operativo-20260918124823-63437.dump`
- Tamaño: `497065` bytes
- SHA-256: `4f126fdc916a548bf8bdc3af7310a2acd3a3808fbf5dcd0c4c7afb0d85f51d0e`
- Ownership/ACL: incluidos por las opciones predeterminadas de `pg_dump`
  (sin `--no-owner` ni `--no-acl`); los roles de ownership del archivo se
  crearon localmente como roles sin login únicamente para restaurar ACL/owners.
- Restauración ejecutada con el rol superusuario local existente `postgres`;
  no se crearon seeds de usuarios ni identidad de aplicación.
- El archivo permanece privado bajo `.local/backups/`; ningún dump se guardó
  en una carpeta servida públicamente.
- Todas las tablas y todas sus filas se incluyeron sin exclusiones, incluidas
  las sesiones existentes. No se ejecutaron fixtures ni se crearon usuarios o
  sesiones de aplicación. Dump, snapshots y cluster usan permisos privados
  locales.

## Comparación

- Conteos y huellas canónicas por tabla: PASS
- Columnas/defaults: PASS
- Constraints: PASS
- Índices: PASS
- Funciones: PASS
- Triggers no internos y estados enabled: PASS
- Definiciones de secuencias: PASS
- Estado de secuencias posterior al dump: PASS
- Metadatos de base/ownership/ACL: PASS



## Secuencias no-MVCC

El estado de secuencias se capturó antes y después del dump fuera de la
garantía MVCC. Cambio detectado: **no**. Un
En E10 cualquier cambio detiene el procedimiento con FAIL; nunca se acepta silenciosamente.
snapshot prueba el instante del respaldo, no frescura de un preflight
posterior; no se realizó ese preflight.

## Restauración local persistente

- Cluster: `/home/runner/workspace/.local/backups/e10-operativo-20260918124823-63437/restore-cluster`
- Socket Unix restringido: `/tmp/prompt-h-block2-20260918124823-63437-63437`
- Base restaurada: `restore_disposable_20260918124823-63437`
- Exit code de `pg_restore`: `0`
- Administrador: `PGHOST="/tmp/prompt-h-block2-20260918124823-63437-63437" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="restore_admin_20260918124823-63437"`
- Base restaurada: `PGHOST="/tmp/prompt-h-block2-20260918124823-63437-63437" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="restore_disposable_20260918124823-63437"`

El cluster, sus archivos y la base desechable **no se eliminan** después del
éxito; deben conservarse junto con el respaldo hasta el cierre de E10.
La restauración no sembró usuarios ni identidad de aplicación.
