import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { auditoriaTable, db, ensureSalidasSchema, existenciasTable, movimientosTable, notificacionesSistemaTable, pool, productosTable, rollosTable, salidaFolioTable, salidaLineasTable, salidaRollosTable, salidasTable, ubicacionesTable, usuariosTable } from "@workspace/db";
import { crearRollo, InventarioError, recibirTransferencia } from "./inventario";
import {
  agregarRolloBorradorSalida,
  buildSalidaDetail,
  cancelarSalida,
  crearSalida,
  enviarSalida,
  listarSalidas,
  obtenerBorradorSalida,
  quitarRolloBorradorSalida,
  recibirSalida,
  salidasConcurrencyTestSeam,
} from "./salidas";

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
  async function fx(unidad: "METRO" | "KILO" | "BOLSA" = "METRO") {
    const n = `${tag}-${products.length}`;
    const [p] = await db.insert(productosTable).values({ sku: n, tela: n, color: "Azul", unidad, precioSugerido: "10" }).returning();
    const availableInitials = await pool.query<{ iniciales: string }>(
      `SELECT candidate AS iniciales
       FROM (
         SELECT chr(first_code) || chr(second_code)
           || CASE WHEN third_code = 0 THEN '' ELSE chr(third_code) END AS candidate
         FROM generate_series(65,90) AS first_code
         CROSS JOIN generate_series(65,90) AS second_code
         CROSS JOIN generate_series(0,90) AS third_code
         WHERE third_code = 0 OR third_code >= 65
       ) AS candidates
       WHERE NOT EXISTS (
         SELECT 1 FROM ubicaciones WHERE iniciales = candidates.candidate
       )
       ORDER BY length(candidate), candidate
       LIMIT 2`,
    );
    assert.equal(availableInitials.rows.length, 2);
    const [o, d] = await db.insert(ubicacionesTable).values([
      { nombre: `O-${n}`, iniciales: availableInitials.rows[0]!.iniciales, tipo: "BODEGA" },
      { nombre: `D-${n}`, iniciales: availableInitials.rows[1]!.iniciales, tipo: "TIENDA" },
    ]).returning();
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
  async function add(
    origenId: number,
    destinoId: number,
    serie: string,
    uuidCliente: string,
  ) {
    const result = await db.transaction((tx) =>
      agregarRolloBorradorSalida(tx, {
        origenId,
        destinoId,
        serie,
        uuidCliente,
        usuarioId: user,
      }),
    );
    if (!docs.includes(result.id)) docs.push(result.id);
    return result;
  }
  test("scan persists, retries are idempotent, removal is immediate, and own draft resumes", async () => {
    const f = await fx();
    const first = await roll(f.productoId, f.origenId, "8");
    const second = await roll(f.productoId, f.origenId, "9");
    const uuid = randomUUID();

    const created = await add(f.origenId, f.destinoId, first.serie, uuid);
    assert.equal(created.estado, "ARMANDO");
    assert.equal(created.totalRollos, 1);
    assert.equal(created.totalCantidadSolicitada, "8.000");

    const retried = await add(f.origenId, f.destinoId, first.serie, uuid);
    assert.equal(retried.id, created.id);
    assert.equal(retried.totalRollos, 1);

    const resumed = await obtenerBorradorSalida(db, user, f.origenId);
    assert.equal(resumed?.id, created.id);
    assert.equal(resumed?.destinoId, f.destinoId);

    const expanded = await add(f.origenId, f.destinoId, second.serie, uuid);
    assert.equal(expanded.totalRollos, 2);
    assert.equal(expanded.totalCantidadSolicitada, "17.000");

    const reduced = await db.transaction((tx) =>
      quitarRolloBorradorSalida(tx, created.id, first.id, user),
    );
    assert.equal(reduced.totalRollos, 1);
    assert.equal(reduced.rollos[0]?.rolloId, second.id);
    assert.equal(reduced.totalCantidadSolicitada, "9.000");
    const [removedAssociation] = await db
      .select({ id: salidaRollosTable.id })
      .from(salidaRollosTable)
      .where(
        and(
          eq(salidaRollosTable.salidaId, created.id),
          eq(salidaRollosTable.rolloId, first.id),
        ),
      );
    assert.equal(removedAssociation, undefined);
  });
  test("inactive drafts hide by default, remain recoverable, and failed send leaves no partial movement", async () => {
    const old = await fx();
    const oldRoll = await roll(old.productoId, old.origenId, "5");
    const oldDraft = await add(
      old.origenId,
      old.destinoId,
      oldRoll.serie,
      randomUUID(),
    );
    await db
      .update(salidasTable)
      .set({ actividadAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(salidasTable.id, oldDraft.id));
    const defaultList = await listarSalidas({ page: 1, pageSize: 100 });
    assert.ok(!defaultList.items.some((item) => item.id === oldDraft.id));
    const explicitDrafts = await listarSalidas({
      estados: ["ARMANDO"],
      page: 1,
      pageSize: 100,
    });
    assert.ok(explicitDrafts.items.some((item) => item.id === oldDraft.id));
    assert.equal(
      (await obtenerBorradorSalida(db, user, old.origenId))?.id,
      oldDraft.id,
    );

    const f = await fx();
    const first = await roll(f.productoId, f.origenId, "6");
    const second = await roll(f.productoId, f.origenId, "7");
    const uuid = randomUUID();
    const draft = await add(f.origenId, f.destinoId, first.serie, uuid);
    await add(f.origenId, f.destinoId, second.serie, uuid);
    await db
      .update(rollosTable)
      .set({ estado: "BAJA" })
      .where(eq(rollosTable.id, second.id));

    await assert.rejects(
      db.transaction((tx) =>
        enviarSalida(tx, {
          salidaId: draft.id,
          usuarioId: user,
          transportista: "Prueba",
        }),
      ),
      (error: unknown) =>
        error instanceof InventarioError &&
        error.code === "INVALID_TRANSITION",
    );
    const [untouchedFirst] = await db
      .select()
      .from(rollosTable)
      .where(eq(rollosTable.id, first.id));
    assert.equal(untouchedFirst?.estado, "DISPONIBLE");
    assert.equal(untouchedFirst?.ubicacionId, f.origenId);
    const failedMovements = await db
      .select()
      .from(movimientosTable)
      .where(
        and(
          eq(movimientosTable.documentoTipo, "SALIDA"),
          eq(movimientosTable.documentoId, String(draft.id)),
        ),
      );
    assert.equal(failedMovements.length, 0);
    assert.equal((await buildSalidaDetail(db, draft.id))?.estado, "ARMANDO");
  });
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
    assert.equal(movs.length, 8); assert.ok(movs.every((m) => m.documentoTipo === "SALIDA"));
    assert.equal(movs.filter((m) => m.tipo === "TRANSFERENCIA_SALIDA").length, 4);
    assert.equal(movs.filter((m) => m.tipo === "TRANSFERENCIA_ENTRADA").length, 4);
    const cache = await db.select().from(existenciasTable).where(eq(existenciasTable.productoId, f.productoId));
    assert.equal(Number(cache.find((x) => x.ubicacionId === f.origenId)?.cantidadTotal), 0);
    assert.equal(Number(cache.find((x) => x.ubicacionId === f.destinoId)?.cantidadTotal ?? 0), 0);
  });
  test("uuid is idempotent; concurrent drafts are unique per user/origin; independent origins receive site folios", async () => {
    const first = await fx();
    const a = await roll(first.productoId, first.origenId, "10");
    const uuid = randomUUID();
    const [x, y] = await Promise.all([
      create(first.origenId, first.destinoId, [a.id], uuid),
      create(first.origenId, first.destinoId, [a.id], uuid),
    ]);
    assert.equal(x.id, y.id);

    const raced = await fx();
    const [b, c] = await Promise.all([
      roll(raced.productoId, raced.origenId, "11"),
      roll(raced.productoId, raced.origenId, "12"),
    ]);
    const race = await Promise.allSettled([
      create(raced.origenId, raced.destinoId, [b.id]),
      create(raced.origenId, raced.destinoId, [c.id]),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    assert.ok(
      race.some(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof InventarioError &&
          result.reason.code === "DRAFT_ALREADY_EXISTS",
      ),
    );

    const parallelOne = await fx();
    const parallelTwo = await fx();
    const [one, two] = await Promise.all([
      create(
        parallelOne.origenId,
        parallelOne.destinoId,
        [await roll(parallelOne.productoId, parallelOne.origenId, "13").then((r) => r.id)],
      ),
      create(
        parallelTwo.origenId,
        parallelTwo.destinoId,
        [await roll(parallelTwo.productoId, parallelTwo.origenId, "14").then((r) => r.id)],
      ),
    ]);
    assert.notEqual(one.origenId, two.origenId);
    assert.ok(one.folio > 0);
    assert.ok(two.folio > 0);
  });
  test("only ARMANDO can be cancelled and cancellation never moves inventory", async () => {
    const f = await fx(); const r = await roll(f.productoId, f.origenId, "20"); const s = await create(f.origenId, f.destinoId, [r.id]);
    await assert.rejects(db.transaction((tx) => cancelarSalida(tx, s.id, user, "corto")), (e: unknown) => e instanceof InventarioError && e.code === "REASON_REQUIRED");
    await db.transaction((tx) => cancelarSalida(tx, s.id, user, "Motivo válido de cancelación"));
    const [back] = await db.select().from(rollosTable).where(eq(rollosTable.id, r.id)); assert.equal(back!.ubicacionId, f.origenId);
    const stale = await roll(f.productoId, f.origenId, "22"); const staleDraft = await create(f.origenId, f.destinoId, [stale.id]);
    await db.update(rollosTable).set({ ubicacionId: f.destinoId }).where(eq(rollosTable.id, stale.id));
    const cancelledStale = await db.transaction((tx) => cancelarSalida(tx, staleDraft.id, user, "Cancelar asociación obsoleta"));
    assert.equal(cancelledStale.estado, "CANCELADA");
    const [staleRollo] = await db.select().from(rollosTable).where(eq(rollosTable.id, stale.id));
    assert.equal(staleRollo!.ubicacionId, f.destinoId);
    assert.equal(
      await db.$count(
        movimientosTable,
        and(
          eq(movimientosTable.documentoTipo, "SALIDA"),
          eq(movimientosTable.documentoId, String(staleDraft.id)),
        ),
      ),
      0,
    );
    const changed = await roll(f.productoId, f.origenId, "21"); const s2 = await create(f.origenId, f.destinoId, [changed.id]);
    await db.transaction((tx) => enviarSalida(tx, { salidaId: s2.id, usuarioId: user, transportista: "Prueba" }));
    await assert.rejects(db.transaction((tx) => cancelarSalida(tx, s2.id, user, "Motivo válido de cancelación")), (e: unknown) => e instanceof InventarioError && e.code === "INVALID_SALIDA_STATE");
  });
  test("one-step reception lands every roll, rejects duplicates, audits, and alerts ADMIN when incomplete", async () => {
    const f = await fx();
    const rs = await Promise.all(["14", "16"].map((q) => roll(f.productoId, f.origenId, q)));
    const salida = await create(f.origenId, f.destinoId, rs.map((r) => r.id));
    await db.transaction((tx) => enviarSalida(tx, {
      salidaId: salida.id,
      usuarioId: user,
      transportista: "Prueba",
    }));
    const received = await db.transaction((tx) => recibirSalida(tx, {
      salidaId: salida.id,
      usuarioId: user,
      completa: false,
      nota: "Caja exterior dañada",
      ip: "127.0.0.1",
    }));
    assert.equal(received.estado, "RECIBIDA");
    assert.equal(received.totalCantidadRecibida, received.totalCantidadEnviada);
    const landed = await db.select().from(rollosTable).where(inArray(rollosTable.id, rs.map((r) => r.id)));
    assert.ok(landed.every((r) => r.ubicacionId === f.destinoId && r.estado === "DISPONIBLE"));
    await assert.rejects(
      db.transaction((tx) => recibirSalida(tx, {
        salidaId: salida.id,
        usuarioId: user,
        completa: true,
        ip: "127.0.0.1",
      })),
      (error: unknown) =>
        error instanceof InventarioError && error.code === "INVALID_SALIDA_STATE",
    );
    const [audit] = await db.select().from(auditoriaTable).where(and(
      eq(auditoriaTable.entidad, "salidas"),
      eq(auditoriaTable.entidadId, String(salida.id)),
      eq(auditoriaTable.accion, "RECIBIR"),
    ));
    assert.equal(audit?.ip, "127.0.0.1");
    assert.equal(audit?.datosDespues?.completa, false);
    const [notification] = await db.select().from(notificacionesSistemaTable).where(and(
      eq(notificacionesSistemaTable.entidad, "salidas"),
      eq(notificacionesSistemaTable.entidadId, String(salida.id)),
    ));
    assert.equal(notification?.tipo, "SALIDA_INCOMPLETA");
  });
  test("SALIDAS-LOCK: recepciones inversas a destinos distintos no se interbloquean", async () => {
    const first = await fx();
    const second = await fx();
    const [a1, b1, b2, a2] = await Promise.all([
      roll(first.productoId, first.origenId, "11"),
      roll(second.productoId, first.origenId, "12"),
      roll(second.productoId, second.origenId, "13"),
      roll(first.productoId, second.origenId, "14"),
    ]);
    const [salidaA, salidaB] = await Promise.all([
      create(first.origenId, first.destinoId, [a1.id, b1.id]),
      create(second.origenId, second.destinoId, [b2.id, a2.id]),
    ]);
    await Promise.all([
      db.transaction((tx) => enviarSalida(tx, {
        salidaId: salidaA.id,
        usuarioId: user,
        transportista: "Prueba",
      })),
      db.transaction((tx) => enviarSalida(tx, {
        salidaId: salidaB.id,
        usuarioId: user,
        transportista: "Prueba",
      })),
    ]);

    const results = await Promise.allSettled([
      db.transaction((tx) => recibirSalida(tx, {
        salidaId: salidaA.id,
        usuarioId: user,
        completa: true,
        ip: "127.0.0.1",
      })),
      db.transaction((tx) => recibirSalida(tx, {
        salidaId: salidaB.id,
        usuarioId: user,
        completa: true,
        ip: "127.0.0.1",
      })),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        const code =
          typeof result.reason === "object" &&
          result.reason !== null &&
          "code" in result.reason
            ? String(result.reason.code)
            : "UNKNOWN";
        assert.fail(`Ambas recepciones deben concluir; abortó una con ${code}.`);
      }
      assert.equal(result.value.estado, "RECIBIDA");
    }
  });
  test("SALIDAS-LOCK: una ubicación obsoleta se rechaza antes del ciclo del motor", async () => {
    const shipmentFixture = await fx();
    const raceFixture = await fx();
    const item = await roll(
      shipmentFixture.productoId,
      shipmentFixture.origenId,
      "15",
    );
    const salida = await create(
      shipmentFixture.origenId,
      shipmentFixture.destinoId,
      [item.id],
    );
    await db.transaction((tx) => enviarSalida(tx, {
      salidaId: salida.id,
      usuarioId: user,
      transportista: "Prueba",
    }));

    let announceRead!: () => void;
    let releaseRead!: () => void;
    const candidateWasRead = new Promise<void>((resolve) => {
      announceRead = resolve;
    });
    const concurrentMoveFinished = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });
    salidasConcurrencyTestSeam.afterReceiveCandidateRead = async () => {
      announceRead();
      await concurrentMoveFinished;
    };
    try {
      const receiving = db.transaction((tx) => recibirSalida(tx, {
        salidaId: salida.id,
        usuarioId: user,
        completa: true,
        ip: "127.0.0.1",
      }));
      await candidateWasRead;
      await db.transaction((tx) => recibirTransferencia(tx, {
        rolloId: item.id,
        ubicacionDestinoId: raceFixture.destinoId,
        usuarioId: user,
        documentoTipo: "PRUEBA_CARRERA_RECEPCION",
        documentoId: String(salida.id),
      }));
      releaseRead();
      await assert.rejects(
        receiving,
        (error: unknown) =>
          error instanceof InventarioError &&
          error.code === "INVENTORY_CHANGED_RETRY",
      );
    } finally {
      releaseRead();
      salidasConcurrencyTestSeam.afterReceiveCandidateRead = undefined;
    }

    const [unchangedShipment] = await db
      .select({ estado: salidasTable.estado })
      .from(salidasTable)
      .where(eq(salidasTable.id, salida.id));
    const [movedRollo] = await db
      .select({
        estado: rollosTable.estado,
        ubicacionId: rollosTable.ubicacionId,
      })
      .from(rollosTable)
      .where(eq(rollosTable.id, item.id));
    assert.equal(unchangedShipment?.estado, "EN_TRANSITO");
    assert.deepEqual(movedRollo, {
      estado: "DISPONIBLE",
      ubicacionId: raceFixture.destinoId,
    });
  });
  test("new states remain readable and ARMANDO totals split metres/kilos/bags", async () => {
    const m = await fx("METRO"), k = await fx("KILO"), b = await fx("BOLSA");
    const rm = await roll(m.productoId, m.origenId, "7"), rk = await roll(k.productoId, k.origenId, "3"), rb = await roll(b.productoId, b.origenId, "12");
    const sm = await create(m.origenId, m.destinoId, [rm.id]), sk = await create(k.origenId, k.destinoId, [rk.id]), sb = await create(b.origenId, b.destinoId, [rb.id]);
    assert.equal(sm.totalMetros, "7.000"); assert.equal(sk.totalKilos, "3.000"); assert.equal(sb.totalBolsas, "12.000");
    await db.update(salidasTable).set({ estado: "EN_TRANSITO" }).where(eq(salidasTable.id, sm.id));
    assert.equal((await buildSalidaDetail(db, sm.id))?.estado, "EN_TRANSITO");
    assert.ok((await listarSalidas({ page: 1, pageSize: 100 })).items.some((x) => x.id === sm.id));
  });
  after(async () => { await db.transaction(async (tx) => {
    if (docs.length) {
      await tx.delete(notificacionesSistemaTable).where(and(
        eq(notificacionesSistemaTable.entidad, "salidas"),
        inArray(notificacionesSistemaTable.entidadId, docs.map(String)),
      ));
      await tx.delete(salidaRollosTable).where(inArray(salidaRollosTable.salidaId, docs));
      await tx.delete(salidaLineasTable).where(inArray(salidaLineasTable.salidaId, docs));
      await tx.delete(salidasTable).where(inArray(salidasTable.id, docs));
    }
    if (rolls.length) { await tx.delete(movimientosTable).where(inArray(movimientosTable.rolloId, rolls)); await tx.delete(rollosTable).where(inArray(rollosTable.id, rolls)); }
    if (products.length) { await tx.delete(existenciasTable).where(inArray(existenciasTable.productoId, products)); await tx.delete(productosTable).where(inArray(productosTable.id, products)); }
    if (locations.length) {
      await tx.delete(salidaFolioTable).where(inArray(salidaFolioTable.ubicacionId, locations));
    }
  }); });
}