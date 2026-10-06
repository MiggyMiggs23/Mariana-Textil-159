/**
 * Real PostgreSQL + HTTP router + session/module/role middleware.
 * Only run in a prepared disposable actor database. Never cleans audit records:
 * the owner must destroy the disposable cluster after the suite.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { and, eq } from "drizzle-orm";
// @ts-ignore Shared isolated-runner guard is plain ESM.
import { assertActorSuiteEnvironmentSync } from "../../../../lib/db/src/actor-suite-preflight.mjs";

assertActorSuiteEnvironmentSync(process.env);
const {
  db, pool, createTestDatabaseGuard, choferesTable, auditoriaTable,
  usuariosTable, sesionesTable, permisosUsuarioTable,
} = await import("@workspace/db");
const guard = await createTestDatabaseGuard(
  pool, process.env.TEST_DATABASE_URL, process.env.APPLICATION_DATABASE_URL,
);
await guard.assertIsolated();
const { ensureChoferesSchema } = await import("../../../../lib/db/src/lib/choferes-schema");
const { default: router } = await import("./choferes");
const { default: viajesRouter } = await import("./viajes");
const { GetViajesOperationalCatalogResponse } = await import("@workspace/api-zod");

test("choferes HTTP integration: persisted ordered phones, legacy rows, authorization, audit and locks", async (t) => {
  const run = randomUUID().replaceAll("-", "");
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api", router);
  app.use("/api", viajesRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    t.diagnostic(error instanceof Error ? error.message : "Unexpected error");
    if (error instanceof Error && error.cause instanceof Error) t.diagnostic(error.cause.message);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  });
  const server = createServer(app);
  let base = "";
  async function request(method: string, path: string, body?: unknown, cookie?: string) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  }
  async function session(rol: "ADMIN" | "SISTEMAS" | "TERMINAL" | "CAJA" | "SUPERVISOR" | "BODEGA" | "CONTADOR", permit = true) {
    const [user] = await db.insert(usuariosTable).values({
      nombre: `Chofer test ${rol}`, usuario: `${rol.toLowerCase()}_${randomUUID().slice(0, 12)}_${run.slice(0, 8)}`,
      passwordHash: "not-a-login-password", rol, alcanceConsulta: "TODAS",
    }).returning();
    await db.insert(permisosUsuarioTable).values({
      usuarioId: user!.id, modulo: "choferes",
      puedeVer: permit, puedeCrear: permit, puedeEditar: permit, puedeAutorizar: false,
    });
    const id = randomUUID();
    await db.insert(sesionesTable).values({
      id, usuarioId: user!.id, expiraAt: new Date(Date.now() + 60 * 60_000),
      ip: "127.0.0.1", userAgent: "choferes-isolated-test",
    });
    return `mariana_session=${id}`;
  }
  try {
    await ensureChoferesSchema(pool);
    const [legacy] = await db.insert(choferesTable).values({
      nombreCompleto: `Histórico ${run}`, telefono: "001 55 ext. 2",
    }).returning();
    await ensureChoferesSchema(pool);
    assert.equal((await db.select().from(choferesTable).where(eq(choferesTable.id, legacy!.id)))[0]!.telefonos, null);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}/api`;
    const admin = await session("ADMIN");
    const sistemas = await session("SISTEMAS");
    let id: number;
    const phones = [
      { numero: "+52 (55) 000-001", etiqueta: "Móvil" },
      { numero: "001 555 ext. 9", etiqueta: "Oficina" },
      { numero: "00007" },
    ];

    await t.test("legacy list/detail synthesize phones without backfill", async () => {
      const detail = await request("GET", `/choferes/${legacy!.id}`, undefined, admin);
      assert.equal(detail.status, 200);
      assert.deepEqual(detail.body.telefonos, [{ numero: legacy!.telefono }]);
      const list = await request("GET", "/choferes?activo=all", undefined, admin);
      assert.equal(list.status, 200);
      assert.deepEqual(list.body.find((row: any) => row.id === legacy!.id).telefonos, detail.body.telefonos);
      const operational = await request("GET", "/viajes/catalogo-operativo", undefined, admin);
      assert.equal(operational.status, 200);
      // Validate the changed shared Chofer projection only. The pre-existing
      // raw ubicaciones projection omits esSistema and is outside this scope.
      const operationalDrivers = GetViajesOperationalCatalogResponse.shape.choferes.parse(operational.body.choferes);
      assert.deepEqual(operationalDrivers.find((row) => row.id === legacy!.id)!.telefonos, detail.body.telefonos);
      await request("PATCH", `/choferes/${legacy!.id}`, { nombreCompleto: "Renombrado", activo: false }, admin);
      assert.equal((await db.select().from(choferesTable).where(eq(choferesTable.id, legacy!.id)))[0]!.telefonos, null);
    });
    await t.test("create/edit/remove primary persists collection, updates principal and records full audit", async () => {
      const created = await request("POST", "/choferes", {
        nombreCompleto: `Multiple ${run}`, telefono: ` ${phones[0]!.numero} `,
        telefonos: phones.map((phone) => ({ ...phone, numero: ` ${phone.numero} ` })),
      }, sistemas);
      assert.equal(created.status, 201);
      id = created.body.id;
      assert.deepEqual(created.body.telefonos, phones);
      const createdAudit = await db.select().from(auditoriaTable).where(and(
        eq(auditoriaTable.entidad, "choferes"), eq(auditoriaTable.entidadId, String(id)),
      ));
      assert.deepEqual((createdAudit[0]!.datosDespues as any).telefonos, phones);
      const editedPhones = [{ numero: "0008", etiqueta: "Nuevo principal" }, ...phones.slice(1)];
      const edited = await request("PATCH", `/choferes/${id}`, { telefono: "0008", telefonos: editedPhones }, admin);
      assert.equal(edited.status, 200);
      const removed = await request("PATCH", `/choferes/${id}`, {
        telefono: phones[1]!.numero, telefonos: phones.slice(1),
      }, admin);
      assert.equal(removed.status, 200);
      assert.equal(removed.body.telefono, phones[1]!.numero);
      const persisted = (await db.select().from(choferesTable).where(eq(choferesTable.id, id)))[0]!;
      assert.deepEqual(persisted.telefonos, phones.slice(1));
      assert.equal(persisted.telefono, phones[1]!.numero);
      const audit = await db.select().from(auditoriaTable).where(and(
        eq(auditoriaTable.entidad, "choferes"), eq(auditoriaTable.entidadId, String(id)),
      ));
      const removalAudit = audit.find((entry) => (entry.datosAntes as any)?.telefono === "0008")!;
      assert.deepEqual((removalAudit.datosAntes as any).telefonos, editedPhones);
      assert.deepEqual((removalAudit.datosDespues as any).telefonos, phones.slice(1));
      const list = await request("GET", "/choferes", undefined, admin);
      assert.deepEqual(list.body.find((row: any) => row.id === id).telefonos, phones.slice(1),
        "all additional phone/label data survives reload and is available for UI search");
    });
    await t.test("legacy principal-only patch preserves labels/extras; absent phones preserve collection", async () => {
      const updated = await request("PATCH", `/choferes/${id}`, { telefono: "00999" }, admin);
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.body.telefonos, [{ ...phones[1], numero: "00999" }, phones[2]]);
      const status = await request("PATCH", `/choferes/${id}`, { activo: false }, admin);
      assert.deepEqual(status.body.telefonos, updated.body.telefonos);
      const legacyCreated = await request("POST", "/choferes", {
        nombreCompleto: `Legacy client ${run}`, telefono: "00011",
      }, admin);
      assert.equal(legacyCreated.status, 201);
      assert.deepEqual(legacyCreated.body.telefonos, [{ numero: "00011" }]);
    });
    await t.test("invalid writes and conflicting fields cannot persist or audit", async () => {
      const before = (await db.select().from(choferesTable).where(eq(choferesTable.id, id)))[0]!;
      const beforeAudit = await db.select().from(auditoriaTable).where(and(
        eq(auditoriaTable.entidad, "choferes"), eq(auditoriaTable.entidadId, String(id)),
      ));
      for (const body of [
        { telefono: "wrong", telefonos: [{ numero: "other" }] }, { telefonos: [] },
        { telefonos: null }, { telefonos: [{ numero: 999 }] },
        { telefonos: [{ numero: " ".repeat(4) }] }, { telefonos: [{ numero: "x".repeat(33) }] },
        { telefonos: [{ numero: "1", etiqueta: "x".repeat(41) }] },
      ]) assert.equal((await request("PATCH", `/choferes/${id}`, body, admin)).status, 400);
      const after = (await db.select().from(choferesTable).where(eq(choferesTable.id, id)))[0]!;
      assert.deepEqual(after, before);
      assert.deepEqual(await db.select().from(auditoriaTable).where(and(
        eq(auditoriaTable.entidad, "choferes"), eq(auditoriaTable.entidadId, String(id)),
      )), beforeAudit);
      assert.equal((await request("POST", "/choferes", {
        nombreCompleto: "Missing legacy principal", telefonos: [{ numero: "1" }],
      }, admin)).status, 400);
    });
    await t.test("real session/module/role middleware rejects unauthorized writes", async () => {
      assert.equal((await request("GET", "/choferes")).status, 401);
      assert.equal((await request("POST", "/choferes", { nombreCompleto: "X", telefono: "1" })).status, 401);
      for (const role of ["TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "CONTADOR"] as const) {
        const cookie = await session(role);
        assert.equal((await request("POST", "/choferes", { nombreCompleto: "Denied", telefono: "1" }, cookie)).status, 403, role);
        assert.equal((await request("PATCH", `/choferes/${id}`, { telefono: "denied" }, cookie)).status, 403, role);
      }
      const blockedSystems = await session("SISTEMAS", false);
      assert.equal((await request("PATCH", `/choferes/${id}`, { activo: true }, blockedSystems)).status, 403);
    });
    await t.test("legacy patch waits for row lock then preserves newly committed extras/label", async () => {
      const client = await pool.connect();
      let pending: ReturnType<typeof request> | undefined;
      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM choferes WHERE id=$1 FOR UPDATE", [id]);
        pending = request("PATCH", `/choferes/${id}`, { telefono: "new legacy primary" }, admin);
        const deadline = Date.now() + 5_000;
        let waiting = false;
        while (Date.now() < deadline) {
          const result = await pool.query(`SELECT 1 FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock'
            AND query ILIKE '%"choferes"%' AND query ILIKE '%for update%'`);
          if (result.rowCount) { waiting = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.ok(waiting, "real handler must wait at SELECT FOR UPDATE, not read stale data before waiting");
        const concurrent = [{ numero: "concurrent", etiqueta: "Fresh label" }, { numero: "fresh extra" }];
        await client.query("UPDATE choferes SET telefono=$1, telefonos=$2::jsonb WHERE id=$3",
          [concurrent[0]!.numero, JSON.stringify(concurrent), id]);
        await client.query("COMMIT");
        const response = await pending;
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.telefonos, [{ ...concurrent[0], numero: "new legacy primary" }, concurrent[1]]);
      } finally {
        await client.query("ROLLBACK");
        client.release();
        if (pending) await pending;
      }
    });
    await t.test("audit insertion failure rolls back phone edit", async () => {
      assert.ok(id, "creation must have persisted a real driver before rollback is tested");
      const before = (await db.select().from(choferesTable).where(eq(choferesTable.id, id)))[0]!;
      // A test-only trigger in the guarded disposable DB; always removed.
      await pool.query(`CREATE FUNCTION choferes_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'test audit failure'; END $$;
        CREATE TRIGGER choferes_test_reject_audit BEFORE INSERT ON auditoria FOR EACH ROW
        WHEN (NEW.entidad='choferes' AND NEW.datos_despues->>'telefono'='reject-audit')
        EXECUTE FUNCTION choferes_test_reject_audit();`);
      try {
        assert.equal((await request("PATCH", `/choferes/${id}`, { telefono: "reject-audit" }, admin)).status, 500);
        const after = (await db.select().from(choferesTable).where(eq(choferesTable.id, id)))[0]!;
        assert.deepEqual(after, before);
      } finally {
        await pool.query("DROP TRIGGER choferes_test_reject_audit ON auditoria; DROP FUNCTION choferes_test_reject_audit();");
      }
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") reject(error);
      else resolve();
    }));
    await pool.end();
  }
});