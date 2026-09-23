// Reproducible read-only evidence audit. No tests, build, app, network or DB.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { cases, hookCoverage, recoveryObligations, pendingRecoveryObligations } from "./frontend-mutants-cases.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const read = file => JSON.parse(fs.readFileSync(file));
const need = (ok, label) => { if (!ok) throw Error(label); };
const directory = "reports/e11", app = "artifacts/mariana-textil";
const currentRuns = ["01-38-52.957", "01-39-54.588"].map(time => `${directory}/frontend-node-mutants-2026-09-23T${time}Z/manifest.json`);
const impactPath = `${directory}/frontend-provider-key-fix-impact-2026-09-23T01-37-31.707Z.json`;
const impact = read(impactPath);
const warningPath = `${directory}/frontend-duplicate-keys-2026-09-23T02-03-32.888Z.json`;
const warning = read(warningPath);
const cleanupProof = read(`${directory}/frontend-runner-cleanup-equivalence-2026-09-23T00-57-42.718Z.json`);
const staticPaths = [
  `${directory}/frontend-static-2026-09-23T00-46-24.289Z.json`,
  `${directory}/frontend-static-2026-09-23T01-37-26.745Z.json`,
];
const statics = staticPaths.map(read);
const testPath = `${app}/src/components/e11-node.dom.test.tsx`;
const testSource = fs.readFileSync(testPath, "utf8");
const ts = createRequire(path.resolve(`${app}/package.json`))("typescript");
const ast = ts.createSourceFile(testPath, testSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map(ast.statements.filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)
  && n.expression.expression.getText() === "test").map(n => [n.expression.arguments[0].text, n]));
const provider = `${app}/src/lib/e11-session.tsx`;
const currentProvider = fs.readFileSync(provider, "utf8");
const previousProvider = currentProvider
  .replace("  // Sibling keys must be distinct so reconciliation deletes BOTH old scope trees.\n", "")
  .replace("key={`recovery:${key}`}", "key={key}")
  .replace("key={`business:${key}`}", "key={key}");
need(sha(currentProvider) === impact.productDelta.newHash && sha(previousProvider) === impact.productDelta.oldHash, "PROVIDER_DELTA_CHANGED");
need(statics[1].diagnosticCount === 0 && statics[1].testSourceHash === sha(testSource), "FINAL_STATIC_SNAPSHOT");
need(cases.length === 153 && declarations.size === 153 && !ast.parseDiagnostics.length, "153_DECLARATIONS");
need(recoveryObligations.length === 42 && pendingRecoveryObligations.length === 0, "42_RECOVERY_OBLIGATIONS");
const generatedHooks = [...new Set([...fs.readFileSync("lib/api-client-react/src/generated/api.ts", "utf8")
  .matchAll(/export (?:const|function) (use\w*E11\w*)\b/g)].map(m => m[1]))].sort();
need(generatedHooks.length === 21 && JSON.stringify(generatedHooks) === JSON.stringify(Object.keys(hookCoverage).sort()), "21_GENERATED_HOOKS");
need(warning.status === "PASS_ZERO_REACT_KEY_WARNINGS_POSTHOC_ONLY" && warning.problems.length === 0 && warning.logs.length === 450, "MAIN_WARNING_AUDIT");
for (const item of [...warning.manifests, ...warning.logs]) need(sha(fs.readFileSync(item.path)) === item.sha256, `WARNING_EVIDENCE_CHANGED ${item.path}`);

const exclusions = {
  "E11-DISABLED-NO-IDENTITY": "Provider invoked, but available.enabled=false returns before sibling JSX in all phases; mutant changes identity query enablement only.",
  "E11-OFF-BELL-NO-LINK": "Gates OFF bypass provider in real App; mutant changes notification href only.",
  "E11-E5-OFF-LEGACY-CAPABILITY": "Direct E5Entry under QueryClient/Router/LocationScope, no provider; gates OFF; mutant changes E5 authorization only.",
};
const manifests = new Map(), selections = [];
for (const file of currentRuns) {
  const m = read(file); manifests.set(file, m);
  need(m.status === "PASS_SELECTED_DECLARED_UI_OBLIGATIONS_NOT_FULL_E11" && m.cases.length === m.selectedCount
    && m.mode === "GREEN_SPECIFIC_RED_RESTORED" && !m.changed.length && !m.changedHarness.length
    && !m.cleanupErrors.length && m.sandboxRemoved, `CURRENT_RUN_NOT_TERMINAL ${file}`);
  for (const id of m.selectedIds) selections.push({ id, file, retained: false });
}
need(selections.length === 150 && manifests.get(currentRuns[0]).selectedCount === 4
  && manifests.get(currentRuns[1]).selectedCount === 146, "4_PLUS_146");
for (const row of impact.retainedUnaffectedCases) {
  need(exclusions[row.id], `UNAUTHORIZED_EXCLUSION ${row.id}`);
  const file = path.join(path.dirname(row.phaseLogs[0].path), "manifest.json");
  if (!manifests.has(file)) manifests.set(file, read(file));
  need(manifests.get(file).status === "FAIL_NOT_ACCEPTED", "HISTORIC_FAIL_MUST_REMAIN_FAIL");
  selections.push({ id: row.id, file, retained: true });
}
need(selections.length === 153 && new Set(selections.map(r => r.id)).size === 153
  && cases.every(c => selections.some(r => r.id === c.id)), "EXACT_153_UNION");
const snapshots = [];
for (const [file, m] of manifests) {
  const current = currentRuns.includes(file), sourceDelta = [], helperDelta = [];
  for (const [p, hash] of Object.entries(m.sourceHashes)) {
    if (sha(fs.readFileSync(p)) === hash) continue;
    sourceDelta.push(p);
    need(!current && (p === provider || p === testPath), `UNAPPROVED_SOURCE_DELTA ${p}`);
    if (p === provider) need(hash === sha(previousProvider), "OLD_PROVIDER_HASH");
    if (p === testPath) need(statics.some(s => s.testSourceHash === hash), "OLD_TEST_SNAPSHOT_UNPROVEN");
  }
  for (const [p, hash] of Object.entries(m.harnessHashes)) {
    if (sha(fs.readFileSync(p)) === hash) continue;
    helperDelta.push(p);
    need(!current && p === `${directory}/run-frontend-node-mutants.mjs`
      && hash === cleanupProof.runnerOldHash && sha(fs.readFileSync(p)) === cleanupProof.runnerNewHash, "UNAPPROVED_HELPER_DELTA");
  }
  snapshots.push({ path: file, sha256: sha(fs.readFileSync(file)), originalStatus: m.status, selectedForThisAudit: selections.filter(r => r.file === file).map(r => r.id),
    sourceDelta, helperDelta });
}
const noInfra = /E4_OFFLINE|E4_.*ESCAPE|E11_UNCONFIGURED|SyntaxError|TypeError|ReferenceError|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/;
const keyWarning = /Encountered two children with the same key|Non-unique keys may cause children|Each child in a list should have a unique ["']key["']/i;
const requiredInputs = ["src/App.tsx", "src/pages/e11.tsx", "src/lib/e11-session.tsx",
  "src/components/e11-recovery-admin.tsx", "../../lib/api-client-react/src/generated/api.ts",
  "src/pages/usuarios.tsx", "src/pages/clientes.tsx", "src/pages/conciliacion.tsx",
  "src/pages/notificaciones.tsx", "src/components/e5-pendientes.tsx",
  "src/components/layout/app-layout.tsx", "src/lib/location-scope.tsx"];
const audited = [];
for (const selection of selections) {
  const { id, file, retained } = selection, m = manifests.get(file), row = m.cases.find(r => r.id === id);
  const candidate = cases.find(c => c.id === id), declaration = declarations.get(id);
  need(row && JSON.stringify(candidate) === JSON.stringify(m.plannedCases.find(c => c.id === id)), `MUTANT_DEFINITION ${id}`);
  const oldStatic = statics.find(s => s.testSourceHash === m.sourceHashes[testPath]);
  need(oldStatic && sha(declaration.getText()) === oldStatic.cases.find(c => c.id === id).declarationHash, `DECLARATION_AST ${id}`);
  const sourcePath = `${app}/${candidate.file}`;
  const original = retained && sourcePath === provider ? previousProvider : fs.readFileSync(sourcePath, "utf8");
  need(original.split(candidate.before).length === 2 && sha(original) === row.originalHash
    && sha(original.replace(candidate.before, candidate.after)) === row.mutantHash, `SOURCE_MUTANT_HASH ${id}`);
  const phases = [];
  for (const phase of ["green", "red", "restored"]) {
    const recorded = row[phase], base = path.join(path.dirname(file), `${id}-${phase}`);
    const native = read(`${base}.json`), actuals = native.tests.filter(t => !t.skipped);
    need(recorded && actuals.length === 1 && actuals[0].name === id
      && JSON.stringify(actuals[0]) === JSON.stringify(recorded.actual), `NATIVE_EXACT_SELECTION ${id} ${phase}`);
    const actual = actuals[0], message = actual.causeMessage ?? actual.message;
    if (phase === "red") need(recorded.exit === 1 && actual.status === "failed"
      && (actual.causeCode ?? actual.code) === "ERR_ASSERTION" && (message === id || message?.startsWith(`${id}\n`)), `SPECIFIC_RED ${id}`);
    else need(recorded.exit === 0 && actual.status === "passed", `GREEN_RESTORED ${id} ${phase}`);
    need(recorded.caseSourceHash === (phase === "red" ? row.mutantHash : row.originalHash), `PHASE_SOURCE_HASH ${id}`);
    const log = fs.readFileSync(`${base}.log`, "utf8"), buildLog = fs.readFileSync(`${base}-build.log`, "utf8");
    need(!noInfra.test(log) && !keyWarning.test(log) && !keyWarning.test(buildLog), `INFRA_OR_KEY_WARNING ${id} ${phase}`);
    const meta = read(`${base}-inputs.json`);
    need(requiredInputs.every(input => Object.hasOwn(meta.inputs, input)), `REAL_PRODUCTIVE_INPUTS ${id} ${phase}`);
    need(requiredInputs.every(input => Object.values(meta.outputs).some(output => output.inputs?.[input]?.bytesInOutput > 0)),
      `REAL_PRODUCTIVE_EMITTED_CODE ${id} ${phase}`);
    need(meta.inputs["../../lib/api-client-react/src/generated/api.ts"].imports.some(i => i.path === "@tanstack/react-query")
      && meta.inputs["../../lib/api-client-react/src/generated/api.ts"].imports.some(i => i.path === "src/components/e11-node-test-transport.ts"), "REAL_GENERATED_HOOKS_NETWORK_SEAM");
    const artifacts = Object.fromEntries([".log", ".json", "-build.log", "-inputs.json"].map(ext => [`${base}${ext}`, sha(fs.readFileSync(`${base}${ext}`))]));
    phases.push({ phase, exit: recorded.exit, actual, sourceHash: recorded.caseSourceHash, bundleHash: recorded.bundleHash, artifacts });
  }
  need(row.green.bundleHash === row.restored.bundleHash, `RESTORED_BUNDLE ${id}`);
  audited.push({ id, manifest: file, status: retained ? "RETAINED_TERMINAL_EXPLICIT_UNREACHED_BRANCH_EXCLUSION" : "CURRENT_SNAPSHOT_TERMINAL",
    exclusion: retained ? exclusions[id] : null, declarationHash: sha(declaration.getText()), phases });
}
need(Object.values(hookCoverage).flat().every(id => audited.some(c => c.id === id))
  && recoveryObligations.every(o => audited.some(c => c.id === o.id)), "MOUNTED_COVERAGE_MAP");
const realAppCases = [...declarations].filter(([, n]) => /\b(?:app|adminApp|openAppBell)\(/.test(n.expression.arguments[1].getText())).map(([id]) => id);
need(realAppCases.length > 0 && testSource.includes("render(<App />)"), "REAL_APP_HELPER");
const output = `${directory}/frontend-final-audit-${new Date().toISOString().replaceAll(":", "-")}.json`;
fs.writeFileSync(output, JSON.stringify({
  status: "PASS_153_MOUNTED_UI_OBLIGATIONS_150_CURRENT_3_EXPLICIT_RETAINED",
  auditor: { path: `${directory}/audit-frontend-final.mjs`, sha256: sha(fs.readFileSync(`${directory}/audit-frontend-final.mjs`)), testsExecuted: 0 },
  counts: { selected: 153, currentSnapshot: 150, retainedHistorical: 3, phases: 459, hooks: 21, recoveryObligations: 42, duplicateKeyWarnings: 0 },
  snapshots, impactProof: { path: impactPath, sha256: sha(fs.readFileSync(impactPath)) },
  warningProof: { path: warningPath, sha256: sha(fs.readFileSync(warningPath)) },
  currentSourceHashes: manifests.get(currentRuns[1]).sourceHashes, currentHarnessHashes: manifests.get(currentRuns[1]).harnessHashes,
  hookCoverage, recoveryObligations, realAppCases, requiredMetafileInputs: requiredInputs,
  coverageMeaning: "Real generated hooks and App/parents are bundled; named mounted obligations executed natively under React Query. Hook mapping is not a per-hook runtime instrumentation trace.",
  limitations: ["Native mounted DOM/offline transport, not a browser E2E run.", "No live HTTP, PostgreSQL, SQL effects, backend transactional semantics or full-system E11 acceptance certified.",
    "Three old cycles retained only by explicit unchanged-path exclusions; historical FAIL manifests remain FAIL.", "Bundle hashes were recorded by runner; cleaned temporary bundles are not available for fresh byte rehash."],
  cases: audited,
}, null, 2), { flag: "wx" });
console.log(`${output} (PASS: 153 exact IDs; 459 phases; 150 current + 3 explicit retained; zero duplicate-key warnings)`);