import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV !== "test" || !testUrl) {
  throw new Error(
    "Productos cache integration requires NODE_ENV=test and explicit TEST_DATABASE_URL.",
  );
}
if (testUrl === appUrl) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}
const expectedDb = decodeURIComponent(new URL(testUrl).pathname.slice(1));
if (!expectedDb) {
  throw new Error("TEST_DATABASE_URL must name an isolated database.");
}
if (appUrl) {
  const appDb = decodeURIComponent(new URL(appUrl).pathname.slice(1));
  if (appDb === expectedDb) {
    throw new Error(
      "TEST_DATABASE_URL must name a database different from the application database.",
    );
  }
}

test("Block 2 products use scoped existencias cache and redact TERMINAL finances", async () => {
  const { pool } = await import("@workspace/db");
  const { default: app } = await import("./app");
  const tag = `PRODUCTOS-CACHE-IT-${randomUUID()}`;
  const created = {
    locations: [] as number[],
    users: [] as number[],
    sessions: [] as string[],
    products: [] as number[],
    rolls: [] as number[],
  };
  let server: Server | undefined;
  let baseUrl = "";

  const mutate = async (text: string, values: unknown[] = []) => {
    const identity = await pool.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    assert.equal(
      identity.rows[0]?.database,
      expectedDb,
      "Refusing fixture mutation outside TEST_DATABASE_URL.",
    );
    return pool.query(text, values);
  };
  const one = async (text: string, values: unknown[] = []) =>
    (await mutate(text, values)).rows[0]!;
  const request = async (path: string, session: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: `mariana_session=${session}` },
    });
    const body = await response.json() as unknown;
    assert.equal(response.status, 200, JSON.stringify(body));
    return body;
  };
  const findProduct = (body: unknown, id: number) => {
    assert.ok(Array.isArray(body));
    return body.find((item) =>
      typeof item === "object" && item !== null
      && (item as { id?: unknown }).id === id
    ) as Record<string, unknown> | undefined;
  };
  const assertNoFinancialKeys = (value: unknown, path = "response"): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => assertNoFinancialKeys(item, `${path}[${index}]`));
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const normalized = key.replace(/[_\-\s]/g, "").toLowerCase();
      assert.equal(
        normalized.includes("precio") || normalized.includes("costo"),
        false,
        `TERMINAL leaked financial field ${path}.${key}`,
      );
      assertNoFinancialKeys(nested, `${path}.${key}`);
    }
  };

  try {
    const ownSite = await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'BODEGA',true) RETURNING id",
      [`${tag} propia`],
    );
    const otherSite = await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'TIENDA',true) RETURNING id",
      [`${tag} ajena`],
    );
    const zeroSite = await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'TIENDA',true) RETURNING id",
      [`${tag} cero`],
    );
    const inactiveSite = await one(
      "INSERT INTO ubicaciones(nombre,tipo,activa) VALUES($1,'BODEGA',false) RETURNING id",
      [`${tag} inactiva`],
    );
    created.locations.push(
      Number(ownSite.id),
      Number(otherSite.id),
      Number(zeroSite.id),
      Number(inactiveSite.id),
    );

    const stocked = await one(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo)
       VALUES($1,$2,$3,'METRO','123.45',true) RETURNING id`,
      [`${tag}-STOCK`, `${tag} tela stock`, `${tag} azul`],
    );
    const zero = await one(
      `INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,activo)
       VALUES($1,$2,$3,'METRO','87.65',true) RETURNING id`,
      [`${tag}-ZERO`, `${tag} tela cero`, `${tag} gris`],
    );
    created.products.push(Number(stocked.id), Number(zero.id));

    await mutate(
      `INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count)
       VALUES($1,$2,'5.000',2),($1,$3,'7.000',1)`,
      [stocked.id, ownSite.id, otherSite.id],
    );
    for (const [suffix, locationId, estado, cantidad] of [
      ["DISP-OWN", ownSite.id, "DISPONIBLE", "1.500"],
      ["DISP-OTHER", otherSite.id, "DISPONIBLE", "2.500"],
      ["COUNTER", ownSite.id, "MOSTRADOR", "0.000"],
      ["TRANSIT", otherSite.id, "EN_TRANSITO", "88.000"],
    ] as const) {
      const roll = await one(
        `INSERT INTO rollos
          (serie,producto_id,ubicacion_id,estado,cantidad_inicial,cantidad_actual)
         VALUES($1,$2,$3,$4,$5,$5) RETURNING id`,
        [`${tag}-${suffix}`, stocked.id, locationId, estado, cantidad],
      );
      created.rolls.push(Number(roll.id));
    }

    const actors: Record<"ADMIN" | "BODEGA" | "TERMINAL", string> = {
      ADMIN: "",
      BODEGA: "",
      TERMINAL: "",
    };
    for (const role of ["ADMIN", "BODEGA", "TERMINAL"] as const) {
      const user = await one(
        `INSERT INTO usuarios
          (nombre,usuario,password_hash,rol,ubicacion_id,activo,alcance_consulta)
         VALUES($1,$2,'integration-session-only',$3,$4,true,$5) RETURNING id`,
        [
          `${tag} ${role}`,
          `${tag}-${role}`.toLowerCase(),
          role,
          role === "ADMIN" ? null : ownSite.id,
          role === "ADMIN" ? "TODAS" : "PROPIA",
        ],
      );
      created.users.push(Number(user.id));
      if (role !== "ADMIN") {
        await mutate(
          `INSERT INTO permisos_usuario
            (usuario_id,modulo,puede_ver,puede_crear,puede_editar,puede_autorizar)
           VALUES($1,'productos',true,false,false,false)`,
          [user.id],
        );
      }
      const session = randomUUID();
      actors[role] = session;
      created.sessions.push(session);
      await mutate(
        `INSERT INTO sesiones(id,usuario_id,expira_at,ip,user_agent)
         VALUES($1,$2,now()+interval '1 hour','127.0.0.1',$3)`,
        [session, user.id, tag],
      );
    }

    server = createServer(app);
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const todos = await request("/api/productos?existencia=TODOS", actors.ADMIN);
    assert.deepEqual(
      findProduct(todos, Number(stocked.id)),
      {
        id: Number(stocked.id),
        sku: `${tag}-STOCK`,
        tela: `${tag} tela stock`,
        color: `${tag} azul`,
        unidad: "METRO",
        precioSugerido: "123.45",
        notas: null,
        activo: true,
        rollos: 3,
        cantidad: "12.000",
        sitiosConExistencia: 2,
        createdAt: (findProduct(todos, Number(stocked.id)) as { createdAt: string }).createdAt,
        updatedAt: (findProduct(todos, Number(stocked.id)) as { updatedAt: string }).updatedAt,
      },
    );
    assert.ok(findProduct(todos, Number(zero.id)), "TODOS must retain zero product");

    const agotados = await request("/api/productos?existencia=AGOTADOS", actors.ADMIN);
    assert.ok(findProduct(agotados, Number(zero.id)), "AGOTADOS must retain zero product");
    assert.equal(findProduct(agotados, Number(stocked.id)), undefined);
    const conExistencia = await request(
      `/api/productos?existencia=CON_EXISTENCIA&ubicacionId=${ownSite.id}`,
      actors.ADMIN,
    );
    const ownListProduct = findProduct(conExistencia, Number(stocked.id));
    assert.equal(ownListProduct?.cantidad, "5.000");
    assert.equal(ownListProduct?.rollos, 2);
    assert.equal(ownListProduct?.sitiosConExistencia, 1);
    assert.equal(findProduct(conExistencia, Number(zero.id)), undefined);

    const detail = await request(`/api/productos/${stocked.id}`, actors.ADMIN) as {
      rollos: number;
      cantidad: string;
      sitiosConExistencia: number;
      inventarioPorUbicacion: Array<Record<string, unknown>>;
      rollosDisponibles: Array<Record<string, unknown>>;
    };
    assert.equal(detail.rollos, 3);
    assert.equal(detail.cantidad, "12.000");
    assert.equal(detail.sitiosConExistencia, 2);
    const bySite = new Map(detail.inventarioPorUbicacion.map((site) => [
      Number(site.ubicacionId), site,
    ]));
    assert.deepEqual(
      { rollos: bySite.get(Number(zeroSite.id))?.rollos, cantidad: bySite.get(Number(zeroSite.id))?.cantidad },
      { rollos: 0, cantidad: "0.000" },
    );
    assert.equal(bySite.has(Number(inactiveSite.id)), false);
    assert.deepEqual(
      new Set(detail.rollosDisponibles.map((roll) => roll.serie)),
      new Set([`${tag}-DISP-OWN`, `${tag}-DISP-OTHER`]),
    );
    detail.rollosDisponibles.forEach((roll) =>
      assert.equal(roll.estado, "DISPONIBLE")
    );

    const propiaList = await request(
      `/api/productos?existencia=TODOS&ubicacionId=${otherSite.id}`,
      actors.BODEGA,
    );
    const propiaProduct = findProduct(propiaList, Number(stocked.id));
    assert.equal(propiaProduct?.cantidad, "5.000");
    assert.equal(propiaProduct?.rollos, 2);
    assert.equal(propiaProduct?.sitiosConExistencia, 1);
    const propiaDetail = await request(
      `/api/productos/${stocked.id}`,
      actors.BODEGA,
    ) as {
      inventarioPorUbicacion: Array<{ ubicacionId: number }>;
      rollosDisponibles: Array<{ serie: string; ubicacionId: number }>;
    };
    assert.deepEqual(
      propiaDetail.inventarioPorUbicacion.map((site) => site.ubicacionId),
      [Number(ownSite.id)],
    );
    assert.deepEqual(
      propiaDetail.rollosDisponibles.map((roll) => roll.serie),
      [`${tag}-DISP-OWN`],
    );
    assert.ok(propiaDetail.rollosDisponibles.every(
      (roll) => roll.ubicacionId === Number(ownSite.id),
    ));

    const terminalList = await request(
      "/api/productos?existencia=TODOS",
      actors.TERMINAL,
    );
    assertNoFinancialKeys(terminalList);
    const terminalDetail = await request(
      `/api/productos/${stocked.id}`,
      actors.TERMINAL,
    );
    assertNoFinancialKeys(terminalDetail);
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    if (created.sessions.length) {
      await mutate("DELETE FROM sesiones WHERE id = ANY($1::uuid[])", [created.sessions]);
    }
    if (created.users.length) {
      await mutate("DELETE FROM permisos_usuario WHERE usuario_id = ANY($1::int[])", [created.users]);
    }
    if (created.products.length) {
      await mutate("DELETE FROM existencias WHERE producto_id = ANY($1::int[])", [created.products]);
    }
    if (created.rolls.length) {
      await mutate("DELETE FROM rollos WHERE id = ANY($1::int[])", [created.rolls]);
    }
    if (created.products.length) {
      await mutate("DELETE FROM productos WHERE id = ANY($1::int[])", [created.products]);
    }
    if (created.users.length) {
      await mutate("DELETE FROM usuarios WHERE id = ANY($1::int[])", [created.users]);
    }
    if (created.locations.length) {
      await mutate("DELETE FROM ubicaciones WHERE id = ANY($1::int[])", [created.locations]);
    }
    await pool.end();
  }
});