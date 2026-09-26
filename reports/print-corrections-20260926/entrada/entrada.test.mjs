import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { createRequire } from "node:module";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../../..");
const overlay = path.join(import.meta.dirname, "overlay");
const front = path.join(root, "artifacts/mariana-textil");
const requireFront = createRequire(path.join(front, "package.json"));
const React = requireFront("react");
const { renderToStaticMarkup } = requireFront("react-dom/server");
function load(source, dependencies = {}, globals = {}) {
  const compiled = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.deepEqual(compiled.diagnostics, []);
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${compiled.outputText}\n})`, globals)(
    name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports);
  return module.exports;
}
const helperSource = fs.readFileSync(path.join(overlay, "artifacts/api-server/src/lib/entrada-floor-evidence.ts"), "utf8");
const { entradaFloorLabel } = load(helperSource);
const engine = fs.readFileSync(path.join(overlay, "artifacts/api-server/src/lib/inventario.ts"), "utf8");
const start = engine.indexOf("export async function buildEntradaResult(");
const end = engine.indexOf("\n}\n", start) + 3;
const table = new Proxy({}, { get: (_, key) => key });
const builder = load(engine.slice(start, end), {}, {
  entradaFloorLabel, entradasTable: table, ubicacionesTable: table, usuariosTable: table,
  proveedoresTable: table, rollosTable: table, productosTable: table, pisosTable: table,
  auditoriaTable: table, eq: (...args) => args, and: (...args) => args,
  quantityToThousandthsBigInt: value => BigInt(Math.round(Number(value) * 1000)),
  formatQuantityThousandthsBigInt: value => (Number(value) / 1000).toFixed(3),
  InventarioError: Error,
}).buildEntradaResult;
const header = { id: 17, folio: 2, ubicacionId: 1, inicialesSitio: "DN", nombreUbicacion: "Donceles",
  proveedorId: null, usuarioId: 1, fecha: new Date("2026-09-26T12:00:00Z"),
  createdAt: new Date("2026-09-26T12:00:00Z"), totalRollos: 2, totalCosto: "20", uuidCliente: "fixture" };
const rolls = [1, 2].map(id => ({ id, serie: `SERIE-${id}`, productoId: id,
  sku: `SKU-${id}`, tela: `Tela ${id}`, color: "Azul", unidad: "METRO",
  cantidadInicial: "5", costoUnitario: "2", costoTotal: "10",
  pisoId: 999, nombrePiso: "Piso actual reubicado NO USAR" }));
const evidence = [
  { rolloId: 1, productoId: 1, pisoId: 11, nombrePiso: "Planta baja" },
  { rolloId: 2, productoId: 2, pisoId: 12, nombrePiso: "Primer piso" },
];
async function detail(events, selectedRolls = rolls) {
  const queue = [[header], [{ nombre: "Operador" }], selectedRolls, events];
  const tx = { select() {
    const result = queue.shift();
    const query = new Proxy({}, { get: (_, key) => key === "then"
      ? (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      : () => query });
    return query;
  } };
  const result = await builder(tx, 17);
  assert.equal(queue.length, 0);
  return result;
}
let data;
const primitive = ({ children }) => React.createElement("div", null, children);
const deps = {
  "react/jsx-runtime": requireFront("react/jsx-runtime"),
  wouter: { useParams: () => ({ id: "17" }) },
  "@workspace/api-client-react": { useGetEntrada: () => ({ data }), getGetEntradaQueryKey: () => [] },
  "@/components/printable-document-header": { PrintableDocumentHeader: primitive },
  "@/components/document-qr-code": { DOCUMENT_QR_SIZE: 64 },
  "date-fns": { format: () => "fixture-date" },
  "lucide-react": new Proxy({}, { get: () => () => null }),
  "@/components/ui/button": { Button: primitive },
  "@workspace/number-format": { formatNumber: String, formatUnit: String },
  "@/lib/print": { absoluteAppUrl: value => value, printWhenReady() {} },
};
const currentSource = fs.readFileSync(path.join(front, "src/pages/entrada-documento.tsx"), "utf8");
const frozenSource = fs.readFileSync(path.join(root,
  "reports/postrelease-review-20260926/tarea-4/final-frozen-root/artifacts/mariana-textil/src/pages/entrada-documento.tsx"), "utf8");
const current = load(currentSource, deps).default;
const frozen = load(frozenSource, deps).default;
test("actual released builder + actual document: two receipt floors survive later roll relocation", async () => {
  data = await detail([{ datos: { pisosEntradaVersion: 1, pisosEntrada: evidence } }]);
  assert.deepEqual(Array.from(data.lineas, row => row.pisoEntrada), ["Planta baja", "Primer piso"]);
  const html = renderToStaticMarkup(React.createElement(current));
  assert.match(html, />Piso<\/th>/);
  assert.match(html, />Planta baja<\/td>/);
  assert.match(html, />Primer piso<\/td>/);
  assert.doesNotMatch(html, /Piso actual reubicado/);
  const oldHtml = renderToStaticMarkup(React.createElement(frozen));
  assert.equal(html.replace(">Piso</th>", ">Sitio</th>")
    .replace(">Planta baja</td>", ">Donceles</td>")
    .replace(">Primer piso</td>", ">Donceles</td>"), oldHtml,
  "all DOM, classes, pagination, header, series, amounts and footer must otherwise be identical");
});
test("historical, ambiguous and malformed evidence never use current roll floors", async () => {
  for (const events of [[], [{ datos: {} }], [{ datos: { pisosEntradaVersion: 2, pisosEntrada: evidence } }],
    [{ datos: { pisosEntradaVersion: 1, pisosEntrada: evidence } }, { datos: {} }]]) {
    data = await detail(events);
    assert.ok(data.lineas.every(row => row.pisoEntrada === "Sin evidencia"));
    const html = renderToStaticMarkup(React.createElement(current));
    assert.equal((html.match(/>Sin evidencia<\/td>/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Piso actual reubicado/);
  }
});
test("same product keeps one original row and lists all receipt floors; explicit null is not missing history", () => {
  const sameRolls = rolls.map(r => ({ ...r, productoId: 1 }));
  const sameEvidence = evidence.map(r => ({ ...r, productoId: 1 }));
  assert.equal(entradaFloorLabel(sameRolls, sameEvidence), "Planta baja, Primer piso");
  assert.equal(entradaFloorLabel(sameRolls, sameEvidence.slice(0, 1)), "Planta baja, Sin evidencia");
  assert.equal(entradaFloorLabel([rolls[0]], [{ ...evidence[0], pisoId: null, nombrePiso: null }]), "Sin piso");
  assert.equal(entradaFloorLabel([rolls[0]], [evidence[0], evidence[0]]), "Sin evidencia");
});
test("source delta is exactly the two requested visible replacements; snapshot is in existing creation audit", () => {
  assert.equal(currentSource, frozenSource
    .replace('tracking-wider">Sitio</th>', 'tracking-wider">Piso</th>')
    .replace('{entrada.nombreUbicacion}</td>', '{linea.pisoEntrada || "Sin evidencia"}</td>'));
  assert.match(engine, /pisosEntradaVersion: 1,\s+pisosEntrada,/);
  assert.match(engine, /rolloId: rollo!\.id,\s+productoId: linea.productoId,\s+pisoId: rollo!\.pisoId/);
  load(engine, new Proxy({}, { has: () => true, get: () => new Proxy({}, { get: () => () => null }) }));
});