// Preparation only: no app execution, installation, database, or live-path write.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const workspace = process.cwd();
const revision = process.argv[2] ?? "31804125a1e752bde128d72e9fd44d23972ffff1";
if (!["31804125a1e752bde128d72e9fd44d23972ffff1", "7cb77f8cfc6287fa51325a25122c48af392a7ada"].includes(revision)) {
  throw new Error("Only explicitly authorized candidate/control revisions may be exported.");
}
const target = fs.mkdtempSync("/tmp/e2-release-preparation-");
const source = path.join(target, "source");
fs.mkdirSync(source);
const tracked = execFileSync("git", ["ls-tree", "-r", "--name-only", revision], { encoding: "utf8" });
if (tracked.split("\n").some(p => /(^|\/)\.env($|\.)/.test(p) && !p.endsWith(".example"))) {
  throw new Error("Tracked environment file: preparation stopped before export.");
}
const archive = path.join(target, "source.tar");
execFileSync("git", ["archive", "-o", archive, revision]);
execFileSync("tar", ["-xf", archive, "-C", source]);
const packageRoots = [".", ...["artifacts", "lib"].flatMap(parent =>
  fs.readdirSync(path.join(source, parent)).map(name => `${parent}/${name}`)
), "scripts"].filter(p => fs.existsSync(path.join(source, p, "package.json")));
const packages = new Map(packageRoots.map(p => [
  JSON.parse(fs.readFileSync(path.join(source, p, "package.json"), "utf8")).name,
  path.join(source, p),
]));
function linkDirectory(from, to, prefix = "") {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (name === ".cache") continue;
    const input = path.join(from, name);
    const output = path.join(to, name);
    if (name.startsWith("@") && !prefix) {
      linkDirectory(input, output, `${name}/`);
      continue;
    }
    const packageName = `${prefix}${name}`;
    // Internal package resolution must remain inside the historical export.
    const destination = packages.get(packageName) ?? fs.realpathSync(input);
    fs.symlinkSync(destination, output);
  }
}
for (const root of packageRoots) {
  const installed = path.join(workspace, root, "node_modules");
  if (fs.existsSync(installed)) linkDirectory(installed, path.join(source, root, "node_modules"));
}
// Ensure no .env was exported, including accidentally tracked env files.
fs.mkdirSync(path.join(target, "home"));
fs.writeFileSync(path.join(target, "provenance.json"), JSON.stringify({
  revision, tree: execFileSync("git", ["rev-parse", `${revision}^{tree}`], { encoding: "utf8" }).trim(),
  source, environment: Object.keys(process.env).sort(),
  dependencies: "Installed external packages reused read-only; workspace packages remapped to exact export.",
}, null, 2));
console.log(target);