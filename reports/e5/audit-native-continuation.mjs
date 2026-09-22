// Static evidence reconciliation only: never imports a test, builds or executes.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { cases } from "./frontend-mutants-cases.mjs";
const root = process.cwd(), testFile = "artifacts/mariana-textil/src/components/e5-node.dom.test.tsx";
const ts = createRequire(path.join(root, "artifacts/mariana-textil/package.json"))("typescript");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const parse = text => ts.createSourceFile(testFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const isTest = s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test";
const tests = ast => new Map(ast.statements.filter(isTest).map(s => [s.expression.arguments[0].text, s.getText()]));
const helpers = ast => new Map(ast.statements.filter(s => !isTest(s)).map((s, i) => [String(i), s.getText()]));
const text = fs.readFileSync(testFile, "utf8"), ast = parse(text), currentTests = tests(ast);
// The environment may prune /tmp. Preserve the prior independently checked
// declaration/helper hashes; never infer compatibility merely from a test ID.
const checkpointFile = "reports/e5/frontend-continuation-audit-2026-09-22T22-56-42.946Z.json";
const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, "utf8"));
const previousParent = `test("E5-PARENT-CLIENT", async t => {
  window.history.replaceState(null, "", \`/clientes/\${f.CLIENT}?tab=estado\`);
  await act(async () => { mount(<ClienteDetail />); });
  assert.equal(Boolean(screen.queryByRole("button", { name: "Recibir dirigido" })), true, t.name);
  await click(button("Recibir dirigido"));
  assert.equal(Boolean(screen.queryByText(/Entrada CLIENTE/)), true, t.name);
});`;
const beforeParentRepair = text.replace(currentTests.get("E5-PARENT-CLIENT"), previousParent);
if (ast.parseDiagnostics.length || currentTests.size !== cases.length) throw Error("STATIC_TEST_PARSE_OR_COUNT");
for (const c of cases) {
  const source = fs.readFileSync(`artifacts/mariana-textil/${c.file}`, "utf8");
  if (!currentTests.has(c.id) || source.split(c.before).length !== 2 || parse(source.replace(c.before, c.after)).parseDiagnostics.length)
    throw Error(`STATIC_ANCHOR_OR_PARSE ${c.id}`);
}
const paths = process.argv.slice(2);
if (!paths.length) throw Error("Provide original MAIN manifest paths");
const report = { status: "STATIC_RECONCILIATION_NOT_SUITE_PASS", casesExecutedByAudit: 0,
  originalManifests: [], currentTestFileSha256: hash(text), verifiedAnchors: cases.length,
  declarationHashes: Object.fromEntries([...currentTests].map(([id, declaration]) => [id, hash(declaration)])),
  terminal: [], remainingIds: [], helperHashes: {},
  checkpoint: { file: checkpointFile, sha256: hash(fs.readFileSync(checkpointFile)) },
  compatibility: "App helper change preceded all completed App cases; current parent-only fixture additions affect no completed declaration" };
for (const file of paths) {
  const m = JSON.parse(fs.readFileSync(file, "utf8"));
  report.originalManifests.push({ file, sha256: hash(fs.readFileSync(file)), status: m.status, error: m.error });
  for (const [f, h] of Object.entries({ ...m.sourceHashes, ...m.harnessHashes })) {
    if (f === testFile) continue;
    if (hash(fs.readFileSync(f)) !== h) throw Error(`DEPENDENCY_CHANGED ${f}`);
  }
  for (const c of m.cases.filter(c => c.restored)) {
    if (c.green?.actual.status !== "passed" || c.restored?.actual.status !== "passed"
      || c.red?.actual.status !== "failed" || c.red.actual.causeCode !== "ERR_ASSERTION"
      || !c.red.actual.causeMessage?.includes(c.id) || c.originalHash !== c.restored.caseSourceHash)
      throw Error(`NOT_TERMINAL_SPECIFIC_ASSERTION ${c.id}`);
    let previous, compatibilityEvidence;
    const snapshotFile = path.join(c.greenSandbox, testFile);
    if (fs.existsSync(snapshotFile)) {
      previous = parse(fs.readFileSync(snapshotFile, "utf8"));
      compatibilityEvidence = "Original physical snapshot";
    } else if (hash(beforeParentRepair) === m.sourceHashes[testFile]) {
      previous = parse(beforeParentRepair);
      compatibilityEvidence = "Pruned snapshot: exact pre-repair test bytes reconstructed, SHA256 equals original MAIN manifest";
    } else {
      const prior = checkpoint.terminal.find(t => t.id === c.id && t.evidence === file);
      const priorManifest = checkpoint.originalManifests.find(entry => entry.file === file);
      if (!prior || priorManifest?.sha256 !== hash(fs.readFileSync(file))
        || prior.declarationSha256 !== hash(currentTests.get(c.id))) throw Error(`NO_AUTHENTIC_DECLARATION_EVIDENCE ${c.id}`);
      for (const [key, declaration] of helpers(ast))
        if (checkpoint.helperHashes[`test-top-level-${key}`] !== hash(declaration)) throw Error(`CHECKPOINT_HELPER_CHANGED ${key}`);
      report.terminal.push({ ...prior, compatibilityEvidence: "Pruned snapshot: prior static audit declaration/helper hashes and original manifest hash reverified" });
      continue;
    }
    if (tests(previous).get(c.id) !== currentTests.get(c.id)) throw Error(`DECLARATION_CHANGED ${c.id}`);
    const oldHelpers = helpers(previous), newHelpers = helpers(ast);
    if (oldHelpers.size !== newHelpers.size) throw Error("HELPER_COUNT_CHANGED");
    const changedHelpers = [];
    for (const [key, previousText] of oldHelpers) {
      if (newHelpers.get(key) !== previousText) {
        if (!previousText.startsWith("function appAt(") || !newHelpers.get(key)?.startsWith("function appAt("))
          throw Error(`COMMON_HELPER_CHANGED ${key}`);
        changedHelpers.push("appAt");
      }
    }
    if (changedHelpers.includes("appAt") && currentTests.get(c.id).includes("appAt("))
      throw Error(`APP_CASE_NEEDS_RERUN ${c.id}`);
    report.terminal.push({ id: c.id, evidence: file, declarationSha256: hash(currentTests.get(c.id)),
      originalProductiveSha256: c.originalHash, restoredProductiveSha256: c.restored.caseSourceHash,
      phases: ["GREEN", "RED_ERR_ASSERTION_ID", "RESTORED_GREEN"], changedHelpers, compatibilityEvidence });
  }
}
const terminalIds = new Set(report.terminal.map(c => c.id));
if (terminalIds.size !== report.terminal.length) throw Error("DUPLICATE_TERMINAL");
report.remainingIds = cases.filter(c => !terminalIds.has(c.id)).map(c => c.id);
for (const [key, declaration] of helpers(ast)) report.helperHashes[`test-top-level-${key}`] = hash(declaration);
for (const f of ["artifacts/mariana-textil/src/components/e5-node-test-harness.tsx",
  "artifacts/mariana-textil/src/components/e5-node-test-fixtures.ts",
  "reports/e5/frontend-node-build.mjs", "reports/e5/run-frontend-node-mutants.mjs",
  "reports/tanda-b-20260922/e12/frontend-offline-guard.cjs",
  "reports/tanda-b-20260922/e12/frontend-node-dom.cjs",
  "reports/tanda-b-20260922/e12/frontend-node-reporter.mjs"])
  report.helperHashes[f] = hash(fs.readFileSync(f));
const output = `reports/e5/frontend-continuation-audit-${new Date().toISOString().replaceAll(":", "-")}.json`;
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, terminalCount: terminalIds.size, remainingCount: report.remainingIds.length,
  terminalIds: [...terminalIds], verifiedAnchors: cases.length, testsExecuted: 0 }, null, 2));