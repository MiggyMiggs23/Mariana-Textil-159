// Frontend only; compose reviewed task deltas over the frozen safe candidate staging.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const report = path.join(root, "reports/directorios-sitios-20260925");
const parentStage = path.join(report, "staging/frontend-root");
const stage = path.join(report, "staging/frontend-root-simplificados");
const stageFront = path.join(stage, "artifacts/mariana-textil");
const parentFront = path.join(root, "artifacts/mariana-textil/dist-directorios-sitios-20260925/index.html");
const apiEntry = path.join(root, "artifacts/api-server/dist-directorios-sitios-20260925/index.mjs");
const output = path.join(root, "artifacts/mariana-textil/dist-directorios-sitios-20260925-simplificados");
const proof = path.join(report, "front-simplificaciones-provenance.json");
const ready = path.join(report, "candidate-simplificaciones-ready.json");
const approvalPath = path.join(report, "simplificaciones-approval.json");
const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const relative = file => path.relative(root, file);
const must = (condition, description) => { if (!condition) throw Error(description); };
function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  must(!result.error && result.status === 0, `${command} ${args.join(" ")} failed: ${result.error?.message ?? result.status}`);
}

must(approval.status === "frontend-only-approved-proposals-1-2-6-7-8", "Unexpected approval");
must(sha(fs.readFileSync(parentFront)) === approval.parentFrontendIndexSha256, "Parent frontend candidate changed");
must(sha(fs.readFileSync(apiEntry)) === approval.unchangedApiEntrySha256, "API candidate changed");
for (const file of [stage, output, proof, ready]) must(!fs.existsSync(file), `Refusing overwrite: ${file}`);
must(approval.overlays.length === 3, "Unexpected overlay count");
const expected = [
  "artifacts/mariana-textil/src/components/client-directory.tsx",
  "artifacts/mariana-textil/src/pages/clientes.tsx",
  "artifacts/mariana-textil/src/pages/proveedores.tsx",
];
must(JSON.stringify(approval.overlays.map(item => item.path)) === JSON.stringify(expected), "Unapproved frontend path");
const overlayBytes = approval.overlays.map(item => {
  const before = fs.readFileSync(path.join(parentStage, item.path));
  const after = fs.readFileSync(path.join(root, item.path));
  must(sha(before) === item.baseSha256, `Parent staging changed: ${item.path}`);
  must(sha(after) === item.sha256, `Current frontend changed: ${item.path}`);
  const baseline = spawnSync("git", ["show", `HEAD:${item.path}`], { cwd: root });
  must(baseline.status === 0 && sha(baseline.stdout) === item.baseSha256, `HEAD not equal frozen staging: ${item.path}`);
  const diff = spawnSync("git", ["diff", "HEAD", "--", item.path], { cwd: root });
  must(diff.status === 0 && sha(diff.stdout) === item.headDiffSha256, `Task diff changed: ${item.path}`);
  return { item, after };
});

// Copy only the prior isolated source tree; never mutate the prior stage or dist.
fs.cpSync(parentStage, stage, { recursive: true, dereference: false });
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stageFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
for (const { item, after } of overlayBytes) fs.writeFileSync(path.join(stage, item.path), after);
for (const { item } of overlayBytes) must(sha(fs.readFileSync(path.join(stage, item.path))) === item.sha256, "Staged overlay mismatch");

// Force isolated referenced-library checks, then check the composed frontend.
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stageFront, "--noEmit"]);
must(!fs.existsSync(output), "Build output appeared unexpectedly");
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", output], stageFront,
  { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else files.push({ file: relative(file), sha256: sha(fs.readFileSync(file)) });
  }
}
walk(output);
const index = path.join(output, "index.html");
must(fs.existsSync(index), "Missing frontend candidate index");
fs.writeFileSync(proof, JSON.stringify({
  status: "frontend-only-candidate-not-activated",
  parentIndexSha256: approval.parentFrontendIndexSha256,
  approval: relative(approvalPath),
  staging: relative(stage),
  overlays: approval.overlays,
  isolatedTypecheck: "passed",
  output: files.sort((a, b) => a.file.localeCompare(b.file)),
}, null, 2) + "\n");
fs.writeFileSync(ready, JSON.stringify({
  status: "candidate-only-not-activated",
  frontendPath: relative(output),
  frontendIndex: relative(index),
  frontendIndexSha256: sha(fs.readFileSync(index)),
  frontendProvenance: relative(proof),
  frontendApproval: relative(approvalPath),
  apiPath: relative(path.dirname(apiEntry)),
  apiEntry: relative(apiEntry),
  apiEntrySha256: approval.unchangedApiEntrySha256,
  apiProvenance: "reports/directorios-sitios-20260925/api-candidate-provenance.json",
  activationBlockedOn: "Supplier RFC nullable DDL requires separate explicit authorization and deployment before activating API; no DDL was run.",
}, null, 2) + "\n");
console.log(`Prepared frontend-only candidate ${relative(index)}; not activated`);