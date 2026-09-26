import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
process.argv.push("--delta-library");
const { applyDelta } = await import("./build-ui.mjs");
const root = process.cwd();
const report = path.join(root, "reports/inventory-floors-20260926");
const parent = path.join(root, "artifacts/api-server/dist-print-entrada-20260926");
const map = JSON.parse(fs.readFileSync(path.join(parent, "index.mjs.map"), "utf8"));
const original = new Map(map.sources.map((file, i) => [path.resolve(parent, file), map.sourcesContent[i]]));
const route = "artifacts/api-server/src/routes/inventario.ts";
const schema = "lib/api-zod/src/generated/api.ts";
const read = file => fs.readFileSync(file, "utf8");
const inputsPath = path.join(report, "api-inputs.json");
if (!fs.existsSync(inputsPath)) {
  const inputs = [route, schema].map(file => {
    const head = spawnSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
    assert.equal(head.status, 0);
    return { file, head: head.stdout, current: read(path.join(root, file)), before: original.get(path.join(root, file)) };
  });
  fs.writeFileSync(inputsPath, JSON.stringify(inputs));
}
for (const item of JSON.parse(read(inputsPath))) {
  let content;
  if (item.file === schema) {
    // Generator reordered/re-described receipt fields: exclude all that churn.
    const start = "export const GetExistenciasAgrupadasResponseItem = ";
    const end = "export const GetExistenciasAgrupadasResponse = ";
    const section = text => text.slice(text.indexOf(start), text.indexOf(end));
    assert.ok(item.before.includes(section(item.head)), "Frozen grouped schema differs from HEAD");
    content = item.before.replace(section(item.head), section(item.current));
  } else {
    content = applyDelta(item.before, item.head, item.current);
  }
  const file = path.join(report, "api-overlay", item.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const priorRecipe = read(path.join(root, "reports/print-corrections-20260926/entrada/build-api.mjs"));
let recipe = priorRecipe
  .replace('const parent = path.join(api, "dist-owner-cash-v10-20260926");', 'const parent = path.join(api, "dist-print-entrada-20260926");')
  .replace('const out = path.join(api, "dist-print-entrada-20260926");', 'const out = path.join(api, "dist-inventory-floors-20260926");')
  .replace('reports/print-corrections-20260926/entrada/api-candidate', 'reports/inventory-floors-20260926/api-candidate')
  .replace('dafb028d684e3de6f04232908c5fa5054c9bb1757d5dc4bb7f40eb2a29585df1', '1c74777957fc1ad332228ea8407eac831cd14018debf94918c2a96647d6348b3')
  .replace(/const allowed = \[[\s\S]*?\]\.sort\(\);/, `const allowed = ${JSON.stringify([route, schema])}.sort();`)
  .replace('reports/print-corrections-20260926/entrada/overlay', 'reports/inventory-floors-20260926/api-overlay')
  .replace('frozen-cash-v10-entrada-only', 'frozen-entrada-inventory-floors-only');
assert.notEqual(recipe, priorRecipe);
const recipeFile = path.join(report, "build-api-frozen.mjs");
fs.writeFileSync(recipeFile, recipe);
const result = spawnSync("node", [recipeFile], { cwd: root, encoding: "utf8", maxBuffer: 30e6 });
fs.writeFileSync(path.join(report, "api-build.log"), result.stdout + result.stderr);
assert.equal(result.status, 0, result.stderr);
console.log(result.stdout);