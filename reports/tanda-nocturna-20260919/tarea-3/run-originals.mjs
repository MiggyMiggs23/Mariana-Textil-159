// Run archived ORIGINAL contracts without resolving any production imports.
// Usage: node --require ./scripts/src/offline-test-guard.cjs run-originals.mjs /tmp/archive
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(process.argv[2]);
const require = createRequire(import.meta.url);
const zod = createRequire(new URL("../../../lib/api-zod/package.json", import.meta.url))("zod");
const schemaSource = readFileSync(resolve(root, "lib/api-zod/src/generated/api.ts"), "utf8");
const schema = {};
const compiledSchema = ts.transpileModule(schemaSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInThisContext(`(function(exports, require) {${compiledSchema}\n})`)(schema, (id) => {
  if (id !== "zod") throw Error(`Forbidden baseline schema dependency ${id}`);
  return zod;
});
for (const file of ["clientes-notas-credito.contract.test.ts", "clientes-pagos.contract.test.ts", "pos-caja-final.contract.test.ts"]) {
  const path = resolve(root, "artifacts/api-server/src", file);
  const source = readFileSync(path, "utf8").replaceAll("import.meta.url", JSON.stringify(pathToFileURL(path).href));
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const allowed = new Set(["node:assert/strict", "node:test", "node:fs", "node:fs/promises"]);
  vm.runInThisContext(`(function(exports, require) {${output}\n})`, { filename: path })({}, (id) => {
    if (id === "@workspace/api-zod") return schema;
    if (!allowed.has(id)) throw Error(`Forbidden original test import: ${id}`);
    return require(id);
  });
}