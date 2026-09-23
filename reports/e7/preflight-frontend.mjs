// Preparation only: source noEmit, generated-schema fixtures, physical bundle.
// No test runner, application execution, API, database or protected dist writes.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { cases, hookCoverage, limits } from "./frontend-mutants-cases.mjs";

const root = process.cwd(), app = "artifacts/mariana-textil", fixture = "reports/e7/frontend-fixtures.ts";
const fixturesOnly = process.argv.length === 3 && process.argv[2] === "--fixtures-only";
if (process.argv.length > 2 && !fixturesOnly) throw Error("Usage: preflight-frontend.mjs [--fixtures-only]");
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const esbuild = createRequire(require.resolve("vite/package.json"))("esbuild");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const need = (ok, error) => { if (!ok) throw Error(error); };
const evidence = `reports/e7/frontend-preflight-${new Date().toISOString().replaceAll(":", "-")}`;
fs.mkdirSync(evidence);
const report = { status: "PREPARING", mode: fixturesOnly ? "TYPED_ZOD_FIXTURES_ONLY" : "SOURCE_FIXTURES_REAL_APP_BUILD_ONLY_NOT_MOUNTED_SUITE",
  testsExecuted: 0, appExecuted: false, diagnostics: [], schemaChecks: [], cleanupErrors: [] };
const save = () => fs.writeFileSync(`${evidence}/manifest.json`, JSON.stringify(report, null, 2));
const originals = new Map();
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "build", ".git"].includes(entry.name)) continue;
    const file = `${dir}/${entry.name}`;
    need(!entry.isSymbolicLink(), `SOURCE_SYMLINK ${file}`);
    if (entry.isDirectory()) collect(file); else originals.set(file, fs.readFileSync(file));
  }
}
if (!fixturesOnly) collect(`${app}/src`);
collect("lib");
for (const file of [fixture, "reports/e7/frontend-document-bytes.json",
  `${app}/tsconfig.json`, `${app}/package.json`, "tsconfig.base.json", "reports/e7/contrato.md",
  "reports/e7/preflight-frontend.mjs", "reports/e7/frontend-mutants-cases.mjs"])
  originals.set(file, fs.readFileSync(file));
report.sourceHashes = Object.fromEntries([...originals].map(([p, b]) => [p, hash(b)]));
save();
let sandbox, identity;
try {
  if (!fixturesOnly) {
    const testFile = `${app}/src/components/e7-node.dom.test.tsx`, source = originals.get(testFile).toString();
    const tree = ts.createSourceFile(testFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const tests = tree.statements.filter(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test");
    need(tests.length === cases.length && new Set(cases.map(c => c.id)).size === cases.length
      && cases.every(c => tests.filter(s => s.expression.arguments[0]?.text === c.id).length === 1), "EXACT_CASE_AST_BIJECTION");
    report.cases = cases.map(c => {
      const original = originals.get(`${app}/${c.file}`).toString();
      need(original.split(c.before).length === 2 && c.before !== c.after, `UNIQUE_MUTANT_ANCHOR ${c.id}`);
      const changed = original.replace(c.before, c.after);
      need(!ts.createSourceFile(c.file, changed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length, `MUTANT_SYNTAX ${c.id}`);
      return { ...c, sourceHash: hash(original), mutantHash: hash(changed),
        caseAstHash: hash(tests.find(s => s.expression.arguments[0]?.text === c.id).getText()), status: "PREPARED_NOT_EXECUTED" };
    });
    report.hookCoverage = hookCoverage; report.limits = limits;
  }
  const config = ts.readConfigFile(`${app}/tsconfig.json`, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.resolve(app));
  const paths = { ...parsed.options.paths }, aliasesRelative = { "@": `${app}/src` };
  for (const name of fs.readdirSync("lib")) {
    const file = `lib/${name}/package.json`;
    if (!fs.existsSync(file)) continue;
    const pkg = JSON.parse(fs.readFileSync(file)), exp = pkg.exports?.["."];
    const entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
    if (typeof entry === "string") {
      paths[pkg.name] = [path.resolve("lib", name, entry)];
      aliasesRelative[pkg.name] = path.join("lib", name, entry);
    }
  }
  const program = ts.createProgram([...(fixturesOnly ? [] : parsed.fileNames), path.resolve(fixture)], {
    ...parsed.options, paths, noEmit: true, incremental: false,
    types: [require.resolve("@types/node/index.d.ts"), path.join(path.dirname(require.resolve("vite/package.json")), "client.d.ts")],
  });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  report.diagnostics = diagnostics.map(d => ({
    file: d.file?.fileName, start: d.start, code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
  }));
  report.diagnosticCount = diagnostics.length;
  need(!diagnostics.length, "FULL_SOURCE_NO_EMIT_FAILED");
  const modules = new Map();
  function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const localRequire = createRequire(file);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("require", "module", "exports", js)(name => {
      if (name.startsWith(".")) {
        const source = path.resolve(path.dirname(file), name) + ".ts";
        if (fs.existsSync(source)) return load(source);
      }
      need(name === "zod" || name.startsWith("zod/"), `UNEXPECTED_FIXTURE_IMPORT ${name}`);
      return localRequire(name);
    }, module, module.exports);
    return module.exports;
  }
  const f = load(fixture), z = load("lib/api-zod/src/generated/api.ts");
  const validate = (label, schema, value) => { z[schema].parse(value); report.schemaChecks.push({ label, schema, status: "PASS" }); };
  validate("available", "GetE7DisponibilidadResponse", f.available);
  validate("unavailable", "GetE7DisponibilidadResponse", f.unavailable);
  validate("range", "GetE7AtribucionQueryParams", f.range);
  validate("xlsxQuery", "ExportE7AtribucionXlsxQueryParams", f.xlsxQuery);
  validate("pdfQuery", "ExportE7AtribucionPdfQueryParams", f.pdfQuery);
  validate("previewQuery", "GetE7ClienteExportacionQueryParams", f.previewQuery);
  for (const [name, value] of Object.entries(f.attributionFixtures)) validate(name, "GetE7AtribucionResponse", value);
  for (const [name, value] of Object.entries(f.previewFixtures)) validate(name, "GetE7ClienteExportacionResponse", value);
  if (!fixturesOnly) {
    const transport = load(`${app}/src/components/e7-node-test-transport.ts`);
    for (const [label, schema, value] of [
      ["legacyAccounts", "GetAdminCuentasDestinoResponse", transport.legacyAccounts],
      ["dashboard", "GetAdminRealtimeDashboardResponse", transport.dashboard],
      ["pending", "GetAdminRealtimePendingResponse", transport.pending],
      ["legacyClient", "GetClienteResponse", transport.legacyClient],
      ["legacyStatement", "GetClienteEstadoCuentaResponse", transport.legacyStatement],
      ["legacyCreditEvidence", "GetClienteEvidenciaCreditoResponse", transport.legacyCreditEvidence],
      ["legacyDirectedHistory", "ListSolicitudesPagoDirigidoResponse", transport.legacyDirectedHistory],
      ["legacyDocuments", "ListClienteDocumentosResponse", transport.legacyDocuments],
      ["operational", "ListAdminCuentaDestinoMovimientosResponse", transport.operational],
      ["siteActor", "GetCurrentUserResponse", transport.actorAtSite(2)],
    ]) validate(label, schema, value);
  }
  const generated = originals.get("lib/api-client-react/src/generated/api.ts").toString();
  const hooks = [...generated.matchAll(/export (?:const|function) (use\w*E7\w*)\b/g)].map(m => m[1]);
  need(JSON.stringify(hooks.sort()) === JSON.stringify([...f.hooks].sort()) && hooks.length === 5, "FIVE_ACTUAL_HOOKS");
  report.hooks = hooks;
  need(f.afterReceipt.cobranzaTotal === f.afterApplication.cobranzaTotal
    && f.afterReceipt.recepcionesFisicas === f.afterApplication.recepcionesFisicas
    && f.applicationSite.cobranzaTotal === null && f.receiptSite.recepcionesFisicas === null, "FIXTURE_SEMANTICS");
  need(Object.keys(f.previewReceived.resumenGlobal).sort().join(",") === "creditoDisponible,deudaActual,limiteCredito,saldoAFavor", "FOUR_GLOBAL_VALUES");
  report.documentLimit = "Binary schemas are unknown; no synthetic PDF/XLSX blobs claimed as validation. Backend helper owns real document checks.";
  if (fixturesOnly) {
    report.status = "PASS_TYPED_ZOD_FIXTURES_ONLY_NOT_FULL_SOURCE_OR_UI_BUILD";
  } else {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e7-preflight-"));
  identity = fs.lstatSync(sandbox); report.sandbox = sandbox;
  const tree = path.join(sandbox, "source"); fs.mkdirSync(tree);
  for (const [file, bytes] of originals) {
    const dest = path.join(tree, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
  }
  const entry = path.join(tree, "build-entry.tsx");
  fs.writeFileSync(entry, `export { default as App } from "./${app}/src/App";\nexport * from "./${fixture}";\nexport { ${hooks.join(", ")} } from "./lib/api-client-react/src/generated/api";\n`);
  const outfile = path.join(tree, "app-fixtures.cjs");
  const result = await esbuild.build({
    entryPoints: [entry], outfile, bundle: true, platform: "node", format: "cjs", target: "node24", jsx: "automatic",
    packages: "external", alias: Object.fromEntries(Object.entries(aliasesRelative).map(([name, rel]) => [name, path.join(tree, rel)])),
    metafile: true, logLevel: "silent", logOverride: { "empty-import-meta": "error" },
    loader: { ".css": "empty", ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl", ".gif": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.VITE_FONDO_E10_ENABLED": '"false"', "import.meta.env.DEV": "false" },
    plugins: [{ name: "reject-database-imports", setup(build) {
      build.onResolve({ filter: /^(?:@workspace\/db|pg|postgres|mysql2?|better-sqlite3)(?:\/|$)/ }, args => { throw Error(`OFFLINE_DB_IMPORT ${args.path}`); });
      build.onLoad({ filter: /\/lib\/db\// }, args => { throw Error(`OFFLINE_DB_SOURCE ${args.path}`); });
    } }],
  });
  for (const input of Object.keys(result.metafile.inputs))
    need(fs.realpathSync(path.resolve(input)).startsWith(tree + path.sep), `BUILD_INPUT_ESCAPE ${input}`);
  fs.writeFileSync(`${evidence}/build-inputs.json`, JSON.stringify(result.metafile, null, 2));
  fs.writeFileSync(`${evidence}/build-messages.json`, JSON.stringify({ warnings: result.warnings, errors: result.errors }, null, 2));
  report.bundleHash = hash(fs.readFileSync(outfile));
  report.bundleBytes = fs.statSync(outfile).size;
  report.metafileHash = hash(fs.readFileSync(`${evidence}/build-inputs.json`));
  report.status = "PASS_SOURCE_ZOD_PHYSICAL_BUILD_ONLY_NOT_UI_TESTS";
  }
} catch (e) {
  report.status = "FAIL_PREFLIGHT"; report.error = String(e); process.exitCode = 1;
} finally {
  report.changedSources = [...originals].filter(([p, b]) => hash(fs.readFileSync(p)) !== hash(b)).map(([p]) => p);
  if (report.changedSources.length) { report.status = "FAIL_CONCURRENT_SOURCE_CHANGE"; process.exitCode = 1; }
  save(); // Never remove a temporary tree before persisting the failure/evidence.
  if (sandbox) try {
    const stat = fs.lstatSync(sandbox), tree = path.join(sandbox, "source");
    need(!stat.isSymbolicLink() && stat.dev === identity.dev && stat.ino === identity.ino
      && fs.realpathSync(sandbox) === sandbox && !root.startsWith(sandbox + path.sep) && root !== sandbox, "CLEANUP_ROOT_ESCAPE");
    need(path.dirname(tree) === sandbox && fs.realpathSync(tree) === tree && !fs.lstatSync(tree).isSymbolicLink(), "CLEANUP_TREE_ESCAPE");
    fs.rmSync(tree, { recursive: true, force: false }); fs.rmdirSync(sandbox); report.sandboxRemoved = true;
  } catch (e) {
    report.cleanupErrors.push(String(e)); report.status = "FAIL_CLEANUP"; process.exitCode = 1;
  }
  save(); console.log(`${evidence}/manifest.json (${report.status})`);
}