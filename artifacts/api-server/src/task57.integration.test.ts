import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "drizzle-orm";

const testUrl = process.env.TEST_DATABASE_URL;
const applicationUrl = process.env.DATABASE_URL;

if (!testUrl) throw new Error("Task 57 integration requiere TEST_DATABASE_URL explícita.");
if (testUrl === applicationUrl) {
  throw new Error("TEST_DATABASE_URL debe ser distinta de DATABASE_URL.");
}

function databaseNameFromUrl(value: string): string {
  const name = decodeURIComponent(new URL(value).pathname).replace(/^\/+/, "");
  if (!name || name.includes("/")) {
    throw new Error("TEST_DATABASE_URL debe incluir exactamente el nombre de la base.");
  }
  return name;
}

test("Task 57: auditoría concurrente y purga fail-closed usan únicamente la DB aislada", async () => {
  const expectedDatabase = databaseNameFromUrl(testUrl!);
  const [
    { db, pool, ensureAuditSchema, ensureAuditoriaInventarioSchema, createTestDatabaseGuard },
    inventoryAudit,
    inventoryEngine,
    purge,
  ] = await Promise.all([
    import("@workspace/db"),
    import("./lib/auditoria-inventario"),
    import("./lib/inventario"),
    import("./lib/purga-catalogos"),
  ]);
  const { assertIsolated } = await createTestDatabaseGuard(pool, testUrl, applicationUrl);
  await assertIsolated();
  assert.equal(
    (await pool.query<{ database: string }>("SELECT current_database() AS database")).rows[0]?.database,
    expectedDatabase,
    "la conexión de prueba debe coincidir con el pathname de TEST_DATABASE_URL",
  );
  await Promise.all([ensureAuditSchema(pool), ensureAuditoriaInventarioSchema(pool)]);

  const tag = `T57-${randomUUID()}`;
  const ids = { locations: [] as number[], users: [] as number[], products: [] as number[], rolls: [] as number[] };
  try {
    const one = async (text: string, values: unknown[] = []) =>
      (await pool.query<Record<string, unknown>>(text, values)).rows[0]!;
    const availableInitials = await pool.query<{ initials: string }>(
      `SELECT candidate AS initials
         FROM (
           SELECT chr(first_code) || chr(second_code) || chr(third_code) AS candidate
           FROM generate_series(65,90) AS first_code
           CROSS JOIN generate_series(65,90) AS second_code
           CROSS JOIN generate_series(65,90) AS third_code
         ) AS candidates
        WHERE NOT EXISTS (
          SELECT 1 FROM ubicaciones WHERE iniciales=candidates.candidate
        )
        ORDER BY candidate
        LIMIT 2`,
    );
    assert.equal(availableInitials.rows.length, 2);
    const locationInitials = availableInitials.rows[0]!.initials;
    const otherLocationInitials = availableInitials.rows[1]!.initials;
    const location = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id`,
      [`${tag} sitio`, locationInitials],
    );
    const otherLocation = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'BODEGA',true) RETURNING id`,
      [`${tag} otro sitio`, otherLocationInitials],
    );
    ids.locations.push(Number(location.id), Number(otherLocation.id));
    const actor = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'integration-only','ADMIN',$3,true,'TODAS') RETURNING id`,
      [`${tag} actor`, `${tag.toLowerCase()}-actor`, location.id],
    );
    const purgeTarget = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'must-not-reach-audit','CAJA',$3,false,'PROPIA') RETURNING id`,
      [`${tag} purge target`, `${tag.toLowerCase()}-purge`, location.id],
    );
    ids.users.push(Number(actor.id), Number(purgeTarget.id));

    const product = await one(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo,se_vende_por_metro)
       VALUES($1,$2,$3,'METRO',10,true,true) RETURNING id`,
      [`${tag}-P`, `${tag} tela`, `${tag} color`],
    );
    const referencedProduct = await one(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo,se_vende_por_metro)
       VALUES($1,$2,$3,'METRO',10,false,true) RETURNING id`,
      [`${tag}-REF`, `${tag} ref tela`, `${tag} ref color`],
    );
    const activeProduct = await one(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo,se_vende_por_metro)
       VALUES($1,$2,$3,'METRO',10,true,true) RETURNING id`,
      [`${tag}-ACTIVE`, `${tag} active tela`, `${tag} active color`],
    );
    ids.products.push(Number(product.id), Number(referencedProduct.id), Number(activeProduct.id));
    const missing = await one(
      `INSERT INTO rollos(serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual)
       VALUES($1,$2,$3,'DISPONIBLE',5,5) RETURNING id`,
      [`9${Date.now()}01`, product.id, location.id],
    );
    const surplus = await one(
      `INSERT INTO rollos(serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual)
       VALUES($1,$2,$3,'DISPONIBLE',4,4) RETURNING id`,
      [`9${Date.now()}02`, product.id, otherLocation.id],
    );
    const productReference = await one(
      `INSERT INTO rollos(serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual)
       VALUES($1,$2,$3,'DISPONIBLE',1,1) RETURNING id`,
      [`9${Date.now()}03`, referencedProduct.id, otherLocation.id],
    );
    ids.rolls.push(Number(missing.id), Number(surplus.id), Number(productReference.id));

    const openings = await Promise.allSettled(
      [0, 1].map(() => db.transaction((tx) => inventoryAudit.createAuditoria(tx, {
        ubicacionId: Number(location.id), usuarioId: Number(actor.id), ip: "127.0.0.1",
      }))),
    );
    const opened = openings.filter((result) => result.status === "fulfilled");
    assert.equal(opened.length, 1, "dos aperturas concurrentes sólo pueden producir una ABIERTA");
    assert.equal(openings.filter((result) => result.status === "rejected").length, 1);
    const openedAudit = opened[0];
    if (!openedAudit || openedAudit.status !== "fulfilled") {
      throw new Error("La apertura concurrente no devolvió una auditoría.");
    }
    const auditId = openedAudit.value.id;
    assert.equal(
      (await pool.query(`SELECT * FROM auditorias_inventario WHERE ubicacion_id=$1 AND estado='ABIERTA'`, [location.id])).rowCount,
      1,
    );

    const scans = await Promise.all(
      [0, 1].map(() => db.transaction((tx) => inventoryAudit.scanAuditoria(tx, {
        auditoriaId: auditId, serie: String(surplus.serie), usuarioId: Number(actor.id), ip: "127.0.0.1",
      }))),
    );
    assert.deepEqual(scans.map((scan) => scan.duplicado).sort(), [false, true]);
    assert.equal(
      (await pool.query(`SELECT count(*)::int AS count FROM auditoria_inventario_escaneos WHERE auditoria_id=$1`, [auditId]))
        .rows[0]?.count,
      1,
      "el escaneo concurrente conserva una sola fila por serie",
    );
    await db.transaction((tx) => inventoryAudit.transitionAuditoria(tx, {
      auditoriaId: auditId, usuarioId: Number(actor.id), ip: "127.0.0.1", action: "CERRAR",
    }));
    // Hold one candidate's advisory pair and start confirmation. Confirmation
    // must wait before taking any roll row lock, so this transaction can still
    // lock and change both discrepancies without a row/advisory cycle.
    let releaseBlocker!: () => void;
    let announceLock!: () => void;
    const blockerMayFinish = new Promise<void>((resolve) => {
      releaseBlocker = resolve;
    });
    const blockerHasPair = new Promise<void>((resolve) => {
      announceLock = resolve;
    });
    const blocker = db.transaction(async (tx) => {
      await inventoryEngine.lockInventoryPairs(tx, [{
        productoId: Number(product.id),
        ubicacionId: Number(location.id),
      }]);
      announceLock();
      await blockerMayFinish;
      await tx.execute(sql`SELECT id FROM rollos WHERE id=${Number(missing.id)} FOR UPDATE NOWAIT`);
      await tx.execute(sql`UPDATE rollos SET estado='PROGRAMADO' WHERE id=${Number(missing.id)}`);
      await tx.execute(sql`UPDATE rollos SET ubicacion_id=${Number(location.id)} WHERE id=${Number(surplus.id)}`);
    });
    await blockerHasPair;
    const confirmation = db.transaction((tx) => inventoryAudit.confirmAuditoria(tx, {
      auditoriaId: auditId, usuarioId: Number(actor.id), ip: "127.0.0.1",
    }));
    const waitDeadline = Date.now() + 2_000;
    let waitingOnAdvisory = false;
    while (Date.now() < waitDeadline) {
      const waitState = await pool.query<{ waiting: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_stat_activity
           WHERE pid <> pg_backend_pid()
             AND wait_event_type='Lock'
             AND wait_event='advisory'
             AND query LIKE '%pg_advisory_xact_lock%'
         ) AS waiting`,
      );
      waitingOnAdvisory = waitState.rows[0]?.waiting === true;
      if (waitingOnAdvisory) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(
      waitingOnAdvisory,
      true,
      "confirmar debe esperar el candado consultivo antes de bloquear filas de rollos",
    );
    releaseBlocker();
    await blocker;
    await confirmation;
    assert.deepEqual(
      (await pool.query(`SELECT id, estado, ubicacion_id FROM rollos WHERE id = ANY($1::int[]) ORDER BY id`, [[missing.id, surplus.id]]))
        .rows.map((row) => ({ estado: row.estado, ubicacionId: Number(row.ubicacion_id) })),
      [
        { estado: "PROGRAMADO", ubicacionId: Number(location.id) },
        { estado: "DISPONIBLE", ubicacionId: Number(location.id) },
      ],
    );
    assert.equal(
      (await pool.query(`SELECT count(*)::int AS count FROM auditoria_inventario_snapshot WHERE auditoria_id=$1 AND resolucion='RESOLUCION_MANUAL'`, [auditId]))
        .rows[0]?.count,
      1,
    );
    assert.equal(
      (await pool.query(`SELECT count(*)::int AS count FROM auditoria_inventario_escaneos WHERE auditoria_id=$1 AND resolucion='RESOLUCION_MANUAL'`, [auditId]))
        .rows[0]?.count,
      1,
    );
    const auditEntry = await one(
      `SELECT id FROM auditoria WHERE entidad='auditorias_inventario' AND entidad_id=$1 AND accion='CONFIRMAR'`,
      [String(auditId)],
    );
    await assert.rejects(
      () => pool.query(`UPDATE auditoria SET accion='MUTADA' WHERE id=$1`, [auditEntry.id]),
      /append-only/,
    );

    const activePreflight = await purge.getPurgaPreflight("productos", Number(activeProduct.id));
    assert.equal(activePreflight.puedeEliminar, false);
    await assert.rejects(
      () => purge.purgeInactiveRecord({
        entidad: "productos", id: Number(activeProduct.id), confirmacion: activePreflight.nombreVisible,
        actorId: Number(actor.id), ip: "127.0.0.1",
      }),
      /inactivos/,
    );
    const referencedPreflight = await purge.getPurgaPreflight("productos", Number(referencedProduct.id));
    assert.equal(referencedPreflight.puedeEliminar, false);
    assert.ok(referencedPreflight.totalReferencias > 0);
    await assert.rejects(
      () => purge.purgeInactiveRecord({
        entidad: "productos", id: Number(referencedProduct.id), confirmacion: referencedPreflight.nombreVisible,
        actorId: Number(actor.id), ip: "127.0.0.1",
      }),
      /referencias/,
    );

    const purgePreflight = await purge.getPurgaPreflight("usuarios", Number(purgeTarget.id));
    assert.equal(purgePreflight.puedeEliminar, true);
    await purge.purgeInactiveRecord({
      entidad: "usuarios", id: Number(purgeTarget.id), confirmacion: purgePreflight.nombreVisible,
      actorId: Number(actor.id), ip: "127.0.0.1",
    });
    assert.equal((await pool.query(`SELECT 1 FROM usuarios WHERE id=$1`, [purgeTarget.id])).rowCount, 0);
    const purgeAudit = await one(
      `SELECT datos_antes FROM auditoria WHERE accion='PURGAR' AND entidad='usuarios' AND entidad_id=$1`,
      [String(purgeTarget.id)],
    );
    assert.ok(!JSON.stringify(purgeAudit.datos_antes).toLowerCase().includes("password"));
  } finally {
    await assertIsolated();
    // Audit rows are intentionally never deleted: the isolated database is discarded as a whole.
  }
});

test("Task 57: caja diaria serializa aperturas y descuenta salidas una vez", async () => {
  const expectedDatabase = databaseNameFromUrl(testUrl!);
  const [
    {
      db,
      pool,
      ensureAuditSchema,
      ensureCashSessionSchema,
      ensureTicketIvaSchema,
      ensureTicketLineTypesSchema,
      createTestDatabaseGuard,
    },
    pos,
  ] = await Promise.all([import("@workspace/db"), import("./lib/pos")]);
  const { assertIsolated } = await createTestDatabaseGuard(pool, testUrl, applicationUrl);
  await assertIsolated();
  assert.equal(
    (await pool.query<{ database: string }>("SELECT current_database() AS database")).rows[0]?.database,
    expectedDatabase,
    "caja debe seguir conectada a la base indicada por TEST_DATABASE_URL",
  );
  await Promise.all([
    ensureAuditSchema(pool),
    ensureCashSessionSchema(pool),
    ensureTicketIvaSchema(pool),
    ensureTicketLineTypesSchema(pool),
  ]);

  const tag = `T57-CAJA-${randomUUID()}`;
  let mainSessionId: number | undefined;
  let otherSessionId: number | undefined;
  let otherLocationId: number | undefined;
  try {
    const one = async (text: string, values: unknown[] = []) =>
      (await pool.query<Record<string, unknown>>(text, values)).rows[0]!;
    const mariana = await pool.query<{ id: number }>(
      `SELECT id FROM ubicaciones WHERE id=1 AND tipo='TIENDA' AND activa=true`,
    );
    assert.equal(mariana.rowCount, 1, "la fixture aislada debe contener Tienda Mariana en ubicación 1");
    const initials = (await one(
      `SELECT candidate AS initials
         FROM (
           SELECT chr(first_code) || chr(second_code) || chr(third_code) AS candidate
           FROM generate_series(65,90) AS first_code
           CROSS JOIN generate_series(65,90) AS second_code
           CROSS JOIN generate_series(65,90) AS third_code
         ) AS candidates
        WHERE NOT EXISTS (
          SELECT 1 FROM ubicaciones WHERE iniciales=candidates.candidate
        )
        ORDER BY candidate
        LIMIT 1`,
    )).initials;
    const otherLocation = await one(
      `INSERT INTO ubicaciones(nombre,iniciales,tipo,activa) VALUES($1,$2,'TIENDA',true) RETURNING id`,
      [`${tag} otra tienda`, initials],
    );
    otherLocationId = Number(otherLocation.id);
    const actor = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'integration-only','ADMIN',1,true,'TODAS') RETURNING id`,
      [`${tag} actor`, `${tag.toLowerCase()}-actor`],
    );
    const inactiveProvider = await one(
      `INSERT INTO proveedores(nombre,tipo,activo) VALUES($1,'NACIONAL',false) RETURNING id`,
      [`${tag} proveedor inactivo`],
    );
    const actorId = Number(actor.id);

    const openings = await Promise.allSettled(
      [0, 1].map(() => db.transaction((tx) => pos.abrirSesionCaja(tx, {
        ubicacionId: 1, usuarioId: actorId, fondoInicial: "100.00", ip: "127.0.0.1",
      }))),
    );
    const opened = openings.filter((result) => result.status === "fulfilled");
    assert.equal(opened.length, 1, "dos terminales no pueden abrir caja dos veces el mismo día");
    assert.equal(openings.filter((result) => result.status === "rejected").length, 1);
    const openedSession = opened[0];
    if (!openedSession || openedSession.status !== "fulfilled") {
      throw new Error("La apertura concurrente no produjo sesión.");
    }
    mainSessionId = openedSession.value.id;
    assert.equal(
      (await pool.query(`SELECT count(*)::int AS count FROM sesiones_caja WHERE id=$1 AND estado='ABIERTA'`, [mainSessionId]))
        .rows[0]?.count,
      1,
    );

    await db.transaction((tx) => pos.crearSalidaDineroCaja(tx, {
      sesionCajaId: mainSessionId!, monto: "25.00", motivo: "Cambio para prueba",
      cuentaOrigen: "CAJA_FISICA", creadoPorId: actorId, ip: "127.0.0.1",
    }));
    const beforeClose = await pos.buildCorteCaja(db, mainSessionId);
    assert.equal(beforeClose?.salidas.length, 1);
    assert.equal(beforeClose?.salidasPorCuenta.CAJA_FISICA, "25.00");
    assert.equal(beforeClose?.efectivoEsperado, "75.00");
    assert.equal(
      beforeClose?.cuentasDestino.find((item) => item.cuentaDestino === "CAJA_FISICA")?.importe,
      "-25.00",
      "el neto operativo de caja descuenta la salida una sola vez y no incorpora el fondo",
    );

    otherSessionId = (await db.transaction((tx) => pos.abrirSesionCaja(tx, {
      ubicacionId: otherLocationId!, usuarioId: actorId, fondoInicial: "0.00", ip: "127.0.0.1",
    }))).id;
    await assert.rejects(
      () => db.transaction((tx) => pos.crearSalidaDineroCaja(tx, {
        sesionCajaId: otherSessionId!, monto: "1.00", motivo: "No permitido",
        cuentaOrigen: "CAJA_FISICA", creadoPorId: actorId, ip: "127.0.0.1",
      })),
      /solo están autorizadas en Tienda Mariana/,
    );
    await assert.rejects(
      () => db.transaction((tx) => pos.crearSalidaDineroCaja(tx, {
        sesionCajaId: mainSessionId!, monto: "1.00", motivo: "Proveedor inválido",
        proveedorId: Number(inactiveProvider.id), cuentaOrigen: "CAJA_FISICA",
        creadoPorId: actorId, ip: "127.0.0.1",
      })),
      /inactivo/,
    );

    await db.transaction((tx) => pos.cerrarSesionCaja(tx, {
      sesionId: mainSessionId!, usuarioId: actorId, efectivoContado: "75.00", ip: "127.0.0.1",
    }));
    assert.equal(
      (await pool.query(`SELECT cerrada_por_id FROM sesiones_caja WHERE id=$1`, [mainSessionId])).rows[0]?.cerrada_por_id,
      actorId,
    );
    await assert.rejects(
      () => db.transaction((tx) => pos.abrirSesionCaja(tx, {
        ubicacionId: 1, usuarioId: actorId, fondoInicial: "0.00", ip: "127.0.0.1",
      })),
      /Ya existe una sesión de caja para la fecha operativa de hoy/,
    );
    await assert.rejects(
      () => db.transaction((tx) => pos.crearSalidaDineroCaja(tx, {
        sesionCajaId: mainSessionId!, monto: "1.00", motivo: "Sesión cerrada",
        cuentaOrigen: "CAJA_FISICA", creadoPorId: actorId, ip: "127.0.0.1",
      })),
      /sesión cerrada/,
    );
  } finally {
    await assertIsolated();
    // Caja fixtures may be removed; audit is append-only and is deliberately untouched.
    if (mainSessionId != null) await pool.query(`DELETE FROM salidas_dinero_caja WHERE sesion_caja_id=$1`, [mainSessionId]);
    if (otherSessionId != null) await pool.query(`DELETE FROM salidas_dinero_caja WHERE sesion_caja_id=$1`, [otherSessionId]);
    if (mainSessionId != null) await pool.query(`DELETE FROM sesiones_caja_dias WHERE sesion_caja_id=$1`, [mainSessionId]);
    if (otherSessionId != null) await pool.query(`DELETE FROM sesiones_caja_dias WHERE sesion_caja_id=$1`, [otherSessionId]);
    await pool.query(`DELETE FROM sesiones_caja WHERE id = ANY($1::int[])`, [[mainSessionId, otherSessionId].filter((id): id is number => id != null)]);
    if (otherLocationId != null) await pool.query(`DELETE FROM ubicaciones WHERE id=$1`, [otherLocationId]);
    await pool.query(`DELETE FROM proveedores WHERE nombre=$1`, [`${tag} proveedor inactivo`]);
    await pool.end();
  }
});