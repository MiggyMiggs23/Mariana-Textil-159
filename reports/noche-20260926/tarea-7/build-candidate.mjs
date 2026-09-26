// One-off isolated frontend candidate; deliberately does not change runtime config.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../../..");
const report = import.meta.dirname;
const prior = path.join(root, "reports/auditoria-colaborativa");
const original = path.join(prior, "staging/frontend-root-mensaje");
const stage = path.join(report, "staging/frontend-root-inventory");
const frontend = path.join(root, "artifacts/mariana-textil/dist-noche-task7-inventory-20260926");
const parent = JSON.parse(fs.readFileSync(path.join(prior, "mensaje/candidate.json"), "utf8"));
const expected = {
  "artifacts/mariana-textil/src/pages/inventario.tsx": "e3f585760c162f732c273b0a68a67f3badf27927e0b75a43842e97b533a29064",
  "artifacts/mariana-textil/src/lib/inventory-global-totals.ts": "20061268c87ef9865e482b1f45a977ae8be0b4647334fcdc844eba46e012037e",
  "artifacts/mariana-textil/src/lib/inventory-global-totals.test.ts": "525894187018eba9d1793f36a31ef8366c5efba0e5fdbea713144ba585e1a337",
};
const expectedResult = {
  "artifacts/mariana-textil/src/pages/inventario.tsx": "4db08031f8cb37e1568b83f039bf9215b08a83c7b7161c081dde4b7dc3e4fba2",
  "artifacts/mariana-textil/src/lib/inventory-global-totals.ts": "ecd1f9848cc94271ad6c86a19b841b9d2043f5d52b9c632c9c342815ac9ca1c8",
  "artifacts/mariana-textil/src/lib/inventory-global-totals.test.ts": "ecdb8a9bb4f768157179c66ba8da77c15c176955d7f47f6b6d971e4156e261c3",
};
const sha = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const hash = file => sha(fs.readFileSync(file));
const must = (condition, message) => { if (!condition) throw Error(message); };
const save = (name, content) => fs.writeFileSync(path.join(report, name), content);
const verifyParent = () => {
  must(hash(parent.apiEntry) === parent.apiSha256, "Active API parent entry changed");
  for (const [name, checksum] of Object.entries(parent.frontendFiles)) {
    must(hash(path.join(parent.frontendRoot, name)) === checksum, `Active frontend parent changed: ${name}`);
  }
};
function files(dir, prefix = "") {
  const result = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Build outputs, external node_modules and symlinks cannot be source overlays.
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.endsWith(".tsbuildinfo") || entry.isSymbolicLink()) continue;
    const relative = path.join(prefix, entry.name), absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, files(absolute, relative));
    else result[relative] = hash(absolute);
  }
  return result;
}
function assetFiles(dir, prefix = "") {
  const result = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name), absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, assetFiles(absolute, relative));
    else result[relative] = hash(absolute);
  }
  return result;
}
function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  must(!result.error && result.status === 0, `${command} failed: ${result.error?.message ?? result.status}`);
}

for (const dir of [stage, frontend]) must(!fs.existsSync(dir), `Refusing overwrite ${dir}`);
for (const [name, checksum] of Object.entries(expected)) {
  must(hash(path.join(original, name)) === checksum, `Frozen source changed: ${name}`);
  must(hash(path.join(root, name)) === expectedResult[name], `Corrected source changed: ${name}`);
}
verifyParent();
const before = files(original);
fs.cpSync(original, stage, { recursive: true, dereference: false });
const stagedFront = path.join(stage, "artifacts/mariana-textil");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stagedFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
for (const name of Object.keys(expected)) fs.copyFileSync(path.join(root, name), path.join(stage, name));
const after = files(stage);
must(JSON.stringify(Object.keys(before).sort()) === JSON.stringify(Object.keys(after).sort()), "Stage source file inventory changed");
const delta = Object.keys(before).filter(name => before[name] !== after[name]).sort();
must(JSON.stringify(delta) === JSON.stringify(Object.keys(expected).sort()), `Unexpected source changes: ${delta}`);
for (const name of delta) must(after[name] === expectedResult[name], `Stage overlay mismatch: ${name}`);
verifyParent();
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stagedFront, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", frontend],
  stagedFront, { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });
verifyParent();
const frontendFiles = assetFiles(frontend);
const manifest = {
  status: "candidate-only-no-activation",
  lineage: {
    parent: "reports/auditoria-colaborativa/mensaje/candidate.json",
    frozenSource: path.relative(root, original),
    isolatedSource: path.relative(root, stage),
    apiEntry: path.relative(root, parent.apiEntry),
    apiSha256: parent.apiSha256,
    frontendParent: path.relative(root, parent.frontendRoot),
    frontendParentFiles: parent.frontendFiles,
  },
  sourcePreservation: { unchangedFiles: Object.keys(before).length - delta.length, changedFiles: delta.map(name => ({
    path: name, parentSha256: before[name], overlaySha256: after[name],
  })), exactDeltaVerified: true, parentArtifactsVerifiedBeforeAndAfter: true },
  frontendRoot: path.relative(root, frontend),
  frontendFiles,
  isolatedTypecheck: "passed",
  build: "passed",
  activation: "not performed",
  browser: "not run",
  database: "not accessed",
};
save("candidate.json", JSON.stringify(manifest, null, 2) + "\n");
save("frontend.sha256", Object.entries(frontendFiles).map(([name, checksum]) =>
  `${checksum}  ${path.relative(root, path.join(frontend, name))}\n`).join(""));
run("sha256sum", ["--check", path.join(report, "frontend.sha256")]);
console.log(JSON.stringify({ candidate: path.join(report, "candidate.json"), indexSha256: frontendFiles["index.html"], delta }, null, 2));