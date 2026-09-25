// Focused runner for src/components/e7-node.dom.test.tsx.
// It fixes the ".png" loader error you get from the plain tsx runner by using
// the existing E7/E11 bundle configuration: reports/e11/frontend-node-build.mjs,
// which has the dataurl loaders, the offline transport boundary and the DB-import
// veto. It also loads the existing offline guard and jsdom preload from
// reports/tanda-b-20260922/e12. It reads the live source tree, does not copy or
// mutate it, and writes only to a temp dir. It runs no mutants.
// Usage (from the workspace root): node artifacts/mariana-textil/reports/screen-placement/run-e7-dom.mjs <e7|e11|e11-placement> [name-pattern]
// The E11 suite uses the same aliases as reports/e11/run-frontend-node-mutants.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = process.cwd(), app = path.join(root, "artifacts/mariana-textil");
const infra = path.join(root, "reports/tanda-b-20260922/e12");
const require = createRequire(path.join(app, "package.json"));
const compiler = createRequire(require.resolve("vite/package.json")).resolve("esbuild");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e7-dom-focused-"));
const arg = process.argv[2], suite = arg === "e11" || arg === "e11-placement" ? "e11" : "e7";
const transport = path.join(app, `src/components/${suite}-node-test-transport.ts`);
const aliases = { "@": path.join(app, "src") };
for (const dir of fs.readdirSync(path.join(root, "lib"))) {
  const file = path.join(root, "lib", dir, "package.json");
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8")), exp = pkg.exports?.["."];
  const entry = typeof exp === "string" ? exp : exp?.import ?? exp?.default;
  if (typeof entry === "string") aliases[pkg.name] = path.resolve(path.dirname(file), entry);
}
for (const f of suite === "e7" ? ["e7", "e11", "e5"] : ["e11", "e5"]) aliases[`@/lib/${f}-feature-flags`] = transport;
const plan = { test: path.join(app, arg === "e11-placement" ? "src/components/e11-admin-nav-placement.dom.test.tsx" : `src/components/${suite}-node.dom.test.tsx`), output: path.join(tmp, "e7.test.cjs"), metafile: path.join(tmp, "inputs.json"), aliases, transport };
fs.writeFileSync(path.join(tmp, "plan.json"), JSON.stringify(plan));
const env = { PATH: path.dirname(process.execPath), HOME: tmp, TMPDIR: tmp, NODE_ENV: "test", LANG: "C.UTF-8", TZ: "UTC", CI: "1", NO_COLOR: "1",
  E4_SANDBOX: root, E4_LIVE_ROOT: root, E4_ESBUILD_MODULE: compiler, NODE_PATH: path.join(app, "node_modules") };
const b = spawnSync(process.execPath, [path.join(root, "reports/e11/frontend-node-build.mjs"), path.join(tmp, "plan.json")], { cwd: app, env, stdio: "inherit" });
if (b.status !== 0) process.exit(b.status ?? 1);
// The offline guard only admits loads from its sandbox (plus live node_modules),
// so the preloads run from copies next to the bundle.
for (const h of ["frontend-offline-guard.cjs", "frontend-node-dom.cjs"]) fs.copyFileSync(path.join(infra, h), path.join(tmp, h));
const pattern = process.argv[3];
const r = spawnSync(process.execPath, ["--require", path.join(tmp, "frontend-node-dom.cjs"), "--test", "--test-isolation=none",
  ...(pattern ? ["--test-name-pattern", pattern] : []), plan.output],
  { cwd: tmp, env: { ...env, E4_SANDBOX: tmp, NODE_OPTIONS: `--require=${path.join(tmp, "frontend-offline-guard.cjs")}` }, stdio: "inherit" });
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(r.status ?? 1);
