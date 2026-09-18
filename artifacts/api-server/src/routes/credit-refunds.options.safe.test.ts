// Offline allowlist only: Node, TypeScript transpiler and pure E1/E2 contracts.
// Route evaluated in VM; no real Express, DB, auth middleware or app import.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as contract from "../lib/credit-refund-contract";
import * as evidence from "../lib/credit-evidence-contract";
const source = readFileSync(new URL("./credit-refunds.ts", import.meta.url), "utf8");
const key = "20000000-0000-4000-8000-000000000001";
async function run(options: { role?: string; active?: boolean; id?: string; noCustomer?: boolean;
  noSources?: boolean; mutate?: string; auth?: boolean; restrictSessionSite?: boolean } = {}) {
  const registered: any[] = [];
  const queries: string[] = [];
  const permissions: string[] = [];
  const candidates = [
    { origen: "ABONO", abonoId: 3, cobroClave: null, folio: 1010, referencia: null, importe: "25.00", sitioOrigenId: 2, sitioNombre: "Sitio real" },
    { origen: "COBRO_RETENIDO", abonoId: null, cobroClave: key, folio: null, referencia: "Transferencia no: cobro efectivo original", importe: "30.00", sitioOrigenId: 2, sitioNombre: "Sitio real" },
  ];
  const session = { id: 44, sitioOrigenId: 7, sitioNombre: "Otra tienda real", abiertaAt: "2026-09-18T14:00:00.000Z" };
  const dependencies: Record<string, unknown> = {
    express: { Router: () => ({
      get(...args: any[]) { registered.push(args); }, post() {},
    }) },
    "drizzle-orm": { sql: (strings: TemplateStringsArray, ...params: unknown[]) => ({ text: strings.join("?"), params }) },
    "@workspace/db": { db: { async execute(q: { text: string; params: any[] }) {
      queries.push(q.text);
      // Hard fail on any mutation or access to unapplied E2 tables.
      assert.doesNotMatch(q.text, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|CALL)\b|evidencia_no_aplicada_e2|disposiciones_credito_e2|devoluciones_credito_e2/i);
      if (q.text.includes("FROM usuarios")) {
        assert.deepEqual(q.params, [9]);
        return { rows: [{ activo: options.active ?? true, rol: options.role ?? "ADMIN" }] };
      }
      if (q.text.includes("FROM clientes")) {
        assert.deepEqual(q.params, [1]);
        return { rows: options.noCustomer ? [] : [{ id: 1 }] };
      }
      if (q.text.includes("UNION ALL")) {
        // Query-aware fixture adapter: every invariant must be carried by the
        // actual route query, never silently supplied by this mock.
        for (const clause of ["m.cliente_id=?", "c.cliente_id=?", "m.tipo='ABONO'",
          "m.naturaleza='INGRESO_FISICO'", "m.forma_pago='EFECTIVO'", "m.cuenta_destino='CAJA_FISICA'",
          "m.sesion_caja_id IS NOT NULL", "c.operacion_productor='COBRO_PENDIENTE'",
          "c.naturaleza='INGRESO_FISICO'", "c.medio='EFECTIVO'", "c.cuenta_destino='CAJA_FISICA'",
          "c.sesion_caja_id IS NOT NULL", "m.importe<0", "c.importe>0"]) {
          assert.ok(q.text.includes(clause), `missing query invariant: ${clause}`);
        }
        assert.deepEqual(q.params, [1, 1]);
        return { rows: options.noSources ? [] : candidates };
      }
      if (q.text.includes("FROM sesiones_caja")) {
        for (const clause of ["u.activa", "u.tipo='TIENDA'", "s.estado='ABIERTA'",
          "s.cerrada_at IS NULL", "s.fecha_operativa=(transaction_timestamp() AT TIME ZONE 'America/Mexico_City')::date"]) {
          assert.ok(q.text.includes(clause), `missing session invariant: ${clause}`);
        }
        assert.doesNotMatch(q.text, /s\.ubicacion_id\s*=\s*(ANY|[0-9?])/);
        assert.equal(JSON.stringify(q.params), "[]");
        return { rows: [session] };
      }
      throw new Error("Unapproved read query");
    } } },
    "../middlewares/auth": { requireSession: "authenticated" },
    "../lib/permisos": { requierePermiso(module: string, action: string) {
      permissions.push(`${module}:${action}`); return `${module}:${action}`;
    } },
    "../lib/credit-refund-contract": contract,
    "../lib/credit-evidence-contract": evidence,
    "../lib/credit-refund": { refundCreditReceipt() { throw new Error("GET cannot call write service"); } },
  };
  let isolated = source;
  if (options.mutate) {
    assert.ok(isolated.includes(options.mutate));
    isolated = isolated.replace(options.mutate, "");
  }
  if (options.restrictSessionSite) isolated = isolated.replace("WHERE s.estado='ABIERTA'", "WHERE s.ubicacion_id=2 AND s.estado='ABIERTA'");
  const compiled = ts.transpileModule(isolated, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(compiled, { exports: {}, require(name: string) {
    if (!(name in dependencies)) throw new Error(`Forbidden import: ${name}`);
    return dependencies[name];
  } });
  assert.equal(registered.length, 1);
  const [path, auth, read, authorize, handler] = registered[0];
  assert.equal(path, "/clientes/:id/devoluciones-credito/opciones");
  assert.deepEqual([auth, read, authorize], ["authenticated", "clientes_finanzas:ver", "clientes_finanzas:autorizar"]);
  let status: number | undefined;
  let body: any;
  let error: any;
  const res = { status(value: number) { status = value; return res; }, json(value: any) { body = value; } };
  await handler({ params: { id: options.id ?? "1" }, auth: options.auth === false ? undefined : { user: { id: 9, rol: "ADMIN" } } },
    res, (value: any) => { error = value; });
  return { status, body, error, queries, candidates, session, permissions };
}
test("GET returns original ABONO/retained documents and today's cash in a different store, always inactive", async () => {
  const r = await run();
  assert.ifError(r.error);
  assert.equal(r.status, 200);
  assert.equal(r.body.enabled, false);
  assert.equal(r.body.advertencia, contract.CREDIT_REFUND_OPTIONS_WARNING);
  assert.equal(r.body.motivoInactivo, contract.CREDIT_REFUND_INACTIVE_COPY);
  assert.equal(JSON.stringify(r.body.candidatas), JSON.stringify(r.candidates));
  assert.equal(JSON.stringify(r.body.sesiones), JSON.stringify([r.session]));
  assert.notEqual(r.body.sesiones[0].sitioOrigenId, r.body.candidatas[0].sitioOrigenId);
  assert.equal(r.queries.length, 4);
});
test("GET rechecks actual ADMIN/active; rejects unauthenticated/invalid/missing customer before source reads", async () => {
  for (const [options, status, reads] of [
    [{ role: "CAJA" }, 403, 1], [{ active: false }, 403, 1],
    [{ auth: false }, 401, 0], [{ id: "no" }, 400, 0],
    [{ noCustomer: true }, 404, 2],
  ] as const) {
    const r = await run(options);
    assert.equal(r.error?.status, status);
    assert.equal(r.queries.length, reads);
    assert.equal(r.body, undefined);
  }
});
test("empty documents still return independently existing open sessions, never invent evidence", async () => {
  const r = await run({ noSources: true });
  assert.ifError(r.error);
  assert.equal(r.body.candidatas.length, 0);
  assert.equal(JSON.stringify(r.body.sesiones), JSON.stringify([r.session]));
  assert.equal(r.queries.length, 4);
});
test("negative copies removing customer/physical/date/site filters fail query safety assertions", async () => {
  for (const mutate of ["m.cliente_id=${clienteId} AND ", "c.cliente_id=${clienteId} AND ",
    "m.forma_pago='EFECTIVO'", "c.medio='EFECTIVO'", "s.estado='ABIERTA'", "s.cerrada_at IS NULL",
    "s.fecha_operativa=(transaction_timestamp() AT TIME ZONE 'America/Mexico_City')::date"]) {
    const r = await run({ mutate });
    assert.match(String(r.error), /missing .*invariant/);
    assert.equal(r.body, undefined);
  }
});
test("negative copy skipping current role check exposes stale-role failure", async () => {
  const r = await run({ role: "CAJA", mutate: ' || actor.rows[0].rol !== "ADMIN"' });
  assert.equal(r.status, 200);
  assert.throws(() => assert.equal(r.error?.status, 403));
});
test("negative copy restricting today's sessions to receipt site fails cross-store query contract", async () => {
  const r = await run({ restrictSessionSite: true });
  assert.ok(r.error);
  assert.equal(r.body, undefined);
  assert.match(String(r.error), /not match/);
});