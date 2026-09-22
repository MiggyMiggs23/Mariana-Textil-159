// Preparation only: never imports or starts the API, never connects to PostgreSQL.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = "/home/runner/workspace";
const out = path.join(root, "reports/e3-apertura-preparada-20260922");
const prior = path.join(root, "reports/e3-paquete-liberacion-preparado-20260922");
const stage = path.join(out, "source");
const apiOut = path.join(root, "artifacts/api-server/dist-e3-apertura-20260922");
const webOut = path.join(root, "artifacts/mariana-textil/dist-e3-apertura-20260922");
const sha = data => createHash("sha256").update(data).digest("hex");
const run = (cmd, args, cwd = root, extra = {}) => {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8",
    NODE_ENV: "production", ...extra };
  const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}): ${r.stderr}`);
  return r.stdout;
};
for (const p of [out, apiOut, webOut]) assert(!fs.existsSync(p), `Refusing existing final path: ${p}`);
const patches = [
  ["artifacts/api-server/src/lib/e3-ordinary-cash-release.ts", "export const E3_ORDINARY_CASH_ENABLED = false;", "export const E3_ORDINARY_CASH_ENABLED = true;"],
  ["artifacts/api-server/src/lib/e3-collection.ts", "export const E3_ENABLED = false;", "export const E3_ENABLED = true;"],
  ["artifacts/api-server/src/lib/permisos.ts", "const E3_MATRIX_RELEASED: boolean = false;", "const E3_MATRIX_RELEASED: boolean = true;"],
  ["artifacts/mariana-textil/src/lib/e3-feature-flags.ts", "export const E3_ENABLED = false;", "export const E3_ENABLED = true;"],
];
for (const [file, from] of patches) assert.equal(fs.readFileSync(path.join(root, file), "utf8").split(from).length, 2);
fs.mkdirSync(stage, { recursive: true });
const result = { status: "PREPARING_NOT_VALIDATED_NOT_RELEASED", sourceRevision: run("git", ["rev-parse", "HEAD"]).trim(),
  apiOut, webOut, sourceFiles: {}, activatedFiles: {}, outputs: {}, releaseAuthorized: false };
const put = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, { flag: "wx" });
};
try {
  // Freeze all maintained application/library files, including currently untracked changes.
  const files = run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
  for (const file of [...new Set(files)].sort()) {
    if (!(file.startsWith("lib/") || file.startsWith("artifacts/api-server/") ||
      file.startsWith("artifacts/mariana-textil/") ||
      ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json"].includes(file))) continue;
    if (file.split("/").some(p => p === "node_modules" || p.startsWith("dist"))) continue;
    const src = path.join(root, file);
    assert(fs.lstatSync(src).isFile(), `Source must be physical regular file: ${file}`);
    const bytes = fs.readFileSync(src);
    result.sourceFiles[file] = sha(bytes);
    put(path.join(stage, file), bytes);
  }
  let patchText = "";
  for (const [file, from, to] of patches) {
    const target = path.join(stage, file);
    const text = fs.readFileSync(target, "utf8");
    fs.writeFileSync(target, text.replace(from, to));
    result.activatedFiles[file] = sha(fs.readFileSync(target));
    patchText += `--- a/${file}\n+++ b/${file}\n@@\n-${from}\n+${to}\n`;
  }
  put(path.join(out, "activation.patch"), patchText);
  // Only dependency links are shared; @workspace always resolves to the physical freeze.
  // Negative controls must make their own physical copies, never mutate these links.
  for (const dir of ["", "artifacts/api-server", "artifacts/mariana-textil",
    ...fs.readdirSync(path.join(root, "lib")).map(p => `lib/${p}`)]) {
    const original = path.join(root, dir, "node_modules");
    if (!fs.existsSync(original)) continue;
    const target = path.join(stage, dir, "node_modules");
    fs.mkdirSync(target, { recursive: true });
    for (const item of fs.readdirSync(original)) {
      if (item === "@workspace") {
        fs.mkdirSync(path.join(target, item));
        for (const name of fs.readdirSync(path.join(original, item))) {
          const rel = path.relative(root, fs.realpathSync(path.join(original, item, name)));
          assert(rel.startsWith("lib/") || rel.startsWith("artifacts/"));
          fs.symlinkSync(path.join(stage, rel), path.join(target, item, name), "dir");
        }
      } else fs.symlinkSync(fs.realpathSync(path.join(original, item)), path.join(target, item));
    }
  }
  for (const file of ["release-catalog.sql"]) put(path.join(out, file), fs.readFileSync(path.join(prior, file)));
  for (const file of fs.readdirSync(path.join(prior, "sql"))) {
    put(path.join(out, "sql", file.replace(".BLOCKED-NO-APLICAR", ".REHEARSAL-ONLY")),
      fs.readFileSync(path.join(prior, "sql", file)));
  }
  // Reuse the reviewed effective-PID READ ONLY capture, changing its output directory only.
  const capture = fs.readFileSync(path.join(root, "scripts/src/e3-capture-readonly-20260922.mjs"), "utf8");
  assert.equal(capture.split("reports/e3-paquete-liberacion-preparado-20260922").length, 2);
  put(path.join(out, "capture-readonly.mjs"), capture.replace(
    "reports/e3-paquete-liberacion-preparado-20260922", "reports/e3-apertura-preparada-20260922")
    .replace('sourceRevision: "95128fc8f2773907c6a34ef2cfeb1f631e84f301"',
      'sourceRevision: JSON.parse(readFileSync(path.join(report, "preparation-status.json"), "utf8")).sourceRevision'));
  // Projection keeps the faithful enum reconstruction and SQL01 preservation check.
  // SQL03 runs only after that check, exclusively inside the newly created cluster.
  let projection = fs.readFileSync(path.join(root, "scripts/src/e3-project-schema-20260922.mjs"), "utf8");
  const replaceOnce = (from, to) => {
    assert.equal(projection.split(from).length, 2, `Projection adaptation anchor mismatch: ${from}`);
    projection = projection.replace(from, to);
  };
  replaceOnce("reports/e3-paquete-liberacion-preparado-20260922", "reports/e3-apertura-preparada-20260922");
  projection = projection.replaceAll("95128fc8f2773907c6a34ef2cfeb1f631e84f301", result.sourceRevision);
  replaceOnce("const after = readCatalog();", "let after = readCatalog();");
  replaceOnce("  const addedSchema = after.schemaRows.filter", `  const after01 = after;
  const openSql = fs.readFileSync(path.join(packageDir, "sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql"), "utf8");
  sql(openSql);
  after = readCatalog();
  fs.writeFileSync(path.join(evidenceDir, "catalog-B1-schema-only.json"), JSON.stringify(after01, null, 2) + "\\n");
  fs.writeFileSync(path.join(evidenceDir, "cash-gate-delta.json"), JSON.stringify({
    sql03Sha256: hash(openSql),
    removedSchema: after01.schemaRows.filter(row => !new Set(after.schemaRows.map(canonical)).has(canonical(row))),
    addedSchema: after.schemaRows.filter(row => !new Set(after01.schemaRows.map(canonical)).has(canonical(row))),
    removedAttributes: after01.attributes.filter(row => !new Set(after.attributes.map(canonical)).has(canonical(row))),
    addedAttributes: after.attributes.filter(row => !new Set(after01.attributes.map(canonical)).has(canonical(row)))
  }, null, 2) + "\\n");
  const addedSchema = after.schemaRows.filter`);
  replaceOnce("SQL 03/04 not applied.", "SQL03 applied only in disposable projection; SQL04 retained for rollback, not applied.");
  replaceOnce('sql: "01-install-prepared.sql only"', 'sql: "01-install-prepared.sql plus scoped SQL03 in disposable cluster only"');
  replaceOnce("sql03Applied: false", "sql03Applied: true");
  replaceOnce("preservedAllPreexistingSchemaRows: true", "sql01PreservedAllPreexistingSchemaRows: true");
  replaceOnce("preservedAllPreexistingAttributes: true", "sql01PreservedAllPreexistingAttributes: true");
  replaceOnce('  fs.rmSync(base, { recursive: true, force: true });',
    '  if (!started || results.postgresStopExit === 0) fs.rmSync(base, { recursive: true, force: true });');
  put(path.join(out, "project-schema.mjs"), projection);
  put(path.join(out, "build-api.log"), run("node", ["build.mjs"],
    path.join(stage, "artifacts/api-server"), { API_BUILD_OUTPUT_DIR: apiOut }));
  put(path.join(out, "build-web.log"), run("node", [
    path.join(root, "artifacts/mariana-textil/node_modules/vite/bin/vite.js"),
    "build", "--outDir", webOut], path.join(stage, "artifacts/mariana-textil"), { BASE_PATH: "/" }));
  const inventory = dir => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      assert(!stat.isSymbolicLink(), `No mutable output symlinks: ${file}`);
      if (stat.isDirectory()) inventory(file);
      else result.outputs[path.relative(root, file)] = sha(fs.readFileSync(file));
    }
  };
  inventory(apiOut); inventory(webOut);
  for (const [file, hash] of Object.entries(result.sourceFiles))
    assert.equal(sha(fs.readFileSync(path.join(root, file))), hash, `Live source changed during build: ${file}`);
  for (const [file, from] of patches) assert(fs.readFileSync(path.join(root, file), "utf8").includes(from));
  assert(fs.readFileSync(path.join(stage, "artifacts/api-server/src/lib/e3-collection.ts"), "utf8")
    .includes("export const E3_DIRECTED_ENABLED = false;"));
  put(path.join(out, "release-assets.sha256"), Object.entries(result.outputs).sort(([a], [b]) => a.localeCompare(b))
    .map(([file, hash]) => `${hash}  ${file}\n`).join(""));
  result.status = "BUILT_NOT_REHEARSED_NOT_RELEASED";
} catch (error) {
  result.status = "FAILED_NOT_RELEASED";
  result.error = error.message;
  process.exitCode = 1;
} finally {
  put(path.join(out, "preparation-status.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ status: result.status, error: result.error, out, apiOut, webOut }));
}