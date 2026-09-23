import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import mutations from "./backend-mutants.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(path.join(root, "artifacts/api-server/package.json"));
const ts = require("typescript");
const relative = file => path.relative(root, file).split(path.sep).join("/");
const hash = value => createHash("sha256").update(value).digest("hex");
const read = file => fs.readFileSync(path.join(root, file));
const text = file => read(file).toString("utf8");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const manifests = {
  historic1: "reports/e11/logs/backend-2026-09-23T00-11-44.214Z/manifest.json",
  historic2: "reports/e11/logs/backend-2026-09-23T00-14-05.276Z/manifest.json",
  historic3: "reports/e11/logs/backend-2026-09-23T00-16-53.924Z/manifest.json",
  revalidated: "reports/e11/logs/backend-2026-09-23T00-29-54.702Z/manifest.json",
  final: "reports/e11/logs/backend-2026-09-23T00-36-02.446Z/manifest.json",
};
const loaded = Object.fromEntries(Object.entries(manifests).map(([name, file]) => [name, JSON.parse(text(file))]));
const testsFile = "artifacts/api-server/src/lib/e11.test.ts";
const typeOnlyTestDelta = [
  [
    '    const identityHandler = identityRoute(transaction === 1 ? "A" : "F", transaction === 1 ? 4 : 5);',
    '    const identityHandler = identityRoute(transaction === 1 ? "A" : "F", transaction === 1 ? 4 : 5) as\n      (text: string, params: unknown[]) => Record<string, unknown>[];',
  ],
  [
    '    const handler = identityRoute("F", 2);',
    '    const handler = identityRoute("F", 2) as\n      (text: string, params: unknown[]) => Record<string, unknown>[];',
  ],
  [
    '  const boundary = createE11LegacyBoundary(true, ((req, _res, next) => {',
    '  const boundary = createE11LegacyBoundary(true, ((req: { auth?: unknown }, _res: unknown, next: () => void) => {',
  ],
];
let priorTests = text(testsFile);
for (const [before, after] of typeOnlyTestDelta) {
  const occurrences = priorTests.split(after).length - 1;
  invariant(occurrences === (before.includes('handler = identityRoute("F"') ? 2 : 1),
    `Type-only delta occurrence mismatch: ${after}`);
  priorTests = priorTests.replaceAll(after, before);
}
const finalRecordedTestHash = loaded?.final?.sourceHashes?.[testsFile];
invariant(hash(priorTests) === finalRecordedTestHash, "Reversed type-only test delta does not recover final evidence hash");
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: testsFile,
}).outputText;
const priorTestEmitSha256 = hash(transpile(priorTests));
const currentTestEmitSha256 = hash(transpile(text(testsFile)));
invariant(priorTestEmitSha256 === currentTestEmitSha256, "Type-only test delta changes JavaScript emit");
const tests = [...text(testsFile).matchAll(/test\("([^"]+)"/g)].map(match => match[1]);
const mutantIds = mutations.map(([id]) => id);
invariant(tests.length === 60 && mutantIds.length === 60, "Final cardinality is not 60/60");
invariant(new Set(tests).size === 60 && new Set(mutantIds).size === 60, "Duplicate test or mutant ID");
invariant(tests.every(id => mutantIds.includes(id)) && mutantIds.every(id => tests.includes(id)), "Test/mutant ID mismatch");

const regressions = [
  "E11-REPLAY-LOCK-NAMESPACE", "E11-REPLAY-SAME-BODY-NO-WORK",
  "E11-REPLAY-DIFFERENT-BODY-DENIED", "E11-ASSIGN-ADMIN-CAS-HISTORY",
  "E11-ASSIGN-STALE-CAS-NO-WRITE",
];
const previousPending = [
  "E11-ROLE-REENTRY-STARTS-F", "E11-EXECUTE-REAUTH-DENIES-REVOKED-DELIVERY",
  "E11-EXECUTE-PARSE-FAILS-FIRST-TRANSACTION", "E11-EXECUTE-DELIVER-FAILS-AFTER-COMMIT",
  "E11-NO-CUADRA-NOTIFICATION-ROLLBACK-RETRY", "E11-NO-CUADRA-REPLAY-NO-DOUBLE-NOTIFICATION",
  "E11-A-PREPARES-REAL-E5-PROPOSAL-ONLY", "E11-A-PREPARATION-DUPLICATE-NOTES-DENIED",
  "E11-LEGACY-DEFAULT-DENY-POLICY", "E11-LEGACY-BOUNDARY-AUTHENTICATES-THEN-DENIES",
  "E11-E5-A-CLOSED-WHILE-OFF", "E11-ERROR-BODY-IS-PRIVATE",
];
const recoveryNew = mutantIds.filter(id => id.startsWith("E11-RECOVERY-"));
invariant(recoveryNew.length === 12, "Recovery obligation cardinality changed");
const historicTerminal = new Set(["historic1", "historic2", "historic3"]
  .flatMap(name => loaded[name].cases.map(entry => entry.name)));
invariant(historicTerminal.size === 36, "Historic terminal prefix is not 36 IDs");
const historicUnaffected = [...historicTerminal].filter(id => !regressions.includes(id));
invariant(historicUnaffected.length === 31, "Manual unaffected historic partition is not 31 IDs");

invariant(loaded.historic1.status === "FAIL" && loaded.historic2.status === "FAIL" &&
  loaded.historic3.status === "FAIL" && loaded.revalidated.status === "FAIL",
  "A parent FAIL was relabeled");
invariant(loaded.final.status === "COMPLETE_EXPLICIT_SUBSET", "Final subset is not terminal");
invariant(loaded.final.cases.length === 23 && loaded.final.requestedIds.length === 23,
  "Final subset cardinality is not 23");
const expectedFinal = [...previousPending.filter(id => id !== "E11-ROLE-REENTRY-STARTS-F"), ...recoveryNew];
invariant(expectedFinal.length === 23 && expectedFinal.every(id => loaded.final.requestedIds.includes(id)) &&
  loaded.final.requestedIds.every(id => expectedFinal.includes(id)),
  "Final requested ID order/content changed");
invariant(regressions.every((id, index) => loaded.revalidated.cases[index]?.name === id) &&
  loaded.revalidated.cases[5]?.name === "E11-ROLE-REENTRY-STARTS-F",
  "Regression/reentry terminal prefix changed");

const evidenceManifest = new Map();
for (const id of historicUnaffected) {
  const source = ["historic1", "historic2", "historic3"].find(name => loaded[name].cases.some(entry => entry.name === id));
  evidenceManifest.set(id, source);
}
for (const id of regressions) evidenceManifest.set(id, "revalidated");
evidenceManifest.set("E11-ROLE-REENTRY-STARTS-F", "revalidated");
for (const id of expectedFinal) evidenceManifest.set(id, "final");
invariant(evidenceManifest.size === 60, "Consolidated evidence does not cover exactly 60 IDs");

function verifyCase(id, manifestName) {
  const manifest = loaded[manifestName];
  const entry = manifest.cases.find(candidate => candidate.name === id);
  invariant(entry, `Missing case ${id} in ${manifestName}`);
  invariant(entry.green === 0 && entry.red === 1 && entry.restored === 0, `Wrong phase exits for ${id}`);
  invariant(entry.sourceSha256 === entry.restoredSha256 && entry.sourceSha256 !== entry.mutantSha256,
    `Source/restoration hashes invalid for ${id}`);
  const directory = path.posix.dirname(manifests[manifestName]);
  const phases = [
    ["green", "green", "# pass 1", "# fail 0", `ok 1 - ${id}`],
    ["red", "red", "# fail 1", "code: 'ERR_ASSERTION'", `not ok 1 - ${id}`],
    ["restoredGreen", "restored-green", "# pass 1", "# fail 0", `ok 1 - ${id}`],
  ];
  const logs = {};
  for (const [hashKey, suffix, first, second, named] of phases) {
    const file = `${directory}/${id}-${suffix}.log`;
    const bytes = read(file);
    const raw = bytes.toString("utf8");
    invariant(hash(bytes) === entry.rawLogsSha256[hashKey], `Raw log hash mismatch for ${id} ${suffix}`);
    invariant(raw.includes(first) && raw.includes(second) && raw.includes(named), `Weak/non-specific log for ${id} ${suffix}`);
    if (suffix === "red") invariant(!raw.includes("# pass 1"), `Red phase passed for ${id}`);
    logs[suffix] = { file, bytes: bytes.length, sha256: hash(bytes) };
  }
  return { id, provenance: manifestName, mutationFile: entry.file, sourceSha256: entry.sourceSha256,
    mutantSha256: entry.mutantSha256, restoredSha256: entry.restoredSha256, logs };
}
const cases = tests.map(id => verifyCase(id, evidenceManifest.get(id)));

for (const [id, file, before] of mutations) {
  invariant(text(file).split(before).length === 2, `Current unique mutant anchor missing for ${id}`);
}
const currentPhysicalMismatches = Object.entries(loaded.final.sourceHashes)
  .filter(([file, expected]) => !fs.existsSync(path.join(root, file)) || hash(read(file)) !== expected)
  .map(([file, expected]) => ({ file, expected, actual: fs.existsSync(path.join(root, file)) ? hash(read(file)) : null }));
invariant(currentPhysicalMismatches.length === 1 && currentPhysicalMismatches[0].file === testsFile,
  "Current physical snapshot has a non-type-only difference from final execution");

const runner = text("reports/e11/run-backend-offline.mjs");
for (const required of ["fs.realpathSync(output).startsWith(fs.realpathSync(target)",
  "if (real.startsWith(root + path.sep)", "Live mutable input:", "physical-workspace-packages",
  "OFFLINE_SYNTHETIC_SQL_CAPTURE_NO_DB_NO_APP_NO_POSTGRES_OR_HTTP_PROOF"]) {
  invariant(runner.includes(required), `Runner isolation proof missing: ${required}`);
}
for (const manifest of Object.values(loaded)) {
  invariant(manifest.mode === "OFFLINE_SYNTHETIC_SQL_CAPTURE_NO_DB_NO_APP_NO_POSTGRES_OR_HTTP_PROOF",
    "Manifest overclaims PostgreSQL/HTTP proof");
}

function archive(directory) {
  const absolute = path.join(root, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const file = path.posix.join(directory, entry.name);
    return entry.isDirectory() ? archive(file) : [{
      file, bytes: read(file).length, sha256: hash(read(file)),
    }];
  }).sort((a, b) => a.file.localeCompare(b.file));
}
const archiveFiles = [...new Set(Object.values(manifests).map(file => path.posix.dirname(file)))]
  .flatMap(archive);
invariant(archiveFiles.length === 207 &&
  archiveFiles.filter(file => file.file.endsWith(".log")).length === 202 &&
  archiveFiles.filter(file => file.file.endsWith("/manifest.json")).length === 5,
  "Durable raw archive is not exactly 202 logs plus 5 manifests");
const sourceTypecheckFile = "reports/e11/backend-source-typecheck.json";
const sourceTypecheck = JSON.parse(text(sourceTypecheckFile));
invariant(sourceTypecheck.sourceOnly === true && sourceTypecheck.noEmit === true &&
  sourceTypecheck.diagnosticCount === 0 && sourceTypecheck.diagnostics.length === 0 &&
  path.isAbsolute(sourceTypecheck.configFilePath) &&
  sourceTypecheck.rootDir === root && sourceTypecheck.projectReferences.length === 0,
  "Final full-source TypeScript API check is not clean or not configured explicitly");
const currentFiles = [testsFile, "reports/e11/backend-mutants.mjs", "reports/e11/run-backend-offline.mjs",
  "reports/e11/audit-backend-consolidation.mjs", sourceTypecheckFile,
  "artifacts/api-server/src/lib/e11.ts", "artifacts/api-server/src/lib/e11-repository.ts",
  "artifacts/api-server/src/lib/e11-runtime.ts", "artifacts/api-server/src/lib/e5.ts",
  "artifacts/api-server/src/lib/e5-repository.ts", "artifacts/api-server/src/middlewares/e11-legacy.ts"]
  .map(file => ({ file, bytes: read(file).length, sha256: hash(read(file)) }));

const result = {
  status: "CONSOLIDATED_COMPLETE_FROM_TERMINAL_CYCLES",
  scope: "OFFLINE_SYNTHETIC_SQL_CAPTURE_NO_DB_NO_APP_NO_POSTGRES_OR_HTTP_PROOF",
  cardinality: { tests: tests.length, mutants: mutantIds.length, consolidated: cases.length },
  parentManifests: Object.entries(manifests).map(([name, file]) => ({
    name, file, status: loaded[name].status, cases: loaded[name].cases.length,
    bytes: read(file).length, sha256: hash(read(file)),
  })),
  provenance: {
    historicUnaffected: { count: 31, ids: historicUnaffected,
      review: "MANUAL_FUNCTION_REACHABILITY: named test bodies and reached helpers/functions do not call the modified e11Replay body or recovery APIs; terminal log/hash checks are algorithmic." },
    replayRegressionsRevalidated: { count: 5, ids: regressions,
      review: "ALGORITHMIC_TERMINAL_REVALIDATION on frozen recovery backend." },
    previouslyPending: { count: 12, ids: previousPending,
      review: "One terminal reentry cycle in revalidated manifest plus eleven terminal cycles in final manifest." },
    recoveryNew: { count: 12, ids: recoveryNew,
      review: "ALGORITHMIC_TERMINAL_NEW_COVERAGE in final manifest." },
  },
  sourceReachAudit: {
    algorithmicFacts: {
      historicRepositorySha256: [...new Set(["historic1", "historic2", "historic3"]
        .map(name => loaded[name].sourceHashes["artifacts/api-server/src/lib/e11-repository.ts"]))],
      finalRepositorySha256: loaded.final.sourceHashes["artifacts/api-server/src/lib/e11-repository.ts"],
      historicTestSha256: ["historic1", "historic2", "historic3"]
        .map(name => loaded[name].sourceHashes[testsFile]),
      finalTestSha256: loaded.final.sourceHashes[testsFile],
    },
    manualReview: {
      method: "Manual named-test -> helper -> production-function reachability review; not an algorithmic AST/call-graph proof.",
      changedReachableProduction: "The five regression IDs reach the modified e11Replay body and were rerun terminally.",
      unaffectedHistoric: "The 31 listed historic IDs do not reach the modified e11Replay body or newly appended recovery functions. Their old terminal evidence is retained without pretending whole-file repository hashes are equal.",
      newRecovery: "The 12 new IDs reach the stable recovery/query/resolution/tombstone interfaces and use final-source evidence.",
    },
    postEvidenceTypeOnlyTestDelta: {
      file: testsFile, recordedSha256: finalRecordedTestHash, currentSha256: hash(read(testsFile)),
      changes: typeOnlyTestDelta.map(([before, after]) => ({ before, after })),
      reversedSourceMatchesRecordedHash: true, priorTestEmitSha256, currentTestEmitSha256,
      javascriptEmitEquivalent: true,
    },
  },
  checks: {
    exactIds: true, uniqueMutantAnchors: true, greenPass: true, redSpecificErrAssertion: true,
    restoredPassAndSourceHash: true, parentFailuresPreserved: true,
    currentPhysicalSnapshotMatchesFinalExceptExplicitTypeOnlyTestDelta: true,
    currentPhysicalMismatches, liveMutableWorkspaceInputsRejectedByRunner: true,
    sourceKind: "Synthetic SQL request capture only; no driver, DB, PostgreSQL, HTTP server, or live user proof.",
    aliasing: "Only @workspace/db is explicitly mapped to the copied physical snapshot; metafile realpaths reject live non-node_modules workspace inputs. No ghost source alias is accepted as evidence.",
    fullSourceTypecheck: sourceTypecheck,
  },
  finalShell: {
    status: "EPHEMERAL_STDOUT_LOST_AFTER_WORKSPACE_RESTART",
    formerLocation: "/tmp/replit-shell-output-logs/84U3UVYYEPIYWPVNQB6XJ/log",
    rawBytesAvailable: false,
    evidenceUsedForConsolidation: false,
    reconstruction: null,
    terminalSubsetEvidence: manifests.final,
  },
  currentFiles, archive: { files: archiveFiles, totalBytes: archiveFiles.reduce((sum, file) => sum + file.bytes, 0) },
  cases,
};

const jsonFile = path.join(here, "backend-consolidation.json");
const markdownFile = path.join(here, "backend-consolidation.md");
fs.writeFileSync(jsonFile, `${JSON.stringify(result, null, 2)}\n`);
const ids = group => result.provenance[group].ids.map(id => `- \`${id}\``).join("\n");
const markdown = `# E11 backend — consolidación final 60/60

## Resultado

**CONSOLIDATED_COMPLETE_FROM_TERMINAL_CYCLES**: 60 IDs exactos, 60 mutantes y
60 ciclos terminales verde/rojo/restaurado. Esto consolida evidencia; no cambia
ningún manifiesto padre ni lo relabela como PASS. Los cuatro intentos parciales
padre conservan estado FAIL y el último conserva COMPLETE_EXPLICIT_SUBSET 23/23.

Cada verde y restaurado contiene el ID exacto, pass 1/fail 0 y salida 0. Cada
rojo contiene el ID exacto, fail 1, salida 1 y code ERR_ASSERTION. Los hashes de
logs, fuente, mutante y restauración coinciden byte a byte con sus manifiestos.

## Procedencia

### 31 históricos sin alcance al replay modificado — revisión manual de reachability

La conclusión de no-repetición es **manual**, no un call graph algorítmico:
se revisaron los cuerpos de tests y helpers/funciones alcanzados. Estos IDs no
llaman el cuerpo modificado de e11Replay ni APIs de recovery. La comprobación de
logs, cardinalidad, IDs y hashes sí es algorítmica.

${ids("historicUnaffected")}

### 5 regresiones de replay revalidadas

${ids("replayRegressionsRevalidated")}

### 12 obligaciones previamente pendientes

${ids("previouslyPending")}

### 12 obligaciones recovery nuevas

${ids("recoveryNew")}

## Alcance y aislamiento

La evidencia usa funciones productivas reales sobre captura SQL y transacciones
sintéticas rollback-capable. **No prueba PostgreSQL**, locks reales, aislamiento,
DDL, FK, triggers, driver, HTTP ni usuarios DB. El runner copia fuentes físicas,
comprueba realpaths del metafile y rechaza inputs workspace vivos. El único alias
explícito, @workspace/db, apunta a la copia física; no se aceptan ghost aliases.

La única diferencia física posterior al manifiesto final está en e11.test.ts y
es explícitamente type-only: tres assertions de tipos de callbacks y tres
anotaciones de parámetros. El auditor revierte esas cuatro ediciones, recupera
el SHA-256 histórico exacto y demuestra emit JavaScript idéntico con TypeScript.
No se finge igualdad de hash fuente. El JSON adjunto registra ambos hashes, el
delta, hashes de emit, bytes y SHA-256 de fuentes actuales, manifiestos y todos
los logs archivados.

El stdout efímero del shell 23/23 se perdió tras reiniciar el workspace. No hay
copia raw byte-idéntica, no se reconstruye ni se usa como evidencia. La
terminalidad 23/23 se verifica desde el manifiesto durable
COMPLETE_EXPLICIT_SUBSET y los 69 logs raw de sus 23 ciclos; la consolidación
completa verifica 202 logs raw y 5 manifiestos: 207 archivos durables.

La comprobación TypeScript API full-source final usa configFilePath absoluto,
rootDir workspace, projectReferences vacío y noEmit; terminó con cero
diagnósticos. No ejecuta tests.
`;
fs.writeFileSync(markdownFile, markdown);
console.log(`Consolidated ${cases.length}/${tests.length} terminal E11 cycles.`);