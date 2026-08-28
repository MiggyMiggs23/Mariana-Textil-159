/**
 * Task 54 / Block 6: HTTP verification of every configurable role.
 *
 * This deliberately exercises the real Express application.  The seed matrix
 * is only a default: route middleware and role ceilings remain the authority
 * that this test verifies.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  db,
  productosTable,
  rollosTable,
  sesionesTable,
  ubicacionesTable,
  usuariosTable,
  type RolUsuario,
} from "@workspace/db";
import app from "./app";
import { isSupervisorSensitiveKey } from "./lib/sensitive-data";

type ConfigurableRole =
  | "TERMINAL"
  | "CAJA"
  | "SUPERVISOR"
  | "BODEGA"
  | "SISTEMAS"
  | "CONTADOR";

type HttpResponse = {
  status: number;
  body: unknown;
  cookie: string;
};

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || process.env.REQUIRE_ISOLATED_TEST_DATABASE !== "1") {
  throw new Error(
    "role access integration requires TEST_DATABASE_URL and REQUIRE_ISOLATED_TEST_DATABASE=1",
  );
}

const identity = await db.execute<{ database: string }>(
  sql`SELECT current_database() AS database`,
);
assert.equal(
  identity.rows[0]?.database,
  "task54_e2e",
  "Task 54 must only mutate its disposable task54_e2e database.",
);

const run = `T54${randomUUID().replaceAll("-", "")}`;
const password = "Task54Role!pass";
const rollSerie = `9${run.replace(/\D/g, "").slice(-8)}`;
const createdUserIds: number[] = [];
let createdProductId: number | undefined;
let createdRolloId: number | undefined;
let createdLocationId: number | undefined;
let server: Server | undefined;
let base = "";

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate an HTTP port"));
        return;
      }
      base = `http://127.0.0.1:${address.port}/api`;
      resolve();
    });
    server.on("error", reject);
  });
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<HttpResponse> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const value = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const session = response.headers
    .get("set-cookie")
    ?.match(/mariana_session=([^;]+)/)?.[0];
  return { status: response.status, body: value, cookie: session ?? cookie ?? "" };
}

async function createUser(
  rol: ConfigurableRole,
  ubicacionId: number | null,
): Promise<{ usuario: string }> {
  const usuario = `${rol.toLowerCase()}_${run}`.slice(0, 64).toLowerCase();
  const [user] = await db
    .insert(usuariosTable)
    .values({
      nombre: `Task 54 ${rol}`,
      usuario,
      passwordHash: sql`crypt(${password}, gen_salt('bf', 8))`,
      rol: rol as RolUsuario,
      ubicacionId,
      alcanceConsulta: rol === "BODEGA" ? "PROPIA" : "TODAS",
    })
    .returning({ id: usuariosTable.id });
  assert.ok(user, `could not create ${rol} fixture`);
  createdUserIds.push(user.id);
  return { usuario };
}

function assertNoMoneyFields(value: unknown, path = "response"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoMoneyFields(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    assert.equal(
      isSupervisorSensitiveKey(key),
      false,
      `non-financial response leaked money field ${path}.${key}`,
    );
    assertNoMoneyFields(nested, `${path}.${key}`);
  }
}

async function cleanup(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  if (createdRolloId != null) {
    await db.delete(rollosTable).where(eq(rollosTable.id, createdRolloId));
  }
  if (createdProductId != null) {
    await db.delete(productosTable).where(eq(productosTable.id, createdProductId));
  }
  if (createdLocationId != null) {
    await db.delete(ubicacionesTable).where(eq(ubicacionesTable.id, createdLocationId));
  }
  for (const userId of createdUserIds) {
    await db.delete(sesionesTable).where(eq(sesionesTable.usuarioId, userId));
    try {
      await db.delete(usuariosTable).where(eq(usuariosTable.id, userId));
    } catch (error) {
      // Login attempts are append-only audit events. Their foreign key retains
      // this disposable fixture user, which is expected on the test branch.
      assert.equal(
        (error as { cause?: { code?: string } }).cause?.code,
        "23503",
        "fixture cleanup failed for a reason other than the immutable audit log",
      );
    }
  }
}

test("Task 54 Block 6: configurable roles have real HTTP access boundaries", async () => {
  const results: Array<{
    role: ConfigurableRole;
    login: number;
    allowed: string;
    allowedStatus: number;
    denied: string;
    deniedStatus: number;
    money: string;
  }> = [];

  try {
    const [location] = await db
      .select({ id: ubicacionesTable.id })
      .from(ubicacionesTable)
      .where(eq(ubicacionesTable.tipo, "TIENDA"))
      .limit(1);
    assert.ok(location, "seed must provide a TIENDA location");

    const [product] = await db
      .insert(productosTable)
      .values({
        sku: `T54-${run}`.slice(0, 64),
        tela: "Task 54 fabric",
        color: run,
        unidad: "METRO",
        precioSugerido: "125.00",
      })
      .returning({ id: productosTable.id });
    assert.ok(product, "could not create product fixture");
    createdProductId = product.id;

    const [rollo] = await db
      .insert(rollosTable)
      .values({
        serie: rollSerie,
        productoId: product.id,
        ubicacionId: location.id,
        estado: "DISPONIBLE",
        cantidadInicial: "10.000",
        cantidadActual: "10.000",
        costoUnitario: "100.00",
        costoTotal: "1000.00",
      })
      .returning({ id: rollosTable.id });
    assert.ok(rollo, "could not create roll fixture");
    createdRolloId = rollo.id;

    const roleUsers = {
      TERMINAL: await createUser("TERMINAL", location.id),
      CAJA: await createUser("CAJA", location.id),
      SUPERVISOR: await createUser("SUPERVISOR", null),
      BODEGA: await createUser("BODEGA", location.id),
      SISTEMAS: await createUser("SISTEMAS", null),
      CONTADOR: await createUser("CONTADOR", null),
    } satisfies Record<ConfigurableRole, { usuario: string }>;

    await startServer();

    const cases: Array<{
      role: ConfigurableRole;
      allowed: { method: string; path: string };
      denied: { method: string; path: string };
      mustHideMoney: boolean;
    }> = [
      // Terminal and Bodega can consult stock, but neither may see its value.
      { role: "TERMINAL", allowed: { method: "GET", path: `/inventario/rollos?serie=${rollSerie}` }, denied: { method: "GET", path: "/proveedores" }, mustHideMoney: true },
      { role: "CAJA", allowed: { method: "GET", path: "/inventario/rollos" }, denied: { method: "GET", path: "/productos" }, mustHideMoney: false },
      // The server ceiling must keep SUPERVISOR out of financial supplier data.
      { role: "SUPERVISOR", allowed: { method: "GET", path: "/proveedores" }, denied: { method: "GET", path: "/proveedores/resumen" }, mustHideMoney: true },
      { role: "BODEGA", allowed: { method: "GET", path: `/inventario/rollos?serie=${rollSerie}` }, denied: { method: "GET", path: "/proveedores" }, mustHideMoney: true },
      { role: "SISTEMAS", allowed: { method: "GET", path: "/users" }, denied: { method: "POST", path: "/pos/validar-precio" }, mustHideMoney: false },
      { role: "CONTADOR", allowed: { method: "GET", path: "/proveedores/resumen" }, denied: { method: "GET", path: "/users" }, mustHideMoney: false },
    ];

    for (const roleCase of cases) {
      const user = roleUsers[roleCase.role];
      const login = await request("POST", "/auth/login", {
        usuario: user.usuario,
        password,
      });
      assert.equal(login.status, 200, `${roleCase.role} could not log in`);

      const allowed = await request(
        roleCase.allowed.method,
        roleCase.allowed.path,
        undefined,
        login.cookie,
      );
      assert.equal(
        allowed.status,
        200,
        `${roleCase.role} should reach ${roleCase.allowed.path}: ${JSON.stringify(allowed.body)}`,
      );
      if (roleCase.mustHideMoney) assertNoMoneyFields(allowed.body);

      const denied = await request(
        roleCase.denied.method,
        roleCase.denied.path,
        roleCase.denied.method === "POST" ? {} : undefined,
        login.cookie,
      );
      assert.equal(
        denied.status,
        403,
        `${roleCase.role} must be denied ${roleCase.denied.path}: ${JSON.stringify(denied.body)}`,
      );

      results.push({
        role: roleCase.role,
        login: login.status,
        allowed: `${roleCase.allowed.method} ${roleCase.allowed.path}`,
        allowedStatus: allowed.status,
        denied: `${roleCase.denied.method} ${roleCase.denied.path}`,
        deniedStatus: denied.status,
        money: roleCase.mustHideMoney ? "redacted" : "entitled",
      });

      if (roleCase.role === "SISTEMAS") {
        const prices = await request("GET", "/precios", undefined, login.cookie);
        assert.equal(prices.status, 200, "SISTEMAS should read prices");

        const invalidPriceChange = await request(
          "POST",
          `/precios/${product.id}/cambiar`,
          {},
          login.cookie,
        );
        assert.equal(
          invalidPriceChange.status,
          400,
          "SISTEMAS should pass prices/edit permission before body validation",
        );

        const createdLocation = await request(
          "POST",
          "/locations",
          {
            nombre: `Task 54 site ${run}`,
            iniciales: "TQZ",
            tipo: "BODEGA",
          },
          login.cookie,
        );
        assert.equal(
          createdLocation.status,
          201,
          `SISTEMAS should create locations: ${JSON.stringify(createdLocation.body)}`,
        );
        createdLocationId = Number(
          (createdLocation.body as { id?: number }).id,
        );
        assert.ok(createdLocationId, "created location id is required");

        const updatedLocation = await request(
          "PATCH",
          `/locations/${createdLocationId}`,
          { nombre: `Task 54 updated ${run}` },
          login.cookie,
        );
        assert.equal(
          updatedLocation.status,
          200,
          `SISTEMAS should edit locations: ${JSON.stringify(updatedLocation.body)}`,
        );
      }

      if (roleCase.role === "CONTADOR") {
        const prices = await request("GET", "/precios", undefined, login.cookie);
        assert.equal(prices.status, 200, "CONTADOR should read prices");

        const priceChange = await request(
          "POST",
          `/precios/${product.id}/cambiar`,
          {},
          login.cookie,
        );
        assert.equal(priceChange.status, 403, "CONTADOR must not edit prices");
      }
    }
  } finally {
    console.table(results);
    await cleanup();
  }
});