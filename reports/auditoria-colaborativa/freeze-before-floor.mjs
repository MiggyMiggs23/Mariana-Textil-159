// Evidence only. No build, service operation or database access.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, "../..");
const report = import.meta.dirname;
const out = path.join(report, "floor-baseline");
if (fs.existsSync(out)) throw Error("Refusing to overwrite floor baseline");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const candidate = readJson(path.join(report, "unirse/candidate.json"));
const proof = readJson(path.join(report, "unirse/provenance.json"));
const apiFiles = readJson(path.join(report, "api-sha256.json"));
const apiDir = path.dirname(candidate.apiEntry);
for (const [relative, expected] of Object.entries(apiFiles)) {
  if (hash(fs.readFileSync(path.join(apiDir, relative))) !== expected) throw Error(`Prior API changed: ${relative}`);
}
for (const [relative, expected] of Object.entries(candidate.frontendFiles)) {
  if (hash(fs.readFileSync(path.join(candidate.frontendRoot, relative))) !== expected) throw Error(`Prior frontend changed: ${relative}`);
}
const mapBytes = fs.readFileSync(path.join(apiDir, "index.mjs.map"));
save(path.join(out, "api-parent.map"), mapBytes);
const map = JSON.parse(mapBytes);
const sourceHashes = {};
for (let i = 0; i < map.sources.length; i++) {
  const absolute = path.resolve(apiDir, map.sources[i]);
  if (absolute.includes("node_modules")) continue;
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..")) throw Error(`Outside workspace source: ${relative}`);
  save(path.join(out, "api-sources", relative), map.sourcesContent[i]);
  sourceHashes[relative] = hash(map.sourcesContent[i]);
}
const stage = path.join(root, proof.stage);
const stageHashes = {};
function copySources(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.endsWith(".tsbuildinfo") || entry.isSymbolicLink()) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { copySources(file); continue; }
    const relative = path.relative(stage, file);
    const bytes = fs.readFileSync(file);
    save(path.join(out, "frontend-sources", relative), bytes);
    stageHashes[relative] = hash(bytes);
  }
}
copySources(stage);
for (const file of ["provenance.json", "preservation-check.json", "unirse/provenance.json", "unirse/candidate.json", "unirse/all.sha256"]) {
  save(path.join(out, "prior-evidence", file), fs.readFileSync(path.join(report, file)));
}
save(path.join(out, "manifest.json"), JSON.stringify({
  capturedAt: new Date().toISOString(),
  purpose: "Immutable collaboration + explicit-join candidate baseline before floor-only revision",
  candidate, frontendStage: proof.stage, apiMapSha256: hash(mapBytes),
  apiFiles, apiWorkspaceSources: sourceHashes, frontendRetainedSources: stageHashes,
  oldCandidatesVerifiedUnchanged: true,
  buildsPerformed: false, servicesStarted: false, activation: "not-performed",
}, null, 2) + "\n");
console.log(`Frozen prior candidate: ${Object.keys(sourceHashes).length} API workspace sources and ${Object.keys(stageHashes).length} frontend retained files. No build performed.`);