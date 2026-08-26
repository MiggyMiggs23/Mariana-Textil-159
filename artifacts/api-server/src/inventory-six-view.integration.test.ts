import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV !== "test" || !testUrl) {
  throw new Error(
    "Inventory six-view integration requires NODE_ENV=test and explicit TEST_DATABASE_URL.",
  );
}
if (testUrl === appUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}
const expectedDb = decodeURIComponent(new URL(testUrl).pathname.slice(1));
if (!expectedDb) throw new Error("TEST_DATABASE_URL must name an isolated database.");
if (appUrl && decodeURIComponent(new URL(appUrl).pathname.slice(1)) === expectedDb) {
  throw new Error("TEST_DATABASE_URL must not name the application database.");
}

type Total = { quantity: number; rolls: number };
type ProductFixture = {
  id: number;
  sku: string;
  unit: "METRO" | "KILO";
  admin: Total;
  own: Total;
};
type Json = Record<string, any>;

test("Part 1 Block 5: six HTTP views share inventory truth and scope", async () => {
  const [{ pool }, { default: app }, { reconstruirCacheExistencias }] =
    await Promise.all([
      import("@workspace/db"),
      import("./app"),
      import("./lib/inventario"),
    ]);
  const tag = `INV6-${randomUUID()}`;
  const ids = {
    locations: [] as number[],
    users: [] as number[],
    sessions: [] as string[],
    products: [] as number[],
    rolls: [] as number[],
    movements: [] as number[],
  };
  let server: Server | undefined;
  let baseUrl = "";

  const guardDatabase = async () => {
    const identity = await pool.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    assert.equal(
      identity.rows[0]?.database,
      expectedDb,
      "Refusing fixture mutation outside TEST_DATABASE_URL.",
    );
  };
  const mutate = async (text: string, values: unknown[] = []) => {
    await guardDatabase();
    return pool.query(text, values);
  };
  const one = async (text: string, values: unknown[] = []) =>
    (await mutate(text, values)).rows[0]!;
  const request = async (path: string, session: string): Promise<any> => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: `mariana_session=${session}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(body)}`);
    return body;
  };
  const closeServer = async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  };
  const rounded = (value: unknown) => Number(Number(value ?? 0).toFixed(3));
  const assertTotals = (
    actual: Map<number, Total>,
    fixtures: ProductFixture[],
    scope: "admin" | "own",
    label: string,
  ) => {
    for (const product of fixtures) {
      assert.deepEqual(
        actual.get(product.id) ?? { quantity: 0, rolls: 0 },
        product[scope],
        `${label}: ${product.sku}`,
      );
    }
  };

  try {
    const own = await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'BODEGA',true) RETURNING id",
      [`${tag}-PROPIA`],
    );
    const other = await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'TIENDA',true) RETURNING id",
      [`${tag}-OTRA`],
    );
    const transit = await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'TRANSITO',true) RETURNING id",
      [`${tag}-TRANSITO`],
    );
    const ownId = Number(own.id);
    const otherId = Number(other.id);
    const transitId = Number(transit.id);
    ids.locations.push(ownId, otherId, transitId);

    const definitions = [
      ["P1", "METRO", 25, 2, 25, 2],
      ["P2", "METRO", 20, 2, 12, 1],
      ["P3", "METRO", 0, 0, 0, 0],
      ["P4", "KILO", 10, 3, 10, 3],
      ["P5", "KILO", 0, 0, 0, 0],
      ["P6", "METRO", 0, 0, 0, 0],
      ["P7", "KILO", 4, 1, 0, 0],
      ["P8", "METRO", 15, 2, 15, 2],
      ["P9", "KILO", 6, 3, 3, 2],
      ["P10", "METRO", 0, 0, 0, 0],
    ] as const;
    const products: ProductFixture[] = [];
    for (const [name, unit, aq, ar, oq, or] of definitions) {
      const row = await one(
        `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,notas,activo)
         VALUES($1,$2,$3,$4,$5,$6,true) RETURNING id`,
        [
          `${tag}-${name}`,
          `${tag}-TELA-${name}`,
          `${tag}-COLOR-${name}`,
          unit,
          String(100 + products.length),
          tag,
        ],
      );
      const product = {
        id: Number(row.id),
        sku: `${tag}-${name}`,
        unit,
        admin: { quantity: aq, rolls: ar },
        own: { quantity: oq, rolls: or },
      };
      products.push(product);
      ids.products.push(product.id);
    }

    const adminUser = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'integration-session-only','ADMIN',NULL,true,'TODAS') RETURNING id`,
      [`${tag}-ADMIN`, `${tag}-admin`.toLowerCase()],
    );
    const ownUser = await one(
      `INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
       VALUES($1,$2,'integration-session-only','BODEGA',$3,true,'PROPIA') RETURNING id`,
      [`${tag}-BODEGA`, `${tag}-bodega`.toLowerCase(), ownId],
    );
    ids.users.push(Number(adminUser.id), Number(ownUser.id));
    for (const userId of ids.users) {
      for (const module of ["dashboard", "inventario", "productos", "reportes"]) {
        await mutate(
          `INSERT INTO permisos_usuario
             (usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
           VALUES($1,$2,true,false,false,false)`,
          [userId, module],
        );
      }
    }
    const sessions = { admin: randomUUID(), own: randomUUID() };
    ids.sessions.push(sessions.admin, sessions.own);
    await mutate(
      `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
       VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$5),
             ($3,$4,now()+interval '1 hour','127.0.0.1',$5)`,
      [sessions.admin, adminUser.id, sessions.own, ownUser.id, tag],
    );

    let nextCost = 11;
    const balances = new Map<string, number>();
    const addRoll = async (
      productIndex: number,
      locationId: number,
      state: "DISPONIBLE" | "ABIERTO" | "EN_TRANSITO",
      quantity: number,
      movements: Array<{ type: string; quantity: number }>,
      forcedCost?: number,
    ) => {
      const product = products[productIndex]!;
      const cost = forcedCost ?? nextCost++;
      const roll = await one(
        `INSERT INTO rollos
           (serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual,
            costo_unitario,costo_total,notas)
         VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8) RETURNING id`,
        [
          `${tag.replace(/\D/g, "").slice(-8)}${String(ids.rolls.length + 1).padStart(4, "0")}`,
          product.id,
          locationId,
          state,
          quantity,
          cost,
          quantity * cost,
          tag,
        ],
      );
      const rollId = Number(roll.id);
      ids.rolls.push(rollId);
      const key = `${product.id}:${locationId}`;
      for (const movement of movements) {
        const balance = (balances.get(key) ?? 0) + movement.quantity;
        balances.set(key, balance);
        const inserted = await one(
          `INSERT INTO movimientos
             (rollo_id,producto_id,ubicacion_id,tipo,cantidad,saldo_posterior,
              usuario_id,documento_tipo,documento_id,justificacion)
           VALUES($1,$2,$3,$4,$5,$6,$7,'INTEGRATION_TEST',$8,$8) RETURNING id`,
          [
            rollId,
            product.id,
            locationId,
            movement.type,
            movement.quantity,
            balance,
            adminUser.id,
            tag,
          ],
        );
        ids.movements.push(Number(inserted.id));
      }
    };
    const available = (q: number) => [{ type: "ALTA", quantity: q }];
    await addRoll(0, ownId, "DISPONIBLE", 10, available(10));
    await addRoll(0, ownId, "DISPONIBLE", 15, available(15));
    await addRoll(1, ownId, "DISPONIBLE", 12, available(12));
    await addRoll(1, otherId, "DISPONIBLE", 8, available(8));
    await addRoll(2, ownId, "ABIERTO", 20, [
      { type: "ALTA", quantity: 20 },
      { type: "SALIDA_MOSTRADOR", quantity: -20 },
    ]);
    await addRoll(3, ownId, "DISPONIBLE", 2.5, available(2.5));
    await addRoll(3, ownId, "DISPONIBLE", 3, available(3));
    await addRoll(3, ownId, "DISPONIBLE", 4.5, available(4.5));
    await addRoll(4, transitId, "EN_TRANSITO", 5, [
      { type: "ALTA", quantity: 5 },
      { type: "TRANSFERENCIA_SALIDA", quantity: -5 },
    ], 31);
    await addRoll(4, transitId, "EN_TRANSITO", 6, [
      { type: "ALTA", quantity: 6 },
      { type: "TRANSFERENCIA_SALIDA", quantity: -6 },
    ], 32);
    await addRoll(6, otherId, "DISPONIBLE", 4, available(4));
    await addRoll(7, ownId, "DISPONIBLE", 6, available(6));
    await addRoll(7, ownId, "DISPONIBLE", 9, available(9));
    await addRoll(7, ownId, "ABIERTO", 4, [
      { type: "ALTA", quantity: 4 },
      { type: "SALIDA_MOSTRADOR", quantity: -4 },
    ]);
    await addRoll(8, ownId, "DISPONIBLE", 1.25, available(1.25));
    await addRoll(8, ownId, "DISPONIBLE", 1.75, available(1.75));
    await addRoll(8, otherId, "DISPONIBLE", 3, available(3));

    await guardDatabase();
    await reconstruirCacheExistencias();
    const snapshot = await pool.query(
      `SELECT producto_id,ubicacion_id,cantidad_total::text,rollos_count
       FROM existencias WHERE producto_id=ANY($1::int[]) ORDER BY 1,2`,
      [ids.products],
    );
    await guardDatabase();
    await reconstruirCacheExistencias();
    const secondSnapshot = await pool.query(
      `SELECT producto_id,ubicacion_id,cantidad_total::text,rollos_count
       FROM existencias WHERE producto_id=ANY($1::int[]) ORDER BY 1,2`,
      [ids.products],
    );
    assert.deepEqual(secondSnapshot.rows, snapshot.rows, "cache rebuild must be idempotent");
    const invariant = await pool.query(
      `SELECT e.producto_id,e.ubicacion_id,e.cantidad_total,
              COALESCE(SUM(m.cantidad),0) kardex,
              (SELECT COUNT(*) FROM rollos r WHERE r.producto_id=e.producto_id
                AND r.ubicacion_id=e.ubicacion_id AND r.estado='DISPONIBLE') available
       FROM existencias e LEFT JOIN movimientos m
         ON m.producto_id=e.producto_id AND m.ubicacion_id=e.ubicacion_id
       WHERE e.producto_id=ANY($1::int[])
       GROUP BY e.producto_id,e.ubicacion_id,e.cantidad_total`,
      [ids.products],
    );
    invariant.rows.forEach((row) => {
      assert.equal(rounded(row.cantidad_total), rounded(row.kardex));
      const cached = snapshot.rows.find((candidate) =>
        candidate.producto_id === row.producto_id
        && candidate.ubicacion_id === row.ubicacion_id
      );
      assert.equal(Number(cached?.rollos_count), Number(row.available));
    });

    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const normalizeGrouped = (body: any[]): Map<number, Total> =>
      new Map(body.flatMap((group) => group.colores).map((row: Json) => [
        Number(row.productoId),
        { quantity: rounded(row.cantidadTotal), rolls: Number(row.rollosCount) },
      ]));
    const normalizeProducts = (body: Json[]): Map<number, Total> =>
      new Map(body.map((row) => [
        Number(row.id),
        { quantity: rounded(row.cantidad), rolls: Number(row.rollos) },
      ]));
    const normalizeReport = (body: Json): Map<number, Total> => {
      const rows = body.tables.find((item: Json) => item.id === "existencia-actual")?.rows ?? [];
      const result = new Map<number, Total>();
      for (const row of rows) {
        if (!ids.products.includes(Number(row.productoId))) continue;
        const prior = result.get(Number(row.productoId)) ?? { quantity: 0, rolls: 0 };
        prior.quantity = rounded(prior.quantity + Number(row.cantidad));
        prior.rolls += Number(row.rollos);
        result.set(Number(row.productoId), prior);
      }
      return result;
    };
    const reportPath = (locations: number[]) =>
      `/api/reportes/inventario?periodo=mensual&productoIds=${ids.products.join(",")}`
      + `&ubicacionIds=${locations.join(",")}`;

    for (const actor of [
      { scope: "admin" as const, session: sessions.admin },
      { scope: "own" as const, session: sessions.own },
    ]) {
      const maliciousLocation = actor.scope === "own" ? `&ubicacionId=${otherId}` : "";
      const grouped = await request(
        `/api/inventario/existencias/agrupadas?includeSinExistencia=true${maliciousLocation}`,
        actor.session,
      );
      assertTotals(normalizeGrouped(grouped), products, actor.scope, `${actor.scope} grouped`);

      const dashboardPath = actor.scope === "own"
        ? `/api/dashboard?ubicacionId=${otherId}`
        : "/api/dashboard";
      const vistaGlobal = await request(dashboardPath, actor.session);
      const dashboard = await request(dashboardPath, actor.session);
      assert.deepEqual(dashboard, vistaGlobal, "Dashboard and Vista Global aliases diverged");
      const taggedSites = dashboard.inventarioPorUbicacion.filter(
        (row: Json) => [ownId, otherId].includes(Number(row.ubicacionId)),
      );
      const siteTotals = taggedSites.reduce(
        (sum: { metros: number; kilos: number; rollos: number }, row: Json) => ({
          metros: rounded(sum.metros + Number(row.metros)),
          kilos: rounded(sum.kilos + Number(row.kilos)),
          rollos: sum.rollos + Number(row.rollos),
        }),
        { metros: 0, kilos: 0, rollos: 0 },
      );
      assert.deepEqual(
        siteTotals,
        actor.scope === "admin"
          ? { metros: 60, kilos: 20, rollos: 13 }
          : { metros: 52, kilos: 13, rollos: 10 },
      );
      assert.equal(
        dashboard.inventarioPorUbicacion.some((row: Json) => Number(row.ubicacionId) === otherId),
        actor.scope === "admin",
        `${actor.scope} filtered dashboard unexpectedly exposed another site`,
      );

      const listLocation = actor.scope === "own" ? `&ubicacionId=${otherId}` : "";
      const list = await request(
        `/api/productos?existencia=TODOS${listLocation}`,
        actor.session,
      );
      assertTotals(normalizeProducts(list), products, actor.scope, `${actor.scope} products`);
      for (const product of products) {
        const detail = await request(`/api/productos/${product.id}`, actor.session);
        assert.equal(rounded(detail.cantidad), product[actor.scope].quantity);
        assert.equal(Number(detail.rollos), product[actor.scope].rolls);
        if (actor.scope === "own") {
          assert.ok(detail.inventarioPorUbicacion.every(
            (row: Json) => Number(row.ubicacionId) === ownId,
          ));
          assert.ok(detail.rollosDisponibles.every(
            (row: Json) => Number(row.ubicacionId) === ownId,
          ));
        }
        assert.equal(
          detail.rollosDisponibles.length,
          product[actor.scope].rolls,
          "individual roll links are diagnostic only, but must remain scoped",
        );
      }

      const report = await request(
        reportPath(actor.scope === "admin" ? [ownId, otherId, transitId] : [otherId, transitId]),
        actor.session,
      );
      assertTotals(normalizeReport(report), products, actor.scope, `${actor.scope} report`);
      const kpi = (id: string) =>
        Number(report.kpis.find((item: Json) => item.id === id)?.value ?? 0);
      assert.equal(kpi("existencia-METRO"), actor.scope === "admin" ? 60 : 52);
      assert.equal(kpi("rollos-METRO"), actor.scope === "admin" ? 6 : 5);
      assert.equal(kpi("existencia-KILO"), actor.scope === "admin" ? 20 : 13);
      assert.equal(kpi("rollos-KILO"), actor.scope === "admin" ? 7 : 5);
      assert.equal(kpi("en-contenedor-cantidad-KILO"), actor.scope === "admin" ? 11 : 0);
      assert.equal(kpi("en-contenedor-valor-KILO"), actor.scope === "admin" ? 347 : 0);
    }

    const assertFilter = async (
      session: string,
      scope: "admin" | "own",
      filter: "CON_EXISTENCIA" | "AGOTADOS",
      expectedIndexes: number[],
    ) => {
      const body = await request(
        `/api/productos?existencia=${filter}${scope === "own" ? `&ubicacionId=${otherId}` : ""}`,
        session,
      );
      const tagged = body.filter((row: Json) => ids.products.includes(Number(row.id)));
      assert.deepEqual(
        tagged.map((row: Json) => Number(row.id)).sort((a: number, b: number) => a - b),
        expectedIndexes.map((index) => products[index]!.id).sort((a, b) => a - b),
        `${scope} ${filter}`,
      );
    };
    await assertFilter(sessions.admin, "admin", "CON_EXISTENCIA", [0, 1, 3, 6, 7, 8]);
    await assertFilter(sessions.admin, "admin", "AGOTADOS", [2, 4, 5, 9]);
    await assertFilter(sessions.own, "own", "CON_EXISTENCIA", [0, 1, 3, 7, 8]);
    await assertFilter(sessions.own, "own", "AGOTADOS", [2, 4, 5, 6, 9]);
    for (const index of [5, 9]) {
      const detail = await request(`/api/productos/${products[index]!.id}`, sessions.admin);
      assert.equal(detail.cantidad, "0.000", "catalog-only product must expose explicit zero");
      assert.equal(detail.rollos, 0);
    }
  } finally {
    await closeServer();
    if (ids.sessions.length) {
      await mutate("DELETE FROM sesiones WHERE id=ANY($1::uuid[])", [ids.sessions]);
    }
    if (ids.movements.length) {
      await mutate("DELETE FROM movimientos WHERE id=ANY($1::bigint[])", [ids.movements]);
    }
    if (ids.products.length) {
      await mutate(
        "DELETE FROM existencias WHERE producto_id=ANY($1::int[])",
        [ids.products],
      );
    }
    if (ids.rolls.length) {
      await mutate("DELETE FROM rollos WHERE id=ANY($1::int[])", [ids.rolls]);
    }
    if (ids.users.length) {
      await mutate(
        "DELETE FROM permisos_usuario WHERE usuario_id=ANY($1::int[])",
        [ids.users],
      );
      await mutate("DELETE FROM usuarios WHERE id=ANY($1::int[])", [ids.users]);
    }
    if (ids.products.length) {
      await mutate("DELETE FROM productos WHERE id=ANY($1::int[])", [ids.products]);
    }
    if (ids.locations.length) {
      await mutate("DELETE FROM ubicaciones WHERE id=ANY($1::int[])", [ids.locations]);
    }
    await pool.end();
  }
});