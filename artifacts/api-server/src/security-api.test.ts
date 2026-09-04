/**
 * HTTP/API Security Integration Tests — 29 named scenarios.
 *
 * Spins up the real Express app on an ephemeral port, exercises every
 * scenario through actual HTTP (native fetch), and tears down the server
 * plus every temporary DB row in `finally`, even on failure.
 *
 * Run:
 *   cd /home/runner/workspace/artifacts/api-server
 *   TEST_DATABASE_URL="<isolated-url>" pnpm tsx src/security-api.test.ts
 *
 * Zero extra dependencies — uses only node:http, node:assert, node:crypto
 * and the workspace DB package for setup/teardown helpers.
 *
 * Scenarios:
 *   S-01  All four roles log in → 200 + permisos matrix present
 *   S-02  ADMIN /auth/me → effective matrix has 24 modules, all full
 *   S-03  CAJA /auth/me  → Caja/Inventario/Salidas only; POS and admin modules denied
 *   S-03A Caja tickets route is location-scoped and denied to BODEGA
 *   S-04  BODEGA denied POS  (GET /inventario/rollos → module=inventario OK, but POST vender → 403)
 *   S-05  BODEGA denied clientes → GET /clientes → 403
 *   S-05A BODEGA denied client creation → POST /clientes → 403
 *   S-05B Concurrent normalized client creates return one 201 and one conflict
 *   S-06  CAJA can do POS sale (vender) on own-location rollo
 *   S-07  CAJA denied GET /proveedores → 403
 *   S-08  SUPERVISOR GET /proveedores → 200, response has no financial JSON keys
 *   S-09  BODEGA operational entry catalogs allowed; direct catalogs denied
 *   S-10  Financial proveedor routes denied for SUPERVISOR (proveedores_finanzas)
 *   S-11  Malicious SUPERVISOR finance override remains denied by role ceiling
 *   S-12  ADMIN user-override deny removed → SUPERVISOR inherits role (still denied)
 *   S-13  User override (true) beats role (false): BODEGA clientes 403 → override → 200
 *   S-14  DELETE override → BODEGA clientes reverts to 403
 *   S-15  Deny-by-default: remove BODEGA inventario rol row → 403; restore → 200
 *   S-16  ADMIN cannot be added to the role matrix; access remains full without rows
 *   S-17  ADMIN ignores an inconsistent false override
 *   S-18  Self-modification blocked: admin tries PUT /permisos/usuarios/:ownId → 403
 *   S-19  Last active ADMIN: PATCH /users/:id activo=false → 409
 *   S-20  BODEGA PROPIA: GET /inventario/rollos?ubicacionId=other → returns only own
 *   S-21  BODEGA PROPIA: GET /inventario/existencias?ubicacionId=other → returns only own
 *   S-22  BODEGA PROPIA: GET /inventario/kardex with otherUbicacion → returns own only
 *   S-23  TODAS user can request specific ubicacionId on rollos/existencias/entradas
 *   S-24  Non-ADMIN mutation on other location → 403; ADMIN same → succeeds
 *   S-25  GET /clientes/:id — no limiteCredito / saldoCredito in response
 *   S-26  /clientes/:id/credito gated by clientes_credito; /precios by clientes_precios
 *   S-27  SALIDA_MOSTRADOR reversal fails (MOSTRADOR stays); VENTA+BAJA revert + kardex/cache reconcile
 *   S-28  Non-ADMIN with delegated usuarios permissions cannot escalate to ADMIN
 *   S-29  Promotion to ADMIN removes overrides and override endpoints reject ADMIN targets
 */

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  entradasTable,
  auditoriaTable,
  ensureClientesSchema,
  ensureSalidasSchema,
  ensureSupervisorRole,
  existenciasTable,
  movimientosTable,
  permisosRolTable,
  permisosUsuarioTable,
  productosTable,
  proveedoresTable,
  pool,
  rollosTable,
  salidaLineasTable,
  salidaRollosTable,
  salidasTable,
  sesionesCajaTable,
  sesionesTable,
  ticketLineasTable,
  ticketsTable,
  ubicacionesTable,
  usuariosTable,
  type RolUsuario,
} from "@workspace/db";
import { MODULOS } from "./lib/permisos";
import { isSupervisorSensitiveKey } from "./lib/sensitive-data";
import { ABSOLUTE_SESSION_MS, INACTIVITY_MS } from "./middlewares/auth";
import app from "./app";
import { crearEntrada, crearRollo } from "./lib/inventario";
import ExcelJS from "exceljs";

// ─── Test Harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const scenarioFilter = process.env.SECURITY_SCENARIO;
  if (scenarioFilter && !name.includes(scenarioFilter)) return;
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    passed++;
  } catch (err) {
    const msg = (err as Error).stack ?? (err as Error).message;
    process.stdout.write(`  ✗ ${name}\n    ${msg}\n`);
    failures.push(`${name}: ${msg}`);
    failed++;
  }
}

// ─── Ephemeral Server ──────────────────────────────────────────────────────────

let server: Server;
let BASE: string;

async function startServer(): Promise<void> {
  await ensureSupervisorRole(pool);
  await ensureClientesSchema(pool);
  await ensureSalidasSchema(pool);
  return new Promise((resolve, reject) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Could not determine server address"));
        return;
      }
      BASE = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
    server.on("error", reject);
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) { resolve(); return; }
    server.close(() => resolve());
  });
}

// ─── Tracked fixtures (cleaned up in finally) ─────────────────────────────────

const createdUserIds: number[] = [];
const createdUbicacionIds: number[] = [];
const createdProductoIds: number[] = [];
const createdRolloIds: number[] = [];
const createdProveedorIds: number[] = [];
const createdPermisosUsuarioIds: number[] = [];
const createdClienteIds: number[] = [];
const createdEntradaIds: number[] = [];
const createdSesionCajaIds: number[] = [];
const createdSalidaIds: number[] = [];
// Rol-level rows we temporarily delete, stored as {rol, modulo, ...original}
type RolRowBackup = {
  rol: RolUsuario;
  modulo: string;
  puedeVer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeAutorizar: boolean;
};
const deletedRolRows: RolRowBackup[] = [];

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

type FetchResult = {
  status: number;
  body: unknown;
  cookie: string;
  setCookie: string;
  contentType: string;
};

async function api(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed: unknown;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    parsed = await res.json();
  } else {
    parsed = await res.text();
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  // Extract session cookie from set-cookie header
  const match = setCookie.match(/mariana_session=([^;]+)/);
  const sessionCookie = match ? `mariana_session=${match[1]}` : (cookie ?? "");
  return {
    status: res.status,
    body: parsed,
    cookie: sessionCookie,
    setCookie,
    contentType: ct,
  };
}

async function login(usuario: string, password: string): Promise<FetchResult> {
  return api("POST", "/auth/login", { usuario, password });
}

async function download(path: string, cookie: string) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie },
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}

function assertNoTerminalSensitiveKeys(
  value: unknown,
  path = "response",
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoTerminalSensitiveKeys(item, `${path}[${index}]`),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const normalized = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    assert.ok(
      !normalized.includes("costo") &&
        !normalized.includes("margen") &&
        !normalized.includes("utilidad"),
      `TERMINAL response must omit sensitive key ${path}.${key}`,
    );
    assertNoTerminalSensitiveKeys(nested, `${path}.${key}`);
  }
}

function assertNoSupervisorSensitiveKeys(
  value: unknown,
  path = "response",
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSupervisorSensitiveKeys(item, `${path}[${index}]`),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    assert.equal(
      isSupervisorSensitiveKey(key),
      false,
      `SUPERVISOR response leaked sensitive key ${path}.${key}`,
    );
    assertNoSupervisorSensitiveKeys(nested, `${path}.${key}`);
  }
}

// ─── DB setup helpers ──────────────────────────────────────────────────────────

let userSeq = 0;
const RUN = `SA${randomUUID()}`;

/** Create a test user via direct DB insert (uses crypt for password). */
async function mkUser(rol: RolUsuario, ubicacionId: number | null, opts?: {
  alcanceConsulta?: "PROPIA" | "TODAS";
  password?: string;
}): Promise<{ id: number; usuario: string; password: string }> {
  const tag = `${RUN}_${++userSeq}`;
  const usuario = `tst_${tag}`.toLowerCase();
  const password = opts?.password ?? "Test1234!";
  const alcanceConsulta = opts?.alcanceConsulta ?? (rol === "BODEGA" ? "PROPIA" : "TODAS");

  const [row] = await db
    .insert(usuariosTable)
    .values({
      nombre: `Test ${tag}`,
      usuario,
      passwordHash: sql`crypt(${password}, gen_salt('bf', 8))`,
      rol,
      ubicacionId: rol === "ADMIN" ? null : ubicacionId,
      alcanceConsulta,
    })
    .returning({ id: usuariosTable.id });

  createdUserIds.push(row!.id);
  return { id: row!.id, usuario, password };
}

async function mkUbicacion(): Promise<number> {
  const tag = `${RUN}_${++userSeq}`;
  let initials: string | undefined;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const hex = randomUUID().replaceAll("-", "");
    const candidate = [0, 4, 8]
      .map((offset) =>
        String.fromCharCode(
          65 + (Number.parseInt(hex.slice(offset, offset + 4), 16) % 26),
        ),
      )
      .join("");
    const [existing] = await db
      .select({ id: ubicacionesTable.id })
      .from(ubicacionesTable)
      .where(eq(ubicacionesTable.iniciales, candidate))
      .limit(1);
    if (!existing) {
      initials = candidate;
      break;
    }
  }
  assert.ok(initials, "No se encontraron iniciales únicas para la ubicación de prueba");
  const [row] = await db
    .insert(ubicacionesTable)
    .values({
      nombre: `UbSAT ${tag}`.slice(0, 120),
      iniciales: initials,
      tipo: "TIENDA",
    })
    .returning({ id: ubicacionesTable.id });
  createdUbicacionIds.push(row!.id);
  return row!.id;
}

async function mkProducto(): Promise<number> {
  const tag = `${RUN}_${++userSeq}`;
  const [row] = await db
    .insert(productosTable)
    .values({
      sku: `SAT${tag}`.slice(0, 64),
      tela: `Tela ${tag}`,
      color: `Color ${tag}`,
      unidad: "METRO",
      precioSugerido: "100.00",
    })
    .returning({ id: productosTable.id });
  createdProductoIds.push(row!.id);
  return row!.id;
}

// Create rollo via DB engine helper (bypasses HTTP auth)
async function mkRolloDisponible(
  ubicacionId: number,
  productoId: number,
  adminId: number,
  pendingCost = false,
): Promise<number> {
  const result = await db.transaction(async (tx) => {
    const result = await crearEntrada(tx, {
      ubicacionId,
      proveedorId: null,
      observaciones: null,
      usuarioId: adminId,
      ip: "127.0.0.1",
      uuidCliente: randomUUID(),
      allowPendingCosts: pendingCost,
      lineas: [{
        productoId,
        costoUnitario: pendingCost ? null : "100.00",
        cantidades: ["15.000"],
      }],
    });
    return result;
  });
  createdEntradaIds.push(result.id);
  const [rollo] = result.rollos;
  createdRolloIds.push(rollo!.id);
  return rollo!.id;
}

// ─── Bootstrap: Create shared fixtures ────────────────────────────────────────

// Find an existing TIENDA location from seed
const [seedTienda] = await db
  .select({ id: ubicacionesTable.id })
  .from(ubicacionesTable)
  .where(eq(ubicacionesTable.tipo, "TIENDA"))
  .limit(1);

if (!seedTienda) throw new Error("No hay ubicación TIENDA en la DB. Ejecuta el seed primero.");

// Find seed ADMIN (login only; we won't break it)
const [seedAdminRow] = await db
  .select({ id: usuariosTable.id })
  .from(usuariosTable)
  .where(eq(usuariosTable.usuario, "admin"))
  .limit(1);

if (!seedAdminRow) throw new Error("Usuario admin no encontrado. Ejecuta el seed primero.");

// Create test-specific admin (so we can do mutations without touching seed admin)
const testAdmin = await mkUser("ADMIN", null);
const testTerminal = await mkUser("TERMINAL", seedTienda.id);
const testCaja = await mkUser("CAJA", seedTienda.id, { alcanceConsulta: "PROPIA" });
const testSupervisor = await mkUser("SUPERVISOR", seedTienda.id);
const testBodega = await mkUser("BODEGA", seedTienda.id, { alcanceConsulta: "PROPIA" });
// Second BODEGA with TODAS scope for S-23
const testBodegaTodas = await mkUser("BODEGA", seedTienda.id, { alcanceConsulta: "TODAS" });

// Second TIENDA location for cross-location tests
const otherTiendaId = await mkUbicacion();
const testBodegaOtherLoc = await mkUser("BODEGA", otherTiendaId, { alcanceConsulta: "PROPIA" });

// Shared producto and rollo for inventory tests
const sharedProductoId = await mkProducto();
const sharedRolloId = await mkRolloDisponible(seedTienda.id, sharedProductoId, testAdmin.id);

await startServer();

// ─── Tests ────────────────────────────────────────────────────────────────────

// S-01: All four roles can log in; response has permisos matrix
await test("S-01: All four roles login → 200 + permisos array present", async () => {
  for (const { usuario, password } of [testAdmin, testTerminal, testCaja, testSupervisor, testBodega]) {
    const r = await login(usuario, password);
    assert.equal(r.status, 200, `login failed for ${usuario}: ${JSON.stringify(r.body)}`);
    const body = r.body as Record<string, unknown>;
    assert.ok(Array.isArray(body.permisos) || (typeof body.permisos === "object" && body.permisos !== null),
      `permisos absent in login response for ${usuario}`);
  }
});

await test("S-01A: session lasts eight idle hours, stops at sixteen, and logout invalidates it", async () => {
  const loginResult = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(loginResult.status, 200);
  assert.match(loginResult.setCookie, new RegExp(`Max-Age=${ABSOLUTE_SESSION_MS / 1000}`));

  const sessionId = loginResult.cookie.replace("mariana_session=", "");
  const [initialSession] = await db
    .select()
    .from(sesionesTable)
    .where(eq(sesionesTable.id, sessionId))
    .limit(1);
  assert.ok(initialSession);
  const initialLifetime = initialSession.expiraAt.getTime() - initialSession.createdAt.getTime();
  assert.ok(
    Math.abs(initialLifetime - INACTIVITY_MS) < 2_000,
    `initial inactivity lifetime was ${initialLifetime}ms`,
  );

  const createdAt = new Date(Date.now() - 15 * 60 * 60 * 1000);
  await db
    .update(sesionesTable)
    .set({
      createdAt,
      expiraAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    .where(eq(sesionesTable.id, sessionId));

  const activeNearCeiling = await api("GET", "/auth/me", undefined, loginResult.cookie);
  assert.equal(activeNearCeiling.status, 200);
  const [renewedSession] = await db
    .select()
    .from(sesionesTable)
    .where(eq(sesionesTable.id, sessionId))
    .limit(1);
  assert.ok(renewedSession);
  assert.equal(
    renewedSession.expiraAt.getTime(),
    createdAt.getTime() + ABSOLUTE_SESSION_MS,
    "activity must not move the fixed sixteen-hour deadline",
  );

  const logoutResult = await api("POST", "/auth/logout", undefined, loginResult.cookie);
  assert.equal(logoutResult.status, 204);
  const [deletedSession] = await db
    .select({ id: sesionesTable.id })
    .from(sesionesTable)
    .where(eq(sesionesTable.id, sessionId))
    .limit(1);
  assert.equal(deletedSession, undefined);

  const reusedSession = await api("GET", "/auth/me", undefined, loginResult.cookie);
  assert.equal(reusedSession.status, 401);
  assert.deepEqual(reusedSession.body, {
    error: "La sesión venció. Inicia sesión de nuevo.",
  });
});

// S-02: ADMIN /auth/me → matrix has every configured module, all full access
await test("S-02: ADMIN /auth/me effective matrix — all modules have full access", async () => {
  const login_r = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(login_r.status, 200);
  const me = await api("GET", "/auth/me", undefined, login_r.cookie);
  assert.equal(me.status, 200);
  const body = me.body as Record<string, unknown>;
  const permisos = body.permisos as unknown[];
  assert.ok(Array.isArray(permisos), "permisos should be array");
  assert.equal(permisos.length, MODULOS.length, `Expected ${MODULOS.length} modules, got ${permisos.length}`);
  assert.ok(
    (permisos as Array<Record<string, unknown>>).some((permission) => permission.modulo === "etiquetas"),
    "ADMIN matrix must include etiquetas",
  );
  for (const p of permisos as Array<Record<string, unknown>>) {
    assert.equal(p.puedeVer, true, `ADMIN ${p.modulo}: puedeVer must be true`);
    assert.equal(p.puedeCrear, true, `ADMIN ${p.modulo}: puedeCrear must be true`);
    assert.equal(p.puedeEditar, true, `ADMIN ${p.modulo}: puedeEditar must be true`);
    assert.equal(p.puedeAutorizar, true, `ADMIN ${p.modulo}: puedeAutorizar must be true`);
  }
});

// S-03: CAJA /auth/me → cobros_pagos=true, pos/proveedores=false
await test("S-03: CAJA /auth/me effective matrix — cobros OK, POS/proveedores denied", async () => {
  const login_r = await login(testCaja.usuario, testCaja.password);
  assert.equal(login_r.status, 200);
  const me = await api("GET", "/auth/me", undefined, login_r.cookie);
  assert.equal(me.status, 200);
  const permisos = (me.body as Record<string, unknown>).permisos as Array<Record<string, unknown>>;
  const posEntry = permisos.find((p) => p.modulo === "pos");
  const cobrosEntry = permisos.find((p) => p.modulo === "cobros_pagos");
  const provEntry = permisos.find((p) => p.modulo === "proveedores");
  const inventarioEntry = permisos.find((p) => p.modulo === "inventario");
  const salidasEntry = permisos.find((p) => p.modulo === "salidas");
  const productosEntry = permisos.find((p) => p.modulo === "productos");
  const movimientosEntry = permisos.find((p) => p.modulo === "movimientos");
  const reportesEntry = permisos.find((p) => p.modulo === "reportes");
  assert.ok(posEntry, "pos module missing");
  assert.ok(provEntry, "proveedores module missing");
  assert.equal(posEntry.puedeVer, false, "CAJA must not use terminal POS");
  assert.equal(cobrosEntry?.puedeVer, true, "CAJA should see cobros_pagos");
  assert.equal(inventarioEntry?.puedeVer, false, "CAJA must not see inventory");
  assert.equal(salidasEntry?.puedeVer, false, "CAJA must not see outputs");
  assert.equal(salidasEntry?.puedeCrear, false, "CAJA must not create outputs");
  assert.equal(productosEntry?.puedeVer, false, "CAJA must not see products administration");
  assert.equal(movimientosEntry?.puedeVer, false, "CAJA must not see movements");
  assert.equal(reportesEntry?.puedeVer, false, "CAJA must not see reports");
  assert.equal(provEntry.puedeVer, false, "CAJA must not see proveedores");
});

await test("S-03A: Caja ticket list is location-scoped and denied to BODEGA", async () => {
  const cajaLogin = await login(testCaja.usuario, testCaja.password);
  const own = await api(
    "GET",
    `/caja/tickets?ubicacionId=${seedTienda.id}`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(own.status, 200, JSON.stringify(own.body));
  assert.ok(Array.isArray(own.body), "Caja tickets response must be an array");

  const requestedOther = await api(
    "GET",
    `/caja/tickets?ubicacionId=${otherTiendaId}`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(requestedOther.status, 200, JSON.stringify(requestedOther.body));
  assert.deepEqual(
    requestedOther.body,
    own.body,
    "A PROPIA user must remain scoped to their operational location",
  );

  const bodegaLogin = await login(testBodega.usuario, testBodega.password);
  const denied = await api(
    "GET",
    `/caja/tickets?ubicacionId=${seedTienda.id}`,
    undefined,
    bodegaLogin.cookie,
  );
  assert.equal(denied.status, 403, JSON.stringify(denied.body));
});

await test("S-03AA: Store sales requires an explicit override for CAJA and remains scoped", async () => {
  const deniedCaja = await mkUser("CAJA", seedTienda.id, { alcanceConsulta: "PROPIA" });
  const deniedLogin = await login(deniedCaja.usuario, deniedCaja.password);
  assert.equal(deniedLogin.status, 200);
  const denied = await api(
    "GET",
    `/caja/tiendas/${seedTienda.id}/ventas?page=1&pageSize=1`,
    undefined,
    deniedLogin.cookie,
  );
  assert.equal(denied.status, 403, JSON.stringify(denied.body));

  const customizedCaja = await mkUser("CAJA", seedTienda.id, { alcanceConsulta: "PROPIA" });
  const [grant] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: customizedCaja.id,
      modulo: "resumen_caja",
      puedeVer: true,
      puedeCrear: null,
      puedeEditar: null,
      puedeAutorizar: null,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(grant!.id);

  const cajaLogin = await login(customizedCaja.usuario, customizedCaja.password);
  assert.equal(cajaLogin.status, 200);
  const own = await api(
    "GET",
    `/caja/tiendas/${seedTienda.id}/ventas?page=1&pageSize=1`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(own.status, 200, JSON.stringify(own.body));
  const ownBody = own.body as {
    ubicacionId: number;
    items: Array<Record<string, unknown>>;
    total: number;
    page: number;
    pageSize: number;
  };
  assert.equal(ownBody.ubicacionId, seedTienda.id);
  assert.deepEqual(
    Object.keys(ownBody).sort(),
    ["ubicacionId", "nombreUbicacion", "items", "total", "page", "pageSize"].sort(),
    "Store sales response must be the paginated ticket summary contract",
  );
  assert.ok(Array.isArray(ownBody.items), "Store sales items must be an array");
  assert.equal(ownBody.page, 1);
  assert.equal(ownBody.pageSize, 1);
  assert.equal(typeof ownBody.total, "number");
  assert.ok(ownBody.total >= ownBody.items.length);
  for (const item of ownBody.items) {
    assert.deepEqual(
      Object.keys(item).sort(),
      ["id", "createdAt", "folio", "cliente", "formaPago", "importe", "estadoCobro", "utilidad"].sort(),
      "Store sales rows must expose sale totals, not line quantities",
    );
  }

  const otherForCaja = await api(
    "GET",
    `/caja/tiendas/${otherTiendaId}/ventas?page=1&pageSize=1`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(otherForCaja.status, 403, JSON.stringify(otherForCaja.body));

  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(adminLogin.status, 200);
  const otherForAdmin = await api(
    "GET",
    `/caja/tiendas/${otherTiendaId}/ventas?page=1&pageSize=1`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(otherForAdmin.status, 200, JSON.stringify(otherForAdmin.body));
  const adminBody = otherForAdmin.body as {
    ubicacionId: number;
    items: unknown[];
    page: number;
    pageSize: number;
  };
  assert.equal(adminBody.ubicacionId, otherTiendaId);
  assert.ok(Array.isArray(adminBody.items), "ADMIN store sales items must be an array");
  assert.equal(adminBody.page, 1);
  assert.equal(adminBody.pageSize, 1);
});

await test("S-03B: TERMINAL API responses omit costs, margins and profits", async () => {
  const loginR = await login(testTerminal.usuario, testTerminal.password);
  assert.equal(loginR.status, 200);

  const paths = [
    "/inventario/rollos",
    `/inventario/rollos/${sharedRolloId}`,
    "/inventario/existencias",
    "/productos",
    `/productos/${sharedProductoId}`,
    "/inventario/entradas",
    "/inventario/kardex",
    "/dashboard",
    "/tickets",
  ];

  for (const path of paths) {
    const response = await api("GET", path, undefined, loginR.cookie);
    assert.ok(
      response.status === 200 || response.status === 403,
      `${path} returned ${response.status}: ${JSON.stringify(response.body)}`,
    );
    assertNoTerminalSensitiveKeys(response.body, path);
  }
});

await test("S-03C: POS price rejection is JSON, visible and contains no cost", async () => {
  const loginR = await login(testTerminal.usuario, testTerminal.password);
  assert.equal(loginR.status, 200);
  const offScopeRolloId = await mkRolloDisponible(
    otherTiendaId,
    sharedProductoId,
    testAdmin.id,
  );
  const [producto] = await db
    .select({ tela: productosTable.tela, color: productosTable.color })
    .from(productosTable)
    .where(eq(productosTable.id, sharedProductoId))
    .limit(1);
  const [rollo] = await db
    .select({ serie: rollosTable.serie, estado: rollosTable.estado })
    .from(rollosTable)
    .where(eq(rollosTable.id, sharedRolloId))
    .limit(1);
  const expectedMessage = `El precio de ${producto!.tela} ${producto!.color} serie ${rollo!.serie} está por debajo del mínimo permitido.`;
  const [offScopeRollo] = await db
    .select({ serie: rollosTable.serie })
    .from(rollosTable)
    .where(eq(rollosTable.id, offScopeRolloId))
    .limit(1);

  const offScopeValidation = await api(
    "POST",
    "/pos/validar-precio",
    {
      ubicacionId: otherTiendaId,
      productoId: sharedProductoId,
      rolloId: offScopeRolloId,
      precioUnitario: 99,
    },
    loginR.cookie,
  );
  assert.equal(offScopeValidation.status, 404);
  assert.deepEqual(offScopeValidation.body, {
    error: "Rollo no encontrado o no disponible para esta operación.",
    code: "ROLLO_NOT_FOUND",
  });
  assert.equal(
    JSON.stringify(offScopeValidation.body).includes(offScopeRollo!.serie),
    false,
  );

  const offScopeCreation = await api(
    "POST",
    "/tickets",
    {
      uuidCliente: randomUUID(),
      ubicacionId: otherTiendaId,
      clienteId: 1,
      facturado: false,
      lineas: [
        {
          rolloId: offScopeRolloId,
          productoId: sharedProductoId,
          tipo: "NORMAL",
          cantidad: 15,
          precioUnitario: 100,
        },
      ],
    },
    loginR.cookie,
  );
  assert.equal(offScopeCreation.status, 404);
  assert.deepEqual(offScopeCreation.body, {
    error: "Rollo no encontrado.",
    code: "ROLLO_NOT_FOUND",
  });
  assert.equal(
    JSON.stringify(offScopeCreation.body).includes(offScopeRollo!.serie),
    false,
  );

  const validation = await api(
    "POST",
    "/pos/validar-precio",
    {
      ubicacionId: seedTienda.id,
      productoId: sharedProductoId,
      rolloId: sharedRolloId,
      precioUnitario: 99,
    },
    loginR.cookie,
  );
  assert.equal(validation.status, 200);
  assert.deepEqual(validation.body, {
    valido: false,
    mensaje: expectedMessage,
    code: "PRICE_BELOW_COST",
  });
  assertNoTerminalSensitiveKeys(validation.body, "/pos/validar-precio");

  const creation = await api(
    "POST",
    "/tickets",
    {
      uuidCliente: randomUUID(),
      ubicacionId: seedTienda.id,
      clienteId: 1,
      facturado: false,
      lineas: [
        {
          rolloId: sharedRolloId,
          productoId: sharedProductoId,
          tipo: "NORMAL",
          cantidad: 15,
          precioUnitario: 99,
        },
      ],
    },
    loginR.cookie,
  );
  assert.equal(creation.status, 400);
  assert.deepEqual(creation.body, {
    error: expectedMessage,
    code: "PRICE_BELOW_COST",
  });
  assertNoTerminalSensitiveKeys(creation.body, "/tickets");

  const invalid = await api(
    "POST",
    "/pos/validar-precio",
    {
      ubicacionId: seedTienda.id,
      productoId: sharedProductoId,
      rolloId: sharedRolloId,
      precioUnitario: 0,
    },
    loginR.cookie,
  );
  assert.equal(invalid.status, 400);
  assert.deepEqual(invalid.body, {
    error: "Revisa los datos enviados e intenta de nuevo.",
    code: "VALIDATION_ERROR",
  });

  const [unchanged] = await db
    .select({ estado: rollosTable.estado })
    .from(rollosTable)
    .where(eq(rollosTable.id, sharedRolloId))
    .limit(1);
  assert.equal(unchanged!.estado, "DISPONIBLE");
});

await test("S-03D: legacy zero-cost roll is blocked by advance and definitive POS validation", async () => {
  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(
    seedTienda.id,
    productoId,
    testAdmin.id,
  );
  await db
    .update(rollosTable)
    .set({ costoUnitario: "0.00" })
    .where(eq(rollosTable.id, rolloId));

  const [rollo] = await db
    .select({ serie: rollosTable.serie })
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId))
    .limit(1);
  assert.ok(rollo, "legacy roll fixture must exist");

  const expectedMessage = `El rollo serie ${rollo.serie} no tiene costo registrado. Contacte al administrador.`;
  const terminalLogin = await login(
    testTerminal.usuario,
    testTerminal.password,
  );
  assert.equal(terminalLogin.status, 200);

  const validation = await api(
    "POST",
    "/pos/validar-precio",
    {
      ubicacionId: seedTienda.id,
      productoId,
      rolloId,
      precioUnitario: 150,
    },
    terminalLogin.cookie,
  );
  assert.equal(validation.status, 200, JSON.stringify(validation.body));
  assert.deepEqual(validation.body, {
    valido: false,
    code: "ROLLO_SIN_COSTO",
    mensaje: expectedMessage,
  });
  assert.ok(
    String((validation.body as Record<string, unknown>).mensaje).includes(
      rollo.serie,
    ),
    "advance response must include the affected series",
  );
  assert.equal(
    JSON.stringify(validation.body).includes("0.00"),
    false,
    "advance response must not expose the invalid stored amount",
  );
  assertNoTerminalSensitiveKeys(validation.body, "/pos/validar-precio");

  const ticketUuid = randomUUID();
  const creation = await api(
    "POST",
    "/tickets",
    {
      uuidCliente: ticketUuid,
      ubicacionId: seedTienda.id,
      clienteId: 1,
      tipo: "NORMAL",
      facturado: false,
      lineas: [
        {
          rolloId,
          productoId,
          tipo: "NORMAL",
          cantidad: 15,
          precioUnitario: 150,
        },
      ],
    },
    terminalLogin.cookie,
  );
  assert.equal(creation.status, 400, JSON.stringify(creation.body));
  assert.deepEqual(creation.body, {
    error: expectedMessage,
    code: "ROLLO_SIN_COSTO",
  });
  assert.ok(
    String((creation.body as Record<string, unknown>).error).includes(
      rollo.serie,
    ),
    "definitive response must include the affected series",
  );
  assert.equal(
    JSON.stringify(creation.body).includes("0.00"),
    false,
    "definitive response must not expose the invalid stored amount",
  );
  assertNoTerminalSensitiveKeys(creation.body, "/tickets");

  const [unchanged] = await db
    .select({ estado: rollosTable.estado })
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId))
    .limit(1);
  assert.equal(unchanged?.estado, "DISPONIBLE");

  const [{ value: ticketCount }] = await db
    .select({ value: count() })
    .from(ticketsTable)
    .where(eq(ticketsTable.uuidCliente, ticketUuid));
  assert.equal(ticketCount, 0, "rejected sale must not create a ticket");
});

await test("S-03E: entrada without costoUnitario is rejected without creating a roll", async () => {
  const productoId = await mkProducto();
  const uuidCliente = randomUUID();
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(adminLogin.status, 200);

  const before = await db
    .select({ id: rollosTable.id })
    .from(rollosTable)
    .where(eq(rollosTable.productoId, productoId));

  const response = await api(
    "POST",
    "/inventario/entradas",
    {
      ubicacionId: seedTienda.id,
      proveedorId: null,
      observaciones: null,
      uuidCliente,
      lineas: [{ productoId, cantidades: ["7.000"] }],
    },
    adminLogin.cookie,
  );
  assert.equal(response.status, 400, JSON.stringify(response.body));

  const after = await db
    .select({ id: rollosTable.id })
    .from(rollosTable)
    .where(eq(rollosTable.productoId, productoId));
  assert.equal(after.length, before.length, "invalid entrada must not create a roll");

  const [{ value: entradaCount }] = await db
    .select({ value: count() })
    .from(entradasTable)
    .where(eq(entradasTable.uuidCliente, uuidCliente));
  assert.equal(entradaCount, 0, "invalid request must not create an entrada");
});

// S-04: BODEGA denied POS sale (vender) but can read inventario
await test("S-04: BODEGA — POST /inventario/rollos/:id/vender → 403", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  // BODEGA can read inventario
  const readR = await api("GET", "/inventario/rollos", undefined, login_r.cookie);
  assert.equal(readR.status, 200, "BODEGA should be able to read rollos");
  // BODEGA cannot do POS sale
  const venderR = await api("POST", `/inventario/rollos/${sharedRolloId}/vender`, {
    justificacion: "venta test",
    uuidCliente: randomUUID(),
  }, login_r.cookie);
  assert.equal(venderR.status, 403, `Expected 403, got ${venderR.status}: ${JSON.stringify(venderR.body)}`);
});

// S-05: BODEGA denied clientes
await test("S-05: BODEGA GET /clientes → 403", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  const r = await api("GET", "/clientes", undefined, login_r.cookie);
  assert.equal(r.status, 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("S-05A: BODEGA POST /clientes → 403", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  const r = await api(
    "POST",
    "/clientes",
    { nombre: `Cliente prohibido ${RUN}` },
    login_r.cookie,
  );
  assert.equal(r.status, 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
});

await test("S-05B: concurrent normalized client creates → 201 + structured 409", async () => {
  const login_r = await login(testAdmin.usuario, testAdmin.password);
  const name = `Cliente Concurrente ${RUN}`;
  const [first, second] = await Promise.all([
    api("POST", "/clientes", { nombre: `  ${name.toUpperCase()}  ` }, login_r.cookie),
    api("POST", "/clientes", { nombre: name.toLocaleLowerCase("es-MX") }, login_r.cookie),
  ]);
  const created = [first, second].find((result) => result.status === 201);
  const conflict = [first, second].find((result) => result.status === 409);
  try {
    assert.ok(created, `Expected one create: ${JSON.stringify([first.body, second.body])}`);
    assert.ok(conflict, `Expected one conflict: ${JSON.stringify([first.body, second.body])}`);
    const createdBody = created.body as { id: number };
    const conflictBody = conflict.body as {
      code?: string;
      existingClientId?: number;
    };
    assert.equal(conflictBody.code, "CLIENT_NAME_CONFLICT");
    assert.equal(conflictBody.existingClientId, createdBody.id);
  } finally {
    const createdId = (created?.body as { id?: number } | undefined)?.id;
    if (createdId) {
      const { clientesTable } = await import("@workspace/db");
      await db.delete(clientesTable).where(eq(clientesTable.id, createdId));
    }
  }
});

// S-06: CAJA cannot bypass ticketing through the legacy inventory sale endpoint
await test("S-06: CAJA direct inventory sale is denied; ticketing is mandatory", async () => {
  // Create a fresh DISPONIBLE rollo at seedTienda for CAJA
  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(seedTienda.id, productoId, testAdmin.id);

  const login_r = await login(testCaja.usuario, testCaja.password);
  assert.equal(login_r.status, 200);

  const r = await api("POST", `/inventario/rollos/${rolloId}/vender`, {
    justificacion: "venta test S06",
    uuidCliente: randomUUID(),
  }, login_r.cookie);
  assert.equal(r.status, 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
});

// S-07: CAJA denied GET /proveedores
await test("S-07: CAJA GET /proveedores → 403", async () => {
  const login_r = await login(testCaja.usuario, testCaja.password);
  const r = await api("GET", "/proveedores", undefined, login_r.cookie);
  assert.equal(r.status, 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
});

// S-08: SUPERVISOR GET /proveedores → 200, no financial keys in response
await test("S-08: SUPERVISOR GET /proveedores → 200, no financial JSON keys", async () => {
  const login_r = await login(testSupervisor.usuario, testSupervisor.password);
  const r = await api("GET", "/proveedores", undefined, login_r.cookie);
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  const body = r.body as Record<string, unknown>;
  const items = body.items as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(items), "items should be array");
  const FINANCIAL_KEYS = [
    "totalCompras", "totalComprado12Meses", "comprasMes",
    "totalPagado", "saldoPendiente", "ultimaCompra", "comprasCount",
    "totalDeuda", "proveedoresConSaldo",
  ];
  for (const item of items) {
    for (const key of FINANCIAL_KEYS) {
      assert.ok(!(key in item), `SUPERVISOR response must not include financial key '${key}'`);
    }
  }
  // Also check the top-level body keys
  for (const key of FINANCIAL_KEYS) {
    assert.ok(!(key in body), `SUPERVISOR response body must not include '${key}'`);
  }
  assertNoSupervisorSensitiveKeys(body);
});

await test("S-08A: SUPERVISOR operational JSON is recursively redacted", async () => {
  const login_r = await login(testSupervisor.usuario, testSupervisor.password);
  for (const path of [
    "/productos",
    `/productos/${sharedProductoId}`,
    "/inventario/rollos",
    `/inventario/rollos/${sharedRolloId}`,
    "/inventario/entradas",
    "/inventario/existencias",
    "/dashboard",
    "/reportes/inventario",
  ]) {
    const response = await api("GET", path, undefined, login_r.cookie);
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(response.body)}`);
    assertNoSupervisorSensitiveKeys(response.body, path);
  }
});

await test("S-08AA: SUPERVISOR creates and edits clients/providers without sensitive data", async () => {
  const loginR = await login(testSupervisor.usuario, testSupervisor.password);
  assert.equal(loginR.status, 200);

  const clienteNombre = `Cliente supervisor ${RUN}`;
  const clienteCreado = await api(
    "POST",
    "/clientes",
    {
      nombre: clienteNombre,
      telefono: "5550101010",
      contactoNombre: "Contacto supervisor",
    },
    loginR.cookie,
  );
  assert.equal(clienteCreado.status, 201, JSON.stringify(clienteCreado.body));
  assertNoSupervisorSensitiveKeys(clienteCreado.body, "POST /clientes");
  const clienteId = Number((clienteCreado.body as Record<string, unknown>).id);
  assert.ok(Number.isInteger(clienteId) && clienteId > 0);
  createdClienteIds.push(clienteId);

  const clienteEditado = await api(
    "PATCH",
    `/clientes/${clienteId}`,
    { telefono: "5550202020", notas: "Actualizado por supervisor" },
    loginR.cookie,
  );
  assert.equal(clienteEditado.status, 200, JSON.stringify(clienteEditado.body));
  assertNoSupervisorSensitiveKeys(clienteEditado.body, "PATCH /clientes/:id");

  const bajaCliente = await api(
    "POST",
    `/clientes/${clienteId}/baja`,
    {},
    loginR.cookie,
  );
  assert.equal(bajaCliente.status, 403, JSON.stringify(bajaCliente.body));
  assertNoSupervisorSensitiveKeys(bajaCliente.body, "POST /clientes/:id/baja");

  const proveedorCreado = await api(
    "POST",
    "/proveedores",
    {
      nombre: `Proveedor supervisor ${RUN}`,
      tipo: "NACIONAL",
      contactoNombre: "Contacto proveedor",
    },
    loginR.cookie,
  );
  assert.equal(proveedorCreado.status, 201, JSON.stringify(proveedorCreado.body));
  assertNoSupervisorSensitiveKeys(proveedorCreado.body, "POST /proveedores");
  const proveedorId = Number((proveedorCreado.body as Record<string, unknown>).id);
  assert.ok(Number.isInteger(proveedorId) && proveedorId > 0);
  createdProveedorIds.push(proveedorId);

  const proveedorEditado = await api(
    "PATCH",
    `/proveedores/${proveedorId}`,
    { telefono: "5550303030", notas: "Actualizado por supervisor" },
    loginR.cookie,
  );
  assert.equal(proveedorEditado.status, 200, JSON.stringify(proveedorEditado.body));
  assertNoSupervisorSensitiveKeys(proveedorEditado.body, "PATCH /proveedores/:id");
});

await test("S-08AB: raw DB grants cannot exceed the SUPERVISOR ceiling", async () => {
  const modules = ["productos", "clientes", "proveedores"] as const;
  const originals = await Promise.all(
    modules.map(async (modulo) => {
      const [row] = await db
        .select()
        .from(permisosRolTable)
        .where(
          and(
            eq(permisosRolTable.rol, "SUPERVISOR"),
            eq(permisosRolTable.modulo, modulo),
          ),
        )
        .limit(1);
      assert.ok(row, `SUPERVISOR/${modulo} role row must exist`);
      return row;
    }),
  );

  try {
    for (const modulo of modules) {
      await db
        .update(permisosRolTable)
        .set({
          puedeVer: true,
          puedeCrear: true,
          puedeEditar: true,
          puedeAutorizar: true,
        })
        .where(
          and(
            eq(permisosRolTable.rol, "SUPERVISOR"),
            eq(permisosRolTable.modulo, modulo),
          ),
        );
    }

    const loginR = await login(testSupervisor.usuario, testSupervisor.password);
    assert.equal(loginR.status, 200);
    const me = await api("GET", "/auth/me", undefined, loginR.cookie);
    assert.equal(me.status, 200);
    const permisos = (me.body as Record<string, unknown>).permisos as Array<
      Record<string, unknown>
    >;
    for (const modulo of modules) {
      const permiso = permisos.find((item) => item.modulo === modulo);
      assert.equal(permiso?.puedeAutorizar, false, `${modulo}.autorizar`);
    }
    const producto = permisos.find((item) => item.modulo === "productos");
    assert.equal(producto?.puedeCrear, false, "productos.crear must be capped");
    assert.equal(producto?.puedeEditar, false, "productos.editar must be capped");

    const productPatch = await api(
      "PATCH",
      `/productos/${sharedProductoId}`,
      { tela: `Cambio denegado ${RUN}` },
      loginR.cookie,
    );
    assert.equal(productPatch.status, 403, JSON.stringify(productPatch.body));
    assertNoSupervisorSensitiveKeys(productPatch.body, "PATCH /productos/:id");
  } finally {
    for (const row of originals) {
      await db
        .update(permisosRolTable)
        .set({
          puedeVer: row!.puedeVer,
          puedeCrear: row!.puedeCrear,
          puedeEditar: row!.puedeEditar,
          puedeAutorizar: row!.puedeAutorizar,
        })
        .where(eq(permisosRolTable.id, row!.id));
    }
  }
});

await test("S-08B: SUPERVISOR creates a pending-cost entry at any real location", async () => {
  const login_r = await login(testSupervisor.usuario, testSupervisor.password);
  const response = await api(
    "POST",
    "/inventario/entradas",
    {
      ubicacionId: otherTiendaId,
      proveedorId: null,
      observaciones: `SUPERVISOR ${RUN}`,
      uuidCliente: randomUUID(),
      lineas: [
        {
          productoId: sharedProductoId,
          costoUnitario: "987654.32",
          cantidades: ["3.000"],
        },
      ],
    },
    login_r.cookie,
  );
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assertNoSupervisorSensitiveKeys(response.body);
  const entryId = Number((response.body as Record<string, unknown>).id);
  createdEntradaIds.push(entryId);
  const rolls = await db
    .select({
      id: rollosTable.id,
      ubicacionId: rollosTable.ubicacionId,
      costoUnitario: rollosTable.costoUnitario,
      costoTotal: rollosTable.costoTotal,
    })
    .from(rollosTable)
    .where(eq(rollosTable.recepcionId, entryId));
  assert.ok(rolls.length > 0);
  createdRolloIds.push(...rolls.map((roll) => roll.id));
  assert.ok(rolls.every((roll) => roll.ubicacionId === otherTiendaId));
  assert.ok(
    rolls.every(
      (roll) => roll.costoUnitario === null && roll.costoTotal === null,
    ),
    "SUPERVISOR-provided costs must never be stored",
  );
});

await test("S-08C: SUPERVISOR XLSX/PDF exports contain no financial fields or sentinel", async () => {
  const login_r = await login(testSupervisor.usuario, testSupervisor.password);
  const forbiddenText =
    /(costo|precio|margen|utilidad|ganancia|saldo|importe|pago|987654\.32)/i;
  const xlsx = await download(
    "/reportes/inventario/export.xlsx?margenUmbral=987654.32",
    login_r.cookie,
  );
  assert.equal(xlsx.status, 200);
  assert.match(
    xlsx.contentType,
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx.bytes as unknown as ArrayBuffer);
  const workbookValues: string[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => workbookValues.push(String(cell.value ?? "")));
    });
  });
  const workbookText = workbookValues.join("\n");
  assert.doesNotMatch(workbookText, forbiddenText);

  const pdf = await download(
    "/reportes/inventario/export.pdf?margenUmbral=987654.32",
    login_r.cookie,
  );
  assert.equal(pdf.status, 200);
  assert.match(pdf.contentType, /application\/pdf/);
  assert.doesNotMatch(pdf.bytes.toString("latin1"), forbiddenText);
});

// S-09: operational entry catalogs do not grant administrative catalog access
await test("S-09: BODEGA entry catalogs → 200; /productos and /proveedores → 403", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  const catalogos = await api(
    "GET",
    "/inventario/entradas/catalogos",
    undefined,
    login_r.cookie,
  );
  assert.equal(
    catalogos.status,
    200,
    `Expected 200, got ${catalogos.status}: ${JSON.stringify(catalogos.body)}`,
  );
  const body = catalogos.body as {
    productos: Array<Record<string, unknown>>;
    proveedores: Array<Record<string, unknown>>;
  };
  assert.ok(Array.isArray(body.productos));
  assert.ok(Array.isArray(body.proveedores));
  assert.ok(
    body.productos.some((producto) => producto.id === sharedProductoId),
    "The active product fixture must be available for entry capture",
  );
  for (const producto of body.productos) {
    assert.deepEqual(
      Object.keys(producto).sort(),
      ["activo", "color", "id", "sku", "tela", "unidad"],
    );
    assert.equal(producto.activo, true);
  }
  for (const proveedor of body.proveedores) {
    assert.deepEqual(
      Object.keys(proveedor).sort(),
      ["activo", "id", "nombre"],
    );
    assert.equal(proveedor.activo, true);
  }

  const productos = await api("GET", "/productos", undefined, login_r.cookie);
  assert.equal(productos.status, 403, JSON.stringify(productos.body));
  const proveedores = await api(
    "GET",
    "/proveedores",
    undefined,
    login_r.cookie,
  );
  assert.equal(proveedores.status, 403, JSON.stringify(proveedores.body));
});

await test("S-09A: BODEGA stages, owns, and sends a null-cost roll in one final action", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  const locations = await api(
    "GET",
    "/salidas/ubicaciones",
    undefined,
    login_r.cookie,
  );
  assert.equal(locations.status, 200, JSON.stringify(locations.body));
  const operational = locations.body as Array<Record<string, unknown>>;
  assert.ok(
    operational.some((location) => location.id === seedTienda.id),
    "Origin must be present in the Salidas operational catalog",
  );
  assert.ok(
    operational.some((location) => location.id === otherTiendaId),
    "Destination must be present in the Salidas operational catalog",
  );
  for (const location of operational) {
    assert.deepEqual(
      Object.keys(location).sort(),
      ["activa", "id", "nombre", "tipo"],
    );
    assert.equal(location.activa, true);
    assert.ok(location.tipo === "TIENDA" || location.tipo === "BODEGA");
  }

  const direct = await api("GET", "/locations", undefined, login_r.cookie);
  assert.equal(
    direct.status,
    403,
    "BODEGA must not gain access to the administrative locations endpoint",
  );

  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(
    seedTienda.id,
    productoId,
    testAdmin.id,
    true,
  );
  const [rollo] = await db
    .select({ serie: rollosTable.serie })
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId));
  assert.ok(rollo);

  const staged = await api(
    "POST",
    "/salidas/borrador/rollos",
    {
      uuidCliente: randomUUID(),
      origenId: seedTienda.id,
      destinoId: otherTiendaId,
      serie: rollo.serie,
    },
    login_r.cookie,
  );
  assert.equal(staged.status, 200, JSON.stringify(staged.body));
  const salidaId = Number((staged.body as { id: number }).id);
  createdSalidaIds.push(salidaId);

  const [reserved] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId));
  assert.ok(reserved);
  assert.equal(reserved.ubicacionId, seedTienda.id);
  assert.equal(reserved.estado, "DISPONIBLE");

  const otherOwnerLogin = await login(
    testBodegaTodas.usuario,
    testBodegaTodas.password,
  );
  const forbiddenRemoval = await api(
    "DELETE",
    `/salidas/${salidaId}/rollos/${rolloId}`,
    undefined,
    otherOwnerLogin.cookie,
  );
  assert.equal(forbiddenRemoval.status, 403, JSON.stringify(forbiddenRemoval.body));
  const forbiddenSend = await api(
    "POST",
    `/salidas/${salidaId}/enviar`,
    { transportista: "Intento ajeno" },
    otherOwnerLogin.cookie,
  );
  assert.equal(forbiddenSend.status, 403, JSON.stringify(forbiddenSend.body));
  const forbiddenDocument = await api(
    "GET",
    `/salidas/${salidaId}/documento`,
    undefined,
    login_r.cookie,
  );
  assert.equal(forbiddenDocument.status, 409, JSON.stringify(forbiddenDocument.body));

  const sent = await api(
    "POST",
    `/salidas/${salidaId}/enviar`,
    { transportista: "Transportista de prueba" },
    login_r.cookie,
  );
  assert.equal(sent.status, 200, JSON.stringify(sent.body));

  const [moved] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId));
  assert.ok(moved);
  const [transitLocation] = await db
    .select({ tipo: ubicacionesTable.tipo })
    .from(ubicacionesTable)
    .where(eq(ubicacionesTable.id, moved.ubicacionId));
  assert.equal(transitLocation?.tipo, "TRANSITO");
  assert.equal(moved.estado, "EN_TRANSITO");
  assert.equal(moved.costoUnitario, null);
  assert.equal(moved.costoTotal, null);

  const stock = await db
    .select()
    .from(existenciasTable)
    .where(eq(existenciasTable.productoId, productoId));
  assert.equal(
    Number(stock.find((row) => row.ubicacionId === seedTienda.id)?.cantidadTotal),
    0,
  );
  assert.equal(
    Number(
      stock.find((row) => row.ubicacionId === otherTiendaId)?.cantidadTotal ?? 0,
    ),
    0,
  );
});

await test("S-09B: CAJA only lists and opens outputs received at its assigned store", async () => {
  const ownBodegaLogin = await login(testBodega.usuario, testBodega.password);
  const otherBodegaLogin = await login(testBodegaOtherLoc.usuario, testBodegaOtherLoc.password);
  const stageAndSend = async (
    cookie: string,
    origenId: number,
    destinoId: number,
    rolloId: number,
    transportista: string,
  ) => {
    const [rollo] = await db
      .select({ serie: rollosTable.serie })
      .from(rollosTable)
      .where(eq(rollosTable.id, rolloId));
    assert.ok(rollo);
    const staged = await api(
      "POST",
      "/salidas/borrador/rollos",
      {
        uuidCliente: randomUUID(),
        origenId,
        destinoId,
        serie: rollo.serie,
      },
      cookie,
    );
    assert.equal(staged.status, 200, JSON.stringify(staged.body));
    const salidaId = Number((staged.body as { id: number }).id);
    const sent = await api(
      "POST",
      `/salidas/${salidaId}/enviar`,
      { transportista },
      cookie,
    );
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    return salidaId;
  };

  const outboundProductId = await mkProducto();
  const outboundRolloId = await mkRolloDisponible(seedTienda.id, outboundProductId, testAdmin.id);
  const outboundId = await stageAndSend(
    ownBodegaLogin.cookie,
    seedTienda.id,
    otherTiendaId,
    outboundRolloId,
    "Transportista salida",
  );
  createdSalidaIds.push(outboundId);

  const inboundProductId = await mkProducto();
  const inboundRolloId = await mkRolloDisponible(otherTiendaId, inboundProductId, testAdmin.id);
  const inboundId = await stageAndSend(
    otherBodegaLogin.cookie,
    otherTiendaId,
    seedTienda.id,
    inboundRolloId,
    "Transportista entrada",
  );
  createdSalidaIds.push(inboundId);

  const cajaLogin = await login(testCaja.usuario, testCaja.password);
  const listed = await api(
    "GET",
    `/salidas?destinoId=${otherTiendaId}&page=1&pageSize=100`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const items = (listed.body as { items: Array<{ id: number; destinoId: number }> }).items;
  assert.ok(items.some((item) => item.id === inboundId), "Inbound output must be visible");
  assert.ok(!items.some((item) => item.id === outboundId), "Outbound output must stay hidden");
  assert.ok(items.every((item) => item.destinoId === seedTienda.id), "Every row must target CAJA's store");

  const inboundDetail = await api("GET", `/salidas/${inboundId}`, undefined, cajaLogin.cookie);
  assert.equal(inboundDetail.status, 200, JSON.stringify(inboundDetail.body));
  const outboundDetail = await api("GET", `/salidas/${outboundId}`, undefined, cajaLogin.cookie);
  assert.equal(outboundDetail.status, 403, JSON.stringify(outboundDetail.body));

  const forbiddenCreate = await api("POST", "/salidas/borrador/rollos", {
    uuidCliente: randomUUID(),
    origenId: seedTienda.id,
    destinoId: otherTiendaId,
    serie: "ROLLO-NO-PERMITIDO",
  }, cajaLogin.cookie);
  assert.equal(forbiddenCreate.status, 403, JSON.stringify(forbiddenCreate.body));

  const forbiddenCancel = await api("POST", `/salidas/${inboundId}/cancelar`, {
    motivo: "No permitido para CAJA",
  }, cajaLogin.cookie);
  assert.equal(forbiddenCancel.status, 403, JSON.stringify(forbiddenCancel.body));
});

// S-10: Financial proveedor routes denied for SUPERVISOR (no proveedores_finanzas)
await test("S-10: SUPERVISOR GET /proveedores/resumen → 403 (proveedores_finanzas.ver denied)", async () => {
  const maliciousModules = [
    "pos",
    "ubicaciones",
    "usuarios",
    "permisos",
    "resumen_caja",
    "cortes",
    "cobros_pagos",
    "conciliacion",
    "auditoria",
    "clientes_credito",
    "clientes_precios",
    "clientes_finanzas",
    "productos",
  ];
  const overrides = await db
    .insert(permisosUsuarioTable)
    .values(
      maliciousModules.map((modulo) => ({
        usuarioId: testSupervisor.id,
        modulo,
        puedeVer: true,
        puedeCrear: true,
        puedeEditar: true,
        puedeAutorizar: true,
      })),
    )
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(...overrides.map((row) => row.id));
  const login_r = await login(testSupervisor.usuario, testSupervisor.password);
  const forbidden: Array<[string, string]> = [
    ["GET", "/proveedores/resumen"],
    ["GET", "/proveedores/analitica-global"],
    ["GET", "/proveedores/1/compras"],
    ["GET", "/proveedores/1/pagos"],
    ["POST", "/proveedores/1/pagos"],
    ["GET", "/proveedores/1/estado-cuenta"],
    ["GET", "/clientes/resumen"],
    ["GET", "/clientes/cartera"],
    ["GET", "/clientes/analitica"],
    ["GET", "/clientes/1/credito"],
    ["GET", "/clientes/1/precios"],
    ["GET", "/clientes/1/estado-cuenta"],
    ["GET", "/clientes/1/pagos"],
    ["POST", "/clientes/1/pagos"],
    ["GET", "/pos/buscar"],
    ["GET", "/tickets/1"],
    ["GET", "/caja/tickets"],
    // SUPERVISOR cannot reach this financial route even with an explicit
    // resumen_caja grant, so its sensitive utilidad field has no reachable
    // SUPERVISOR response to redact.
    ["GET", `/caja/tiendas/${seedTienda.id}/ventas`],
    ["GET", "/sesiones-caja/actual"],
    ["GET", "/precios"],
    ["GET", "/locations"],
    ["GET", "/users"],
    ["GET", "/permisos/roles"],
    ["GET", "/inventario/conciliacion"],
    ["GET", "/inventario/entradas/pendientes-costo"],
    ["POST", "/inventario/entradas/1/costos"],
    ["GET", "/clientes/1/documentos"],
    ["POST", "/productos"],
  ];
  for (const [method, path] of forbidden) {
    const response = await api(
      method,
      path,
      method === "GET" ? undefined : {},
      login_r.cookie,
    );
    assert.equal(
      response.status,
      403,
      `${method} ${path} must be 403, got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
});

await test("S-10A: SUPERVISOR ceiling keeps store-sales route unreachable despite resumen_caja grant", async () => {
  const supervisorLogin = await login(testSupervisor.usuario, testSupervisor.password);
  assert.equal(supervisorLogin.status, 200);
  const me = await api("GET", "/auth/me", undefined, supervisorLogin.cookie);
  assert.equal(me.status, 200);
  const resumenCaja = (
    (me.body as { permisos: Array<{ modulo: string; puedeVer: boolean }> }).permisos
  ).find((permission) => permission.modulo === "resumen_caja");
  assert.equal(
    resumenCaja?.puedeVer,
    false,
    "SUPERVISOR ceiling must override the explicit resumen_caja.ver grant",
  );

  const sales = await api(
    "GET",
    `/caja/tiendas/${seedTienda.id}/ventas`,
    undefined,
    supervisorLogin.cookie,
  );
  assert.equal(
    sales.status,
    403,
    `SUPERVISOR must not reach store-sales utilidad data: ${JSON.stringify(sales.body)}`,
  );
});

// S-11: a malicious permissive override cannot exceed the SUPERVISOR ceiling
await test("S-11: SUPERVISOR finance override remains denied by immutable ceiling", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(adminLogin.status, 200);

  // PUT override for testSupervisor
  const putR = await api(
    "PUT",
    `/permisos/usuarios/${testSupervisor.id}/proveedores_finanzas`,
    { puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
    adminLogin.cookie,
  );
  assert.equal(putR.status, 200, `Override PUT failed: ${JSON.stringify(putR.body)}`);
  const overrideRow = putR.body as Record<string, unknown>;
  createdPermisosUsuarioIds.push(overrideRow.id as number);

  // The raw override exists, but the effective policy must still deny access.
  const login_r = await login(testSupervisor.usuario, testSupervisor.password);
  const r = await api("GET", "/proveedores/resumen", undefined, login_r.cookie);
  assert.equal(r.status, 403, `Expected 403 after malicious override, got ${r.status}: ${JSON.stringify(r.body)}`);

  // Verify matrix via /auth/me
  const me = await api("GET", "/auth/me", undefined, login_r.cookie);
  const permisos = (me.body as Record<string, unknown>).permisos as Array<Record<string, unknown>>;
  const finanzasEntry = permisos.find((p) => p.modulo === "proveedores_finanzas");
  assert.equal(
    finanzasEntry?.puedeVer,
    false,
    "Effective matrix must apply the SUPERVISOR ceiling",
  );
});

// S-12: Remove override (DELETE) → SUPERVISOR reverts to role (still denied)
await test("S-12: DELETE override → SUPERVISOR reverts to role default (403)", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);

  // Remove the override created in S-11
  const delR = await api(
    "DELETE",
    `/permisos/usuarios/${testSupervisor.id}/proveedores_finanzas`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(delR.status, 204, `Override DELETE failed: ${delR.status}`);
  // Remove from tracking since it's been deleted
  const idx = createdPermisosUsuarioIds.indexOf(
    createdPermisosUsuarioIds[createdPermisosUsuarioIds.length - 1]!
  );
  if (idx !== -1) createdPermisosUsuarioIds.splice(idx, 1);

  // SUPERVISOR should now be denied again
  const login_r = await login(testSupervisor.usuario, testSupervisor.password);
  const r = await api("GET", "/proveedores/resumen", undefined, login_r.cookie);
  assert.equal(r.status, 403, `Expected 403 after override removal, got ${r.status}`);
});

// S-13: User override (true) beats role (false): BODEGA clientes 403 → override → 200
await test("S-13: Override true beats role false: BODEGA clientes 403 → override → 200", async () => {
  // Confirm BODEGA is denied clientes by role
  const bodegaLogin = await login(testBodega.usuario, testBodega.password);
  const before = await api("GET", "/clientes", undefined, bodegaLogin.cookie);
  assert.equal(before.status, 403, "BODEGA should be denied clientes by default");

  // Add override
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const putR = await api(
    "PUT",
    `/permisos/usuarios/${testBodega.id}/clientes`,
    { puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
    adminLogin.cookie,
  );
  assert.equal(putR.status, 200, `Override PUT failed: ${JSON.stringify(putR.body)}`);
  createdPermisosUsuarioIds.push((putR.body as Record<string, unknown>).id as number);

  // BODEGA should now access clientes
  const bodegaLogin2 = await login(testBodega.usuario, testBodega.password);
  const after = await api("GET", "/clientes", undefined, bodegaLogin2.cookie);
  assert.equal(after.status, 200, `Expected 200 after override, got ${after.status}: ${JSON.stringify(after.body)}`);
});

// S-14: DELETE override → BODEGA clientes reverts to 403
await test("S-14: DELETE override → BODEGA clientes reverts to role 403", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const delR = await api(
    "DELETE",
    `/permisos/usuarios/${testBodega.id}/clientes`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(delR.status, 204, `DELETE override failed: ${delR.status}`);
  // Remove from tracking
  createdPermisosUsuarioIds.splice(createdPermisosUsuarioIds.lastIndexOf(
    (await db.select({ id: permisosUsuarioTable.id })
      .from(permisosUsuarioTable)
      .where(and(eq(permisosUsuarioTable.usuarioId, testBodega.id), eq(permisosUsuarioTable.modulo, "clientes")))
      .limit(1)
    ).map(() => 0)[0] ?? -1
  ), 1);

  const bodegaLogin = await login(testBodega.usuario, testBodega.password);
  const r = await api("GET", "/clientes", undefined, bodegaLogin.cookie);
  assert.equal(r.status, 403, `Expected 403 after deletion, got ${r.status}`);
});

// S-15: Deny-by-default: temporarily delete BODEGA inventario role row
await test("S-15: Deny-by-default — BODEGA inventario allowed; remove denies; restore allows", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const previewBefore = await api("GET", `/permisos/preview/${testBodega.id}`, undefined, adminLogin.cookie);
  assert.equal(previewBefore.status, 200);
  const previewBody = previewBefore.body as Record<string, unknown>;
  const permisos = previewBody.permisos as Array<Record<string, unknown>>;
  const reportesEntry = permisos.find((p) => p.modulo === "inventario");
  assert.equal(reportesEntry?.puedeVer, true, "BODEGA should have inventario.puedeVer=true by default");

  // Backup and delete the BODEGA/reportes role row
  const [originalRow] = await db
    .select()
    .from(permisosRolTable)
    .where(and(eq(permisosRolTable.rol, "BODEGA"), eq(permisosRolTable.modulo, "inventario")))
    .limit(1);
  assert.ok(originalRow, "BODEGA/inventario role row must exist");

  deletedRolRows.push({
    rol: "BODEGA",
    modulo: "inventario",
    puedeVer: originalRow.puedeVer,
    puedeCrear: originalRow.puedeCrear,
    puedeEditar: originalRow.puedeEditar,
    puedeAutorizar: originalRow.puedeAutorizar,
  });

  await db
    .delete(permisosRolTable)
    .where(and(eq(permisosRolTable.rol, "BODEGA"), eq(permisosRolTable.modulo, "inventario")));

  // Now preview should show reportes as all false (deny by default since no row)
  const previewAfter = await api("GET", `/permisos/preview/${testBodega.id}`, undefined, adminLogin.cookie);
  const permisosAfter = (previewAfter.body as Record<string, unknown>).permisos as Array<Record<string, unknown>>;
  const reportesAfter = permisosAfter.find((p) => p.modulo === "inventario");
  assert.equal(reportesAfter?.puedeVer, false, "Without role row, inventario should be denied");

  // Restore
  await db
    .insert(permisosRolTable)
    .values({
      rol: "BODEGA",
      modulo: "inventario",
      puedeVer: originalRow.puedeVer,
      puedeCrear: originalRow.puedeCrear,
      puedeEditar: originalRow.puedeEditar,
      puedeAutorizar: originalRow.puedeAutorizar,
    });
  deletedRolRows.pop(); // Successfully restored

  // Preview should be back to true
  const previewRestored = await api("GET", `/permisos/preview/${testBodega.id}`, undefined, adminLogin.cookie);
  const permisosRestored = (previewRestored.body as Record<string, unknown>).permisos as Array<Record<string, unknown>>;
  const reportesRestored = permisosRestored.find((p) => p.modulo === "inventario");
  assert.equal(reportesRestored?.puedeVer, true, "After restore, inventario should be puedeVer=true");
});

// S-16: ADMIN is absent from the role matrix and still has full access
await test("S-16: PUT /permisos/roles/ADMIN/usuarios with puedeVer=false → 403", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const r = await api(
    "PUT",
    "/permisos/roles/ADMIN/usuarios",
    { puedeVer: false, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
    adminLogin.cookie,
  );
  assert.equal(r.status, 403, `Expected 403 (invariant), got ${r.status}: ${JSON.stringify(r.body)}`);
  assert.ok(
    ((r.body as Record<string, unknown>).error as string).toLowerCase().includes("admin"),
    "Error should mention ADMIN",
  );

  const adminRoleRows = await db
    .select()
    .from(permisosRolTable)
    .where(eq(permisosRolTable.rol, "ADMIN"));
  assert.equal(adminRoleRows.length, 0, "ADMIN must not have role matrix rows");

  const usersWithoutRows = await api(
    "GET",
    "/users",
    undefined,
    adminLogin.cookie,
  );
  assert.equal(
    usersWithoutRows.status,
    200,
    "ADMIN must retain usuarios access without role rows",
  );
  const meWithoutRow = await api(
    "GET",
    "/auth/me",
    undefined,
    adminLogin.cookie,
  );
  const usuariosPermission = (
    (meWithoutRow.body as Record<string, unknown>).permisos as Array<
      Record<string, unknown>
    >
  ).find((entry) => entry.modulo === "usuarios");
  assert.deepEqual(
    {
      puedeVer: usuariosPermission?.puedeVer,
      puedeCrear: usuariosPermission?.puedeCrear,
      puedeEditar: usuariosPermission?.puedeEditar,
      puedeAutorizar: usuariosPermission?.puedeAutorizar,
    },
    {
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeAutorizar: true,
    },
  );

});

// S-17: ADMIN role cannot lose 'permisos' access (partial: puedeCrear=false)
await test("S-17: PUT /permisos/roles/ADMIN/permisos with puedeCrear=false → 403", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const r = await api(
    "PUT",
    "/permisos/roles/ADMIN/permisos",
    { puedeVer: true, puedeCrear: false, puedeEditar: true, puedeAutorizar: true },
    adminLogin.cookie,
  );
  assert.equal(r.status, 403, `Expected 403 (invariant), got ${r.status}: ${JSON.stringify(r.body)}`);

  const [inconsistentOverride] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: testAdmin.id,
      modulo: "permisos",
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(inconsistentOverride.id);

  const rolesWithOverride = await api(
    "GET",
    "/permisos/roles",
    undefined,
    adminLogin.cookie,
  );
  assert.equal(
    rolesWithOverride.status,
    200,
    "ADMIN must retain permisos access despite an inconsistent false override",
  );
  const meWithOverride = await api(
    "GET",
    "/auth/me",
    undefined,
    adminLogin.cookie,
  );
  const permisosPermission = (
    (meWithOverride.body as Record<string, unknown>).permisos as Array<
      Record<string, unknown>
    >
  ).find((entry) => entry.modulo === "permisos");
  assert.equal(permisosPermission?.puedeVer, true);
  assert.equal(permisosPermission?.puedeCrear, true);
  assert.equal(permisosPermission?.puedeEditar, true);
  assert.equal(permisosPermission?.puedeAutorizar, true);

  await db
    .delete(permisosUsuarioTable)
    .where(eq(permisosUsuarioTable.id, inconsistentOverride.id));
  createdPermisosUsuarioIds.splice(
    createdPermisosUsuarioIds.indexOf(inconsistentOverride.id),
    1,
  );
});

// S-18: Self-modification blocked (admin tries PUT /permisos/usuarios/:ownId)
await test("S-18: Self-override modification → 403 (cannot modify own permissions)", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const r = await api(
    "PUT",
    `/permisos/usuarios/${testAdmin.id}/dashboard`,
    { puedeVer: true, puedeCrear: true, puedeEditar: true, puedeAutorizar: true },
    adminLogin.cookie,
  );
  assert.equal(r.status, 403, `Expected 403 self-modification blocked, got ${r.status}: ${JSON.stringify(r.body)}`);
  assert.ok(
    ((r.body as Record<string, unknown>).error as string).toLowerCase().includes("propio"),
    "Error should mention own permissions",
  );
});

// S-19: Last active ADMIN protection — PATCH /users/:id activo=false → 409
await test("S-19: Last active ADMIN — deactivate → 409 (must keep at least one)", async () => {
  // Strategy: create two isolated disposable admins (A and B).
  // Use A to: deactivate all OTHER test/seed admins that we can count, then try to deactivate B.
  // Actually simplest: create adminA and adminB; deactivate seedAdmin and testAdmin via adminA;
  // now adminA and adminB are the only active ones; deactivate adminB (succeeds);
  // attempt to deactivate adminA → 409 since it's the last.
  //
  // But we must NOT leave testAdmin deactivated. Instead, scope this entirely to
  // disposable users and never touch testAdmin or seedAdmin.
  //
  // Approach: create adminA and adminB. Use adminA session.
  // Count active ADMINs. The other admins (testAdmin, seedAdmin, etc.) are all active.
  // We can't make adminA the last without deactivating the others.
  //
  // Real approach: Deactivate ALL currently-active admins except one via direct DB update,
  // then attempt to deactivate that last one via API → 409, then restore.
  //
  // We do this entirely via DB + one API call so we don't disrupt testAdmin.

  const adminLogin = await login(testAdmin.usuario, testAdmin.password);

  // Get all currently active ADMINs
  const allActiveAdmins = await db
    .select({ id: usuariosTable.id })
    .from(usuariosTable)
    .where(and(eq(usuariosTable.rol, "ADMIN"), eq(usuariosTable.activo, true)));

  // Directly deactivate all except testAdmin via DB (not through API — avoids 409 cascade)
  const othersToDeactivate = allActiveAdmins.filter((a) => a.id !== testAdmin.id);

  // Deactivate each one individually to avoid raw SQL array issues
  for (const admin of othersToDeactivate) {
    await db
      .update(usuariosTable)
      .set({ activo: false })
      .where(eq(usuariosTable.id, admin.id));
  }

  try {
    // testAdmin is now the ONLY active ADMIN
    // Attempt to deactivate testAdmin via API → should return 409
    const r = await api("PATCH", `/users/${testAdmin.id}`, { activo: false }, adminLogin.cookie);
    assert.equal(r.status, 409, `Expected 409 last-admin protection, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert.ok(
      ((r.body as Record<string, unknown>).error as string).includes("ADMIN"),
      "Error must mention ADMIN",
    );
  } finally {
    // Restore all deactivated admins
    for (const admin of othersToDeactivate) {
      await db
        .update(usuariosTable)
        .set({ activo: true })
        .where(eq(usuariosTable.id, admin.id));
    }
  }
});

// S-20: BODEGA PROPIA: rollos list ignores requested other-location, returns only own
await test("S-20: BODEGA PROPIA — GET /inventario/rollos?ubicacionId=other → forced to own", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  // testBodega is assigned to seedTienda; request otherTiendaId
  const r = await api("GET", `/inventario/rollos?ubicacionId=${otherTiendaId}`, undefined, login_r.cookie);
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  const body = r.body as Record<string, unknown>;
  const items = body.items as Array<Record<string, unknown>>;
  // All returned rollos must belong to own location (seedTienda), NOT otherTiendaId
  for (const item of items) {
    assert.notEqual(item.ubicacionId, otherTiendaId,
      `PROPIA scope leaked other location in rollo ${item.id}`);
    assert.equal(item.ubicacionId, seedTienda.id,
      `PROPIA rollo ${item.id} must be in own location`);
  }
});

// S-21: BODEGA PROPIA: existencias ignores requested other-location
await test("S-21: BODEGA PROPIA — GET /inventario/existencias?ubicacionId=other → forced to own", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  const r = await api("GET", `/inventario/existencias?ubicacionId=${otherTiendaId}`, undefined, login_r.cookie);
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  const items = r.body as Array<Record<string, unknown>>;
  for (const item of items) {
    assert.notEqual(item.ubicacionId, otherTiendaId,
      `PROPIA scope leaked other location in existencias`);
  }
});

// S-22: BODEGA PROPIA: kardex forces own ubicacion even when other is requested
await test("S-22: BODEGA PROPIA — GET /inventario/kardex → ignores other ubicacionId param", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  // Use a productoId that has movements in seedTienda from shared rollo setup
  const r = await api(
    "GET",
    `/inventario/kardex?productoId=${sharedProductoId}&ubicacionId=${otherTiendaId}`,
    undefined,
    login_r.cookie,
  );
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  const body = r.body as Record<string, unknown>;
  const movs = body.movimientos as Array<Record<string, unknown>>;
  // Any movement returned must belong to own location, not otherTiendaId
  for (const m of movs) {
    assert.notEqual(m.ubicacionId, otherTiendaId,
      `PROPIA kardex leaked movement from other location`);
  }
});

// S-23: TODAS user (BODEGA with alcanceConsulta=TODAS) can query any location
await test("S-23: BODEGA alcanceConsulta=TODAS — GET /inventario/rollos?ubicacionId=other → honors filter", async () => {
  const login_r = await login(testBodegaTodas.usuario, testBodegaTodas.password);
  // Request rollos at otherTiendaId (created in test setup)
  const r = await api("GET", `/inventario/rollos?ubicacionId=${otherTiendaId}`, undefined, login_r.cookie);
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  // The filter was honored (response may be empty — that's fine, it means 0 rollos there)
  // If any items returned, they must be in the requested location
  const body = r.body as Record<string, unknown>;
  const items = body.items as Array<Record<string, unknown>>;
  for (const item of items) {
    assert.equal(item.ubicacionId, otherTiendaId,
      `TODAS filter was not honored: expected ubicacionId=${otherTiendaId} but got ${item.ubicacionId}`);
  }

  // Also test without filter: should return all locations
  const rAll = await api("GET", "/inventario/rollos", undefined, login_r.cookie);
  assert.equal(rAll.status, 200);
  const allItems = (rAll.body as Record<string, unknown>).items as Array<Record<string, unknown>>;
  // With TODAS, we should see rollos from multiple locations (if they exist)
  const locationIds = new Set(allItems.map((i) => i.ubicacionId as number));
  // At minimum, own location should be visible (seedTienda.id)
  // We can only assert no scope error occurs
});

await test("S-23A: operational locations allow TODAS selection; grouped inventory still enforces PROPIA", async () => {
  const todasLogin = await login(
    testBodegaTodas.usuario,
    testBodegaTodas.password,
  );
  const locations = await api(
    "GET",
    "/inventario/ubicaciones",
    undefined,
    todasLogin.cookie,
  );
  assert.equal(locations.status, 200, JSON.stringify(locations.body));
  const operational = locations.body as Array<Record<string, unknown>>;
  assert.ok(
    operational.some((location) => location.id === seedTienda.id),
    "Own active location must be selectable",
  );
  assert.ok(
    operational.some((location) => location.id === otherTiendaId),
    "A TODAS user must be able to select another active location",
  );
  for (const location of operational) {
    assert.deepEqual(
      Object.keys(location).sort(),
      ["activa", "id", "nombre", "tipo"],
    );
    assert.equal(location.activa, true);
  }

  const cajaLogin = await login(testCaja.usuario, testCaja.password);
  const administrative = await api(
    "GET",
    "/locations",
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(
    administrative.status,
    403,
    "The administrative location list must remain permission-protected",
  );

  const cajaInventoryLocations = await api(
    "GET",
    "/inventario/ubicaciones",
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(cajaInventoryLocations.status, 200, JSON.stringify(cajaInventoryLocations.body));
  assert.deepEqual(
    (cajaInventoryLocations.body as Array<{ id: number }>).map((location) => location.id),
    [seedTienda.id],
    "CAJA must only receive its assigned inventory location",
  );

  const cajaRollos = await api(
    "GET",
    `/inventario/rollos?ubicacionId=${otherTiendaId}&pageSize=100`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(cajaRollos.status, 200, JSON.stringify(cajaRollos.body));
  const cajaItems = (cajaRollos.body as { items: Array<Record<string, unknown>> }).items;
  assert.ok(cajaItems.length > 0, "CAJA fixture inventory must be visible");
  assert.ok(
    cajaItems.every((item) => item.ubicacionId === seedTienda.id),
    "CAJA with legacy TODAS scope must still be forced to its assigned store",
  );
  assert.ok(
    cajaItems.some((item) => "costoUnitario" in item && "costoTotal" in item),
    "CAJA inventory must include unit and total costs",
  );

  const ownProductoId = await mkProducto();
  await mkRolloDisponible(seedTienda.id, ownProductoId, testAdmin.id);
  const otherProductoId = await mkProducto();
  const otherRolloId = await mkRolloDisponible(otherTiendaId, otherProductoId, testAdmin.id);

  const cajaOtherDetail = await api(
    "GET",
    `/inventario/rollos/${otherRolloId}`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(cajaOtherDetail.status, 404, JSON.stringify(cajaOtherDetail.body));

  const cajaForbiddenAdjustment = await api(
    "POST",
    `/inventario/rollos/${sharedRolloId}/ajustar`,
    { nuevaCantidad: "14.000", justificacion: "Intento no permitido", uuidCliente: randomUUID() },
    cajaLogin.cookie,
  );
  assert.equal(cajaForbiddenAdjustment.status, 403, JSON.stringify(cajaForbiddenAdjustment.body));

  const propiaLogin = await login(testBodega.usuario, testBodega.password);
  const grouped = await api(
    "GET",
    `/inventario/existencias/agrupadas?ubicacionId=${otherTiendaId}`,
    undefined,
    propiaLogin.cookie,
  );
  assert.equal(grouped.status, 200, JSON.stringify(grouped.body));
  const productIds = new Set(
    (grouped.body as Array<{ colores: Array<{ productoId: number }> }>)
      .flatMap((group) => group.colores)
      .map((product) => product.productoId),
  );
  assert.ok(
    productIds.has(ownProductoId),
    "PROPIA grouped inventory must use the user's assigned location",
  );
  assert.ok(
    !productIds.has(otherProductoId),
    "PROPIA grouped inventory must not honor another ubicacionId",
  );
});

// S-24: Non-ADMIN mutation on other location → 403; ADMIN same mutation → succeeds
await test("S-24: Non-ADMIN mutation on other-location → 403; ADMIN same → succeeds", async () => {
  // testBodegaOtherLoc is assigned to otherTiendaId
  // Create a rollo at seedTienda — bodegaOtherLoc should be forbidden to do salida there
  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(seedTienda.id, productoId, testAdmin.id);
  const [rollo] = await db
    .select({ serie: rollosTable.serie })
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId));
  assert.ok(rollo);

  // BODEGA from otherTienda tries a documented counter exit from seedTienda → 403
  const bodegaLogin = await login(testBodegaOtherLoc.usuario, testBodegaOtherLoc.password);
  const r403 = await api("POST", "/salidas/mostrador", {
    origenId: seedTienda.id,
    series: [rollo.serie],
    observaciones: "test cross-location attempt",
    uuidCliente: randomUUID(),
  }, bodegaLogin.cookie);
  assert.equal(r403.status, 403, `Expected 403 for cross-location mutation, got ${r403.status}: ${JSON.stringify(r403.body)}`);

  // ADMIN can do the same mutation on any location
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const r200 = await api("POST", "/salidas/mostrador", {
    origenId: seedTienda.id,
    series: [rollo.serie],
    observaciones: "admin cross-location test",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(r200.status, 201, `Expected 201 for ADMIN cross-location, got ${r200.status}: ${JSON.stringify(r200.body)}`);
  assert.equal((r200.body as Record<string, unknown>).modalidad, "MOSTRADOR");
  assert.equal((r200.body as Record<string, unknown>).destinoId, null);
  createdSalidaIds.push(Number((r200.body as Record<string, unknown>).id));
  const [retired] = await db
    .select({ estado: rollosTable.estado, cantidadActual: rollosTable.cantidadActual })
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId));
  assert.equal(retired?.estado, "MOSTRADOR");
  assert.equal(Number(retired?.cantidadActual), 0);
});

// S-25: GET /clientes/:id — response does NOT include limiteCredito or saldoCredito
await test("S-25: GET /clientes/:id — no limiteCredito / saldoCredito in response", async () => {
  // Create a cliente via TERMINAL
  const cajaLogin = await login(testTerminal.usuario, testTerminal.password);
  const createR = await api("POST", "/clientes", {
    nombre: `Cliente SAT ${RUN}`,
    telefono: "5551234567",
  }, cajaLogin.cookie);
  assert.equal(createR.status, 201, `Create cliente failed: ${JSON.stringify(createR.body)}`);
  const clienteId = (createR.body as Record<string, unknown>).id as number;
  createdClienteIds.push(clienteId);

  // GET the cliente
  const getR = await api("GET", `/clientes/${clienteId}`, undefined, cajaLogin.cookie);
  assert.equal(getR.status, 200, `Expected 200, got ${getR.status}: ${JSON.stringify(getR.body)}`);
  const body = getR.body as Record<string, unknown>;

  // Financial fields must NOT be present
  assert.ok(!("limiteCredito" in body), "limiteCredito must not be in operational response");
  assert.ok(!("saldoCredito" in body), "saldoCredito must not be in operational response");
  assert.ok(!("saldoActual" in body), "saldoActual must not be in operational response");
  assert.ok(!("creditoDisponible" in body), "creditoDisponible must not be in operational response");

  // Operational fields must be present
  assert.ok("nombre" in body, "nombre must be present");
  assert.ok("activo" in body, "activo must be present");
  assert.ok("id" in body, "id must be present");
});

// S-26: clientes_credito and clientes_precios independently gated
await test("S-26: clientes_credito / clientes_precios / clientes_finanzas independently gated", async () => {
  // Use clienteId from S-25 if possible; otherwise look up
  let clienteId = createdClienteIds[createdClienteIds.length - 1];
  if (!clienteId) {
    const adminLogin = await login(testAdmin.usuario, testAdmin.password);
    const cr = await api("POST", "/clientes", { nombre: `Cliente S26 ${RUN}` }, adminLogin.cookie);
    clienteId = (cr.body as Record<string, unknown>).id as number;
    createdClienteIds.push(clienteId);
  }

  const cajaLogin = await login(testCaja.usuario, testCaja.password);
  const bodegaLogin = await login(testBodega.usuario, testBodega.password);
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);

  // Strict CAJA has no access to customer administration modules.
  const creditoCaja = await api("GET", `/clientes/${clienteId}/credito`, undefined, cajaLogin.cookie);
  assert.equal(creditoCaja.status, 403, `CAJA must not access credito: ${JSON.stringify(creditoCaja.body)}`);

  // CAJA does not receive terminal price history
  const preciosCaja = await api("GET", `/clientes/${clienteId}/precios`, undefined, cajaLogin.cookie);
  assert.equal(preciosCaja.status, 403, `CAJA must not access precios: ${JSON.stringify(preciosCaja.body)}`);

  // Cobros operational reads do not grant the broader customer finance module.
  const estadoCaja = await api("GET", `/clientes/${clienteId}/estado-cuenta`, undefined, cajaLogin.cookie);
  assert.equal(estadoCaja.status, 403, `CAJA must not access estado-cuenta: ${JSON.stringify(estadoCaja.body)}`);

  const terminalLogin = await login(testTerminal.usuario, testTerminal.password);
  const preciosTerminal = await api("GET", `/clientes/${clienteId}/precios`, undefined, terminalLogin.cookie);
  assert.equal(preciosTerminal.status, 200, `TERMINAL should access precios: ${JSON.stringify(preciosTerminal.body)}`);
  const disponibilidadTerminal = await api(
    "GET",
    `/pos/clientes/${clienteId}/credito-disponible?ubicacionId=${seedTienda.id}`,
    undefined,
    terminalLogin.cookie,
  );
  assert.equal(disponibilidadTerminal.status, 200, "TERMINAL with pos.crear receives minimal availability");
  const disponibilidadBody = disponibilidadTerminal.body as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(disponibilidadBody).sort(),
    ["clienteId", "creditoDisponible", "limiteCredito", "puedeComprarCredito", "saldoComprometido"].sort(),
  );

  const posViewer = await mkUser("BODEGA", seedTienda.id);
  const [posViewerOverride] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: posViewer.id,
      modulo: "pos",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(posViewerOverride!.id);
  const posViewerLogin = await login(posViewer.usuario, posViewer.password);
  const viewerDetailed = await api("GET", `/clientes/${clienteId}/credito`, undefined, posViewerLogin.cookie);
  assert.equal(viewerDetailed.status, 403, "pos.ver alone cannot access detailed credit");
  const viewerMinimal = await api(
    "GET",
    `/pos/clientes/${clienteId}/credito-disponible?ubicacionId=${seedTienda.id}`,
    undefined,
    posViewerLogin.cookie,
  );
  assert.equal(viewerMinimal.status, 403, "pos.ver alone cannot access sale availability");

  // BODEGA: denied all (no clientes access at all by default)
  // First check bodega is denied clientes
  const bodegaCliente = await api("GET", `/clientes/${clienteId}`, undefined, bodegaLogin.cookie);
  assert.equal(bodegaCliente.status, 403, "BODEGA denied /clientes");

  // BODEGA denied credito (no clientes_credito)
  const creditoBodega = await api("GET", `/clientes/${clienteId}/credito`, undefined, bodegaLogin.cookie);
  assert.equal(creditoBodega.status, 403, `BODEGA must be denied credito: ${JSON.stringify(creditoBodega.body)}`);

  // BODEGA denied precios (no clientes_precios)
  const preciosBodega = await api("GET", `/clientes/${clienteId}/precios`, undefined, bodegaLogin.cookie);
  assert.equal(preciosBodega.status, 403, `BODEGA must be denied precios: ${JSON.stringify(preciosBodega.body)}`);

  // ADMIN has all → 200
  const creditoAdmin = await api("GET", `/clientes/${clienteId}/credito`, undefined, adminLogin.cookie);
  assert.equal(creditoAdmin.status, 200, `ADMIN should access credito: ${JSON.stringify(creditoAdmin.body)}`);
  const finanzasAdmin = await api("GET", `/clientes/${clienteId}/estado-cuenta`, undefined, adminLogin.cookie);
  assert.equal(finanzasAdmin.status, 200, `ADMIN should access estado-cuenta: ${JSON.stringify(finanzasAdmin.body)}`);

  const clientAdjustment = await api(
    "POST",
    `/clientes/${clienteId}/ajustes`,
    {
      importe: 1234.56,
      motivo: "Ajuste temporal para validar exportación XLSX",
      referencia: `XLSX-${RUN}`,
    },
    adminLogin.cookie,
  );
  assert.equal(clientAdjustment.status, 201);

  const loadWorkbook = async (path: string): Promise<ExcelJS.Workbook> => {
    const response = await fetch(`${BASE}${path}`, {
      headers: { Cookie: adminLogin.cookie },
    });
    assert.equal(response.status, 200, `Expected XLSX at ${path}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(await response.arrayBuffer()) as never,
    );
    return workbook;
  };

  const analyticsProductId = await mkProducto();
  const [maxFolio] = await db
    .select({ value: sql<number>`COALESCE(MAX(${ticketsTable.folio}), 0)` })
    .from(ticketsTable);
  const [analyticsTicket] = await db
    .insert(ticketsTable)
    .values({
      folio: Number(maxFolio?.value ?? 0) + 1,
      ubicacionId: seedTienda.id,
      usuarioTerminalId: testAdmin.id,
      clienteId,
      subtotal: "1250.00",
      iva: "200.00",
      tasaIva: "0.1600",
      total: "1450.00",
      estado: "VENDIDO",
      cobrado: true,
      uuidCliente: randomUUID(),
    })
    .returning({ id: ticketsTable.id });
  await db.insert(ticketLineasTable).values({
    ticketId: analyticsTicket!.id,
    productoId: analyticsProductId,
    tipo: "METREADO",
    cantidad: "12.345",
    precioUnitario: "101.26",
    precioSugerido: "101.26",
    importe: "1250.00",
    costoUnitarioCongelado: null,
    costoTotalCongelado: null,
  });

  const analyticsWorkbook = await loadWorkbook("/clientes/analitica.xlsx");
  const analyticsSheet = analyticsWorkbook.getWorksheet("Analítica");
  assert.ok(analyticsSheet);
  assert.equal(typeof analyticsSheet.getCell("D2").value, "number");
  assert.equal(typeof analyticsSheet.getCell("F2").value, "string");
  assert.equal(typeof analyticsSheet.getCell("G2").value, "number");
  assert.equal(analyticsSheet.getCell("H2").value, null);
  assert.equal(typeof analyticsSheet.getCell("B2").value, "string");
  assert.equal(analyticsSheet.getColumn(4).numFmt, '"$"#,##0.00');
  assert.equal(analyticsSheet.getColumn(7).numFmt, "#,##0.00");
  assert.equal(analyticsSheet.getColumn(8).numFmt, '"$"#,##0.00');
  await db
    .delete(ticketLineasTable)
    .where(eq(ticketLineasTable.ticketId, analyticsTicket!.id));
  await db.delete(ticketsTable).where(eq(ticketsTable.id, analyticsTicket!.id));

  const clientStatementWorkbook = await loadWorkbook(
    `/clientes/${clienteId}/estado-cuenta.xlsx`,
  );
  const clientStatementSheet = clientStatementWorkbook.getWorksheet("Estado de cuenta");
  assert.ok(clientStatementSheet);
  assert.equal(typeof clientStatementSheet.getCell("C2").value, "number");
  assert.equal(typeof clientStatementSheet.getCell("D2").value, "number");
  const projectedBalanceRow = clientStatementSheet
    .getRows(2, Math.max(1, clientStatementSheet.rowCount - 1))
    ?.find((row) => row.getCell(2).value === "SALDO ACTUAL PROYECTADO");
  assert.ok(projectedBalanceRow);
  assert.equal(typeof projectedBalanceRow.getCell(5).value, "number");
  assert.equal(clientStatementSheet.getColumn(3).numFmt, '"$"#,##0.00');
  assert.equal(clientStatementSheet.getColumn(4).numFmt, '"$"#,##0.00');
  assert.equal(projectedBalanceRow.getCell(5).numFmt, '"$"#,##0.00');

  const carteraXlsx = await api(
    "GET",
    "/clientes/cartera.xlsx",
    undefined,
    adminLogin.cookie,
  );
  assert.equal(carteraXlsx.status, 200, "ADMIN should download cartera XLSX");
  assert.match(
    carteraXlsx.contentType,
    /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
  const carteraWorkbook = await loadWorkbook("/clientes/cartera.xlsx");
  const carteraSheet = carteraWorkbook.getWorksheet("Cartera");
  assert.ok(carteraSheet);
  assert.equal(typeof carteraSheet.getCell("B2").value, "number");
  assert.equal(typeof carteraSheet.getCell("C2").value, "number");
  assert.equal(carteraSheet.getColumn(2).numFmt, '"$"#,##0.00');
  assert.equal(carteraSheet.getColumn(3).numFmt, '"$"#,##0.00');

  const salidasWorkbook = await loadWorkbook("/salidas/exportar");
  const salidasSheet = salidasWorkbook.getWorksheet("Salidas");
  assert.ok(salidasSheet);
  assert.equal(typeof salidasSheet.getCell("A2").value, "string");
  assert.equal(typeof salidasSheet.getCell("F2").value, "number");
  assert.equal(typeof salidasSheet.getCell("G2").value, "number");
  assert.equal(typeof salidasSheet.getCell("H2").value, "number");
  assert.equal(salidasSheet.getColumn(6).numFmt, "#,##0");
  assert.equal(salidasSheet.getColumn(7).numFmt, "#,##0.00");
  assert.equal(salidasSheet.getColumn(8).numFmt, "#,##0.00");

  const [provider] = await db
    .insert(proveedoresTable)
    .values({
      nombre: `Proveedor XLSX ${RUN}`,
      tipo: "NACIONAL",
      monedaDefault: "MXN",
    })
    .returning({ id: proveedoresTable.id });
  assert.ok(provider);
  const providerAdjustment = await api(
    "POST",
    `/proveedores/${provider.id}/ajustes`,
    { importe: 765.43, notas: "Ajuste temporal para validar exportación XLSX" },
    adminLogin.cookie,
  );
  assert.equal(providerAdjustment.status, 201);
  const providerWorkbook = await loadWorkbook(
    `/proveedores/${provider.id}/exportar`,
  );
  const providerSheet = providerWorkbook.getWorksheet("Estado de Cuenta");
  assert.ok(providerSheet);
  const providerHeaderRow = providerSheet
    .getColumn(1)
    .values.findIndex((value) => value === "Fecha");
  assert.ok(providerHeaderRow > 0);
  assert.equal(
    typeof providerSheet.getCell(providerHeaderRow + 1, 4).value,
    "number",
  );
  assert.equal(
    typeof providerSheet.getCell(providerHeaderRow + 1, 5).value,
    "number",
  );
  assert.equal(providerSheet.getColumn(4).numFmt, '"$"#,##0.00');
  assert.equal(providerSheet.getColumn(5).numFmt, '"$"#,##0.00');
  assert.equal(
    typeof providerSheet.getRow(providerSheet.rowCount).getCell(2).value,
    "number",
  );
  assert.equal(
    providerSheet.getRow(providerSheet.rowCount).getCell(2).numFmt,
    '"$"#,##0.00',
  );

  const carteraPdf = await api(
    "GET",
    "/clientes/cartera.pdf",
    undefined,
    adminLogin.cookie,
  );
  assert.equal(carteraPdf.status, 200, "ADMIN should download cartera PDF");
  assert.match(carteraPdf.contentType, /^application\/pdf/);
});

// S-27: Inventory reversals and kardex/cache reconciliation
await test("S-27: SALIDA_MOSTRADOR reversal fails (MOSTRADOR stays); VENTA+BAJA revert + cache reconcile", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);

  // Create a fresh rollo for this test
  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(seedTienda.id, productoId, testAdmin.id);
  const [rollo] = await db
    .select({ serie: rollosTable.serie })
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId));
  assert.ok(rollo);

  // ── Part A: SALIDA_MOSTRADOR then attempt reversal ─────────────────────────

  // Do the documented salida-mostrador flow, which must persist its document.
  const salidaR = await api("POST", "/salidas/mostrador", {
    origenId: seedTienda.id,
    series: [rollo.serie],
    observaciones: "salida S27 test",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(salidaR.status, 201, `salida-mostrador failed: ${JSON.stringify(salidaR.body)}`);
  createdSalidaIds.push(Number((salidaR.body as Record<string, unknown>).id));
  const [retired] = await db
    .select({ estado: rollosTable.estado, cantidadActual: rollosTable.cantidadActual })
    .from(rollosTable)
    .where(eq(rollosTable.id, rolloId));
  assert.equal(retired?.estado, "MOSTRADOR");
  assert.equal(Number(retired?.cantidadActual), 0);

  // Find the SALIDA_MOSTRADOR movement
  const salidaMovRow = await db
    .select({ id: movimientosTable.id })
    .from(movimientosTable)
    .where(and(
      eq(movimientosTable.rolloId, rolloId),
      eq(movimientosTable.tipo, "SALIDA_MOSTRADOR"),
    ))
    .limit(1);
  assert.ok(salidaMovRow.length > 0, "SALIDA_MOSTRADOR movement must exist");

  // Attempt reversal of SALIDA_MOSTRADOR → must fail (400)
  const revertSalidaR = await api("POST", `/inventario/rollos/${rolloId}/revertir`, {
    movimientoOrigenId: salidaMovRow[0]!.id,
    justificacion: "test reversal of salida mostrador",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(revertSalidaR.status, 400, `Expected 400 reverting SALIDA_MOSTRADOR, got ${revertSalidaR.status}: ${JSON.stringify(revertSalidaR.body)}`);

  // Rollo must still be MOSTRADOR
  const rolloCheck = await api("GET", `/inventario/rollos/${rolloId}`, undefined, adminLogin.cookie);
  assert.equal(rolloCheck.status, 200);
  assert.equal((rolloCheck.body as Record<string, unknown>).estado, "MOSTRADOR",
    "Rollo must remain MOSTRADOR after failed reversal");

  // ── Part B: VENTA reversal restores DISPONIBLE with correct quantities ─────

  const productoId2 = await mkProducto();
  const rolloId2 = await mkRolloDisponible(seedTienda.id, productoId2, testAdmin.id);

  // Read initial quantity
  const rollo2Before = await api("GET", `/inventario/rollos/${rolloId2}`, undefined, adminLogin.cookie);
  const cantidadInicial = parseFloat((rollo2Before.body as Record<string, unknown>).cantidadInicial as string);
  assert.ok(cantidadInicial > 0, "rollo2 must have positive initial quantity");

  // Do VENTA
  const ventaR = await api("POST", `/inventario/rollos/${rolloId2}/vender`, {
    justificacion: "venta S27 test",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(ventaR.status, 200, `vender failed: ${JSON.stringify(ventaR.body)}`);
  assert.equal((ventaR.body as Record<string, unknown>).estado, "VENDIDO");

  // Find the VENTA movement
  const ventaMovRow = await db
    .select({ id: movimientosTable.id })
    .from(movimientosTable)
    .where(and(
      eq(movimientosTable.rolloId, rolloId2),
      eq(movimientosTable.tipo, "VENTA"),
    ))
    .limit(1);
  assert.ok(ventaMovRow.length > 0, "VENTA movement must exist");

  // Read existencia before reversal
  const exBefore = await db
    .select({ cantidadTotal: existenciasTable.cantidadTotal, rollosCount: existenciasTable.rollosCount })
    .from(existenciasTable)
    .where(and(eq(existenciasTable.productoId, productoId2), eq(existenciasTable.ubicacionId, seedTienda.id)))
    .limit(1);

  // Revert VENTA
  const revertVentaR = await api("POST", `/inventario/rollos/${rolloId2}/revertir`, {
    movimientoOrigenId: ventaMovRow[0]!.id,
    justificacion: "revertir venta S27",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(revertVentaR.status, 200, `Expected 200 reverting VENTA, got ${revertVentaR.status}: ${JSON.stringify(revertVentaR.body)}`);
  assert.equal((revertVentaR.body as Record<string, unknown>).estado, "DISPONIBLE",
    "After VENTA reversal, rollo must be DISPONIBLE");
  assert.equal(
    (revertVentaR.body as Record<string, unknown>).cantidadActual,
    (rollo2Before.body as Record<string, unknown>).cantidadInicial,
    "cantidadActual must be restored to cantidadInicial",
  );

  // Verify existencia was restored
  const exAfter = await db
    .select({ cantidadTotal: existenciasTable.cantidadTotal, rollosCount: existenciasTable.rollosCount })
    .from(existenciasTable)
    .where(and(eq(existenciasTable.productoId, productoId2), eq(existenciasTable.ubicacionId, seedTienda.id)))
    .limit(1);
  assert.ok(parseFloat(exAfter[0]!.cantidadTotal) > parseFloat(exBefore[0]?.cantidadTotal ?? "0"),
    "existencias cantidadTotal must increase after VENTA reversal");

  // ── Part C: BAJA (ajuste) reversal restores DISPONIBLE ────────────────────

  const productoId3 = await mkProducto();
  const rolloId3 = await mkRolloDisponible(seedTienda.id, productoId3, testAdmin.id);

  const rollo3 = await api("GET", `/inventario/rollos/${rolloId3}`, undefined, adminLogin.cookie);
  const cantidadRollo3 = parseFloat((rollo3.body as Record<string, unknown>).cantidadActual as string);

  // Do a BAJA adjustment
  const bajaR = await api("POST", `/inventario/rollos/${rolloId3}/ajustar`, {
    cantidadNueva: null, // BAJA type — set to null to trigger baja vs ajuste
    justificacion: "baja para test S27 reversal",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  // Support deployments where the adjustment endpoint requires a target quantity.
  if (bajaR.status !== 200) {
    const bajaR2 = await api("POST", `/inventario/rollos/${rolloId3}/ajustar`, {
      cantidadNueva: String((cantidadRollo3 / 2).toFixed(3)),
      justificacion: "ajuste parcial para test S27 reversal",
      uuidCliente: randomUUID(),
    }, adminLogin.cookie);
    assert.equal(bajaR2.status, 200, `ajuste failed: ${JSON.stringify(bajaR2.body)}`);
  }

  // Find the AJUSTE movement
  const ajusteMovRow = await db
    .select({ id: movimientosTable.id, tipo: movimientosTable.tipo })
    .from(movimientosTable)
    .where(and(
      eq(movimientosTable.rolloId, rolloId3),
    ))
    .limit(10);

  const ajusteMov = ajusteMovRow.find((m) =>
    m.tipo === "AJUSTE_POSITIVO" || m.tipo === "AJUSTE_NEGATIVO",
  );
  assert.ok(ajusteMov, `AJUSTE_POSITIVO/NEGATIVO movement must exist; found: ${JSON.stringify(ajusteMovRow)}`);

  // Revert the BAJA
  const revertBajaR = await api("POST", `/inventario/rollos/${rolloId3}/revertir`, {
    movimientoOrigenId: ajusteMov.id,
    justificacion: "revertir baja S27",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(revertBajaR.status, 200, `Expected 200 reverting BAJA, got ${revertBajaR.status}: ${JSON.stringify(revertBajaR.body)}`);
  assert.equal((revertBajaR.body as Record<string, unknown>).estado, "DISPONIBLE",
    "After BAJA reversal, rollo must be DISPONIBLE");
  assert.equal(
    (revertBajaR.body as Record<string, unknown>).cantidadActual,
    (rollo3.body as Record<string, unknown>).cantidadActual,
    "cantidadActual must be restored after BAJA reversal",
  );

  // ── Part D: kardex/cache reconciliation after reversals ───────────────────

  // Use productoId2 (the one that had VENTA + reversal)
  const kardexR = await api(
    "GET",
    `/inventario/kardex?productoId=${productoId2}`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(kardexR.status, 200, `kardex failed: ${JSON.stringify(kardexR.body)}`);
  const kardexBody = kardexR.body as Record<string, unknown>;
  const movs = kardexBody.movimientos as Array<Record<string, unknown>>;

  // Sum of all movements for productoId2 at seedTienda must equal existencias cache
  const movSum = movs
    .filter((m) => m.ubicacionId === seedTienda.id)
    .reduce((acc, m) => acc + parseFloat(m.cantidad as string), 0);

  const cacheRow = await db
    .select({ cantidadTotal: existenciasTable.cantidadTotal })
    .from(existenciasTable)
    .where(and(
      eq(existenciasTable.productoId, productoId2),
      eq(existenciasTable.ubicacionId, seedTienda.id),
    ))
    .limit(1);

  if (cacheRow.length > 0) {
    const cacheVal = parseFloat(cacheRow[0]!.cantidadTotal);
    assert.ok(
      Math.abs(movSum - cacheVal) < 0.001,
      `Kardex sum (${movSum}) must equal existencias cache (${cacheVal}) after reversals`,
    );
  }
});

// S-28: delegated user administration cannot create/promote/modify ADMINs
await test("S-28: Non-ADMIN with usuarios permissions cannot escalate to ADMIN", async () => {
  const [override] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: testBodega.id,
      modulo: "usuarios",
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeAutorizar: true,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(override.id);

  const delegatedLogin = await login(testBodega.usuario, testBodega.password);
  assert.equal(delegatedLogin.status, 200);
  const attemptedUsername = `escalation_${RUN}`.toLowerCase();

  const createAdmin = await api(
    "POST",
    "/users",
    {
      nombre: "Escalation Attempt",
      usuario: attemptedUsername,
      password: "TemporaryPassword123!",
      rol: "ADMIN",
      ubicacionId: null,
      alcanceConsulta: "TODAS",
    },
    delegatedLogin.cookie,
  );
  assert.equal(
    createAdmin.status,
    403,
    `Delegated non-ADMIN must not create ADMIN: ${JSON.stringify(createAdmin.body)}`,
  );

  const selfPromote = await api(
    "PATCH",
    `/users/${testBodega.id}`,
    { rol: "ADMIN" },
    delegatedLogin.cookie,
  );
  assert.equal(
    selfPromote.status,
    403,
    `Delegated user must not self-promote: ${JSON.stringify(selfPromote.body)}`,
  );

  const promoteOther = await api(
    "PATCH",
    `/users/${testBodegaOtherLoc.id}`,
    { rol: "ADMIN" },
    delegatedLogin.cookie,
  );
  assert.equal(
    promoteOther.status,
    403,
    `Delegated user must not promote another account: ${JSON.stringify(promoteOther.body)}`,
  );

  const modifyAdmin = await api(
    "PATCH",
    `/users/${testAdmin.id}`,
    { nombre: "Unauthorized Admin Edit" },
    delegatedLogin.cookie,
  );
  assert.equal(
    modifyAdmin.status,
    403,
    `Delegated user must not modify an ADMIN account: ${JSON.stringify(modifyAdmin.body)}`,
  );

  const [createdAdmin] = await db
    .select({ id: usuariosTable.id })
    .from(usuariosTable)
    .where(eq(usuariosTable.usuario, attemptedUsername))
    .limit(1);
  assert.equal(createdAdmin, undefined, "Denied ADMIN creation must not persist a user");

  await db
    .delete(permisosUsuarioTable)
    .where(eq(permisosUsuarioTable.id, override.id));
  createdPermisosUsuarioIds.splice(
    createdPermisosUsuarioIds.indexOf(override.id),
    1,
  );
});

await test("S-29: promotion to ADMIN removes overrides and ADMIN override routes → 403", async () => {
  const candidate = await mkUser("CAJA", seedTienda.id);
  await db.insert(permisosUsuarioTable).values({
    usuarioId: candidate.id,
    modulo: "dashboard",
    puedeVer: false,
    puedeCrear: false,
    puedeEditar: false,
    puedeAutorizar: false,
  });

  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const promoted = await api(
    "PATCH",
    `/users/${candidate.id}`,
    { rol: "ADMIN", ubicacionId: null, alcanceConsulta: "TODAS" },
    adminLogin.cookie,
  );
  assert.equal(
    promoted.status,
    200,
    `ADMIN promotion failed: ${JSON.stringify(promoted.body)}`,
  );

  const [{ value: remainingOverrides }] = await db
    .select({ value: count() })
    .from(permisosUsuarioTable)
    .where(eq(permisosUsuarioTable.usuarioId, candidate.id));
  assert.equal(
    remainingOverrides,
    0,
    "Promoting a user to ADMIN must remove every existing override",
  );

  const readOverrides = await api(
    "GET",
    `/permisos/usuarios/${candidate.id}`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(readOverrides.status, 403);

  const writeOverride = await api(
    "PUT",
    `/permisos/usuarios/${candidate.id}/dashboard`,
    { puedeVer: false, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
    adminLogin.cookie,
  );
  assert.equal(writeOverride.status, 403);

  const deleteOverride = await api(
    "DELETE",
    `/permisos/usuarios/${candidate.id}/dashboard`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(deleteOverride.status, 403);
});

await test("S-30: explicit CAJA CORTES override authorizes cash management while location rules remain enforced", async () => {
  const cajaLocationId = await mkUbicacion();
  const otherLocationId = await mkUbicacion();
  const createOnlyCaja = await mkUser("CAJA", cajaLocationId);
  const [createOnlyOverride] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: createOnlyCaja.id,
      modulo: "cortes",
      puedeVer: false,
      puedeCrear: true,
      puedeEditar: null,
      puedeAutorizar: null,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(createOnlyOverride!.id);
  const createOnlyLogin = await login(createOnlyCaja.usuario, createOnlyCaja.password);
  const createOnlyOpen = await api(
    "POST",
    "/sesiones-caja/abrir",
    { ubicacionId: cajaLocationId, fondoInicial: 100 },
    createOnlyLogin.cookie,
  );
  assert.equal(
    createOnlyOpen.status,
    403,
    "cortes.crear without cortes.ver cannot manage cash",
  );

  const caja = await mkUser("CAJA", cajaLocationId);
  const [cortesOverride] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: caja.id,
      modulo: "cortes",
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: null,
      puedeAutorizar: null,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(cortesOverride!.id);
  const cajaLogin = await login(caja.usuario, caja.password);
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(cajaLogin.status, 200);
  assert.equal(adminLogin.status, 200);

  const cajaOpened = await api(
    "POST",
    "/sesiones-caja/abrir",
    { ubicacionId: cajaLocationId, fondoInicial: 100 },
    cajaLogin.cookie,
  );
  assert.equal(cajaOpened.status, 201, JSON.stringify(cajaOpened.body));
  const cajaSessionId = (cajaOpened.body as Record<string, unknown>).id as number;
  createdSesionCajaIds.push(cajaSessionId);

  const cajaCurrentCorte = await api(
    "GET",
    `/sesiones-caja/${cajaSessionId}/corte`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(cajaCurrentCorte.status, 200, JSON.stringify(cajaCurrentCorte.body));

  const closed = await api(
    "POST",
    `/sesiones-caja/${cajaSessionId}/cerrar`,
    { efectivoContado: 100 },
    cajaLogin.cookie,
  );
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(
    ((closed.body as Record<string, unknown>).sesion as Record<string, unknown>)
      .id,
    cajaSessionId,
    "close must return the just-closed full corte",
  );
  assert.ok(
    Array.isArray((closed.body as Record<string, unknown>).formasPago),
    "close response must retain full corte details",
  );

  const cajaClosedCorte = await api(
    "GET",
    `/sesiones-caja/${cajaSessionId}/corte`,
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(cajaClosedCorte.status, 200, JSON.stringify(cajaClosedCorte.body));

  const otherOpened = await api(
    "POST",
    "/sesiones-caja/abrir",
    { ubicacionId: otherLocationId, fondoInicial: 50 },
    adminLogin.cookie,
  );
  assert.equal(otherOpened.status, 201, JSON.stringify(otherOpened.body));
  const otherSessionId = (otherOpened.body as Record<string, unknown>).id as number;
  createdSesionCajaIds.push(otherSessionId);

  const cajaHistory = await api(
    "GET",
    "/sesiones-caja",
    undefined,
    cajaLogin.cookie,
  );
  assert.equal(cajaHistory.status, 403, JSON.stringify(cajaHistory.body));

  const adminHistory = await api(
    "GET",
    "/sesiones-caja",
    undefined,
    adminLogin.cookie,
  );
  assert.equal(adminHistory.status, 200, JSON.stringify(adminHistory.body));
  const history = adminHistory.body as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(history));
  const cajaSummary = history.find((item) => item.id === cajaSessionId);
  const otherSummary = history.find((item) => item.id === otherSessionId);
  assert.equal(cajaSummary?.ubicacionId, cajaLocationId);
  assert.equal(cajaSummary?.estado, "CERRADA");
  assert.equal(cajaSummary?.diferencia, "0.00");
  assert.equal(otherSummary?.ubicacionId, otherLocationId);
  assert.equal(otherSummary?.estado, "ABIERTA");
  assert.ok(
    history.findIndex((item) => item.id === otherSessionId) <
      history.findIndex((item) => item.id === cajaSessionId),
    "history must be descending by session date",
  );

  for (const id of [cajaSessionId, otherSessionId]) {
    const adminCorte = await api(
      "GET",
      `/sesiones-caja/${id}/corte`,
      undefined,
      adminLogin.cookie,
    );
    assert.equal(adminCorte.status, 200, JSON.stringify(adminCorte.body));
    assert.equal(
      ((adminCorte.body as Record<string, unknown>).sesion as Record<
        string,
        unknown
      >).id,
      id,
    );
  }
});

await test("S-30A: extraordinary exits require direct ADMIN despite full salidas overrides", async () => {
  const overrides = await db
    .insert(permisosUsuarioTable)
    .values([testSupervisor, testBodega].map((user) => ({
      usuarioId: user.id,
      modulo: "salidas",
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeAutorizar: true,
    })))
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(...overrides.map((row) => row.id));

  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(seedTienda.id, productoId, testAdmin.id);
  const [adminLogin, supervisorLogin, bodegaLogin] = await Promise.all([
    login(testAdmin.usuario, testAdmin.password),
    login(testSupervisor.usuario, testSupervisor.password),
    login(testBodega.usuario, testBodega.password),
  ]);
  for (const loginResult of [adminLogin, supervisorLogin, bodegaLogin]) {
    assert.equal(loginResult.status, 200, JSON.stringify(loginResult.body));
  }

  const createBody = {
    rolloId,
    motivo: "MERMA",
    justificacion: "Merma de seguridad comprobada",
    uuidCliente: randomUUID(),
  };
  for (const actor of [supervisorLogin, bodegaLogin]) {
    const create = await api(
      "POST",
      "/inventario/salidas-extraordinarias",
      createBody,
      actor.cookie,
    );
    assert.equal(create.status, 403, JSON.stringify(create.body));
    const list = await api(
      "GET",
      "/inventario/salidas-extraordinarias",
      undefined,
      actor.cookie,
    );
    assert.equal(list.status, 403, JSON.stringify(list.body));
  }

  const created = await api(
    "POST",
    "/inventario/salidas-extraordinarias",
    createBody,
    adminLogin.cookie,
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const movimientoId = Number((created.body as { movimientoId: number }).movimientoId);
  assert.ok(movimientoId > 0);
  const createdAt = new Date((created.body as { createdAt: string }).createdAt);
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(createdAt);
  const datePart = (type: string) => dateParts.find((part) => part.type === type)!.value;
  const mexicoDate = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const filtered = await api(
    "GET",
    `/inventario/salidas-extraordinarias?fechaDesde=${mexicoDate}&fechaHasta=${mexicoDate}`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(filtered.status, 200, JSON.stringify(filtered.body));
  assert.ok(
    (filtered.body as { items: Array<{ movimientoId: number }> }).items.some(
      (item) => item.movimientoId === movimientoId,
    ),
    "ADMIN date-filtered list must include the created exit",
  );

  const whitespaceDedicated = await api(
    "POST",
    `/inventario/salidas-extraordinarias/${movimientoId}/revertir`,
    { justificacion: "            ", uuidCliente: randomUUID() },
    adminLogin.cookie,
  );
  assert.equal(whitespaceDedicated.status, 400, JSON.stringify(whitespaceDedicated.body));
  const whitespaceGeneric = await api(
    "POST",
    `/inventario/rollos/${rolloId}/revertir`,
    {
      movimientoOrigenId: movimientoId,
      justificacion: "            ",
      uuidCliente: randomUUID(),
    },
    adminLogin.cookie,
  );
  assert.equal(whitespaceGeneric.status, 400, JSON.stringify(whitespaceGeneric.body));

  const reverseBody = {
    justificacion: "   Corrección administrativa comprobada   ",
    uuidCliente: randomUUID(),
  };
  for (const actor of [supervisorLogin, bodegaLogin]) {
    const reverse = await api(
      "POST",
      `/inventario/salidas-extraordinarias/${movimientoId}/revertir`,
      reverseBody,
      actor.cookie,
    );
    assert.equal(reverse.status, 403, JSON.stringify(reverse.body));
  }
  const reversed = await api(
    "POST",
    `/inventario/salidas-extraordinarias/${movimientoId}/revertir`,
    reverseBody,
    adminLogin.cookie,
  );
  assert.equal(reversed.status, 200, JSON.stringify(reversed.body));
  assert.equal((reversed.body as { estado: string }).estado, "DISPONIBLE");
  const retried = await api(
    "POST",
    `/inventario/salidas-extraordinarias/${movimientoId}/revertir`,
    reverseBody,
    adminLogin.cookie,
  );
  assert.equal(retried.status, 200, JSON.stringify(retried.body));

  const cancellations = await db
    .select({
      id: movimientosTable.id,
      justificacion: movimientosTable.justificacion,
    })
    .from(movimientosTable)
    .where(eq(movimientosTable.movimientoOrigenId, movimientoId));
  assert.equal(cancellations.length, 1, "retry must keep one cancellation");
  assert.equal(
    cancellations[0]?.justificacion,
    "Corrección administrativa comprobada",
    "extraordinary reversal justification must be trimmed",
  );
  const [reversalAuditCount] = await db
    .select({ value: count() })
    .from(auditoriaTable)
    .where(
      and(
        eq(auditoriaTable.accion, "REVERTIR_SALIDA_EXTRAORDINARIA"),
        eq(auditoriaTable.entidad, "movimientos"),
        eq(auditoriaTable.entidadId, String(movimientoId)),
      ),
    );
  assert.equal(
    Number(reversalAuditCount?.value ?? 0),
    1,
    "retry must keep one reversal audit",
  );
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  // Restore any temporarily deleted role rows
  for (const row of deletedRolRows) {
    try {
      await db
        .insert(permisosRolTable)
        .values(row)
        .onConflictDoUpdate({
          target: [permisosRolTable.rol, permisosRolTable.modulo],
          set: {
            puedeVer: row.puedeVer,
            puedeCrear: row.puedeCrear,
            puedeEditar: row.puedeEditar,
            puedeAutorizar: row.puedeAutorizar,
          },
        });
    } catch { /* best effort */ }
  }

  // Delete permisos_usuario overrides
  for (const id of createdPermisosUsuarioIds) {
    try {
      await db.delete(permisosUsuarioTable).where(eq(permisosUsuarioTable.id, id));
    } catch { /* best effort */ }
  }

  // Delete any remaining overrides for created users
  for (const userId of createdUserIds) {
    try {
      await db.delete(permisosUsuarioTable).where(eq(permisosUsuarioTable.usuarioId, userId));
      await db.delete(sesionesTable).where(eq(sesionesTable.usuarioId, userId));
    } catch { /* best effort */ }
  }
  try {
    await db.delete(auditoriaTable).where(inArray(auditoriaTable.usuarioId, createdUserIds));
  } catch { /* best effort */ }

  // Delete clientes
  for (const id of createdClienteIds) {
    try {
      const { clientesTable } = await import("@workspace/db");
      await db.delete(clientesTable).where(eq(clientesTable.id, id));
    } catch { /* best effort */ }
  }

  // Delete only suppliers created by this test run.
  for (const id of createdProveedorIds) {
    try {
      await db.delete(proveedoresTable).where(eq(proveedoresTable.id, id));
    } catch { /* best effort */ }
  }

  // Delete rollos (movimientos and existencias cascade or must be done in order)
  for (const id of createdSalidaIds) {
    try {
      await db.delete(salidaRollosTable).where(eq(salidaRollosTable.salidaId, id));
      await db.delete(salidaLineasTable).where(eq(salidaLineasTable.salidaId, id));
      await db.delete(salidasTable).where(eq(salidasTable.id, id));
    } catch { /* best effort */ }
  }

  for (const id of createdRolloIds) {
    try {
      await db.delete(movimientosTable).where(eq(movimientosTable.rolloId, id));
    } catch { /* best effort */ }
    try {
      await db.delete(rollosTable).where(eq(rollosTable.id, id));
    } catch { /* best effort */ }
  }

  // Delete entrada headers created by mkRolloDisponible after their rollos.
  for (const id of createdEntradaIds) {
    try {
      await db.delete(entradasTable).where(eq(entradasTable.id, id));
    } catch { /* best effort */ }
  }

  // Clean up existencias and movimientos for created products
  for (const id of createdProductoIds) {
    try {
      await db.delete(existenciasTable).where(eq(existenciasTable.productoId, id));
    } catch { /* best effort */ }
    try {
      await db.delete(movimientosTable).where(eq(movimientosTable.productoId, id));
    } catch { /* best effort */ }
    try {
      await db.delete(productosTable).where(eq(productosTable.id, id));
    } catch { /* best effort */ }
  }

  for (const id of createdSesionCajaIds) {
    try {
      await db.delete(sesionesCajaTable).where(eq(sesionesCajaTable.id, id));
    } catch { /* best effort */ }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

await stopServer();
await cleanup();

const total = passed + failed;
process.stdout.write(
  `\nSecurity API tests: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ""}\n`,
);
if (failures.length > 0) {
  process.stdout.write("\nFailed scenarios:\n");
  for (const f of failures) process.stdout.write(`  • ${f}\n`);
}

if (failed > 0) process.exit(1);
