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
  editar: boolean,
) {
  const password = "Equipos!test1";
  const [user] = await db
    .insert(usuariosTable)
    .values({
      nombre: `Equipos ${suffix}`,
      usuario: `equipos_${suffix}_${run}`.slice(0, 64).toLowerCase(),
      passwordHash: sql`crypt(${password}, gen_salt('bf', 8))`,
      rol: "BODEGA",
      ubicacionId,
      alcanceConsulta: "PROPIA",
    })
    .returning({ id: usuariosTable.id, usuario: usuariosTable.usuario });
  await db.insert(permisosUsuarioTable).values({
    usuarioId: user!.id,
    modulo: "equipos",
    puedeVer: true,
    puedeEditar: editar,
  });
  return { ...user!, password };
}

test("equipment scope, derived active state, attribution and edit denial", async () => {
  await ensureEquiposSchema(pool);
  const initials = (suffix: string) =>
    `${suffix}${run.slice(0, 2)}`.toUpperCase().slice(0, 3);
  const [siteA, siteB] = await db
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
    ])
    .returning({ id: ubicacionesTable.id });
  const editor = await makeUser("editor", siteA!.id, true);
  const viewer = await makeUser("viewer", siteA!.id, false);

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
    const editorLogin = await request("POST", "/auth/login", {
      usuario: editor.usuario,
      password: editor.password,
    });
    const viewerLogin = await request("POST", "/auth/login", {
      usuario: viewer.usuario,
      password: viewer.password,
    });
    assert.equal(editorLogin.status, 200);
    assert.equal(viewerLogin.status, 200);

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
      editorLogin.cookie,
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.activo, false);
    assert.equal(created.body.faltantes, 2);
    const id = created.body.id as number;

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