import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { db, pool, rollosTable } from "@workspace/db";
import {
  activarRollo, ajustarRollo, crearRollo, revertirMovimiento, venderRollo, type Tx,
} from "./inventario";

// Explicit disposable fixture, never automatic setup against application data.
if (process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1" ||
    process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL ||
    !process.env.STRICT_REVERSAL_FIXTURE || !process.env.STRICT_REVERSAL_DATABASE) {
  throw new Error("Explicit isolated database and STRICT_REVERSAL_FIXTURE/DATABASE required.");
}
const fixture = JSON.parse(readFileSync(process.env.STRICT_REVERSAL_FIXTURE, "utf8")) as {
  sites: Array<{ id: number }>; actors: { admin: { id: number } };
  products: Array<{ id: number; unidad: string }>;
};
const usuarioId = fixture.actors.admin.id;
const ubicacionId = fixture.sites[0]!.id;
const productoId = fixture.products.find((p) => p.unidad === "METRO")!.id;
const justificacion = "Prueba aislada de reverso estricto autorizado";
const rollback = new Error("test rollback");

async function isolated(run: (tx: Tx) => Promise<void>) {
  const identity = await db.execute(sql`SELECT current_database() AS name`);
  assert.equal(identity.rows[0]!.name, process.env.STRICT_REVERSAL_DATABASE);
  try {
    await db.transaction(async (tx) => { await run(tx); throw rollback; });
  } catch (error) { if (error !== rollback) throw error; }
}
async function fresh(tx: Tx) {
  const created = await crearRollo(tx, {
    productoId, ubicacionId, usuarioId, cantidadInicial: "10", costoUnitario: "100",
  });
  return activarRollo(tx, { rolloId: created.rollo.id, cantidadReal: "10", usuarioId });
}
const reverse = (tx: Tx, id: number) => revertirMovimiento(tx, {
  movimientoOrigenId: id, usuarioId, justificacion,
});
const adjust = (tx: Tx, id: number, cantidadNueva?: string) =>
  ajustarRollo(tx, { rolloId: id, usuarioId, justificacion, cantidadNueva });

await test("fresh receipt, adjustment and sale preserve supported chronological reversal", async () => {
  await isolated(async (tx) => {
    const received = await fresh(tx);
    const adjusted = await adjust(tx, received.rollo.id, "12");
    const sold = await venderRollo(tx, { rolloId: received.rollo.id, usuarioId });
    await assert.rejects(reverse(tx, adjusted.movimiento.id), { code: "REVERSAL_ROLL_STATE_CHANGED" });
    const unsold = await reverse(tx, sold.movimiento.id);
    assert.equal(unsold.rollo.estado, "DISPONIBLE");
    assert.equal(Number(unsold.rollo.cantidadActual), 12);
    const unadjusted = await reverse(tx, adjusted.movimiento.id);
    assert.equal(Number(unadjusted.rollo.cantidadActual), 10);
    const unreceived = await reverse(tx, received.movimiento.id);
    assert.equal(unreceived.rollo.estado, "PROGRAMADO");
    assert.equal(Number(unreceived.rollo.cantidadActual), 10);
  });
});

await test("case6 cannot subtract consumed positive adjustment into negative availability", async () => {
  await isolated(async (tx) => {
    const received = await fresh(tx);
    const adjusted = await adjust(tx, received.rollo.id, "12");
    const baja = await adjust(tx, received.rollo.id);
    await assert.rejects(reverse(tx, adjusted.movimiento.id), { code: "REVERSAL_ROLL_STATE_CHANGED" });
    const [unchanged] = await tx.select().from(rollosTable).where(eq(rollosTable.id, received.rollo.id));
    assert.equal(unchanged!.estado, "BAJA");
    assert.equal(Number(unchanged!.cantidadActual), 0);
    const restored = await reverse(tx, baja.movimiento.id);
    assert.equal(restored.rollo.estado, "DISPONIBLE");
    assert.equal(Number(restored.rollo.cantidadActual), 12);
  });
});

await test("equal quantity with uncancelled successors does not prove same history", async () => {
  await isolated(async (tx) => {
    const received = await fresh(tx);
    const adjusted = await adjust(tx, received.rollo.id, "12");
    await adjust(tx, received.rollo.id, "14");
    await adjust(tx, received.rollo.id, "12");
    await assert.rejects(reverse(tx, adjusted.movimiento.id), { code: "REVERSAL_LATER_MOVEMENTS" });
  });
});

await test("case9 reverse-of-cancellation fails closed without multiplying ledger", async () => {
  await isolated(async (tx) => {
    const received = await fresh(tx);
    const adjusted = await adjust(tx, received.rollo.id, "12");
    const inverse = await reverse(tx, adjusted.movimiento.id);
    await assert.rejects(reverse(tx, inverse.movimiento.id), { code: "REVERSAL_STATE_EVIDENCE_REQUIRED" });
    const [unchanged] = await tx.select().from(rollosTable).where(eq(rollosTable.id, received.rollo.id));
    assert.equal(Number(unchanged!.cantidadActual), 10);
  });
});

await pool.end();