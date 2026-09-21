import assert from "node:assert/strict";
import test from "node:test";
import { confirmE3, previewE3, parseE3Input, e3Evidence, assertE3DirectedExact, validateE3Receipt,
  type E3Input, type E3Receipt, type E3Repository, type E3State, type E3Transaction } from "./e3-collection";
import { createE3Router } from "../routes/e3-collections";
import type { CreditLedgerMovement } from "./credit-allocation";
import { e3ContextSite } from "./e3-context";
import { legacyPaymentCaptureGuard } from "./e3-legacy-capture";
import { Router } from "express";

const now = new Date("2026-09-21T19:00:00Z");
const actor = { id: 7, rol: "CAJA" };
const input: E3Input = {
  clienteId: 1, importeCentavos: 35000, formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
  sitioId: 2, sesionCajaId: 5, operacionClave: "00000000-0000-4000-8000-000000000001",
};
function store(movements: CreditLedgerMovement[] = []) {
  let state: E3State = { clienteNombre: "Cliente de prueba", clienteTelefono: "5550100", clienteRfc: null,
    sitioNombre: "Centro", actorNombre: "Cajera de prueba", movements };
  let rows: { key: string; intentHash: string; receipt: E3Receipt }[] = [];
  let writes = 0, allocations = 0;
  let previews: { key: string; token: string; actorId: number; at: Date; intentHash: string }[] = [];
  let counters: Record<number, number> = {};
  let serial = Promise.resolve();
  const repo: E3Repository = {
    async transaction(work) {
      const previous = serial;
      let unlock!: () => void;
      serial = new Promise<void>(r => { unlock = r; });
      await previous;
      const checkpoint = structuredClone({ state, rows, writes, allocations, previews, counters });
      const tx: E3Transaction = {
        async lockAndLoad() { return structuredClone(state); },
        async findReceipt(key) { return structuredClone(rows.find(r => r.key === key) ?? null); },
        async findPreview(key) { return previews.find(p => p.key === key) ?? null; },
        async savePreview(key, token, actorId, at, intentHash) { previews = [...previews.filter(p => p.key !== key), { key, token, actorId, at, intentHash }]; },
        async allocateFolio(site) { counters[site] = (counters[site] ?? 0) + 1; return `E3-${site}-${String(counters[site]).padStart(8, "0")}`; },
        async hasPreview(key, token, actorId, at) { return previews.some(p => p.key === key && p.token === token && p.actorId === actorId && +at - +p.at <= 600000); },
        async insertMovement(i, _e, at) {
          writes++;
          const id = 100 + writes;
          state.movements.push({ id, ticketId: null, tipo: "ABONO", importe: (-i.importeCentavos / 100).toFixed(2), createdAt: at });
          return id;
        },
        async saveAllocations(_id, list) { allocations += list.length; },
        async saveReceipt(key, intentHash, receipt) { rows.push(structuredClone({ key, intentHash, receipt })); },
      };
      try { return await work(tx); }
      catch (error) { ({ state, rows, writes, allocations, previews, counters } = checkpoint); throw error; }
      finally { unlock(); }
    },
  };
  return { repo, mutate: (movement: CreditLedgerMovement) => state.movements.push(movement),
    rename: () => { state.actorNombre = "Nuevo nombre"; state.sitioNombre = "Otra tienda"; state.clienteNombre = "Cliente renombrado"; },
    stats: () => ({ writes, allocations, counters: { ...counters }, rows: structuredClone(rows) }) };
}
const sales = (): CreditLedgerMovement[] => [1, 2, 3].map(id => ({
  id, ticketId: id + 10, folio: id, tipo: "VENTA_CREDITO", importe: "100.00", createdAt: new Date(`2026-09-0${id}T12:00:00Z`),
}));
test("E3-01 FIFO three notes, excess and advance preserve receipt allocation", async () => {
  const s = store(sales());
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  assert.deepEqual(p.asignaciones.map(a => a.aplicadoCentavos), [10000, 10000, 10000]);
  assert.equal(p.remanenteCentavos, 5000);
  assert.equal(p.saldoAFavorCentavos, 5000);
  assert.equal(p.deudaCentavos, 0);
  const result = await confirmE3(s.repo, { ...input, previewToken: p.previewToken }, "CAJA", actor, now);
  assert.deepEqual(result.recibo.asignaciones, p.asignaciones);
  assert.equal(s.stats().allocations, 3);
  const advance = await previewE3(store().repo, input, "CAJA", actor, now);
  assert.equal(advance.saldoAFavorCentavos, 35000);
  assert.equal(advance.remanenteCentavos, 35000);
});
test("E3-02 stale preview rejects note paid during wait without writes", async () => {
  const s = store(sales());
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  s.mutate({ id: 80, tipo: "ABONO", ticketId: null, importe: "-300.00", createdAt: new Date("2026-09-20T12:00:00Z") });
  await assert.rejects(confirmE3(s.repo, { ...input, previewToken: p.previewToken }, "CAJA", actor, now), /nueva vista previa/);
  assert.equal(s.stats().writes, 0);
});
test("E3-03 simultaneous retry one movement, immutable snapshot, conflicting UUID rejected", async () => {
  const s = store(sales());
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  const body = { ...input, previewToken: p.previewToken };
  const results = await Promise.all([confirmE3(s.repo, body, "CAJA", actor, now), confirmE3(s.repo, body, "CAJA", actor, now)]);
  assert.deepEqual(results.map(r => r.replay), [false, true]);
  assert.deepEqual(results[0].recibo, results[1].recibo);
  assert.equal(s.stats().writes, 1);
  await assert.rejects(confirmE3(s.repo, { ...body, importeCentavos: 34999 }, "CAJA", actor, now), /otra intención/);
});
test("E3-04 recapture mandatory reason and historical instant, no nature injection, no Caja", () => {
  const recapture = { ...input, sesionCajaId: null, motivo: "Recaptura pago previo", fechaRecepcion: "2026-09-15T12:00:00-06:00" };
  const parsed = parseE3Input(recapture, "RECAPTURA", now);
  assert.equal(e3Evidence(parsed, "RECAPTURA").naturaleza, "CORRECCION_CONTABLE");
  assert.equal(e3Evidence(parsed, "RECAPTURA").sesionCajaId, null);
  assert.throws(() => parseE3Input({ ...recapture, motivo: "" }, "RECAPTURA", now));
  assert.throws(() => parseE3Input({ ...recapture, sesionCajaId: 5 }, "RECAPTURA", now));
  assert.throws(() => parseE3Input(recapture, "CAJA", now));
  assert.throws(() => parseE3Input({ ...input, naturaleza: "CORRECCION_CONTABLE" }, "CAJA", now));
});
test("E3-05 bank transfer keeps operational session but never E1 cash attribution", () => {
  const transfer = parseE3Input({ ...input, formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL" }, "CAJA", now);
  assert.equal(transfer.sesionCajaId, 5);
  assert.equal(e3Evidence(transfer, "CAJA").sesionCajaId, null);
  assert.equal(e3Evidence(transfer, "CAJA").naturaleza, "INGRESO_FISICO");
  assert.throws(() => parseE3Input({ ...transfer, sesionCajaId: null }, "CAJA", now));
});
test("E3-06 P6 nonADMIN exact only and no paid target", () => {
  assert.doesNotThrow(() => assertE3DirectedExact(false, 30000, [10000, 20000]));
  assert.throws(() => assertE3DirectedExact(false, 29999, [10000, 20000]));
  assert.throws(() => assertE3DirectedExact(false, 30001, [10000, 20000]));
  assert.throws(() => assertE3DirectedExact(false, 10000, [10000, 0]));
});
test("E3-07 incomplete historic receipt explains fields, no inferred balance", async () => {
  const s = store();
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  const result = await confirmE3(s.repo, { ...input, previewToken: p.previewToken }, "CAJA", actor, now);
  assert.equal(validateE3Receipt(result.recibo).folio, result.recibo.folio);
  const { saldoAFavorCentavos: _missing, ...partial } = result.recibo;
  assert.throws(() => validateE3Receipt(partial), /saldoAFavorCentavos/);
});
test("E3-08 mounted router gate blocks every new path before auth or repository", async () => {
  let touched = 0;
  const deny = (_req: any, res: any) => { touched++; res.status(403).json({ error: "denied" }); };
  const router = createE3Router({
    authenticate: deny, permission: () => deny, admin: deny,
    repository: () => { touched++; throw new Error("database forbidden"); },
    receipts: async () => { touched++; return []; }, print: async () => { touched++; },
    context: async () => { touched++; return { sitios: [], clientes: [] }; },
  });
  for (const [method, url] of [
    ["POST", "/caja/abonos-e3/vista-previa"], ["POST", "/caja/abonos-e3"],
    ["GET", "/caja/abonos-e3/contexto"],
    ["POST", "/clientes/1/recapturas-e3/vista-previa"], ["POST", "/clientes/1/recapturas-e3"],
    ["GET", "/recibos-e3/E3-00000000-0000-4000-8000-000000000001"],
    ["GET", "/clientes/1/recibos-e3"], ["GET", "/caja/recibos-e3?sesionCajaId=5"],
    ["POST", "/recibos-e3/E3-00000000-0000-4000-8000-000000000001/impresiones"],
  ]) {
    const response = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      let status = 200;
      (router as any).handle({ method, url, headers: {}, body: {} }, {
        status(code: number) { status = code; return this; },
        json(body: unknown) { resolve({ status, body }); },
      }, reject);
    });
    assert.equal(response.status, 423);
    assert.equal(response.body.code, "E3_CLOSED");
  }
  assert.equal(touched, 0);
});
test("E3-10 preview UUID cannot invalidate another actor or changed intention", async () => {
  const s = store();
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  await assert.rejects(previewE3(s.repo, input, "CAJA", { id: 8, rol: "CAJA" }, now), /otro actor o intención/);
  await assert.rejects(previewE3(s.repo, { ...input, importeCentavos: 34000 }, "CAJA", actor, now), /otro actor o intención/);
  const first = await confirmE3(s.repo, { ...input, previewToken: p.previewToken }, "CAJA", actor, now);
  assert.equal(first.recibo.actorId, 7);
});
test("E3-11 lookup scope denies cross-site and unassigned cashier while ADMIN can select", () => {
  assert.equal(e3ContextSite({ rol: "CAJA", ubicacionId: 2 }), 2);
  assert.throws(() => e3ContextSite({ rol: "CAJA", ubicacionId: 2 }, 3), /sitio asignado/);
  assert.throws(() => e3ContextSite({ rol: "CAJA", ubicacionId: null }), /sitio asignado/);
  assert.equal(e3ContextSite({ rol: "ADMIN", ubicacionId: null }, 3), 3);
});
test("E3-12 receipt freezes human identity names and contact across later renames", async () => {
  const s = store();
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  const body = { ...input, previewToken: p.previewToken };
  const first = await confirmE3(s.repo, body, "CAJA", actor, now);
  assert.equal(first.recibo.actorNombre, "Cajera de prueba");
  assert.equal(first.recibo.sitioNombre, "Centro");
  assert.equal(first.recibo.clienteTelefono, "5550100");
  s.rename();
  assert.deepEqual((await confirmE3(s.repo, body, "CAJA", actor, now)).recibo, first.recibo);
});
test("E3-13 per-site receipt counter increments only on new collection not replay", async () => {
  const s = store();
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  const body = { ...input, previewToken: p.previewToken };
  const first = await confirmE3(s.repo, body, "CAJA", actor, now);
  assert.equal(first.recibo.folio, "E3-2-00000001");
  await confirmE3(s.repo, body, "CAJA", actor, now);
  assert.equal(s.stats().counters[2], 1);
  const next = { ...input, operacionClave: "00000000-0000-4000-8000-000000000002" };
  const p2 = await previewE3(s.repo, next, "CAJA", actor, now);
  assert.equal((await confirmE3(s.repo, { ...next, previewToken: p2.previewToken }, "CAJA", actor, now)).recibo.folio, "E3-2-00000002");
});
test("E3-14 legacy preview and confirmation cannot bypass recapture permission when E3 opens", async () => {
  for (const enabled of [false, true]) {
    let reachedLegacy = 0;
    const router = Router();
    for (const path of ["/clientes/:id/pagos/vista-previa", "/clientes/:id/pagos"]) {
      router.post(path, legacyPaymentCaptureGuard(enabled), (_req, res) => { reachedLegacy++; res.json({ legacy: true }); });
    }
    for (const url of ["/clientes/1/pagos/vista-previa", "/clientes/1/pagos"]) {
      // Legacy preview can omit nature: it must not become an alternative path.
      for (const body of [{ importe: 25000 }, { importe: 25000, naturaleza: "CORRECCION_CONTABLE" }]) {
        const response = await new Promise<{ status: number; body: any }>((resolve, reject) => {
          let status = 200;
          (router as any).handle({ method: "POST", url, headers: {}, body }, {
            status(code: number) { status = code; return this; },
            json(body: unknown) { resolve({ status, body }); },
          }, reject);
        });
        assert.equal(response.status, enabled ? 409 : 200);
        if (enabled) assert.equal(response.body.code, "E3_DEDICATED_CAPTURE_REQUIRED");
      }
    }
    assert.equal(reachedLegacy, enabled ? 0 : 4);
  }
});
test("E3-09 mandatory server-issued preview rejects forged token and expired issuance", async () => {
  const s = store(sales());
  const p = await previewE3(s.repo, input, "CAJA", actor, now);
  const other = store(sales());
  await assert.rejects(confirmE3(other.repo, { ...input, previewToken: p.previewToken }, "CAJA", actor, now), /no fue emitida/);
  await assert.rejects(confirmE3(s.repo, { ...input, previewToken: p.previewToken }, "CAJA", actor, new Date(+now + 660000)), /venció/);
  assert.equal(s.stats().writes + other.stats().writes, 0);
});