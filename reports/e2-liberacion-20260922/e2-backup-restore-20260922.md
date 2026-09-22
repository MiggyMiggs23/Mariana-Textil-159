# E2 CLOSED — respaldo + restauración desechable local — 2026-09-22

## Veredicto

**PASS**.

La autorización actual usada es `/home/runner/workspace/reports/e2-paquete-liberacion-preparado-20260921/autorizacion-fase-b-20260922-recibida.txt` (SHA-256
`ea0115d5b57cc3ca5a356271e65164f00bca5acd60f58ac83a4f605f572f788b`). Esta ejecución se limitó a respaldo y
restauración local. No ejecutó Drive, preflight, purga, seed, identidad de
aplicación, ni reinicio de API/workflows. No se hicieron escrituras en la base
fuente. Drive sigue siendo un prerrequisito posterior independiente: este
reporte nunca afirma que fue ejecutado. Los demás client backends antes de
iniciar el snapshot fueron: **0**.

## Fuente exacta del operador

- Archivo: `/home/runner/workspace/scripts/src/e2-release-backup-20260922.mts`
- SHA-256 del archivo ejecutado: `00fd86f205664de840edd816729759b79203486b0041b7bc6e3977c42c13b311`
- Commit HEAD: `b9acb26f5fed5e54a8cbf53ca192299bd701d2f7`
- Árbol del commit HEAD: `8e9f9c215b0e11ee59a136094a5c9411e696904b`
- Padre del commit HEAD: `e263d2dfb14b2308c4c276252e0bcbec29892877`
- SHA-256 del diff binario exacto contra el operador original:
  `58426e7039318de550a0922a7aa47e651cfc86d727d4f33086c8f85a431b6af0`
- Invocación exacta (arreglo argv; DATABASE_URL no se registra):
  `["/nix/store/9cyx2v23dip6p9q98384k9v06c96qskb-nodejs-24.13.0/bin/node","/home/runner/workspace/scripts/src/e2-release-backup-20260922.mts"]`
- Diff binario exacto contra `scripts/src/prompt-h-block2-backup-restore.mts`:

```diff
diff --git a/home/runner/workspace/scripts/src/prompt-h-block2-backup-restore.mts b/home/runner/workspace/scripts/src/e2-release-backup-20260922.mts
index bbdfdc8..e11bb6f 100644
--- a/home/runner/workspace/scripts/src/prompt-h-block2-backup-restore.mts
+++ b/home/runner/workspace/scripts/src/e2-release-backup-20260922.mts
@@ -1,12 +1,11 @@
 /**
- * Prompt H / Block 2: full backup and local disposable restore only.
+ * E2 CLOSED release prerequisite: full backup and local disposable restore.
  *
  * This operator-only command intentionally does not run a preflight, purge,
  * seed, API initializer, Drive operation, or source write.  The source
  * connection remains in one REPEATABLE READ READ ONLY transaction until
  * pg_dump has completed.  The disposable PostgreSQL cluster is intentionally
- * left running after this command so that the later purge procedure can use
- * it for read queries.
+ * left running so a later Drive redownload restore and B0 comparison can use it.
  */
 import { createHash } from "node:crypto";
 import { execFile, execFileSync } from "node:child_process";
@@ -16,7 +15,7 @@ import { promisify } from "node:util";
 import { fileURLToPath } from "node:url";
 import type { Client as PgClient, QueryResultRow } from "../../lib/db/node_modules/@types/pg";
 // pg has no declarations in this workspace's local runtime package.
-// @ts-expect-error Runtime import is deliberately local to the workspace.
+// @ts-ignore Runtime import is deliberately local to the workspace.
 import pgRuntime from "../../lib/db/node_modules/pg/lib/index.js";
 
 type Row = QueryResultRow & Record<string, unknown>;
@@ -26,28 +25,10 @@ const execFileAsync = promisify(execFile);
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
 const BACKUPS = `${ROOT}/.local/backups`;
-const baseCatalogScope = process.argv.includes("--catalog-base-approved");
-const e1ApprovedScope = process.argv.includes("--e1-approved");
-const e10OperationalScope = process.argv.includes("--e10-operativo");
-const REPORTS = `${ROOT}/reports/${
-  e10OperationalScope
-    ? "e10-operativo-2026-09-18"
-    : e1ApprovedScope
-      ? "e1-ensayo-2026-09-17"
-      : baseCatalogScope
-        ? "base-catalog-2026-09-17"
-        : "prompt-h"
-}`;
-const APPROVAL = e10OperationalScope
-  ? `${ROOT}/reports/e10-autorizacion-operativa-2026-09-18.md`
-  : `${REPORTS}/${
-      e1ApprovedScope
-      ? "autorizacion.md"
-      : baseCatalogScope
-        ? "aprobacion.md"
-        : "aprobacion-listas-no-purga.md"
-    }`;
-const E1_IDENTITY = `${ROOT}/reports/e1-ensayo-2026-09-17/api-pool-identity.json`;
+const REPORTS = `${ROOT}/reports/e2-liberacion-20260922`;
+const APPROVAL =
+  `${ROOT}/reports/e2-paquete-liberacion-preparado-20260921/autorizacion-fase-b-20260922-recibida.txt`;
+const APPROVAL_SHA256 = "ea0115d5b57cc3ca5a356271e65164f00bca5acd60f58ac83a4f605f572f788b";
 const PG_BIN = "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
 const TZ = "America/Mexico_City";
 const LOCAL_SUPERUSER = "postgres";
@@ -98,7 +79,9 @@ interface Snapshot {
   sourceProvenance: {
     operatorFile: string;
     operatorSha256: string;
-    operatorDiffFromHeadSha256: string;
+    operatorDiffFromOriginalSha256: string;
+    operatorDiffFromOriginal: string;
+    invocation: string[];
     headCommit: string;
     headTree: string;
     headParent: string | null;
@@ -112,12 +95,8 @@ interface Snapshot {
     sequenceStateBeforeDump: SequenceState[];
     sequenceStateAfterDump?: SequenceState[];
     sequenceChangedDuringDump?: boolean;
-    apiPoolIdentityEvidence?: {
-      file: string;
-      sha256: string;
-      identity: Record<string, unknown>;
-    };
-    apiPoolIdentityMatched?: boolean;
+    identity: Row;
+    otherClientBackendsBeforeSnapshot: number;
   };
   archive?: {
     file: string;
@@ -146,60 +125,15 @@ interface RestoreMetadata {
 }
 
 let backupDirectory = "";
-let reportPath = `${REPORTS}/${e10OperationalScope ? "backup-restore.md" : "block2-restore.md"}`;
-let metadataPath = `${REPORTS}/${e10OperationalScope ? "backup-restore-metadata.json" : "block2-restore-metadata.json"}`;
+let reportPath = `${REPORTS}/e2-backup-restore-20260922.md`;
+let metadataPath = `${REPORTS}/e2-backup-restore-20260922-metadata.json`;
 let statePath = "";
 let stage = "initializing";
 let clusterStarted = false;
 
 function progress(message: string): void {
   stage = message;
-  console.error(`[prompt-h-block2] ${message}`);
-}
-
-function optionValue(name: string): string | null {
-  const prefix = `${name}=`;
-  const argument = process.argv.find((value) => value.startsWith(prefix));
-  return argument ? argument.slice(prefix.length) : null;
-}
-
-async function readPinnedApiIdentity(): Promise<{
-  file: string;
-  sha256: string;
-  identity: Record<string, unknown>;
-}> {
-  const supplied = optionValue("--api-pool-identity");
-  if (!supplied) {
-    throw new Error("E10 requires --api-pool-identity=<current evidence file>.");
-  }
-  const file = resolve(ROOT, supplied);
-  const reportsRoot = `${ROOT}/reports/`;
-  if (!file.startsWith(reportsRoot)) {
-    throw new Error("API pool identity evidence must be a file under reports/.");
-  }
-  const bytes = await fs.readFile(file);
-  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
-  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
-    throw new Error("API pool identity evidence is not an object.");
-  }
-  const evidence = parsed as Record<string, unknown>;
-  if (
-    evidence.actualProcessPool !== true ||
-    evidence.readOnly !== true ||
-    typeof evidence.apiPid !== "number" ||
-    typeof evidence.capturedAtUtc !== "string"
-  ) {
-    throw new Error("API pool identity evidence is not a read-only live-process capture.");
-  }
-  const identity = evidence.identity;
-  if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
-    throw new Error("API pool identity evidence has no identity object.");
-  }
-  return {
-    file,
-    sha256: createHash("sha256").update(bytes).digest("hex"),
-    identity: identity as Record<string, unknown>,
-  };
+  console.error(`[e2-release-backup-20260922] ${message}`);
 }
 
 function q(value: string): string {
@@ -364,23 +298,43 @@ function gitText(args: string[]): string {
   return gitOutput(args).trim();
 }
 
+function operatorDiff(originalFile: string, operatorFile: string): string {
+  try {
+    return execFileSync(
+      "git",
+      ["diff", "--no-index", "--binary", "--", originalFile, operatorFile],
+      {
+        cwd: ROOT,
+        encoding: "utf8",
+        stdio: ["ignore", "pipe", "ignore"],
+        maxBuffer: 32 * 1024 * 1024,
+      },
+    );
+  } catch (error) {
+    const result = error as { status?: number; stdout?: string };
+    if (result.status === 1 && typeof result.stdout === "string") return result.stdout;
+    throw new Error("Could not record exact operator diff.");
+  }
+}
+
 async function sourceProvenance(): Promise<Snapshot["sourceProvenance"]> {
   const operatorFile = fileURLToPath(import.meta.url);
+  const originalFile = `${ROOT}/scripts/src/prompt-h-block2-backup-restore.mts`;
   const operator = await sha256Size(operatorFile);
   const headCommit = gitText(["rev-parse", "HEAD"]);
   const headTree = gitText(["rev-parse", "HEAD^{tree}"]);
   const parentLine = gitText(["rev-list", "--parents", "-n", "1", "HEAD"]).split(/\s+/);
   const status = gitOutput(["status", "--porcelain=v1", "--untracked-files=all"]);
-  const operatorDiff = gitOutput([
-    "diff", "--binary", "HEAD", "--", "scripts/src/prompt-h-block2-backup-restore.mts",
-  ]);
+  const exactOperatorDiff = operatorDiff(originalFile, operatorFile);
   const workingTreeStatusPorcelainV1 = status
     ? status.replace(/\n$/, "").split("\n")
     : [];
   return {
     operatorFile,
     operatorSha256: operator.sha256,
-    operatorDiffFromHeadSha256: createHash("sha256").update(operatorDiff).digest("hex"),
+    operatorDiffFromOriginalSha256: createHash("sha256").update(exactOperatorDiff).digest("hex"),
+    operatorDiffFromOriginal: exactOperatorDiff,
+    invocation: [process.execPath, ...process.argv.slice(1)],
     headCommit,
     headTree,
     headParent: parentLine[1] ?? null,
@@ -736,9 +690,9 @@ async function restoreAndVerify(
   stampValue: string,
 ): Promise<{ metadata: RestoreMetadata; comparison: Record<string, unknown> }> {
   const cluster = `${backupDirectory}/restore-cluster`;
-  const socket = `/tmp/prompt-h-block2-${stampValue}-${process.pid}`;
-  const admin = `restore_admin_${stampValue}`;
-  const restored = `restore_disposable_${stampValue}`;
+  const socket = `/tmp/e2-release-backup-20260922-${stampValue}-${process.pid}`;
+  const admin = `e2_restore_admin_${stampValue}`;
+  const restored = `e2_restore_disposable_${stampValue}`;
   if (existsSync(cluster)) throw new Error("A fresh restore cluster path already exists.");
   await createCluster(cluster, socket);
   // PostgreSQL cannot rename the database to which the session is connected.
@@ -891,23 +845,19 @@ function markdown(
     ? `- Administrador: \`${metadata.adminConnectionCommand}\`
 - Base restaurada: \`${metadata.restoredConnectionCommand}\``
     : "- Comandos de reconexión: no disponibles porque la restauración no completó.";
-  return `# ${e10OperationalScope ? "E10 operativo" : "Prompt H — Bloque 2"}: respaldo + restauración desechable local
+  return `# E2 CLOSED — respaldo + restauración desechable local — 2026-09-22
 
 ## Veredicto
 
 **${status}**${sequenceChanged ? " (se detectó cambio de estado de secuencias durante el dump; la comparación usa el estado capturado después del dump)" : ""}.
 
-La autorización usada es \`${APPROVAL}\`. Esta ejecución se limitó a respaldo y
+La autorización actual usada es \`${APPROVAL}\` (SHA-256
+\`${APPROVAL_SHA256}\`). Esta ejecución se limitó a respaldo y
 restauración local. No ejecutó Drive, preflight, purga, seed, identidad de
 aplicación, ni reinicio de API/workflows. No se hicieron escrituras en la base
-fuente. La aprobación de identidad de la aplicación queda separada para el
-agente principal.
-
-${e10OperationalScope ? `Cotejo de identidad de origen contra la evidencia
-actual del pool vivo de la API: \`${snapshot.source.apiPoolIdentityEvidence?.file ?? "no disponible"}\`
-(SHA-256 \`${snapshot.source.apiPoolIdentityEvidence?.sha256 ?? "no disponible"}\`):
-**${snapshot.source.apiPoolIdentityMatched ? "PASS" : "FAIL/no completado"}**. La API podía
-permanecer activa; cualquier cambio de secuencia durante la ventana causa FAIL.` : ""}
+fuente. Drive sigue siendo un prerrequisito posterior independiente: este
+reporte nunca afirma que fue ejecutado. Los demás client backends antes de
+iniciar el snapshot fueron: **${snapshot.source.otherClientBackendsBeforeSnapshot}**.
 
 ## Fuente exacta del operador
 
@@ -916,8 +866,16 @@ permanecer activa; cualquier cambio de secuencia durante la ventana causa FAIL.`
 - Commit HEAD: \`${snapshot.sourceProvenance.headCommit}\`
 - Árbol del commit HEAD: \`${snapshot.sourceProvenance.headTree}\`
 - Padre del commit HEAD: \`${snapshot.sourceProvenance.headParent ?? "sin padre"}\`
-- SHA-256 del diff binario del operador contra HEAD:
-  \`${snapshot.sourceProvenance.operatorDiffFromHeadSha256}\`
+- SHA-256 del diff binario exacto contra el operador original:
+  \`${snapshot.sourceProvenance.operatorDiffFromOriginalSha256}\`
+- Invocación exacta (arreglo argv; DATABASE_URL no se registra):
+  \`${JSON.stringify(snapshot.sourceProvenance.invocation)}\`
+- Diff binario exacto contra \`scripts/src/prompt-h-block2-backup-restore.mts\`:
+
+\`\`\`diff
+${snapshot.sourceProvenance.operatorDiffFromOriginal}
+\`\`\`
+- Metadata sanitizada: \`${metadataPath}\`
 - Árbol de trabajo limpio al capturar: **${snapshot.sourceProvenance.workingTreeClean ? "sí" : "no"}**
 - Estado porcelain v1: ${snapshot.sourceProvenance.workingTreeStatusPorcelainV1.length
     ? snapshot.sourceProvenance.workingTreeStatusPorcelainV1.map((line) => `\`${line}\``).join(", ")
@@ -927,6 +885,7 @@ permanecer activa; cualquier cambio de secuencia durante la ventana causa FAIL.`
 
 - Base efectiva: \`${snapshot.source.database.database_name}\`
 - PostgreSQL: \`${snapshot.source.database.server_version}\`
+- Identidad exigida/comprobada: \`heliumdb / OID 16384 / public / postgres / PG 160010\`
 - Snapshot UTC: \`${snapshot.capturedAtUtc}\`
 - Snapshot Mexico City: \`${snapshot.capturedAtMexico}\`
 - Transacción: \`REPEATABLE READ READ ONLY\`; \`pg_export_snapshot()\` fue
@@ -972,9 +931,9 @@ ${mismatchLines.length ? `## Discrepancias (procedimiento detenido)\n\n${mismatc
 ## Secuencias no-MVCC
 
 El estado de secuencias se capturó antes y después del dump fuera de la
-garantía MVCC. Cambio detectado: **${sequenceChanged ? "sí" : "no"}**. Un
-${e10OperationalScope ? "En E10 cualquier cambio detiene el procedimiento con FAIL; nunca se acepta silenciosamente." : ""}
-snapshot prueba el instante del respaldo, no frescura de un preflight
+garantía MVCC. Cambio detectado: **${sequenceChanged ? "sí" : "no"}**.
+En E2 cualquier desigualdad detiene el procedimiento con FAIL; nunca se acepta
+silenciosamente. Un snapshot prueba el instante del respaldo, no frescura de un preflight
 posterior; no se realizó ese preflight.
 
 ## Restauración local persistente
@@ -986,49 +945,53 @@ ${metadata ? `- Cluster: \`${metadata.clusterDirectory}\`
 ${reconnect}` : "- El cluster no quedó disponible."}
 
 El cluster, sus archivos y la base desechable **no se eliminan** después del
-éxito; ${e10OperationalScope
-    ? "deben conservarse junto con el respaldo hasta el cierre de E10."
-    : "deben permanecer disponibles hasta que el procedimiento completo de purga cierre."}
+éxito; deben conservarse para la comparación posterior de la restauración de
+la redescarga de Drive y para la comparación B0. No se purgan en este operador.
 La restauración no sembró usuarios ni identidad de aplicación.
 `;
 }
 
 async function main(): Promise<void> {
+  if (process.argv.slice(2).length !== 0) {
+    throw new Error("E2 mode is fixed; command-line scopes and connection arguments are disabled.");
+  }
   if (!existsSync(APPROVAL)) throw new Error("Owner approval file is missing.");
-  const approval = await fs.readFile(APPROVAL, "utf8");
-  const e1UserQuote = approval.split("\n").filter((line) => /^\s*>/.test(line)).join("\n");
-  const approved = e10OperationalScope
-    ? approval.includes("Respaldo nuevo antes, verificado por restauración") &&
-      approval.includes("Conserva la copia aislada y el respaldo hasta que E10 cierre")
-    : e1ApprovedScope
-    ? /respaldo/i.test(e1UserQuote) && /API pausado/i.test(e1UserQuote) && /ensayo/i.test(e1UserQuote)
-    : baseCatalogScope
-      ? /Apruebo la desactivación de los 12 candidatos/i.test(approval) && /respaldo nuevo/i.test(approval)
-      : /Apruebo las listas/i.test(approval) && /respaldo/i.test(approval);
-  if (!approved) {
-    throw new Error("Owner approval does not authorize the backup scope.");
+  const approvalBytes = await fs.readFile(APPROVAL);
+  const approvalHash = createHash("sha256").update(approvalBytes).digest("hex");
+  if (approvalHash !== APPROVAL_SHA256) throw new Error("Current E2 approval hash does not match.");
+  const approval = approvalBytes.toString("utf8");
+  for (const required of [
+    "Autorizo la liberación E2 CLOSED",
+    "Antes del SQL, exijo respaldo completo verificado en Google Drive",
+    "descarga/restauración de ensayo",
+    "El destino lógico es heliumdb, OID 16384, public, rol postgres, PostgreSQL 160010",
+  ]) {
+    if (!approval.includes(required)) {
+      throw new Error(`Current E2 approval is missing required prerequisite text: ${required}`);
+    }
   }
   const sourceUrl = process.env.DATABASE_URL;
-  if (!sourceUrl) throw new Error("DATABASE_URL is not configured.");
+  if (!sourceUrl) throw new Error("Parent-provided runtime DATABASE_URL is required.");
   for (const key of ["TEST_DATABASE_URL", "DATABASE_TEST_URL", "APPLICATION_DATABASE_URL"]) {
     if (process.env[key]) throw new Error(`Refusing test/application override: ${key}.`);
   }
-  // E10's evidence is deliberately loaded and validated before constructing or
-  // connecting the source client. The parent captures this from the live API
-  // process pool and supplies its path explicitly for this invocation.
-  const pinnedApiIdentity = e10OperationalScope ? await readPinnedApiIdentity() : null;
   const parts = parseSource(sourceUrl);
   if (parts.database !== "heliumdb") throw new Error("Effective DATABASE_URL must target heliumdb.");
+  for (const binary of ["pg_dump", "pg_restore", "initdb", "pg_ctl", "psql"]) {
+    if (!existsSync(`${PG_BIN}/${binary}`)) {
+      throw new Error(`Required retained PostgreSQL 16 binary is missing: ${binary}.`);
+    }
+  }
   const captured = new Date();
   const stampValue = `${stamp(captured)}-${process.pid}`;
-  backupDirectory = `${BACKUPS}/${e10OperationalScope ? "e10-operativo" : "prompt-h-block2"}-${stampValue}`;
+  backupDirectory = `${BACKUPS}/e2-release-backup-20260922-${stampValue}`;
   if (existsSync(backupDirectory) && readdirSync(backupDirectory).length > 0) {
     throw new Error("Backup directory already exists; refusing to reuse stale inventory.");
   }
   mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
   chmodSync(backupDirectory, 0o700);
   statePath = `${backupDirectory}/state.json`;
-  const dumpPath = `${backupDirectory}/${e10OperationalScope ? "e10-operativo" : "prompt-h-block2"}-${stampValue}.dump`;
+  const dumpPath = `${backupDirectory}/e2-release-backup-20260922-${stampValue}.dump`;
   const sourcePath = `${backupDirectory}/source-snapshot.json`;
   const restoreMetadataPath = `${backupDirectory}/restore-metadata.json`;
   await writePrivate(statePath, { status: "RUNNING", stage, updatedAtUtc: captured.toISOString() });
@@ -1044,7 +1007,8 @@ async function main(): Promise<void> {
         functions: [], triggers: [], sequences: [], database: {},
       },
       sequenceStateBeforeDump: [],
-      apiPoolIdentityEvidence: pinnedApiIdentity ?? undefined,
+      identity: {},
+      otherClientBackendsBeforeSnapshot: -1,
     },
   };
   let metadata: RestoreMetadata | null = null;
@@ -1055,98 +1019,56 @@ async function main(): Promise<void> {
   try {
     const sourceClient = new pg.Client({
       connectionString: sourceUrl,
-      application_name: e10OperationalScope ? "e10-operativo-readonly-backup" : "prompt-h-block2-backup",
-      options: e10OperationalScope ? "-c default_transaction_read_only=on -c timezone=UTC" : undefined,
+      application_name: "e2-release-backup-20260922-readonly",
+      options: "-c default_transaction_read_only=on -c timezone=UTC",
     });
     source = sourceClient;
     await source.connect();
     await source.query("SET TIME ZONE 'UTC'");
-    const identity = await one<{ database_name: string; server_version: string; server_version_num: string }>(
+    const clients = await one<{ count: number }>(
       source,
-      "SELECT current_database() AS database_name, current_setting('server_version') AS server_version, current_setting('server_version_num') AS server_version_num",
+      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'",
       [],
-      "Verifying effective source identity",
+      "Verifying zero other source clients before starting snapshot",
     );
-    if (identity.database_name !== "heliumdb") throw new Error("Source identity is not heliumdb.");
-    if (!identity.server_version.startsWith("16.10")) {
-      throw new Error("Source identity is not PostgreSQL 16.10.");
+    snapshot.source.otherClientBackendsBeforeSnapshot = clients.count;
+    if (clients.count !== 0) {
+      throw new Error("Other source client backends are connected; E2 snapshot blocked.");
     }
-    if (e1ApprovedScope || e10OperationalScope) {
-      const identityEvidence = e10OperationalScope
-        ? { identity: pinnedApiIdentity?.identity }
-        : JSON.parse(await fs.readFile(E1_IDENTITY, "utf8")) as {
-        identity?: Record<string, unknown>;
-      };
-      const expected = identityEvidence.identity;
-      if (!expected) throw new Error("API pool identity evidence has no identity object.");
-      const identityFields = e10OperationalScope
-        ? [
-            "database_name", "database_oid", "database_role", "schema_name",
-            "server_version", "server_address", "server_port", "server_started_at",
-            "unix_socket_directories", "data_directory", "configured_port",
-            "listen_addresses", "search_schemas", "replication_role",
-            "system_identifier",
-          ]
-        : [
-            "database_name", "database_oid", "server_version", "database_role",
-            "server_started_at", "server_address", "server_port",
-          ];
-      if (
-        identityFields.some((field) => !(field in expected)) ||
-        expected.server_address !== null ||
-        expected.server_port !== null
-      ) {
-        throw new Error("E1 API pool identity evidence has an invalid identity shape.");
-      }
-      const sourceIdentity = await one<Record<string, unknown>>(
-        source,
-        `SELECT current_database()::text AS database_name,
-                (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS database_oid,
-                current_user::text AS database_role,
-                current_schema()::text AS schema_name,
-                current_setting('server_version')::text AS server_version,
-                inet_server_addr()::text AS server_address,
-                inet_server_port()::int AS server_port,
-                pg_postmaster_start_time()::text AS server_started_at,
-                current_setting('unix_socket_directories')::text AS unix_socket_directories,
-                current_setting('data_directory')::text AS data_directory,
-                current_setting('port')::text AS configured_port,
-                current_setting('listen_addresses')::text AS listen_addresses,
-                current_schemas(false)::text[] AS search_schemas,
-                current_setting('session_replication_role')::text AS replication_role,
-                (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`,
-        [],
-        "Matching source to current API pool identity",
-      );
-      const expectedIdentity = Object.fromEntries(identityFields.map((field) => [
-        field,
-        field === "database_oid" || field === "system_identifier" || field === "configured_port"
-          ? String(expected[field])
-          : expected[field],
-      ]));
-      const comparableSourceIdentity = Object.fromEntries(
-        identityFields.map((field) => [field, sourceIdentity[field]]),
-      );
-      if (stable(comparableSourceIdentity) !== stable(expectedIdentity)) {
-        throw new Error("Source SQL identity does not match the current API pool identity evidence.");
-      }
-      if (e10OperationalScope) snapshot.source.apiPoolIdentityMatched = true;
+    const identity = await one<{
+      database_name: string;
+      database_oid: string;
+      database_role: string;
+      schema_name: string;
+      server_version: string;
+      server_version_num: string;
+    }>(
+      source,
+      `SELECT current_database()::text AS database_name,
+              (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS database_oid,
+              current_user::text AS database_role,
+              current_schema()::text AS schema_name,
+              current_setting('server_version')::text AS server_version,
+              current_setting('server_version_num')::text AS server_version_num`,
+      [],
+      "Verifying effective source identity",
+    );
+    if (
+      identity.database_name !== "heliumdb" ||
+      identity.database_oid !== "16384" ||
+      identity.database_role !== "postgres" ||
+      identity.schema_name !== "public" ||
+      identity.server_version_num !== "160010"
+    ) {
+      throw new Error("Source identity is not heliumdb/OID16384/public/postgres/PG160010.");
     }
+    snapshot.source.identity = identity;
     await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
     sourceTransactionOpen = true;
     const txMode = await one<{ transaction_read_only: string }>(
       source, "SHOW transaction_read_only", [], "Verifying read-only source transaction",
     );
     if (txMode.transaction_read_only !== "on") throw new Error("Source transaction is not read-only.");
-    if (baseCatalogScope || e1ApprovedScope) {
-      const clients = await one<{ count: number }>(
-        source,
-        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'",
-        [],
-        "Verifying paused source before catalog backup",
-      );
-      if (clients.count !== 0) throw new Error("Other source clients are connected; catalog backup blocked.");
-    }
     const exported = await one<{ snapshot: string }>(
       source, "SELECT pg_export_snapshot() AS snapshot", [], "Exporting source snapshot",
     );
@@ -1184,7 +1106,7 @@ async function main(): Promise<void> {
       includesOwnership: true,
     };
     await writePrivate(sourcePath, snapshot);
-    if (e10OperationalScope && snapshot.source.sequenceChangedDuringDump) {
+    if (snapshot.source.sequenceChangedDuringDump) {
       throw new Error("Sequence state changed during the source snapshot/backup window.");
     }
     if (sourceTransactionOpen) {
@@ -1219,6 +1141,18 @@ async function main(): Promise<void> {
     sourceProvenance: snapshot.sourceProvenance,
     sourceDatabase: snapshot.source.database.database_name ?? "unknown",
     sourceServerVersion: snapshot.source.database.server_version ?? "unknown",
+    sourceIdentity: snapshot.source.identity,
+    otherClientBackendsBeforeSnapshot: snapshot.source.otherClientBackendsBeforeSnapshot,
+    authorization: {
+      file: APPROVAL,
+      sha256: APPROVAL_SHA256,
+      exactHashMatched: true,
+      e2ClosedTextRequired: true,
+      drivePrerequisiteTextRequired: true,
+    },
+    invocation: snapshot.sourceProvenance.invocation,
+    operatorDiffFromOriginal: snapshot.sourceProvenance.operatorDiffFromOriginal,
+    metadataPath,
     restore: metadata,
     comparison,
     sourceMutationPolicy: {
@@ -1228,17 +1162,20 @@ async function main(): Promise<void> {
       purgeExecuted: false,
       driveExecuted: false,
       apiRestarted: false,
-      apiAllowedToRemainActive: e10OperationalScope,
+      otherClientBackendsRequiredBeforeSnapshot: 0,
       identitySeeded: false,
       restoreSuperuser: LOCAL_SUPERUSER,
       disposableClusterKeptAlive: clusterStarted,
+      disposableClusterRetentionPurpose: [
+        "later Drive redownload-restore comparison",
+        "later B0 comparison",
+      ],
+      disposableClusterMustNotBePurged: true,
     },
     allTablesAndRowsIncluded: true,
     tableDataExclusions: [],
     applicationUsersCreated: 0,
     applicationSessionsCreated: 0,
-    apiPoolIdentityEvidence: snapshot.source.apiPoolIdentityEvidence ?? null,
-    apiPoolIdentityMatched: snapshot.source.apiPoolIdentityMatched ?? false,
     failure,
   };
   await writePrivate(metadataPath, publicMetadata);
@@ -1269,7 +1206,7 @@ if (mainModulePath === fileURLToPath(import.meta.url)) {
   await main().catch((error: unknown) => {
     // The detailed sanitized report is written by main.  Keep process output
     // terse and never print DATABASE_URL or child process diagnostics.
-    console.error(`Prompt H Block 2 failed: ${error instanceof Error ? error.message : "unknown failure"}`);
+    console.error(`E2 release backup failed: ${error instanceof Error ? error.message : "unknown failure"}`);
     process.exitCode = 1;
   });
 }
\ No newline at end of file

```
- Metadata sanitizada: `/home/runner/workspace/reports/e2-liberacion-20260922/e2-backup-restore-20260922-metadata.json`
- Árbol de trabajo limpio al capturar: **no**
- Estado porcelain v1: `?? attached_assets/Pasted-Autorizaci-n-del-propietario-Guarda-este-texto-tal-cual_1790089009230.txt`, `?? reports/e2-liberacion-20260922/workflows-before.json`, `?? reports/e2-paquete-liberacion-preparado-20260921/autorizacion-fase-b-20260922-recibida.txt`, `?? reports/e2-paquete-liberacion-preparado-20260921/entrada-fase-b-20260922.json`, `?? scripts/src/e2-release-backup-20260922.mts`

## Fuente y captura

- Base efectiva: `heliumdb`
- PostgreSQL: `16.10`
- Identidad exigida/comprobada: `heliumdb / OID 16384 / public / postgres / PG 160010`
- Snapshot UTC: `2026-09-22T15:05:13.295Z`
- Snapshot Mexico City: `2026-09-22 09:05:13`
- Transacción: `REPEATABLE READ READ ONLY`; `pg_export_snapshot()` fue
  entregado a `pg_dump` y la transacción permaneció abierta hasta terminarlo.
- Tablas no sistémicas descubiertas dinámicamente: 69
- Triggers no internos descubiertos dinámicamente: 34;
  se compararon definición y estado habilitado de todos.
- La huella de filas es MD5 de una concatenación ordenada de MD5 de
  `to_jsonb(row)::text` canónico producido por PostgreSQL. No se guardaron
  filas crudas.

## Archivo

- Dump custom: `/home/runner/workspace/.local/backups/e2-release-backup-20260922-20260922090513-1888/e2-release-backup-20260922-20260922090513-1888.dump`
- Tamaño: `522472` bytes
- SHA-256: `fbd7fd4bbbc1b2411ab8c7c40ad40047c552d3388ff8697a49f21a6cd7b649f6`
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
garantía MVCC. Cambio detectado: **no**.
En E2 cualquier desigualdad detiene el procedimiento con FAIL; nunca se acepta
silenciosamente. Un snapshot prueba el instante del respaldo, no frescura de un preflight
posterior; no se realizó ese preflight.

## Restauración local persistente

- Cluster: `/home/runner/workspace/.local/backups/e2-release-backup-20260922-20260922090513-1888/restore-cluster`
- Socket Unix restringido: `/tmp/e2-release-backup-20260922-20260922090513-1888-1888`
- Base restaurada: `e2_restore_disposable_20260922090513-1888`
- Exit code de `pg_restore`: `0`
- Administrador: `PGHOST="/tmp/e2-release-backup-20260922-20260922090513-1888-1888" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="e2_restore_admin_20260922090513-1888"`
- Base restaurada: `PGHOST="/tmp/e2-release-backup-20260922-20260922090513-1888-1888" "/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin/psql" --no-psqlrc --no-password --dbname="e2_restore_disposable_20260922090513-1888"`

El cluster, sus archivos y la base desechable **no se eliminan** después del
éxito; deben conservarse para la comparación posterior de la restauración de
la redescarga de Drive y para la comparación B0. No se purgan en este operador.
La restauración no sembró usuarios ni identidad de aplicación.
