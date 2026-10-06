import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Request, Response, NextFunction } from "express";

// Never allow this in-memory handler suite to opt into a real database.
if (process.env.TEST_DATABASE_URL || process.env.REQUIRE_ISOLATED_TEST_DATABASE === "1") {
  throw new Error("Run choferes.test.ts without an isolated DB; use the integration suite for PostgreSQL.");
}
process.env.NODE_ENV = "test";
const { db, pool, choferesTable, auditoriaTable } = await import("@workspace/db");
const { default: router } = await import("./choferes");
const { CreateChoferBody, UpdateChoferBody, ListChoferesResponse } = await import("@workspace/api-zod");

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
function handlers(method: string, path: string): Handler[] {
  const layer = (router as unknown as {
    stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: Handler }[] } }[];
  }).stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(layer?.route);
  return layer.route.stack.map((entry) => entry.handle);
}
async function call(handler: Handler, body: unknown, rol = "ADMIN") {
  let status = 200;
  let result: any;
  let passed = false;
  const req = {
    body, params: { id: "1" }, query: {}, headers: {}, ip: "127.0.0.1",
    auth: { user: { id: 1, rol } },
  } as unknown as Request;
  const res = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { result = value; return this; },
  } as unknown as Response;
  await handler(req, res, ((error?: unknown) => {
    if (error) throw error;
    passed = true;
  }) as NextFunction);
  return { status, body: result, passed };
}

test("real chofer handlers: normalization, ordered updates, legacy preservation and complete audits", async () => {
  let row: any = {
    id: 1, nombreCompleto: "Histórico", telefono: "001", telefonos: null,
    activo: true, createdAt: new Date(), updatedAt: new Date(),
  };
  const audits: any[] = [];
  let locked = false;
  let inTransaction = false;
  const tx = {
    select() {
      const query = {
        from() { return query; }, where() { return query; }, limit() { return query; },
        for(mode: string) { assert.equal(mode, "update"); locked = true; return Promise.resolve([structuredClone(row)]); },
      };
      return query;
    },
    insert(table: unknown) {
      assert.ok(inTransaction);
      return { values(value: any) {
        if (table === auditoriaTable) { audits.push(structuredClone(value)); return Promise.resolve(); }
        assert.equal(table, choferesTable);
        row = { ...row, ...value };
        return { returning: async () => [row] };
      } };
    },
    update(table: unknown) {
      assert.equal(table, choferesTable);
      assert.ok(locked, "update must follow SELECT FOR UPDATE");
      return { set(value: any) {
        row = { ...row, ...Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) };
        return { where() { return { returning: async () => [row] }; } };
      } };
    },
  };
  const transaction = mock.method(db, "transaction", async (fn: (tx: unknown) => unknown) => {
    inTransaction = true;
    locked = false;
    try { return await fn(tx); } finally { inTransaction = false; }
  });
  const post = handlers("post", "/choferes").at(-1)!;
  const patch = handlers("patch", "/choferes/:id").at(-1)!;
  try {
    const phones = [{ numero: " 001 ", etiqueta: " Móvil " }, { numero: "+52 (55) 02 ext. 3" }];
    const created = await call(post, { nombreCompleto: " Ana ", telefono: " 001 ", telefonos: phones });
    assert.equal(created.status, 201);
    assert.equal(created.body.nombreCompleto, "Ana");
    assert.deepEqual(created.body.telefonos, [{ numero: "001", etiqueta: "Móvil" }, phones[1]]);
    const old = structuredClone(row);
    await call(patch, { telefono: " 0002 " });
    assert.deepEqual(row.telefonos, [{ numero: "0002", etiqueta: "Móvil" }, phones[1]]);
    assert.equal(row.telefono, "0002");
    assert.deepEqual(audits.at(-1).datosAntes.telefonos, old.telefonos);
    assert.deepEqual(audits.at(-1).datosDespues.telefonos, row.telefonos);
    const stable = structuredClone(row.telefonos);
    await call(patch, { nombreCompleto: "Nombre", activo: false });
    assert.deepEqual(row.telefonos, stable);
    const removed = await call(patch, { telefonos: [phones[1]] });
    assert.equal(removed.body.telefono, phones[1]!.numero);
    assert.deepEqual(removed.body.telefonos, [phones[1]]);
    const many = Array.from({ length: 120 }, (_, i) => ({ numero: `00${i}` }));
    assert.equal((await call(patch, { telefonos: many })).status, 200);
    assert.equal(row.telefonos.length, 120, "no arbitrary array count cap");
    row = { ...row, telefono: "legacy", telefonos: null };
    const legacyEdit = await call(patch, { activo: true });
    assert.deepEqual(legacyEdit.body.telefonos, [{ numero: "legacy" }]);
    assert.equal(row.telefonos, null, "unrelated edit must not backfill");
    await call(patch, { telefono: "new legacy" });
    assert.deepEqual(row.telefonos, [{ numero: "new legacy" }]);
  } finally {
    transaction.mock.restore();
  }
});

test("real handlers reject invalid/empty/null/conflicting phones without starting a transaction", async () => {
  const transaction = mock.method(db, "transaction", () => { throw new Error("Unexpected persistence"); });
  const post = handlers("post", "/choferes").at(-1)!;
  const patch = handlers("patch", "/choferes/:id").at(-1)!;
  try {
    for (const body of [
      { telefonos: [] }, { telefono: "1", telefonos: [] },
      { telefonos: null }, { telefonos: [{ numero: "" }] },
      { telefonos: [{ numero: "   " }] }, { telefonos: [{ numero: 123 }] },
      { telefonos: [{ numero: "x".repeat(33) }] },
      { telefonos: [{ numero: "1", etiqueta: "x".repeat(41) }] },
      { telefonos: [{ numero: "1", etiqueta: " " }] },
      { telefono: "1", telefonos: [{ numero: "2" }] }, { telefono: 123 },
      { telefono: " " }, {},
    ]) assert.equal((await call(patch, body)).status, 400, JSON.stringify(body));
    assert.equal((await call(post, { nombreCompleto: "Ana", telefonos: [{ numero: "1" }] })).status, 400,
      "legacy telefono remains required on create");
    assert.equal((await call(post, { nombreCompleto: "Ana", telefono: "1", telefonos: [] })).status, 400);
    assert.equal(transaction.mock.callCount(), 0);
  } finally { transaction.mock.restore(); }
});

test("immutable role guard rejects every non-manager, even with module permission", async () => {
  for (const method of ["post", "patch"]) {
    const stack = handlers(method, method === "post" ? "/choferes" : "/choferes/:id");
    for (const role of ["TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "CONTADOR"]) {
      assert.equal((await call(stack[1]!, {}, role)).status, 403);
    }
    for (const role of ["ADMIN", "SISTEMAS"]) {
      assert.equal((await call(stack[1]!, {}, role)).passed, true);
    }
  }
});

test("generated contract requires response phones, keeps request phones optional and create principal required", () => {
  assert.ok(CreateChoferBody.safeParse({ nombreCompleto: "Ana", telefono: "001" }).success);
  assert.ok(UpdateChoferBody.safeParse({ activo: false }).success);
  assert.equal(CreateChoferBody.safeParse({ nombreCompleto: "Ana", telefonos: [{ numero: "001" }] }).success, false);
  const legacy = {
    id: 1, nombreCompleto: "Ana", telefono: "001", activo: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  assert.equal(ListChoferesResponse.safeParse([legacy]).success, false);
  assert.ok(ListChoferesResponse.safeParse([{ ...legacy, telefonos: [{ numero: "001" }] }]).success);
});

test.after(async () => { await pool.end(); });