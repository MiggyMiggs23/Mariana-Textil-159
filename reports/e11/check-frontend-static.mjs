// No tests, build, app or DB: source TypeScript + exact mutation AST/hash inventory.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { cases, coverageStatus, knownGreenBlockers, pendingRecoveryObligations, recoveryObligations, hookCoverage } from "./frontend-mutants-cases.mjs";
const root = process.cwd(), app = "artifacts/mariana-textil";
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const file = `${app}/src/components/e11-node.dom.test.tsx`;
const source = fs.readFileSync(file, "utf8"), sha = text => createHash("sha256").update(text).digest("hex");
const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const tests = tree.statements.filter(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test");
if (tests.length !== cases.length || cases.some(c => tests.filter(s => s.expression.arguments[0]?.text === c.id).length !== 1)) throw Error("E11_BIJECTION");
const generatedHooks = [...new Set([...fs.readFileSync("lib/api-client-react/src/generated/api.ts", "utf8").matchAll(/export (?:const|function) (use\w*E11\w*)\b/g)].map(m => m[1]))].sort();
if (generatedHooks.length !== 21 || JSON.stringify(generatedHooks) !== JSON.stringify(Object.keys(hookCoverage).sort())
  || Object.values(hookCoverage).some(ids => !ids.length || ids.some(id => !cases.some(c => c.id === id)))
  || recoveryObligations.some(o => !cases.some(c => c.id === o.id)) || pendingRecoveryObligations.length)
  throw Error("E11_FINAL_HOOK_OR_RECOVERY_COVERAGE");
const inventory = cases.map(c => {
  const original = fs.readFileSync(`${app}/${c.file}`, "utf8");
  if (original.split(c.before).length !== 2) throw Error(`E11_ANCHOR ${c.id}`);
  const changed = original.replace(c.before, c.after);
  if (ts.createSourceFile(c.file, changed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length) throw Error(`E11_SYNTAX ${c.id}`);
  return { ...c, sourceHash: sha(original), mutantHash: sha(changed), declarationHash: sha(tests.find(s => s.expression.arguments[0]?.text === c.id).getText()),
    controlStepsSource: file, sensitivity: "PREPARED_ONLY_MAIN_MUST_VERIFY_GREEN_SPECIFIC_ERR_ASSERTION_RED_RESTORED" };
});
const config = ts.readConfigFile(`${app}/tsconfig.json`, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.resolve(app));
const paths = { ...parsed.options.paths };
for (const name of fs.readdirSync("lib")) {
  const file = `lib/${name}/package.json`;
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8")), exp = pkg.exports?.["."];
  const entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
  if (typeof entry === "string") paths[pkg.name] = [path.resolve("lib", name, entry)];
}
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, paths, noEmit: true, incremental: false,
  types: [require.resolve("@types/node/index.d.ts"), path.join(path.dirname(require.resolve("vite/package.json")), "client.d.ts")] });
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => "\n" }));
const output = `reports/e11/frontend-static-${new Date().toISOString().replaceAll(":", "-")}.json`;
fs.writeFileSync(output, JSON.stringify({ status: diagnostics.length ? "FAIL_STATIC" : "PASS_STATIC_NOT_EXECUTED",
  coverageStatus, knownGreenBlockers, pendingRecoveryObligations, recoveryObligations, hookCoverage, countsAreFinal: true,
  testsExecuted: 0, diagnosticCount: diagnostics.length, testSourceHash: sha(source), cases: inventory,
  helperHashes: Object.fromEntries([
    `${app}/src/components/e11-node-test-transport.ts`, `${app}/src/components/e5-node-test-fixtures.ts`,
    "reports/e11/frontend-node-build.mjs", "reports/e11/run-frontend-node-mutants.mjs",
    "reports/e11/frontend-mutants-cases.mjs", "reports/e11/check-frontend-static.mjs",
    "reports/tanda-b-20260922/e12/frontend-offline-guard.cjs", "reports/tanda-b-20260922/e12/frontend-node-dom.cjs",
    "reports/tanda-b-20260922/e12/frontend-node-reporter.mjs",
    "lib/api-client-react/src/generated/api.ts", "lib/api-client-react/src/generated/api.schemas.ts",
    "lib/api-zod/src/generated/api.ts",
  ].map(file => [file, sha(fs.readFileSync(file))])),
  gates: fs.readFileSync(`${app}/src/lib/e11-feature-flags.ts`, "utf8") }, null, 2), { flag: "wx" });
console.log(output);
if (diagnostics.length) process.exitCode = 1;