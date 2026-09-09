import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  auditoriaTable,
  db,
  ensureEquiposSchema,
  permisosUsuarioTable,
  pool,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import app from "./app";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1") {
  throw new Error(
    "equipos integration requires explicit TEST_DATABASE_URL and REQUIRE_ISOLATED_TEST_DATABASE=1",
  );
}
const identity = await db.execute<{ database: string }>(
  sql`select current_database() as database`,
);
if (identity.rows[0]?.database === "heliumdb") {
  throw new Error("Refusing to run equipos integration against development.");
}

const run = randomUUID().replaceAll("-", "");
let server: Server | undefined;
let baseUrl = "";

async function request(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = (await response.json()) as Record<string, unknown>;
  return {
    status: response.status,
    body: value,
    cookie:
      response.headers
        .get("set-cookie")
        ?.match(/mariana_session=([^;]+)/)?.[0] ??
      cookie ??
      "",
  };
}

async function makeUser(
  suffix: string,
  ubicacionId: number,
  permissions: { crear?: boolean; editar?: boolean },
  rol: "BODEGA" | "SUPERVISOR" = "BODEGA",
  alcanceConsulta: "PROPIA" | "TODAS" = "PROPIA",
) {
  const password = "Equipos!test1";
  const [user] = await db
    .insert(usuariosTable)
    .values({
      nombre: `Equipos ${suffix}`,
      usuario: `equipos_${suffix}_${run}`.slice(0, 64).toLowerCase(),
      passwordHash: sql`crypt(${password}, gen_salt('bf', 8))`,
      rol,
      ubicacionId,
      alcanceConsulta,
    })
    .returning({ id: usuariosTable.id, usuario: usuariosTable.usuario });
  await db.insert(permisosUsuarioTable).values({
    usuarioId: user!.id,
    modulo: "equipos",
    puedeVer: true,
    puedeCrear: permissions.crear ?? false,
    puedeEditar: permissions.editar ?? false,
  });
  return { ...user!, password };
}

test("equipment scope, derived active state, attribution and edit denial", async () => {
  await ensureEquiposSchema(pool);
  await ensureEquiposSchema(pool);
  const initials = (suffix: string) =>
    `${suffix}${run.slice(0, 2)}`.toUpperCase().slice(0, 3);
  const [siteA, siteB, siteC] = await db
    .insert(ubicacionesTable)
    .values([
      {
        nombre: `Equipos A ${run}`,
        iniciales: initials("A"),
        tipo: "TIENDA",
      },
      {
        nombre: `Equipos B ${run}`,
        iniciales: initials("B"),
        tipo: "TIENDA",
      },
      {
        nombre: `Equipos C ${run}`,
        iniciales: initials("C"),
        tipo: "BODEGA",
      },
    ])
    .returning({ id: ubicacionesTable.id });
  const creator = await makeUser("creator", siteA!.id, { crear: true });
  const editor = await makeUser("editor", siteA!.id, { editar: true });
  const viewer = await makeUser("viewer", siteA!.id, {});
  const supervisor = await makeUser(
    "supervisor",
    siteA!.id,
    { editar: true },
    "SUPERVISOR",
  );
  const creatorB = await makeUser("creator_b", siteB!.id, { crear: true });
  const creatorC = await makeUser("creator_c", siteC!.id, { crear: true });
  const catalogUser = await makeUser(
    "catalog",
    siteA!.id,
    {},
    "BODEGA",
    "TODAS",
  );
  await db.insert(permisosUsuarioTable).values({
    usuarioId: catalogUser.id,
    modulo: "inventario",
    puedeVer: false,
  });

  await new Promise<void>((resolve, reject) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate equipment test HTTP port."));
        return;
      }
      baseUrl = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
    server.on("error", reject);
  });

  try {
    const creatorLogin = await request("POST", "/auth/login", {
      usuario: creator.usuario,
      password: creator.password,
    });
    const editorLogin = await request("POST", "/auth/login", {
      usuario: editor.usuario,
      password: editor.password,
    });
    const viewerLogin = await request("POST", "/auth/login", {
      usuario: viewer.usuario,
      password: viewer.password,
    });
    const supervisorLogin = await request("POST", "/auth/login", {
      usuario: supervisor.usuario,
      password: supervisor.password,
    });
    const creatorBLogin = await request("POST", "/auth/login", {
      usuario: creatorB.usuario,
      password: creatorB.password,
    });
    const creatorCLogin = await request("POST", "/auth/login", {
      usuario: creatorC.usuario,
      password: creatorC.password,
    });
    const catalogLogin = await request("POST", "/auth/login", {
      usuario: catalogUser.usuario,
      password: catalogUser.password,
    });
    assert.equal(creatorLogin.status, 200);
    assert.equal(editorLogin.status, 200);
    assert.equal(viewerLogin.status, 200);
    assert.equal(supervisorLogin.status, 200);
    assert.equal(creatorBLogin.status, 200);
    assert.equal(creatorCLogin.status, 200);
    assert.equal(catalogLogin.status, 200);

    assert.equal(
      (
        await request(
          "GET",
          "/inventario/ubicaciones",
          undefined,
          catalogLogin.cookie,
        )
      ).status,
      403,
    );
    const equipmentLocations = await request(
      "GET",
      "/equipos/ubicaciones",
      undefined,
      catalogLogin.cookie,
    );
    assert.equal(equipmentLocations.status, 200);
    const visibleLocationIds = new Set(
      (equipmentLocations.body as unknown as Array<{ id: number }>).map(
        (location) => location.id,
      ),
    );
    assert.equal(visibleLocationIds.has(siteA!.id), true);
    assert.equal(visibleLocationIds.has(siteB!.id), true);
    assert.equal(visibleLocationIds.has(siteC!.id), true);

    const created = await request(
      "POST",
      "/equipos",
      {
        ubicacionId: siteA!.id,
        tipo: "IMPRESORA_TICKETS",
        identificador: "Caja 1",
        marca: "Epson",
        modelo: "TM-T20",
      },
      creatorLogin.cookie,
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.activo, false);
    assert.equal(created.body.faltantes, 2);
    const id = created.body.id as number;
    assert.equal(
      (
        await request(
          "POST",
          "/equipos",
          {
            ubicacionId: siteA!.id,
            tipo: "PISTOLA_ESCANER",
            identificador: "Sin permiso de alta",
            marca: "Prueba",
            modelo: "Prueba",
          },
          editorLogin.cookie,
        )
      ).status,
      403,
    );
    const createdB = await request(
      "POST",
      "/equipos",
      {
        ubicacionId: siteB!.id,
        tipo: "IMPRESORA_ETIQUETAS",
        identificador: "Etiquetas 1",
        marca: "Zebra",
        modelo: "ZD421",
      },
      creatorBLogin.cookie,
    );
    const createdC = await request(
      "POST",
      "/equipos",
      {
        ubicacionId: siteC!.id,
        tipo: "SMARTPHONE_ESCANER",
        identificador: "Escáner móvil 1",
        marca: "Samsung",
        modelo: "A15",
      },
      creatorCLogin.cookie,
    );
    assert.equal(createdB.status, 201);
    assert.equal(createdC.status, 201);

    assert.equal(
      (
        await request(
          "GET",
          `/equipos?ubicacionId=${siteB!.id}`,
          undefined,
          editorLogin.cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/equipos?ubicacionId=${siteB!.id}`,
          undefined,
          supervisorLogin.cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          `/equipos/${createdB.body.id as number}/checklist/ETIQUETA_REAL`,
          { checked: true },
          supervisorLogin.cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          `/equipos/${id}/checklist/TICKET_REAL`,
          { checked: true },
          viewerLogin.cookie,
        )
      ).status,
      403,
    );

    const first = await request(
      "PATCH",
      `/equipos/${id}/checklist/TICKET_REAL`,
      { checked: true, actorId: viewer.id },
      editorLogin.cookie,
    );
    assert.equal(first.status, 400, "client attribution fields are rejected");
    const checked = await request(
      "PATCH",
      `/equipos/${id}/checklist/TICKET_REAL`,
      { checked: true },
      editorLogin.cookie,
    );
    assert.equal(checked.status, 200);
    const item = (checked.body.checklist as Array<Record<string, unknown>>)[0]!;
    assert.equal(item.actorId, editor.id);
    assert.ok(item.checkedAt);
    assert.equal(checked.body.activo, false);

    const completed = await request(
      "PATCH",
      `/equipos/${id}/checklist/PAPEL_80MM`,
      { checked: true },
      editorLogin.cookie,
    );
    assert.equal(completed.body.activo, true);
    assert.equal(completed.body.faltantes, 0);
    const unchecked = await request(
      "PATCH",
      `/equipos/${id}/checklist/PAPEL_80MM`,
      { checked: false },
      editorLogin.cookie,
    );
    assert.equal(unchecked.body.activo, false);

    const history = await db
      .select({ accion: auditoriaTable.accion })
      .from(auditoriaTable)
      .where(eq(auditoriaTable.entidadId, `${id}:PAPEL_80MM`));
    assert.deepEqual(
      history.map((entry) => entry.accion).sort(),
      ["DESPALOMEAR", "PALOMEAR"],
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server?.close((error) => (error ? reject(error) : resolve())),
    );
  }
});