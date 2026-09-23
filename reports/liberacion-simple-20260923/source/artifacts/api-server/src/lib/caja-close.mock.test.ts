/** OFFLINE: isolate the actual close function text; no imports from pos or DB. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { calculateCash, cashCents, cashMoney } from "./caja-cash-ledger";

const source = readFileSync(new URL("./pos.ts", import.meta.url), "utf8");
const closeSource = source.slice(source.indexOf("export async function cerrarSesionCaja("), source.indexOf("export async function buscarPos("));
const compiled = ts.transpileModule(closeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(failAudit = false) {
  const events: string[] = [];
  const session = { id: 1, estado: "ABIERTA", fondoInicial: "10.00", efectivoContado: null as string | null };
  const desglose = calculateCash([{ origen: "FONDO_INICIAL", id: "1", folio: null, href: null, importe: "10.00" }]);
  let audit: any = null;
  const exports: Record<string, any> = {};
  const tx = {
    select() {
      const chain = {
        from() { return chain; }, where() { return chain; },
        for(lock: string) { events.push(`lock:${lock}`); return chain; },
        async limit() { return [{ ...session }]; },
      };
      return chain;
    },
    update() { return { set(update: any) { return { async where() { events.push("update"); Object.assign(session, update); } }; } }; },
    insert() { return { async values(row: any) { events.push("audit"); if (failAudit) throw new Error("audit failed"); audit = row; } }; },
  };
  vm.runInNewContext(compiled, {
    exports, Date, cashCents, cashMoney, money: (v: string) => Number(cashCents(v)), decimalMoney: (v: number) => cashMoney(BigInt(v)),
    PosError: Error, sesionesCajaTable: { id: "id" }, auditoriaTable: {}, eq: () => null,
    async readSessionCash(_tx: unknown, row: typeof session) {
      events.push(`calculate:${row.estado}`);
      assert.equal(_tx, tx);
      return { efectivoEsperado: "10.00", diferencia: null, efectivoDesglose: desglose };
    },
    async buildCorteCaja(_tx: unknown, id: number) {
      events.push("read-frozen");
      assert.equal(_tx, tx);
      assert.equal(id, 1);
      assert.equal(audit.accion, "CERRAR_CAJA");
      return { efectivoEsperado: audit.datosDespues.cashSnapshot.efectivoDesglose.efectivoEsperado };
    },
  });
  return { events, session, audit: () => audit,
    close: () => exports.cerrarSesionCaja(tx, { sesionId: 1, usuarioId: 2, efectivoContado: "11.00", ip: "offline-test" }) };
}
test("E2 close locks session, calculates before state update and inserts snapshot in existing close audit before final read", async () => {
  const h = harness();
  assert.equal((await h.close()).efectivoEsperado, "10.00");
  assert.deepEqual(h.events, ["lock:update", "calculate:ABIERTA", "update", "audit", "read-frozen"]);
  assert.equal(h.session.estado, "CERRADA");
  const frozen = h.audit().datosDespues.cashSnapshot;
  assert.equal(frozen.version, "E2");
  assert.equal(frozen.sesionId, 1);
  assert.equal(frozen.efectivoContado, "11.00");
  assert.equal(frozen.diferencia, "1.00");
  assert.equal(frozen.efectivoDesglose.documentos.length, 1);
});
test("E2 close audit failure propagates to transaction caller, no successful close reply or frozen read", async () => {
  const h = harness(true);
  await assert.rejects(h.close(), /audit failed/);
  assert.equal(h.events.includes("read-frozen"), false);
  assert.equal(h.audit(), null);
  // Rollback belongs to the real outer transaction, deliberately not simulated
  // as proof of PostgreSQL atomicity or lock scheduling.
});