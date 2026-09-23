// Authorized offline binary-fixture preparation. No test runner or API/database.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = process.cwd(), app = "artifacts/api-server";
const require = createRequire(path.join(root, app, "package.json")), { build } = require("esbuild");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const need = (ok, message) => { if (!ok) throw Error(message); };
const files = [
  "reports/e7/serialize-frontend-document-fixtures.mjs", "reports/e7/frontend-fixtures.ts",
  "artifacts/api-server/src/lib/e7-export.ts", "artifacts/api-server/src/lib/pdf.ts",
  "artifacts/api-server/src/lib/report-presentation.ts", "lib/api-zod/src/generated/api.ts",
];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    need(!entry.isSymbolicLink(), "E7_DOCUMENT_SOURCE_SYMLINK");
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) collect(file); else files.push(file);
  }
}
collect("lib/number-format/src");
const originals = new Map(files.map(f => [f, fs.readFileSync(f)]));
const evidence = `reports/e7/frontend-document-preflight-${new Date().toISOString().replaceAll(":", "-")}`;
fs.mkdirSync(evidence);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "e7-document-fixtures-")), identity = fs.lstatSync(sandbox);
const tree = path.join(sandbox, "source"); fs.mkdirSync(tree);
const report = { status: "PREPARING", testsExecuted: 0, apiCalls: 0, dbCalls: 0, sandbox,
  sourceHashes: Object.fromEntries([...originals].map(([f, b]) => [f, sha(b)])),
  helperHashes: Object.fromEntries(["reports/e7/prepare-frontend-documents.mjs", "reports/tanda-b-20260922/e12/frontend-offline-guard.cjs"].map(f => [f, sha(fs.readFileSync(f))])),
  cleanupErrors: [],
};
const save = () => fs.writeFileSync(`${evidence}/manifest.json`, JSON.stringify(report, null, 2));
save();
try {
  for (const [file, bytes] of originals) {
    const out = path.join(tree, file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, bytes);
  }
  fs.mkdirSync(path.join(tree, "node_modules"));
  for (const name of ["exceljs", "pdfkit", "zod"]) {
    const target = fs.realpathSync(path.join(root, app, "node_modules", name));
    need(target.includes("/node_modules/"), "E7_DOCUMENT_DEPENDENCY_ESCAPE");
    fs.symlinkSync(target, path.join(tree, "node_modules", name), "dir");
  }
  const outfile = path.join(tree, "serialize.mjs"), output = path.join(tree, "documents.json");
  const result = await build({
    entryPoints: [path.join(tree, "reports/e7/serialize-frontend-document-fixtures.mjs")],
    outfile, bundle: true, platform: "node", format: "esm", target: "node24", packages: "external", metafile: true,
    alias: { "@workspace/number-format": path.join(tree, "lib/number-format/src/index.ts") },
    plugins: [{ name: "no-database-source", setup(build) {
      build.onResolve({ filter: /^(?:@workspace\/db|pg|postgres|mysql2?|better-sqlite3)(?:\/|$)/ }, args => { throw Error(`E7_DOCUMENT_DB_IMPORT ${args.path}`); });
      build.onLoad({ filter: /\/(?:lib\/db|e7-read-model)/ }, args => { throw Error(`E7_DOCUMENT_READER_IMPORT ${args.path}`); });
    } }],
  });
  for (const file of Object.keys(result.metafile.inputs))
    need(fs.realpathSync(path.resolve(file)).startsWith(tree + path.sep), "E7_DOCUMENT_INPUT_ESCAPE");
  fs.writeFileSync(`${evidence}/build-inputs.json`, JSON.stringify(result.metafile, null, 2));
  report.bundleHash = sha(fs.readFileSync(outfile));
  const guard = path.join(tree, "offline-guard.cjs");
  fs.copyFileSync("reports/tanda-b-20260922/e12/frontend-offline-guard.cjs", guard);
  const fd = fs.openSync(`${evidence}/serialization.log`, "wx");
  let outcome;
  try { outcome = spawnSync(process.execPath, ["--require", guard, outfile, output], {
    cwd: tree, timeout: 60000, stdio: ["ignore", fd, fd],
    env: { PATH: path.dirname(process.execPath), HOME: tree, TMPDIR: tree, LANG: "C.UTF-8", TZ: "UTC",
      E4_SANDBOX: tree, E4_LIVE_ROOT: root, NODE_ENV: "test" },
  }); } finally { fs.closeSync(fd); }
  need(!outcome.error && !outcome.signal && outcome.status === 0, "E7_DOCUMENT_SERIALIZATION_FAILED");
  const bytes = fs.readFileSync(output), parsed = JSON.parse(bytes);
  fs.writeFileSync(`${evidence}/document-bytes.json`, bytes);
  // Immutable real serialized bytes consumed by the mounted transport extension.
  fs.writeFileSync("reports/e7/frontend-document-bytes.json", bytes, { flag: "wx" });
  report.documentFixtureHash = sha(bytes);
  report.documents = Object.fromEntries(Object.entries(parsed.documents).map(([scope, files]) =>
    [scope, Object.fromEntries(Object.entries(files).map(([kind, file]) => [kind, { sha256: file.sha256, bytes: file.bytes, mime: file.mime }]))]));
  report.status = "PASS_REAL_PDF_XLSX_FIXTURES_ZERO_UI_CASES";
} catch (e) { report.status = "FAIL_DOCUMENT_FIXTURE_PREPARATION"; report.error = String(e); process.exitCode = 1; }
finally {
  report.changedSources = [...originals].filter(([f, b]) => sha(fs.readFileSync(f)) !== sha(b)).map(([f]) => f);
  if (report.changedSources.length) { report.status = "FAIL_SOURCE_CHANGED"; process.exitCode = 1; }
  save();
  try {
    const stat = fs.lstatSync(sandbox);
    need(stat.dev === identity.dev && stat.ino === identity.ino && !stat.isSymbolicLink() && fs.realpathSync(sandbox) === sandbox
      && fs.realpathSync(tree) === tree && path.dirname(tree) === sandbox, "E7_DOCUMENT_CLEANUP_ESCAPE");
    fs.rmSync(tree, { recursive: true, force: false }); fs.rmdirSync(sandbox); report.sandboxRemoved = true;
  } catch (e) { report.cleanupErrors.push(String(e)); report.status = "FAIL_CLEANUP"; process.exitCode = 1; }
  save(); console.log(`${evidence}/manifest.json (${report.status})`);
}