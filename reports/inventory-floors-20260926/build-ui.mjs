import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const report = path.join(root, "reports/inventory-floors-20260926");
const prior = path.join(root, "reports/print-corrections-20260926/labels/frozen-root");
const baseline = process.argv.includes("--baseline");
const frozen = path.join(report, baseline ? "baseline-frozen-root" : "frozen-root");
const app = "artifacts/mariana-textil";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const read = file => fs.readFileSync(file, "utf8");
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
const files = [`${app}/src/pages/inventario.tsx`, `${app}/src/lib/inventory-locations.tsx`, "lib/api-client-react/src/generated/api.schemas.ts"];
fs.mkdirSync(report, { recursive: true });
if (!fs.existsSync(path.join(report, "ui-inputs.json"))) {
  const inputs = files.map(file => {
    const before = fs.existsSync(path.join(prior, file)) ? read(path.join(prior, file)) : null;
    const current = read(path.join(root, file));
    const head = before === null ? null : git("show", `HEAD:${file}`);
    return { file, before, head, current };
  });
  fs.writeFileSync(path.join(report, "ui-inputs.json"), JSON.stringify(inputs));
}
export function applyDelta(frozenText, head, current) {
  if (head === frozenText) return current;
  // Preserve all frozen differences; apply only HEAD-to-working-tree hunks.
  const temp = path.join(report, "diff-input");
  fs.mkdirSync(temp, { recursive: true });
  fs.writeFileSync(path.join(temp, "old"), head);
  fs.writeFileSync(path.join(temp, "new"), current);
  const diff = spawnSync("git", ["diff", "--no-index", "--", path.join(temp, "old"), path.join(temp, "new")], { encoding: "utf8" });
  assert.ok(diff.status === 0 || diff.status === 1, diff.stderr);
  const hunks = diff.stdout.split(/^@@.*@@.*\n/m).slice(1);
  for (const hunk of hunks) {
    const lines = hunk.split("\n").filter(line => /^[ +\-]/.test(line));
    const oldText = lines.filter(line => line[0] !== "+").map(line => line.slice(1)).join("\n") + "\n";
    const newText = lines.filter(line => line[0] !== "-").map(line => line.slice(1)).join("\n") + "\n";
    assert.ok(oldText.length > 1 && frozenText.includes(oldText), "Frozen hunk context mismatch");
    assert.equal(frozenText.indexOf(oldText), frozenText.lastIndexOf(oldText), "Ambiguous frozen hunk");
    frozenText = frozenText.replace(oldText, newText);
  }
  return frozenText;
}
if (process.argv.includes("--delta-library")) {
  // API builder imports this module without triggering a UI build.
} else {
  fs.rmSync(frozen, { recursive: true, force: true });
  fs.cpSync(prior, frozen, { recursive: true, verbatimSymlinks: true });
  const inputs = baseline ? [] : JSON.parse(read(path.join(report, "ui-inputs.json")));
  const inventory = [];
  for (const item of inputs) {
    const content = item.before === null ? item.current : applyDelta(item.before, item.head, item.current);
    const dest = path.join(frozen, item.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    inventory.push({ file: item.file, beforeSha256: item.before === null ? null : sha(item.before), headSha256: item.head === null ? null : sha(item.head), afterSha256: sha(content), frozenEqualsHead: item.before === item.head });
  }
  const workspaceLinks = path.join(frozen, app, "node_modules/@workspace");
  // Prior v3 resolved other workspace packages through its original frozen links.
  // Repoint only the package receiving this candidate's approved schema delta.
  for (const name of baseline ? [] : ["api-client-react"]) {
    fs.unlinkSync(path.join(workspaceLinks, name));
    fs.symlinkSync(path.join(frozen, "lib", name), path.join(workspaceLinks, name));
  }
  const out = baseline ? path.join(report, "baseline-rebuilt") : path.join(root, app, "dist-inventory-floors-20260926");
  const result = spawnSync(path.join(frozen, app, "node_modules/.bin/vite"), ["build", "--config", path.join(frozen, app, "vite.config.ts"), "--outDir", out], {
    cwd: path.join(frozen, app), encoding: "utf8", env: { ...process.env, NODE_ENV: "production", BASE_PATH: "/" }, maxBuffer: 20e6,
  });
  fs.writeFileSync(path.join(report, baseline ? "ui-baseline-build.log" : "ui-build.log"), (result.stdout ?? "") + (result.stderr ?? "") + (result.error?.message ?? ""));
  assert.equal(result.status, 0, result.stderr);
  const hashes = {};
  function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file); else hashes[path.relative(out, file)] = sha(fs.readFileSync(file));
  } }
  walk(out);
  if (baseline) {
    const expected = JSON.parse(read(path.join(root, "reports/print-corrections-20260926/labels/combined-candidate-v3.json"))).frontendFiles;
    assert.deepEqual(hashes, expected, "Prior v3 source does not reproduce prior v3 bytes");
  }
  fs.writeFileSync(path.join(report, baseline ? "ui-baseline-parity.json" : "ui-candidate.json"), JSON.stringify({ status: "BUILT_NOT_ACTIVATED", out, frozen, prior, sourceDeltas: inventory, files: hashes, databaseAccess: false, runtimeChanges: false }, null, 2));
  console.log(out);
}