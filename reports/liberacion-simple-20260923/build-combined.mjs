// Offline-only build: never imports API or opens database/process listeners.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const root = process.cwd(), report = path.join(root, "reports/liberacion-simple-20260923");
const source = path.join(report, "source");
const revision = "cc628aed315a4bbfd3e6cb8766d28200ce400842";
const dist = "dist-simple-e3-tanda-b-20260923";
const api = path.join(root, "artifacts/api-server", dist), ui = path.join(root, "artifacts/mariana-textil", dist);
for (const p of [source, api, ui]) assert(!fs.existsSync(p), `Refuse overwrite ${p}`);
const clean = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8", NODE_ENV: "production", BASE_PATH: "/" };
function run(cmd, args, cwd = root, env = clean) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(r.status, 0, `${path.basename(cmd)} failed: ${r.stderr}`);
  return r.stdout + r.stderr;
}
fs.mkdirSync(source);
const tar = path.join(report, "source.tar");
run("git", ["archive", "--format=tar", `--output=${tar}`, revision, "artifacts/api-server", "artifacts/mariana-textil", "lib", "attached_assets", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json"]);
run("tar", ["-xf", tar, "-C", source]); fs.unlinkSync(tar);
const corrections = ["artifacts/api-server/src/lib/credit-abono-evidence.ts",
  "artifacts/api-server/src/lib/credit-evidence-contract.ts", "artifacts/api-server/src/routes/e3-collections.ts"];
for (const file of corrections) {
  assert.equal(fs.readFileSync(path.join(source, file), "utf8"),
    fs.readFileSync(path.join(root, "reports/e3-apertura-preparada-20260922/source", file), "utf8"),
    `E3 corrected source differs: STOP ${file}`);
}
const gates = [
  ["artifacts/api-server/src/lib/e3-ordinary-cash-release.ts", "export const E3_ORDINARY_CASH_ENABLED = false;"],
  ["artifacts/api-server/src/lib/e3-collection.ts", "export const E3_ENABLED = false;"],
  ["artifacts/api-server/src/lib/permisos.ts", "const E3_MATRIX_RELEASED: boolean = false;"],
  ["artifacts/mariana-textil/src/lib/e3-feature-flags.ts", "export const E3_ENABLED = false;"],
];
for (const [file, off] of gates) {
  const target = path.join(source, file), text = fs.readFileSync(target, "utf8");
  assert.equal(text.split(off).length, 2);
  fs.writeFileSync(target, text.replace(off, off.replace("false", "true")));
}
// Dependencies retain a physical staged @workspace resolution, never live library code.
for (const rel of ["", "artifacts/api-server", "artifacts/mariana-textil", ...fs.readdirSync(path.join(source, "lib")).map(n => `lib/${n}`)]) {
  const original = path.join(root, rel, "node_modules"), dest = path.join(source, rel, "node_modules");
  if (!fs.existsSync(original)) continue;
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(original)) {
    if (item === "@workspace") {
      fs.mkdirSync(path.join(dest, item));
      for (const name of fs.readdirSync(path.join(original, item))) {
        const relative = path.relative(root, fs.realpathSync(path.join(original, item, name)));
        assert(/^(lib|artifacts)\//.test(relative));
        fs.symlinkSync(path.join(source, relative), path.join(dest, item, name));
      }
    } else fs.symlinkSync(fs.realpathSync(path.join(original, item)), path.join(dest, item));
  }
}
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name)] : []);
const inventory = [];
for (const dir of ["artifacts/api-server/src/lib", "artifacts/mariana-textil/src/lib"]) {
  for (const file of walk(path.join(source, dir)).filter(f => f.endsWith(".ts") && !f.includes(".test."))) {
    for (const m of fs.readFileSync(file, "utf8").matchAll(/(?:export )?const ((?:E(?:3|4|5|7|9|11|12)\w*|REMATE\w*|FONDO\w*|CREDIT\w*)_(?:ENABLED|RELEASED))(?::\s*boolean)?\s*=\s*(true|false)/g)) {
      const allowed = ["E3_ENABLED", "E3_ORDINARY_CASH_ENABLED", "E3_MATRIX_RELEASED"].includes(m[1]);
      assert.equal(m[2], allowed ? "true" : "false", `Unexpected gate ${m[1]}`);
      inventory.push({ file: path.relative(source, file), name: m[1], value: m[2] });
    }
  }
}
fs.writeFileSync(path.join(report, "combined-source-review.json"), JSON.stringify({
  revision, status: "OFFLINE_SOURCE_REVIEW", preservedE3Corrections: corrections, changes: gates.map(([file]) => file), gates: inventory
}, null, 2), { flag: "wx" });
fs.writeFileSync(path.join(report, "build-api.log"), run(process.execPath, ["build.mjs"], path.join(source, "artifacts/api-server"), { ...clean, API_BUILD_OUTPUT_DIR: api }), { flag: "wx" });
fs.writeFileSync(path.join(report, "build-ui.log"), run(path.join(root, "artifacts/mariana-textil/node_modules/.bin/vite"), ["build", "--outDir", ui], path.join(source, "artifacts/mariana-textil")), { flag: "wx" });
fs.writeFileSync(path.join(report, "combined-build.json"), JSON.stringify({
  status: "BUILT_OFFLINE_NOT_STARTED_NOT_RELEASED", revision, api, ui, previousBundlesModified: false
}, null, 2), { flag: "wx" });