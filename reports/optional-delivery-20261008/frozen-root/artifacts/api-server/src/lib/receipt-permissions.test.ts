import assert from "node:assert/strict";
import test from "node:test";
import { createE3Router } from "../routes/e3-collections";
import { PgDialect } from "drizzle-orm/pg-core";
import { readE5Document, type E5Sql } from "./e5-repository";
import { e5Capabilities, type E5Actor } from "./e5";

function harness(role: string, site: number | null, allowed = true) {
  const calls: any[] = [];
  let prints = 0;
  const router = createE3Router({
    authenticate(req, _res, next) {
      req.auth = { user: { id: 7, rol: role, ubicacionId: site, alcanceConsulta: "TODAS" } } as any; next();
    },
    permission(module, action) {
      return (_req, res, next) => {
        assert.equal(module, "recibos_abonos"); assert.equal(action, "ver");
        if (!allowed) { res.status(403).json({ error: "denied" }); return; }
        next();
      };
    },
    admin() { throw new Error("Receipt-specific hardcoded role guard"); },
    repository() { throw new Error("Financial repository forbidden"); },
    context() { throw new Error("Financial context forbidden"); },
    async receipts(filter) {
      calls.push(filter);
      return filter.folio === "E3-2-00000001" && filter.sitioId === 1 ? [] : [{ folio: "E3-1-00000001" }] as any;
    },
    async print() { prints++; },
  });
  const request = (url: string, method = "GET") => new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    (router as any).handle({ method, url, headers: {}, query: { sitioId: "2", alcanceConsulta: "TODAS" }, body: { motivo: "Copia" } }, {
      status(code: number) { status = code; return this; },
      json(body: unknown) { resolve({ status, body }); },
    }, reject);
  });
  return { calls, request, prints: () => prints };
}
test("mounted receipt reads and print requests use ver, not role, and force assigned site despite TODAS", async () => {
  for (const role of ["TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "SISTEMAS"]) {
    const h = harness(role, 1);
    assert.equal((await h.request("/caja/recibos-e3")).status, 200);
    assert.equal(h.calls[0].sitioId, 1);
    assert.equal(h.calls[0].soloCaja, true);
    assert.equal((await h.request("/recibos-e3/E3-1-00000001/impresiones", "POST")).status, 200);
    assert.equal(h.prints(), 1);
    assert.equal((await h.request("/recibos-e3/E3-2-00000001/impresiones", "POST")).status, 404);
    assert.equal(h.prints(), 1);
  }
});
test("mounted receipt permission denial and missing assignment do not read or audit", async () => {
  for (const [site, allowed, status] of [[1, false, 403], [null, true, 404]] as const) {
    const h = harness("TERMINAL", site, allowed);
    assert.equal((await h.request("/caja/recibos-e3")).status, status);
    assert.equal((await h.request("/recibos-e3/E3-1-00000001/impresiones", "POST")).status, status);
    assert.equal(h.calls.length, 0); assert.equal(h.prints(), 0);
  }
});
test("ADMIN keeps unrestricted documentary scope", async () => {
  const h = harness("ADMIN", 1);
  assert.equal((await h.request("/caja/recibos-e3")).status, 200);
  assert.equal(h.calls[0].sitioId, undefined);
  assert.equal(h.calls[0].soloCaja, undefined);
});
test("E5 receipt reader forces own site and persisted CAJA proof without granting financial capabilities", async () => {
  const dialect = new PgDialect();
  const detail = { id: "cobro", ubicacionId: 1, reciboId: "recibo", fechaRecepcion: "2026-10-01T12:00:00Z", importePendiente: "10.00" };
  for (const rol of ["TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "SISTEMAS"]) {
    const a: E5Actor = { id: 7, nombre: "Actor sintético", rol, ubicacionId: 1, ip: "", ver: true,
      todas: true, recibos: true, recibirCaja: false, recibirCliente: false, capacidadAE11: false };
    const queries: ReturnType<PgDialect["sqlToQuery"]>[] = [];
    const tx: E5Sql = { async execute(query) {
      queries.push(dialect.sqlToQuery(query));
      if (queries.length === 1) return { rows: [{ detail }] };
      if (queries.length === 2) return { rows: [{ exists: 1 }] };
      return { rows: [{ snapshot: { id: "recibo", tipo: "RECIBO" } }] };
    } };
    assert.equal((await readE5Document(tx, "cobro", "recibo", a, true)).id, "recibo");
    assert.deepEqual(queries[0].params, ["cobro", false, 1]);
    assert.match(queries[1].sql, /accion='RECIBIR'/);
    assert.match(queries[1].sql, /'entrada'='CAJA'/);
    assert.ok(queries.every(q => /^SELECT/.test(q.sql)));
    const caps = e5Capabilities(a);
    assert.equal(caps.puedeRecibir, false);
    assert.equal(caps.puedePreparar, false);
    assert.equal(caps.puedeAutorizar, false);
    assert.equal(caps.puedeDevolver, false);
    const wrongSite: E5Sql = { async execute() { return { rows: [{ detail: { ...detail, ubicacionId: 2 } }] }; } };
    await assert.rejects(readE5Document(wrongSite, "cobro", "recibo", a, true), /no encontrado/);
    let reads = 0;
    const absentProof: E5Sql = { async execute() { return { rows: ++reads === 1 ? [{ detail }] : [] }; } };
    await assert.rejects(readE5Document(absentProof, "cobro", "recibo", a, true), /no encontrado/);
    await assert.rejects(readE5Document(tx, "cobro", "constancia", { ...a, recibos: false }, true), /Sin permiso/);
  }
});