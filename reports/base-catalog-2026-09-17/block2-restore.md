# Prompt H — Bloque 2: respaldo + restauración desechable local

## Veredicto

**PASS**.

La autorización usada es `/home/runner/workspace/reports/base-catalog-2026-09-17/aprobacion.md`. Esta ejecución se limitó a respaldo y
restauración local. No ejecutó Drive, preflight, purga, seed, identidad de
aplicación, ni reinicio de API/workflows. No se hicieron escrituras en la base
fuente. La aprobación de identidad de la aplicación queda separada para el
agente principal.

## Fuente y captura

- Base efectiva: `heliumdb`
- PostgreSQL: `16.10`
- Snapshot UTC: `2026-09-17T06:17:15.548Z`
- Snapshot Mexico City: `2026-09-17 00:17:15`
- Transacción: `REPEATABLE READ READ ONLY`; `pg_export_snapshot()` fue
  entregado a `pg_dump` y la transacción permaneció abierta hasta terminarlo.
- Tablas no sistémicas descubiertas dinámicamente: 60
- Triggers no internos descubiertos dinámicamente: 14;
  se compararon definición y estado habilitado de todos.
- La huella de filas es MD5 de una concatenación ordenada de MD5 de
  `to_jsonb(row)::text` canónico producido por PostgreSQL. No se guardaron
  filas crudas.

## Archivo

- Dump custom: `/home/runner/workspace/.local/backups/prompt-h-block2-20260917001715-50167/prompt-h-block2-20260917001715-50167.dump`
- Tamaño: `437723` bytes
- SHA-256: `250e5cd778c711a00c60946e4bfac3b50d596a315d2da9c086089bab8b09ba76`
- Ownership/ACL: incluidos por las opciones predeterminadas de `pg_dump`
  (sin `--no-owner` ni `--no-acl`); los roles de ownership del archivo se
  crearon localmente como roles sin login únicamente para restaurar ACL/owners.
- Restauración ejecutada con el rol superusuario local existente `postgres`;
  no se crearon seeds de usuarios ni identidad de aplicación.
- El archivo permanece privado bajo `.local/backups/`; ningún dump se guardó
  en una carpeta servida públicamente.

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
snapshot prueba el instante del respaldo, no frescura de un preflight
posterior; no se realizó ese preflight.

## Restauración local persistente

- Cluster: `/home/runner/workspace/.local/backups/prompt-h-block2-20260917001715-50167/restore-cluster`
- Socket Unix restringido: `/tmp/prompt-h-block2-20260917001715-50167-50167`
- Base restaurada: `restore_disposable_20260917001715-50167`
- Exit code de `pg_restore`: `0`
- Administrador: `PGHOST="/tmp/prompt-h-block2-20260917001715-50167-50167" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="restore_admin_20260917001715-50167"`
- Base restaurada: `PGHOST="/tmp/prompt-h-block2-20260917001715-50167-50167" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="restore_disposable_20260917001715-50167"`

El cluster, sus archivos y la base desechable **no se eliminan** después del
éxito; deben permanecer disponibles hasta que el procedimiento completo de
purga cierre. La restauración no sembró usuarios ni identidad de aplicación.
