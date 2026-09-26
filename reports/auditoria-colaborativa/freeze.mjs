import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const report = path.join(root, "reports/auditoria-colaborativa");
const out = path.join(report, "frozen");
if (fs.existsSync(out)) throw Error("Freeze already exists");
fs.mkdirSync(out, { recursive: true });
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const git = args => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status) throw Error(result.stderr);
  return result.stdout;
};
const apiDir = "artifacts/api-server/dist-directorios-sitios-20260925-sin-rfc";
const frontStage = "reports/directorios-sitios-20260925/staging/frontend-root-sin-rfc";
const mapBytes = fs.readFileSync(path.join(apiDir, "index.mjs.map"));
const map = JSON.parse(mapBytes);
const apiSources = new Map(map.sources.map((name, i) => [path.relative(root, path.resolve(apiDir, name)), map.sourcesContent[i]]));
const paths = [
  "artifacts/api-server/src/lib/auditoria-inventario.ts",
  "artifacts/api-server/src/routes/auditorias-inventario.ts",
  "artifacts/api-server/src/lib/auditoria-owner.ts",
  "artifacts/mariana-textil/src/pages/auditorias-inventario.tsx",
  "lib/api-zod/src/generated/api.ts",
  "lib/api-client-react/src/generated/api.ts",
  "lib/api-client-react/src/generated/api.schemas.ts",
  "lib/api-spec/openapi.yaml",
];
const items = [];
for (const file of paths) {
  const headResult = spawnSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
  const head = headResult.status === 0 ? headResult.stdout : null;
  const work = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const stageFile = path.join(frontStage, file);
  const base = file.startsWith("artifacts/api-server/") || file.startsWith("lib/api-zod/")
    ? apiSources.get(file) ?? null
    : fs.existsSync(stageFile) ? fs.readFileSync(stageFile, "utf8") : null;
  for (const [kind, content] of Object.entries({ head, work, base })) {
    if (content === null) continue;
    const target = path.join(out, kind, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  if (base !== null && head !== null) {
    const diff = spawnSync("diff", ["-u", path.join(out, "base", file), path.join(out, "head", file)], { encoding: "utf8" });
    const target = path.join(out, "diff", file + ".diff");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, diff.stdout);
  }
  items.push({ path: file, baseSha256: base === null ? null : hash(base), headSha256: head === null ? null : hash(head), workSha256: work === null ? null : hash(work), baseEqualsHead: base === head, baseEqualsWork: base === work, headEqualsWork: head === work });
}
fs.copyFileSync(path.join(apiDir, "index.mjs.map"), path.join(out, "api-parent.map"));
fs.writeFileSync(path.join(out, "worktree-status.txt"), git(["status", "--short"]));
fs.writeFileSync(path.join(out, "worktree.diff"), git(["diff", "HEAD"]));
const manifest = { capturedAt: new Date().toISOString(), head: git(["rev-parse", "HEAD"]).trim(), apiParent: apiDir, frontendParentStage: frontStage, apiMapSha256: hash(mapBytes), apiEntrySha256: hash(fs.readFileSync(path.join(apiDir, "index.mjs"))), frontendIndexSha256: hash(fs.readFileSync("artifacts/mariana-textil/dist-directorios-sitios-20260925-sin-rfc/index.html")), items };
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));