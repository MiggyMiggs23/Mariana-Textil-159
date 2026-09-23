import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { crearSalidaDineroCaja } from "./pos";
import {
  reviewE4CashOut, E4CashOutError, type E4Actor, type E4Salida,
} from "./e4-cash-out";
import { e4CashOutRepository } from "./e4-cash-out-repository";

if (process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" || !process.env.TEST_DATABASE_URL) {
  throw new Error("E4 PG verification requires the focused disposable runner.");
}

const rows = await pool.query<{ id: number }>("SELECT id FROM usuarios ORDER BY id LIMIT 2");
assert.ok(rows.rows[0], "canonical seed must contain a user");
const userId = rows.rows[0].id;
const admin: E4Actor = { id: userId, rol: "ADMIN", ubicacionId: null };
const caja = (location: number): E4Actor => ({ id: userId, rol: "CAJA", ubicacionId: location });
const supervisor = (location: number): E4Actor => ({
  id: userId, rol: "SUPERVISOR", ubicacionId: location,
});
const sessions = new Map<number, number>();

async function code(work: () => Promise<unknown>) {
  try { await work(); return "NO_ERROR"; } catch (error) {
    return error instanceof E4CashOutError ? error.code : (error as Error).message;
  }
}
async function create(
  sessionId: number, actor: E4Actor, amount: string, key = randomUUID(),
  extra: Record<string, unknown> = {},
) {
  return await db.transaction((tx) => crearSalidaDineroCaja(tx, {
    sesionCajaId: sessionId, monto: amount, motivo: "E4 PostgreSQL verification",
    cuentaOrigen: "CAJA_FISICA", creadoPorId: actor.id, ip: "127.0.0.1",
    tipo: "EXTRAORDINARIA", claveOperacion: key, actor, ...extra,
  })) as E4Salida;
}

try {
  for (const [location, cash] of [[1, "500.00"], [2, "5.00"], [3, "100.00"]] as const) {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO sesiones_caja
       (ubicacion_id,usuario_id,fecha_operativa,fondo_inicial,estado)
       VALUES ($1,$2,current_date,$3,'ABIERTA') RETURNING id`,
      [location, userId, cash],
    );
    sessions.set(location, result.rows[0]!.id);
  }

  // Real producer and normal scope: both operational roles in every store.
  for (const location of [1, 2, 3]) {
    for (const actor of [supervisor(location), caja(location)]) {
      const out = await create(sessions.get(location)!, actor, "1.00");
      assert.equal(out.e4.tipo, "EXTRAORDINARIA");
    }
  }
  assert.equal(
    await code(() => create(sessions.get(2)!, caja(3), "1.00")),
    "E4_LOCATION_FORBIDDEN",
  );

  // Canonical insufficient-cash guard and persisted ADMIN unlock evidence/history.
  const low = sessions.get(2)!;
  assert.equal(await code(() => create(low, caja(2), "10.00")), "E4_CAJA_INSUFICIENTE");
  const unlocked = await create(low, admin, "10.00", randomUUID(), {
    desbloqueoCaja: { motivo: "Emergencia histórica autorizada" },
  });
  assert.equal(unlocked.e4.desbloqueoCaja?.usuarioId, admin.id);
  assert.equal(unlocked.e4.desbloqueoCaja?.saldoAntes, "3.00");
  const persistedUnlock = await pool.query<{ revision: { desbloqueoCaja: { motivo: string } } }>(
    "SELECT revision FROM caja_salidas_e4 WHERE salida_id=$1", [unlocked.id],
  );
  assert.equal(persistedUnlock.rows[0]!.revision.desbloqueoCaja.motivo,
    "Emergencia histórica autorizada");

  // Replay happens before mutable balance checks: same actor/content returns the original.
  const mariana = sessions.get(1)!;
  const replayKey = randomUUID();
  const original = await create(mariana, admin, "10.00", replayKey);
  await create(mariana, admin, "480.00");
  assert.equal((await create(mariana, admin, "10.00", replayKey)).id, original.id);

  // Two independent transactions race for one session lock: only one can spend 60 of 98.
  const coco = sessions.get(3)!;
  const concurrent = await Promise.all([
    code(() => create(coco, caja(3), "60.00")),
    code(() => create(coco, caja(3), "60.00")),
  ]);
  assert.deepEqual(concurrent.sort(), ["E4_CAJA_INSUFICIENTE", "NO_ERROR"]);

  // Review changes only revision evidence, never the physical cash movement.
  const reviewTarget = await pool.query<{ id: number }>(
    `SELECT s.id FROM salidas_dinero_caja s JOIN caja_salidas_e4 e ON e.salida_id=s.id
     WHERE s.sesion_caja_id=$1 AND e.revision->>'tipo'='EXTRAORDINARIA' ORDER BY s.id LIMIT 1`,
    [coco],
  );
  const before = await pool.query<{ count: string; total: string }>(
    "SELECT count(*)::text count,COALESCE(sum(monto),0)::text total FROM salidas_dinero_caja WHERE sesion_caja_id=$1",
    [coco],
  );
  const revision = await db.transaction((tx) => reviewE4CashOut(e4CashOutRepository(tx), admin, {
    sesionCajaId: coco, salidaId: reviewTarget.rows[0]!.id, accion: "RECLAMAR",
    version: 0, claveOperacion: randomUUID(), explicacion: "Solicitar soporte",
    ip: "127.0.0.1",
  }));
  assert.equal(revision.historial.length, 1);
  const after = await pool.query<{ count: string; total: string }>(
    "SELECT count(*)::text count,COALESCE(sum(monto),0)::text total FROM salidas_dinero_caja WHERE sesion_caja_id=$1",
    [coco],
  );
  assert.deepEqual(after.rows[0], before.rows[0]);

  // Restore Mariana cash only by opening a fresh session; closed sessions stay immutable.
  await pool.query("UPDATE sesiones_caja SET estado='CERRADA',cerrada_at=now() WHERE id=$1", [mariana]);
  const fresh = await pool.query<{ id: number }>(
    `INSERT INTO sesiones_caja
     (ubicacion_id,usuario_id,fecha_operativa,fondo_inicial,estado)
     VALUES (1,$1,current_date + 1,500,'ABIERTA') RETURNING id`, [userId],
  );
  const supplierSession = fresh.rows[0]!.id;
  const provider = await pool.query<{ id: number }>(
    "INSERT INTO proveedores(nombre,tipo,activo) VALUES ('E4 PG supplier','NACIONAL',true) RETURNING id",
  );
  const providerId = provider.rows[0]!.id;
  await pool.query(
    `INSERT INTO pagos_proveedor(proveedor_id,importe,tipo,usuario_id,notas,fecha)
     VALUES ($1,100,'AJUSTE',$2,'E4 initial debt',now())`, [providerId, userId],
  );
  const supplier = (amount: string, key = randomUUID(), extra: Record<string, unknown> = {}) =>
    db.transaction((tx) => crearSalidaDineroCaja(tx, {
      sesionCajaId: supplierSession, monto: amount, motivo: "Pago proveedor real",
      proveedorId: providerId, cuentaOrigen: "CAJA_FISICA", creadoPorId: userId, ip: "127.0.0.1",
      tipo: "PROVEEDOR", claveOperacion: key, actor: admin, ...extra,
    }));
  await supplier("30.00");
  const debt = await pool.query<{ debt: string }>(
    "SELECT sum(importe)::text debt FROM pagos_proveedor WHERE proveedor_id=$1", [providerId],
  );
  assert.equal(debt.rows[0]!.debt, "70.00");
  assert.equal(await code(() => supplier("80.00")), "E4_PROVIDER_OVERPAY");
  assert.equal(await code(() => supplier("480.00", randomUUID(), {
    desbloqueoCaja: { motivo: "never allowed" },
  })), "E4_PROVIDER_HARD_CASH");

  // Final-audit failure proves supplier ledger + physical outflow atomic rollback.
  await pool.query(`
    CREATE FUNCTION pg_temp.e4_fail_final_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.accion='SALIDA_DINERO_CAJA' THEN RAISE EXCEPTION 'E4 injected audit failure'; END IF;
    RETURN NEW; END $$;
    CREATE TRIGGER e4_fail_final_audit BEFORE INSERT ON auditoria
    FOR EACH ROW EXECUTE FUNCTION pg_temp.e4_fail_final_audit()`);
  const ledgerBefore = await pool.query<{ count: string }>(
    "SELECT count(*)::text count FROM pagos_proveedor WHERE proveedor_id=$1", [providerId],
  );
  assert.notEqual(await code(() => supplier("10.00")), "NO_ERROR");
  const ledgerAfter = await pool.query<{ count: string }>(
    "SELECT count(*)::text count FROM pagos_proveedor WHERE proveedor_id=$1", [providerId],
  );
  assert.deepEqual(ledgerAfter.rows[0], ledgerBefore.rows[0]);

  process.stdout.write("E4_DISPOSABLE_PG_PASS\n");
} finally {
  await pool.end();
}