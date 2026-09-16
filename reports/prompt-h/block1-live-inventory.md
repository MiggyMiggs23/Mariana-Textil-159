# Prompt H — Block 1 live read-only inventory

- **Status:** COMPLETE_READ_ONLY_REFINED_NO_DB_CAPTURE
- **Started (Ciudad de México):** Tuesday, September 15, 2026 at 8:52:56 p.m. CST
- **Completed (Ciudad de México):** Tuesday, September 15, 2026 at 8:52:56 p.m. CST
- **Writes:** none; one REPEATABLE READ / READ ONLY transaction, ended with ROLLBACK.
- **Secrets:** DATABASE_URL value, credentials, and raw table rows are omitted.

## Connection identity and boundary

- Direct pg identity: `{"database_name":"heliumdb","schema_name":"public","current_user_name":"postgres","session_user_name":"postgres","server_version":"16.10","application_name":"prompt_h_block1_inventory_readonly","transaction_isolation":"repeatable read","transaction_read_only":"on"}`
- Transaction settings: `{"transaction_isolation":"repeatable read","transaction_read_only":"on","statement_timeout":"3min","lock_timeout":"5s","idle_in_transaction_session_timeout":"5min"}`
- Source selection: `lib/db/src/index.ts` selects `DATABASE_URL` for a normal process; test override keys were checked and none were present.
- API process inspection: {"processCount":1,"processes":[{"pid":254,"command":["/nix/store/9cyx2v23dip6p9q98384k9v06c96qskb-nodejs-24.13.0/bin/node","--enable-source-maps","./dist/index.mjs"],"cwd":"/home/runner/workspace/artifacts/api-server","isApiArtifact":true,"relevantEnvironmentPresence":{"DATABASE_URL":true,"TEST_DATABASE_URL":false,"APPLICATION_DATABASE_URL":false,"REQUIRE_ISOLATED_TEST_DATABASE":false,"TEST_DATABASE_PREPARATION_PHASE":false,"DATABASE_URL_OVERRIDE":false,"DB_URL_OVERRIDE":false,"NODE_ENV":false},"databaseUrlTarget":{"present":true,"hostname":"helium","port":"5432","database":"heliumdb","urlValueOmitted":true},"databaseUrlTargetMatchesInventory":true,"testOverridePresenceMatchesInventory":true,"presentTestOverrideKeys":[],"actualDatabaseIdentityProvenFromApiProcess":false}],"startupInspection":{"sourceFile":"artifacts/api-server/src/index.ts","distFile":"artifacts/api-server/dist/index.mjs","sourceImportsWorkspaceDb":true,"sourceHasDotenvOrLoadEnv":false,"sourceAssignsDatabaseUrl":false,"distHasDotenvOrLoadEnv":false,"note":"The running API process configuration is inspected without printing environment values. Matching DATABASE_URL target metadata does not prove that the API completed a connection to that database."}}; only non-secret presence/match booleans are recorded, and API `current_database()` is not proven.

## Live table inventory and classification

- Live ordinary/partition tables: **60**.
- Classification totals: A=35, B=7, C=18; sum=60; equals live total=true.
- Sequences are reported separately and are not included in the table total.

### List A (35)

| Table | Rows (metadata count) | One-sentence reason |
|---|---:|---|
| `aplicaciones_credito` | 2 | A — Aplicación de crédito transaccional que representa una operación ocurrida. |
| `aplicaciones_pago_proveedor` | 4 | A — Aplicación de pago a proveedor transaccional que representa una operación ocurrida. |
| `auditoria_inventario_escaneos` | 0 | A — Escaneos de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario. |
| `auditoria_inventario_participantes` | 0 | A — Participantes de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario. |
| `auditoria_inventario_snapshot` | 0 | A — Snapshot de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario. |
| `auditorias_inventario` | 0 | A — Cabecera de auditoría de inventario ocurrida que el prompt reinicia. |
| `autorizaciones_nota` | 2 | A — Autorización de nota ligada a una operación de crédito ocurrida. |
| `contenedor_lineas` | 0 | A — Líneas de un contenedor de una operación de recepción ocurrida. |
| `contenedores` | 0 | A — Recepción/contenedor de mercancía de una operación ocurrida. |
| `cuadre_fiscal_registros` | 0 | A — Registros de cuadre fiscal de operaciones ocurridas; no son catálogo/configuración y no tienen base para conservarse como C. |
| `entradas` | 6 | A — Entrada de inventario de una operación ocurrida. |
| `movimientos` | 307 | A — Movimiento de inventario ocurrido que se purgaría junto con sus rollos. |
| `movimientos_credito` | 8 | A — Movimiento de crédito transaccional ocurrido. |
| `notificaciones_credito` | 2 | A — Notificación derivada de una operación de crédito ocurrida. |
| `notificaciones_sistema` | 16 | A — Notificación operativa derivada de una operación ocurrida. |
| `pagos_proveedor` | 9 | A — Pago a proveedor de una operación financiera ocurrida. |
| `reimpresiones_etiqueta` | 146 | A — Historial operativo de reimpresiones de etiquetas ocurridas. |
| `revisiones_etiqueta` | 31 | A — Control operativo de revisión de rollos; no es catálogo/configuración y se incluye explícitamente en A. |
| `rollos` | 226 | A — Rollo físico recibido/movido en una operación ocurrida. |
| `salida_lineas` | 2 | A — Líneas de una salida operativa ocurrida. |
| `salida_rollos` | 12 | A — Asociación de rollos con una salida operativa ocurrida. |
| `salidas` | 2 | A — Salida de inventario/venta de una operación ocurrida. |
| `salidas_dinero_caja` | 0 | A — Salida de dinero de caja de una operación financiera ocurrida. |
| `sesiones` | 11 | A — Sesión de aplicación operativa, no identidad/configuración persistente. |
| `sesiones_caja` | 2 | A — Sesión operativa de caja ocurrida. |
| `sesiones_caja_dias` | 2 | A — Detalle operativo de una sesión de caja ocurrida. |
| `solicitudes_pago_dirigido` | 0 | A — Solicitud operativa de pago dirigido ocurrida. |
| `stock_minimo_episodios` | 4 | A — Episodio/notificación de mínimo de stock ocurrido, distinto de la configuración conservada. |
| `ticket_linea_consumos` | 20 | A — Ledger operativo de consumos físicos de líneas de ticket; se incluye explícitamente en A. |
| `ticket_lineas` | 57 | A — Líneas de un ticket de una venta ocurrida. |
| `ticket_pagos` | 4 | A — Pago asociado a un ticket de una operación ocurrida. |
| `tickets` | 6 | A — Ticket de venta de una operación ocurrida. |
| `viaje_salidas` | 0 | A — Asociación operativa de una salida con un viaje ocurrido. |
| `viaje_tickets` | 0 | A — Asociación operativa de un ticket con un viaje ocurrido. |
| `viajes` | 0 | A — Viaje/logística de una operación ocurrida. |

### List B (7)

| Table | Rows (metadata count) | One-sentence reason |
|---|---:|---|
| `auditoria_inventario_folio` | 11 | B — Contador operativo de folios de auditorías de inventario que se reiniciaría a su objetivo aprobado. |
| `entrada_folio` | 11 | B — Contador operativo de folios de entradas por ubicación que se reiniciaría a su objetivo aprobado. |
| `existencias` | 37 | B — Caché derivada de existencias que debe reconstruirse, no vaciarse manualmente. |
| `salida_folio` | 11 | B — Contador operativo de folios de salidas por ubicación que se reiniciaría a su objetivo aprobado. |
| `series_consecutivo` | 1 | B — Consecutivo operativo de series que se reiniciaría a su objetivo aprobado. |
| `ticket_folio` | 1 | B — Contador operativo de folios de tickets que se reiniciaría a su objetivo aprobado. |
| `viaje_folio` | 11 | B — Contador operativo de folios de viajes por ubicación que se reiniciaría a su objetivo aprobado. |

### List C (18)

| Table | Rows (metadata count) | One-sentence reason |
|---|---:|---|
| `auditoria` | 3285 | C — Bitácora de auditoría expresamente conservada y tratada como historial append-only. |
| `camionetas` | 0 | C — Catálogo/configuración de camionetas expresamente conservado. |
| `choferes` | 0 | C — Catálogo/configuración de choferes expresamente conservado. |
| `cliente_documentos` | 0 | C — Documentos de identificación/configuración de clientes, dependientes de un catálogo conservado. |
| `clientes` | 7 | C — Catálogo/configuración de clientes expresamente conservado. |
| `equipos` | 0 | C — Catálogo/configuración de equipos expresamente conservado. |
| `equipos_checklist` | 0 | C — Checklist/configuración asociada a equipos expresamente conservada. |
| `permisos_rol` | 192 | C — Configuración de permisos por rol expresamente conservada. |
| `permisos_ubicacion` | 54 | C — Configuración de permisos por ubicación expresamente conservada. |
| `permisos_usuario` | 0 | C — Configuración de permisos por usuario expresamente conservada. |
| `pisos` | 0 | C — Catálogo/configuración de pisos expresamente conservado. |
| `precio_historial` | 1016 | C — Historial de precios solicitado expresamente como conservación inmutable del catálogo. |
| `productos` | 1234 | C — Catálogo operativo de productos que conserva explícitamente sus colores y atributos. |
| `proveedores` | 27 | C — Catálogo/configuración de proveedores expresamente conservado. |
| `stock_minimo_sitios` | 1 | C — Configuración de mínimos de stock por sitio expresamente conservada. |
| `stock_minimos` | 3 | C — Configuración de mínimos de stock expresamente conservada. |
| `ubicaciones` | 11 | C — Catálogo de ubicaciones expresamente conservado. |
| `usuarios` | 31 | C — Identidades de usuarios expresamente conservadas; no se crean ni modifican identidades en este bloque. |

Explicitly requested tables:

- `revisiones_etiqueta`: live=true; classification=A.
- `ticket_linea_consumos`: live=true; classification=A.

## Live/schema comparison

- Drizzle runtime table count: **59**.
- Live-only tables: cuadre_fiscal_registros.
- Schema-only tables: none.
- Column mismatches: 1; foreign-key count mismatches: 4.
- Static initializer/migration table names not live: none.
- Live tables without a static CREATE TABLE match but declared in Drizzle base schema: auditoria, clientes, contenedor_lineas, contenedores, entrada_folio, entradas, existencias, movimientos, movimientos_credito, pagos_proveedor, permisos_rol, permisos_usuario, precio_historial, productos, proveedores, rollos, series_consecutivo, sesiones, sesiones_caja, ticket_folio, ticket_lineas, ticket_pagos, tickets, ubicaciones, usuarios.
- Live tables without either a static initializer/migration match or a Drizzle declaration: none.
- Counter defaults (report only, no correction): [{"table":"auditoria_inventario_folio","column":"ultimo_folio","liveDefaultExpression":"0","notNull":true,"reportOnlyNoCorrection":true},{"table":"entrada_folio","column":"ultimo_folio","liveDefaultExpression":"99","notNull":true,"reportOnlyNoCorrection":true},{"table":"salida_folio","column":"ultimo_folio","liveDefaultExpression":"499","notNull":true,"reportOnlyNoCorrection":true},{"table":"series_consecutivo","column":"ultimo_numero","liveDefaultExpression":"1000000","notNull":true,"reportOnlyNoCorrection":true},{"table":"ticket_folio","column":"ultimo_folio","liveDefaultExpression":"999","notNull":true,"reportOnlyNoCorrection":true},{"table":"viaje_folio","column":"ultimo_folio","liveDefaultExpression":"0","notNull":true,"reportOnlyNoCorrection":true}].
- The JSON report contains runtime Drizzle columns, live columns/constraints, non-internal trigger function source, sequence ownership, views, and the initializer/migration source matches.

## Feasibility without trial writes

- Active append-only DELETE blockers: 8.
- Active TRUNCATE triggers on candidate A tables: 0.
- Preserved C tables referencing candidate A targets: 0.
- FK references from B/C that block TRUNCATE A RESTRICT: 0.
- Incoming FK closure for A outside A: none.
- Metadata-only truncate allowance: true.
- Proposed approach status: **CONDITIONAL_METADATA_ALLOWED_NOT_EXECUTED** — No hay FK entrante desde B/C hacia A ni trigger activo de TRUNCATE sobre A; la estrategia propuesta trunca solo A, actualiza contadores B a 0 y reconstruye existencias con la transacción recibida.
- No DELETE, TRUNCATE, ALTER SEQUENCE, trigger change, UPDATE, INSERT, trial write, or rollback-only write was executed. The proposal truncates only A, updates B counters to 0, and calls `reconstruirCacheExistencias(tx)` for existencias.
- Audit exact-hash caveat: El hash exacto de filas C, incluida auditoria, no se establece en este bloque de metadata/conteos; un preflight aprobado debe definirlo sin exponer identidades/tokens. auditoria no se muta.

## Approval gate

**PENDING EXPLICIT OWNER APPROVAL.** This is Block 1 only; Block 2 and later are not started. The three lists must be reviewed and approved before preflight/purge. The requested backup is separate and has not been made; authorization text must be saved in `reports/` before the first purge write.

## Exact SQL and outputs

The JSON sibling `block1-live-inventory.json` stores every SQL string and its output rows exactly as captured (without credentials or raw application rows).

### begin

```sql
BEGIN
```
```json
{
  "command": "BEGIN",
  "rowCount": null,
  "rows": []
}
```

### set_repeatable_read_read_only

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY
```
```json
{
  "command": "SET",
  "rowCount": null,
  "rows": []
}
```

### set_statement_timeout

```sql
SET LOCAL statement_timeout = '180s'
```
```json
{
  "command": "SET",
  "rowCount": null,
  "rows": []
}
```

### set_lock_timeout

```sql
SET LOCAL lock_timeout = '5s'
```
```json
{
  "command": "SET",
  "rowCount": null,
  "rows": []
}
```

### set_idle_in_transaction_timeout

```sql
SET LOCAL idle_in_transaction_session_timeout = '300s'
```
```json
{
  "command": "SET",
  "rowCount": null,
  "rows": []
}
```

### live_identity

```sql
SELECT
         current_database() AS database_name,
         current_schema() AS schema_name,
         current_user AS current_user_name,
         session_user AS session_user_name,
         current_setting('server_version') AS server_version,
         current_setting('application_name') AS application_name,
         current_setting('transaction_isolation') AS transaction_isolation,
         current_setting('transaction_read_only') AS transaction_read_only
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "database_name": "heliumdb",
      "schema_name": "public",
      "current_user_name": "postgres",
      "session_user_name": "postgres",
      "server_version": "16.10",
      "application_name": "prompt_h_block1_inventory_readonly",
      "transaction_isolation": "repeatable read",
      "transaction_read_only": "on"
    }
  ]
}
```

### transaction_state

```sql
SELECT
         current_setting('transaction_isolation') AS transaction_isolation,
         current_setting('transaction_read_only') AS transaction_read_only,
         current_setting('statement_timeout') AS statement_timeout,
         current_setting('lock_timeout') AS lock_timeout,
         current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "transaction_isolation": "repeatable read",
      "transaction_read_only": "on",
      "statement_timeout": "3min",
      "lock_timeout": "5s",
      "idle_in_transaction_session_timeout": "5min"
    }
  ]
}
```

### ordinary_and_partition_tables

```sql
SELECT
         n.nspname AS schema_name,
         c.relname AS table_name,
         c.relkind::text AS relkind,
         c.relpersistence::text AS persistence,
         c.relispartition AS is_partition,
         pg_get_partkeydef(c.oid) AS partition_key_definition,
         obj_description(c.oid, 'pg_class') AS table_comment
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND n.nspname NOT LIKE 'pg_%'
         AND c.relkind IN ('r', 'p')
       ORDER BY n.nspname, c.relname
```
```json
{
  "command": "SELECT",
  "rowCount": 60,
  "rows": [
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_folio",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_participantes",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "autorizaciones_nota",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "choferes",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "contenedor_lineas",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "entrada_folio",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "equipos_checklist",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "existencias",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "pisos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "salida_folio",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "series_consecutivo",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "sesiones",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja_dias",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_sitios",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "ticket_folio",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": "Immutable physical roll allocations for accounted supplier utility; empty for historical records without evidence."
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "ubicaciones",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "viaje_folio",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "viaje_salidas",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "viaje_tickets",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "relkind": "r",
      "persistence": "p",
      "is_partition": false,
      "partition_key_definition": null,
      "table_comment": null
    }
  ]
}
```

### views_separate

```sql
SELECT
         n.nspname AS schema_name,
         c.relname AS relation_name,
         c.relkind::text AS relkind,
         pg_get_viewdef(c.oid, true) AS definition,
         obj_description(c.oid, 'pg_class') AS relation_comment
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND n.nspname NOT LIKE 'pg_%'
         AND c.relkind IN ('v', 'm')
       ORDER BY n.nspname, c.relname
```
```json
{
  "command": "SELECT",
  "rowCount": 0,
  "rows": []
}
```

### columns

```sql
SELECT
         n.nspname AS schema_name,
         c.relname AS table_name,
         a.attnum AS ordinal_position,
         a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS formatted_type,
         a.attnotnull AS not_null,
         pg_get_expr(d.adbin, d.adrelid) AS default_expression,
         col_description(a.attrelid, a.attnum) AS column_comment,
         a.attidentity::text AS identity_kind,
         a.attgenerated::text AS generated_kind
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND n.nspname NOT LIKE 'pg_%'
         AND c.relkind IN ('r', 'p')
         AND a.attnum > 0
         AND NOT a.attisdropped
       ORDER BY n.nspname, c.relname, a.attnum
```
```json
{
  "command": "SELECT",
  "rowCount": 604,
  "rows": [
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('aplicaciones_credito_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "ordinal_position": 2,
      "column_name": "abono_movimiento_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "ordinal_position": 3,
      "column_name": "venta_movimiento_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "ordinal_position": 4,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "ordinal_position": 5,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('aplicaciones_pago_proveedor_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "ordinal_position": 2,
      "column_name": "pago_proveedor_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "ordinal_position": 3,
      "column_name": "compra_proveedor_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "ordinal_position": 4,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "ordinal_position": 5,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "bigint",
      "not_null": true,
      "default_expression": "nextval('auditoria_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 2,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 3,
      "column_name": "accion",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 4,
      "column_name": "entidad",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 5,
      "column_name": "entidad_id",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 6,
      "column_name": "datos_antes",
      "formatted_type": "jsonb",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 7,
      "column_name": "datos_despues",
      "formatted_type": "jsonb",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 8,
      "column_name": "ip",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 9,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 10,
      "column_name": "usuario_snapshot",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 11,
      "column_name": "rol_snapshot",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 12,
      "column_name": "sitio_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 13,
      "column_name": "sitio_snapshot",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "ordinal_position": 14,
      "column_name": "modulo",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 1,
      "column_name": "auditoria_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 2,
      "column_name": "serie",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 3,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 4,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 5,
      "column_name": "escaneado_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 6,
      "column_name": "cantidad_cierre",
      "formatted_type": "numeric(10,3)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 7,
      "column_name": "unidad_cierre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 8,
      "column_name": "estado_cierre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 9,
      "column_name": "ubicacion_cierre_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 10,
      "column_name": "ubicacion_cierre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 11,
      "column_name": "resolucion",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'PENDIENTE'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 12,
      "column_name": "sku_cierre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 13,
      "column_name": "tela_cierre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 14,
      "column_name": "color_cierre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 15,
      "column_name": "piso_real_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_escaneos",
      "ordinal_position": 16,
      "column_name": "piso_real",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_folio",
      "ordinal_position": 1,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_folio",
      "ordinal_position": 2,
      "column_name": "ultimo_folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "0",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_participantes",
      "ordinal_position": 1,
      "column_name": "auditoria_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_participantes",
      "ordinal_position": 2,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_participantes",
      "ordinal_position": 3,
      "column_name": "escaneos",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "0",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_participantes",
      "ordinal_position": 4,
      "column_name": "primero_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_participantes",
      "ordinal_position": 5,
      "column_name": "ultimo_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 1,
      "column_name": "auditoria_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 2,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 3,
      "column_name": "serie",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 4,
      "column_name": "cantidad_snapshot",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 5,
      "column_name": "resolucion",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'PENDIENTE'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 6,
      "column_name": "sku_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 7,
      "column_name": "tela_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 8,
      "column_name": "color_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 9,
      "column_name": "unidad_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 10,
      "column_name": "ubicacion_snapshot_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 11,
      "column_name": "ubicacion_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 12,
      "column_name": "estado_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 13,
      "column_name": "piso_snapshot_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditoria_inventario_snapshot",
      "ordinal_position": 14,
      "column_name": "piso_snapshot",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('auditorias_inventario_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 2,
      "column_name": "folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 3,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 4,
      "column_name": "estado",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'ABIERTA'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 5,
      "column_name": "creada_por_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 6,
      "column_name": "cerrada_por_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 7,
      "column_name": "confirmada_por_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 8,
      "column_name": "cancelada_por_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 9,
      "column_name": "motivo_cancelacion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 10,
      "column_name": "abierta_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 11,
      "column_name": "cerrada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 12,
      "column_name": "confirmada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "auditorias_inventario",
      "ordinal_position": 13,
      "column_name": "cancelada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "autorizaciones_nota",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('autorizaciones_nota_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "autorizaciones_nota",
      "ordinal_position": 2,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "autorizaciones_nota",
      "ordinal_position": 3,
      "column_name": "sesion_caja_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "autorizaciones_nota",
      "ordinal_position": 4,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "autorizaciones_nota",
      "ordinal_position": 5,
      "column_name": "movimiento_credito_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "autorizaciones_nota",
      "ordinal_position": 6,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('camionetas_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 2,
      "column_name": "nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 3,
      "column_name": "placas",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 4,
      "column_name": "marca",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 5,
      "column_name": "modelo",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 6,
      "column_name": "tipo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 7,
      "column_name": "activa",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 8,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "camionetas",
      "ordinal_position": 9,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "choferes",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('choferes_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "choferes",
      "ordinal_position": 2,
      "column_name": "nombre_completo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "choferes",
      "ordinal_position": 3,
      "column_name": "telefono",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "choferes",
      "ordinal_position": 4,
      "column_name": "activo",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "choferes",
      "ordinal_position": 5,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "choferes",
      "ordinal_position": 6,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('cliente_documentos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 2,
      "column_name": "public_id",
      "formatted_type": "uuid",
      "not_null": true,
      "default_expression": "gen_random_uuid()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 3,
      "column_name": "cliente_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 4,
      "column_name": "tipo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'INE'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 5,
      "column_name": "lado",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 6,
      "column_name": "nombre_archivo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 7,
      "column_name": "ruta_archivo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 8,
      "column_name": "mime_type",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 9,
      "column_name": "tamano_bytes",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 10,
      "column_name": "subido_por",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 11,
      "column_name": "subido_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 12,
      "column_name": "vigente",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cliente_documentos",
      "ordinal_position": 13,
      "column_name": "reemplaza_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('clientes_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 2,
      "column_name": "nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 3,
      "column_name": "telefono",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 4,
      "column_name": "correo",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 5,
      "column_name": "direccion_particular",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 6,
      "column_name": "rfc",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 7,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 8,
      "column_name": "activo",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 9,
      "column_name": "limite_credito",
      "formatted_type": "numeric(14,2)",
      "not_null": true,
      "default_expression": "0.00",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 10,
      "column_name": "saldo_credito",
      "formatted_type": "numeric(14,2)",
      "not_null": true,
      "default_expression": "0.00",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 11,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 12,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 13,
      "column_name": "es_sistema",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 14,
      "column_name": "contacto_nombre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 15,
      "column_name": "dias_credito",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "0",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 16,
      "column_name": "direccion_entrega",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "clientes",
      "ordinal_position": 17,
      "column_name": "recibe_nota_sin_precios",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedor_lineas",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('contenedor_lineas_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedor_lineas",
      "ordinal_position": 2,
      "column_name": "contenedor_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedor_lineas",
      "ordinal_position": 3,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedor_lineas",
      "ordinal_position": 4,
      "column_name": "cantidad_esperada",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedor_lineas",
      "ordinal_position": 5,
      "column_name": "rollos_esperados",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedor_lineas",
      "ordinal_position": 6,
      "column_name": "nota",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('contenedores_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 2,
      "column_name": "folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('contenedores_folio_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 3,
      "column_name": "proveedor_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 4,
      "column_name": "referencia",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 5,
      "column_name": "fecha_pedido",
      "formatted_type": "date",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 6,
      "column_name": "fecha_estimada_llegada",
      "formatted_type": "date",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 7,
      "column_name": "fecha_real_llegada",
      "formatted_type": "date",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 8,
      "column_name": "sitio_destino_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 9,
      "column_name": "entrada_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 10,
      "column_name": "estado",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'EN_TRANSITO'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 11,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 12,
      "column_name": "motivo_cancelacion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 13,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 14,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "contenedores",
      "ordinal_position": 15,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('cuadre_fiscal_registros_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 2,
      "column_name": "tipo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 3,
      "column_name": "desde",
      "formatted_type": "date",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 4,
      "column_name": "hasta",
      "formatted_type": "date",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 5,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 6,
      "column_name": "facturado_congelado",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 7,
      "column_name": "actor_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 8,
      "column_name": "direccion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 9,
      "column_name": "monto",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 10,
      "column_name": "descripcion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 11,
      "column_name": "estado",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 12,
      "column_name": "nota_resolucion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 13,
      "column_name": "resuelto_por_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 14,
      "column_name": "resuelto_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "cuadre_fiscal_registros",
      "ordinal_position": 15,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entrada_folio",
      "ordinal_position": 2,
      "column_name": "ultimo_folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "99",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entrada_folio",
      "ordinal_position": 3,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('entradas_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 2,
      "column_name": "folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 3,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 4,
      "column_name": "proveedor_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 5,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 6,
      "column_name": "fecha",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 7,
      "column_name": "observaciones",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 8,
      "column_name": "total_rollos",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 9,
      "column_name": "total_costo",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 10,
      "column_name": "uuid_cliente",
      "formatted_type": "uuid",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "entradas",
      "ordinal_position": 11,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('equipos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 2,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 3,
      "column_name": "tipo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 4,
      "column_name": "identificador",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 5,
      "column_name": "marca",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 6,
      "column_name": "modelo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 7,
      "column_name": "numero_serie",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 8,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 9,
      "column_name": "creado_por",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 10,
      "column_name": "actualizado_por",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 11,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos",
      "ordinal_position": 12,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos_checklist",
      "ordinal_position": 1,
      "column_name": "equipo_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos_checklist",
      "ordinal_position": 2,
      "column_name": "item_key",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos_checklist",
      "ordinal_position": 3,
      "column_name": "checked_por",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "equipos_checklist",
      "ordinal_position": 4,
      "column_name": "checked_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "existencias",
      "ordinal_position": 1,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "existencias",
      "ordinal_position": 2,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "existencias",
      "ordinal_position": 3,
      "column_name": "cantidad_total",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": "'0'::numeric",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "existencias",
      "ordinal_position": 4,
      "column_name": "rollos_count",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "0",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "existencias",
      "ordinal_position": 5,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "bigint",
      "not_null": true,
      "default_expression": "nextval('movimientos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 2,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 3,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 4,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 5,
      "column_name": "tipo",
      "formatted_type": "tipo_movimiento",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 6,
      "column_name": "cantidad",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 7,
      "column_name": "saldo_posterior",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 8,
      "column_name": "documento_tipo",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 9,
      "column_name": "documento_id",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 10,
      "column_name": "movimiento_origen_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 11,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 12,
      "column_name": "justificacion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 13,
      "column_name": "revisado",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 14,
      "column_name": "revisado_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 15,
      "column_name": "revisado_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 16,
      "column_name": "uuid_cliente",
      "formatted_type": "uuid",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 17,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 18,
      "column_name": "motivo_salida_extraordinaria",
      "formatted_type": "motivo_salida_extraordinaria",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos",
      "ordinal_position": 19,
      "column_name": "salida_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('movimientos_credito_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 2,
      "column_name": "cliente_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 3,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 4,
      "column_name": "tipo",
      "formatted_type": "tipo_movimiento_credito",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 5,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 6,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 7,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 8,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 9,
      "column_name": "forma_pago",
      "formatted_type": "forma_pago_cuenta",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 10,
      "column_name": "referencia",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 11,
      "column_name": "metadata",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 12,
      "column_name": "dias_plazo",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 13,
      "column_name": "fecha_vencimiento",
      "formatted_type": "date",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 14,
      "column_name": "es_incobrable",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 15,
      "column_name": "motivo_incobrable",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 16,
      "column_name": "autorizado_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 17,
      "column_name": "cuenta_destino",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "ordinal_position": 18,
      "column_name": "movimiento_origen_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('notificaciones_credito_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 2,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 3,
      "column_name": "cliente_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 4,
      "column_name": "cliente_nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 5,
      "column_name": "folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 6,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 7,
      "column_name": "dias_plazo",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 8,
      "column_name": "fecha_vencimiento",
      "formatted_type": "date",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 9,
      "column_name": "cajero_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 10,
      "column_name": "cajero_nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 11,
      "column_name": "tienda_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 12,
      "column_name": "tienda_nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 13,
      "column_name": "urgente",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 14,
      "column_name": "leida_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_credito",
      "ordinal_position": 15,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('notificaciones_sistema_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 2,
      "column_name": "tipo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 3,
      "column_name": "titulo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 4,
      "column_name": "mensaje",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 5,
      "column_name": "entidad",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 6,
      "column_name": "entidad_id",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 7,
      "column_name": "leida_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 8,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "notificaciones_sistema",
      "ordinal_position": 9,
      "column_name": "destinatario_usuario_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('pagos_proveedor_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 2,
      "column_name": "proveedor_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 3,
      "column_name": "entrada_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 4,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 5,
      "column_name": "tipo",
      "formatted_type": "tipo_pago_proveedor",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 6,
      "column_name": "forma_pago",
      "formatted_type": "forma_pago_proveedor",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 7,
      "column_name": "referencia",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 8,
      "column_name": "fecha",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 9,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 10,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 11,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "ordinal_position": 12,
      "column_name": "movimiento_origen_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('permisos_rol_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 2,
      "column_name": "rol",
      "formatted_type": "rol_usuario",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 3,
      "column_name": "modulo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 4,
      "column_name": "puede_ver",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 5,
      "column_name": "puede_crear",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 6,
      "column_name": "puede_editar",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 7,
      "column_name": "puede_autorizar",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 8,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_rol",
      "ordinal_position": 9,
      "column_name": "updated_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('permisos_ubicacion_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 2,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 3,
      "column_name": "rol",
      "formatted_type": "rol_usuario",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 4,
      "column_name": "modulo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 5,
      "column_name": "puede_ver",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 6,
      "column_name": "puede_crear",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 7,
      "column_name": "puede_editar",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 8,
      "column_name": "puede_autorizar",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 9,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_ubicacion",
      "ordinal_position": 10,
      "column_name": "updated_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('permisos_usuario_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 2,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 3,
      "column_name": "modulo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 4,
      "column_name": "puede_ver",
      "formatted_type": "boolean",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 5,
      "column_name": "puede_crear",
      "formatted_type": "boolean",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 6,
      "column_name": "puede_editar",
      "formatted_type": "boolean",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 7,
      "column_name": "puede_autorizar",
      "formatted_type": "boolean",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 8,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "permisos_usuario",
      "ordinal_position": 9,
      "column_name": "updated_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pisos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('pisos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pisos",
      "ordinal_position": 2,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pisos",
      "ordinal_position": 3,
      "column_name": "nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pisos",
      "ordinal_position": 4,
      "column_name": "activo",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pisos",
      "ordinal_position": 5,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "pisos",
      "ordinal_position": 6,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('precio_historial_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 2,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 3,
      "column_name": "precio_lista_anterior",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 4,
      "column_name": "precio_lista_nuevo",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 5,
      "column_name": "costo_unitario_ponderado",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 6,
      "column_name": "margen_pesos_unidad",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 7,
      "column_name": "margen_porcentaje_subtotal",
      "formatted_type": "numeric(7,4)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 8,
      "column_name": "motivo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 9,
      "column_name": "advertencia_bajo_costo",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 10,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 11,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "precio_historial",
      "ordinal_position": 12,
      "column_name": "modo_precio",
      "formatted_type": "precio_modo",
      "not_null": true,
      "default_expression": "'ROLLO'::precio_modo",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('productos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 2,
      "column_name": "sku",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 3,
      "column_name": "tela",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 4,
      "column_name": "color",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 5,
      "column_name": "unidad",
      "formatted_type": "unidad_producto",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 6,
      "column_name": "precio_sugerido",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 7,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 8,
      "column_name": "activo",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 9,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 10,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 11,
      "column_name": "se_vende_por_metro",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 12,
      "column_name": "precio_mayoreo",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 13,
      "column_name": "precio_menudeo",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 14,
      "column_name": "color_hex",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 15,
      "column_name": "ancho_cm",
      "formatted_type": "numeric(10,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 16,
      "column_name": "composicion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "productos",
      "ordinal_position": 17,
      "column_name": "gramaje_gm2",
      "formatted_type": "numeric(10,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('proveedores_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 2,
      "column_name": "nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 3,
      "column_name": "tipo",
      "formatted_type": "tipo_proveedor",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 4,
      "column_name": "moneda_default",
      "formatted_type": "moneda",
      "not_null": true,
      "default_expression": "'MXN'::moneda",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 5,
      "column_name": "contacto_nombre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 6,
      "column_name": "telefono",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 7,
      "column_name": "correo",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 8,
      "column_name": "pais",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 9,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 10,
      "column_name": "activo",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "proveedores",
      "ordinal_position": 11,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('reimpresiones_etiqueta_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 2,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 3,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 4,
      "column_name": "autorizado_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 5,
      "column_name": "motivo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 6,
      "column_name": "sitio_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 7,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 8,
      "column_name": "serie_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 9,
      "column_name": "sku_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 10,
      "column_name": "producto_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 11,
      "column_name": "tela_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 12,
      "column_name": "color_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 13,
      "column_name": "solicitante_nombre_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 14,
      "column_name": "solicitante_usuario_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 15,
      "column_name": "autorizador_nombre_snapshot",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 16,
      "column_name": "autorizador_usuario_snapshot",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "ordinal_position": 17,
      "column_name": "sitio_nombre_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('revisiones_etiqueta_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "ordinal_position": 2,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "ordinal_position": 3,
      "column_name": "reimpresion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "ordinal_position": 4,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "ordinal_position": 5,
      "column_name": "revisor_nombre_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "ordinal_position": 6,
      "column_name": "revisor_usuario_snapshot",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "ordinal_position": 7,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('rollos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 2,
      "column_name": "serie",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 3,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 4,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 5,
      "column_name": "proveedor_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 6,
      "column_name": "recepcion_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 7,
      "column_name": "rollo_origen_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 8,
      "column_name": "estado",
      "formatted_type": "estado_rollo",
      "not_null": true,
      "default_expression": "'PROGRAMADO'::estado_rollo",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 9,
      "column_name": "cantidad_inicial",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 10,
      "column_name": "cantidad_actual",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 11,
      "column_name": "costo_unitario",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 12,
      "column_name": "costo_total",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 13,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 14,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 15,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "rollos",
      "ordinal_position": 16,
      "column_name": "piso_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_folio",
      "ordinal_position": 2,
      "column_name": "ultimo_folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "499",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_folio",
      "ordinal_position": 3,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('salida_lineas_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 2,
      "column_name": "salida_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 3,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 4,
      "column_name": "cantidad_solicitada",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 5,
      "column_name": "cantidad_enviada",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": "0",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 6,
      "column_name": "cantidad_recibida",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": "0",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 7,
      "column_name": "rollos_solicitados",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_lineas",
      "ordinal_position": 8,
      "column_name": "nota",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('salida_rollos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 2,
      "column_name": "salida_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 3,
      "column_name": "linea_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 4,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 5,
      "column_name": "cantidad_enviada",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 6,
      "column_name": "cantidad_recibida",
      "formatted_type": "numeric(10,3)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 7,
      "column_name": "recibido",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salida_rollos",
      "ordinal_position": 8,
      "column_name": "nota_diferencia",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('salidas_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 2,
      "column_name": "folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 3,
      "column_name": "origen_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 4,
      "column_name": "destino_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 5,
      "column_name": "estado",
      "formatted_type": "estado_salida",
      "not_null": true,
      "default_expression": "'ARMANDO'::estado_salida",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 6,
      "column_name": "usuario_solicita_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 7,
      "column_name": "usuario_acepta_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 8,
      "column_name": "usuario_prepara_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 9,
      "column_name": "usuario_envia_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 10,
      "column_name": "usuario_recibe_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 11,
      "column_name": "usuario_cierra_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 12,
      "column_name": "solicitada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 13,
      "column_name": "aceptada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 14,
      "column_name": "preparada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 15,
      "column_name": "enviada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 16,
      "column_name": "recibida_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 17,
      "column_name": "cerrada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 18,
      "column_name": "motivo_rechazo",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 19,
      "column_name": "motivo_cancelacion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 20,
      "column_name": "nota_solicitud",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 21,
      "column_name": "nota_envio",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 22,
      "column_name": "nota_recepcion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 23,
      "column_name": "transportista",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 24,
      "column_name": "uuid_cliente",
      "formatted_type": "uuid",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 25,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 26,
      "column_name": "usuario_cancela_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 27,
      "column_name": "cancelada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 28,
      "column_name": "autorizado_por_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 29,
      "column_name": "actividad_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 30,
      "column_name": "modalidad",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'TRASLADO'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 31,
      "column_name": "cliente_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 32,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 33,
      "column_name": "usuario_entrega_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas",
      "ordinal_position": 34,
      "column_name": "entregada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('salidas_dinero_caja_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 2,
      "column_name": "sesion_caja_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 3,
      "column_name": "monto",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 4,
      "column_name": "motivo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 5,
      "column_name": "proveedor_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 6,
      "column_name": "cuenta_origen",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 7,
      "column_name": "creado_por_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "salidas_dinero_caja",
      "ordinal_position": 8,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "series_consecutivo",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "1",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "series_consecutivo",
      "ordinal_position": 2,
      "column_name": "ultimo_numero",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "1000000",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "uuid",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones",
      "ordinal_position": 2,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones",
      "ordinal_position": 3,
      "column_name": "expira_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones",
      "ordinal_position": 4,
      "column_name": "ip",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones",
      "ordinal_position": 5,
      "column_name": "user_agent",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones",
      "ordinal_position": 6,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('sesiones_caja_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 2,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 3,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 4,
      "column_name": "abierta_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 5,
      "column_name": "cerrada_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 6,
      "column_name": "fondo_inicial",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 7,
      "column_name": "efectivo_contado",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 8,
      "column_name": "estado",
      "formatted_type": "estado_sesion_caja",
      "not_null": true,
      "default_expression": "'ABIERTA'::estado_sesion_caja",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 9,
      "column_name": "fecha_operativa",
      "formatted_type": "date",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja",
      "ordinal_position": 10,
      "column_name": "cerrada_por_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja_dias",
      "ordinal_position": 1,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja_dias",
      "ordinal_position": 2,
      "column_name": "fecha_operativa",
      "formatted_type": "date",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "sesiones_caja_dias",
      "ordinal_position": 3,
      "column_name": "sesion_caja_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('solicitudes_pago_dirigido_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 2,
      "column_name": "tipo",
      "formatted_type": "tipo_solicitud_pago_dirigido",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 3,
      "column_name": "entidad_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 4,
      "column_name": "documento_movimiento_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 5,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 6,
      "column_name": "forma_pago",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 7,
      "column_name": "cuenta_destino",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 8,
      "column_name": "fecha_efectiva",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 9,
      "column_name": "referencia",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 10,
      "column_name": "notas",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 11,
      "column_name": "motivo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 12,
      "column_name": "motivo_rechazo",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 13,
      "column_name": "solicitante_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 14,
      "column_name": "solicitante_nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "''::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 15,
      "column_name": "autorizador_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 16,
      "column_name": "autorizador_nombre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 17,
      "column_name": "contraparte_nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "''::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 18,
      "column_name": "documento_folio",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "''::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 19,
      "column_name": "movimiento_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 20,
      "column_name": "estado",
      "formatted_type": "estado_solicitud_pago_dirigido",
      "not_null": true,
      "default_expression": "'PENDIENTE'::estado_solicitud_pago_dirigido",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 21,
      "column_name": "resuelta_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 22,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 23,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "solicitudes_pago_dirigido",
      "ordinal_position": 24,
      "column_name": "ubicacion_nombre",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('stock_minimo_episodios_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 2,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 3,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 4,
      "column_name": "minimo",
      "formatted_type": "numeric(18,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 5,
      "column_name": "existencia",
      "formatted_type": "numeric(18,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 6,
      "column_name": "diferencia",
      "formatted_type": "numeric(18,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 7,
      "column_name": "abierto_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 8,
      "column_name": "cerrado_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 9,
      "column_name": "movimiento_id",
      "formatted_type": "bigint",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_episodios",
      "ordinal_position": 10,
      "column_name": "causa",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'SNAPSHOT'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_sitios",
      "ordinal_position": 1,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_sitios",
      "ordinal_position": 2,
      "column_name": "habilitado",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_sitios",
      "ordinal_position": 3,
      "column_name": "updated_by",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimo_sitios",
      "ordinal_position": 4,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('stock_minimos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimos",
      "ordinal_position": 2,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimos",
      "ordinal_position": 3,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimos",
      "ordinal_position": 4,
      "column_name": "cantidad",
      "formatted_type": "numeric(18,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimos",
      "ordinal_position": 5,
      "column_name": "updated_by",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "stock_minimos",
      "ordinal_position": 6,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_folio",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "1",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_folio",
      "ordinal_position": 2,
      "column_name": "ultimo_folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "999",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "bigint",
      "not_null": true,
      "default_expression": "nextval('ticket_linea_consumos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 2,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 3,
      "column_name": "ticket_linea_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 4,
      "column_name": "movimiento_id",
      "formatted_type": "bigint",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 5,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 6,
      "column_name": "entrada_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 7,
      "column_name": "proveedor_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 8,
      "column_name": "cantidad_milesimas",
      "formatted_type": "bigint",
      "not_null": true,
      "default_expression": null,
      "column_comment": "Positive physical quantity in thousandths.",
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 9,
      "column_name": "ingreso_centavos",
      "formatted_type": "bigint",
      "not_null": true,
      "default_expression": null,
      "column_comment": "Positive revenue allocation in integer cents, assigned with deterministic largest remainder.",
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 10,
      "column_name": "costo_centavos",
      "formatted_type": "bigint",
      "not_null": false,
      "default_expression": null,
      "column_comment": "Frozen physical cost in integer cents; NULL means utility unavailable.",
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 11,
      "column_name": "tipo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 12,
      "column_name": "reversa_de_id",
      "formatted_type": "bigint",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 13,
      "column_name": "idempotencia",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "ordinal_position": 14,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('ticket_lineas_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 2,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 3,
      "column_name": "rollo_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 4,
      "column_name": "producto_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 5,
      "column_name": "cantidad",
      "formatted_type": "numeric(10,3)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 6,
      "column_name": "precio_unitario",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 7,
      "column_name": "precio_sugerido",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 8,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 9,
      "column_name": "costo_unitario_congelado",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 10,
      "column_name": "costo_total_congelado",
      "formatted_type": "numeric(12,2)",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 11,
      "column_name": "tipo",
      "formatted_type": "tipo_ticket",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_lineas",
      "ordinal_position": 12,
      "column_name": "costo_referencia_estado",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('ticket_pagos_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "ordinal_position": 2,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "ordinal_position": 3,
      "column_name": "forma_pago",
      "formatted_type": "forma_pago_ticket",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "ordinal_position": 4,
      "column_name": "importe",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "ordinal_position": 5,
      "column_name": "referencia",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "ordinal_position": 6,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "ordinal_position": 7,
      "column_name": "usuario_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('tickets_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 2,
      "column_name": "folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 3,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 4,
      "column_name": "usuario_terminal_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 5,
      "column_name": "cliente_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 7,
      "column_name": "subtotal",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 8,
      "column_name": "total",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 9,
      "column_name": "estado",
      "formatted_type": "estado_ticket",
      "not_null": true,
      "default_expression": "'VENDIDO'::estado_ticket",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 10,
      "column_name": "cobrado",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 11,
      "column_name": "cobrado_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 12,
      "column_name": "usuario_caja_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 13,
      "column_name": "facturado",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 14,
      "column_name": "sesion_caja_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 15,
      "column_name": "uuid_cliente",
      "formatted_type": "uuid",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 16,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 17,
      "column_name": "cancelado_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 18,
      "column_name": "cancelado_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 19,
      "column_name": "motivo_cancelacion",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 20,
      "column_name": "autorizado_por",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 21,
      "column_name": "iva",
      "formatted_type": "numeric(12,2)",
      "not_null": true,
      "default_expression": "'0'::numeric",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 22,
      "column_name": "tasa_iva",
      "formatted_type": "numeric(5,4)",
      "not_null": true,
      "default_expression": "0.1600",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 23,
      "column_name": "documento_tipo",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'TICKET'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 24,
      "column_name": "nombre_destinatario",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 25,
      "column_name": "direccion_entrega_snapshot",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 26,
      "column_name": "nota_sin_precios",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 27,
      "column_name": "credito",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "false",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 28,
      "column_name": "dias_plazo",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 29,
      "column_name": "fecha_vencimiento",
      "formatted_type": "date",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 30,
      "column_name": "autorizado_at",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "tickets",
      "ordinal_position": 31,
      "column_name": "autorizacion_estado",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": "'NO_APLICA'::text",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ubicaciones",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('ubicaciones_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ubicaciones",
      "ordinal_position": 2,
      "column_name": "nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ubicaciones",
      "ordinal_position": 3,
      "column_name": "tipo",
      "formatted_type": "tipo_ubicacion",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ubicaciones",
      "ordinal_position": 4,
      "column_name": "activa",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ubicaciones",
      "ordinal_position": 5,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "ubicaciones",
      "ordinal_position": 6,
      "column_name": "iniciales",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('usuarios_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 2,
      "column_name": "nombre",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 3,
      "column_name": "usuario",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 4,
      "column_name": "password_hash",
      "formatted_type": "text",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 5,
      "column_name": "rol",
      "formatted_type": "rol_usuario",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 6,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 7,
      "column_name": "activo",
      "formatted_type": "boolean",
      "not_null": true,
      "default_expression": "true",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 8,
      "column_name": "ultimo_acceso",
      "formatted_type": "timestamp with time zone",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 9,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "usuarios",
      "ordinal_position": 10,
      "column_name": "alcance_consulta",
      "formatted_type": "alcance_consulta",
      "not_null": true,
      "default_expression": "'TODAS'::alcance_consulta",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viaje_folio",
      "ordinal_position": 1,
      "column_name": "ubicacion_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viaje_folio",
      "ordinal_position": 2,
      "column_name": "ultimo_folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "0",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viaje_salidas",
      "ordinal_position": 1,
      "column_name": "viaje_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viaje_salidas",
      "ordinal_position": 2,
      "column_name": "salida_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viaje_tickets",
      "ordinal_position": 1,
      "column_name": "viaje_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viaje_tickets",
      "ordinal_position": 2,
      "column_name": "ticket_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 1,
      "column_name": "id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": "nextval('viajes_id_seq'::regclass)",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 2,
      "column_name": "folio",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 3,
      "column_name": "origen_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 4,
      "column_name": "camioneta_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 5,
      "column_name": "chofer_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 6,
      "column_name": "salida_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 7,
      "column_name": "observaciones",
      "formatted_type": "text",
      "not_null": false,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 8,
      "column_name": "creado_por_id",
      "formatted_type": "integer",
      "not_null": true,
      "default_expression": null,
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 9,
      "column_name": "created_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    },
    {
      "schema_name": "public",
      "table_name": "viajes",
      "ordinal_position": 10,
      "column_name": "updated_at",
      "formatted_type": "timestamp with time zone",
      "not_null": true,
      "default_expression": "now()",
      "column_comment": null,
      "identity_kind": "",
      "generated_kind": ""
    }
  ]
}
```

### constraints_and_foreign_keys

```sql
SELECT
         source_ns.nspname AS source_schema,
         source_table.relname AS source_table,
         con.conname AS constraint_name,
         con.contype::text AS constraint_type,
         pg_get_constraintdef(con.oid, true) AS constraint_definition,
         con.convalidated AS validated,
         target_ns.nspname AS target_schema,
         target_table.relname AS target_table,
         CASE con.confdeltype
           WHEN 'a' THEN 'NO ACTION'
           WHEN 'r' THEN 'RESTRICT'
           WHEN 'c' THEN 'CASCADE'
           WHEN 'n' THEN 'SET NULL'
           WHEN 'd' THEN 'SET DEFAULT'
           ELSE NULL
         END AS delete_action,
         CASE con.confupdtype
           WHEN 'a' THEN 'NO ACTION'
           WHEN 'r' THEN 'RESTRICT'
           WHEN 'c' THEN 'CASCADE'
           WHEN 'n' THEN 'SET NULL'
           WHEN 'd' THEN 'SET DEFAULT'
           ELSE NULL
         END AS update_action
       FROM pg_constraint con
       JOIN pg_class source_table ON source_table.oid = con.conrelid
       JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
       LEFT JOIN pg_class target_table ON target_table.oid = con.confrelid
       LEFT JOIN pg_namespace target_ns ON target_ns.oid = target_table.relnamespace
       WHERE source_ns.nspname NOT IN ('pg_catalog', 'information_schema')
         AND source_ns.nspname NOT LIKE 'pg_%'
         AND source_table.relkind IN ('r', 'p')
         AND con.contype IN ('p', 'u', 'x', 'c', 'f')
       ORDER BY source_ns.nspname, source_table.relname, con.conname
```
```json
{
  "command": "SELECT",
  "rowCount": 286,
  "rows": [
    {
      "source_schema": "public",
      "source_table": "aplicaciones_credito",
      "constraint_name": "aplicaciones_credito_abono_movimiento_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (abono_movimiento_id) REFERENCES movimientos_credito(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "movimientos_credito",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_credito",
      "constraint_name": "aplicaciones_credito_abono_venta_uidx",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (abono_movimiento_id, venta_movimiento_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_credito",
      "constraint_name": "aplicaciones_credito_importe_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (importe > 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_credito",
      "constraint_name": "aplicaciones_credito_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_credito",
      "constraint_name": "aplicaciones_credito_venta_movimiento_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (venta_movimiento_id) REFERENCES movimientos_credito(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "movimientos_credito",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_pago_proveedor",
      "constraint_name": "aplicaciones_pago_proveedor_compra_proveedor_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (compra_proveedor_id) REFERENCES pagos_proveedor(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "pagos_proveedor",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_pago_proveedor",
      "constraint_name": "aplicaciones_pago_proveedor_importe_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (importe > 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_pago_proveedor",
      "constraint_name": "aplicaciones_pago_proveedor_pago_compra_uidx",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (pago_proveedor_id, compra_proveedor_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_pago_proveedor",
      "constraint_name": "aplicaciones_pago_proveedor_pago_proveedor_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (pago_proveedor_id) REFERENCES pagos_proveedor(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "pagos_proveedor",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "aplicaciones_pago_proveedor",
      "constraint_name": "aplicaciones_pago_proveedor_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditoria",
      "constraint_name": "auditoria_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditoria",
      "constraint_name": "auditoria_sitio_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (sitio_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria",
      "constraint_name": "auditoria_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_escaneos",
      "constraint_name": "auditoria_inventario_escaneos_auditoria_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "auditorias_inventario",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_escaneos",
      "constraint_name": "auditoria_inventario_escaneos_piso_real_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (piso_real_id) REFERENCES pisos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "pisos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_escaneos",
      "constraint_name": "auditoria_inventario_escaneos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (auditoria_id, serie)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_escaneos",
      "constraint_name": "auditoria_inventario_escaneos_rollo_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_escaneos",
      "constraint_name": "auditoria_inventario_escaneos_ubicacion_cierre_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_cierre_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_escaneos",
      "constraint_name": "auditoria_inventario_escaneos_usuario_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_folio",
      "constraint_name": "auditoria_inventario_folio_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (ubicacion_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_folio",
      "constraint_name": "auditoria_inventario_folio_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_participantes",
      "constraint_name": "auditoria_inventario_participantes_auditoria_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "auditorias_inventario",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_participantes",
      "constraint_name": "auditoria_inventario_participantes_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (auditoria_id, usuario_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_participantes",
      "constraint_name": "auditoria_inventario_participantes_usuario_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_snapshot",
      "constraint_name": "auditoria_inventario_snapshot_auditoria_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (auditoria_id) REFERENCES auditorias_inventario(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "auditorias_inventario",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_snapshot",
      "constraint_name": "auditoria_inventario_snapshot_piso_snapshot_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (piso_snapshot_id) REFERENCES pisos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "pisos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_snapshot",
      "constraint_name": "auditoria_inventario_snapshot_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (auditoria_id, serie)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_snapshot",
      "constraint_name": "auditoria_inventario_snapshot_rollo_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditoria_inventario_snapshot",
      "constraint_name": "auditoria_inventario_snapshot_ubicacion_snapshot_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_snapshot_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_cancelada_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cancelada_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_cerrada_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cerrada_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_confirmada_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (confirmada_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_creada_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (creada_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_estado_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (estado = ANY (ARRAY['ABIERTA'::text, 'CERRADA'::text, 'CANCELADA'::text, 'CONFIRMADA'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "auditorias_inventario",
      "constraint_name": "auditorias_inventario_ubicacion_id_folio_key",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (ubicacion_id, folio)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "autorizaciones_nota",
      "constraint_name": "autorizaciones_nota_movimiento_credito_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (movimiento_credito_id) REFERENCES movimientos_credito(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "movimientos_credito",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "autorizaciones_nota",
      "constraint_name": "autorizaciones_nota_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "autorizaciones_nota",
      "constraint_name": "autorizaciones_nota_sesion_caja_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "sesiones_caja",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "autorizaciones_nota",
      "constraint_name": "autorizaciones_nota_ticket_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "autorizaciones_nota",
      "constraint_name": "autorizaciones_nota_ticket_id_key",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (ticket_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "autorizaciones_nota",
      "constraint_name": "autorizaciones_nota_usuario_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "camionetas",
      "constraint_name": "camionetas_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "camionetas",
      "constraint_name": "camionetas_tipo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = ANY (ARRAY['PROPIA'::text, 'CONTRATADA'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "choferes",
      "constraint_name": "choferes_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_cliente_id_clientes_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cliente_id) REFERENCES clientes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "clientes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_lado_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (lado = ANY (ARRAY['FRENTE'::text, 'REVERSO'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_public_id_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (public_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_ruta_archivo_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (ruta_archivo)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_subido_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (subido_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_tamano_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cliente_documentos",
      "constraint_name": "cliente_documentos_tipo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = 'INE'::text)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "clientes",
      "constraint_name": "clientes_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedor_lineas",
      "constraint_name": "contenedor_lineas_cantidad_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (cantidad_esperada > 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedor_lineas",
      "constraint_name": "contenedor_lineas_contenedor_id_contenedores_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (contenedor_id) REFERENCES contenedores(id) ON DELETE CASCADE",
      "validated": true,
      "target_schema": "public",
      "target_table": "contenedores",
      "delete_action": "CASCADE",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "contenedor_lineas",
      "constraint_name": "contenedor_lineas_contenedor_producto_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (contenedor_id, producto_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedor_lineas",
      "constraint_name": "contenedor_lineas_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedor_lineas",
      "constraint_name": "contenedor_lineas_producto_id_productos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "contenedor_lineas",
      "constraint_name": "contenedor_lineas_rollos_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (rollos_esperados IS NULL OR rollos_esperados > 0)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_cancelacion_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (estado <> 'CANCELADO'::text OR char_length(motivo_cancelacion) >= 10)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_entrada_id_entradas_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (entrada_id) REFERENCES entradas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "entradas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_entrada_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (entrada_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_estado_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (estado = ANY (ARRAY['EN_TRANSITO'::text, 'RECIBIDO'::text, 'CANCELADO'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_folio_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (folio)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_proveedor_id_proveedores_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "proveedores",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_recepcion_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (estado <> 'RECIBIDO'::text OR entrada_id IS NOT NULL AND fecha_real_llegada IS NOT NULL)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_sitio_destino_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (sitio_destino_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "contenedores",
      "constraint_name": "contenedores_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_actor_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (actor_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = 'CONFIRMACION'::text AND estado = 'CONFIRMADA'::text OR tipo = 'DIFERENCIA'::text)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_check1",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = 'DIFERENCIA'::text AND monto > 0::numeric AND char_length(descripcion) >= 20 AND direccion IS NOT NULL OR tipo = 'CONFIRMACION'::text)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_direccion_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (direccion = ANY (ARRAY['MAS'::text, 'MENOS'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_estado_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (estado = ANY (ARRAY['CONFIRMADA'::text, 'PENDIENTE'::text, 'RESUELTA'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_resuelto_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (resuelto_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_tipo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = ANY (ARRAY['CONFIRMACION'::text, 'DIFERENCIA'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "cuadre_fiscal_registros",
      "constraint_name": "cuadre_fiscal_registros_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "entrada_folio",
      "constraint_name": "entrada_folio_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (ubicacion_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "entrada_folio",
      "constraint_name": "entrada_folio_ubicacion_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "entradas",
      "constraint_name": "entradas_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "entradas",
      "constraint_name": "entradas_proveedor_id_proveedores_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "proveedores",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "entradas",
      "constraint_name": "entradas_ubicacion_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "entradas",
      "constraint_name": "entradas_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "entradas",
      "constraint_name": "entradas_uuid_cliente_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (uuid_cliente)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "equipos",
      "constraint_name": "equipos_actualizado_por_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (actualizado_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "equipos",
      "constraint_name": "equipos_creado_por_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (creado_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "equipos",
      "constraint_name": "equipos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "equipos",
      "constraint_name": "equipos_tipo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = ANY (ARRAY['COMPUTADORA_POS'::text, 'IMPRESORA_ENTRADAS'::text, 'IMPRESORA_SALIDAS_NOTAS'::text, 'IMPRESORA_ETIQUETAS'::text, 'IMPRESORA_TICKETS'::text, 'PISTOLA_ESCANER'::text, 'SMARTPHONE_ESCANER'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "equipos",
      "constraint_name": "equipos_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "equipos_checklist",
      "constraint_name": "equipos_checklist_checked_por_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (checked_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "equipos_checklist",
      "constraint_name": "equipos_checklist_equipo_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE",
      "validated": true,
      "target_schema": "public",
      "target_table": "equipos",
      "delete_action": "CASCADE",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "equipos_checklist",
      "constraint_name": "equipos_checklist_item_key_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (item_key = ANY (ARRAY['PAPEL_NAVEGADOR_80MM'::text, 'MARGENES_NINGUNO'::text, 'ESCALA_REAL'::text, 'IMPRESORA_PREDETERMINADA'::text, 'ENTRADA_REAL'::text, 'PAPEL_NAVEGADOR_CARTA'::text, 'SALIDA_REAL'::text, 'NOTA_REAL'::text, 'PAPEL_NAVEGADOR_A5'::text, 'PAPEL_COLOR_SITIO_BANDEJA'::text, 'ETIQUETA_REAL'::text, 'MEDIDA_100X70'::text, 'TICKET_REAL'::text, 'PAPEL_80MM'::text, 'TECLADO_ESPANOL'::text, 'QR_ROLLO'::text, 'SESION_CAMARA'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "existencias",
      "constraint_name": "existencias_producto_id_productos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "existencias",
      "constraint_name": "existencias_producto_id_ubicacion_id_pk",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (producto_id, ubicacion_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "existencias",
      "constraint_name": "existencias_ubicacion_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_producto_id_productos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_revisado_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (revisado_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_rollo_id_rollos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_salida_id_salidas_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (salida_id) REFERENCES salidas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "salidas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_ubicacion_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos",
      "constraint_name": "movimientos_uuid_cliente_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (uuid_cliente)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_autorizado_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (autorizado_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_cliente_id_clientes_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cliente_id) REFERENCES clientes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "clientes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_cuenta_destino_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (cuenta_destino IS NULL OR (cuenta_destino = ANY (ARRAY['CAJA_FISICA'::text, 'CUENTA_FISCAL'::text, 'CUENTA_NO_FISCAL'::text])))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_importe_tipo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = 'VENTA_CREDITO'::tipo_movimiento_credito AND importe > 0::numeric OR tipo = 'ABONO'::tipo_movimiento_credito AND importe < 0::numeric OR tipo = 'REVERSO'::tipo_movimiento_credito AND importe <> 0::numeric OR tipo = 'AJUSTE'::tipo_movimiento_credito AND importe <> 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_movimiento_origen_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (movimiento_origen_id) REFERENCES movimientos_credito(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "movimientos_credito",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_plazo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (dias_plazo IS NULL AND fecha_vencimiento IS NULL OR (dias_plazo = ANY (ARRAY[7, 15, 30, 60])) AND fecha_vencimiento IS NOT NULL)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_ticket_id_tickets_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "movimientos_credito",
      "constraint_name": "movimientos_credito_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_credito",
      "constraint_name": "notificaciones_credito_cajero_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cajero_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_credito",
      "constraint_name": "notificaciones_credito_cliente_id_clientes_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cliente_id) REFERENCES clientes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "clientes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_credito",
      "constraint_name": "notificaciones_credito_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_credito",
      "constraint_name": "notificaciones_credito_ticket_id_tickets_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_credito",
      "constraint_name": "notificaciones_credito_ticket_id_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (ticket_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_credito",
      "constraint_name": "notificaciones_credito_tienda_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (tienda_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_sistema",
      "constraint_name": "notificaciones_sistema_destinatario_usuario_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (destinatario_usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "notificaciones_sistema",
      "constraint_name": "notificaciones_sistema_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "pagos_proveedor",
      "constraint_name": "pagos_proveedor_entrada_id_entradas_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (entrada_id) REFERENCES entradas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "entradas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "pagos_proveedor",
      "constraint_name": "pagos_proveedor_movimiento_origen_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (movimiento_origen_id) REFERENCES pagos_proveedor(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "pagos_proveedor",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "pagos_proveedor",
      "constraint_name": "pagos_proveedor_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "pagos_proveedor",
      "constraint_name": "pagos_proveedor_proveedor_id_proveedores_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "proveedores",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "pagos_proveedor",
      "constraint_name": "pagos_proveedor_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "permisos_rol",
      "constraint_name": "permisos_rol_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "permisos_rol",
      "constraint_name": "permisos_rol_rol_modulo_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (rol, modulo)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "permisos_rol",
      "constraint_name": "permisos_rol_updated_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (updated_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "permisos_ubicacion",
      "constraint_name": "permisos_ubicacion_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "permisos_ubicacion",
      "constraint_name": "permisos_ubicacion_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "permisos_ubicacion",
      "constraint_name": "permisos_ubicacion_ubicacion_rol_modulo_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (ubicacion_id, rol, modulo)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "permisos_ubicacion",
      "constraint_name": "permisos_ubicacion_updated_por_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (updated_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "permisos_usuario",
      "constraint_name": "permisos_usuario_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "permisos_usuario",
      "constraint_name": "permisos_usuario_updated_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (updated_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "permisos_usuario",
      "constraint_name": "permisos_usuario_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "permisos_usuario",
      "constraint_name": "permisos_usuario_usuario_modulo_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (usuario_id, modulo)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "pisos",
      "constraint_name": "pisos_nombre_no_vacio",
      "constraint_type": "c",
      "constraint_definition": "CHECK (length(btrim(nombre)) > 0)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "pisos",
      "constraint_name": "pisos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "pisos",
      "constraint_name": "pisos_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "precio_historial",
      "constraint_name": "precio_historial_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "precio_historial",
      "constraint_name": "precio_historial_producto_id_productos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "precio_historial",
      "constraint_name": "precio_historial_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "productos",
      "constraint_name": "productos_color_hex_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-F]{6}$'::text)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "productos",
      "constraint_name": "productos_kilo_no_venta_metro_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK ((unidad <> ALL (ARRAY['KILO'::unidad_producto, 'PIEZA'::unidad_producto])) OR se_vende_por_metro = false)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "productos",
      "constraint_name": "productos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "productos",
      "constraint_name": "productos_sku_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (sku)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "productos",
      "constraint_name": "productos_tela_color_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (tela, color)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "proveedores",
      "constraint_name": "proveedores_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "reimpresiones_etiqueta",
      "constraint_name": "reimpresiones_etiqueta_autorizado_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (autorizado_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "reimpresiones_etiqueta",
      "constraint_name": "reimpresiones_etiqueta_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "reimpresiones_etiqueta",
      "constraint_name": "reimpresiones_etiqueta_rollo_id_rollos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "reimpresiones_etiqueta",
      "constraint_name": "reimpresiones_etiqueta_sitio_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (sitio_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "reimpresiones_etiqueta",
      "constraint_name": "reimpresiones_etiqueta_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "revisiones_etiqueta",
      "constraint_name": "revisiones_etiqueta_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "revisiones_etiqueta",
      "constraint_name": "revisiones_etiqueta_reimpresion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (reimpresion_id) REFERENCES reimpresiones_etiqueta(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "reimpresiones_etiqueta",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "revisiones_etiqueta",
      "constraint_name": "revisiones_etiqueta_rollo_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "revisiones_etiqueta",
      "constraint_name": "revisiones_etiqueta_usuario_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "rollos",
      "constraint_name": "rollos_piso_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (piso_id) REFERENCES pisos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "pisos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "rollos",
      "constraint_name": "rollos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "rollos",
      "constraint_name": "rollos_producto_id_productos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "rollos",
      "constraint_name": "rollos_proveedor_id_proveedores_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "proveedores",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "rollos",
      "constraint_name": "rollos_serie_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (serie)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "rollos",
      "constraint_name": "rollos_ubicacion_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salida_folio",
      "constraint_name": "salida_folio_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (ubicacion_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salida_folio",
      "constraint_name": "salida_folio_ubicacion_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salida_lineas",
      "constraint_name": "salida_lineas_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salida_lineas",
      "constraint_name": "salida_lineas_producto_id_productos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salida_lineas",
      "constraint_name": "salida_lineas_salida_id_salidas_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (salida_id) REFERENCES salidas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "salidas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salida_rollos",
      "constraint_name": "salida_rollos_linea_id_salida_lineas_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (linea_id) REFERENCES salida_lineas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "salida_lineas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salida_rollos",
      "constraint_name": "salida_rollos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salida_rollos",
      "constraint_name": "salida_rollos_rollo_id_rollos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salida_rollos",
      "constraint_name": "salida_rollos_salida_id_salidas_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (salida_id) REFERENCES salidas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "salidas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_autorizado_por_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (autorizado_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_cliente_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cliente_id) REFERENCES clientes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "clientes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_destino_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (destino_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_modalidad_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (modalidad = ANY (ARRAY['TRASLADO'::text, 'MOSTRADOR'::text, 'VENTA_CLIENTE'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_origen_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (origen_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_ticket_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_acepta_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_acepta_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_cancela_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_cancela_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_cierra_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_cierra_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_entrega_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_entrega_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_envia_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_envia_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_prepara_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_prepara_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_recibe_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_recibe_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_usuario_solicita_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_solicita_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_uuid_cliente_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (uuid_cliente)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas",
      "constraint_name": "salidas_venta_cliente_shape_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (modalidad <> 'VENTA_CLIENTE'::text OR cliente_id IS NOT NULL AND destino_id IS NULL)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas_dinero_caja",
      "constraint_name": "salidas_dinero_caja_creado_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas_dinero_caja",
      "constraint_name": "salidas_dinero_caja_cuenta_origen_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (cuenta_origen = ANY (ARRAY['CAJA_FISICA'::text, 'CUENTA_NO_FISCAL'::text, 'CUENTA_FISCAL'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas_dinero_caja",
      "constraint_name": "salidas_dinero_caja_monto_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (monto > 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas_dinero_caja",
      "constraint_name": "salidas_dinero_caja_motivo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (char_length(TRIM(BOTH FROM motivo)) >= 1 AND char_length(TRIM(BOTH FROM motivo)) <= 500)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas_dinero_caja",
      "constraint_name": "salidas_dinero_caja_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "salidas_dinero_caja",
      "constraint_name": "salidas_dinero_caja_proveedor_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "proveedores",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "salidas_dinero_caja",
      "constraint_name": "salidas_dinero_caja_sesion_caja_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "sesiones_caja",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "series_consecutivo",
      "constraint_name": "series_consecutivo_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "sesiones",
      "constraint_name": "sesiones_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "sesiones",
      "constraint_name": "sesiones_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "sesiones_caja",
      "constraint_name": "sesiones_caja_cerrada_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cerrada_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "sesiones_caja",
      "constraint_name": "sesiones_caja_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "sesiones_caja",
      "constraint_name": "sesiones_caja_ubicacion_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "sesiones_caja",
      "constraint_name": "sesiones_caja_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "sesiones_caja_dias",
      "constraint_name": "sesiones_caja_dias_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (ubicacion_id, fecha_operativa)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "sesiones_caja_dias",
      "constraint_name": "sesiones_caja_dias_sesion_caja_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "sesiones_caja",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "sesiones_caja_dias",
      "constraint_name": "sesiones_caja_dias_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_autorizador_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (autorizador_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_importe_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (importe > 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_motivo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (char_length(TRIM(BOTH FROM motivo)) >= 10)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_motivo_rechazo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (motivo_rechazo IS NULL OR char_length(TRIM(BOTH FROM motivo_rechazo)) >= 10)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_resolved_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (estado = 'PENDIENTE'::estado_solicitud_pago_dirigido AND autorizador_id IS NULL AND resuelta_at IS NULL OR estado = 'APROBADA'::estado_solicitud_pago_dirigido AND autorizador_id IS NOT NULL AND movimiento_id IS NOT NULL AND resuelta_at IS NOT NULL OR estado = 'RECHAZADA'::estado_solicitud_pago_dirigido AND autorizador_id IS NOT NULL AND motivo_rechazo IS NOT NULL AND resuelta_at IS NOT NULL)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_solicitante_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (solicitante_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "solicitudes_pago_dirigido",
      "constraint_name": "solicitudes_pago_dirigido_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_causa_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (causa = ANY (ARRAY['MOVIMIENTO'::text, 'CONFIGURACION'::text, 'SNAPSHOT'::text]))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_diferencia_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (diferencia >= 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_existencia_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (existencia >= 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_minimo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (minimo >= 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_movimiento_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (movimiento_id) REFERENCES movimientos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "movimientos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_producto_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_episodios",
      "constraint_name": "stock_minimo_episodios_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_sitios",
      "constraint_name": "stock_minimo_sitios_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (ubicacion_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_sitios",
      "constraint_name": "stock_minimo_sitios_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimo_sitios",
      "constraint_name": "stock_minimo_sitios_updated_by_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (updated_by) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimos",
      "constraint_name": "stock_minimos_cantidad_nonnegative_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (cantidad >= 0::numeric)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimos",
      "constraint_name": "stock_minimos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimos",
      "constraint_name": "stock_minimos_producto_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimos",
      "constraint_name": "stock_minimos_producto_ubicacion_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (producto_id, ubicacion_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimos",
      "constraint_name": "stock_minimos_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "stock_minimos",
      "constraint_name": "stock_minimos_updated_by_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (updated_by) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_folio",
      "constraint_name": "ticket_folio_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_cantidad_milesimas_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (cantidad_milesimas > 0)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_costo_centavos_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (costo_centavos IS NULL OR costo_centavos >= 0)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_entrada_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (entrada_id) REFERENCES entradas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "entradas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_ingreso_centavos_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (ingreso_centavos >= 0)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_movimiento_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (movimiento_id) REFERENCES movimientos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "movimientos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_proveedor_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "proveedores",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_reversa_de_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (reversa_de_id) REFERENCES ticket_linea_consumos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ticket_linea_consumos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_rollo_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_ticket_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_ticket_linea_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_linea_id) REFERENCES ticket_lineas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ticket_lineas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_linea_consumos",
      "constraint_name": "ticket_linea_consumos_tipo_reversa_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = 'CONSUMO'::text AND reversa_de_id IS NULL OR tipo = 'REVERSA'::text AND reversa_de_id IS NOT NULL)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_lineas",
      "constraint_name": "ticket_lineas_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_lineas",
      "constraint_name": "ticket_lineas_producto_id_productos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (producto_id) REFERENCES productos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "productos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_lineas",
      "constraint_name": "ticket_lineas_rollo_id_rollos_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (rollo_id) REFERENCES rollos(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "rollos",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_lineas",
      "constraint_name": "ticket_lineas_ticket_id_tickets_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_lineas",
      "constraint_name": "ticket_lineas_tipo_rollo_costos_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (tipo = 'NORMAL'::tipo_ticket AND rollo_id IS NOT NULL AND costo_unitario_congelado IS NOT NULL AND costo_total_congelado IS NOT NULL AND costo_referencia_estado IS NULL OR tipo = 'METREADO'::tipo_ticket AND rollo_id IS NULL AND (costo_unitario_congelado IS NULL AND costo_total_congelado IS NULL AND (costo_referencia_estado IS NULL OR costo_referencia_estado = 'NO_COST'::text) OR costo_unitario_congelado IS NOT NULL AND costo_total_congelado IS NOT NULL AND (costo_referencia_estado IS NULL OR (costo_referencia_estado = ANY (ARRAY['AVERAGE_12_MONTHS'::text, 'STALE_LAST_KNOWN'::text])))))",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_pagos",
      "constraint_name": "ticket_pagos_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ticket_pagos",
      "constraint_name": "ticket_pagos_ticket_id_tickets_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "ticket_pagos",
      "constraint_name": "ticket_pagos_usuario_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_autorizado_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (autorizado_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_cancelado_por_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cancelado_por) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_cliente_id_clientes_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (cliente_id) REFERENCES clientes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "clientes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_credito_plazo_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (credito = false AND dias_plazo IS NULL AND fecha_vencimiento IS NULL OR credito = true AND (dias_plazo = ANY (ARRAY[7, 15, 30, 60])) AND fecha_vencimiento IS NOT NULL)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_folio_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (folio)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_sesion_caja_id_sesiones_caja_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (sesion_caja_id) REFERENCES sesiones_caja(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "sesiones_caja",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_ubicacion_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_usuario_caja_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_caja_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_usuario_terminal_id_usuarios_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (usuario_terminal_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "tickets",
      "constraint_name": "tickets_uuid_cliente_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (uuid_cliente)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ubicaciones",
      "constraint_name": "ubicaciones_iniciales_formato_check",
      "constraint_type": "c",
      "constraint_definition": "CHECK (iniciales ~ '^[A-Z]{2,3}$'::text)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ubicaciones",
      "constraint_name": "ubicaciones_nombre_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (nombre)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "ubicaciones",
      "constraint_name": "ubicaciones_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "usuarios",
      "constraint_name": "usuarios_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "usuarios",
      "constraint_name": "usuarios_ubicacion_id_ubicaciones_id_fk",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "usuarios",
      "constraint_name": "usuarios_usuario_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (usuario)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "viaje_folio",
      "constraint_name": "viaje_folio_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (ubicacion_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "viaje_folio",
      "constraint_name": "viaje_folio_ubicacion_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viaje_salidas",
      "constraint_name": "viaje_salidas_salida_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (salida_id) REFERENCES salidas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "salidas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viaje_salidas",
      "constraint_name": "viaje_salidas_salida_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (salida_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "viaje_salidas",
      "constraint_name": "viaje_salidas_viaje_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (viaje_id) REFERENCES viajes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "viajes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viaje_tickets",
      "constraint_name": "viaje_tickets_ticket_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (ticket_id) REFERENCES tickets(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "tickets",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viaje_tickets",
      "constraint_name": "viaje_tickets_ticket_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (ticket_id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "viaje_tickets",
      "constraint_name": "viaje_tickets_viaje_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (viaje_id) REFERENCES viajes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "viajes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viajes",
      "constraint_name": "viajes_camioneta_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (camioneta_id) REFERENCES camionetas(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "camionetas",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viajes",
      "constraint_name": "viajes_chofer_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (chofer_id) REFERENCES choferes(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "choferes",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viajes",
      "constraint_name": "viajes_creado_por_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "usuarios",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viajes",
      "constraint_name": "viajes_origen_folio_unique",
      "constraint_type": "u",
      "constraint_definition": "UNIQUE (origen_id, folio)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    },
    {
      "source_schema": "public",
      "source_table": "viajes",
      "constraint_name": "viajes_origen_id_fkey",
      "constraint_type": "f",
      "constraint_definition": "FOREIGN KEY (origen_id) REFERENCES ubicaciones(id)",
      "validated": true,
      "target_schema": "public",
      "target_table": "ubicaciones",
      "delete_action": "NO ACTION",
      "update_action": "NO ACTION"
    },
    {
      "source_schema": "public",
      "source_table": "viajes",
      "constraint_name": "viajes_pkey",
      "constraint_type": "p",
      "constraint_definition": "PRIMARY KEY (id)",
      "validated": true,
      "target_schema": null,
      "target_table": null,
      "delete_action": null,
      "update_action": null
    }
  ]
}
```

### non_internal_triggers_and_function_source

```sql
SELECT
         n.nspname AS schema_name,
         c.relname AS table_name,
         t.tgname AS trigger_name,
         t.tgenabled::text AS enabled_state,
         t.tgtype::int AS trigger_type_bits,
         ((t.tgtype::int & 8) <> 0) AS fires_on_delete,
         ((t.tgtype::int & 32) <> 0) AS fires_on_truncate,
         pg_get_triggerdef(t.oid, true) AS trigger_definition,
         pn.nspname AS function_schema,
         p.proname AS function_name,
         l.lanname AS function_language,
         pg_get_functiondef(p.oid) AS function_source
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_namespace pn ON pn.oid = p.pronamespace
       JOIN pg_language l ON l.oid = p.prolang
       WHERE NOT t.tgisinternal
         AND n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND n.nspname NOT LIKE 'pg_%'
         AND c.relkind IN ('r', 'p')
       ORDER BY n.nspname, c.relname, t.tgname
```
```json
{
  "command": "SELECT",
  "rowCount": 14,
  "rows": [
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "trigger_name": "aplicaciones_credito_inmutables",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER aplicaciones_credito_inmutables BEFORE DELETE OR UPDATE ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation()",
      "function_schema": "public",
      "function_name": "prevent_financial_record_mutation",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.prevent_financial_record_mutation()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      BEGIN\n        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';\n      END $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_credito",
      "trigger_name": "aplicaciones_credito_validas",
      "enabled_state": "O",
      "trigger_type_bits": 7,
      "fires_on_delete": false,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER aplicaciones_credito_validas BEFORE INSERT ON aplicaciones_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_application()",
      "function_schema": "public",
      "function_name": "validate_credit_application",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.validate_credit_application()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n       DECLARE abono movimientos_credito%ROWTYPE;\n       DECLARE venta movimientos_credito%ROWTYPE;\n       DECLARE cliente_bloqueo integer;\n       BEGIN\n         SELECT cliente_id INTO cliente_bloqueo\n           FROM movimientos_credito WHERE id = NEW.abono_movimiento_id;\n         IF cliente_bloqueo IS NOT NULL THEN\n           PERFORM 1 FROM clientes\n             WHERE id = cliente_bloqueo FOR UPDATE;\n         END IF;\n         SELECT * INTO abono FROM movimientos_credito\n           WHERE id = NEW.abono_movimiento_id FOR UPDATE;\n         SELECT * INTO venta FROM movimientos_credito\n           WHERE id = NEW.venta_movimiento_id FOR UPDATE;\n         IF abono.id IS NULL OR venta.id IS NULL\n           OR abono.tipo <> 'ABONO' OR venta.tipo <> 'VENTA_CREDITO'\n           OR abono.cliente_id IS DISTINCT FROM venta.cliente_id THEN\n           RAISE EXCEPTION 'Una aplicación debe enlazar un ABONO y una VENTA_CREDITO del mismo cliente.';\n         END IF;\n         IF EXISTS (\n           SELECT 1 FROM movimientos_credito r\n           WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = abono.id\n         ) THEN\n           RAISE EXCEPTION 'No se puede aplicar un ABONO revertido.';\n         END IF;\n         IF NEW.importe <= 0\n           OR NEW.importe > -abono.importe - COALESCE((\n             SELECT SUM(a.importe) FROM aplicaciones_credito a\n             WHERE a.abono_movimiento_id = abono.id\n               AND NOT EXISTS (\n                 SELECT 1 FROM movimientos_credito r\n                 WHERE r.tipo = 'REVERSO'\n                   AND r.movimiento_origen_id = a.abono_movimiento_id\n               )\n           ), 0) THEN\n           RAISE EXCEPTION 'La aplicación de crédito excede el saldo disponible.';\n         END IF;\n         RETURN NEW;\n       END $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "trigger_name": "aplicaciones_pago_proveedor_append_only",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER aplicaciones_pago_proveedor_append_only BEFORE DELETE OR UPDATE ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION proteger_aplicaciones_pago_proveedor()",
      "function_schema": "public",
      "function_name": "proteger_aplicaciones_pago_proveedor",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.proteger_aplicaciones_pago_proveedor()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      BEGIN\n        RAISE EXCEPTION 'aplicaciones_pago_proveedor es append-only';\n      END;\n      $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "aplicaciones_pago_proveedor",
      "trigger_name": "aplicaciones_pago_proveedor_validar_insert",
      "enabled_state": "O",
      "trigger_type_bits": 7,
      "fires_on_delete": false,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER aplicaciones_pago_proveedor_validar_insert BEFORE INSERT ON aplicaciones_pago_proveedor FOR EACH ROW EXECUTE FUNCTION validar_aplicacion_pago_proveedor()",
      "function_schema": "public",
      "function_name": "validar_aplicacion_pago_proveedor",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.validar_aplicacion_pago_proveedor()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      DECLARE pago pagos_proveedor%ROWTYPE; compra pagos_proveedor%ROWTYPE;\n      BEGIN\n        SELECT * INTO pago FROM pagos_proveedor\n          WHERE id = NEW.pago_proveedor_id FOR UPDATE;\n        SELECT * INTO compra FROM pagos_proveedor\n          WHERE id = NEW.compra_proveedor_id FOR UPDATE;\n        IF pago.id IS NULL OR compra.id IS NULL OR pago.tipo <> 'PAGO'\n          OR compra.tipo <> 'COMPRA' OR pago.proveedor_id <> compra.proveedor_id THEN\n          RAISE EXCEPTION 'Aplicación proveedor inválida: pago PAGO y compra COMPRA del mismo proveedor requeridos';\n        END IF;\n        IF EXISTS (\n          SELECT 1 FROM pagos_proveedor r\n          WHERE r.tipo = 'REVERSO' AND r.movimiento_origen_id = pago.id\n        ) THEN\n          RAISE EXCEPTION 'No se puede aplicar un pago proveedor revertido';\n        END IF;\n        IF NEW.importe <= 0\n          OR NEW.importe > -pago.importe - COALESCE((\n            SELECT SUM(a.importe)\n            FROM aplicaciones_pago_proveedor a\n            WHERE a.pago_proveedor_id = pago.id\n              AND NOT EXISTS (\n                SELECT 1 FROM pagos_proveedor r\n                WHERE r.tipo = 'REVERSO'\n                  AND r.movimiento_origen_id = a.pago_proveedor_id\n              )\n          ), 0)\n          OR NEW.importe > compra.importe - COALESCE((\n            SELECT SUM(a.importe)\n            FROM aplicaciones_pago_proveedor a\n            WHERE a.compra_proveedor_id = compra.id\n              AND NOT EXISTS (\n                SELECT 1 FROM pagos_proveedor r\n                WHERE r.tipo = 'REVERSO'\n                  AND r.movimiento_origen_id = a.pago_proveedor_id\n              )\n          ), 0) THEN\n          RAISE EXCEPTION 'Aplicación proveedor excede el saldo disponible';\n        END IF;\n        RETURN NEW;\n      END;\n      $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "trigger_name": "auditoria_append_only",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER auditoria_append_only BEFORE DELETE OR UPDATE ON auditoria FOR EACH ROW EXECUTE FUNCTION proteger_auditoria_append_only()",
      "function_schema": "public",
      "function_name": "proteger_auditoria_append_only",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.proteger_auditoria_append_only()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n       BEGIN\n         RAISE EXCEPTION 'auditoria es append-only';\n       END;\n       $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "auditoria",
      "trigger_name": "auditoria_enriquecer_insert",
      "enabled_state": "O",
      "trigger_type_bits": 7,
      "fires_on_delete": false,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER auditoria_enriquecer_insert BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION enriquecer_auditoria()",
      "function_schema": "public",
      "function_name": "enriquecer_auditoria",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.enriquecer_auditoria()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      DECLARE\n        usuario_nombre text;\n        usuario_rol text;\n        usuario_sitio integer;\n        sitio_nombre text;\n      BEGIN\n        IF NEW.usuario_id IS NOT NULL THEN\n          SELECT usuario, rol::text, ubicacion_id\n            INTO usuario_nombre, usuario_rol, usuario_sitio\n            FROM usuarios WHERE id = NEW.usuario_id;\n          NEW.usuario_snapshot := COALESCE(NEW.usuario_snapshot, usuario_nombre);\n          NEW.rol_snapshot := COALESCE(NEW.rol_snapshot, usuario_rol);\n          -- Catalog records have no affected operational site. Keep their\n          -- explicit null instead of inheriting the editor's assigned site.\n          IF NEW.entidad NOT IN ('camionetas', 'choferes') THEN\n            NEW.sitio_id := COALESCE(NEW.sitio_id, usuario_sitio);\n          END IF;\n        END IF;\n        IF NEW.sitio_id IS NOT NULL AND NEW.sitio_snapshot IS NULL THEN\n          SELECT nombre INTO sitio_nombre FROM ubicaciones WHERE id = NEW.sitio_id;\n          NEW.sitio_snapshot := sitio_nombre;\n        END IF;\n        NEW.modulo := COALESCE(NEW.modulo,\n          CASE\n            WHEN NEW.accion LIKE 'LOGIN_%' OR NEW.accion = 'LOGOUT' OR NEW.entidad = 'sesiones' THEN 'auth'\n            WHEN NEW.entidad IN ('usuarios', 'permisos_usuario', 'permisos_rol') THEN 'usuarios'\n            WHEN NEW.entidad IN ('ubicaciones') THEN 'ubicaciones'\n            WHEN NEW.entidad IN ('productos', 'precios_producto') THEN 'productos'\n            WHEN NEW.entidad IN ('proveedores', 'compras', 'pagos_proveedor') THEN 'proveedores'\n            WHEN NEW.entidad LIKE 'cliente%' OR NEW.entidad = 'movimientos_credito' THEN 'clientes'\n            WHEN NEW.entidad IN ('tickets', 'ticket_pagos') THEN 'pos'\n            WHEN NEW.entidad = 'sesiones_caja' THEN 'caja'\n            WHEN NEW.entidad IN ('salidas', 'salida_rollos') THEN 'salidas'\n            WHEN NEW.entidad IN ('reimpresiones_etiqueta') THEN 'etiquetas'\n            WHEN NEW.entidad IN ('rollos', 'entradas', 'movimientos', 'existencias') THEN 'inventario'\n            WHEN NEW.entidad LIKE 'contenedor%' THEN 'contenedores'\n            ELSE NEW.entidad\n          END);\n        RETURN NEW;\n      END;\n      $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "trigger_name": "movimientos_credito_inmutables",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER movimientos_credito_inmutables BEFORE DELETE OR UPDATE ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation()",
      "function_schema": "public",
      "function_name": "prevent_financial_record_mutation",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.prevent_financial_record_mutation()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      BEGIN\n        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';\n      END $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "movimientos_credito",
      "trigger_name": "movimientos_credito_reversos_validos",
      "enabled_state": "O",
      "trigger_type_bits": 7,
      "fires_on_delete": false,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER movimientos_credito_reversos_validos BEFORE INSERT ON movimientos_credito FOR EACH ROW EXECUTE FUNCTION validate_credit_reversal()",
      "function_schema": "public",
      "function_name": "validate_credit_reversal",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.validate_credit_reversal()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n       DECLARE origen movimientos_credito%ROWTYPE;\n       BEGIN\n         IF NEW.tipo <> 'REVERSO' THEN RETURN NEW; END IF;\n         IF NEW.movimiento_origen_id IS NULL THEN\n           RAISE EXCEPTION 'El reverso debe referenciar su movimiento de origen.';\n         END IF;\n          SELECT * INTO origen FROM movimientos_credito WHERE id=NEW.movimiento_origen_id;\n          IF NOT FOUND THEN\n            RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';\n          END IF;\n          IF origen.tipo = 'ABONO'\n            AND origen.cliente_id = NEW.cliente_id\n            AND origen.importe < 0\n            AND NEW.importe = -origen.importe THEN\n            RETURN NEW;\n          END IF;\n          IF origen.tipo = 'VENTA_CREDITO'\n            AND origen.cliente_id = NEW.cliente_id\n            AND origen.importe > 0\n            AND NEW.importe = -origen.importe\n            AND NEW.ticket_id IS NOT DISTINCT FROM origen.ticket_id THEN\n            RETURN NEW;\n          END IF;\n          RAISE EXCEPTION 'El reverso de crédito debe tener un origen compatible, del mismo cliente y por el importe exacto.';\n       END $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "pagos_proveedor",
      "trigger_name": "pagos_proveedor_inmutables",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER pagos_proveedor_inmutables BEFORE DELETE OR UPDATE ON pagos_proveedor FOR EACH ROW EXECUTE FUNCTION prevent_pago_proveedor_mutation()",
      "function_schema": "public",
      "function_name": "prevent_pago_proveedor_mutation",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.prevent_pago_proveedor_mutation()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n    BEGIN\n      RAISE EXCEPTION 'Los pagos a proveedor son inmutables; registre un reverso o ajuste.';\n    END $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "reimpresiones_etiqueta",
      "trigger_name": "reimpresiones_etiqueta_inmutable",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER reimpresiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON reimpresiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_reimpresion_etiqueta()",
      "function_schema": "public",
      "function_name": "bloquear_mutacion_reimpresion_etiqueta",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.bloquear_mutacion_reimpresion_etiqueta()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      BEGIN\n        IF current_setting('app.etiquetas_cleanup', true) = 'on' THEN\n          IF TG_OP = 'DELETE' THEN\n            RETURN OLD;\n          END IF;\n          RETURN NEW;\n        END IF;\n        RAISE EXCEPTION 'reimpresiones_etiqueta es un registro inmutable';\n      END;\n      $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "trigger_name": "revisiones_etiqueta_inmutable",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER revisiones_etiqueta_inmutable BEFORE DELETE OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION bloquear_mutacion_revision_etiqueta()",
      "function_schema": "public",
      "function_name": "bloquear_mutacion_revision_etiqueta",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.bloquear_mutacion_revision_etiqueta()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      BEGIN\n        RAISE EXCEPTION 'revisiones_etiqueta es un historial append-only';\n      END;\n      $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "revisiones_etiqueta",
      "trigger_name": "revisiones_etiqueta_reimpresion_fk_check",
      "enabled_state": "O",
      "trigger_type_bits": 23,
      "fires_on_delete": false,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER revisiones_etiqueta_reimpresion_fk_check BEFORE INSERT OR UPDATE ON revisiones_etiqueta FOR EACH ROW EXECUTE FUNCTION validar_revision_etiqueta_reimpresion()",
      "function_schema": "public",
      "function_name": "validar_revision_etiqueta_reimpresion",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.validar_revision_etiqueta_reimpresion()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      BEGIN\n        IF NOT EXISTS (\n          SELECT 1\n          FROM reimpresiones_etiqueta re\n          WHERE re.id = NEW.reimpresion_id\n            AND re.rollo_id = NEW.rollo_id\n        ) THEN\n          RAISE EXCEPTION 'La revisión no corresponde a la última reimpresión del rollo';\n        END IF;\n        RETURN NEW;\n      END;\n      $function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "ticket_linea_consumos",
      "trigger_name": "ticket_linea_consumos_append_only",
      "enabled_state": "A",
      "trigger_type_bits": 31,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER ticket_linea_consumos_append_only BEFORE INSERT OR DELETE OR UPDATE ON ticket_linea_consumos FOR EACH ROW EXECUTE FUNCTION ticket_linea_consumos_guard()",
      "function_schema": "public",
      "function_name": "ticket_linea_consumos_guard",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.ticket_linea_consumos_guard()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\nDECLARE\n  original ticket_linea_consumos%ROWTYPE;\n  movement movimientos%ROWTYPE;\n  reversal_quantity BIGINT;\n  reversal_revenue BIGINT;\n  reversal_cost BIGINT;\nBEGIN\n  IF TG_OP IN ('UPDATE', 'DELETE') THEN\n    RAISE EXCEPTION 'ticket_linea_consumos is append-only';\n  END IF;\n\n  IF NEW.movimiento_id IS NULL THEN\n    RAISE EXCEPTION 'ticket_linea_consumos requires a movement';\n  END IF;\n\n  IF NOT EXISTS (\n    SELECT 1\n      FROM ticket_lineas\n     WHERE id = NEW.ticket_linea_id\n       AND ticket_id = NEW.ticket_id\n  ) THEN\n    RAISE EXCEPTION 'allocation line does not belong to its ticket';\n  END IF;\n\n  IF NOT EXISTS (\n    SELECT 1\n      FROM rollos r\n      JOIN entradas e ON e.id = r.recepcion_id\n     WHERE r.id = NEW.rollo_id\n       AND r.recepcion_id = NEW.entrada_id\n       AND e.proveedor_id = NEW.proveedor_id\n  ) THEN\n    RAISE EXCEPTION 'allocation source does not match roll entry supplier';\n  END IF;\n\n  SELECT *\n    INTO movement\n    FROM movimientos\n   WHERE id = NEW.movimiento_id;\n  IF NOT FOUND OR movement.rollo_id <> NEW.rollo_id\n     OR movement.tipo NOT IN ('VENTA', 'CANCELACION')\n     OR movement.documento_id IS DISTINCT FROM NEW.ticket_id::text THEN\n    RAISE EXCEPTION 'allocation movement does not match its ticket and roll';\n  END IF;\n\n  IF NEW.tipo = 'CONSUMO' THEN\n    IF NEW.reversa_de_id IS NOT NULL\n       OR movement.tipo <> 'VENTA' THEN\n      RAISE EXCEPTION 'CONSUMO must reference a VENTA movement and no reversal';\n    END IF;\n    RETURN NEW;\n  END IF;\n\n  IF NEW.tipo <> 'REVERSA' OR NEW.reversa_de_id IS NULL\n     OR movement.tipo <> 'CANCELACION' THEN\n    RAISE EXCEPTION 'REVERSA must reference a cancellation movement and source';\n  END IF;\n\n  SELECT *\n    INTO original\n    FROM ticket_linea_consumos\n   WHERE id = NEW.reversa_de_id\n     AND tipo = 'CONSUMO'\n   FOR UPDATE;\n  IF NOT FOUND\n     OR original.ticket_id <> NEW.ticket_id\n     OR original.ticket_linea_id <> NEW.ticket_linea_id\n     OR original.rollo_id <> NEW.rollo_id\n     OR original.entrada_id <> NEW.entrada_id\n     OR original.proveedor_id <> NEW.proveedor_id\n     OR original.movimiento_id IS DISTINCT FROM movement.movimiento_origen_id\n     OR (original.costo_centavos IS NULL) <> (NEW.costo_centavos IS NULL) THEN\n    RAISE EXCEPTION 'REVERSA source identity does not match its CONSUMO';\n  END IF;\n\n  SELECT COALESCE(SUM(cantidad_milesimas), 0),\n         COALESCE(SUM(ingreso_centavos), 0),\n         COALESCE(SUM(costo_centavos), 0)\n    INTO reversal_quantity, reversal_revenue, reversal_cost\n    FROM ticket_linea_consumos\n   WHERE reversa_de_id = original.id\n     AND tipo = 'REVERSA';\n  IF NEW.cantidad_milesimas > original.cantidad_milesimas - reversal_quantity\n     OR NEW.ingreso_centavos > original.ingreso_centavos - reversal_revenue\n     OR NEW.costo_centavos IS NOT NULL\n        AND NEW.costo_centavos > original.costo_centavos - reversal_cost THEN\n    RAISE EXCEPTION 'REVERSA exceeds the remaining CONSUMO allocation';\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n"
    },
    {
      "schema_name": "public",
      "table_name": "ticket_pagos",
      "trigger_name": "ticket_pagos_inmutables",
      "enabled_state": "O",
      "trigger_type_bits": 27,
      "fires_on_delete": true,
      "fires_on_truncate": false,
      "trigger_definition": "CREATE TRIGGER ticket_pagos_inmutables BEFORE DELETE OR UPDATE ON ticket_pagos FOR EACH ROW EXECUTE FUNCTION prevent_financial_record_mutation()",
      "function_schema": "public",
      "function_name": "prevent_financial_record_mutation",
      "function_language": "plpgsql",
      "function_source": "CREATE OR REPLACE FUNCTION public.prevent_financial_record_mutation()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\n      BEGIN\n        RAISE EXCEPTION 'Los pagos y movimientos financieros son inmutables; registre un reverso o ajuste.';\n      END $function$\n"
    }
  ]
}
```

### sequences_and_ownership

```sql
SELECT
         n.nspname AS sequence_schema,
         c.relname AS sequence_name,
         ps.data_type,
         ps.start_value,
         ps.min_value,
         ps.max_value,
         ps.increment_by,
         ps.cycle,
         ps.cache_size,
         ps.last_value,
         owner_ns.nspname AS owner_table_schema,
         owner_table.relname AS owner_table,
         owner_column.attname AS owner_column,
         dep.deptype::text AS ownership_dependency_type
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_sequence seq ON seq.seqrelid = c.oid
       LEFT JOIN pg_sequences ps
         ON ps.schemaname = n.nspname AND ps.sequencename = c.relname
       LEFT JOIN pg_depend dep
         ON dep.classid = 'pg_class'::regclass
        AND dep.objid = c.oid
        AND dep.refclassid = 'pg_class'::regclass
        AND dep.deptype IN ('a', 'i')
       LEFT JOIN pg_class owner_table ON owner_table.oid = dep.refobjid
       LEFT JOIN pg_namespace owner_ns ON owner_ns.oid = owner_table.relnamespace
       LEFT JOIN pg_attribute owner_column
         ON owner_column.attrelid = dep.refobjid
        AND owner_column.attnum = dep.refobjsubid
       WHERE c.relkind = 'S'
         AND n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND n.nspname NOT LIKE 'pg_%'
       ORDER BY n.nspname, c.relname
```
```json
{
  "command": "SELECT",
  "rowCount": 45,
  "rows": [
    {
      "sequence_schema": "public",
      "sequence_name": "aplicaciones_credito_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "6",
      "owner_table_schema": "public",
      "owner_table": "aplicaciones_credito",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "aplicaciones_pago_proveedor_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "18",
      "owner_table_schema": "public",
      "owner_table": "aplicaciones_pago_proveedor",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "auditoria_id_seq",
      "data_type": "bigint",
      "start_value": "1",
      "min_value": "1",
      "max_value": "9223372036854775807",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "3964",
      "owner_table_schema": "public",
      "owner_table": "auditoria",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "auditorias_inventario_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "auditorias_inventario",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "autorizaciones_nota_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "6",
      "owner_table_schema": "public",
      "owner_table": "autorizaciones_nota",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "camionetas_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "camionetas",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "choferes_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "choferes",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "cliente_documentos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "4",
      "owner_table_schema": "public",
      "owner_table": "cliente_documentos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "clientes_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "7",
      "owner_table_schema": "public",
      "owner_table": "clientes",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "contenedor_lineas_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "2",
      "owner_table_schema": "public",
      "owner_table": "contenedor_lineas",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "contenedores_folio_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "contenedores",
      "owner_column": "folio",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "contenedores_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "2",
      "owner_table_schema": "public",
      "owner_table": "contenedores",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "cuadre_fiscal_registros_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "cuadre_fiscal_registros",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "entradas_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "432",
      "owner_table_schema": "public",
      "owner_table": "entradas",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "equipos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "equipos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "movimientos_credito_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "50",
      "owner_table_schema": "public",
      "owner_table": "movimientos_credito",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "movimientos_id_seq",
      "data_type": "bigint",
      "start_value": "1",
      "min_value": "1",
      "max_value": "9223372036854775807",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "6522",
      "owner_table_schema": "public",
      "owner_table": "movimientos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "notificaciones_credito_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "8",
      "owner_table_schema": "public",
      "owner_table": "notificaciones_credito",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "notificaciones_sistema_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "28",
      "owner_table_schema": "public",
      "owner_table": "notificaciones_sistema",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "pagos_proveedor_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "450",
      "owner_table_schema": "public",
      "owner_table": "pagos_proveedor",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "permisos_rol_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "29041",
      "owner_table_schema": "public",
      "owner_table": "permisos_rol",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "permisos_ubicacion_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "6750",
      "owner_table_schema": "public",
      "owner_table": "permisos_ubicacion",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "permisos_usuario_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "125",
      "owner_table_schema": "public",
      "owner_table": "permisos_usuario",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "pisos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "pisos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "precio_historial_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "1016",
      "owner_table_schema": "public",
      "owner_table": "precio_historial",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "productos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "2077",
      "owner_table_schema": "public",
      "owner_table": "productos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "proveedores_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "225",
      "owner_table_schema": "public",
      "owner_table": "proveedores",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "reimpresiones_etiqueta_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "170",
      "owner_table_schema": "public",
      "owner_table": "reimpresiones_etiqueta",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "revisiones_etiqueta_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "31",
      "owner_table_schema": "public",
      "owner_table": "revisiones_etiqueta",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "rollos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "5463",
      "owner_table_schema": "public",
      "owner_table": "rollos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "salida_lineas_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "26",
      "owner_table_schema": "public",
      "owner_table": "salida_lineas",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "salida_rollos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "113",
      "owner_table_schema": "public",
      "owner_table": "salida_rollos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "salidas_dinero_caja_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "salidas_dinero_caja",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "salidas_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "24",
      "owner_table_schema": "public",
      "owner_table": "salidas",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "sesiones_caja_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "42",
      "owner_table_schema": "public",
      "owner_table": "sesiones_caja",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "solicitudes_pago_dirigido_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "1",
      "owner_table_schema": "public",
      "owner_table": "solicitudes_pago_dirigido",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "stock_minimo_episodios_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "7",
      "owner_table_schema": "public",
      "owner_table": "stock_minimo_episodios",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "stock_minimos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "3",
      "owner_table_schema": "public",
      "owner_table": "stock_minimos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "ticket_linea_consumos_id_seq",
      "data_type": "bigint",
      "start_value": "1",
      "min_value": "1",
      "max_value": "9223372036854775807",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "20",
      "owner_table_schema": "public",
      "owner_table": "ticket_linea_consumos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "ticket_lineas_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "353",
      "owner_table_schema": "public",
      "owner_table": "ticket_lineas",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "ticket_pagos_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "89",
      "owner_table_schema": "public",
      "owner_table": "ticket_pagos",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "tickets_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "105",
      "owner_table_schema": "public",
      "owner_table": "tickets",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "ubicaciones_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "834",
      "owner_table_schema": "public",
      "owner_table": "ubicaciones",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "usuarios_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": "233",
      "owner_table_schema": "public",
      "owner_table": "usuarios",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    },
    {
      "sequence_schema": "public",
      "sequence_name": "viajes_id_seq",
      "data_type": "integer",
      "start_value": "1",
      "min_value": "1",
      "max_value": "2147483647",
      "increment_by": "1",
      "cycle": false,
      "cache_size": "1",
      "last_value": null,
      "owner_table_schema": "public",
      "owner_table": "viajes",
      "owner_column": "id",
      "ownership_dependency_type": "a"
    }
  ]
}
```

### row_count:public.aplicaciones_credito

```sql
SELECT count(*)::text AS row_count FROM "public"."aplicaciones_credito"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "2"
    }
  ]
}
```

### row_count:public.aplicaciones_pago_proveedor

```sql
SELECT count(*)::text AS row_count FROM "public"."aplicaciones_pago_proveedor"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "4"
    }
  ]
}
```

### row_count:public.auditoria

```sql
SELECT count(*)::text AS row_count FROM "public"."auditoria"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "3285"
    }
  ]
}
```

### row_count:public.auditoria_inventario_escaneos

```sql
SELECT count(*)::text AS row_count FROM "public"."auditoria_inventario_escaneos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.auditoria_inventario_folio

```sql
SELECT count(*)::text AS row_count FROM "public"."auditoria_inventario_folio"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "11"
    }
  ]
}
```

### row_count:public.auditoria_inventario_participantes

```sql
SELECT count(*)::text AS row_count FROM "public"."auditoria_inventario_participantes"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.auditoria_inventario_snapshot

```sql
SELECT count(*)::text AS row_count FROM "public"."auditoria_inventario_snapshot"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.auditorias_inventario

```sql
SELECT count(*)::text AS row_count FROM "public"."auditorias_inventario"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.autorizaciones_nota

```sql
SELECT count(*)::text AS row_count FROM "public"."autorizaciones_nota"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "2"
    }
  ]
}
```

### row_count:public.camionetas

```sql
SELECT count(*)::text AS row_count FROM "public"."camionetas"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.choferes

```sql
SELECT count(*)::text AS row_count FROM "public"."choferes"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.cliente_documentos

```sql
SELECT count(*)::text AS row_count FROM "public"."cliente_documentos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.clientes

```sql
SELECT count(*)::text AS row_count FROM "public"."clientes"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "7"
    }
  ]
}
```

### row_count:public.contenedor_lineas

```sql
SELECT count(*)::text AS row_count FROM "public"."contenedor_lineas"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.contenedores

```sql
SELECT count(*)::text AS row_count FROM "public"."contenedores"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.cuadre_fiscal_registros

```sql
SELECT count(*)::text AS row_count FROM "public"."cuadre_fiscal_registros"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.entrada_folio

```sql
SELECT count(*)::text AS row_count FROM "public"."entrada_folio"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "11"
    }
  ]
}
```

### row_count:public.entradas

```sql
SELECT count(*)::text AS row_count FROM "public"."entradas"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "6"
    }
  ]
}
```

### row_count:public.equipos

```sql
SELECT count(*)::text AS row_count FROM "public"."equipos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.equipos_checklist

```sql
SELECT count(*)::text AS row_count FROM "public"."equipos_checklist"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.existencias

```sql
SELECT count(*)::text AS row_count FROM "public"."existencias"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "37"
    }
  ]
}
```

### row_count:public.movimientos

```sql
SELECT count(*)::text AS row_count FROM "public"."movimientos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "307"
    }
  ]
}
```

### row_count:public.movimientos_credito

```sql
SELECT count(*)::text AS row_count FROM "public"."movimientos_credito"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "8"
    }
  ]
}
```

### row_count:public.notificaciones_credito

```sql
SELECT count(*)::text AS row_count FROM "public"."notificaciones_credito"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "2"
    }
  ]
}
```

### row_count:public.notificaciones_sistema

```sql
SELECT count(*)::text AS row_count FROM "public"."notificaciones_sistema"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "16"
    }
  ]
}
```

### row_count:public.pagos_proveedor

```sql
SELECT count(*)::text AS row_count FROM "public"."pagos_proveedor"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "9"
    }
  ]
}
```

### row_count:public.permisos_rol

```sql
SELECT count(*)::text AS row_count FROM "public"."permisos_rol"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "192"
    }
  ]
}
```

### row_count:public.permisos_ubicacion

```sql
SELECT count(*)::text AS row_count FROM "public"."permisos_ubicacion"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "54"
    }
  ]
}
```

### row_count:public.permisos_usuario

```sql
SELECT count(*)::text AS row_count FROM "public"."permisos_usuario"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.pisos

```sql
SELECT count(*)::text AS row_count FROM "public"."pisos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.precio_historial

```sql
SELECT count(*)::text AS row_count FROM "public"."precio_historial"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "1016"
    }
  ]
}
```

### row_count:public.productos

```sql
SELECT count(*)::text AS row_count FROM "public"."productos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "1234"
    }
  ]
}
```

### row_count:public.proveedores

```sql
SELECT count(*)::text AS row_count FROM "public"."proveedores"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "27"
    }
  ]
}
```

### row_count:public.reimpresiones_etiqueta

```sql
SELECT count(*)::text AS row_count FROM "public"."reimpresiones_etiqueta"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "146"
    }
  ]
}
```

### row_count:public.revisiones_etiqueta

```sql
SELECT count(*)::text AS row_count FROM "public"."revisiones_etiqueta"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "31"
    }
  ]
}
```

### row_count:public.rollos

```sql
SELECT count(*)::text AS row_count FROM "public"."rollos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "226"
    }
  ]
}
```

### row_count:public.salida_folio

```sql
SELECT count(*)::text AS row_count FROM "public"."salida_folio"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "11"
    }
  ]
}
```

### row_count:public.salida_lineas

```sql
SELECT count(*)::text AS row_count FROM "public"."salida_lineas"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "2"
    }
  ]
}
```

### row_count:public.salida_rollos

```sql
SELECT count(*)::text AS row_count FROM "public"."salida_rollos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "12"
    }
  ]
}
```

### row_count:public.salidas

```sql
SELECT count(*)::text AS row_count FROM "public"."salidas"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "2"
    }
  ]
}
```

### row_count:public.salidas_dinero_caja

```sql
SELECT count(*)::text AS row_count FROM "public"."salidas_dinero_caja"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.series_consecutivo

```sql
SELECT count(*)::text AS row_count FROM "public"."series_consecutivo"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "1"
    }
  ]
}
```

### row_count:public.sesiones

```sql
SELECT count(*)::text AS row_count FROM "public"."sesiones"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "11"
    }
  ]
}
```

### row_count:public.sesiones_caja

```sql
SELECT count(*)::text AS row_count FROM "public"."sesiones_caja"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "2"
    }
  ]
}
```

### row_count:public.sesiones_caja_dias

```sql
SELECT count(*)::text AS row_count FROM "public"."sesiones_caja_dias"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "2"
    }
  ]
}
```

### row_count:public.solicitudes_pago_dirigido

```sql
SELECT count(*)::text AS row_count FROM "public"."solicitudes_pago_dirigido"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.stock_minimo_episodios

```sql
SELECT count(*)::text AS row_count FROM "public"."stock_minimo_episodios"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "4"
    }
  ]
}
```

### row_count:public.stock_minimo_sitios

```sql
SELECT count(*)::text AS row_count FROM "public"."stock_minimo_sitios"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "1"
    }
  ]
}
```

### row_count:public.stock_minimos

```sql
SELECT count(*)::text AS row_count FROM "public"."stock_minimos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "3"
    }
  ]
}
```

### row_count:public.ticket_folio

```sql
SELECT count(*)::text AS row_count FROM "public"."ticket_folio"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "1"
    }
  ]
}
```

### row_count:public.ticket_linea_consumos

```sql
SELECT count(*)::text AS row_count FROM "public"."ticket_linea_consumos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "20"
    }
  ]
}
```

### row_count:public.ticket_lineas

```sql
SELECT count(*)::text AS row_count FROM "public"."ticket_lineas"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "57"
    }
  ]
}
```

### row_count:public.ticket_pagos

```sql
SELECT count(*)::text AS row_count FROM "public"."ticket_pagos"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "4"
    }
  ]
}
```

### row_count:public.tickets

```sql
SELECT count(*)::text AS row_count FROM "public"."tickets"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "6"
    }
  ]
}
```

### row_count:public.ubicaciones

```sql
SELECT count(*)::text AS row_count FROM "public"."ubicaciones"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "11"
    }
  ]
}
```

### row_count:public.usuarios

```sql
SELECT count(*)::text AS row_count FROM "public"."usuarios"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "31"
    }
  ]
}
```

### row_count:public.viaje_folio

```sql
SELECT count(*)::text AS row_count FROM "public"."viaje_folio"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "11"
    }
  ]
}
```

### row_count:public.viaje_salidas

```sql
SELECT count(*)::text AS row_count FROM "public"."viaje_salidas"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.viaje_tickets

```sql
SELECT count(*)::text AS row_count FROM "public"."viaje_tickets"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### row_count:public.viajes

```sql
SELECT count(*)::text AS row_count FROM "public"."viajes"
```
```json
{
  "command": "SELECT",
  "rowCount": 1,
  "rows": [
    {
      "row_count": "0"
    }
  ]
}
```

### rollback_read_only_transaction

```sql
ROLLBACK
```
```json
{
  "command": "ROLLBACK",
  "rowCount": null,
  "rows": []
}
```
