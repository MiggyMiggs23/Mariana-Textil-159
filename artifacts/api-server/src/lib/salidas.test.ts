import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, ensureSalidasSchema, existenciasTable, movimientosTable, pool, productosTable, rollosTable, salidaLineasTable, salidaRollosTable, salidasTable, ubicacionesTable, usuariosTable } from "@workspace/db";
import { crearRollo, InventarioError } from "./inventario";
import { buildSalidaDetail, cancelarSalida, crearSalida, enviarSalida, listarSalidas } from "./salidas";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  test("salidas DB suite is guarded", { skip: "TEST_DATABASE_URL required" }, () => {});
} else {
  const tag = `P7-${Date.now()}`;
  const products: number[] = [], locations: number[] = [], rolls: number[] = [], docs: number[] = [];
  let user = 0;
  before(async () => {
    await ensureSalidasSchema(pool);
    const [u] = await db.select({ id: usuariosTable.id }).from(usuariosTable).where(eq(usuariosTable.activo, true)).limit(1);
    assert.ok(u); user = u.id;
  });
  async function fx(unidad: "METRO" | "KILO" = "METRO") {
    const n = `${tag}-${products.length}`;
    const [p] = await db.insert(productosTable).values({ sku: n, tela: n, color: "Azul", unidad, precioSugerido: "10" }).returning();
    const [o, d] = await db.insert(ubicacionesTable).values([{ nombre: `O-${n}`, tipo: "BODEGA" }, { nombre: `D-${n}`, tipo: "TIENDA" }]).returning();
    products.push(p!.id); locations.push(o!.id, d!.id);
    return { productoId: p!.id, origenId: o!.id, destinoId: d!.id };
  }
  async function roll(productoId: number, ubicacionId: number, cantidad: string) {
    const r = await db.transaction((tx) => crearRollo(tx, { productoId, ubicacionId, cantidadInicial: cantidad, costoUnitario: "1", usuarioId: user, estado: "DISPONIBLE" }));
    rolls.push(r.rollo.id); return r.rollo;
  }
  async function create(origenId: number, destinoId: number, rolloIds: number[], uuidCliente = randomUUID()) {
    const r = await db.transaction((tx) => crearSalida(tx, { origenId, destinoId, rolloIds, uuidCliente, usuarioSolicitaId: user, transportista: "Prueba" }));
    if (!docs.includes(r.id)) docs.push(r.id);
    return r;
  }
  test("creation stays ARMANDO without moving inventory; sending moves every roll to TRANSITO", async () => {
    const f = await fx(); const rs = await Promise.all(["40", "45", "50", "50"].map((q) => roll(f.productoId, f.origenId, q)));
    const salida = await create(f.origenId, f.destinoId, rs.map((r) => r.id));
    assert.equal(salida.estado, "ARMANDO"); assert.equal(salida.totalRollos, 4); assert.equal(salida.totalMetros, "185.000");
    const untouched = await db.select().from(rollosTable).where(inArray(rollosTable.id, rs.map((r) => r.id)));
    assert.ok(untouched.every((r) => r.ubicacionId === f.origenId && r.estado === "DISPONIBLE"));
    const beforeSend = await db.select().from(movimientosTable).where(and(inArray(movimientosTable.rolloId, rs.map((r) => r.id)), eq(movimientosTable.documentoId, String(salida.id))));
    assert.equal(beforeSend.length, 0);
    const sent = await db.transaction((tx) => enviarSalida(tx, { salidaId: salida.id, usuarioId: user, transportista: "Prueba" }));
    assert.equal(sent.estado, "EN_TRANSITO");
    const moved = await db.select().from(rollosTable).where(inArray(rollosTable.id, rs.map((r) => r.id)));
    assert.ok(moved.every((r) => r.estado === "EN_TRANSITO"));
    const movs = await db.select().from(movimientosTable).where(and(inArray(movimientosTable.rolloId, rs.map((r) => r.id)), eq(movimientosTable.documentoId, String(salida.id))));
    assert.equal(movs.length, 4); assert.ok(movs.every((m) => m.documentoTipo === "SALIDA"));
    assert.equal(movs.filter((m) => m.tipo === "TRANSFERENCIA_SALIDA").length, 4);
    assert.equal(movs.filter((m) => m.tipo === "TRANSFERENCIA_ENTRADA").length, 0);
    const cache = await db.select().from(existenciasTable).where(eq(existenciasTable.productoId, f.productoId));
    assert.equal(Number(cache.find((x) => x.ubicacionId === f.origenId)?.cantidadTotal), 0);
    assert.equal(Number(cache.find((x) => x.ubicacionId === f.destinoId)?.cantidadTotal ?? 0), 0);
  });
  test("uuid is idempotent; concurrent same roll has exactly one winner; valid parallel docs receive distinct folios", async () => {
    const f = await fx(); const a = await roll(f.productoId, f.origenId, "10"), b = await roll(f.productoId, f.origenId, "11"), c = await roll(f.productoId, f.origenId, "12");
    const uuid = randomUUID(); const [x, y] = await Promise.all([create(f.origenId, f.destinoId, [a.id], uuid), create(f.origenId, f.destinoId, [a.id], uuid)]);
    assert.equal(x.id, y.id);
    const race = await Promise.allSettled([create(f.origenId, f.destinoId, [b.id]), create(f.origenId, f.destinoId, [b.id])]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    const [one, two] = await Promise.all([create(f.origenId, f.destinoId, [c.id]), create(f.origenId, f.destinoId, [await roll(f.productoId, f.origenId, "13").then(r => r.id)])]);
    assert.notEqual(one.folio, two.folio);
  });
  test("only ARMANDO can be cancelled and cancellation never moves inventory", async () => {
    const f = await fx(); const r = await roll(f.productoId, f.origenId, "20"); const s = await create(f.origenId, f.destinoId, [r.id]);
    await assert.rejects(db.transaction((tx) => cancelarSalida(tx, s.id, user, "corto")), (e: unknown) => e instanceof InventarioError && e.code === "REASON_REQUIRED");
    await db.transaction((tx) => cancelarSalida(tx, s.id, user, "Motivo válido de cancelación"));
    const [back] = await db.select().from(rollosTable).where(eq(rollosTable.id, r.id)); assert.equal(back!.ubicacionId, f.origenId);
    const changed = await roll(f.productoId, f.origenId, "21"); const s2 = await create(f.origenId, f.destinoId, [changed.id]);
    await db.transaction((tx) => enviarSalida(tx, { salidaId: s2.id, usuarioId: user, transportista: "Prueba" }));
    await assert.rejects(db.transaction((tx) => cancelarSalida(tx, s2.id, user, "Motivo válido de cancelación")), (e: unknown) => e instanceof InventarioError && e.code === "INVALID_SALIDA_STATE");
  });
  test("new states remain readable and ARMANDO totals split metres/kilos", async () => {
    const m = await fx("METRO"), k = await fx("KILO"); const rm = await roll(m.productoId, m.origenId, "7"), rk = await roll(k.productoId, k.origenId, "3");
    const sm = await create(m.origenId, m.destinoId, [rm.id]); const sk = await create(k.origenId, k.destinoId, [rk.id]);
    assert.equal(sm.totalMetros, "7.000"); assert.equal(sk.totalKilos, "3.000");
    await db.update(salidasTable).set({ estado: "EN_TRANSITO" }).where(eq(salidasTable.id, sm.id));
    assert.equal((await buildSalidaDetail(db, sm.id))?.estado, "EN_TRANSITO");
    assert.ok((await listarSalidas({ page: 1, pageSize: 100 })).items.some((x) => x.id === sm.id));
  });
  after(async () => { await db.transaction(async (tx) => {
    if (docs.length) { await tx.delete(salidaRollosTable).where(inArray(salidaRollosTable.salidaId, docs)); await tx.delete(salidaLineasTable).where(inArray(salidaLineasTable.salidaId, docs)); await tx.delete(salidasTable).where(inArray(salidasTable.id, docs)); }
    if (rolls.length) { await tx.delete(movimientosTable).where(inArray(movimientosTable.rolloId, rolls)); await tx.delete(rollosTable).where(inArray(rollosTable.id, rolls)); }
    if (products.length) { await tx.delete(existenciasTable).where(inArray(existenciasTable.productoId, products)); await tx.delete(productosTable).where(inArray(productosTable.id, products)); }
    if (locations.length) await tx.delete(ubicacionesTable).where(inArray(ubicacionesTable.id, locations));
  }); });
}