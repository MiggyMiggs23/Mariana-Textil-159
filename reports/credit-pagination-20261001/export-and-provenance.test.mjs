import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
process.chdir(root);
const req = createRequire(path.join(root, "package.json"));
const frontReq = createRequire(path.join(root, "artifacts/mariana-textil/package.json"));
const read = p => fs.readFileSync(p, "utf8");
const hash = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const frozen = "reports/sidebar-order-20261001/frozen-root";
const apiFrozen = "reports/driver-multiple-phones-20261001/frozen-root";
const uiTargets = [
  "components/reportes/report-table.tsx",
  "components/reportes/generic-report-renderer.tsx",
  "components/reportes/tabs/clientes-tab.tsx",
  "pages/reportes.tsx",
  "components/reportes/report-scope.ts",
].map(p => `artifacts/mariana-textil/src/${p}`);
const apiTargets = [
  "artifacts/api-server/src/routes/reportes.ts",
  "artifacts/api-server/src/lib/reportes-composed-export.ts",
  "artifacts/api-server/src/lib/report-export.ts",
  "artifacts/api-server/src/lib/pdf.ts",
];
const evidence = { method: "Offline mounted React/DOM, actual pure export helpers, source AST/data-flow and SHA256; no HTTP/API/DB/app-process launches",
  sourceEquality: [], apiEquality: [] };

test("active four UI targets and scope helper equal active-build frozen source byte-for-byte", () => {
  const configuration = read("artifacts/mariana-textil/.replit-artifact/artifact.toml");
  assert.match(configuration, /--outDir dist-sidebar-order-20261001/);
  assert.match(configuration, /reports\/sidebar-order-20261001\/frontend.sha256/);
  for (const p of uiTargets) {
    assert.deepEqual(fs.readFileSync(p), fs.readFileSync(`${frozen}/${p}`));
    evidence.sourceEquality.push({ file: p, sha256: hash(p), frozen: `${frozen}/${p}` });
  }
  const result = execFileSync("sha256sum", ["-c", "reports/sidebar-order-20261001/frontend.sha256"], { encoding: "utf8" });
  assert.doesNotMatch(result, /FAILED/);
  evidence.activeFrontend = { dist: "artifacts/mariana-textil/dist-sidebar-order-20261001",
    indexSha256: hash("artifacts/mariana-textil/dist-sidebar-order-20261001/index.html"),
    manifestVerified: true, files: result.trim().split("\n").length };
});

test("same exact active API artifact; report route/export sources equal frozen build inventory, untouched by pagination introduction", () => {
  const config = read("artifacts/api-server/.replit-artifact/artifact.toml");
  assert.match(config, /node artifacts\/api-server\/dist-driver-phones-20261001\/index.mjs/);
  assert.match(config, /reports\/driver-multiple-phones-20261001\/api.sha256/);
  const inventory = JSON.parse(read("reports/driver-multiple-phones-20261001/combined-api-source-inventory.json"));
  for (const p of apiTargets) {
    assert.deepEqual(fs.readFileSync(p), fs.readFileSync(`${apiFrozen}/${p}`));
    const entry = inventory.find(e => e.file === p);
    assert.ok(entry, `Recorded API build input ${p}`);
    assert.equal(hash(p), entry.sha256);
    assert.equal(entry.sha256, entry.beforeSha256, "unchanged by driver overlay");
    assert.equal(git("diff", "64079353^", "64079353", "--", p), "", "pagination release did not modify report API/export implementation");
    evidence.apiEquality.push({ file: p, sha256: hash(p), frozen: `${apiFrozen}/${p}`, inventoryMatch: true });
  }
  const result = execFileSync("sha256sum", ["-c", "reports/driver-multiple-phones-20261001/api.sha256"], { encoding: "utf8" });
  assert.doesNotMatch(result, /FAILED/);
  evidence.activeApi = { entry: "artifacts/api-server/dist-driver-phones-20261001/index.mjs",
    entrySha256: hash("artifacts/api-server/dist-driver-phones-20261001/index.mjs"),
    allManifestFilesVerified: true, files: result.trim().split("\n").length };
});

test("provenance: pagination introduced in recorded release, retained in active frozen candidate; do not infer versions from dates", () => {
  const tablePath = uiTargets[0];
  const parent = git("show", `64079353^:${tablePath}`);
  const introduced = git("show", `64079353:${tablePath}`);
  assert.doesNotMatch(parent, /paginationKey|Filas por página|beforeprint/);
  assert.match(introduced, /paginationKey|Filas por página|beforeprint/);
  assert.equal(read(tablePath), introduced, "pagination table remains exactly release source");
  for (const p of uiTargets.slice(0, 3)) assert.equal(read(p), git("show", `64079353:${p}`));
  const metadata = git("show", "-s", "--format=%H%n%cI%n%s", "64079353").trim().split("\n");
  evidence.provenance = { introducedCommit: metadata[0], committedAt: metadata[1], subject: metadata[2],
    parentLacksPagination: true, threePaginationSourcesStillExactlyReleaseBytes: true,
    activeEstablishedBy: "Artifact service configuration plus verified active dist manifest and byte-equal frozen build inputs",
    caution: "candidate-ready/build-manifest retained NOT_ACTIVATED status; actual service configuration, not stale status label, establishes active selection" };
});

function loadPure(file) {
  const compiled = ts.transpileModule(read(file), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  assert.deepEqual(compiled.diagnostics, []);
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: file })(name => {
    if (name === "@workspace/number-format") return frontReq(name);
    if (name.startsWith(".")) return loadPure(path.resolve(path.dirname(file), `${name}.ts`));
    return req(name);
  }, module, module.exports);
  return module.exports;
}
const { normalizeExportTables, createReportWorkbook } = loadPure("artifacts/api-server/src/lib/report-export.ts");

test("actual export normalization and XLSX writer retain all 137 rows and original complete totals, independent of screen page", async () => {
  const source = [{ id: "credit", title: "Crédito prueba aislada", columns: [
    { key: "cliente", label: "Cliente", kind: "text" }, { key: "saldo", label: "Saldo", kind: "money" },
  ], rows: Array.from({ length: 137 }, (_, i) => ({ cliente: `Fixture ${i + 1}`, saldo: i + 1 })),
  totals: { saldo: 987654.32 } }];
  const before = JSON.stringify(source);
  const tables = normalizeExportTables("clientes", { ubicacionIds: [7], clienteIds: [11, 12] }, source);
  assert.equal(tables[0].rows.length, 137);
  assert.deepEqual(tables[0].rows.map(r => r.cliente), source[0].rows.map(r => r.cliente));
  assert.equal(tables[0].totals.saldo, 987654.32);
  const workbook = createReportWorkbook({
    section: "clientes", generatedAt: "2026-10-01T12:00:00Z", range: { desde: "2026-09-01", hasta: "2026-09-30" },
    activeFilters: { ubicacionIds: [7], clienteIds: [11, 12] }, kpis: [], tables, catalogs: {},
  });
  const bytes = await workbook.xlsx.writeBuffer();
  const ExcelJS = req("exceljs");
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  const names = [], totals = [];
  for (const sheet of restored.worksheets) sheet.eachRow(row => row.eachCell(cell => {
    if (typeof cell.value === "string" && /^Fixture \d+$/.test(cell.value)) names.push(cell.value);
    if (cell.value === 987654.32) totals.push(cell.value);
  }));
  assert.deepEqual(names, source[0].rows.map(r => r.cliente));
  assert.ok(totals.length >= 1);
  assert.equal(JSON.stringify(source), before);
  evidence.exportWorkbook = { rowsInput: 137, rowsRoundTrip: names.length, originalTotal: 987654.32, bytes: bytes.byteLength };
});

test("XLSX and PDF endpoint source AST proves identical full-table dataflow and complete report scope, no page slicing", () => {
  const source = read("artifacts/api-server/src/routes/reportes.ts");
  const ast = ts.createSourceFile("reportes.ts", source, ts.ScriptTarget.Latest, true);
  const rowsHelper = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "reportRows");
  assert.ok(rowsHelper);
  const helperCompiled = ts.transpileModule(`${rowsHelper.getText(ast)}\nmodule.exports = reportRows;`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(module){${helperCompiled}})`)(mod);
  const fullTables = [{ rows: Array.from({ length: 137 }, (_, i) => ({ i })), totals: { n: 137 } }];
  assert.equal(mod.exports({ tables: fullTables }), fullTables, "real reportRows helper returns original full table array, not sliced data");
  const routes = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "router.get" &&
      node.arguments[0]?.text?.startsWith("/reportes/vistas/:vista/export.")) routes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(routes.length, 2);
  for (const route of routes) {
    const handler = route.arguments[1];
    const text = handler.getText(ast);
    assert.match(text, /composedRequestQuery\(req, ExportReporteVista(?:Xlsx|Pdf)QueryParams\)/);
    assert.match(text, /const locations = composedLocations\(req, query\)/);
    assert.match(text, /buildComposedReport\(\s*view,\s*query,\s*locations,/);
    assert.match(text, /normalizeExportTables\(String\(data.section\), data.activeFilters, reportRows\(data\)\)/);
    assert.match(text, /activeFilters: data.activeFilters/);
    assert.match(text, /\btables,/);
    assert.doesNotMatch(text, /\.slice\(|\b(?:pageSize|offset|limit|paginationKey)\b/);
    evidence[route.arguments[0].text.endsWith("pdf") ? "pdfEndpoint" : "xlsxEndpoint"] = {
      path: route.arguments[0].text, sameScopeBuilder: true, originalFullTables: true, noScreenPaginationDependency: true,
      verification: "Actual endpoint AST/dataflow only; no HTTP request or DB call" };
  }
});

test.after(() => {
  fs.writeFileSync(path.join(import.meta.dirname, "proof.json"), JSON.stringify(evidence, null, 2) + "\n");
});