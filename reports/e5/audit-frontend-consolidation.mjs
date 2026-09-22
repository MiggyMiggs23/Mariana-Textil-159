/**
 * STATIC ONLY. Does not import test modules, build, spawn, fetch, access SQL,
 * start workflows, or edit original evidence.
 *
 * MAIN after terminal:
 *   node reports/e5/audit-frontend-consolidation.mjs
 * Defaults: all frontend-node-mutants directories' manifests and continuation audits.
 * Explicit repeatable inputs: --manifest PATH --audit PATH; optional --output PATH.
 * A successful result is CONSOLIDATED MULTI-RUN evidence, never one execution.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { cases } from "./frontend-mutants-cases.mjs";

const root = process.cwd(), directory = "reports/e5", app = "artifacts/mariana-textil";
const testFile = `${app}/src/components/e5-node.dom.test.tsx`;
const ts = createRequire(path.join(root, app, "package.json"))("typescript");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const need = (condition, reason) => { if (!condition) throw Error(reason); };
const local = file => {
  const absolute = path.resolve(root, file);
  need(absolute.startsWith(root + path.sep), `PATH_OUTSIDE_WORKSPACE ${file}`);
  return path.relative(root, absolute);
};
const inputs = new Map();
function read(file) {
  file = local(file);
  const bytes = fs.readFileSync(file);
  const sha256 = hash(bytes);
  need(!inputs.has(file) || inputs.get(file) === sha256, `INPUT_CHANGED_DURING_AUDIT ${file}`);
  inputs.set(file, sha256);
  return bytes;
}
const json = file => JSON.parse(read(file).toString());
const parse = text => ts.createSourceFile(testFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const text = read(testFile).toString(), tree = parse(text);
const isTest = s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test";
const declarations = tree.statements.filter(isTest).map(s => [s.expression.arguments[0]?.text, hash(s.getText())]);
const declarationHashes = Object.fromEntries(declarations);
const helpers = Object.fromEntries(tree.statements.filter(s => !isTest(s)).map((s, i) => [`test-top-level-${i}`, hash(s.getText())]));
const byId = new Map(cases.map(c => [c.id, c]));
need(!tree.parseDiagnostics.length && cases.length === 111 && byId.size === 111 &&
  declarations.length === 111 && Object.keys(declarationHashes).length === 111 &&
  declarations.every(([id]) => byId.has(id)), "EXACT_111_NATIVE_IDS_REQUIRED");
for (const c of cases) {
  const source = read(`${app}/${c.file}`).toString();
  need(c.assertion === c.id && c.before !== c.after && source.split(c.before).length === 2 &&
    !parse(source.replace(c.before, c.after)).parseDiagnostics.length, `ANCHOR_OR_SYNTAX ${c.id}`);
}

const manifestPaths = [], auditPaths = [];
let output;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  need(args[i + 1], "MISSING_OPTION_VALUE");
  const value = local(args[i + 1]);
  if (args[i] === "--manifest") manifestPaths.push(value);
  else if (args[i] === "--audit") auditPaths.push(value);
  else if (args[i] === "--output") output = value;
  else throw Error(`UNKNOWN_OPTION ${args[i]}`);
}
const entries = fs.readdirSync(directory, { withFileTypes: true });
if (!manifestPaths.length) for (const entry of entries)
  if (entry.isDirectory() && entry.name.startsWith("frontend-node-mutants-") &&
    fs.existsSync(`${directory}/${entry.name}/manifest.json`))
    manifestPaths.push(`${directory}/${entry.name}/manifest.json`);
if (!auditPaths.length) for (const entry of entries)
  if (entry.isFile() && /^frontend-continuation-audit-.*\.json$/.test(entry.name))
    auditPaths.push(`${directory}/${entry.name}`);
need(manifestPaths.length > 0, "NO_MANIFESTS");
const manifests = new Map(), audits = new Map(), visiting = new Set();
function loadManifest(file) {
  file = local(file);
  if (!manifests.has(file)) manifests.set(file, json(file));
  return manifests.get(file);
}
function loadAudit(file, expectedHash) {
  file = local(file);
  const data = json(file);
  if (expectedHash) need(inputs.get(file) === expectedHash, `CHECKPOINT_HASH ${file}`);
  need(!visiting.has(file), `CHECKPOINT_CYCLE ${file}`);
  if (audits.has(file)) return;
  visiting.add(file);
  need(data.status === "STATIC_RECONCILIATION_NOT_SUITE_PASS" && data.casesExecutedByAudit === 0 &&
    data.verifiedAnchors === 111 && Array.isArray(data.terminal), `INVALID_CONTINUATION_AUDIT ${file}`);
  if (data.checkpoint) loadAudit(data.checkpoint.file, data.checkpoint.sha256);
  for (const original of data.originalManifests ?? []) {
    const m = loadManifest(original.file);
    need(inputs.get(local(original.file)) === original.sha256 &&
      m.status === original.status && m.error === original.error, `HISTORICAL_MANIFEST_CHANGED ${original.file}`);
  }
  const unique = new Set();
  for (const row of data.terminal) {
    need(byId.has(row.id) && !unique.has(row.id), `AUDIT_UNKNOWN_DUPLICATE_ID ${row.id}`);
    unique.add(row.id);
    const m = loadManifest(row.evidence), original = m.cases?.find(c => c.id === row.id);
    need(original?.restored && row.originalProductiveSha256 === original.originalHash &&
      row.restoredProductiveSha256 === original.restored.caseSourceHash, `AUDIT_CASE_LINK ${row.id}`);
    if (data.checkpoint) {
      const ancestor = audits.get(local(data.checkpoint.file));
      const earlier = ancestor?.terminal.find(c => c.id === row.id && c.evidence === row.evidence);
      if (earlier) need(earlier.declarationSha256 === row.declarationSha256, `DECLARATION_CHAIN ${row.id}`);
    }
  }
  need(Array.isArray(data.remainingIds) && data.remainingIds.length === 111 - unique.size &&
    new Set(data.remainingIds).size === data.remainingIds.length &&
    data.remainingIds.every(id => byId.has(id) && !unique.has(id)), `AUDIT_REMAINING_IDS ${file}`);
  visiting.delete(file);
  audits.set(file, data);
}
for (const file of manifestPaths) loadManifest(file);
for (const file of auditPaths) loadAudit(file);

// Reproduce the runner's source inventory, including additions, not just hashes
// of files that happened to exist at the time.
const currentInventory = [];
function collect(directoryName) {
  for (const entry of fs.readdirSync(directoryName, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const file = `${directoryName}/${entry.name}`;
    need(!entry.isSymbolicLink(), `SOURCE_SYMLINK ${file}`);
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) && file !== testFile) continue;
    if (entry.isDirectory()) collect(file); else currentInventory.push(file);
  }
}
collect(`${app}/src`); collect("lib");
currentInventory.push(`${app}/package.json`, "tsconfig.base.json");
currentInventory.sort();
const report = {
  status: "INCOMPLETE_CONSOLIDATION_NOT_ACCEPTED", evidenceKind: "MULTIPLE_MAIN_EXECUTIONS_STATIC_CONSOLIDATION",
  auditorSha256: hash(read("reports/e5/audit-frontend-consolidation.mjs")),
  singleExecution: false, testsExecutedByAuditor: 0, expectedIds: cases.map(c => c.id),
  currentTestFileSha256: hash(text), declarationHashes, helperHashes: helpers,
  originalManifests: [], continuationAudits: [], accepted: [], rejectedCandidates: [], incompleteAttempts: [],
  pendingManifests: [], remainingIds: [], inputHashes: {},
  limitations: ["No test rerun or new UI/SQL/app execution.", "Recorded bundle hashes are not re-created.",
    "Pruned snapshot declarations rely on hash-linked continuation audits, explicitly cited per case.",
    "No backend, PDF, physical-print, or one-run acceptance claim."],
};
function verifyDependencies(m) {
  need(JSON.stringify(Object.keys(m.sourceHashes).sort()) === JSON.stringify(currentInventory), "SOURCE_INVENTORY_CHANGED");
  for (const [file, sha256] of Object.entries({ ...m.sourceHashes, ...m.harnessHashes })) {
    if (file !== testFile) need(hash(read(file)) === sha256, `DEPENDENCY_CHANGED ${file}`);
  }
  const p = m.builderProvenance;
  need(p && p.original.modified === false && p.derived.byteIdenticalToOriginal === false &&
    hash(read(p.original.path)) === p.original.sha256 && hash(read(p.derived.path)) === p.derived.sha256 &&
    p.publicDefines?.BASE_URL === "/" && p.publicDefines?.VITE_FONDO_E10_ENABLED === "false" &&
    p.publicDefines?.DEV === false && p.inheritedOperationalEnvironment === false, "BUILDER_PROVENANCE");
}
function declarationEvidence(file, m, row) {
  if (m.sourceHashes[testFile] === hash(text)) return { kind: "Exact current full test-file SHA256", sha256: hash(text) };
  for (const [auditFile, audit] of audits) {
    const attestation = audit.terminal.find(c => c.id === row.id && local(c.evidence) === file);
    if (!attestation || attestation.declarationSha256 !== declarationHashes[row.id]) continue;
    const recordedHelpers = audit.helperHashes ?? {};
    if (Object.keys(recordedHelpers).filter(k => k.startsWith("test-top-level-")).length !== Object.keys(helpers).length) continue;
    if (Object.entries(helpers).some(([key, value]) => recordedHelpers[key] !== value)) continue;
    if (Object.entries(recordedHelpers).some(([key, value]) =>
      !key.startsWith("test-top-level-") && hash(read(key)) !== value)) continue;
    return { kind: "Hash-linked continuation declaration and unchanged current helpers",
      file: auditFile, sha256: inputs.get(auditFile), checkpoint: audit.checkpoint ?? null,
      compatibilityEvidence: attestation.compatibilityEvidence ?? audit.appOnlyInfrastructureChange };
  }
  throw Error(`NO_COMPATIBLE_DECLARATION_AND_HELPER_PROOF ${row.id}`);
}
function verifyPhase(file, row, c, phase) {
  const value = row[phase], prefix = `${path.dirname(file)}/${row.id}-${phase}`;
  const native = json(`${prefix}.json`);
  need(native.tests?.length === 1 && !native.tests[0].skipped &&
    native.tests[0].name === row.id && JSON.stringify(native.tests[0]) === JSON.stringify(value.actual), `NATIVE_REPORT ${prefix}`);
  const args = value.args;
  need(args.includes("--test") && args.includes("--test-isolation=none") &&
    args[args.indexOf("--test-name-pattern") + 1] === `^${row.id}$`, `NATIVE_SELECTION ${prefix}`);
  const log = read(`${prefix}.log`).toString();
  need(!/E4_OFFLINE|E4_.*ESCAPE|E5_UNCONFIGURED|E5_UNEXPECTED|\b(?:SyntaxError|TypeError|ReferenceError)\b|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(log),
    `INFRASTRUCTURE_NOT_SEMANTIC_RED ${prefix}`);
  need(read(`${prefix}-build.log`).toString().includes("BUNDLE_ONLY_OK"), `BUILD_SUCCESS_EVIDENCE ${prefix}`);
  const meta = json(`${prefix}-inputs.json`);
  const sandbox = phase === "green" ? row.greenSandbox : row.redSandbox;
  for (const input of Object.keys(meta.inputs)) {
    const absolute = path.resolve(sandbox, app, input);
    need(absolute.startsWith(path.resolve(sandbox) + path.sep) ||
      (absolute.startsWith(root + path.sep) && absolute.includes("/node_modules/")), `METAFILE_ESCAPE ${prefix}:${input}`);
    need(!/\/lib\/db\//.test(absolute), `METAFILE_DATABASE ${prefix}`);
  }
  need(/^[a-f0-9]{64}$/.test(value.bundleHash), `BUNDLE_HASH_MISSING ${prefix}`);
  if (phase === "red") {
    const actual = value.actual, wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
    const code = wrapped ? actual.causeCode : actual.code, message = wrapped ? actual.causeMessage : actual.message;
    need(value.exit === 1 && actual.status === "failed" && code === "ERR_ASSERTION" &&
      (message === c.assertion || message?.startsWith(`${c.assertion}\n`)), `SPECIFIC_ASSERTION_REQUIRED ${prefix}`);
  } else need(value.exit === 0 && value.actual.status === "passed", `GREEN_REQUIRED ${prefix}`);
}
const accepted = new Set();
for (const [file, m] of manifests) {
  report.originalManifests.push({ file, sha256: inputs.get(file), originalStatus: m.status,
    originalError: m.error ?? null, finishedAt: m.finishedAt ?? null, selectedIds: m.selectedIds });
  if (m.mode === "BUILD_ONLY_NO_CASE_EXECUTION") continue;
  need(m.declaredTestCount === 111 && new Set(m.selectedIds).size === m.selectedIds.length &&
    m.selectedCount === m.selectedIds.length && m.selectedIds.every(id => byId.has(id)) &&
    m.plannedCases?.length === m.selectedIds.length, `MANIFEST_IDS ${file}`);
  for (const [index, c] of m.plannedCases.entries())
    need(c.id === m.selectedIds[index] && JSON.stringify(c) === JSON.stringify(byId.get(c.id)), `MUTANT_PLAN_CHANGED ${file}:${c.id}`);
  need(JSON.stringify(m.omittedDeclaredIds) === JSON.stringify(cases.filter(c => !m.selectedIds.includes(c.id)).map(c => c.id)),
    `OMITTED_ID_SET ${file}`);
  need(new Set(m.cases.map(c => c.id)).size === m.cases.length &&
    m.cases.every(c => m.selectedIds.includes(c.id)), `MANIFEST_DUPLICATE_OR_UNSELECTED_CASE ${file}`);
  if (!m.finishedAt || !["FAIL_NOT_ACCEPTED", "PASS_DECLARED_E5_UI_MANIFEST_NOT_BACKEND", "PASS_SELECTED_CASES_NOT_FULL_E5", "FAIL_SOURCE_CHANGED"].includes(m.status)) {
    report.pendingManifests.push(file); continue;
  }
  let dependencyProblem;
  try { need(m.status !== "FAIL_SOURCE_CHANGED", "ORIGINAL_SOURCE_CHANGE_FAILURE"); verifyDependencies(m); }
  catch (error) { dependencyProblem = String(error); }
  for (const row of m.cases) {
    if (!row.green || !row.red || !row.restored) {
      report.incompleteAttempts.push({ file, id: row.id, presentPhases: ["green", "red", "restored"].filter(k => row[k]) }); continue;
    }
    try {
      need(!dependencyProblem, dependencyProblem);
      const c = byId.get(row.id), source = read(`${app}/${c.file}`).toString(), sourceHash = hash(source);
      const mutantHash = hash(source.replace(c.before, c.after));
      need(row.assertion === c.assertion && row.originalHash === sourceHash && row.mutantHash === mutantHash &&
        row.green.caseSourceHash === sourceHash && row.red.caseSourceHash === mutantHash &&
        row.restored.caseSourceHash === sourceHash, `PRODUCTIVE_OR_RESTORED_HASH ${row.id}`);
      const proof = declarationEvidence(file, m, row);
      for (const phase of ["green", "red", "restored"]) verifyPhase(file, row, c, phase);
      report.accepted.push({ id: row.id, manifest: file, declarationSha256: declarationHashes[row.id],
        sourceHash, mutantHash, restoredHash: sourceHash, declarationEvidence: proof,
        duplicateCompatibleEvidence: accepted.has(row.id),
        phases: Object.fromEntries(["green", "red", "restored"].map(k => [k, { exit: row[k].exit, bundleHash: row[k].bundleHash }])) });
      accepted.add(row.id);
    } catch (error) { report.rejectedCandidates.push({ file, id: row.id, reason: String(error) }); }
  }
}
report.continuationAudits = [...audits].map(([file, audit]) => ({ file, sha256: inputs.get(file), checkpoint: audit.checkpoint ?? null }));
report.remainingIds = cases.filter(c => !accepted.has(c.id)).map(c => c.id);
for (const [file, expected] of inputs) need(hash(fs.readFileSync(file)) === expected, `INPUT_CHANGED_DURING_AUDIT ${file}`);
report.inputHashes = Object.fromEntries(inputs);
report.acceptedUniqueCount = accepted.size;
report.sourceInventoryCount = currentInventory.length;
if (report.pendingManifests.length) report.status = "BLOCKED_NONTERMINAL_EVIDENCE_NOT_ACCEPTED";
else if (!report.remainingIds.length) report.status = "PASS_CONSOLIDATED_111_UI_OBLIGATIONS_MULTIRUN_NOT_BACKEND";
report.finishedAt = new Date().toISOString();
output ??= `${directory}/frontend-consolidation-${report.finishedAt.replaceAll(":", "-")}.json`;
need(output.startsWith(`${directory}/`) && output.endsWith(".json"), "OUTPUT_MUST_BE_NEW_E5_REPORT_JSON");
fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(JSON.stringify({ output, status: report.status, acceptedUniqueCount: accepted.size,
  remainingCount: report.remainingIds.length, pendingManifests: report.pendingManifests, executionsByAuditor: 0 }, null, 2));
if (!report.status.startsWith("PASS_")) process.exitCode = 1;