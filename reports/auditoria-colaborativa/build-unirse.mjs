// Explicit-join frontend revision only. No services or database access.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const report = import.meta.dirname;
const read = file => fs.readFileSync(file, "utf8");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const must = (value, message) => { if (!value) throw Error(message); };
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const old = JSON.parse(read(path.join(report, "browser-live/candidate.json")));
const previousProof = JSON.parse(read(path.join(report, "provenance.json")));
const parentStage = path.join(root, previousProof.stage);
const stage = path.join(report, "staging/frontend-root-unirse");
const front = path.join(root, "artifacts/mariana-textil/dist-auditoria-colaborativa-unirse-20260925");
const final = path.join(report, "unirse");
for (const file of [stage, front, final]) must(!fs.existsSync(file), `Refusing overwrite ${file}`);
function manifest(dir) {
  const result = {};
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else result[path.relative(dir, file)] = sha(fs.readFileSync(file));
    }
  }
  walk(dir);
  return result;
}
function assertManifest(dir, expected) {
  must(JSON.stringify(manifest(dir)) === JSON.stringify(expected), `Manifest mismatch ${dir}`);
}
const api = path.dirname(old.apiEntry);
const oldApiFiles = JSON.parse(read(path.join(report, "api-sha256.json")));
assertManifest(api, oldApiFiles);
assertManifest(old.frontendRoot, old.frontendFiles);
must(sha(fs.readFileSync(old.apiEntry)) === old.apiSha256, "API entry changed");
for (const item of previousProof.overlays.filter(item => !item.path.startsWith("artifacts/api-server/"))) {
  must(sha(fs.readFileSync(path.join(parentStage, item.path))) === item.sha256, `Prior staged overlay changed ${item.path}`);
}
fs.cpSync(parentStage, stage, { recursive: true, dereference: false });
const stageFront = path.join(stage, "artifacts/mariana-textil");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stageFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link);
  fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
const files = [
  "artifacts/mariana-textil/src/pages/auditorias-inventario.tsx",
  "artifacts/mariana-textil/src/components/auditoria/audit-collaboration.tsx",
  "artifacts/mariana-textil/src/components/auditoria/use-audit-participation.ts",
];
const overlays = [];
for (const file of files) {
  const target = path.join(stage, file);
  const before = read(target);
  const value = read(path.join(root, file));
  save(target, value);
  save(path.join(final, "overlays", file), value);
  overlays.push({ path: file, parentSha256: sha(before), sha256: sha(value), composition: "Explicit participation join UI task-only revision" });
  const diff = spawnSync("diff", ["-u", path.join(parentStage, file), target], { encoding: "utf8" });
  must(diff.status === 0 || diff.status === 1, `Diff failed ${file}`);
  save(path.join(final, "diff", file + ".diff"), diff.stdout);
}
// Check all retained source/config/assets, excluding only compiler outputs.
const changes = [];
function verifyRetained(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.endsWith(".tsbuildinfo")) continue;
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { verifyRetained(file); continue; }
    const relative = path.relative(parentStage, file);
    const target = path.join(stage, relative);
    must(fs.existsSync(target), `Removed retained file ${relative}`);
    if (sha(fs.readFileSync(file)) !== sha(fs.readFileSync(target))) changes.push(relative);
  }
}
verifyRetained(parentStage);
must(changes.every(file => files.includes(file)), "Unapproved staged changes");
function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  must(!result.error && result.status === 0, `${command} failed ${result.error?.message ?? result.status}`);
}
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stageFront, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", front], stageFront, { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });
assertManifest(api, oldApiFiles);
assertManifest(old.frontendRoot, old.frontendFiles);
const frontendFiles = manifest(front);
const candidate = { apiEntry: old.apiEntry, apiSha256: old.apiSha256, frontendRoot: front, frontendFiles };
const shaLines = (dir, entries) => Object.entries(entries).map(([file, hash]) => `${hash}  ${path.relative(root, path.join(dir, file))}\n`).join("");
save(path.join(final, "api.sha256"), shaLines(api, oldApiFiles));
save(path.join(final, "frontend.sha256"), shaLines(front, frontendFiles));
save(path.join(final, "all.sha256"), shaLines(api, oldApiFiles) + shaLines(front, frontendFiles));
save(path.join(final, "frontend-sha256.json"), JSON.stringify(frontendFiles, null, 2) + "\n");
save(path.join(final, "parent-candidate.json"), JSON.stringify(old, null, 2) + "\n");
save(path.join(final, "provenance.json"), JSON.stringify({
  status: "candidate-only-not-activated",
  parentProvenance: "reports/auditoria-colaborativa/provenance.json",
  parentStage: previousProof.stage,
  stage: path.relative(root, stage),
  apiEntry: old.apiEntry, apiSha256: old.apiSha256, apiUnchanged: true,
  previousFrontendUnchanged: true, frontendRoot: front,
  overlays, retainedSourceChanges: changes, generatedSourcesUnchanged: true,
  isolatedFrontendTypecheck: "passed", productionBuild: "passed",
  databaseAccess: "none", ddl: "none", servicesStarted: "none", activation: "not-performed",
}, null, 2) + "\n");
save(path.join(final, "candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
save(path.join(report, "browser-live/candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
run("sha256sum", ["--check", path.join(final, "all.sha256")]);
console.log(JSON.stringify({ apiEntry: candidate.apiEntry, apiSha256: candidate.apiSha256, frontendRoot: front, frontendIndexSha256: frontendFiles["index.html"], frontendFiles: Object.keys(frontendFiles).length, manifest: path.relative(root, path.join(final, "all.sha256")) }, null, 2));