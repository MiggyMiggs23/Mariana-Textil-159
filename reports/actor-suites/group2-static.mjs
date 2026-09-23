// Source-only verification: no test imports, SQL, database, app or HTTP.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = process.cwd(), require = createRequire(path.join(root, "artifacts/api-server/package.json"));
const ts = require("typescript"), sha = bytes => createHash("sha256").update(bytes).digest("hex");
const names = ["kardex-api.test.ts", "metered-reference-cost.integration.test.ts",
  "pagos-dirigidos.integration.test.ts", "pos-location-authorization.integration.test.ts",
  "postgres-unique-concurrency.integration.test.ts", "precios.integration.test.ts", "productos-cache.integration.test.ts",
  "lib/notificaciones-credito.test.ts", "lib/permisos.test.ts"];
const files = names.map(name => `artifacts/api-server/src/${name}`);
const report = { status: "STATIC_ONLY", casesExecuted: 0, sqlExecuted: 0, appImports: 0,
  effectiveAssignedManifestSuites: files, notOwned: ["productos-purge.integration.test.ts", "salidas-api.test.ts"],
  authorizedInventoryCorrection: {
    "lib/notificaciones-credito.test.ts": "Adapted following explicit MAIN authorization covering all actor creators; shared manifest owner must include this real actor suite.",
    "lib/permisos.test.ts": "Adapted following explicit MAIN authorization. Five actor inserts retained. All 29 original sequential cases (P-01..26 plus P-06A/B/C) now register real node:test terminals; original failures are rethrown, not counter-only swallowed.",
  }, suites: [] };
const calls = text => {
  const ast = ts.createSourceFile("suite.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), result = [];
  const visit = node => {
    if (ts.isCallExpression(node) && /^(test(?:\.|$)|t\.test$|assert\.)/.test(node.expression.getText(ast))) result.push(node.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast); return result;
};
for (const file of files) {
  const current = fs.readFileSync(file, "utf8"), original = execFileSync("git", ["show", `5aadfec:${file}`], { encoding: "utf8" });
  const authorizedNotificationContract = file.endsWith("/lib/notificaciones-credito.test.ts");
  const authorizedPermissionContract = file.endsWith("/lib/permisos.test.ts");
  const expected = authorizedNotificationContract ? original
    .replace('`/notificaciones/${notificationId}/leer`', '`/notificaciones/credito/${notificationId}/leer`')
    .replace('    fechaVencimiento: string;\n    urgente: boolean;\n    leidaAt: string | null;\n  };\n  assert.equal(marked.id', '    tipo: "credito";\n    leidaAt: string | null;\n  };\n  assert.equal(marked.id')
    .replace('  assert.equal(marked.fechaVencimiento, dueDate);\n  assert.equal(marked.urgente, true);', '  assert.equal(marked.tipo, "credito");')
    .replace('  assert.ok(persisted.leidaAt);', '  assert.ok(persisted.leidaAt);\n  assert.equal(persisted.leidaAt, marked.leidaAt);')
    : authorizedPermissionContract ? original.replace(
      '    inventario: [true, false, false],\n    productos: [true, false, false],',
      '    inventario: [true, false, false],\n    auditoria_inventario: [true, true, true],\n    productos: [true, false, false],',
    ).replace(
      '    contenedores: [true, true, true],\n    reportes: [true, false, false],',
      '    contenedores: [true, true, true],\n    reportes: [true, false, false],\n    viajes: [true, true, false],',
    ) : original;
  const before = calls(expected), after = calls(current);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error(`BUSINESS_CALL_AST_CHANGED ${file}`);
  if (!(current.indexOf("assertActorSuiteEnvironmentSync(process.env)") < current.indexOf('await import("@workspace/db")')
    && current.indexOf("const actorApplicationUrl = process.env.DATABASE_URL;") < current.indexOf('await import("@workspace/db")')
    && current.includes('ACTOR_SUITE_IDENTITY_VERIFIED !== "1"')
    && current.includes("await (await actorDatabase.createTestDatabaseGuard("))) throw Error(`PREFLIGHT_ORDER ${file}`);
  report.suites.push({ file, originalHash: sha(original), finalHash: sha(current),
    originalBusinessCallCount: calls(original).length, businessCallsUnchanged: !authorizedNotificationContract && !authorizedPermissionContract,
    authorizedNotificationContract, authorizedPermissionContract, matchesExpectedBusinessCalls: true, businessCallHash: sha(JSON.stringify(after)) });
}
const config = path.resolve("artifacts/api-server/tsconfig.json");
const parsed = ts.getParsedCommandLineOfConfigFile(config, { noEmit: true, incremental: false }, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw Error(ts.flattenDiagnosticMessageText(d.messageText, "\n")); },
});
const paths = { ...parsed.options.paths };
for (const name of fs.readdirSync("lib")) {
  const file = `lib/${name}/package.json`;
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (fs.existsSync(`lib/${name}/src/index.ts`)) paths[pkg.name] = [path.resolve(`lib/${name}/src/index.ts`)];
}
const program = ts.createProgram(files.map(file => path.resolve(file)), {
  ...parsed.options, configFilePath: config, rootDir: root, paths, noEmit: true, incremental: false,
}, undefined);
report.diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({
  file: d.file ? path.relative(root, d.file.fileName) : null,
  line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
  code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
}));
report.status = report.diagnostics.length ? "STATIC_NOEMIT_DIAGNOSTICS_NOT_EXECUTED" : "PASS_STATIC_NOEMIT_AUTHORIZED_CONTRACT_DELTA_NOT_EXECUTED";
report.authorizedContractDelta = {
  suite: "artifacts/api-server/src/lib/notificaciones-credito.test.ts",
  authority: "MAIN explicitly authorized alignment with current route and OpenAPI; no productive changes.",
  request: "POST /notificaciones/:id/leer replaced by POST /notificaciones/credito/:id/leer.",
  obsoleteAssertions: ["marked.fechaVencimiento === dueDate", "marked.urgente === true"],
  replacement: "Mutation asserts id, tipo=credito and nonempty leidaAt; subsequent GET asserts the identical persisted leidaAt. Before/after GET retain fechaVencimiento and urgente checks on notificationId-matched records.",
  reason: "Current route and OpenAPI return only id/tipo/leidaAt for mutation; dates/urgency belong to list representations.",
  verification: "Seven suites retain baseline business-call AST exactly; notifications and permissions must equal baseline plus only explicit MAIN-authorized transformations.",
};
report.lifecycle = "Per-path child required by infra. Existing fixture-scoped cleanup unchanged; no new deletion, audit bypass or seed-user mutation. Added pool closure for metered/precios/permisos. Cluster destruction remains runner-owned.";
const salidas = "artifacts/api-server/src/lib/salidas.test.ts";
const salidasOriginal = execFileSync("git", ["show", `5aadfec:${salidas}`]);
if (sha(fs.readFileSync(salidas)) !== sha(salidasOriginal)) throw Error("SALIDAS_OWN_ADAPTATION_NOT_FULLY_REVERTED");
report.excludedSeedReader = { file: salidas, restoredByteExactTo: "5aadfec", sha256: sha(salidasOriginal) };
const permissionText = fs.readFileSync("artifacts/api-server/src/lib/permisos.test.ts", "utf8");
const permissionCases = calls(permissionText).filter(call => call.startsWith("test("));
const permissionAst = ts.createSourceFile("permisos.test.ts", permissionText, ts.ScriptTarget.Latest, true);
const permissionRegistrations = permissionAst.statements.map((statement, index) =>
  ts.isExpressionStatement(statement) && ts.isAwaitExpression(statement.expression)
    && ts.isCallExpression(statement.expression.expression)
    && statement.expression.expression.expression.getText(permissionAst) === "test" ? index : -1
).filter(index => index >= 0);
if (permissionRegistrations.length !== 29 ||
    permissionRegistrations.at(-1) - permissionRegistrations[0] !== 28) {
  throw Error("PERMISSION_INTERLEAVED_TOP_LEVEL_EFFECTS");
}
if (permissionCases.length !== 29 || !permissionText.includes("void nativeTest(name, { concurrency: false }, async () => {")
  || permissionText.includes("await nativeTest(") || !permissionText.includes("after(async () => {")
  || !permissionText.includes("throw err;") || !permissionText.includes("if (total !== 29)")) throw Error("PERMISSION_NATIVE_ACCOUNTING");
report.permissionNativeTerminals = { expected: 29, originalCaseBodiesUnchanged: false, actualExecution: "LATEST_SOURCE_NOT_RUN",
  authorizedDelta: "MAIN authorized P06C SUPERVISOR expected auditoria_inventario VCE and viajes VC [true,true,false], not VCE. Static comparison of all 32 current seed rows found viajes the sole remaining P06C mismatch; permission-writing startup initializers do not elevate SUPERVISOR viajes.editar. All other case bodies unchanged. TERMINAL alone gets a new non-Mariana TIENDA fixture to test role baseline outside the site exception. BODEGA expected contenedores.ver remains true, disputed and blocked. Latest preceding MAIN run 2026-09-23T06-16-57.093Z reported 27 PASS/2 FAIL; newest source is unexecuted, not 28 PASS.",
  registration: "29 native leaves, no parent wrapper. Async registration helper returns without awaiting native completion; callers retain await test, but wait only for registration. Cleanup, pool.end and accounting occur in after.",
  noInterleavedEffects: "AST confirms all 29 top-level await test calls are consecutive statements: all setup precedes registration, all between-case mutations remain inside native callbacks.",
  labels: permissionCases.map(call => call.match(/^test\("([^"]+)"/)?.[1]),
  errorPropagation: "Native callback rethrows original error; custom counters retained, total must equal 29; failed count sets exitCode without truncating reporter output.",
  runnerRequirement: "Select this explicit suite in a per-path child. Require 29 native terminal cases, no skipped/failed cases and exit 0 for acceptance; stdout summary or file-level/zero-case success is insufficient." };
const failedRuns = [
  "reports/actor-suites/runs/2026-09-23T04-15-03.755Z-73ea4f6c",
  "reports/actor-suites/runs/2026-09-23T04-16-31.886Z-d9f5fde0",
];
report.preservedFailures = failedRuns.map(dir => {
  const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`));
  const terminal = JSON.parse(fs.readFileSync(`${dir}/terminal.json`));
  if (manifest.status !== "FAIL" || terminal.status !== "FAIL") throw Error(`FAIL_RELABELLED ${dir}`);
  return { directory: dir, status: "FAIL", recordedChildResults: manifest.completedCount, acceptedSuites: 0,
    clusterDestroyed: terminal.clusterDestroyed,
    hashes: Object.fromEntries(fs.readdirSync(dir).filter(name => /\.(json|log)$/.test(name))
      .map(name => [name, sha(fs.readFileSync(`${dir}/${name}`))])) };
});
report.failureDiagnosis = {
  kardex: "History reached HTTP 200 and a structured response with documentoRuta=null. resolveMovementReference intentionally ignores human entry folio documentoId and requires rollos.recepcionId. Fixture omitted this relationship. No entry approval-state column/default or document-permission check explains this null; the route is session + movimientos permission, followed by document resolution/Zod parsing. ADMIN positive response and other two native cases passed within the failed suite.",
  fixtureRepair: "Link only RECEPCION's existing roll to the inserted entry PK and align entry site to that roll. Keep historical documentoId folio and original link assertion. Also repair pre-existing cancellation fixture: enum VENTA index 2 and CANCELACION index 9 chose different rolls under index%3. Resolver requires same-roll origin; cancellation now uses the sale's roll/site, keeping original origin/document assertions.",
  notifications: "Suite imported DB before reading control URL. DB index preserves APPLICATION_DATABASE_URL but assigns DATABASE_URL=TEST_DATABASE_URL for legacy consumers. The later inequality check thus compared target to target. All nine suites now capture the original signed control URL before DB import and pass that immutable URL to both shared guard and legacy comparisons. No environment writes or relaxed checks added.",
  worker: "Independent infrastructure failure: nonproduction pino uses thread-stream Worker; inherited --import bootstrap reruns synchronous preflight after DB index has assigned DATABASE_URL to target. Observed first async error is target/control equality, followed by worker exited errors. Owner must fix worker/bootstrap lifecycle without weakening identity; no logger, bootstrap or production code edited here.",
  acceptance: "Zero group2 suites accepted from these FAIL runs; fixture diagnosis does not turn worker errors into success. Re-execution awaits MAIN and infrastructure correction.",
};
const clean = 'env -i PATH="$PATH" HOME="$HOME" LANG="$LANG" ';
report.mainCommandsAfterInfrastructureReady = {
  focusedPermissionsDiagnosticOnly: `${clean}node lib/db/src/run-isolated-tests.mjs --actor-ids=artifacts/api-server/src/lib/permisos.test.ts`,
  threeNeverExecuted: `${clean}node lib/db/src/run-isolated-tests.mjs --actor-ids=${files.filter(file => /\/(postgres-unique-concurrency|precios|productos-cache)\.integration\.test\.ts$/.test(file)).join(",")}`,
};
const latestMainDirectory = "reports/actor-suites/runs/2026-09-23T06-07-46.777Z-d488ba7e";
const latestMainManifest = JSON.parse(fs.readFileSync(`${latestMainDirectory}/manifest.json`));
if (latestMainManifest.status !== "FAIL") throw Error("LATEST_MAIN_FAIL_RELABELLED");
report.latestMainResult = {
  directory: latestMainDirectory, status: latestMainManifest.status,
  manifestSha256: sha(fs.readFileSync(`${latestMainDirectory}/manifest.json`)),
  childResults: latestMainManifest.cases.map(({ path, status, exitCode }) => ({ path, status, exitCode })),
  interpretation: "MAIN reports permisos 29 native leaves: 26 PASS/3 FAIL on preceding source; metered PASS; pagos-dirigidos FAIL; POS native PASS with parser rejection under infrastructure review. Three unexecuted: concurrency, precios, productos-cache. Newly authorized permission preparation/expected changes NOT EXECUTED; do not infer 28 PASS.",
};
report.policyBlockers = {
  bodega: "BLOCKED_POLICY: seed-permissions.mjs grants BODEGA contenedores.ver, pending-costs-schema.ts:36-42 revokes every inherited BODEGA module outside six names, including contenedores. No assertion/productive change authorized or made.",
  directedPayments: "BLOCKED_OFF: original client payload lacks mandatory E1 sitioOrigenId/naturaleza/operacionClave, causing 400 before balance check, not the expected 409. Approval body {} and later ordinary payments/reversals also lack E1. Honest physical EFECTIVO requires matching origin/session; ABONO_DIRIGIDO physical cash is disabled by source-controlled CREDIT_CASH_INCOME_CAPTURE_ENABLED=false. E3 ordinary release does not open directed cash. No gates enabled, no change to CORRECCION_CONTABLE or TRANSFERENCIA to obtain green, no assertions changed. Historical FAIL preserved.",
};
report.remainingSevenStaticReview = {
  scope: "Limited source-only scan of HTTP route names, service exports and representative contracts, not integration acceptance.",
  findings: "No additional obsolete endpoint equivalent to the notification route found. Directed payments already use /notificaciones/sistema/:id/leer. POS ticket/cash-session routes, prices endpoints, product endpoints, and uniqueness-create endpoints exist. Metered cost status vocabulary matches its service. Permission service exports resolve and noemit succeeds.",
  unchanged: "No assertions or fixtures in these seven were changed during this review. Permission seed-dependent semantics, transactional behavior and response correctness still require MAIN execution.",
};
fs.writeFileSync("reports/actor-suites/group2-static.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, suites: files.length, diagnostics: report.diagnostics }));
if (report.diagnostics.length) process.exitCode = 1;