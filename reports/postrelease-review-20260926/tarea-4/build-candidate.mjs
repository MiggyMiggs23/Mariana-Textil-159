import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const report = import.meta.dirname;
const combined = process.env.FINAL_COMBINED === "1";
const prefix = combined ? "final-" : "";
const root = path.resolve(report, "../../..");
const parent = path.join(root, "reports/priority-20260926/credit-presentation/frozen-root");
const stage = path.join(report, `${prefix}frozen-root`);
const front = path.join(stage, "artifacts/mariana-textil");
const output = path.join(root, combined ? "artifacts/mariana-textil/dist-postreview-final-20260926" : "artifacts/mariana-textil/dist-postreview-conciliacion");
const target = "artifacts/mariana-textil/src/pages/conciliacion.tsx";
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inventory = (dir, prefix = "", assets = false) => Object.fromEntries(fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
  if (entry.isSymbolicLink() || (!assets && (["node_modules", "dist"].includes(entry.name) || entry.name.endsWith(".tsbuildinfo")))) return [];
  const key = path.join(prefix, entry.name), full = path.join(dir, entry.name);
  return entry.isDirectory() ? Object.entries(inventory(full, key, assets)) : [[key, hash(full)]];
}));
const parentIndex = "af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5";
assert.equal(hash(path.join(root, "artifacts/mariana-textil/dist-priority-credit-presentation-20260926/index.html")), parentIndex);
assert.equal(hash(path.join(parent, target)), "a3e335cdfd3dfdda319583ffae1a80bb8b8412b78f4c631159f231d876c5fe31");
assert.ok(!fs.existsSync(stage) && !fs.existsSync(output), "Never replace a previous source stage or candidate");
const before = inventory(parent);
fs.cpSync(parent, stage, { recursive: true, verbatimSymlinks: true });
// The sole overlay is pinned to released source text, never copied from HEAD.
let source = fs.readFileSync(path.join(stage, target), "utf8");
source = source.replace(
  "const { data: conciliaciones, isLoading } = useGetConciliacion({",
  "const { data: conciliaciones, isLoading, isError, refetch } = useGetConciliacion({",
).replace("        ) : discrepancias.length === 0 ? (", `        ) : isError ? (
          <Card className="border-destructive/50" role="alert">
            <CardContent className="py-16 text-center space-y-4">
              <h2 className="text-2xl font-bold text-destructive">
                No se pudo consultar la conciliación
              </h2>
              <p className="text-muted-foreground">
                No se ha podido verificar si las existencias coinciden con el kardex. Intenta consultar de nuevo.
              </p>
              <Button variant="outline" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : discrepancias.length === 0 ? (`);
fs.writeFileSync(path.join(stage, target), source);
assert.equal(hash(path.join(stage, target)), "dbea832020088b2e6ef3eaacfdf5387ad5a609e407516ac9fcb7c3f23324797f");
const expected = [target];
if (combined) {
  const permission = path.join(root, "reports/postrelease-review-20260926/tarea-3/permission-overlay", target);
  assert.equal(hash(permission), "2112cba3eae6965a14a82ca3b5a0a70a1d4e6c6ff73155810328ad1098a72448");
  fs.copyFileSync(permission, path.join(stage, target));
  const css = "artifacts/mariana-textil/src/index.css";
  const printRoot = path.join(root, "reports/owner-night-20260926/task1-print-fix/frozen-root");
  assert.equal(hash(path.join(root, "artifacts/mariana-textil/dist-owner-task1-print-fix-v2-20260926/index.html")), "a296de5707e38b9996293f48f968fca1e480810931b5769286bebe9b75f83f6f");
  assert.equal(hash(path.join(parent, css)), "7cb86bd37b571f0c103513379dbd2bd210f52bc401388a84eaae2e6fd1b756e8");
  assert.equal(hash(path.join(printRoot, css)), "0b0269d8cbf9f843d21c114803ba0356411af74aad1de79a1dc83f346e875357");
  fs.copyFileSync(path.join(printRoot, css), path.join(stage, css));
  const salida = "artifacts/mariana-textil/src/pages/salida-nueva.tsx";
  assert.equal(hash(path.join(parent, salida)), "7ac0d0842f8e021b4341a9190e0f4369d3e2e6fb3425731416ab2d116ad7c57f");
  let text = fs.readFileSync(path.join(parent, salida), "utf8");
  text = text.replace('import { useLocation, Link } from "wouter";', 'import { useLocation, useSearch, Link } from "wouter";')
    .replace('  if (new URLSearchParams(window.location.search).get("modalidad")', '  const search = useSearch();\n  if (new URLSearchParams(search).get("modalidad")')
    .replace('  const [, setLocation] = useLocation();', '  return <SalidaTransferenciaNueva />;\n}\n\nfunction SalidaTransferenciaNueva() {\n  const [, setLocation] = useLocation();');
  fs.writeFileSync(path.join(stage, salida), text);
  assert.equal(hash(path.join(stage, salida)), "bebaec1f535d9e255f364aa9be934153337fb99bdb9845477d4b7abde7c9822d");
  expected.push(css, salida);
}
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(front, "node_modules/@workspace", lib);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
const after = inventory(stage);
const delta = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key] !== after[key]);
assert.deepEqual(delta.sort(), expected.sort(), "Exactly authorized source deltas from released credit frontend");
fs.writeFileSync(path.join(report, `${prefix}source-inventory.json`), JSON.stringify({ parent: before, candidate: after }, null, 2) + "\n");
function run(command, args, cwd = root, env = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/", ...env }, encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed`);
}
run("node", ["--test", path.join(report, "conciliacion.test.mjs")], root, { REVIEW_SOURCE: path.join(stage, target), NODE_ENV: "test" });
run("node", ["--test", path.join(report, "conciliacion.mounted.test.mjs")], root, { REVIEW_SOURCE: path.join(stage, target), NODE_ENV: "test" });
if (combined) {
  run("node", ["--test", path.join(report, "../tarea-3/permission-mounted.test.mjs")], root, { REVIEW_SOURCE: path.join(stage, target), NODE_ENV: "test" });
  run("node", [path.join(report, "salida-hooks.mounted.mjs")], root, { REVIEW_SOURCE: path.join(stage, "artifacts/mariana-textil/src/pages/salida-nueva.tsx"), NODE_ENV: "test" });
}
run("pnpm", ["exec", "tsc", "-p", front, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", output], front);
assert.deepEqual(inventory(parent), before, "Frozen parent unchanged");
assert.deepEqual(inventory(stage), after, "Build did not modify candidate source");
const manifest = {
  kind: combined ? "frontend-only-print-permission-conciliacion-salida-lifecycle" : "frontend-only-conciliacion-overlay",
  status: "candidate-built-not-activated",
  parentCandidate: "reports/priority-20260926/credit-presentation/candidate.json",
  parentIndexSha256: parentIndex,
  frontendRoot: output,
  frontendFiles: inventory(output, "", true),
  sourceInventorySha256: hash(path.join(report, `${prefix}source-inventory.json`)),
  sourcePreservation: { frozenSource: parent, source: stage, unchangedFiles: Object.keys(before).length - expected.length, exactAllowedDelta: delta.map(name => ({ name, before: before[name], after: after[name] })), parentUnchanged: true },
  verification: { componentTests: "4/4", mountedQueryTests: "passed", permissionMountedTests: combined ? "passed" : "not included", salidaLifecycle: combined ? "real wouter Route: 1,0,1,0 timers; unmount=0" : "not included", printCss: combined ? "exact preserved task1 a296 source hash; new browser print not run" : "not included", typecheck: "passed", build: "passed", browser: "not run", database: "not accessed" },
  backend: "Retain API dist-owner-login-v9-20260926 unchanged; MAIN owns integration and activation",
};
fs.writeFileSync(path.join(report, `${prefix}candidate.json`), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ output, indexSha256: manifest.frontendFiles["index.html"], changedSources: delta }));