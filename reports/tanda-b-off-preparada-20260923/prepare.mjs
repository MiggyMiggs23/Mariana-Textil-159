// Static builds only. Never imports the API, starts services, or accesses a database.
import fs from "node:fs";
import path from "node:path";
import { report, root, revision, distName, digest, run, write } from "./common.mjs";
const source = path.join(report, "source");
if (fs.existsSync(source) || fs.existsSync(path.join(report, "manifest.json"))) throw new Error("Preparation already exists; do not overwrite");
if (run("git", ["rev-parse", "HEAD"], { cwd: root }).stdout.trim() !== revision) throw new Error("HEAD differs from approved base");
fs.mkdirSync(source);
fs.mkdirSync(path.join(report, "evidencia"), { recursive: true });
const archive = path.join(report, "source.tar");
run("git", ["archive", "--format=tar", `--output=${archive}`, revision, "artifacts/api-server", "artifacts/mariana-textil", "lib", "attached_assets", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json"], { cwd: root });
run("tar", ["-xf", archive, "-C", source]);
fs.unlinkSync(archive);
const sourceHashes = {};
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);
for (const file of walk(source)) sourceHashes[path.relative(source,file)] = digest(fs.readFileSync(file));
write(path.join(report, "source-manifest.json"), { revision, files: sourceHashes });
const links = [];
for (const relative of [".", "artifacts/api-server", "artifacts/mariana-textil", ...fs.readdirSync(path.join(source, "lib")).map(n => `lib/${n}`)]) {
  const target = path.join(root, relative, "node_modules");
  const link = path.join(source, relative, "node_modules");
  if (fs.existsSync(target) && !fs.existsSync(link)) { fs.symlinkSync(target, link); links.push({ link, target: fs.realpathSync(target) }); }
}
write(path.join(report,"build-dependency-links.json"), links);
const gates = [];
for (const [relative] of Object.entries(sourceHashes)) {
  if (!/\/src\/lib\/.*\.ts$/.test(relative) || relative.includes(".test.")) continue;
  const text = fs.readFileSync(path.join(source, relative), "utf8");
  for (const match of text.matchAll(/export const ((?:E(?:3|4|5|7|9|11|12)\w*|REMATE\w*)_(?:ENABLED|RELEASED))(?::\s*boolean)?\s*=\s*(true|false)/g)) {
    gates.push({ file: relative, name: match[1], value: match[2] });
    if (match[2] !== "false") throw new Error(`Open gate ${match[1]}`);
  }
}
if (!gates.some(g => g.name === "E3_ENABLED") || !gates.some(g => g.name === "E4_CASH_OUT_ENABLED")) throw new Error("Missing gate evidence");
write(path.join(report, "evidencia/source-gates.json"), gates);
fs.copyFileSync(path.join(root, "reports/e3-apertura-preparada-20260922/release-catalog.sql"), path.join(report, "release-catalog.sql"));
const api = path.join(root, "artifacts/api-server", distName);
const ui = path.join(root, "artifacts/mariana-textil", distName);
if (fs.existsSync(api) || fs.existsSync(ui)) throw new Error("Final output exists; refusing overwrite");
const clean = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", BASE_PATH: "/" };
function build(command, args, options, log) {
  const fd = fs.openSync(path.join(report, log), "wx");
  try { run(command, args, { ...options, stdio: ["ignore", fd, fd], timeout: 300000 }); }
  finally { fs.closeSync(fd); }
}
build(process.execPath, [path.join(source, "artifacts/api-server/build.mjs")],
  { cwd: path.join(source,"artifacts/api-server"), env: { ...clean, API_BUILD_OUTPUT_DIR: api } }, "build-api.log");
build(path.join(root,"artifacts/mariana-textil/node_modules/.bin/vite"), ["build", "--outDir", ui],
  { cwd: path.join(source,"artifacts/mariana-textil"), env: clean }, "build-ui.log");
const outputs = Object.fromEntries([...walk(api), ...walk(ui)].sort().map(f => [path.relative(root,f), digest(fs.readFileSync(f))]));
const workerReferences = fs.readFileSync(path.join(api,"index.mjs"),"utf8").split("\n").filter(l => /const outputDir =|pinoBundlerAbsolutePath\("\.\//.test(l)).slice(0,30);
write(path.join(report,"evidencia/build-path-identity.json"), { buildSource: source, finalApiOutput: api, relocationApproved: false, workerReferences });
write(path.join(report,"manifest.json"), { status: "BUILT_NOT_VALIDATED_MAIN_PENDING", revision,
  phaseBExecuted: false, releaseAuthorized: false, allGates: "OFF", activationPatch: false,
  sourceManifestSha256: digest(fs.readFileSync(path.join(report,"source-manifest.json"))),
  tools: { node: process.version, pnpm: run("pnpm",["--version"],{env:clean}).stdout.trim() },
  buildCommands: ["node source/artifacts/api-server/build.mjs (API_BUILD_OUTPUT_DIR=final absolute path)", "vite build --outDir final absolute UI path"],
  outputs, pending: ["REAL_READONLY_CAPTURE_PID191", "REAL_CURRENT_PREFLIGHT", "DISPOSABLE_CATALOG_FIDELITY", "CANDIDATE_STARTUP_PRESERVATION", "MAIN_REVIEW"], sealed: false });
fs.writeFileSync(path.join(report,"release-assets.sha256"), Object.entries(outputs).map(([f,h]) => `${h}  ${f}\n`).join(""), { flag: "wx" });
fs.writeFileSync(path.join(report,"manifest.sha256"), `${digest(fs.readFileSync(path.join(report,"manifest.json")))}  reports/tanda-b-off-preparada-20260923/manifest.json\n`, { flag: "wx" });
console.log("BUILT_NOT_VALIDATED_MAIN_PENDING");