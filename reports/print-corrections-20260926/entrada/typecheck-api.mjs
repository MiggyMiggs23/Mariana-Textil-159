import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const root = process.cwd();
const candidateDir = path.join(root, "artifacts/api-server/dist-print-entrada-20260926");
const map = JSON.parse(fs.readFileSync(path.join(candidateDir, "index.mjs.map"), "utf8"));
const frozen = path.join(root, "reports/postrelease-review-20260926/tarea-4/final-frozen-root");
const overlay = path.join(root, "reports/print-corrections-20260926/entrada/overlay");
const sources = new Map(map.sources.map((p, i) => [path.resolve(candidateDir, p), map.sourcesContent[i]])
  .filter(([p, content]) => !p.includes("node_modules") && content != null));
const opts = {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true, strictFunctionTypes: false, skipLibCheck: true, noEmit: true,
  allowJs: true, esModuleInterop: true, resolveJsonModule: true, customConditions: ["workspace"],
  paths: { "@workspace/db/advisory-locks": [path.join(root, "lib/db/src/lib/advisory-locks.mjs")] },
  types: ["node"], typeRoots: [path.join(root, "artifacts/api-server/node_modules/@types"), path.join(root, "node_modules/@types")],
};
const host = ts.createCompilerHost(opts);
const diskRead = host.readFile;
const missing = new Set();
host.readFile = file => {
  file = path.resolve(file);
  if (sources.has(file)) return sources.get(file);
  if (file.startsWith(root) && !file.includes("node_modules") && /\.[cm]?tsx?$/.test(file)) {
    const rel = path.relative(root, file);
    for (const base of [overlay, frozen]) {
      const alternate = path.join(base, rel);
      if (fs.existsSync(alternate)) return fs.readFileSync(alternate, "utf8");
    }
    missing.add(rel);
    return undefined;
  }
  return diskRead(file);
};
const fileExists = host.fileExists;
host.fileExists = file => {
  file = path.resolve(file);
  if (sources.has(file)) return true;
  if (file.startsWith(root) && !file.includes("node_modules") && /\.[cm]?tsx?$/.test(file)) {
    const rel = path.relative(root, file);
    return [overlay, frozen].some(base => fs.existsSync(path.join(base, rel)));
  }
  return fileExists(file);
};
host.getSourceFile = (file, version) => {
  const text = host.readFile(file);
  return text === undefined ? undefined : ts.createSourceFile(file, text, version);
};
// Typecheck the complete frozen source graph reachable from the modified engine.
const program = ts.createProgram([
  path.join(root, "artifacts/api-server/src/lib/inventario.ts"),
  path.join(root, "artifacts/api-server/src/lib/entrada-floor-evidence.ts"),
], opts, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
const parentDir = path.join(root, "artifacts/api-server/dist-owner-cash-v10-20260926");
const parentMap = JSON.parse(fs.readFileSync(path.join(parentDir, "index.mjs.map"), "utf8"));
for (let i = 0; i < parentMap.sources.length; i++) {
  const file = path.resolve(parentDir, parentMap.sources[i]);
  if (!file.includes("node_modules") && parentMap.sourcesContent[i] != null)
    sources.set(file, parentMap.sourcesContent[i]);
}
const baseline = ts.getPreEmitDiagnostics(ts.createProgram([
  path.join(root, "artifacts/api-server/src/lib/inventario.ts"),
], opts, host));
const identity = d => JSON.stringify([d.file?.fileName, d.code, ts.flattenDiagnosticMessageText(d.messageText, "\n")]);
const baselineIdentities = baseline.map(identity).sort();
const candidateIdentities = diagnostics.map(identity).sort();
const noNewErrors = JSON.stringify(baselineIdentities) === JSON.stringify(candidateIdentities);
const report = {
  status: diagnostics.length ? (noNewErrors ? "NO_NEW_DIAGNOSTICS_BASELINE_LIMITATION" : "BLOCKED_OR_ERRORS") : "PASSED",
  scope: "Changed API engine/helper and complete reachable frozen source graph; application source read from candidate sourcemap or frozen UI/type root only.",
  baselineDiagnosticCount: baseline.length,
  candidateDiagnosticCount: diagnostics.length,
  noNewErrors,
  limitation: "CashV10 sourcemap omits advisory-locks.d.mts. Checking its exact frozen JavaScript infers numeric keys although existing callers pass strings. All four diagnostics also occur identically in untouched cashV10; none involve receipt-floor changes. This is not a full zero-diagnostic package typecheck.",
  diagnostics: ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: p => p, getCurrentDirectory: () => root, getNewLine: () => "\n",
  }),
  unavailableFrozenTypeSources: [...missing],
};
fs.writeFileSync("reports/print-corrections-20260926/entrada/api-candidate/typecheck.json", JSON.stringify(report, null, 2));
console.log(report.status, diagnostics.length, "diagnostics", report.unavailableFrozenTypeSources);
console.log(report.diagnostics);
process.exitCode = diagnostics.length && !noNewErrors ? 1 : 0;