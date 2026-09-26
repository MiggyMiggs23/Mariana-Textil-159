import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "../../..");
const map = JSON.parse(fs.readFileSync(path.join(root, "artifacts/api-server/dist-owner-login-v9-20260926/index.mjs.map"), "utf8"));
const index = map.sources.indexOf("../src/routes/inventario.ts");
assert.ok(index >= 0);
const tree = ts.createSourceFile("inventario.ts", map.sourcesContent[index], ts.ScriptTarget.Latest, true);
let handler;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "inventarioRouter.post" &&
    node.arguments[0]?.getText(tree) === '"/conciliacion/recalcular"') {
    handler = node.arguments.at(-1).getText(tree);
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(handler, "Exact released route handler found");
const compiled = ts.transpileModule(`module.exports = ${handler}`, {
  reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.deepEqual(compiled.diagnostics, []);
test("released handler propagates post-repair read failure after repair has resolved", async () => {
  const events = [], failure = new Error("injected read failure");
  let forwarded;
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module,
    RecalcularExistenciasBody: { parse: value => value },
    checkOperationalScope: () => null,
    recalcularExistencias: async () => { events.push("repair-resolved"); },
    conciliarTodo: async () => { events.push("read-failed"); throw failure; },
    RecalcularExistenciasResponse: { parse: value => value },
  });
  const res = { status() { throw new Error("Unexpected response"); }, json() { throw new Error("Unexpected success"); } };
  await module.exports({ body: { productoId: 1, ubicacionId: 1 }, auth: { rol: "ADMIN" } }, res, error => { forwarded = error; events.push("next-error"); });
  assert.equal(forwarded, failure);
  assert.deepEqual(events, ["repair-resolved", "read-failed", "next-error"]);
});