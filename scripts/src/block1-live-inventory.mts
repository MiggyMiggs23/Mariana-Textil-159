/**
 * Prompt H / Block 1: live, read-only inventory and ABC proposal.
 *
 * This diagnostic intentionally does not import @workspace/db.  The connection
 * is opened directly with pg using the effective DATABASE_URL, while the
 * Drizzle schema is imported separately for runtime metadata only (schema
 * modules do not initialize a database connection).
 *
 * It refuses to run when an isolated/test connection override is present.
 * Every database query runs inside one REPEATABLE READ, READ ONLY transaction.
 */
import { mkdir, readdir, readFile, readlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error pg is intentionally loaded directly, without importing the db package.
const pgModule = await import("../../lib/db/node_modules/pg/lib/index.js");
import * as drizzleSchema from "../../lib/db/src/schema/index.ts";

type JsonObject = Record<string, unknown>;
type QueryRecord = {
  name: string;
  sql: string;
  params: unknown[];
  command?: string;
  rowCount?: number | null;
  rows?: unknown[];
  error?: string;
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const reportDirectory = resolve(repositoryRoot, "reports/prompt-h");
const reportBaseName = "block1-live-inventory";
const compactReportPath = resolve(reportDirectory, "block1-listas-es.md");
const tableNameSymbol = Symbol.for("drizzle:Name");
const foreignKeysSymbol = Symbol.for("drizzle:PgInlineForeignKeys");

const CLASS_C = new Set([
  "productos",
  "precio_historial",
  "clientes",
  "cliente_documentos",
  "proveedores",
  "usuarios",
  "ubicaciones",
  "pisos",
  "permisos_rol",
  "permisos_usuario",
  "permisos_ubicacion",
  "camionetas",
  "choferes",
  "equipos",
  "equipos_checklist",
  "stock_minimo_sitios",
  "stock_minimos",
  "auditoria",
]);

const CLASS_B = new Set([
  "ticket_folio",
  "entrada_folio",
  "salida_folio",
  "viaje_folio",
  "auditoria_inventario_folio",
  "series_consecutivo",
  "existencias",
]);

/**
 * Owner-approved business counter targets. These are table values, not
 * PostgreSQL sequence values: internal IDs and their sequences are preserved.
 */
const APPROVED_COUNTER_TARGETS: Record<string, number> = Object.freeze({
  entrada_folio: 0,
  salida_folio: 0,
  viaje_folio: 0,
  auditoria_inventario_folio: 0,
  ticket_folio: 999,
  series_consecutivo: 1_000_000,
});

const CUADRE_FISCAL_SCHEMA_DRIFT = {
  table: "cuadre_fiscal_registros",
  finding: "LIVE_ABSENT_FROM_DRIZZLE",
  action: "DO_NOT_CHANGE_SCHEMA",
  note:
    "La tabla vive en la base pero no está declarada en Drizzle; se reporta como deriva y no se crea ni se borra del esquema en este bloque.",
} as const;

const APPEND_ONLY_TRUNCATE_SECURITY_FINDING =
  "Los guards append-only bloquean DELETE por filas, pero no impiden TRUNCATE a roles privilegiados. Es un hallazgo de seguridad de privilegios de base de datos, no una afirmación de explotación HTTP; la remediación es separada y los triggers quedan intactos.";

const API_POOL_IDENTITY_EVIDENCE = {
  status: "CONFIRMED_FROM_RUNNING_API_POOL_READ_ONLY",
  evidencePath: "reports/prompt-h/api-pool-identity-2026-09-15.md",
  database: "heliumdb",
  schema: "public",
  source: "current_database() executed through the API's existing in-process pg pool",
  publicEndpointExposed: false,
  apiRestarted: false,
  authenticationChanged: false,
  loopbackInspectorClosed: true,
} as const;

const REASONS: Record<string, string> = {
  productos:
    "C — Catálogo operativo de productos que conserva explícitamente sus colores y atributos.",
  precio_historial:
    "C — Historial de precios solicitado expresamente como conservación inmutable del catálogo.",
  clientes:
    "C — Catálogo/configuración de clientes expresamente conservado.",
  cliente_documentos:
    "C — Documentos de identificación/configuración de clientes, dependientes de un catálogo conservado.",
  proveedores:
    "C — Catálogo/configuración de proveedores expresamente conservado.",
  usuarios:
    "C — Identidades de usuarios expresamente conservadas; no se crean ni modifican identidades en este bloque.",
  ubicaciones:
    "C — Catálogo de ubicaciones expresamente conservado.",
  pisos:
    "C — Catálogo/configuración de pisos expresamente conservado.",
  permisos_rol:
    "C — Configuración de permisos por rol expresamente conservada.",
  permisos_usuario:
    "C — Configuración de permisos por usuario expresamente conservada.",
  permisos_ubicacion:
    "C — Configuración de permisos por ubicación expresamente conservada.",
  camionetas:
    "C — Catálogo/configuración de camionetas expresamente conservado.",
  choferes:
    "C — Catálogo/configuración de choferes expresamente conservado.",
  equipos:
    "C — Catálogo/configuración de equipos expresamente conservado.",
  equipos_checklist:
    "C — Checklist/configuración asociada a equipos expresamente conservada.",
  stock_minimo_sitios:
    "C — Configuración de mínimos de stock por sitio expresamente conservada.",
  stock_minimos:
    "C — Configuración de mínimos de stock expresamente conservada.",
  auditoria:
    "C — Bitácora de auditoría expresamente conservada y tratada como historial append-only.",
  ticket_folio:
    "B — Contador operativo de folios de tickets que se reiniciaría a su objetivo aprobado.",
  entrada_folio:
    "B — Contador operativo de folios de entradas por ubicación que se reiniciaría a su objetivo aprobado.",
  salida_folio:
    "B — Contador operativo de folios de salidas por ubicación que se reiniciaría a su objetivo aprobado.",
  viaje_folio:
    "B — Contador operativo de folios de viajes por ubicación que se reiniciaría a su objetivo aprobado.",
  auditoria_inventario_folio:
    "B — Contador operativo de folios de auditorías de inventario que se reiniciaría a su objetivo aprobado.",
  series_consecutivo:
    "B — Consecutivo operativo de series que se reiniciaría a su objetivo aprobado.",
  existencias:
    "B — Caché derivada de existencias que debe reconstruirse, no vaciarse manualmente.",
  aplicaciones_credito:
    "A — Aplicación de crédito transaccional que representa una operación ocurrida.",
  aplicaciones_pago_proveedor:
    "A — Aplicación de pago a proveedor transaccional que representa una operación ocurrida.",
  auditoria_inventario_escaneos:
    "A — Escaneos de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario.",
  auditoria_inventario_participantes:
    "A — Participantes de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario.",
  auditoria_inventario_snapshot:
    "A — Snapshot de una auditoría de inventario ocurrida; el prompt reinicia las auditorías de inventario.",
  auditorias_inventario:
    "A — Cabecera de auditoría de inventario ocurrida que el prompt reinicia.",
  autorizaciones_nota:
    "A — Autorización de nota ligada a una operación de crédito ocurrida.",
  contenedores:
    "A — Recepción/contenedor de mercancía de una operación ocurrida.",
  contenedor_lineas:
    "A — Líneas de un contenedor de una operación de recepción ocurrida.",
  cuadre_fiscal_registros:
    "A — Registros de cuadre fiscal de operaciones ocurridas; no son catálogo/configuración y no tienen base para conservarse como C.",
  entradas:
    "A — Entrada de inventario de una operación ocurrida.",
  movimientos:
    "A — Movimiento de inventario ocurrido que se purgaría junto con sus rollos.",
  movimientos_credito:
    "A — Movimiento de crédito transaccional ocurrido.",
  notificaciones_credito:
    "A — Notificación derivada de una operación de crédito ocurrida.",
  notificaciones_sistema:
    "A — Notificación operativa derivada de una operación ocurrida.",
  pagos_proveedor:
    "A — Pago a proveedor de una operación financiera ocurrida.",
  reimpresiones_etiqueta:
    "A — Historial operativo de reimpresiones de etiquetas ocurridas.",
  revisiones_etiqueta:
    "A — Control operativo de revisión de rollos; no es catálogo/configuración y se incluye explícitamente en A.",
  rollos:
    "A — Rollo físico recibido/movido en una operación ocurrida.",
  salida_lineas:
    "A — Líneas de una salida operativa ocurrida.",
  salida_rollos:
    "A — Asociación de rollos con una salida operativa ocurrida.",
  salidas:
    "A — Salida de inventario/venta de una operación ocurrida.",
  salidas_dinero_caja:
    "A — Salida de dinero de caja de una operación financiera ocurrida.",
  sesiones:
    "A — Sesión de aplicación operativa, no identidad/configuración persistente.",
  sesiones_caja:
    "A — Sesión operativa de caja ocurrida.",
  sesiones_caja_dias:
    "A — Detalle operativo de una sesión de caja ocurrida.",
  solicitudes_pago_dirigido:
    "A — Solicitud operativa de pago dirigido ocurrida.",
  stock_minimo_episodios:
    "A — Episodio/notificación de mínimo de stock ocurrido, distinto de la configuración conservada.",
  ticket_linea_consumos:
    "A — Ledger operativo de consumos físicos de líneas de ticket; se incluye explícitamente en A.",
  ticket_lineas:
    "A — Líneas de un ticket de una venta ocurrida.",
  ticket_pagos:
    "A — Pago asociado a un ticket de una operación ocurrida.",
  tickets:
    "A — Ticket de venta de una operación ocurrida.",
  viaje_salidas:
    "A — Asociación operativa de una salida con un viaje ocurrido.",
  viaje_tickets:
    "A — Asociación operativa de un ticket con un viaje ocurrido.",
  viajes:
    "A — Viaje/logística de una operación ocurrida.",
};

const testOverrideKeys = [
  "TEST_DATABASE_URL",
  "APPLICATION_DATABASE_URL",
  "REQUIRE_ISOLATED_TEST_DATABASE",
  "TEST_DATABASE_PREPARATION_PHASE",
  "DATABASE_URL_OVERRIDE",
  "DB_URL_OVERRIDE",
];
const apiProcessRelevantKeys = ["DATABASE_URL", ...testOverrideKeys, "NODE_ENV"];

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const object: JsonObject = {};
    for (const [key, item] of Object.entries(value)) object[key] = jsonSafe(item);
    return object;
  }
  return value;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableRef(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function counterUpdatesFor(
  counterDefaults: Array<Record<string, unknown>>,
): JsonObject[] {
  return counterDefaults.map((counter) => {
    const table = String(counter.table);
    const targetValue = APPROVED_COUNTER_TARGETS[table];
    return {
      table,
      column: String(counter.column),
      targetValue: targetValue ?? null,
      reportOnlyProposal: true,
      ...(targetValue === undefined
        ? {
            pendingOwnerDecision:
              "No hay valor aprobado para este contador; no se generará SQL de mutación.",
          }
        : {}),
    };
  });
}

function pendingOperationalFolioSequenceDecisions(
  sequenceRows: Array<Record<string, unknown>>,
): JsonObject[] {
  return sequenceRows
    .filter((sequence) => String(sequence.ownerColumn ?? "").toLowerCase() === "folio")
    .map((sequence) => ({
      sequenceSchema: sequence.sequenceSchema,
      sequence: sequence.sequence,
      ownerTable: sequence.ownerTable,
      ownerColumn: sequence.ownerColumn,
      decision:
        String(sequence.sequence) === "contenedores_folio_seq"
          ? "PENDING exact owner decision: should public.contenedores_folio_seq reset as contenedores business folio, or remain unrestarted to avoid historical folio reuse? Do not reset this sequence in this turn."
          : "PENDING owner decision: operational folio sequence reset is not authorized in this turn.",
      resetProposed: false,
    }));
}

function mexicoCityTimestamp(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);
}

function configuredTarget(url: string): JsonObject {
  const parsed = new URL(url);
  return {
    variable: "DATABASE_URL",
    hostname: parsed.hostname,
    port: parsed.port || "5432",
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    usernamePresent: Boolean(parsed.username),
    passwordPresent: Boolean(parsed.password),
    urlValueOmitted: true,
  };
}

function safeUrlTarget(value: string | undefined): JsonObject {
  if (!value) return { present: false };
  try {
    const parsed = new URL(value);
    return {
      present: true,
      hostname: parsed.hostname,
      port: parsed.port || "5432",
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
      urlValueOmitted: true,
    };
  } catch {
    return { present: true, parseable: false, urlValueOmitted: true };
  }
}

function sameNonSecretTarget(left: JsonObject, right: JsonObject): boolean {
  return (
    left.present !== false &&
    right.present !== false &&
    left.parseable !== false &&
    right.parseable !== false &&
    left.hostname === right.hostname &&
    left.port === right.port &&
    left.database === right.database
  );
}

async function inspectRunningApiProcess(
  inventoryTarget: JsonObject | null,
  inventoryOverrideKeys: string[] = [],
): Promise<JsonObject> {
  const processEntries = await readdir("/proc", { withFileTypes: true });
  const candidates: JsonObject[] = [];
  for (const entry of processEntries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const pid = entry.name;
    let rawCommand: string;
    try {
      rawCommand = (await readFile(`/proc/${pid}/cmdline`)).toString();
    } catch {
      continue;
    }
    const argv = rawCommand.split("\0").filter(Boolean);
    if (!argv.some((argument) => /(?:^|\/)dist\/index\.mjs$/.test(argument))) continue;
    if (!/(?:^|\/)node(?:js)?$/.test(argv[0] ?? "")) continue;
    const cwd = await readlink(`/proc/${pid}/cwd`).catch(() => "unavailable");
    let env: Record<string, string> = {};
    try {
      env = Object.fromEntries(
        (await readFile(`/proc/${pid}/environ`))
          .toString()
          .split("\0")
          .filter(Boolean)
          .map((item) => {
            const separator = item.indexOf("=");
            return [item.slice(0, separator), item.slice(separator + 1)];
          }),
      );
    } catch {
      // Keep the process candidate but mark its environment unavailable.
    }
    const isApiArtifact = cwd.endsWith("/artifacts/api-server");
    if (!isApiArtifact) continue;
    const presentOverrideKeys = testOverrideKeys.filter(
      (key) => env[key] !== undefined && env[key] !== "",
    );
    const processTarget = safeUrlTarget(env.DATABASE_URL);
    candidates.push({
      pid: Number(pid),
      command: argv,
      cwd,
      isApiArtifact,
      relevantEnvironmentPresence: Object.fromEntries(
        apiProcessRelevantKeys.map((key) => [key, env[key] !== undefined && env[key] !== ""]),
      ),
      databaseUrlTarget: processTarget,
      databaseUrlTargetMatchesInventory: sameNonSecretTarget(
        processTarget,
        inventoryTarget ?? { present: false },
      ),
      testOverridePresenceMatchesInventory:
        presentOverrideKeys.length === inventoryOverrideKeys.length &&
        presentOverrideKeys.every((key) => inventoryOverrideKeys.includes(key)),
      presentTestOverrideKeys: presentOverrideKeys,
      actualDatabaseIdentityProvenFromApiProcess: true,
      actualDatabaseIdentityEvidence: API_POOL_IDENTITY_EVIDENCE,
    });
  }
  const staticSourcePath = resolve(repositoryRoot, "artifacts/api-server/src/index.ts");
  const staticSource = await readFile(staticSourcePath, "utf8");
  const distPath = resolve(repositoryRoot, "artifacts/api-server/dist/index.mjs");
  const distSource = await readFile(distPath, "utf8");
  return {
    processCount: candidates.length,
    processes: candidates,
    startupInspection: {
      sourceFile: relative(repositoryRoot, staticSourcePath),
      distFile: relative(repositoryRoot, distPath),
      sourceImportsWorkspaceDb: /from ["']@workspace\/db["']/.test(staticSource),
      sourceHasDotenvOrLoadEnv:
        /\bdotenv\b|loadEnv|envFile|dotenv\/config/i.test(staticSource),
      sourceAssignsDatabaseUrl:
        /process\.env(?:\[['"]DATABASE_URL['"]\]|\.DATABASE_URL)\s*=/.test(staticSource),
      distHasDotenvOrLoadEnv: /\bdotenv\b|loadEnv|envFile|dotenv\/config/i.test(distSource),
      note:
        "The running API process configuration is inspected without printing environment values. Effective API-pool identity is confirmed separately by the read-only in-process evidence cited in apiPoolIdentityEvidence.",
      apiPoolIdentityEvidence: API_POOL_IDENTITY_EVIDENCE,
    },
  };
}

async function inspectCacheRebuildFunction(): Promise<JsonObject> {
  const sourcePath = resolve(repositoryRoot, "artifacts/api-server/src/lib/inventario.ts");
  const source = await readFile(sourcePath, "utf8");
  const start = source.indexOf("export async function reconstruirCacheExistencias");
  const nextExport = source.indexOf("\nexport ", start + 1);
  const end = nextExport === -1 ? source.length : nextExport;
  const sourceBefore = source.slice(0, start);
  const lineStart = sourceBefore.split(/\r?\n/).length;
  const sourceFragment = source.slice(start, end);
  return {
    sourceFile: relative(repositoryRoot, sourcePath),
    functionName: "reconstruirCacheExistencias",
    sourceLineStart: lineStart,
    sourceLineEnd: lineStart + sourceFragment.split(/\r?\n/).length - 1,
    acceptsCallerTransaction: /reconstruirCacheExistencias\(tx\?: Tx\)/.test(sourceFragment),
    opensStandaloneTransactionOnlyWithoutTx:
      /if \(!tx\)[\s\S]*db\.transaction/.test(sourceFragment),
    usesCallerTransactionWhenSupplied:
      /if \(!tx\)[\s\S]*return;[\s\S]*lockAllExistingInventoryPairs\(tx\)/.test(sourceFragment),
    readsCacheMovementAndRollPairs:
      /FROM existencias[\s\S]*FROM movimientos[\s\S]*FROM rollos/.test(sourceFragment),
    writesExistenciasWithConflictUpdate:
      /INSERT INTO existencias[\s\S]*ON CONFLICT[\s\S]*DO UPDATE/.test(sourceFragment),
    containsDeleteOrTruncate: /\b(?:DELETE|TRUNCATE)\b/i.test(sourceFragment),
    referencesPreservedCatalogTables:
      /\b(?:stock_minimos|stock_minimo_sitios|productos|ubicaciones)\b/i.test(sourceFragment),
    preservationAssessment:
      "La función no borra ni trunca existencias; usa la transacción recibida, bloquea pares y recalcula desde movimientos/rollos. No escribe stock_minimos, stock_minimo_sitios, productos ni ubicaciones, por lo que la configuración C queda fuera de su alcance.",
  };
}

function incomingForeignKeyClosure(
  rootTables: Set<string>,
  foreignKeys: Array<{ sourceTable: string; targetTable: string | null }>,
): JsonObject {
  const closure = new Set(rootTables);
  const queue = [...rootTables];
  const edges: JsonObject[] = [];
  while (queue.length > 0) {
    const targetTable = queue.shift()!;
    for (const foreignKey of foreignKeys) {
      if (foreignKey.targetTable !== targetTable) continue;
      edges.push(foreignKey);
      if (!closure.has(foreignKey.sourceTable)) {
        closure.add(foreignKey.sourceTable);
        queue.push(foreignKey.sourceTable);
      }
    }
  }
  return {
    rootTables: [...rootTables].sort(),
    closureTables: [...closure].sort(),
    outsideRootTables: [...closure].filter((table) => !rootTables.has(table)).sort(),
    edges,
  };
}

function drizzleRuntimeTables(): {
  exportedName: string;
  tableName: string;
  columns: JsonObject[];
  foreignKeys: JsonObject[];
}[] {
  const tables: {
    exportedName: string;
    tableName: string;
    columns: JsonObject[];
    foreignKeys: JsonObject[];
  }[] = [];

  for (const [exportedName, candidate] of Object.entries(
    drizzleSchema as Record<string, unknown>,
  )) {
    if (!exportedName.endsWith("Table") || !candidate || typeof candidate !== "object") {
      continue;
    }
    const table = candidate as Record<string | symbol, any>;
    const tableName = table[tableNameSymbol];
    if (typeof tableName !== "string") continue;
    const columns = Object.entries(table)
      .filter(
        ([, column]) =>
          column &&
          typeof column === "object" &&
          (column as { table?: unknown }).table === candidate &&
          typeof (column as { name?: unknown }).name === "string",
      )
      .map(([, column]) => {
        const value = column as {
          name: string;
          dataType?: string;
          columnType?: string;
          notNull?: boolean;
          hasDefault?: boolean;
          isUnique?: boolean;
          primary?: boolean;
        };
        return {
          name: value.name,
          dataType: value.dataType ?? null,
          columnType: value.columnType ?? null,
          notNull: value.notNull ?? false,
          hasDefault: value.hasDefault ?? false,
          isUnique: value.isUnique ?? false,
          primary: value.primary ?? false,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    const foreignKeys: JsonObject[] = [];
    const inlineForeignKeys = table[foreignKeysSymbol];
    if (Array.isArray(inlineForeignKeys)) {
      for (const foreignKey of inlineForeignKeys) {
        try {
          const reference = foreignKey.reference();
          foreignKeys.push({
            sourceTable: tableName,
            sourceColumns: reference.columns.map((column: any) => column.name),
            targetTable: reference.foreignColumns.map(
              (column: any) => column.table?.[tableNameSymbol],
            ),
            targetColumns: reference.foreignColumns.map((column: any) => column.name),
            onDelete: foreignKey.onDelete ?? "no action",
            onUpdate: foreignKey.onUpdate ?? "no action",
          });
        } catch (error) {
          foreignKeys.push({
            sourceTable: tableName,
            metadataError: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    tables.push({ exportedName, tableName, columns, foreignKeys });
  }
  return tables.sort((left, right) => left.tableName.localeCompare(right.tableName));
}

async function initializerAndMigrationSources(): Promise<JsonObject> {
  const roots = [
    { kind: "initializer", path: resolve(repositoryRoot, "lib/db/src/lib") },
    { kind: "migration", path: resolve(repositoryRoot, "lib/db/migrations") },
  ];
  const matches: JsonObject[] = [];
  const files: JsonObject[] = [];

  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root.path, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile() || !/\.(?:ts|mts|mjs|sql)$/.test(entry.name)) continue;
      if (/\.test\./.test(entry.name)) continue;
      const absolutePath = resolve(root.path, entry.name);
      const text = await readFile(absolutePath, "utf8");
      const foundTables = new Set<string>();
      const lines = text.split(/\r?\n/);
      for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        const line = lines[lineNumber];
        const matcher =
          /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"?[a-zA-Z_][\w]*"?)\.)?"?([a-zA-Z_][\w]*)"?/gi;
        let match: RegExpExecArray | null;
        while ((match = matcher.exec(line)) !== null) {
          const tableName = match[1].toLowerCase();
          foundTables.add(tableName);
          matches.push({
            kind: root.kind,
            file: relative(repositoryRoot, absolutePath),
            line: lineNumber + 1,
            tableName,
            sourceLine: line.trim(),
          });
        }
      }
      files.push({
        kind: root.kind,
        file: relative(repositoryRoot, absolutePath),
        staticCreateTableNames: [...foundTables].sort(),
      });
    }
  }
  return { files, createTableMatches: matches };
}

const queryRecords: QueryRecord[] = [];

async function main(): Promise<void> {
  const presentOverrides = testOverrideKeys.filter((key) => {
    const value = process.env[key];
    return value !== undefined && value !== "";
  });
  const connectionString = process.env.DATABASE_URL;
  const reportContext: JsonObject = {
    operation: "Prompt H Block 1 live read-only inventory and proposed ABC classification",
    status: "NOT_STARTED",
    startedAtUtc: new Date().toISOString(),
    startedAtMexicoCity: mexicoCityTimestamp(),
    connectionSelection: {
      source: "shell process environment",
      variable: "DATABASE_URL",
      configuredTarget: connectionString ? configuredTarget(connectionString) : null,
      testOverrideKeysChecked: testOverrideKeys,
      presentTestOverrides: presentOverrides,
      failClosed: presentOverrides.length > 0 || !connectionString,
      apiSourceInspection: {
        file: "lib/db/src/index.ts",
        selection:
          "The API selects DATABASE_URL unless TEST_DATABASE_URL/REQUIRE_ISOLATED_TEST_DATABASE changes selection; this diagnostic refuses those overrides.",
        actualApiRuntimeIdentityProven: true,
        identityEvidence: API_POOL_IDENTITY_EVIDENCE,
        distinction:
          "The direct pg connection is proven below, and the API's effective in-process pool identity is confirmed by the separate read-only evidence cited above.",
      },
    },
  };
  const outputPath = resolve(reportDirectory, `${reportBaseName}.json`);
  const markdownPath = resolve(reportDirectory, `${reportBaseName}.md`);
  reportContext.apiProcessInspection = await inspectRunningApiProcess(
    connectionString ? configuredTarget(connectionString) : null,
    presentOverrides,
  );
  reportContext.cacheRebuildInspection = await inspectCacheRebuildFunction();

  if (presentOverrides.length > 0 || !connectionString) {
    reportContext.status = "BLOCKED_TEST_OVERRIDE_OR_MISSING_DATABASE_URL";
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(outputPath, JSON.stringify(jsonSafe(reportContext), null, 2) + "\n");
    throw new Error(
      presentOverrides.length > 0
        ? `Refusing live inventory because test override(s) are present: ${presentOverrides.join(", ")}`
        : "Refusing live inventory because DATABASE_URL is missing",
    );
  }

  const sourceMetadata = {
    drizzleRuntimeTables: drizzleRuntimeTables(),
    initializerAndMigrationSources: await initializerAndMigrationSources(),
  };
  const Pool = (pgModule as any).default?.Pool ?? (pgModule as any).Pool;
  const pool = new Pool({
    connectionString,
    application_name: "prompt_h_block1_inventory_readonly",
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 180_000,
    query_timeout: 190_000,
  });

  let client: any;
  try {
    client = await pool.connect();
    const query = async (name: string, sql: string, params: unknown[] = []): Promise<any[]> => {
      try {
        const result = await client.query(sql, params);
        queryRecords.push({
          name,
          sql,
          params,
          command: result.command,
          rowCount: result.rowCount,
          rows: jsonSafe(result.rows) as unknown[],
        });
        return result.rows;
      } catch (error) {
        queryRecords.push({
          name,
          sql,
          params,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
    const command = async (name: string, sql: string): Promise<void> => {
      await query(name, sql);
    };

    await command("begin", "BEGIN");
    await command(
      "set_repeatable_read_read_only",
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
    );
    await command("set_statement_timeout", "SET LOCAL statement_timeout = '180s'");
    await command("set_lock_timeout", "SET LOCAL lock_timeout = '5s'");
    await command(
      "set_idle_in_transaction_timeout",
      "SET LOCAL idle_in_transaction_session_timeout = '300s'",
    );

    const identity = await query(
      "live_identity",
      `SELECT
         current_database() AS database_name,
         current_schema() AS schema_name,
         current_user AS current_user_name,
         session_user AS session_user_name,
         current_setting('server_version') AS server_version,
         current_setting('application_name') AS application_name,
         current_setting('transaction_isolation') AS transaction_isolation,
         current_setting('transaction_read_only') AS transaction_read_only`,
    );
    const transactionState = await query(
      "transaction_state",
      `SELECT
         current_setting('transaction_isolation') AS transaction_isolation,
         current_setting('transaction_read_only') AS transaction_read_only,
         current_setting('statement_timeout') AS statement_timeout,
         current_setting('lock_timeout') AS lock_timeout,
         current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout`,
    );

    const tableRows = await query(
      "ordinary_and_partition_tables",
      `SELECT
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
       ORDER BY n.nspname, c.relname`,
    );
    const liveTables = tableRows.map((row: any) => String(row.table_name));
    const liveTableRecords = tableRows.map((row: any) => ({
      schema: String(row.schema_name),
      table: String(row.table_name),
      relkind: String(row.relkind),
      persistence: String(row.persistence),
      isPartition: Boolean(row.is_partition),
      partitionKeyDefinition: row.partition_key_definition,
      comment: row.table_comment,
    }));

    const views = await query(
      "views_separate",
      `SELECT
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
       ORDER BY n.nspname, c.relname`,
    );
    const columns = await query(
      "columns",
      `SELECT
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
       ORDER BY n.nspname, c.relname, a.attnum`,
    );
    const constraints = await query(
      "constraints_and_foreign_keys",
      `SELECT
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
       ORDER BY source_ns.nspname, source_table.relname, con.conname`,
    );
    const triggers = await query(
      "non_internal_triggers_and_function_source",
      `SELECT
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
       ORDER BY n.nspname, c.relname, t.tgname`,
    );
    const sequences = await query(
      "sequences_and_ownership",
      `SELECT
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
       ORDER BY n.nspname, c.relname`,
    );

    const counts: JsonObject[] = [];
    for (const row of liveTableRecords) {
      const sql = `SELECT count(*)::text AS row_count FROM ${tableRef(row.schema, row.table)}`;
      const result = await query(`row_count:${row.schema}.${row.table}`, sql);
      counts.push({
        schema: row.schema,
        table: row.table,
        relkind: row.relkind,
        isPartition: row.isPartition,
        rowCount: String(result[0]?.row_count ?? "0"),
      });
    }

    const liveTableNameSet = new Set(liveTables);
    const schemaTables = sourceMetadata.drizzleRuntimeTables;
    const schemaTableNames = schemaTables.map((table) => table.tableName);
    const schemaTableNameSet = new Set(schemaTableNames);
    const columnRowsByTable = new Map<string, any[]>();
    for (const row of columns) {
      const table = String((row as any).table_name);
      const existing = columnRowsByTable.get(table) ?? [];
      existing.push(row);
      columnRowsByTable.set(table, existing);
    }
    const schemaColumnMismatches: JsonObject[] = [];
    for (const table of [...new Set([...liveTableNameSet, ...schemaTableNameSet])].sort()) {
      const liveColumnNames = (columnRowsByTable.get(table) ?? []).map((row: any) =>
        String(row.column_name),
      );
      const schemaColumnNames = (
        schemaTables.find((candidate) => candidate.tableName === table)?.columns ?? []
      ).map((column) => String(column.name));
      const liveColumnsSet = new Set(liveColumnNames);
      const schemaColumnsSet = new Set(schemaColumnNames);
      const liveOnlyColumns = liveColumnNames.filter((name) => !schemaColumnsSet.has(name));
      const schemaOnlyColumns = schemaColumnNames.filter((name) => !liveColumnsSet.has(name));
      if (liveOnlyColumns.length || schemaOnlyColumns.length) {
        schemaColumnMismatches.push({
          table,
          liveOnlyColumns,
          schemaOnlyColumns,
        });
      }
    }

    const liveForeignKeyCounts = new Map<string, number>();
    for (const row of constraints as any[]) {
      if (String(row.constraint_type) !== "f") continue;
      const table = String(row.source_table);
      liveForeignKeyCounts.set(table, (liveForeignKeyCounts.get(table) ?? 0) + 1);
    }
    const schemaForeignKeyCounts = new Map<string, number>();
    for (const table of schemaTables) {
      schemaForeignKeyCounts.set(table.tableName, table.foreignKeys.length);
    }
    const foreignKeyCountMismatches: JsonObject[] = [];
    for (const table of [...new Set([...liveForeignKeyCounts.keys(), ...schemaForeignKeyCounts.keys()])].sort()) {
      const liveCount = liveForeignKeyCounts.get(table) ?? 0;
      const schemaCount = schemaForeignKeyCounts.get(table) ?? 0;
      if (liveCount !== schemaCount) {
        foreignKeyCountMismatches.push({ table, liveCount, schemaCount });
      }
    }

    const classify = (table: string): "A" | "B" | "C" => {
      if (CLASS_B.has(table)) return "B";
      if (CLASS_C.has(table)) return "C";
      return "A";
    };
    const classifications = liveTables
      .sort()
      .map((table) => ({
        table,
        classification: classify(table),
        reason:
          REASONS[table] ??
          "A — No explicit catalog/configuration preservation basis was found, so the operational default applies.",
        rowCount: (counts.find((count) => count.table === table) as any)?.rowCount ?? null,
      }));
    const classificationCounts = {
      A: classifications.filter((item) => item.classification === "A").length,
      B: classifications.filter((item) => item.classification === "B").length,
      C: classifications.filter((item) => item.classification === "C").length,
    };

    const foreignKeyRows = (constraints as any[])
      .filter((row) => String(row.constraint_type) === "f")
      .map((row) => ({
        sourceSchema: row.source_schema,
        sourceTable: row.source_table,
        constraintName: row.constraint_name,
        constraintDefinition: row.constraint_definition,
        sourceClass: liveTableNameSet.has(String(row.source_table))
          ? classify(String(row.source_table))
          : null,
        targetSchema: row.target_schema,
        targetTable: row.target_table,
        targetClass: liveTableNameSet.has(String(row.target_table))
          ? classify(String(row.target_table))
          : null,
        deleteAction: row.delete_action,
        updateAction: row.update_action,
        validated: row.validated,
      }));
    const triggerRows = (triggers as any[]).map((row) => {
      const source = String(row.function_source ?? "");
      const appendOnlyEvidence =
        /append[- ]only|inmutable/i.test(source) ||
        /\bTG_OP\b[\s\S]{0,240}\bDELETE\b/i.test(source) ||
        /RAISE\s+EXCEPTION/i.test(source);
      return {
        schema: row.schema_name,
        table: row.table_name,
        trigger: row.trigger_name,
        enabledState: row.enabled_state,
        triggerTypeBits: row.trigger_type_bits,
        firesOnDelete: Boolean(row.fires_on_delete),
        firesOnTruncate: Boolean(row.fires_on_truncate),
        triggerDefinition: row.trigger_definition,
        functionSchema: row.function_schema,
        functionName: row.function_name,
        functionLanguage: row.function_language,
        appendOnlyEvidence,
        functionSource: row.function_source,
      };
    });

    const candidateATables = new Set(
      classifications
        .filter((item) => item.classification === "A")
        .map((item) => item.table),
    );
    const appendOnlyDeleteBlockers = triggerRows.filter(
      (trigger) =>
        candidateATables.has(String(trigger.table)) &&
        trigger.firesOnDelete &&
        trigger.appendOnlyEvidence &&
        trigger.enabledState !== "D",
    );
    const activeTruncateTriggers = triggerRows.filter(
      (trigger) =>
        candidateATables.has(String(trigger.table)) &&
        trigger.firesOnTruncate &&
        trigger.enabledState !== "D",
    );
    const cReferencingCandidateTables = foreignKeyRows.filter(
      (foreignKey) =>
        foreignKey.sourceClass === "C" &&
        foreignKey.targetClass === "A",
    );
    const outsideCandidateReferencingCandidate = foreignKeyRows.filter(
      (foreignKey) =>
        foreignKey.targetTable &&
        candidateATables.has(String(foreignKey.targetTable)) &&
        !candidateATables.has(String(foreignKey.sourceTable)),
    );
    const incomingFkClosureForA = incomingForeignKeyClosure(
      candidateATables,
      foreignKeyRows.map((foreignKey) => ({
        sourceTable: String(foreignKey.sourceTable),
        targetTable: foreignKey.targetTable
          ? String(foreignKey.targetTable)
          : null,
      })),
    );
    const feasibilityBlockers = [
      ...appendOnlyDeleteBlockers.map((trigger) => ({
        kind: "DELETE_APPEND_ONLY_TRIGGER",
        table: trigger.table,
        trigger: trigger.trigger,
        detail:
          "A row DELETE would be rejected by the active non-internal trigger/function evidence; TRUNCATE is analyzed separately and no trial write was executed.",
      })),
      ...activeTruncateTriggers.map((trigger) => ({
        kind: "ACTIVE_TRUNCATE_TRIGGER_REQUIRES_REVIEW",
        table: trigger.table,
        trigger: trigger.trigger,
        detail:
          "The active non-internal trigger fires on TRUNCATE; its definition/function source must be proven non-blocking before any candidate truncate.",
      })),
      ...outsideCandidateReferencingCandidate.map((foreignKey) => ({
        kind: "FK_FROM_PRESERVED_TABLE_TO_PURGE_TARGET",
        table: foreignKey.sourceTable,
        targetTable: foreignKey.targetTable,
        constraint: foreignKey.constraintName,
        detail:
          "TRUNCATE RESTRICT of A alone would be rejected because a table outside A (including B or C) references the target; CASCADE would violate preservation requirements.",
      })),
    ];
    const truncateAllowedByMetadata =
      feasibilityBlockers.filter(
        (blocker) =>
          blocker.kind !== "DELETE_APPEND_ONLY_TRIGGER" &&
          blocker.kind !== "ACTIVE_TRUNCATE_TRIGGER_REQUIRES_REVIEW",
      ).length === 0 &&
      activeTruncateTriggers.length === 0 &&
      (incomingFkClosureForA.outsideRootTables as string[]).length === 0;

    const sequenceRows = (sequences as any[]).map((row) => ({
      sequenceSchema: row.sequence_schema,
      sequence: row.sequence_name,
      dataType: row.data_type,
      startValue: row.start_value,
      minValue: row.min_value,
      maxValue: row.max_value,
      incrementBy: row.increment_by,
      cycle: row.cycle,
      cacheSize: row.cache_size,
      lastValue: row.last_value,
      ownerTableSchema: row.owner_table_schema,
      ownerTable: row.owner_table,
      ownerColumn: row.owner_column,
      ownershipDependencyType: row.ownership_dependency_type,
      ownerClassification:
        row.owner_table && liveTableNameSet.has(String(row.owner_table))
          ? classify(String(row.owner_table))
          : null,
    }));
    const counterDefaults = (columns as any[])
      .filter(
        (row) =>
          (CLASS_B.has(String(row.table_name)) ||
            /(?:folio|consecutivo)/i.test(String(row.table_name))) &&
          /^(ultimo_folio|ultimo_numero)$/i.test(String(row.column_name)),
      )
      .map((row) => ({
        table: row.table_name,
        column: row.column_name,
        liveDefaultExpression: row.default_expression,
        notNull: row.not_null,
        reportOnlyNoCorrection: true,
      }));
    const counterUpdates = counterUpdatesFor(counterDefaults);

    const initializerSources = sourceMetadata.initializerAndMigrationSources as any;
    const initializerAndMigrationTableNames = [
      ...new Set(
        (initializerSources.createTableMatches as any[]).map((match) =>
          String(match.tableName),
        ),
      ),
    ].sort();

    const liveOnlyTables = liveTables.filter((table) => !schemaTableNameSet.has(table)).sort();
    const schemaOnlyTables = schemaTableNames.filter((table) => !liveTableNameSet.has(table)).sort();
    const sourceDeclaredButNotLive = initializerAndMigrationTableNames.filter(
      (table) => !liveTableNameSet.has(table),
    );
    const liveWithoutStaticInitializerOrMigration = liveTables.filter(
      (table) => !initializerAndMigrationTableNames.includes(table),
    );
    const liveWithoutStaticSourceButDeclaredInDrizzle = liveWithoutStaticInitializerOrMigration.filter(
      (table) => schemaTableNameSet.has(table),
    );
    const liveWithoutAnySchemaOrStaticSource = liveWithoutStaticInitializerOrMigration.filter(
      (table) => !schemaTableNameSet.has(table),
    );
    const counterSequenceRows = sequenceRows.filter(
      (sequence) => String(sequence.ownerColumn ?? "").toLowerCase() === "folio",
    );
    const pendingOperationalFolioSequences =
      pendingOperationalFolioSequenceDecisions(sequenceRows);

    const proposedApproach = truncateAllowedByMetadata
      ? {
          status: "CONDITIONAL_METADATA_ALLOWED_NOT_EXECUTED",
          reason:
            "No preserved-table or B incoming FK edge to A, and no active TRUNCATE trigger on A, was found in the inspected metadata; this is only a proposed approach and remains pending new textual owner authorization after verified backup and preflight.",
          sql: [
            "BEGIN;",
            "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ WRITE;",
            `TRUNCATE TABLE ${[...candidateATables]
              .sort()
              .map((table) => tableRef("public", table))
              .join(", ")} CONTINUE IDENTITY RESTRICT;`,
            ...counterUpdates
              .filter((counter) => typeof counter.targetValue === "number")
              .map(
                (counter) =>
                  `UPDATE ${tableRef("public", String(counter.table))} SET ${quoteIdentifier(String(counter.column))} = ${counter.targetValue};`,
              ),
            "await reconstruirCacheExistencias(tx);",
            "COMMIT;",
          ].join("\n"),
          warnings: [
            "This SQL is not executed by Block 1.",
            "A is the only TRUNCATE target; existencias is never truncated. CONTINUE IDENTITY is explicit; RESTART IDENTITY is prohibited.",
            "The B counter rows use only the owner-approved targets: four per-site folio tables = 0, ticket_folio = 999, series_consecutivo = 1000000.",
            "reconstruirCacheExistencias(tx) must receive this same caller-owned transaction.",
            "No ALTER SEQUENCE, setval, or other sequence reset is proposed; internal IDs and their sequences remain preserved.",
            "No internal-ID or operational-folio sequence reset is proposed. contenedores_folio_seq remains PENDING because its business-folio semantics require a separate owner decision.",
            "Any future mutation requires new textual owner authorization after a verified backup and preflight.",
            "Counter defaults are report-only; this proposal does not change defaults.",
          ],
        }
      : {
          status: "BLOCKED_NO_FK_SAFE_SINGLE_TRANSACTION_PROPOSAL",
          reason:
            "The inspected active trigger/FK metadata does not permit proposing a FK-safe single-transaction truncate while preserving C; no candidate write was attempted.",
          blockers: feasibilityBlockers,
        };

    const report: JsonObject = {
      ...reportContext,
      status: "COMPLETE_READ_ONLY",
      completedAtUtc: new Date().toISOString(),
      completedAtMexicoCity: mexicoCityTimestamp(),
      liveIdentity: identity[0] ?? null,
      transactionState: transactionState[0] ?? null,
      inventory: {
        liveOrdinaryAndPartitionTableCount: liveTables.length,
        liveTables: liveTableRecords,
        relationCounts: counts,
        counterDefaults,
        viewsSeparately: jsonSafe(views),
        columns: jsonSafe(columns),
        constraintsAndForeignKeys: jsonSafe(constraints),
        nonInternalTriggersAndFunctionSource: triggerRows,
        sequencesSeparately: sequenceRows,
      },
      classification: {
        criterion:
          "Every live table defaults to A; only explicitly justified catalog/configuration tables are C, and exact counter tables plus existencias are B.",
        lists: {
          A: classifications.filter((item) => item.classification === "A"),
          B: classifications.filter((item) => item.classification === "B"),
          C: classifications.filter((item) => item.classification === "C"),
        },
        counts: classificationCounts,
        sum: classificationCounts.A + classificationCounts.B + classificationCounts.C,
        equalsLiveTableCount:
          classificationCounts.A + classificationCounts.B + classificationCounts.C ===
          liveTables.length,
        explicitNewTables: {
          revisiones_etiqueta: {
            live: liveTableNameSet.has("revisiones_etiqueta"),
            classification: liveTableNameSet.has("revisiones_etiqueta")
              ? classify("revisiones_etiqueta")
              : null,
          },
          ticket_linea_consumos: {
            live: liveTableNameSet.has("ticket_linea_consumos"),
            classification: liveTableNameSet.has("ticket_linea_consumos")
              ? classify("ticket_linea_consumos")
              : null,
          },
        },
      },
      schemaComparison: {
        drizzleRuntimeTableCount: schemaTables.length,
        drizzleRuntimeTables: schemaTables,
        liveOnlyTables,
        schemaOnlyTables,
        schemaColumnMismatches,
        liveForeignKeyCountMismatches: foreignKeyCountMismatches,
        initializerAndMigrationSources: sourceMetadata.initializerAndMigrationSources,
        initializerAndMigrationTableNames,
        sourceDeclaredButNotLive,
        liveWithoutStaticInitializerOrMigration,
        liveWithoutStaticSourceButDeclaredInDrizzle,
        liveWithoutAnySchemaOrStaticSource,
        cuadreFiscalRegistrosDrift:
          liveTableNameSet.has(CUADRE_FISCAL_SCHEMA_DRIFT.table) &&
          !schemaTableNameSet.has(CUADRE_FISCAL_SCHEMA_DRIFT.table)
            ? CUADRE_FISCAL_SCHEMA_DRIFT
            : null,
        note:
          "Runtime Drizzle metadata was imported from lib/db/src/schema/index.ts without importing lib/db/src/index.ts or initializing a database connection. Initializer/migration CREATE TABLE discovery is static text discovery and does not execute those files.",
      },
      feasibility: {
        candidateATruncateTables: [...candidateATables].sort(),
        counterUpdates,
        counterSequenceRows,
        pendingOperationalFolioSequences,
        appendOnlyDeleteBlockers,
        activeTruncateTriggers,
        cReferencingCandidateTables,
        outsideCandidateReferencingCandidate,
        incomingFkClosureForA,
        blockers: feasibilityBlockers,
        truncateAllowedByMetadata,
        proposedApproach,
        noTrialWritesExecuted: true,
        cacheRebuildInspection: reportContext.cacheRebuildInspection,
        auditHashRequirement:
          "An exact row-content hash for preserved C, especially auditoria, is not established by this metadata/count-only block; a later approved preflight must define a deterministic hash without exposing raw identities/tokens. The preserved audit table must not be mutated, and any append-only trigger makes DELETE-based cleanup impossible.",
        securityFinding: APPEND_ONLY_TRUNCATE_SECURITY_FINDING,
      },
      securityFindings: [
        {
          id: "APPEND_ONLY_DELETE_DOES_NOT_GUARD_TRUNCATE",
          scope: "database privileges",
          finding: APPEND_ONLY_TRUNCATE_SECURITY_FINDING,
          remediation: "SEPARATE_REVIEW",
          triggersUntouched: true,
          httpExploitAssertion: false,
        },
      ],
      approvalGate: {
        pendingOwnerApproval: true,
        block1Only: true,
        block2PlusNotStarted: true,
        authorizationTextRequiredBeforeAnyWrite: true,
        note:
          "This report proposes classifications only. No backup, restore, purge, sequence reset, trigger change, seed, authentication, branch, restart, or other write was performed. Any future mutation is pending new textual owner authorization after a verified backup and preflight.",
      },
      userFacingSummaryPath: relative(repositoryRoot, compactReportPath),
      exactSqlAndOutputs: queryRecords,
    };

    await command("rollback_read_only_transaction", "ROLLBACK");
    report.transactionEnd = "ROLLBACK";
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(outputPath, JSON.stringify(jsonSafe(report), null, 2) + "\n");
    await writeFile(markdownPath, renderMarkdown(report as any));
    await writeFile(compactReportPath, renderCompactSpanishReport(report));
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

function refineFeasibilityFromExistingReport(report: any): void {
  const classByTable = new Map<string, "A" | "B" | "C">();
  for (const bucket of ["A", "B", "C"] as const) {
    for (const item of report.classification?.lists?.[bucket] ?? []) {
      classByTable.set(String(item.table), bucket);
    }
  }
  const classify = (table: unknown): "A" | "B" | "C" | null =>
    classByTable.get(String(table)) ?? null;
  const aTables = new Set(
    [...classByTable.entries()]
      .filter(([, classification]) => classification === "A")
      .map(([table]) => table),
  );
  const foreignKeys = (report.inventory?.constraintsAndForeignKeys ?? [])
    .filter((row: any) => String(row.constraint_type) === "f")
    .map((row: any) => ({
      sourceSchema: row.source_schema,
      sourceTable: row.source_table,
      constraintName: row.constraint_name,
      constraintDefinition: row.constraint_definition,
      sourceClass: classify(row.source_table),
      targetSchema: row.target_schema,
      targetTable: row.target_table,
      targetClass: classify(row.target_table),
      deleteAction: row.delete_action,
      updateAction: row.update_action,
      validated: row.validated,
    }));
  const triggers = (report.inventory?.nonInternalTriggersAndFunctionSource ?? []).map(
    (trigger: any) => ({
      ...trigger,
      appendOnlyEvidence:
        Boolean(trigger.appendOnlyEvidence) ||
        /append[- ]only|inmutable/i.test(String(trigger.functionSource ?? "")) ||
        /RAISE\s+EXCEPTION/i.test(String(trigger.functionSource ?? "")),
    }),
  );
  const appendOnlyDeleteBlockers = triggers.filter(
    (trigger: any) =>
      aTables.has(String(trigger.table)) &&
      trigger.firesOnDelete &&
      trigger.appendOnlyEvidence &&
      trigger.enabledState !== "D",
  );
  const activeTruncateTriggers = triggers.filter(
    (trigger: any) =>
      aTables.has(String(trigger.table)) &&
      trigger.firesOnTruncate &&
      trigger.enabledState !== "D",
  );
  const cReferencingCandidateTables = foreignKeys.filter(
    (foreignKey: any) =>
      foreignKey.sourceClass === "C" && foreignKey.targetClass === "A",
  );
  const outsideCandidateReferencingCandidate = foreignKeys.filter(
    (foreignKey: any) =>
      aTables.has(String(foreignKey.targetTable)) &&
      !aTables.has(String(foreignKey.sourceTable)),
  );
  const incomingFkClosureForA = incomingForeignKeyClosure(
    aTables,
    foreignKeys.map((foreignKey: any) => ({
      sourceTable: String(foreignKey.sourceTable),
      targetTable: foreignKey.targetTable
        ? String(foreignKey.targetTable)
        : null,
    })),
  );
  const blockers = [
    ...appendOnlyDeleteBlockers.map((trigger: any) => ({
      kind: "DELETE_APPEND_ONLY_TRIGGER",
      table: trigger.table,
      trigger: trigger.trigger,
      detail:
        "Un DELETE por filas sería rechazado por el trigger no interno activo; TRUNCATE A se analiza por separado y no se ejecutó ninguna escritura de prueba.",
    })),
    ...activeTruncateTriggers.map((trigger: any) => ({
      kind: "ACTIVE_TRUNCATE_TRIGGER_REQUIRES_REVIEW",
      table: trigger.table,
      trigger: trigger.trigger,
      detail:
        "El trigger no interno activo dispara con TRUNCATE; su definición debe demostrarse no bloqueante antes de truncar A.",
    })),
    ...outsideCandidateReferencingCandidate.map((foreignKey: any) => ({
      kind: "FK_FROM_OUTSIDE_A_TO_A_TARGET",
      table: foreignKey.sourceTable,
      targetTable: foreignKey.targetTable,
      constraint: foreignKey.constraintName,
      detail:
        "TRUNCATE A RESTRICT fallaría porque una tabla fuera de A (B o C) referencia el destino; CASCADE no se permite porque alteraría conservación.",
    })),
  ];
  const counterDefaults = report.inventory?.counterDefaults ?? [];
  const counterUpdates = counterUpdatesFor(counterDefaults);
  const sequenceRows = report.inventory?.sequencesSeparately ?? [];
  const counterSequenceRows = sequenceRows.filter(
    (sequence: any) => String(sequence.ownerColumn ?? "").toLowerCase() === "folio",
  );
  const pendingOperationalFolioSequences =
    pendingOperationalFolioSequenceDecisions(sequenceRows);
  const truncateAllowedByMetadata =
    activeTruncateTriggers.length === 0 &&
    (incomingFkClosureForA.outsideRootTables as string[]).length === 0;
  const proposedApproach = truncateAllowedByMetadata
    ? {
        status: "CONDITIONAL_METADATA_ALLOWED_NOT_EXECUTED",
        reason:
          "No hay FK entrante desde B/C hacia A ni trigger activo de TRUNCATE sobre A; la estrategia propuesta trunca solo A, aplica los objetivos B aprobados y reconstruye existencias con la transacción recibida. Sigue pendiente de nueva autorización textual después de respaldo verificado y preflight.",
        sql: [
          "BEGIN;",
          "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ WRITE;",
          `TRUNCATE TABLE ${[...aTables]
            .sort()
            .map((table) => tableRef("public", table))
            .join(", ")} CONTINUE IDENTITY RESTRICT;`,
          ...counterUpdates
            .filter((counter: any) => typeof counter.targetValue === "number")
            .map(
              (counter: any) =>
                `UPDATE ${tableRef("public", String(counter.table))} SET ${quoteIdentifier(String(counter.column))} = ${counter.targetValue};`,
            ),
          "await reconstruirCacheExistencias(tx);",
          "COMMIT;",
        ].join("\n"),
        warnings: [
          "No se ejecuta en Bloque 1.",
          "A es el único objetivo de TRUNCATE; existencias nunca se trunca. CONTINUE IDENTITY es explícito; RESTART IDENTITY está prohibido.",
          "reconstruirCacheExistencias(tx) debe recibir exactamente esta transacción; no abre otra.",
          "Los contadores B usan únicamente los objetivos aprobados: cuatro folios por sitio = 0, ticket_folio = 999 y series_consecutivo = 1000000; los defaults se reportan y no se corrigen.",
          "No se propone ALTER SEQUENCE, setval ni ningún reset de secuencia; los IDs internos y sus secuencias se conservan.",
          "contenedores_folio_seq queda PENDING por su semántica de folio de negocio ambigua; no se reinicia en este turno.",
          "Cualquier mutación futura queda pendiente de nueva autorización textual del propietario después de respaldo verificado y preflight.",
        ],
      }
    : {
        status: "BLOCKED_NO_FK_SAFE_SINGLE_TRANSACTION_PROPOSAL",
        reason:
          "La metadata activa no permite proponer TRUNCATE A RESTRICT mientras se conserva B/C; no se intentó ninguna escritura.",
        blockers,
      };
  if (report.feasibility) {
    const obsoleteCandidateField = ["candidate", "PurgeTables"].join("");
    delete report.feasibility[obsoleteCandidateField];
  }
  const liveOnlyTables = (report.schemaComparison?.liveOnlyTables ?? []).map(String);
  const drizzleRuntimeTables = (
    report.schemaComparison?.drizzleRuntimeTables ?? []
  ).map((table: any) => String(table.tableName));
  report.schemaComparison = {
    ...report.schemaComparison,
    cuadreFiscalRegistrosDrift:
      liveOnlyTables.includes(CUADRE_FISCAL_SCHEMA_DRIFT.table) &&
      !drizzleRuntimeTables.includes(CUADRE_FISCAL_SCHEMA_DRIFT.table)
        ? CUADRE_FISCAL_SCHEMA_DRIFT
        : null,
  };
  report.feasibility = {
    ...report.feasibility,
    candidateATruncateTables: [...aTables].sort(),
    counterUpdates,
    counterSequenceRows,
    pendingOperationalFolioSequences,
    appendOnlyDeleteBlockers,
    activeTruncateTriggers,
    cReferencingCandidateTables,
    outsideCandidateReferencingCandidate,
    incomingFkClosureForA,
    blockers,
    truncateAllowedByMetadata,
    proposedApproach,
    noTrialWritesExecuted: true,
    cacheRebuildInspection:
      report.cacheRebuildInspection ?? (awaitableCacheInspectionPlaceholder() as any),
    auditHashRequirement:
      "El hash exacto de filas C, incluida auditoria, no se establece en este bloque de metadata/conteos; un preflight aprobado debe definirlo sin exponer identidades/tokens. auditoria no se muta.",
    securityFinding: APPEND_ONLY_TRUNCATE_SECURITY_FINDING,
  };
  report.securityFindings = [
    {
      id: "APPEND_ONLY_DELETE_DOES_NOT_GUARD_TRUNCATE",
      scope: "database privileges",
      finding: APPEND_ONLY_TRUNCATE_SECURITY_FINDING,
      remediation: "SEPARATE_REVIEW",
      triggersUntouched: true,
      httpExploitAssertion: false,
    },
  ];
}

function awaitableCacheInspectionPlaceholder(): JsonObject {
  return {
    sourceFile: "artifacts/api-server/src/lib/inventario.ts",
    functionName: "reconstruirCacheExistencias",
    inspectionPending:
      "La captura histórica no contenía esta inspección; una futura captura completa la adjuntará.",
  };
}

function renderCompactSpanishReport(report: any): string {
  const lines: string[] = [];
  const classification = report.classification;
  const inventory = report.inventory;
  const api = report.apiProcessInspection;
  const apiProcess = api?.processes?.[0];
  lines.push("# Prompt H — Bloque 1: listas vivas y propuesta ABC");
  lines.push("");
  lines.push(`- **Estado:** ${report.status}.`);
  lines.push(
    `- **Identidad directa de inventario:** ${report.liveIdentity?.database_name ?? "no disponible"}/${report.liveIdentity?.schema_name ?? "no disponible"}; transacción ${report.transactionState?.transaction_isolation ?? "no disponible"} READ ONLY.`,
  );
  lines.push(
    "- **Escrituras:** ninguna; no se hizo respaldo todavía, no se ejecutó purga, no se cambió trigger/secuencia/default, y no se hizo prueba de escritura.",
  );
  lines.push(
    "- **Regla de aprobación:** la aprobación del propietario de estas listas es necesaria antes del preflight y de la purga; no equivale por sí sola a autorización textual de purga. El respaldo completo verificado fue solicitado como trabajo separado y aún no se hizo.",
  );
  lines.push("");
  lines.push("## Identidad de la API");
  lines.push("");
  if (apiProcess) {
    lines.push(`- Proceso detectado: PID ${apiProcess.pid}, \`${apiProcess.command?.join(" ")}\`, cwd \`${apiProcess.cwd}\`.`);
    lines.push(
      `- Comparación no secreta de destino DATABASE_URL contra la fuente del inventario: ${apiProcess.databaseUrlTargetMatchesInventory}.`,
    );
    lines.push(
      `- Presencia de overrides de prueba coincide con la fuente del inventario: ${apiProcess.testOverridePresenceMatchesInventory}; overrides presentes: ${(apiProcess.presentTestOverrideKeys ?? []).join(", ") || "ninguno"}.`,
    );
    lines.push(
      "- No se expusieron valores de entorno, credenciales ni URLs; solo presencia, coincidencia booleana y destino no secreto.",
    );
    lines.push(
      `- Identidad efectiva **CONFIRMADA** desde el pool en proceso de la API: \`${API_POOL_IDENTITY_EVIDENCE.database}/${API_POOL_IDENTITY_EVIDENCE.schema}\`; evidencia de solo lectura: \`${API_POOL_IDENTITY_EVIDENCE.evidencePath}\`.`,
    );
  } else {
    lines.push(
      `- Identidad efectiva **CONFIRMADA** por evidencia previa del pool en proceso: \`${API_POOL_IDENTITY_EVIDENCE.database}/${API_POOL_IDENTITY_EVIDENCE.schema}\`; \`${API_POOL_IDENTITY_EVIDENCE.evidencePath}\`.`,
    );
  }
  lines.push(
    "- La confirmación no abrió endpoint público, no reinició la API, no cambió autenticación/entorno y dejó cerrado el inspector de loopback.",
  );
  lines.push(
    `- Inspección de arranque: source importa @workspace/db=${api?.startupInspection?.sourceImportsWorkspaceDb}; dotenv/loadEnv en source=${api?.startupInspection?.sourceHasDotenvOrLoadEnv}; asignación DATABASE_URL en source=${api?.startupInspection?.sourceAssignsDatabaseUrl}; dotenv/loadEnv en dist=${api?.startupInspection?.distHasDotenvOrLoadEnv}.`,
  );
  lines.push("");
  lines.push("## Totales y diferencias");
  lines.push("");
  lines.push(
    `- Tablas vivas ordinarias/particionadas: **${inventory.liveOrdinaryAndPartitionTableCount}**; Drizzle runtime: **${report.schemaComparison.drizzleRuntimeTableCount}**. Diferencia viva/no declarada: \`${report.schemaComparison.liveOnlyTables.join(", ") || "ninguna"}\`.`,
  );
  lines.push(
    `- ABC: A=${classification.counts.A}, B=${classification.counts.B}, C=${classification.counts.C}; suma=${classification.sum} y coincide=${classification.equalsLiveTableCount}.`,
  );
  lines.push(
    `- Deriva de esquema: \`cuadre_fiscal_registros\` está viva y ausente de Drizzle=${Boolean(report.schemaComparison.cuadreFiscalRegistrosDrift)}; se reporta solamente, sin crearla ni borrarla del esquema.`,
  );
  lines.push(
    "- Las secuencias se listan aparte y no suman al total de tablas; hay " +
      `${inventory.sequencesSeparately.length}. Triggers no internos vivos: ${inventory.nonInternalTriggersAndFunctionSource.length} (conteo actual; el 11 es histórico).`,
  );
  lines.push(
    `- Mismatches: columnas/tablas=${report.schemaComparison.schemaColumnMismatches.length}; conteos FK=${report.schemaComparison.liveForeignKeyCountMismatches.length}.`,
  );
  lines.push("");
  for (const bucket of ["A", "B", "C"] as const) {
    lines.push(`## Lista ${bucket} (${classification.counts[bucket]})`);
    lines.push("");
    lines.push("| Tabla | Filas | Razón |");
    lines.push("|---|---:|---|");
    for (const item of classification.lists[bucket]) {
      lines.push(`| \`${item.table}\` | ${item.rowCount} | ${item.reason} |`);
    }
    lines.push("");
  }
  lines.push("## Hallazgos explícitos");
  lines.push("");
  lines.push(
    "- `revisiones_etiqueta` está viva y queda en A; `ticket_linea_consumos` está viva y queda en A.",
  );
  lines.push(
    "- `productos` queda en C y conserva el catálogo, incluidos sus colores; `precio_historial` queda en C.",
  );
  lines.push(
    `- Defaults B (solo reporte, sin corrección): ${JSON.stringify(inventory.counterDefaults)}.`,
  );
  lines.push(
    `- DELETE bloqueado por triggers append-only/inmutables activos: ${report.feasibility.appendOnlyDeleteBlockers.length}; triggers activos de TRUNCATE sobre A: ${report.feasibility.activeTruncateTriggers.length}.`,
  );
  lines.push(
    `- Hallazgo de seguridad (remediación separada; triggers intactos): ${APPEND_ONLY_TRUNCATE_SECURITY_FINDING}`,
  );
  lines.push(
    `- FK entrantes desde B/C hacia A: ${report.feasibility.outsideCandidateReferencingCandidate.length}; FK entrantes específicamente desde C: ${report.feasibility.cReferencingCandidateTables.length}.`,
  );
  lines.push(
    `- Cierre de FK entrante para A: ${report.feasibility.incomingFkClosureForA.outsideRootTables.length === 0 ? "solo A (sin tablas fuera de A)" : report.feasibility.incomingFkClosureForA.outsideRootTables.join(", ")}.`,
  );
  lines.push("");
  lines.push("## Estrategia propuesta, sin ejecutar");
  lines.push("");
  lines.push(
    `- Permitida por metadata para revisión: ${report.feasibility.truncateAllowedByMetadata}. Solo **TRUNCATE A CONTINUE IDENTITY RESTRICT**; B nunca es objetivo de TRUNCATE.`,
  );
  lines.push(
    "- B contadores (propuesta report-only): `entrada_folio`, `salida_folio`, `viaje_folio` y `auditoria_inventario_folio` → 0; `ticket_folio` → 999; `series_consecutivo` → 1000000. `existencias` no se trunca.",
  );
  lines.push(
    "- Luego, dentro de la misma transacción propietaria: `await reconstruirCacheExistencias(tx)`. La función acepta la transacción, bloquea pares, lee `existencias`/`movimientos`/`rollos`, actualiza por `ON CONFLICT`, y no escribe configuración C.",
  );
  lines.push(
    `- Inspección estática de caché: ${report.cacheRebuildInspection.sourceFile}:${report.cacheRebuildInspection.sourceLineStart}-${report.cacheRebuildInspection.sourceLineEnd}; acepta tx=${report.cacheRebuildInspection.acceptsCallerTransaction}, usa tx recibida=${report.cacheRebuildInspection.usesCallerTransactionWhenSupplied}, contiene DELETE/TRUNCATE=${report.cacheRebuildInspection.containsDeleteOrTruncate}.`,
  );
  lines.push(
    `- Secuencias de folio detectadas: ${report.feasibility.counterSequenceRows.map((row: any) => row.sequence).join(", ") || "ninguna"}; no se reinicia ninguna secuencia. Pendiente explícito: ${report.feasibility.pendingOperationalFolioSequences?.map((row: any) => row.sequence).join(", ") || "ninguna"}.`,
  );
  lines.push(
    `- Hash exacto de C/auditoria: pendiente del preflight aprobado; este bloque solo tiene metadata/conteos y no expone filas.`,
  );
  lines.push(
    "- Toda mutación futura queda PENDIENTE de nueva autorización textual del propietario después de respaldo verificado y preflight; esta aprobación de listas no autoriza ejecutar.",
  );
  lines.push("");
  lines.push("## Evidencia y puerta de aprobación");
  lines.push("");
  lines.push(
    "- Evidencia SQL exacta y outputs completos: `reports/prompt-h/block1-live-inventory.json` y su Markdown técnico. Esta lista compacta es el documento user-facing separado.",
  );
  lines.push(
    "**PENDIENTE DE APROBACIÓN EXPLÍCITA DEL PROPIETARIO.** No iniciar preflight/purga ni ningún Bloque 2+ desde este reporte.",
  );
  return lines.join("\n") + "\n";
}

async function refineExistingReport(): Promise<void> {
  const outputPath = resolve(reportDirectory, `${reportBaseName}.json`);
  const markdownPath = resolve(reportDirectory, `${reportBaseName}.md`);
  const report = JSON.parse(await readFile(outputPath, "utf8"));
  const apiProcessInspection = await inspectRunningApiProcess(
    report.connectionSelection?.configuredTarget ?? null,
    report.connectionSelection?.presentTestOverrides ?? [],
  );
  const cacheRebuildInspection = await inspectCacheRebuildFunction();
  report.apiProcessInspection = apiProcessInspection;
  report.cacheRebuildInspection = cacheRebuildInspection;
  refineFeasibilityFromExistingReport(report);
  report.status = "COMPLETE_READ_ONLY_REFINED_HISTORICAL_CONFIG_ONLY";
  report.refinement = {
    mode: "offline refinement from existing captured evidence",
    databaseCaptureRerun: false,
    changedInputs: [
      "revisión de proceso API dist/index.mjs y su entorno por presencia/coincidencia booleana",
      "evidencia separada de identidad efectiva del pool API: reports/prompt-h/api-pool-identity-2026-09-15.md",
      "inspección estática de reconstruirCacheExistencias(tx)",
      "cierre FK recalculado para TRUNCATE A solamente",
    ],
    secretsPrintedOrStored: false,
    identityStatus:
      "La captura config-only del Bloque 1 es histórica; la identidad efectiva actual quedó confirmada por el pool en proceso y ya no es un bloqueo.",
  };
  report.userFacingSummaryPath = relative(repositoryRoot, compactReportPath);
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(outputPath, JSON.stringify(jsonSafe(report), null, 2) + "\n");
  await writeFile(markdownPath, renderMarkdown(report));
  await writeFile(compactReportPath, renderCompactSpanishReport(report));
}

function renderMarkdown(report: any): string {
  const lines: string[] = [];
  const inventory = report.inventory;
  const classification = report.classification;
  lines.push("# Prompt H — Block 1 live read-only inventory");
  lines.push("");
  lines.push(`- **Status:** ${report.status}`);
  lines.push(`- **Started (Ciudad de México):** ${report.startedAtMexicoCity}`);
  lines.push(`- **Completed (Ciudad de México):** ${report.completedAtMexicoCity}`);
  lines.push("- **Writes:** none; one REPEATABLE READ / READ ONLY transaction, ended with ROLLBACK.");
  lines.push("- **Secrets:** DATABASE_URL value, credentials, and raw table rows are omitted.");
  lines.push("");
  lines.push("## Connection identity and boundary");
  lines.push("");
  lines.push(`- Direct pg identity: \`${JSON.stringify(report.liveIdentity)}\``);
  lines.push(`- Transaction settings: \`${JSON.stringify(report.transactionState)}\``);
  lines.push(
    "- Source selection: `lib/db/src/index.ts` selects `DATABASE_URL` for a normal process; test override keys were checked and none were present.",
  );
  lines.push(
    `- API process inspection: ${JSON.stringify(report.apiProcessInspection ?? { inspected: false })}; effective pool identity is confirmed by read-only evidence \`${API_POOL_IDENTITY_EVIDENCE.evidencePath}\` as ${API_POOL_IDENTITY_EVIDENCE.database}/${API_POOL_IDENTITY_EVIDENCE.schema}.`,
  );
  lines.push(
    "- Identity confirmation used the existing in-process pool without a public endpoint or restart; authentication/environment were unchanged and the loopback inspector was closed.",
  );
  lines.push("");
  lines.push("## Live table inventory and classification");
  lines.push("");
  lines.push(
    `- Live ordinary/partition tables: **${inventory.liveOrdinaryAndPartitionTableCount}**.`,
  );
  lines.push(
    `- Classification totals: A=${classification.counts.A}, B=${classification.counts.B}, C=${classification.counts.C}; sum=${classification.sum}; equals live total=${classification.equalsLiveTableCount}.`,
  );
  lines.push("- Sequences are reported separately and are not included in the table total.");
  for (const bucket of ["A", "B", "C"]) {
    lines.push("");
    lines.push(`### List ${bucket} (${classification.counts[bucket]})`);
    lines.push("");
    lines.push("| Table | Rows (metadata count) | One-sentence reason |");
    lines.push("|---|---:|---|");
    for (const item of classification.lists[bucket]) {
      lines.push(`| \`${item.table}\` | ${item.rowCount} | ${item.reason} |`);
    }
  }
  lines.push("");
  lines.push("Explicitly requested tables:");
  lines.push("");
  lines.push(
    `- \`revisiones_etiqueta\`: live=${report.classification.explicitNewTables.revisiones_etiqueta.live}; classification=${report.classification.explicitNewTables.revisiones_etiqueta.classification}.`,
  );
  lines.push(
    `- \`ticket_linea_consumos\`: live=${report.classification.explicitNewTables.ticket_linea_consumos.live}; classification=${report.classification.explicitNewTables.ticket_linea_consumos.classification}.`,
  );
  lines.push("");
  lines.push("## Live/schema comparison");
  lines.push("");
  lines.push(`- Drizzle runtime table count: **${report.schemaComparison.drizzleRuntimeTableCount}**.`);
  lines.push(`- Live-only tables: ${report.schemaComparison.liveOnlyTables.join(", ") || "none"}.`);
  lines.push(
    `- Schema drift finding: ${report.schemaComparison.cuadreFiscalRegistrosDrift ? "`cuadre_fiscal_registros` is live but absent from Drizzle; report only, do not change schema." : "none"}.`,
  );
  lines.push(`- Schema-only tables: ${report.schemaComparison.schemaOnlyTables.join(", ") || "none"}.`);
  lines.push(
    `- Column mismatches: ${report.schemaComparison.schemaColumnMismatches.length}; foreign-key count mismatches: ${report.schemaComparison.liveForeignKeyCountMismatches.length}.`,
  );
  lines.push(
    `- Static initializer/migration table names not live: ${report.schemaComparison.sourceDeclaredButNotLive.join(", ") || "none"}.`,
  );
  lines.push(
    `- Live tables without a static CREATE TABLE match but declared in Drizzle base schema: ${report.schemaComparison.liveWithoutStaticSourceButDeclaredInDrizzle.join(", ") || "none"}.`,
  );
  lines.push(
    `- Live tables without either a static initializer/migration match or a Drizzle declaration: ${report.schemaComparison.liveWithoutAnySchemaOrStaticSource.join(", ") || "none"}.`,
  );
  lines.push(
    `- Counter defaults (report only, no correction): ${JSON.stringify(inventory.counterDefaults)}.`,
  );
  lines.push(
    "- The JSON report contains runtime Drizzle columns, live columns/constraints, non-internal trigger function source, sequence ownership, views, and the initializer/migration source matches.",
  );
  lines.push("");
  lines.push("## Feasibility without trial writes");
  lines.push("");
  lines.push(
    `- Active append-only DELETE blockers: ${report.feasibility.appendOnlyDeleteBlockers.length}.`,
  );
  lines.push(
    `- Active TRUNCATE triggers on candidate A tables: ${report.feasibility.activeTruncateTriggers.length}.`,
  );
  lines.push(
    `- Preserved C tables referencing candidate A targets: ${report.feasibility.cReferencingCandidateTables.length}.`,
  );
  lines.push(
    `- FK references from B/C that block TRUNCATE A RESTRICT: ${report.feasibility.outsideCandidateReferencingCandidate.length}.`,
  );
  lines.push(
    `- Incoming FK closure for A outside A: ${report.feasibility.incomingFkClosureForA?.outsideRootTables?.join(", ") || "none"}.`,
  );
  lines.push(`- Metadata-only truncate allowance: ${report.feasibility.truncateAllowedByMetadata}.`);
  lines.push(
    `- Proposed approach status: **${report.feasibility.proposedApproach.status}** — ${report.feasibility.proposedApproach.reason}`,
  );
  lines.push(
    "- No DELETE, TRUNCATE, ALTER SEQUENCE, trigger change, UPDATE, INSERT, trial write, or rollback-only write was executed. The report-only proposal truncates only A, applies the owner-approved B counter targets, and calls `reconstruirCacheExistencias(tx)` for existencias.",
  );
  lines.push(
    `- Security finding (separate remediation; triggers untouched): ${APPEND_ONLY_TRUNCATE_SECURITY_FINDING}`,
  );
  lines.push(
    `- Operational folio sequence decision: ${report.feasibility.pendingOperationalFolioSequences?.map((row: any) => `${row.sequence}: ${row.decision}`).join(" | ") || "none detected"}. No sequence reset is proposed.`,
  );
  lines.push(
    `- Audit exact-hash caveat: ${report.feasibility.auditHashRequirement}`,
  );
  lines.push("");
  lines.push("## Approval gate");
  lines.push("");
  lines.push(
    "**PENDING EXPLICIT OWNER APPROVAL FOR ANY MUTATION.** This is Block 1 only; Block 2 and later are not started. The three live lists may be approved independently, but any future mutation requires new textual owner authorization after a verified backup and preflight. No backup is represented as verified by this report.",
  );
  lines.push("");
  lines.push("## Exact SQL and outputs");
  lines.push("");
  lines.push(
    "The JSON sibling `block1-live-inventory.json` stores every SQL string and its output rows exactly as captured (without credentials or raw application rows).",
  );
  for (const entry of report.exactSqlAndOutputs ?? []) {
    lines.push("");
    lines.push(`### ${entry.name}`);
    lines.push("");
    lines.push("```sql");
    lines.push(entry.sql);
    lines.push("```");
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          command: entry.command,
          rowCount: entry.rowCount,
          rows: entry.rows,
          error: entry.error,
        },
        null,
        2,
      ),
    );
    lines.push("```");
  }
  return lines.join("\n") + "\n";
}

try {
  if (process.argv.includes("--refine-existing")) {
    await refineExistingReport();
  } else {
    await main();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}