import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "../../..");
const front = path.join(root, "reports/priority-20260926/credit-presentation/frozen-root/artifacts/mariana-textil");
const appSource = fs.readFileSync(path.join(front, "src/App.tsx"), "utf8");
const appTree = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const uiRoutes = [];
function uiVisit(node) {
  if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(appTree) === "Route") {
    const route = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(appTree) === "path");
    uiRoutes.push({ path: route?.initializer?.getText(appTree) ?? "(fallback)", line: appTree.getLineAndCharacterOfPosition(node.getStart(appTree)).line + 1, coverage: "inventory-only unless explicitly listed in informe.md" });
  }
  ts.forEachChild(node, uiVisit);
}
uiVisit(appTree);
const map = JSON.parse(fs.readFileSync(path.join(root, "artifacts/api-server/dist-owner-login-v9-20260926/index.mjs.map"), "utf8"));
const apiRoutes = [];
for (let i = 0; i < map.sources.length; i++) {
  if (!map.sources[i].startsWith("../src/routes/") || !map.sourcesContent[i]) continue;
  const tree = ts.createSourceFile(map.sources[i], map.sourcesContent[i], ts.ScriptTarget.Latest, true);
  function apiVisit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      /router$/i.test(node.expression.expression.getText(tree)) &&
      /^(get|post|put|patch|delete)$/.test(node.expression.name.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      apiRoutes.push({
        source: map.sources[i], line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        method: node.expression.name.text.toUpperCase(), localPath: node.arguments[0].text,
        receiver: node.expression.expression.getText(tree),
        coverage: "registration inventory only; router prefixes and runtime authorization not certified",
      });
    }
    ts.forEachChild(node, apiVisit);
  }
  apiVisit(tree);
}
const reviewedErrorSurfaces = [
  ["src/pages/conciliacion.tsx", "Confirmed and fixed false healthy state; exact candidate mounted tests"],
  ["src/pages/stock-minimos.tsx", "Error handlers and deep-link contract inspected; contract 3/3; no live writes"],
  ["src/pages/ubicaciones.tsx", "Raw err.message toast paths at 52/64 inspected, no forced server failure"],
  ["src/pages/entradas-pendientes-costo.tsx", "Mutation error handler inspected, no live writes"],
  ["src/pages/proveedores.tsx", "Mutation error handler inspected, no live writes"],
  ["src/pages/productos.tsx", "Import/create error paths inspected, no live writes"],
  ["src/pages/salida-nueva.tsx", "Conditional-hook leak reproduced with actual page and real wouter Route; fixed by hook-stable branch subcomponent; timer cleanup and query-only navigation PASS. Full App/browser not exercised."],
  ["src/lib/api-error.ts", "HTML/HTTP handling and structured inventory ownership links inspected; existing error contracts pass on actual tree"],
];
const result = { baseline: { frontend: "credit-af0541", api: "owner-login-v9-20260926-map" }, uiRoutes, apiRoutes, reviewedErrorSurfaces, limitations: ["Inventory is not a pass/fail audit of all routes.", "No inferred authorization fixes.", "No database, HTTP or workflow operations."] };
fs.writeFileSync(path.join(import.meta.dirname, "route-error-inventory.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ uiRouteRegistrations: uiRoutes.length, apiLiteralRegistrations: apiRoutes.length, reviewedErrorSurfaces: reviewedErrorSurfaces.length }));