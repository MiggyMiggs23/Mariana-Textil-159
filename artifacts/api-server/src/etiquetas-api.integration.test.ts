import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test, { after, before } from "node:test";
import ExcelJS from "exceljs";
import { inArray, sql } from "drizzle-orm";
import {
  db,
  ensureEtiquetasSchema,
  entradasTable,
  permisosUsuarioTable,
  pool,
  productosTable,
  reimpresionesEtiquetaTable,
  rollosTable,
  sesionesTable,
  ubicacionesTable,
  usuariosTable,
  type RolUsuario,
} from "@workspace/db";
import app from "./app";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error("Etiquetas integration requiere NODE_ENV=test y TEST_DATABASE_URL.");
}
// @workspace/db refuses to initialize test files when TEST_DATABASE_URL is
// missing or equals the original DATABASE_URL, before exporting this pool.

const run = `ETQ-${randomUUID()}`;
const password = "Etiquetas-Test-2026!";
const created = {
  locations: [] as number[],
  products: [] as number[],
  entries: [] as number[],
  rolls: [] as number[],
  users: [] as number[],
  sessions: [] as string[],
};
let server: Server | undefined;
let baseUrl = "";
let ownSite = 0;
let otherSite = 0;
let productId = 0;
let entryFolio = 0;
let ownRolls: Array<{ id: number; serie: string }> = [];
let otherRoll: { id: number; serie: string };
let admin: Actor;
let bodega: Actor;
let inventarios: Actor;
let terminal: Actor;
let caja: Actor;
let nonAdminAuthorizer: Actor;

type Actor = {
  id: number;
  usuario: string;
  password: string;
  cookie: string;
  rol: RolUsuario;
};

async function actor(
  rol: RolUsuario,
  ubicacionId: number | null,
  alcanceConsulta: "PROPIA" | "TODAS" = "PROPIA",
): Promise<Actor> {
  const usuario = `${rol}-${randomUUID()}`.toLowerCase();
  const [row] = await db
    .insert(usuariosTable)
    .values({
      nombre: `${rol} ${run}`,
      usuario,
      passwordHash: sql`crypt(${password}, gen_salt('bf', 8))`,
      rol,
      ubicacionId,
      alcanceConsulta,
      activo: true,
    })
    .returning({ id: usuariosTable.id });
  assert.ok(row);
  created.users.push(row.id);
  const sessionId = randomUUID();
  await db.insert(sesionesTable).values({
    id: sessionId,
    usuarioId: row.id,
    expiraAt: new Date(Date.now() + 3_600_000),
    ip: "127.0.0.1",
    userAgent: "etiquetas-integration",
  });
  created.sessions.push(sessionId);
  return {
    id: row.id,
    usuario,
    password,
    cookie: `mariana_session=${sessionId}`,
    rol,
  };
}

async function api(
  method: string,
  path: string,
  who: Actor,
  body?: unknown,
): Promise<{ status: number; body: any; response: Response }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: who.cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const parsed = contentType.includes("application/json")
    ? await response.json()
    : null;
  return { status: response.status, body: parsed, response };
}

const validReason = "Etiqueta dañada durante manejo";

before(async () => {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await ensureEtiquetasSchema(pool);

  const locations = await db
    .insert(ubicacionesTable)
    .values([
      { nombre: `Sitio propio ${run}`, tipo: "BODEGA", activa: true },
      { nombre: `Sitio ajeno ${run}`, tipo: "TIENDA", activa: true },
    ])
    .returning({ id: ubicacionesTable.id });
  assert.equal(locations.length, 2);
  ownSite = locations[0]!.id;
  otherSite = locations[1]!.id;
  created.locations.push(ownSite, otherSite);

  const [product] = await db
    .insert(productosTable)
    .values({
      sku: `SKU-${run}`,
      tela: `Lino ${run}`,
      color: `Azul ${run}`,
      unidad: "METRO",
      precioSugerido: "125.00",
    })
    .returning({ id: productosTable.id });
  assert.ok(product);
  productId = product.id;
  created.products.push(productId);

  admin = await actor("ADMIN", ownSite, "TODAS");
  bodega = await actor("BODEGA", ownSite, "PROPIA");
  inventarios = await actor("INVENTARIOS", ownSite, "PROPIA");
  terminal = await actor("TERMINAL", ownSite, "PROPIA");
  caja = await actor("CAJA", ownSite, "PROPIA");
  nonAdminAuthorizer = await actor("INVENTARIOS", ownSite, "PROPIA");
  await db.insert(permisosUsuarioTable).values([
    {
      usuarioId: bodega.id,
      modulo: "etiquetas",
      puedeVer: true,
      puedeCrear: true,
    },
    {
      usuarioId: inventarios.id,
      modulo: "etiquetas",
      puedeVer: true,
      puedeCrear: true,
    },
    {
      usuarioId: terminal.id,
      modulo: "etiquetas",
      puedeVer: false,
      puedeCrear: false,
    },
    {
      usuarioId: caja.id,
      modulo: "etiquetas",
      puedeVer: false,
      puedeCrear: false,
    },
  ]);

  entryFolio = 1_500_000_000 + Math.floor(Math.random() * 100_000_000);
  const [entry] = await db
    .insert(entradasTable)
    .values({
      folio: entryFolio,
      ubicacionId: ownSite,
      usuarioId: admin.id,
      fecha: new Date(),
      totalRollos: 56,
      totalCosto: "5600.00",
      uuidCliente: randomUUID(),
    })
    .returning({ id: entradasTable.id });
  assert.ok(entry);
  created.entries.push(entry.id);

  const rolls = await db
    .insert(rollosTable)
    .values(
      Array.from({ length: 55 }, (_, index) => ({
        serie: `${run}-${String(index + 1).padStart(3, "0")}`,
        productoId: productId,
        ubicacionId: ownSite,
        recepcionId: entry.id,
        estado: "DISPONIBLE" as const,
        cantidadInicial: "20.000",
        cantidadActual: "20.000",
      })),
    )
    .returning({ id: rollosTable.id, serie: rollosTable.serie });
  ownRolls = rolls;
  created.rolls.push(...rolls.map(({ id }) => id));

  const [remote] = await db
    .insert(rollosTable)
    .values({
      serie: `${run}-REMOTE`,
      productoId: productId,
      ubicacionId: otherSite,
      recepcionId: entry.id,
      estado: "DISPONIBLE",
      cantidadInicial: "30.000",
      cantidadActual: "30.000",
    })
    .returning({ id: rollosTable.id, serie: rollosTable.serie });
  assert.ok(remote);
  otherRoll = remote;
  created.rolls.push(remote.id);

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      assert.ok(address && typeof address !== "string");
      baseUrl = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
  });
});

after(async () => {
  try {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    }
  } finally {
    try {
      if (created.rolls.length) {
        await db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL app.etiquetas_cleanup = 'on'`);
          await tx
            .delete(reimpresionesEtiquetaTable)
            .where(inArray(reimpresionesEtiquetaTable.rolloId, created.rolls));
        });
        await db.delete(rollosTable).where(inArray(rollosTable.id, created.rolls));
      }
      if (created.entries.length)
        await db.delete(entradasTable).where(inArray(entradasTable.id, created.entries));
      if (created.sessions.length)
        await db.delete(sesionesTable).where(inArray(sesionesTable.id, created.sessions));
      if (created.users.length) {
        await db
          .delete(permisosUsuarioTable)
          .where(inArray(permisosUsuarioTable.usuarioId, created.users));
        await db.delete(usuariosTable).where(inArray(usuariosTable.id, created.users));
      }
      if (created.products.length)
        await db.delete(productosTable).where(inArray(productosTable.id, created.products));
      if (created.locations.length)
        await db.delete(ubicacionesTable).where(inArray(ubicacionesTable.id, created.locations));
    } finally {
      await pool.end();
    }
  }
});

test("Etiquetas HTTP + DB: casos obligatorios 1-24", async (t) => {
  await t.test("1 búsqueda por serie exacta", async () => {
    const result = await api("GET", `/etiquetas/rollos?q=${ownRolls[0]!.serie}`, admin);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.items.map((item: any) => item.id), [ownRolls[0]!.id]);
  });
  await t.test("2 búsqueda por SKU y total real aunque la página limite a 50", async () => {
    const result = await api("GET", `/etiquetas/rollos?q=${encodeURIComponent(`SKU-${run}`)}`, admin);
    assert.equal(result.status, 200);
    assert.equal(result.body.items.length, 50);
    assert.equal(result.body.total, 56);
  });
  await t.test("3 búsqueda por tela y color", async () => {
    for (const term of [`Lino ${run}`, `Azul ${run}`]) {
      const result = await api("GET", `/etiquetas/rollos?q=${encodeURIComponent(term)}`, admin);
      assert.equal(result.status, 200);
      assert.ok(result.body.items.length > 0);
      assert.ok(result.body.items.every((item: any) => item.productoId === productId));
    }
  });
  await t.test("4 búsqueda por QR SKU-SERIE", async () => {
    const qr = `SKU-${run}-${ownRolls[1]!.serie}`;
    const result = await api("GET", `/etiquetas/rollos?q=${encodeURIComponent(qr)}`, admin);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.items.map((item: any) => item.id), [ownRolls[1]!.id]);
  });
  await t.test("5 PROPIA ve únicamente rollos del sitio asignado", async () => {
    const result = await api("GET", "/etiquetas/rollos", bodega);
    assert.equal(result.status, 200);
    assert.ok(result.body.items.every((item: any) => item.sitioId === ownSite));
    assert.equal(result.body.total, 55);
  });
  await t.test("6 PROPIA no puede sobreescribir alcance mandando otro sitio", async () => {
    const result = await api("GET", `/etiquetas/rollos?sitioId=${otherSite}`, bodega);
    assert.equal(result.status, 200);
    assert.ok(result.body.items.every((item: any) => item.sitioId === ownSite));
    const hidden = await api("GET", `/etiquetas/rollos?q=${otherRoll.serie}&sitioId=${otherSite}`, bodega);
    assert.equal(hidden.body.total, 0);
  });
  await t.test("7 ADMIN reimprime directamente con motivo", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", admin, {
      rolloIds: [ownRolls[0]!.id],
      motivo: validReason,
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.etiquetas.length, 1);
  });
  await t.test("sitioId arbitrario no es aceptado en el body", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", admin, {
      rolloIds: [ownRolls[4]!.id],
      motivo: validReason,
      sitioId: otherSite,
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "VALIDATION_ERROR");
  });
  await t.test("8 motivo ausente o menor a diez se rechaza", async () => {
    for (const body of [
      { rolloIds: [ownRolls[0]!.id] },
      { rolloIds: [ownRolls[0]!.id], motivo: "corto" },
    ]) {
      assert.equal((await api("POST", "/etiquetas/reimpresiones", admin, body)).status, 400);
    }
  });
  await t.test("9 misma serie, QR y marca REIMPRESA", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", admin, {
      rolloIds: [ownRolls[1]!.id],
      motivo: validReason,
    });
    const label = result.body.etiquetas[0];
    assert.equal(label.serie, ownRolls[1]!.serie);
    assert.equal(label.qr, `SKU-${run}-${ownRolls[1]!.serie}`);
    assert.equal(label.marca, "REIMPRESA");
    assert.match(label.fechaReimpresion, /^\d{4}-\d{2}-\d{2}T/);
  });
  await t.test("10 BODEGA sin credenciales se rechaza", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", bodega, {
      rolloIds: [ownRolls[2]!.id],
      motivo: validReason,
    });
    assert.equal(result.status, 403);
  });
  await t.test("11 BODEGA con contraseña incorrecta se rechaza", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", bodega, {
      rolloIds: [ownRolls[2]!.id],
      motivo: validReason,
      adminUsuario: admin.usuario,
      adminPassword: "incorrecta",
    });
    assert.equal(result.status, 403);
  });
  await t.test("12 credenciales válidas de no-ADMIN se rechazan", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", bodega, {
      rolloIds: [ownRolls[2]!.id],
      motivo: validReason,
      adminUsuario: nonAdminAuthorizer.usuario,
      adminPassword: nonAdminAuthorizer.password,
    });
    assert.equal(result.status, 403);
  });
  await t.test("13 BODEGA con ADMIN válido registra autorizador", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", bodega, {
      rolloIds: [ownRolls[2]!.id],
      motivo: validReason,
      adminUsuario: admin.usuario,
      adminPassword: admin.password,
    });
    assert.equal(result.status, 201);
    const rows = await db
      .select()
      .from(reimpresionesEtiquetaTable)
      .where(sql`${reimpresionesEtiquetaTable.rolloId}=${ownRolls[2]!.id}`);
    assert.equal(rows.at(-1)?.autorizadoPor, admin.id);
  });
  await t.test("14 API directa INVENTARIOS sin credenciales devuelve 403", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", inventarios, {
      rolloIds: [ownRolls[3]!.id],
      motivo: validReason,
    });
    assert.equal(result.status, 403);
  });
  await t.test("15 registro contiene rollo, solicitante, sitio, motivo y fecha", async () => {
    const rows = await db
      .select()
      .from(reimpresionesEtiquetaTable)
      .where(sql`${reimpresionesEtiquetaTable.rolloId}=${ownRolls[2]!.id}`);
    const row = rows.at(-1)!;
    assert.equal(row.usuarioId, bodega.id);
    assert.equal(row.sitioId, ownSite);
    assert.equal(row.motivo, validReason);
    assert.ok(row.createdAt instanceof Date);
  });
  await t.test("auditoría rechaza UPDATE y DELETE directos fuera del bypass de cleanup", async () => {
    const [row] = await db
      .select({ id: reimpresionesEtiquetaTable.id })
      .from(reimpresionesEtiquetaTable)
      .where(sql`${reimpresionesEtiquetaTable.rolloId}=${ownRolls[2]!.id}`)
      .limit(1);
    assert.ok(row);
    await assert.rejects(
      db
        .update(reimpresionesEtiquetaTable)
        .set({ motivo: "No debe cambiar" })
        .where(sql`${reimpresionesEtiquetaTable.id}=${row.id}`),
    );
    await assert.rejects(
      db
        .delete(reimpresionesEtiquetaTable)
        .where(sql`${reimpresionesEtiquetaTable.id}=${row.id}`),
    );
  });
  await t.test("16 historial ADMIN camelCase y export XLSX filtrado", async () => {
    await db
      .update(productosTable)
      .set({ tela: `Nombre cambiado ${run}`, color: `Color cambiado ${run}` })
      .where(sql`${productosTable.id}=${productId}`);
    await db
      .update(usuariosTable)
      .set({ nombre: `Solicitante cambiado ${run}` })
      .where(sql`${usuariosTable.id}=${bodega.id}`);
    const history = await api(
      "GET",
      `/etiquetas/historial?sitioId=${ownSite}&usuarioId=${bodega.id}&productoId=${productId}`,
      admin,
    );
    assert.equal(history.status, 200);
    assert.ok(history.body.items.length > 0);
    const item = history.body.items[0];
    for (const key of ["rolloId", "producto", "sitioId", "usuarioId", "createdAt"])
      assert.ok(key in item, `falta ${key}`);
    assert.ok(!("created_at" in item));
    assert.equal(item.producto, `Lino ${run} Azul ${run}`);
    assert.equal(item.solicito, `BODEGA ${run}`);
    const exported = await fetch(
      `${baseUrl}/etiquetas/historial/export.xlsx?sitioId=${ownSite}&usuarioId=${bodega.id}`,
      { headers: { Cookie: admin.cookie } },
    );
    assert.equal(exported.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exported.arrayBuffer());
    assert.ok((workbook.getWorksheet("Reimpresiones")?.rowCount ?? 0) >= 2);
  });
  await t.test("17 detalle muestra contador y última fecha", async () => {
    const result = await api("GET", `/etiquetas/rollos/${ownRolls[0]!.id}`, admin);
    assert.equal(result.status, 200);
    assert.ok(result.body.reimpresionesCount >= 1);
    assert.ok(result.body.ultimaReimpresion);
  });
  await t.test("18 tercera reimpresión activa aviso y alert count", async () => {
    for (let count = 0; count < 2; count++) {
      assert.equal(
        (
          await api("POST", "/etiquetas/reimpresiones", admin, {
            rolloIds: [ownRolls[0]!.id],
            motivo: validReason,
          })
        ).status,
        201,
      );
    }
    const detail = await api("GET", `/etiquetas/rollos/${ownRolls[0]!.id}`, admin);
    assert.equal(detail.body.reimpresionesCount, 3);
    assert.equal(detail.body.alertaReimpresiones, true);
    const alert = await api("GET", "/etiquetas/alertas/count", admin);
    assert.equal(alert.status, 200);
    assert.ok(alert.body.count >= 1);
  });
  const protectedEndpoints = (rolloId: number) => [
    ["GET", "/etiquetas/rollos", undefined],
    ["GET", `/etiquetas/rollos/${rolloId}`, undefined],
    ["POST", "/etiquetas/reimpresiones", { rolloIds: [rolloId], motivo: validReason }],
    ["GET", "/etiquetas/historial", undefined],
    ["GET", "/etiquetas/historial/export.xlsx", undefined],
    ["GET", "/etiquetas/alertas/count", undefined],
  ] as const;
  await t.test("19 TERMINAL recibe 403 en todos los endpoints", async () => {
    for (const [method, path, body] of protectedEndpoints(ownRolls[0]!.id))
      assert.equal((await api(method, path, terminal, body)).status, 403, `${method} ${path}`);
  });
  await t.test("20 CAJA recibe 403 en todos los endpoints", async () => {
    for (const [method, path, body] of protectedEndpoints(ownRolls[0]!.id))
      assert.equal((await api(method, path, caja, body)).status, 403, `${method} ${path}`);
  });
  await t.test("21 BODEGA no puede consultar historial ni exportarlo", async () => {
    assert.equal((await api("GET", "/etiquetas/historial", bodega)).status, 403);
    assert.equal((await api("GET", "/etiquetas/historial/export.xlsx", bodega)).status, 403);
  });
  const batchIds = () => [...ownRolls.slice(10, 14).map(({ id }) => id), otherRoll.id];
  await t.test("22 batch ADMIN multisite devuelve cinco etiquetas", async () => {
    const result = await api("POST", "/etiquetas/reimpresiones", admin, {
      rolloIds: batchIds(),
      motivo: "Daño por humedad en estiba",
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.etiquetas.length, 5);
    assert.deepEqual(
      new Set(result.body.etiquetas.map((label: any) => label.rolloId)),
      new Set(batchIds()),
    );
  });
  await t.test("23 batch de cinco crea cinco filas con el sitio real de cada rollo", async () => {
    const rows = await db
      .select()
      .from(reimpresionesEtiquetaTable)
      .where(inArray(reimpresionesEtiquetaTable.rolloId, batchIds()));
    assert.equal(rows.length, 5);
    assert.equal(
      rows.find((row) => row.rolloId === otherRoll.id)?.sitioId,
      otherSite,
    );
  });
  await t.test("24 más de 50 rollos se rechazan con 400 y no insertan", async () => {
    const ids = ownRolls.slice(0, 51).map(({ id }) => id);
    const beforeRows = await db
      .select()
      .from(reimpresionesEtiquetaTable)
      .where(inArray(reimpresionesEtiquetaTable.rolloId, ids));
    const result = await api("POST", "/etiquetas/reimpresiones", admin, {
      rolloIds: ids,
      motivo: validReason,
    });
    assert.equal(result.status, 400);
    const afterRows = await db
      .select()
      .from(reimpresionesEtiquetaTable)
      .where(inArray(reimpresionesEtiquetaTable.rolloId, ids));
    assert.equal(afterRows.length, beforeRows.length);
  });
});