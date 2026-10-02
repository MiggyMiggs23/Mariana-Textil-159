// MAIN ONLY, after isolated/browser PASS. Exact copies; never builds or starts.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const root = process.cwd(), report = path.resolve("reports/receipt-terminal-print-20261001");
assert.equal(process.argv[2], "--main-authorized-after-pass");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const ready = JSON.parse(fs.readFileSync(path.join(report, "candidate-ready.json")));
const manifestPath = path.join(root, ready.candidate, "build-manifest.json");
assert.equal(sha(fs.readFileSync(manifestPath)), ready.manifestSha256);
const manifest = JSON.parse(fs.readFileSync(manifestPath));
assert.equal(manifest.status, "BUILT_NOT_ACTIVATED");
const result = {};
for (const [kind, pkg, source] of [["api", "api-server", "api"], ["web", "mariana-textil", "frontend"]]) {
  const src = path.resolve(ready[source]), dest = path.resolve("artifacts", pkg, "dist-receipt-terminal-print-20261001");
  assert(!fs.existsSync(dest), "Never overwrite staged release");
  const entries = Object.entries(manifest[kind]);
  // Verify all source bytes BEFORE creating the release directory.
  for (const [file, hash] of entries) {
    assert.equal(typeof hash, "string", "Unexpected candidate symlink in byte inventory");
    assert(!file.startsWith("/") && !file.split("/").includes(".."));
    assert.equal(sha(fs.readFileSync(path.join(src, file))), hash, `candidate drift: ${file}`);
  }
  for (const [file, hash] of entries) {
    const target = path.join(dest, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(src, file), target);
    assert.equal(sha(fs.readFileSync(target)), hash);
  }
  if (kind === "api") {
    // Frozen JS stays byte-identical; only external package resolution uses installed dependencies.
    const modules = path.resolve("artifacts/api-server/node_modules");
    assert(fs.statSync(modules).isDirectory());
    fs.symlinkSync(modules, path.join(dest, "node_modules"));
    const require = createRequire(path.join(dest, "index.mjs"));
    const js = fs.readFileSync(path.join(dest, "index.mjs"), "utf8");
    const imports = [...js.matchAll(/^import\s+(?:[^;\n]*?\s+from\s+)?["']([^"'./][^"']*)["']/gm)].map(m => m[1]);
    for (const specifier of new Set(imports)) require.resolve(specifier);
    result.externalResolution = { nodeModules: modules, imports: [...new Set(imports)].sort() };
  }
  const guard = entries.map(([file, hash]) => `${hash}  ${path.relative(root, path.join(dest, file))}\n`).join("");
  fs.writeFileSync(path.join(report, `release-${kind}.sha256`), guard);
  result[kind] = { source: src, destination: dest, files: entries.length, exactCandidateBytes: true, guardSha256: sha(guard) };
}
fs.writeFileSync(path.join(report, "release-staging.json"), JSON.stringify({
  status: "STAGED_NOT_ACTIVATED", manifestSha256: ready.manifestSha256, ...result,
  noBuild: true, noDatabaseAccess: true, noWorkflowChanges: true,
}, null, 2) + "\n");
console.log("STAGED_NOT_ACTIVATED: exact candidate bytes and runtime dependency resolution verified.");