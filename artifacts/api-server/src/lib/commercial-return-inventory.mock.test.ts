import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source = readFileSync(new URL("./inventario.ts", import.meta.url), "utf8");
const candidate = source.slice(source.indexOf("export async function recibirDevolucionComercial("), source.indexOf("export async function venderRollo("));
const compiled = ts.transpileModule(candidate, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
function harness(overrides: Record<string, unknown> = {}, amount = "10.000") {
  const roll = { id: 2, productoId: 3, ubicacionId: 4, estado: "VENDIDO", cantidadActual: "0.000", serie: "10000002" };
  const sale = { id: 5, tipo: "VENTA", documentoId: "6", documentoTipo: "TICKET_BOLSA_NORMAL", cantidad: "-10.000", ...overrides };
  const writes: Record<string, unknown>[] = [];
  const refreshed: number[] = [];
  const tables = { rollosTable: { name: "roll", id: 2 }, movimientosTable: { name: "movement", rolloId: 2, id: 5 } };
  const tx = {
    select() {
      let name = "";
      const chain = {
        from(t: { name: string }) { name = t.name; return chain; },
        where() { return chain; }, for() { return chain; }, orderBy() { return chain; }, limit() { return chain; },
        then(resolve: (rows: unknown[]) => unknown) { return Promise.resolve([name === "roll" ? roll : sale]).then(resolve); },
      };
      return chain;
    },
    update() { return { set(value: Record<string, unknown>) { return { async where() { writes.push(value); } }; } }; },
  };
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled, {
    exports, ...tables, eq: () => null, desc: () => null,
    InventarioError: Error, lockInventoryPairs: async () => {},
    assertNoActiveVentaClienteReservation: async () => {},
    quantityToThousandthsBigInt: (v: string) => BigInt(v.replace(".", "")),
    DOCUMENTO_TICKET_BOLSA_NORMAL: "TICKET_BOLSA_NORMAL", DOCUMENTO_TICKET_PIEZA_NORMAL: "TICKET_PIEZA_NORMAL",
    physicalRollState: (value: unknown) => value,
    insertMovimiento: async (_tx: unknown, value: Record<string, unknown>) => { writes.push(value); return value; },
    refreshCache: async (_tx: unknown, _product: number, site: number) => { refreshed.push(site); },
  });
  return { writes, refreshed, run: () => exports.recibirDevolucionComercial(tx, {
    rolloId: 2, ticketId: 6, ubicacionId: 7, cantidad: amount, usuarioId: 8,
    id: "return-id", motivo: "Completo",
  }) };
}
test("actual inventory helper preserves series, restores exact sold bags, adds NEW receiving-site movement and refreshes both sites", async () => {
  const h = harness();
  const movement = await h.run();
  assert.equal(movement.tipo, "DEVOLUCION");
  assert.equal(movement.documentoTipo, "DEVOLUCION_COMERCIAL");
  assert.equal(movement.ubicacionId, 7);
  assert.equal(movement.movimientoOrigenId, undefined);
  assert.equal(h.writes[0]!.serie, undefined);
  assert.equal(h.writes[0]!.cantidadActual, "10.000");
  assert.deepEqual(h.refreshed, [4, 7]);
});
test("actual inventory helper blocks partial quantity, different sale and non-sale latest movement before writes", async () => {
  for (const h of [harness({}, "9.000"), harness({ documentoId: "99" }), harness({ tipo: "AJUSTE" }),
    harness({ documentoTipo: "TICKET_BOLSA_METREADO" })]) {
    await assert.rejects(h.run(), /rollo completo/);
    assert.equal(h.writes.length, 0);
  }
});