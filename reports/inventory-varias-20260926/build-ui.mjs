import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const report = path.join(root, "reports/inventory-varias-20260926");
const prior = path.join(root, "reports/floor-level-and-letter-20260926/combined-frozen-root");
const frozen = path.join(report, "frozen-root");
const app = "artifacts/mariana-textil";
const helper = `${app}/src/lib/inventory-locations.tsx`;
const out = path.join(root, app, "dist-inventory-varias-20260926");
const active = path.join(root, app, "dist-floor-level-letter-20260926");
const read = p => fs.readFileSync(p, "utf8");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const write = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, value);
};
const json = (p, value) => write(p, JSON.stringify(value, null, 2) + "\n");
function inventory(dir, skip = []) {
  const result = {};
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (skip.includes(ent.name) || ent.name.endsWith(".tsbuildinfo")) continue;
      const file = path.join(d, ent.name);
      if (ent.isDirectory()) walk(file);
      else if (ent.isFile()) result[path.relative(dir, file)] = sha(fs.readFileSync(file));
      else if (ent.isSymbolicLink()) result[path.relative(dir, file)] = { link: fs.readlinkSync(file) };
    }
  }
  walk(dir);
  return result;
}

const finalizeOnly = process.argv.includes("--finalize-only");
const retained = finalizeOnly ? JSON.parse(read(path.join(report, "input-hashguards.json"))) : null;
const priorGuard = retained?.priorGuard ?? inventory(prior, ["node_modules", "reports"]);
const activeGuard = retained?.activeGuard ?? inventory(active);
const helperTest = `${app}/src/lib/inventory-locations.test.tsx`;
const totalsTest = `${app}/src/lib/inventory-global-totals.test.ts`;
let deltas, build, tests;
if (!finalizeOnly) {
assert.ok(!fs.existsSync(out), "Refusing to overwrite a candidate dist");
assert.ok(!fs.existsSync(frozen), "Refusing to overwrite frozen inputs");
const expectedActive = JSON.parse(read(path.join(root, "reports/floor-level-and-letter-20260926/combined-build-manifest.json"))).frontendFiles;
assert.deepEqual(activeGuard, expectedActive, "Active UI bytes differ from the retained prior manifest");
const before = read(path.join(prior, helper));
const after = read(path.join(root, helper));
const expected = before
  .replace("consolidado: boolean, compact = false)", "consolidado: boolean, _compact = false)")
  .replace('if (compact && unique.length > 1) return `${unique.length} pisos`;', 'if (unique.length > 1) return "Varias";');
assert.notEqual(before, expected);
assert.equal(after, expected, "Only the reviewed locationSummary change is allowed");
write(path.join(report, "overlay", helper), after);
json(path.join(report, "input-hashguards.json"), { prior: path.relative(root, prior), priorGuard, activeGuard });

// Copy only the UI, not the API or the shared-library tree. Unmodified library
// packages and third-party dependency links keep their exact prior frozen targets.
fs.mkdirSync(path.join(frozen, "artifacts"), { recursive: true });
fs.cpSync(path.join(prior, app), path.join(frozen, app), {
  recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE,
  filter: p => !p.endsWith(".tsbuildinfo") && ![".vite", ".vite-temp"].includes(path.basename(p)),
});
for (const name of ["lib", "node_modules", "attached_assets", "tsconfig.base.json"]) {
  fs.symlinkSync(path.join(prior, name), path.join(frozen, name));
}
write(path.join(frozen, helper), after);
const beforeUI = inventory(path.join(prior, app), ["node_modules"]);
const afterUI = inventory(path.join(frozen, app), ["node_modules"]);
assert.deepEqual(Object.keys(afterUI), Object.keys(beforeUI));
deltas = Object.keys(beforeUI).filter(file => beforeUI[file] !== afterUI[file]).map(file => ({
  file: `${app}/${file}`, beforeSha256: beforeUI[file], afterSha256: afterUI[file],
}));
assert.deepEqual(deltas.map(item => item.file), [helper]);
json(path.join(report, "source-delta-proof.json"), {
  baseline: path.relative(root, prior), candidate: path.relative(root, frozen),
  deltas, unchangedUIFiles: Object.keys(beforeUI).length - 1,
  sharedLibraries: "Exact prior frozen tree reused through symlinks; no working-tree library inputs.",
  beforeUI, afterUI,
});
const diff = spawnSync("diff", ["-u", "--label", `prior/${helper}`, "--label", `candidate/${helper}`, path.join(prior, helper), path.join(frozen, helper)], { encoding: "utf8" });
assert.equal(diff.status, 1);
write(path.join(report, "source-delta.patch"), diff.stdout);

build = spawnSync(path.join(frozen, app, "node_modules/.bin/vite"), [
  "build", "--config", path.join(frozen, app, "vite.config.ts"), "--outDir", out,
], {
  cwd: path.join(frozen, app), encoding: "utf8",
  env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/" }, maxBuffer: 30e6,
});
write(path.join(report, "ui-build.log"), `${build.stdout ?? ""}${build.stderr ?? ""}${build.error?.message ?? ""}`);
assert.equal(build.status, 0, "UI build failed; see ui-build.log");
assert.deepEqual(inventory(path.join(frozen, app), ["node_modules"]), afterUI, "Build changed source inputs");

// Add only the updated helper test after the production build. The totals test
// and implementation remain the exact prior frozen versions.
assert.equal(read(path.join(root, totalsTest)), read(path.join(frozen, totalsTest)));
assert.ok(!fs.existsSync(path.join(frozen, helperTest)), "Unexpected baseline helper test");
write(path.join(frozen, helperTest), read(path.join(root, helperTest)));
tests = spawnSync(process.execPath, [
  path.join(root, "scripts/src/frontend-test-runner.mjs"),
  "--app-root", path.join(frozen, app),
  "src/lib/inventory-locations.test.tsx", "src/lib/inventory-global-totals.test.ts",
], { cwd: root, encoding: "utf8", maxBuffer: 10e6 });
write(path.join(report, "focused-tests.log"), `${tests.stdout ?? ""}${tests.stderr ?? ""}${tests.error?.message ?? ""}`);
assert.equal(tests.status, 0, "Focused tests failed; see focused-tests.log");
} else {
  // Resume evidence sealing only; never rerun the build or the focused tests.
  const proof = JSON.parse(read(path.join(report, "source-delta-proof.json")));
  deltas = proof.deltas;
  const current = inventory(path.join(frozen, app), ["node_modules"]);
  delete current[path.relative(app, helperTest)];
  assert.deepEqual(current, proof.afterUI, "Candidate source drift before sealing");
  assert.match(read(path.join(report, "ui-build.log")), /built in /);
  build = { status: 0 };
  tests = { status: 0, stdout: read(path.join(report, "focused-tests.log")) };
}
assert.match(tests.stdout, /(?:#|ℹ) tests 8\b/);
assert.match(tests.stdout, /(?:#|ℹ) pass 8\b/);
assert.match(tests.stdout, /(?:#|ℹ) fail 0\b/);
assert.deepEqual(inventory(prior, ["node_modules", "reports"]), priorGuard, "Prior frozen source changed");
assert.deepEqual(inventory(active), activeGuard, "Active dist changed");
const frontendFiles = inventory(out);
write(path.join(report, "frontend.sha256"), Object.entries(frontendFiles).map(([file, hash]) =>
  `${hash}  ${path.relative(root, path.join(out, file))}\n`).join(""));
const manifest = {
  status: "BUILT_NOT_ACTIVATED", out: path.relative(root, out),
  frozen: path.relative(root, frozen), prior: path.relative(root, prior),
  frontendFiles, sourceDeltas: deltas,
  tests: { runs: 1, files: 2, tests: 8, passed: 8, failed: 0, status: tests.status,
    helperTestSha256: sha(read(path.join(frozen, helperTest))),
    helperTestAddedAfterBuild: true, totalsTestSha256: sha(read(path.join(frozen, totalsTest))) },
  buildStatus: build.status, priorSourceUnchanged: true, activeDistUnchanged: true,
  apiEdits: false, apiRebuild: false, databaseAccess: false, workflowChanges: false,
  runtimeChanges: false, visualVerification: "Not performed; parent agent owns runtime verification.",
  evidenceSealingResumed: finalizeOnly,
  recipeSha256: sha(read(path.join(report, "build-ui.mjs"))),
  sourceDeltaProofSha256: sha(read(path.join(report, "source-delta-proof.json"))),
  inputHashguardsSha256: sha(read(path.join(report, "input-hashguards.json"))),
};
json(path.join(report, "build-manifest.json"), manifest);
console.log(JSON.stringify(manifest, null, 2));