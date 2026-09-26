import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../../..");
const report = import.meta.dirname;
const parent = path.join(root, "reports/noche-20260926/tarea-7/staging/frontend-root-inventory");
const stage = path.join(report, "frozen-root");
const front = path.join(stage, "artifacts/mariana-textil");
const output = path.join(root, "artifacts/mariana-textil/dist-priority-clientlist-parallel-20260926");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const files = (dir, prefix = "", assets = false) => Object.fromEntries(fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.isSymbolicLink() || (!assets && (["node_modules", "dist"].includes(entry.name) || entry.name.endsWith(".tsbuildinfo")))) return [];
  const name = path.join(prefix, entry.name), full = path.join(dir, entry.name);
  return entry.isDirectory() ? Object.entries(files(full, name, assets)) : [[name, hash(full)]];
}));
const expected = [
  "artifacts/mariana-textil/src/components/client-directory.tsx",
  "artifacts/mariana-textil/src/lib/client-directory-auth.ts",
  "artifacts/mariana-textil/src/pages/clientes.tsx",
].sort();
const before = files(parent), after = files(stage);
const delta = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key] !== after[key]).sort();
assert.deepEqual(delta, expected, "Only directory-related source changes allowed; PIEZA and credit untouched");
assert.ok(!fs.existsSync(output), "Refuse overwriting any prior build");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(front, "node_modules/@workspace", lib);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/" }, stdio: "inherit" });
  assert.equal(result.status, 0, `${command} failed`);
}
run("pnpm", ["exec", "tsc", "-p", front, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", output], front);
assert.deepEqual(files(parent), before, "Frozen parent changed");
const candidate = JSON.parse(fs.readFileSync(path.join(root, "reports/priority-perf-20260926/candidate.json")));
const manifest = {
  ...candidate,
  frontendRoot: output,
  frontendFiles: files(output, "", true),
  status: "candidate-built-not-activated",
  sourcePreservation: {
    frozenSource: parent, source: stage, unchangedFiles: Object.keys(before).length - 2,
    exactAllowedDelta: delta.map(name => ({ name, before: before[name] ?? null, after: after[name] })),
    piezaAndCreditUnchanged: true,
  },
  verification: { typecheck: "passed", build: "passed", livePerformance: "pending MAIN launch and exclusive window" },
};
fs.writeFileSync(path.join(report, "candidate.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ candidate: path.join(report, "candidate.json"), frontendRoot: output, indexSha256: manifest.frontendFiles["index.html"] }));