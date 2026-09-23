import assert from "node:assert/strict";
import test from "node:test";

// Autorización: reports/tanda-d-20260923/autorizacion.txt tarea 1.
// Sin app, servidor ni conexión al destino real. Solo PostgreSQL desechable local.
const url = new URL(process.env.TEST_DATABASE_URL ?? "http://invalid");
const application = new URL(process.env.APPLICATION_DATABASE_URL ?? "http://invalid");
if (process.env.NODE_ENV !== "test" || url.hostname !== "127.0.0.1" ||
    application.hostname !== "127.0.0.1" || !url.pathname.startsWith("/tarea1_test_") ||
    url.port !== application.port || url.pathname === application.pathname) {
  throw new Error("Se requiere PostgreSQL local desechable tarea1_test_* y testigo local distinto.");
}

test("matriz real, marca/retiro ADMIN, motivo, rollback auditado y candado de venta", async () => {
  const { db, pool } = await import("@workspace/db");
  const { createRemateStore } = await import("./lib/tarea4-remate-store");
  const { createMarkRemateHandler } = await import("./lib/tarea4-remate");
  const { decideRemateSale } = await import("./lib/tarea4-remate-sale");
  const { resolvePermiso } = await import("./lib/permisos");
  try {
    await pool.query(`INSERT INTO usuarios(id,ubicacion_id) VALUES (1,1),(2,1);
      INSERT INTO rollos(id,ubicacion_id) VALUES (1,1),(2,2)`);
    const store = createRemateStore(async (_tx, actor, roll) => actor.rol === "ADMIN" || roll.ubicacion_id === 1, "127.0.0.1");
    async function invoke(rol: string, remove = false, motivo = "Liquidación", id = "1") {
      let status = 0;
      let error: unknown;
      await createMarkRemateHandler(store, remove)(
        { auth: { user: { id: rol === "ADMIN" ? 1 : 2, rol } }, params: { id }, body: { motivo } } as any,
        { status(code: number) { status = code; return this; }, json() {} } as any,
        (cause?: unknown) => { error = cause; },
      );
      if (error) throw error;
      return status;
    }
    for (const rol of ["SUPERVISOR", "CAJA", "TERMINAL", "BODEGA", "SISTEMAS", "CONTADOR"] as const) {
      assert.equal(Boolean((await resolvePermiso(2, rol, "marcar_remate", db))?.puedeAutorizar), false);
      assert.equal(await invoke(rol), 403);
    }
    assert.equal(await invoke("ADMIN", false, "   "), 400);
    await pool.query(`INSERT INTO permisos_usuario(usuario_id,modulo,puede_autorizar) VALUES (2,'marcar_remate',true)`);
    assert.equal(await invoke("CAJA", false, "Fuera de sitio", "2"), 404);
    assert.equal(await invoke("CAJA"), 201);
    assert.equal(await invoke("ADMIN"), 409);
    assert.equal(await invoke("CAJA", true), 403);
    assert.equal(await invoke("ADMIN", true, ""), 400);
    const active = new Set<number>((await pool.query("SELECT rollo_id FROM tarea4_rollo_remate")).rows.map(row => row.rollo_id));
    const input = { released: true, priceCents: 900, costCents: 1000, rolloIds: [1], activeRollIds: active, legacyBlocksBelowCost: true };
    assert.equal(decideRemateSale(input).remate, true);
    assert.equal(decideRemateSale({ ...input, rolloIds: [2] }).allowed, false);
    await pool.query(`CREATE FUNCTION reject_remate_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced audit failure'; END $$;
      CREATE TRIGGER reject_remate_audit BEFORE INSERT ON auditoria FOR EACH ROW EXECUTE FUNCTION reject_remate_audit()`);
    await assert.rejects(invoke("ADMIN", true), (error: any) => error.cause?.message === "forced audit failure");
    assert.equal((await pool.query("SELECT * FROM tarea4_rollo_remate")).rowCount, 1);
    await pool.query("DROP TRIGGER reject_remate_audit ON auditoria; DROP FUNCTION reject_remate_audit()");
    const sale = await pool.connect();
    try {
      await sale.query("BEGIN");
      await sale.query("SELECT id FROM rollos WHERE id=1 FOR UPDATE");
      let completed = false;
      const removal = invoke("ADMIN", true, "Retiro autorizado").then(status => { completed = true; return status; });
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(completed, false, "retiro espera el mismo candado físico que venta");
      await sale.query("COMMIT");
      assert.equal(await removal, 201);
    } finally { sale.release(); }
    assert.equal((await pool.query("SELECT * FROM tarea4_rollo_remate")).rowCount, 0);
    const audits = (await pool.query("SELECT accion,datos_despues FROM auditoria ORDER BY id")).rows;
    assert.deepEqual(audits.map(row => row.accion), ["MARCAR_REMATE", "RETIRAR_REMATE"]);
    assert.equal(audits[1].datos_despues.motivo, "Retiro autorizado");
    assert.equal(await invoke("CAJA"), 201, "personalización permanece intacta tras retiro");
  } finally { await pool.end(); }
});