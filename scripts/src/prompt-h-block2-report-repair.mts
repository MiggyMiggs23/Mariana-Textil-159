/**
 * Repair the already-captured Prompt H Block 2 report.
 *
 * This command reads only the private source snapshot and the captured
 * verification metadata.  It does not connect to PostgreSQL, run pg_dump or
 * pg_restore, and cannot change the source database.  The restored per-table
 * values are rendered from the existing zero-mismatch verification result:
 * they are not a second copy of rows or a newly collected inventory.
 */
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BACKUPS = `${ROOT}/.local/backups`;
const REPORT = `${ROOT}/reports/prompt-h/block2-restore.md`;
const METADATA_REPORT = `${ROOT}/reports/prompt-h/block2-restore-metadata.json`;

type AnyRow = Record<string, unknown>;

interface TableEvidence {
  schema: string;
  table: string;
  relkind: string;
  count: string;
  orderedCanonicalRowHash: string;
}

function rows(value: unknown): AnyRow[] {
  return Array.isArray(value) ? value as AnyRow[] : [];
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function countByTable(catalogue: AnyRow, field: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows(catalogue[field])) {
    const key = `${text(row.schema)}.${text(row.table)}`;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

async function latestBackup(): Promise<string> {
  const names = (await fs.readdir(BACKUPS))
    .filter((name) => name.startsWith("prompt-h-block2-"));
  if (!names.length) throw new Error("No captured Prompt H Block 2 backup exists.");
  const withTimes = await Promise.all(
    names.map(async (name) => ({
      name,
      mtime: (await fs.stat(`${BACKUPS}/${name}`)).mtimeMs,
    })),
  );
  withTimes.sort((a, b) => b.mtime - a.mtime);
  return `${BACKUPS}/${withTimes[0].name}`;
}

function sqlEvidence(): string {
  return String.raw`### 1. Tabla dinámica, conteo y huella de filas

La siguiente consulta descubre el conjunto (no usa una lista de tablas). Para
cada fila del resultado se ejecutó la segunda consulta reemplazando solamente
\`<schema>\` y \`<table>\` por identificadores SQL entrecomillados:

\`\`\`sql
SELECT n.nspname AS schema, c.relname AS table, c.relkind::text AS relkind,
       pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p', 'f')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname;
\`\`\`

\`\`\`sql
WITH canonical_rows AS (
  SELECT to_jsonb(t)::text AS canonical
    FROM "<schema>"."<table>" AS t
)
SELECT count(*)::text AS count,
       md5(COALESCE(
         string_agg(md5(canonical), '' ORDER BY canonical, md5(canonical)),
         ''
       )) AS ordered_canonical_row_hash
  FROM canonical_rows;
\`\`\`

\`to_jsonb(row)::text\` is PostgreSQL's canonical textual row projection. The
ordered digest is not a raw-row export and is sufficient to compare duplicate
rows as well as distinct rows.

### 2. Columns and defaults

\`\`\`sql
SELECT n.nspname AS schema, c.relname AS table, a.attname AS column,
       a.attnum AS ordinal_position, format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_expression,
       NULLIF(a.attidentity, '') AS identity_kind,
       NULLIF(a.attgenerated, '') AS generated_kind
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE a.attnum > 0 AND NOT a.attisdropped
   AND c.relkind IN ('r', 'p', 'f')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname, a.attnum;
\`\`\`

Comparison is semantic by schema/table/column/type/nullability/default/identity/
generated status; \`ordinal_position\` is deliberately not required to match
because a logical restore compacts dropped-column holes.

### 3. Constraints

\`\`\`sql
SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
       CASE con.contype WHEN 'c' THEN 'CHECK' WHEN 'f' THEN 'FOREIGN KEY'
         WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE'
         WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition,
       con.convalidated AS validated, con.condeferrable AS deferrable,
       con.condeferred AS initially_deferred,
       rn.nspname AS referenced_schema, rc.relname AS referenced_table,
       con.confupdtype::text AS update_action, con.confdeltype::text AS delete_action,
       con.confmatchtype::text AS match_type
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_class rc ON rc.oid = con.confrelid
  LEFT JOIN pg_namespace rn ON rn.oid = rc.relnamespace
 WHERE con.contype IN ('c', 'f', 'p', 'u', 'x')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname, con.conname;
\`\`\`

### 4. Indexes

\`\`\`sql
SELECT tn.nspname AS schema, tc.relname AS table, i.relname AS index_name,
       pg_get_indexdef(i.oid) AS definition, x.indisunique AS is_unique,
       x.indisprimary AS is_primary, x.indisexclusion AS is_exclusion,
       x.indisvalid AS is_valid, x.indisready AS is_ready, x.indislive AS is_live,
       pg_get_expr(x.indpred, x.indrelid) AS predicate,
       pg_get_expr(x.indexprs, x.indrelid) AS expressions
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_class tc ON tc.oid = x.indrelid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
 WHERE tc.relkind IN ('r', 'p', 'f')
   AND tn.nspname NOT IN ('pg_catalog', 'information_schema')
   AND tn.nspname NOT LIKE 'pg_toast%'
   AND tn.nspname NOT LIKE 'pg_temp_%'
 ORDER BY tn.nspname, tc.relname, i.relname;
\`\`\`

### 5. Functions and noninternal trigger enabled states

\`\`\`sql
SELECT n.nspname AS schema, p.proname AS name,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_result(p.oid) AS result_type,
       pg_get_functiondef(p.oid) AS definition,
       p.prokind::text AS kind, p.provolatile::text AS volatility,
       p.prosecdef AS security_definer, p.proleakproof AS leakproof,
       p.proparallel::text AS parallel, p.proacl::text AS acl,
       pg_get_userbyid(p.proowner) AS owner, ext.extname AS extension_name
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN pg_depend dep
    ON dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
   AND dep.deptype = 'e'
  LEFT JOIN pg_extension ext ON ext.oid = dep.refobjid
 WHERE p.prokind IN ('f', 'p')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);
\`\`\`

\`\`\`sql
SELECT n.nspname AS schema, c.relname AS table, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid, true) AS definition, t.tgenabled::text AS enabled,
       pn.nspname AS function_schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS function_arguments
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
 WHERE NOT t.tgisinternal
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp_%'
 ORDER BY n.nspname, c.relname, t.tgname;
\`\`\`

For all catalogue queries, source reads were in the captured
\`REPEATABLE READ READ ONLY\` transaction; restore reads were in a separate
read-only transaction on the disposable database.`;
}

async function main(): Promise<void> {
  const capturedMetadata = JSON.parse(await fs.readFile(METADATA_REPORT, "utf8")) as AnyRow;
  const backup =
    process.env.PROMPT_H_BACKUP_DIRECTORY?.trim() ||
    text(capturedMetadata.backupDirectory) ||
    await latestBackup();
  const metadataPath = `${backup}/restore-metadata.json`;
  const sourcePath = `${backup}/source-snapshot.json`;
  const metadata = capturedMetadata;
  const restoreMetadata = JSON.parse(await fs.readFile(metadataPath, "utf8")) as AnyRow;
  const snapshot = JSON.parse(await fs.readFile(sourcePath, "utf8")) as AnyRow;
  const capturedComparison = metadata.comparison as AnyRow;
  if (metadata.status !== "PASS" || capturedComparison.status !== "PASS") {
    throw new Error("Captured verification is not PASS; refusing to synthesize a PASS report.");
  }
  const source = snapshot.source as AnyRow;
  const catalogue = source.catalogue as AnyRow;
  const evidence = rows(catalogue.tableEvidence) as unknown as TableEvidence[];
  if (evidence.length !== 60) {
    throw new Error(`Expected the captured dynamic table set to contain 60 tables; found ${evidence.length}.`);
  }
  const comparison = capturedComparison;
  const categories = comparison.categories as AnyRow;
  for (const [category, values] of Object.entries(categories)) {
    if (Array.isArray(values) && values.length) {
      throw new Error(`Captured comparison has discrepancies in ${category}.`);
    }
  }
  const columns = countByTable(catalogue, "columns");
  const constraints = countByTable(catalogue, "constraints");
  const indexes = countByTable(catalogue, "indexes");
  const triggers = countByTable(catalogue, "triggers");
  const sortedEvidence = [...evidence].sort((a, b) =>
    `${a.schema}.${a.table}`.localeCompare(`${b.schema}.${b.table}`),
  );
  const tableLines = sortedEvidence.map((row) => {
    const key = `${row.schema}.${row.table}`;
    const c = columns.get(key) ?? 0;
    const k = constraints.get(key) ?? 0;
    const i = indexes.get(key) ?? 0;
    const t = triggers.get(key) ?? 0;
    return `| \`${key}\` | ${row.count} | ${row.count} | \`${row.orderedCanonicalRowHash}\` | \`${row.orderedCanonicalRowHash}\` | ${c} / ${c} / PASS | ${k} / ${k} / PASS | ${i} / ${i} / PASS | ${t} / ${t} / PASS | PASS |`;
  });
  const allColumns = rows(catalogue.columns).length;
  const allConstraints = rows(catalogue.constraints).length;
  const allIndexes = rows(catalogue.indexes).length;
  const allTriggers = rows(catalogue.triggers).length;
  const archive = metadata.archive as AnyRow;
  const restore = (metadata.restore ?? restoreMetadata) as AnyRow;
  const report = `# Prompt H — Bloque 2: respaldo + restauración desechable local

## Veredicto

**PASS** — reporte reparado desde evidencia capturada; no se ejecutó un nuevo
dump, restore, consulta a la fuente, preflight, purga, Drive, seed, ni reinicio.

La autorización aprobada permanece en
\`reports/prompt-h/aprobacion-listas-no-purga.md\` y no fue modificada.

## Fuente, archivo y restauración

- Fuente efectiva: \`${text(metadata.sourceDatabase)}\`, PostgreSQL \`${text(metadata.sourceServerVersion)}\`
- Snapshot UTC: \`${text(metadata.capturedAtUtc)}\`
- Snapshot Mexico City: \`${text(metadata.capturedAtMexico)}\`
- Archivo custom: \`${text(archive.file)}\`
- Tamaño: \`${text(archive.sizeBytes)}\` bytes
- SHA-256: \`${text(archive.sha256)}\`
- \`pg_restore\` exit code: \`${text(restore.restoreExitCode)}\`
- Cluster persistente: \`${text(restore.clusterDirectory)}\`
- Socket Unix-only verificado: \`${text(restore.unixSocketOnlyVerified)}\`
- Rol superusuario local: \`${text(restore.superuserRole)}\`
- Reconexión admin: \`${text(restore.adminConnectionCommand)}\`
- Reconexión restore: \`${text(restore.restoredConnectionCommand)}\`

El dump, metadatos y cluster permanecen bajo \`.local/backups/\`; no contienen
credenciales ni filas crudas en este reporte. El JSON privado
\`${sourcePath}\` conserva solamente la evidencia capturada necesaria para
reproducir la comparación; esta tabla no duplica ese archivo.

## Evidencia global capturada

| Objeto | Fuente | Restaurado | Comparación |
|---|---:|---:|---|
| Tablas dinámicas | ${evidence.length} | ${text(comparison.restoredTableCount)} | PASS |
| Columnas/defaults | ${allColumns} | ${allColumns} | PASS |
| Constraints | ${allConstraints} | ${allConstraints} | PASS |
| Índices | ${allIndexes} | ${allIndexes} | PASS |
| Funciones | ${rows(catalogue.functions).length} | ${rows(catalogue.functions).length} | PASS |
| Triggers no internos + estado enabled | ${allTriggers} | ${allTriggers} | PASS |
| Secuencias | ${rows(catalogue.sequences).length} | ${rows(catalogue.sequences).length} | PASS |

Las categorías capturadas \`tables\`, \`columns\`, \`constraints\`, \`indexes\`,
\`functions\`, \`triggers\`, \`sequences\`,
\`tableCountsAndCanonicalRowHashes\` y \`sequenceStateAfterDump\` tienen
listas de discrepancias vacías. La siguiente tabla expande esa evidencia
global al nivel requerido por cada tabla. Para cada columna de comparación,
\`Fuente / restaurado / resultado\`; el valor restaurado es igual al de fuente
porque la categoría correspondiente fue comparada y quedó con cero
discrepancias en el estado capturado.

## Comparación tabla por tabla (60 tablas)

| Tabla | Count fuente | Count restore | Hash fila ordenado fuente | Hash fila ordenado restore | Columnas | Constraints | Índices | Triggers + enabled | Resultado |
|---|---:|---:|---|---|---|---|---|---|---|
${tableLines.join("\n")}

**Resultado de las 60 filas:** counts PASS, hashes PASS, columnas/defaults
PASS, constraints PASS, índices PASS y triggers/estados enabled PASS. No hubo
discrepancias por tabla.

## Secuencias no-MVCC

Se capturó estado antes y después de \`pg_dump\`; el indicador capturado
\`sequenceChangedDuringDump\` es
\`**${comparison.sequenceChangedDuringDump ? "true" : "false"}**\`. El snapshot
prueba el instante del respaldo, no la frescura de un preflight posterior. No
se ejecutó preflight.

## SQL exacto y reproducibilidad

${sqlEvidence()}

Los únicos outputs persistidos por esta reparación son este Markdown y el JSON
de metadatos ya capturado. Los outputs de las consultas son nombres de objetos,
conteos, estados semánticos y hashes; nunca se imprimen ni se guardan filas de
datos o credenciales.
`;
  // sqlEvidence uses String.raw so the source file can safely contain
  // backticks; remove only those escaping slashes before writing real
  // Markdown code fences and inline code.
  const markdown = report.replaceAll("\\`", "`");
  await fs.writeFile(REPORT, markdown, { encoding: "utf8", mode: 0o600 });
  await fs.chmod(REPORT, 0o600);
  const repairedMetadata = {
    ...metadata,
    reportEvidence: {
      format: "plain UTF-8 Markdown (not a JSON-encoded string)",
      tableByTableRows: evidence.length,
      sourceCatalogueCounts: {
        tables: evidence.length,
        columns: allColumns,
        constraints: allConstraints,
        indexes: allIndexes,
        functions: rows(catalogue.functions).length,
        triggers: allTriggers,
        sequences: rows(catalogue.sequences).length,
      },
      restoredCatalogueCounts: {
        tables: comparison.restoredTableCount,
        columns: allColumns,
        constraints: allConstraints,
        indexes: allIndexes,
        functions: rows(catalogue.functions).length,
        triggers: allTriggers,
        sequences: rows(catalogue.sequences).length,
      },
      allCapturedDiscrepancyListsEmpty: true,
      sqlEvidenceSection: "## SQL exacto y reproducibilidad",
      rawRowsPersisted: false,
      credentialsPersisted: false,
      dumpRestoreRerun: false,
      privateSourceSnapshot: sourcePath,
    },
  };
  await fs.writeFile(METADATA_REPORT, `${JSON.stringify(repairedMetadata, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(METADATA_REPORT, 0o600);
  console.log(JSON.stringify({
    status: "PASS",
    report: REPORT,
    backup,
    tableCount: evidence.length,
    reportBytes: Buffer.byteLength(markdown, "utf8"),
    dumpRestoreRerun: false,
  }, null, 2));
}

await main().catch((error: unknown) => {
  console.error(`Prompt H report repair failed: ${error instanceof Error ? error.message : "unknown failure"}`);
  process.exitCode = 1;
});