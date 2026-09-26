// Frontend-only neutral scan toast correction; no activation or runtime work.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../.."), report = import.meta.dirname;
const read = file => fs.readFileSync(file, "utf8");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const must = (condition, message) => { if (!condition) throw Error(message); };
const save = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
const parent = JSON.parse(read(path.join(report, "final/candidate.json")));
const oldStage = path.join(report, "staging/frontend-root-final");
const stage = path.join(report, "staging/frontend-root-mensaje");
const front = path.join(root, "artifacts/mariana-textil/dist-auditoria-colaborativa-mensaje-20260925");
const proof = path.join(report, "mensaje");
for (const target of [stage, front, proof]) must(!fs.existsSync(target), `Refusing overwrite ${target}`);
const apiFiles = JSON.parse(read(path.join(report, "final/api-sha256.json")));
const verify = (dir, files) => { for (const [file, hash] of Object.entries(files)) must(sha(fs.readFileSync(path.join(dir, file))) === hash, `Parent artifact changed ${file}`); };
verify(path.dirname(parent.apiEntry), apiFiles); verify(parent.frontendRoot, parent.frontendFiles);
const file = "artifacts/mariana-textil/src/pages/auditorias-inventario.tsx";
const before = read(path.join(oldStage, file)), value = read(path.join(root, file));
must(before === read(path.join(report, "final/overlays", file)), "Prior audit page changed");
const oldLine = before.split("\n").filter(line => line.includes("description: `${result.serie}"))[0];
const newLine = value.split("\n").filter(line => line.includes("description: `${result.serie}"))[0];
must(oldLine && newLine && before.split(oldLine).length === 2, "Toast line ambiguous");
must(oldLine.trim().replace("${result.clasificacion}", "Registrado") === newLine.trim(), "Unexpected toast change");
must(before.replace(oldLine, newLine) === value, "Change exceeds the single toast description");
fs.cpSync(oldStage, stage, { recursive: true, dereference: false });
const stageFront = path.join(stage, "artifacts/mariana-textil");
for (const lib of ["api-client-react", "api-zod", "metered-pricing", "number-format", "scanned-code"]) {
  const link = path.join(stageFront, "node_modules/@workspace", lib);
  fs.unlinkSync(link); fs.symlinkSync(path.join(stage, "lib", lib), link, "dir");
}
save(path.join(stage, file), value);
save(path.join(proof, "before", file), before); save(path.join(proof, "overlays", file), value);
const diff = spawnSync("diff", ["-u", path.join(proof, "before", file), path.join(proof, "overlays", file)], { encoding: "utf8" });
must(diff.status === 1, "Expected one-line diff");
save(path.join(proof, "audit-page.diff"), diff.stdout);
const changed = [];
function compare(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  if (entry.name === "node_modules" || entry.name === "dist" || entry.name.endsWith(".tsbuildinfo") || entry.isSymbolicLink()) continue;
  const source = path.join(dir, entry.name);
  if (entry.isDirectory()) { compare(source); continue; }
  const relative = path.relative(oldStage, source), target = path.join(stage, relative);
  must(fs.existsSync(target), `Removed retained file ${relative}`);
  if (sha(fs.readFileSync(source)) !== sha(fs.readFileSync(target))) changed.push(relative);
} }
compare(oldStage);
must(JSON.stringify(changed) === JSON.stringify([file]), "Unexpected frontend source delta");
const run = (command, args, cwd = root, env = process.env) => {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  must(!result.error && result.status === 0, `${command} failed ${result.error?.message ?? result.status}`);
};
run("pnpm", ["exec", "tsc", "-b", ...["scanned-code", "metered-pricing", "api-client-react"].map(lib => path.join(stage, "lib", lib)), "--force"]);
run("pnpm", ["exec", "tsc", "-p", stageFront, "--noEmit"]);
run("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--outDir", front], stageFront, { ...process.env, NODE_ENV: "production", BASE_PATH: "/" });
verify(path.dirname(parent.apiEntry), apiFiles); verify(parent.frontendRoot, parent.frontendFiles);
const frontendFiles = {};
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  const target = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(target);
  else frontendFiles[path.relative(front, target)] = sha(fs.readFileSync(target));
} }
walk(front);
const candidate = { apiEntry: parent.apiEntry, apiSha256: parent.apiSha256, frontendRoot: front, frontendFiles };
save(path.join(proof, "frontend.sha256"), Object.entries(frontendFiles).map(([file, hash]) => `${hash}  ${path.relative(root, path.join(front, file))}\n`).join(""));
save(path.join(proof, "frontend-sha256.json"), JSON.stringify(frontendFiles, null, 2) + "\n");
save(path.join(proof, "candidate.json"), JSON.stringify(candidate, null, 2) + "\n");
save(path.join(proof, "provenance.json"), JSON.stringify({
  status: "frontend-text-candidate-pending-main-activation", parent: "reports/auditoria-colaborativa/final/candidate.json",
  stage: path.relative(root, stage), frontend: path.relative(root, front),
  overlays: [{ path: file, baseSha256: sha(before), sha256: sha(value), delta: "One toast description replaces classification with neutral Registrado; leading whitespace only otherwise" }],
  isolatedFrontendTypecheck: "passed", productionBuild: "passed", sourcePreservation: "passed",
  apiUnchanged: true, priorFrontendUnchanged: true, generatedSourcesUnchanged: true,
  priorE2E: "15 passed against final candidate; no new browser run for text-only revision",
  mountedTests: "17 passed reported by UI agent/MAIN",
  activation: "not-performed", servicesStarted: "none", databaseAccess: "none", ddl: "none",
}, null, 2) + "\n");
run("sha256sum", ["--check", path.join(proof, "frontend.sha256")]);
console.log(JSON.stringify({ candidate: path.join(proof, "candidate.json"), frontendRoot: front, frontendIndexSha256: frontendFiles["index.html"], apiSha256: parent.apiSha256 }, null, 2));