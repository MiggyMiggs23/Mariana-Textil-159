# Renovación — API pausada durante respaldo y restauración

## Veredicto

**PASS — respaldo + restauración ejecutados con la API detenida.**

La condición operativa recibida del agente principal antes de esta renovación
fue `stopWorkflow` completado, estado `finished` y puerto `8080` sin listener.
No se reinició la API, no se inició ningún workflow, no se instalaron paquetes y
no se ejecutó Drive.

Esta evidencia solamente cubre la pausa de la API, el respaldo completo y la
restauración local desechable. No autoriza una purga ni una operación posterior
de escritura.

## Verificación de pausa y ausencia de escritores

Se ejecutó una consulta de solo lectura contra `pg_stat_activity` con
`application_name = prompt-h-block2-pause-verification`. La sesión propia se
excluyó mediante `pid <> pg_backend_pid()`. También se excluyeron los procesos
internos de PostgreSQL mediante `backend_type = 'client backend'`; no se
terminó ninguna sesión desconocida.

Consulta aplicada:

```sql
WITH activity AS (
  SELECT pid, usename, datname, application_name, backend_type, state,
         (xact_start IS NOT NULL) AS has_transaction,
         (state IN ('active', 'idle in transaction',
                    'idle in transaction (aborted)')) AS session_busy
    FROM pg_stat_activity
),
client_backends AS (
  SELECT *
    FROM activity
   WHERE datname = current_database()
     AND backend_type = 'client backend'
     AND pid <> pg_backend_pid()
     AND COALESCE(application_name, '') <>
         'prompt-h-block2-pause-verification'
),
mutator_or_api AS (
  SELECT *
    FROM client_backends
   WHERE session_busy OR COALESCE(application_name, '') <> ''
)
SELECT
  (SELECT count(*) FROM activity
    WHERE datname = current_database()) AS total_database_sessions,
  (SELECT count(*) FROM client_backends) AS leftover_client_backends,
  (SELECT count(*) FROM mutator_or_api) AS unexpected_or_busy_backends,
  (SELECT count(*) FROM client_backends
    WHERE session_busy) AS active_or_transaction_backends,
  (SELECT count(*) FROM client_backends
    WHERE COALESCE(application_name, '') = '') AS unnamed_client_backends;
```

Comando de verificación usado, sin imprimir `DATABASE_URL` ni credenciales:

```sh
node --input-type=module <<'NODE'
import pg from './lib/db/node_modules/pg/lib/index.js';
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  application_name: 'prompt-h-block2-pause-verification'
});
await client.connect();
// Ejecutar la consulta anterior con el parámetro de application_name.
await client.end();
NODE
```

Captura posterior al respaldo:

- UTC: `2026-09-16T03:31:14.471Z`
- Ciudad de México: `2026-09-15 21:31:14,471`
- Base: `heliumdb`
- Sesiones de la base, incluyendo la propia verificación: `1`
- Backends cliente restantes después de excluir la sesión propia: `0`
- Backends activos o en transacción restantes: `0`
- Backends inesperados con actividad o `application_name`: `0`
- Escritores API detectados: `0`
- Acción sobre sesiones desconocidas: ninguna; no se terminó ninguna sesión

El respaldo comenzó con la sesión fuente en `REPEATABLE READ READ ONLY` y
`pg_export_snapshot()`; el dump se produjo desde esa instantánea mientras la
transacción permaneció abierta. La evidencia completa y sanitizada está en
`reports/prompt-h/block2-restore.md` y
`reports/prompt-h/block2-restore-metadata.json`.

## Freshness inmediata posterior al respaldo

Se ejecutó una comprobación acotada de solo lectura inmediatamente después del
respaldo, sin ejecutar el preflight de purga. Se compararon únicamente el
conjunto dinámico, conteo y huella canónica de las tablas, además del estado de
las secuencias, contra `source-snapshot.json`.

- Captura UTC: `2026-09-16T03:32:07.262Z`
- Captura Ciudad de México: `2026-09-15 21:32:07,262`
- Snapshot base Ciudad de México: `2026-09-15 21:30:56`
- Tablas: `60 / 60`, sin discrepancias
- Secuencias: `45 / 45`, sin discrepancias
- Resultado: **PASS — SOURCE_UNCHANGED_SINCE_BACKUP**
- Filas crudas persistidas: ninguna

## Respaldo y restauración renovados

- Captura UTC: `2026-09-16T03:30:56.297Z`
- Captura Ciudad de México: `2026-09-15 21:30:56`
- Base fuente: `heliumdb`
- PostgreSQL fuente: `16.10`
- Directorio privado nuevo:
  `.local/backups/prompt-h-block2-20260915213056-6573`
- Dump custom completo:
  `.local/backups/prompt-h-block2-20260915213056-6573/prompt-h-block2-20260915213056-6573.dump`
- Tamaño: `440802` bytes
- SHA-256:
  `4a5deaa825127629e26c3989ea76dab8800748dc177cb4fc7e6eebedf74489a6`
- Formato: `pg_dump --format=custom --create --blobs`
- ACL y ownership: incluidos
- Exit code de `pg_restore`: `0`

La comparación dinámica quedó en `PASS`:

| Evidencia | Fuente | Restaurado | Resultado |
|---|---:|---:|---|
| Tablas dinámicas | 60 | 60 | PASS |
| Conteo + hash canónico de filas | 60 | 60 | PASS |
| Columnas/defaults | 604 | 604 | PASS |
| Constraints | 286 | 286 | PASS |
| Índices | 218 | 218 | PASS |
| Funciones | 49 | 49 | PASS |
| Triggers no internos + estado enabled | 14 | 14 | PASS |
| Definiciones de secuencias | 45 | 45 | PASS |

Las listas de discrepancias `tables`, `columns`, `constraints`, `indexes`,
`functions`, `triggers`, `sequences`,
`tableCountsAndCanonicalRowHashes` y `sequenceStateAfterDump` están vacías.
`sequenceChangedDuringDump` fue `false`. No se guardaron filas crudas en los
reportes; la huella usa la representación canónica `to_jsonb(row)::text`.

## Cluster desechable persistente

El cluster nuevo y sus archivos no se eliminaron:

- Cluster:
  `.local/backups/prompt-h-block2-20260915213056-6573/restore-cluster`
- Socket Unix:
  `/tmp/prompt-h-block2-20260915213056-6573-6573`
- Base restaurada:
  `restore_disposable_20260915213056-6573`
- Base administrativa:
  `restore_admin_20260915213056-6573`
- Listener de red: deshabilitado; socket Unix verificado

Comando de arranque que el agente principal debe conservar en background:

```sh
/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/pg_ctl \
  -D /home/runner/workspace/.local/backups/prompt-h-block2-20260915213056-6573/restore-cluster \
  -w -t 120 \
  -l /home/runner/workspace/.local/backups/prompt-h-block2-20260915213056-6573/restore-cluster/postgres.log \
  -o "-k /tmp/prompt-h-block2-20260915213056-6573-6573 -c listen_addresses=''" \
  start
```

## Preservación y límites

Antes de sobrescribir los outputs se copiaron, sin moverlos, los cinco
artefactos anteriores a `reports/prompt-h/previous-live-api/`:

- `block2-restore.md`
- `block2-restore-metadata.json`
- `block2-drive-verification.json`
- `block3-preflight.md`
- `block3-preflight-metadata.json`

Los clusters y archivos de respaldo anteriores también permanecen intactos.
Durante esta renovación no se ejecutaron `TRUNCATE`, `DELETE`, `UPDATE`,
`INSERT`, `setval`, `ALTER SEQUENCE`, `RESTART IDENTITY`, purge, reset de
secuencias/IDs, preflight ni Drive. La fuente no recibió escrituras.