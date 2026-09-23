// Reproducible read-only evidence audit. No UI/test runner, render, network, DB,
// serializer regeneration, workflow, source mutation, or relabeling of old runs.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { cases, hookCoverage, limits } from "./frontend-mutants-cases.mjs";
const root = process.cwd(), app = "artifacts/mariana-textil";
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const need = (ok, message) => { if (!ok) throw Error(message); };
const readHashes = new Map();
function read(file) {
  const bytes = fs.readFileSync(file), sha = hash(bytes);
  need(!readHashes.has(file) || readHashes.get(file) === sha, `INPUT_CHANGED ${file}`);
  readHashes.set(file, sha); return bytes;
}
const json = file => JSON.parse(read(file));
const output = `reports/e7/frontend-completion-audit-${new Date().toISOString().replaceAll(":", "-")}.json`;
const report = { status: "AUDITING", helperUiCasesExecuted: 0, helperAppRenders: 0, apiCalls: 0, dbCalls: 0,
  browserAcceptance: false, postgresAcceptance: false, remainingIds: cases.map(c => c.id), hookCoverage, limits };
try {
  read("reports/e7/audit-frontend-completion.mjs");
  const runPaths = [
    "reports/e7/frontend-native-2026-09-23T03-06-55.940Z/manifest.json",
    "reports/e7/frontend-native-2026-09-23T03-16-45.147Z/manifest.json",
    "reports/e7/frontend-native-2026-09-23T03-31-40.181Z/manifest.json",
    "reports/e7/frontend-native-2026-09-23T03-43-51.239Z/manifest.json",
  ];
  const runs = runPaths.map(file => ({ file, dir: path.dirname(file), manifest: json(file) }));
  const final = runs[3].manifest;
  const expectedCounts = [8, 1, 5, 9], failureIds = ["E7-GROUP1-FOUR", "E7-GROUP1-LINKS", "E7-RANGE"];
  const testPath = `${app}/src/components/e7-node.dom.test.tsx`, transportPath = `${app}/src/components/e7-node-test-transport.ts`;
  const testSource = read(testPath).toString(), transportSource = read(transportPath).toString();
  const tree = ts.createSourceFile(testPath, testSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = tree.statements.filter(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test");
  need(cases.length === 23 && declarations.length === 23 && new Set(cases.map(c => c.id)).size === 23, "EXACT_23_INVENTORY");
  report.originalRuns = [];
  report.terminals = [];
  report.failedGreenAttempts = [];
  let phaseCount = 0, duplicateWarnings = 0;
  // The infrastructure classifier's name contains DUPLICATE_KEY, but that is
  // not a React warning. Match warning text, not its generic sentinel label.
  const duplicatePattern = /same key|unique\s+["'`]?key["'`]?|duplicate\s+key/i;
  const infraPattern = /E4_OFFLINE|E4_\w*ESCAPE|E11_UNCONFIGURED|E7_UNCONFIGURED|E7_INFRASTRUCTURE|E7_ANCESTOR_CONTROL|E7_REAL_PARENT_CONTROL|E7_REAL_SCOPE_SELECTOR_CONTROL|E7_BINARY_FIXTURE_HASH_MISMATCH|SyntaxError|TypeError|ReferenceError|MODULE_NOT_FOUND/;
  for (const [index, run] of runs.entries()) {
    const m = run.manifest, completed = m.cases.filter(c => c.green && c.red && c.restored);
    need(completed.length === expectedCounts[index], `TERMINAL_COUNT ${run.file}`);
    need(index < 3 ? m.status === "FAIL_NOT_ACCEPTED" && m.error.includes(`${failureIds[index]}-green`)
      : m.status === "PASS_SELECTED_ONLY_NOT_FULL_E7" && m.selectedIds.length === 9 && !m.error, `RUN_STATUS ${run.file}`);
    need(m.changedSources.length === 0 && m.changedHarness.length === 0 && m.cleanupErrors.length === 0
      && m.sandboxRemoved && m.cleanup.every(c => c.removed), `RUN_DRIFT_OR_CLEANUP ${run.file}`);
    const changedSources = Object.entries(m.sourceHashes).filter(([file, sha]) => hash(read(file)) !== sha)
      .map(([file, before]) => ({ file, before, final: readHashes.get(file) }));
    const allowed = index < 2 ? [testPath, transportPath] : index === 2 ? [testPath] : [];
    need(changedSources.length === allowed.length && changedSources.every(d => allowed.includes(d.file)), `UNREVIEWED_SOURCE_CHANGE ${run.file}`);
    need(Object.entries(m.harnessHashes).every(([file, sha]) => hash(read(file)) === sha), `HARNESS_DRIFT ${run.file}`);
    report.originalRuns.push({ manifest: run.file, manifestHash: readHashes.get(run.file), originalStatus: m.status,
      originalError: m.error ?? null, completedIds: completed.map(c => c.id), nativePhasesExecuted: m.testsExecuted,
      originalDependencyHashes: m.sourceHashes, originalHarnessHashes: m.harnessHashes, changedSources,
      ownedTreesRemoved: true, cleanupErrors: [] });
    let observedPhases = 0;
    for (const row of m.cases) {
      for (const phase of ["green", "red", "restored"]) {
        const nativeFile = `${run.dir}/${row.id}-${phase}.json`;
        if (!fs.existsSync(nativeFile)) continue;
        observedPhases++; phaseCount++;
        const native = json(nativeFile), logFile = `${run.dir}/${row.id}-${phase}.log`, log = read(logFile).toString();
        const actuals = native.tests.filter(t => !t.skipped);
        need(actuals.length === 1 && actuals[0].name === row.id, `NATIVE_EXACT_SELECTION ${nativeFile}`);
        if (duplicatePattern.test(log)) duplicateWarnings++;
        const actual = actuals[0], saved = row[phase];
        if (!saved) {
          need(index < 3 && row.id === failureIds[index] && phase === "green" && actual.status === "failed", `UNEXPECTED_INCOMPLETE_PHASE ${nativeFile}`);
          report.failedGreenAttempts.push({ id: row.id, nativeFile, nativeHash: readHashes.get(nativeFile),
            logFile, logHash: readHashes.get(logFile), actual, disposition: "ORIGINAL_FAILED_GREEN_RETAINED_NOT_ACCEPTED_NOT_RED" });
          continue;
        }
        need(!infraPattern.test(log) && !duplicatePattern.test(log), `INFRASTRUCTURE_IN_ACCEPTED_CYCLE ${nativeFile}`);
        need(JSON.stringify(actual) === JSON.stringify(saved.actual), `NATIVE_MANIFEST_MISMATCH ${nativeFile}`);
        const wrapped = actual.code === "ERR_TEST_FAILURE" && actual.failureType === "testCodeFailure";
        const code = wrapped ? actual.causeCode : actual.code, message = wrapped ? actual.causeMessage : actual.message;
        if (phase === "red") need(saved.exit === 1 && actual.status === "failed" && code === "ERR_ASSERTION"
          && (message === row.id || message?.startsWith(`${row.id}\n`)), `SPECIFIC_RED_REQUIRED ${nativeFile}`);
        else need(saved.exit === 0 && actual.status === "passed", `GREEN_EXIT_ZERO_REQUIRED ${nativeFile}`);
        const c = cases.find(c => c.id === row.id), source = read(`${app}/${c.file}`).toString();
        need(source.split(c.before).length === 2, `UNIQUE_ANCHOR ${row.id}`);
        need(saved.sourceHash === hash(phase === "red" ? source.replace(c.before, c.after) : source), `PHASE_SOURCE_HASH ${nativeFile}`);
      }
      if (!row.green || !row.red || !row.restored) continue;
      const c = cases.find(c => c.id === row.id), declaration = declarations.find(d => d.expression.arguments[0]?.text === row.id);
      const inventory = m.caseInventory.find(c => c.id === row.id);
      need(declaration && inventory.caseAstHash === hash(declaration.getText()), `ACCEPTED_AST_DRIFT ${row.id}`);
      need(inventory.sourceHash === hash(read(`${app}/${c.file}`)), `PRODUCTIVE_SOURCE_DRIFT ${row.id}`);
      report.terminals.push({ id: row.id, originalManifest: run.file, caseAstHash: inventory.caseAstHash,
        productiveSourceHash: inventory.sourceHash, mutation: c,
        phases: Object.fromEntries(["green", "red", "restored"].map(phase => {
          const nativeFile = `${run.dir}/${row.id}-${phase}.json`, logFile = `${run.dir}/${row.id}-${phase}.log`;
          const inputs = `${run.dir}/${row.id}-${phase}-inputs.json`;
          read(inputs);
          return [phase, { exit: row[phase].exit, actual: row[phase].actual, sourceHash: row[phase].sourceHash,
            bundleHash: row[phase].bundleHash, nativeFile, nativeHash: readHashes.get(nativeFile),
            logFile, logHash: readHashes.get(logFile), buildInputs: inputs, buildInputsHash: readHashes.get(inputs) }];
        })) });
    }
    need(observedPhases === m.testsExecuted, `PHASE_ACCOUNTING ${run.file}`);
  }
  need(report.terminals.length === 23 && new Set(report.terminals.map(t => t.id)).size === 23
    && cases.every(c => report.terminals.some(t => t.id === c.id)), "EXACT_23_TERMINAL_BIJECTION");
  need(phaseCount === 72 && report.failedGreenAttempts.length === 3 && duplicateWarnings === 0, "FINAL_PHASE_WARNING_ACCOUNTING");

  // Prove each preparation change, not merely ignore shared-file drift.
  const withoutDocuments = transportSource
    .replace("export const legacyDocuments: api.ClienteDocumento[] = [];\n", "")
    .replace('  base.routes.set("GET /api/clientes/21/documentos", ({ params }) => {\n    if (params.size !== 0) return unknownAdjacentQuery("/api/clientes/21/documentos");\n    return structuredClone(legacyDocuments);\n  });\n', "");
  need(hash(withoutDocuments) === runs[1].manifest.sourceHashes[transportPath], "DOCUMENT_ADDITION_RECONSTRUCTION");
  const beforeAdjacent = withoutDocuments
    .replace("export const legacyCreditEvidence: api.CreditEvidence = { clienteId: 21, atribucionHabilitada: false, movimientos: [] };\n", "")
    .replace("export const legacyDirectedHistory: api.SolicitudesPagoDirigidoResult = { solicitudes: [] };\n", "")
    .replace('function unknownAdjacentQuery(path: string) {\n  const message = `E7_UNCONFIGURED_TRANSPORT GET ${path}`;\n  console.error(message);\n  throw Error(message);\n}\n', "")
    .replace('  base.routes.set("GET /api/clientes/21/evidencia-credito", ({ params }) => {\n    if (![...params.keys()].every(k => k === "prepararAtribucion")\n      || !["true", "false"].includes(params.get("prepararAtribucion") ?? ""))\n      return unknownAdjacentQuery("/api/clientes/21/evidencia-credito");\n    return structuredClone(legacyCreditEvidence);\n  });\n', "")
    .replace('  base.routes.set("GET /api/pagos-dirigidos", ({ params }) => {\n    if (params.get("tipo") !== "CLIENTE" || params.get("entidadId") !== "21"\n      || ![...params.keys()].every(k => k === "tipo" || k === "entidadId"))\n      return unknownAdjacentQuery("/api/pagos-dirigidos");\n    return structuredClone(legacyDirectedHistory);\n  });\n', "");
  need(hash(beforeAdjacent) === runs[0].manifest.sourceHashes[transportPath], "ADJACENT_ADDITION_RECONSTRUCTION");
  const resumeSource = read("reports/e7/audit-frontend-resume.mjs").toString();
  const resumeTree = ts.createSourceFile("resume.mjs", resumeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const oldRangeNode = resumeTree.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText() === "oldRange")?.initializer;
  need(oldRangeNode && ts.isNoSubstitutionTemplateLiteral(oldRangeNode), "OLD_RANGE_LITERAL_MISSING");
  const range = declarations.find(d => d.expression.arguments[0]?.text === "E7-RANGE");
  const oldSuite = testSource.replace(range.getText(), oldRangeNode.text)
    .replace('import { E11ApplicationBoundary } from "../pages/e11";', 'import { E11SessionProvider } from "../lib/e11-session";')
    .replace("<E11ApplicationBoundary>{element}</E11ApplicationBoundary>", "<E11SessionProvider user={actor}>{element}</E11SessionProvider>")
    .replace("// Download extension; the pending RANGE preparation is repaired separately.", "// Download extension: preceding 20 native declaration ASTs remain unchanged.");
  need(hash(oldSuite) === runs[2].manifest.sourceHashes[testPath]
    && runs.slice(0, 3).every(r => r.manifest.sourceHashes[testPath] === hash(oldSuite)), "SUITE_RECONSTRUCTION");
  const helperUsers = declarations.filter(d => d.getText().includes("directParent(")).map(d => d.expression.arguments[0].text);
  need(helperUsers.length === 2 && helperUsers.every(id => final.selectedIds.includes(id)), "HELPER_AFFECTED_PRIOR_PREFIX");
  report.preparationEvolution = [
    { afterTerminalCount: 8, change: "Two exact adjacent client-21 response constructors/registrations only; no wildcard. Earlier successful cases could not request these then-unconfigured paths under the strict infra guard.",
      file: transportPath, originalHash: hash(beforeAdjacent), nextHash: hash(withoutDocuments), reversibleHashProof: true },
    { afterTerminalCount: 9, change: "One no-query client-21 documents response only; existing handlers unchanged. Earlier successful cases did not request this then-unconfigured route.",
      file: transportPath, originalHash: hash(withoutDocuments), nextHash: hash(transportSource), reversibleHashProof: true },
    { afterTerminalCount: 14, change: "Unaccepted RANGE uses actual custom-preset inputs and one committed edit; stronger initial assertions, original no-query/range assertion retained. Only two pending direct-parent cases use the corrected actual App boundary. No productive policy changes.",
      file: testPath, originalHash: hash(oldSuite), finalHash: hash(testSource), helperUsers,
      changedCaseAst: ["E7-RANGE"], previouslyAcceptedCaseAstsChanged: [], reversibleHashProof: true },
  ];

  const documentManifest = "reports/e7/frontend-document-preflight-2026-09-23T02-56-23.609Z/manifest.json";
  const documentFile = "reports/e7/frontend-document-bytes.json", proof = json(documentManifest), documents = json(documentFile);
  need(proof.status === "PASS_REAL_PDF_XLSX_FIXTURES_ZERO_UI_CASES" && proof.testsExecuted === 0
    && proof.changedSources.length === 0 && proof.cleanupErrors.length === 0 && proof.sandboxRemoved, "DOCUMENT_PROVENANCE_STATUS");
  need(readHashes.get(documentFile) === proof.documentFixtureHash, "DOCUMENT_ASSET_DRIFT");
  for (const [file, sha] of Object.entries(proof.sourceHashes)) need(hash(read(file)) === sha, `BACKEND_DOCUMENT_SOURCE_DRIFT ${file}`);
  for (const [file, sha] of Object.entries(proof.helperHashes)) need(hash(read(file)) === sha, `DOCUMENT_HELPER_DRIFT ${file}`);
  const binaryInventory = [];
  for (const scope of ["global", "site2"]) for (const kind of ["pdf", "xlsx"]) {
    const d = documents.documents[scope][kind], bytes = Buffer.from(d.base64, "base64");
    const mime = kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    need(bytes.length === d.bytes && hash(bytes) === d.sha256 && d.mime === mime
      && JSON.stringify(proof.documents[scope][kind]) === JSON.stringify({ sha256: d.sha256, bytes: d.bytes, mime: d.mime }), `REAL_BINARY_MISMATCH ${scope}:${kind}`);
    if (kind === "pdf") {
      const text = bytes.toString("latin1"), offset = Number(text.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
      need(text.startsWith("%PDF-1.4\n") && Number.isInteger(offset) && text.slice(offset).startsWith("xref\n"), "PDF_FRAMING_XREF");
    } else need(bytes.subarray(0, 2).toString() === "PK", "XLSX_ARCHIVE_FRAMING");
    binaryInventory.push({ scope, kind, bytes: d.bytes, sha256: d.sha256, mime: d.mime });
  }
  report.documents = { manifest: documentManifest, manifestHash: readHashes.get(documentManifest), fixture: documentFile,
    fixtureHash: proof.documentFixtureHash, backendSourceHashes: proof.sourceHashes, originalHelperHashes: proof.helperHashes,
    binaries: binaryInventory,
    scope: "Real backend serializers, synthetic input; original preparation validated Zod, PDF xref/legends, ExcelJS reread/rows and scoped foreign-receipt exclusion. Final audit verifies frozen bytes/source provenance, not authenticated backend behavior." };
  report.finalSourceHashes = final.sourceHashes;
  report.finalNativeHarnessHashes = final.harnessHashes;
  report.finalCaseAstHashes = Object.fromEntries(report.terminals.map(t => [t.id, t.caseAstHash]));
  report.priorStageAudit = { file: "reports/e7/frontend-resume-audit-2026-09-23T03-42-05.439Z.json",
    sha256: hash(read("reports/e7/frontend-resume-audit-2026-09-23T03-42-05.439Z.json")) };
  report.staticEvidence = [
    "reports/e7/frontend-preflight-2026-09-23T03-41-09.186Z/manifest.json",
    "reports/e7/frontend-native-2026-09-23T03-41-54.618Z/manifest.json",
    "reports/e7/frontend-runtime-imports-2026-09-23T03-41-55.953Z/manifest.json",
  ].map(file => { const m = json(file); need(m.status.startsWith("PASS_") && m.testsExecuted === 0, `STATIC_EVIDENCE ${file}`);
    return { file, sha256: readHashes.get(file), status: m.status, diagnosticCount: m.diagnosticCount, zodChecks: m.schemaChecks?.length }; });
  report.mainTerminalCases = 23; report.acceptedNativePhases = 69; report.totalMainAttemptedNativePhases = phaseCount;
  report.duplicateKeyWarningsAcrossAll72Phases = duplicateWarnings;
  report.remainingIds = [];
  const preliminaryFile = "reports/e7/frontend-completion-audit-2026-09-23T03-49-32.586Z.json";
  const preliminary = json(preliminaryFile);
  need(preliminary.status === "FAIL_COMPLETION_AUDIT" && preliminary.error === "Error: FINAL_PHASE_WARNING_ACCOUNTING", "PRELIMINARY_AUDIT_CHANGED");
  report.auditDevelopmentHistory = [{ file: preliminaryFile, sha256: readHashes.get(preliminaryFile),
    originalStatus: preliminary.status, retainedUnchanged: true,
    explanation: "First auditor classifier matched the generic infrastructure sentinel name DUPLICATE_KEY after missing endpoints, not an actual warning. Corrected only the auditor to match warning prose. No native/UI case was run or changed." }];
  report.status = "PASS_23_EXACT_GROUPED_NATIVE_CYCLES_NOT_BROWSER_NOT_POSTGRES";
  report.claimBoundary = "69 native mounted phases in 23 grouped cycles, consolidated from unchanged historical terminal evidence plus final nine. Three failed GREEN attempts and their FAIL manifests remain failures. No single clean 23-case rerun is claimed. Finite synthetic transport and Node DOM; successful binary save is observed at object-URL/anchor boundary, not a real browser filesystem download. No authenticated API/PG acceptance, live money, E7 gate release, Grupo 2-4 expansion, or E11 acceptance expansion.";
} catch (error) { report.status = "FAIL_COMPLETION_AUDIT"; report.error = String(error); process.exitCode = 1; }
report.changedAuditInputs = [...readHashes].filter(([file, sha]) => hash(fs.readFileSync(file)) !== sha).map(([file]) => file);
if (report.changedAuditInputs.length) { report.status = "FAIL_CONCURRENT_INPUT_DRIFT"; process.exitCode = 1; }
report.auditInputHashes = Object.fromEntries(readHashes);
fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(`${output} (${report.status})`);