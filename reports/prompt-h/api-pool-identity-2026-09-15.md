# Prompt H — identidad efectiva del pool de la API

- **Estado:** CONFIRMED_FROM_RUNNING_API_POOL_READ_ONLY.
- **Hora de la consulta en México:** `2026-09-15T21:08:34.332` (hora producida por PostgreSQL con `America/Mexico_City`).
- **Resultado:** `current_database()` confirmó `heliumdb`; el esquema confirmó `public`.
- **Escrituras:** ninguna. No se ejecutó respaldo, purga, DDL, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, ni prueba de escritura.
- **API:** no se reinició el proceso ni se cambió el entorno, la conexión ni el workflow.

## Evidencia de identidad del proceso

La consulta se ejecutó dentro del proceso existente de la API, no desde un cliente
externo ni desde una conexión creada por este diagnóstico:

- PID: `254` (PPID `253`).
- Ejecutable: `/nix/store/9cyx2v23dip6p9q98384k9v06c96qskb-nodejs-24.13.0/bin/node`.
- Comando: `node --enable-source-maps ./dist/index.mjs`.
- CWD: `/home/runner/workspace/artifacts/api-server`.
- Inicio observado: `Wed Sep 16 02:39:39 2026`.
- La fuente `artifacts/api-server/src/index.ts` importa `pool` desde
  `@workspace/db`; `artifacts/api-server/node_modules/@workspace/db/src/index.ts`
  crea el `Pool` exportado en su línea 124.
- Se detuvo temporalmente la ejecución en el método `query` de `pg-pool` dentro
  del bundle cargado por ese PID. El `this` de ese frame fue el pool existente
  (`constructorName: BoundPool`, con método `query`), se reanudó el proceso y la
  siguiente consulta se hizo usando ese mismo objeto.

## SQL exacto y resultado

La única consulta de identidad fue una sentencia `SELECT`; no menciona tablas de
usuarios, sesiones ni autenticación:

```sql
SELECT
  current_database() AS database_name,
  current_schema() AS schema_name,
  current_setting('server_version') AS server_version,
  current_setting('application_name') AS application_name,
  current_setting('transaction_isolation') AS transaction_isolation,
  current_setting('transaction_read_only') AS transaction_read_only,
  to_char(
    clock_timestamp() AT TIME ZONE 'America/Mexico_City',
    'YYYY-MM-DD"T"HH24:MI:SS.MS'
  ) AS observed_at_mexico
```

Resultado devuelto por el pool de la API:

```json
{
  "database_name": "heliumdb",
  "schema_name": "public",
  "server_version": "16.10",
  "application_name": "",
  "transaction_isolation": "read committed",
  "transaction_read_only": "off",
  "observed_at_mexico": "2026-09-15T21:08:34.332"
}
```

`transaction_read_only` refleja el modo por defecto de la conexión (`off`), no
una escritura realizada por este diagnóstico. La sentencia enviada fue
únicamente `SELECT` y terminó con éxito; no se inició una transacción que
pudiera quedar abierta.

## Inspector temporal

No existe una ruta interna segura para devolver esta identidad: `/api/healthz`
solo responde estado y no consulta la base; las demás lecturas de datos requieren
sesión. Por ello se usó el inspector de Node únicamente en loopback, de forma
temporal y controlada:

1. Se activó el inspector del PID 254 mediante `SIGUSR1`; no se abrió ningún
   puerto público.
2. Se capturó el `this` del frame `query` del pool ya cargado por la API.
3. Se eliminó el breakpoint, se reanudó el proceso y se ejecutó el `SELECT`
   anterior con ese pool.
4. Se eliminó la referencia temporal y se cerró el inspector con
   `node:inspector`.
5. La comprobación posterior confirmó que `127.0.0.1:9229` ya no escucha.

No se expusieron endpoints, cookies, credenciales, valores de entorno ni
identidades de usuarios. La evidencia confirma conexión efectiva de la API a
`heliumdb/public`; la coincidencia de configuración por sí sola ya no es la
base de esta conclusión.