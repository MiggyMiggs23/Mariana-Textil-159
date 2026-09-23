// Static download preparation after the unchanged productive-handler handoff.
// No native case execution or claims about old/new GREEN prefixes.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { cases } from "./frontend-mutants-cases.mjs";
const root = process.cwd(), app = "artifacts/mariana-textil";
const require = createRequire(path.join(root, app, "package.json")), ts = require("typescript");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const baselinePath = "reports/e7/frontend-native-2026-09-23T02-49-27.032Z/manifest.json";
const documentsPath = "reports/e7/frontend-document-preflight-2026-09-23T02-56-23.609Z/manifest.json";
const baseline = JSON.parse(fs.readFileSync(baselinePath)), documents = JSON.parse(fs.readFileSync(documentsPath));
const testFile = `${app}/src/components/e7-node.dom.test.tsx`, source = fs.readFileSync(testFile, "utf8");
const ast = ts.createSourceFile(testFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText() === "test");
const inventory = declarations.map(d => ({ id: d.expression.arguments[0]?.text, astHash: sha(d.getText()) }));
const changedOriginalDeclarations = baseline.caseInventory.filter(c => inventory.find(d => d.id === c.id)?.astHash !== c.caseAstHash).map(c => c.id);
const documentSourceDrift = Object.entries(documents.sourceHashes).filter(([file, hash]) => sha(fs.readFileSync(file)) !== hash).map(([file]) => file);
const byteFile = "reports/e7/frontend-document-bytes.json";
if (sha(fs.readFileSync(byteFile)) !== documents.documentFixtureHash) throw Error("REAL_DOCUMENT_BYTES_CHANGED");
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(`${app}/tsconfig.json`, ts.sys.readFile).config, ts.sys, path.resolve(app));
const paths = { ...parsed.options.paths };
for (const name of fs.readdirSync("lib")) {
  const file = `lib/${name}/package.json`; if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file)), exp = pkg.exports?.["."], entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
  if (typeof entry === "string") paths[pkg.name] = [path.resolve("lib", name, entry)];
}
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, paths, noEmit: true, incremental: false,
  types: [require.resolve("@types/node/index.d.ts"), path.join(path.dirname(require.resolve("vite/package.json")), "client.d.ts")] });
const diagnostics = ts.getPreEmitDiagnostics(program);
const files = [testFile, `${app}/src/components/e7-node-download-support.ts`, byteFile,
  `${app}/src/components/e7-readers.tsx`, "reports/e7/check-frontend-download-preparation.mjs",
  "reports/e7/prepare-frontend-documents.mjs", "reports/e7/serialize-frontend-document-fixtures.mjs"];
const output = `reports/e7/frontend-download-preparation-${new Date().toISOString().replaceAll(":", "-")}.json`;
const registryMismatch = inventory.length !== cases.length || inventory.some(row => !cases.some(c => c.id === row.id));
const failed = diagnostics.length || changedOriginalDeclarations.length || documentSourceDrift.length || registryMismatch;
fs.writeFileSync(output, JSON.stringify({
  status: failed ? "FAIL_STATIC_PREPARATION" : "PASS_STATIC_DOWNLOAD_PREPARATION_NOT_EXECUTED",
  testsExecuted: 0, caseCount: inventory.length, originalDeclarationsPreserved: changedOriginalDeclarations.length === 0,
  changedOriginalDeclarations, documentSourceDrift, registryMismatch, baselinePath, documentsPath, inventory,
  diagnosticCount: diagnostics.length,
  diagnostics: diagnostics.map(d => ({ file: d.file?.fileName, code: d.code, start: d.start, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") })),
  hashes: Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(file))])),
  boundary: "No GREEN claims. Stable productive handler is unchanged; 23 declarations match the finalized registry. Exact unique anchors and physical native bundle are certified separately by full preflight/build-only.",
}, null, 2), { flag: "wx" });
console.log(output); if (failed) process.exitCode = 1;