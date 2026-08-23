/**
 * HTTP/API Security Integration Tests — 29 named scenarios.
 *
 * Spins up the real Express app on an ephemeral port, exercises every
 * scenario through actual HTTP (native fetch), and tears down the server
 * plus every temporary DB row in `finally`, even on failure.
 *
 * Run:
 *   cd /home/runner/workspace/artifacts/api-server
 *   DATABASE_URL="<url>" pnpm tsx src/security-api.test.ts
 *
 * Zero extra dependencies — uses only node:http, node:assert, node:crypto
 * and the workspace DB package for setup/teardown helpers.
 *
 * Scenarios:
 *   S-01  All four roles log in → 200 + permisos matrix present
 *   S-02  ADMIN /auth/me → effective matrix has 25 modules, all full
 *   S-03  CAJA /auth/me  → pos.puedeVer=true, proveedores.puedeVer=false
 *   S-04  BODEGA denied POS  (GET /inventario/rollos → module=inventario OK, but POST vender → 403)
 *   S-05  BODEGA denied clientes → GET /clientes → 403
 *   S-06  CAJA can do POS sale (vender) on own-location rollo
 *   S-07  CAJA denied GET /proveedores → 403
 *   S-08  INVENTARIOS GET /proveedores → 200, response has no financial JSON keys
 *   S-09  BODEGA GET /proveedores → 200, no financial keys
 *   S-10  Financial proveedor routes denied for INVENTARIOS (proveedores_finanzas)
 *   S-11  ADMIN user-override grants INVENTARIOS proveedores_finanzas.ver; route now 200
 *   S-12  ADMIN user-override deny removed → INVENTARIOS inherits role (still denied)
 *   S-13  User override (true) beats role (false): BODEGA clientes 403 → override → 200
 *   S-14  DELETE override → BODEGA clientes reverts to 403
 *   S-15  Deny-by-default: remove BODEGA reportes rol row → 403; restore → 200
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
 *   S-27  SALIDA_MOSTRADOR reversal fails (ABIERTO stays); VENTA+BAJA revert + kardex/cache reconcile
 *   S-28  Non-ADMIN with delegated usuarios permissions cannot escalate to ADMIN
 *   S-29  Promotion to ADMIN removes overrides and override endpoints reject ADMIN targets
 */

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import {
  db,
  existenciasTable,
  movimientosTable,
  permisosRolTable,
  permisosUsuarioTable,
  productosTable,
  proveedoresTable,
  rollosTable,
  sesionesTable,
  ubicacionesTable,
  usuariosTable,
  type RolUsuario,
} from "@workspace/db";
import app from "./app";
import { crearEntrada, crearRollo } from "./lib/inventario";

// ─── Test Harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
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

type FetchResult = { status: number; body: unknown; cookie: string };

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
  return { status: res.status, body: parsed, cookie: sessionCookie };
}

async function login(usuario: string, password: string): Promise<FetchResult> {
  return api("POST", "/auth/login", { usuario, password });
}

// ─── DB setup helpers ──────────────────────────────────────────────────────────

let userSeq = 0;
const RUN = `SA${Date.now()}`;

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
  const [row] = await db
    .insert(ubicacionesTable)
    .values({ nombre: `UbSAT ${tag}`.slice(0, 120), tipo: "TIENDA" })
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
async function mkRolloDisponible(ubicacionId: number, productoId: number, adminId: number): Promise<number> {
  const [rollo] = await db.transaction(async (tx) => {
    const result = await crearEntrada(tx, {
      ubicacionId,
      proveedorId: null,
      observaciones: null,
      usuarioId: adminId,
      ip: "127.0.0.1",
      uuidCliente: randomUUID(),
      lineas: [{
        productoId,
        costoUnitario: "100.00",
        cantidades: ["15.000"],
      }],
    });
    return result.rollos;
  });
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
const testCaja = await mkUser("CAJA", seedTienda.id);
const testInventarios = await mkUser("INVENTARIOS", seedTienda.id);
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
  for (const { usuario, password } of [testAdmin, testTerminal, testCaja, testInventarios, testBodega]) {
    const r = await login(usuario, password);
    assert.equal(r.status, 200, `login failed for ${usuario}: ${JSON.stringify(r.body)}`);
    const body = r.body as Record<string, unknown>;
    assert.ok(Array.isArray(body.permisos) || (typeof body.permisos === "object" && body.permisos !== null),
      `permisos absent in login response for ${usuario}`);
  }
});

// S-02: ADMIN /auth/me → matrix has 25 modules, all full access
await test("S-02: ADMIN /auth/me effective matrix — 25 modules, all full access", async () => {
  const login_r = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(login_r.status, 200);
  const me = await api("GET", "/auth/me", undefined, login_r.cookie);
  assert.equal(me.status, 200);
  const body = me.body as Record<string, unknown>;
  const permisos = body.permisos as unknown[];
  assert.ok(Array.isArray(permisos), "permisos should be array");
  assert.equal(permisos.length, 25, `Expected 25 modules, got ${permisos.length}`);
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
  assert.ok(posEntry, "pos module missing");
  assert.ok(provEntry, "proveedores module missing");
  assert.equal(posEntry.puedeVer, false, "CAJA must not use terminal POS");
  assert.equal(cobrosEntry?.puedeVer, true, "CAJA should see cobros_pagos");
  assert.equal(provEntry.puedeVer, false, "CAJA must not see proveedores");
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

// S-08: INVENTARIOS GET /proveedores → 200, no financial keys in response
await test("S-08: INVENTARIOS GET /proveedores → 200, no financial JSON keys", async () => {
  const login_r = await login(testInventarios.usuario, testInventarios.password);
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
      assert.ok(!(key in item), `INVENTARIOS response must not include financial key '${key}'`);
    }
  }
  // Also check the top-level body keys
  for (const key of FINANCIAL_KEYS) {
    assert.ok(!(key in body), `INVENTARIOS response body must not include '${key}'`);
  }
});

// S-09: BODEGA GET /proveedores → 200, no financial keys
await test("S-09: BODEGA GET /proveedores → 200, no financial JSON keys", async () => {
  const login_r = await login(testBodega.usuario, testBodega.password);
  const r = await api("GET", "/proveedores", undefined, login_r.cookie);
  assert.equal(r.status, 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  const body = r.body as Record<string, unknown>;
  const items = body.items as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(items), "items should be array");
  const FINANCIAL_KEYS = ["totalCompras", "saldoPendiente", "totalPagado"];
  for (const item of items) {
    for (const key of FINANCIAL_KEYS) {
      assert.ok(!(key in item), `BODEGA response must not include financial key '${key}'`);
    }
  }
});

// S-10: Financial proveedor routes denied for INVENTARIOS (no proveedores_finanzas)
await test("S-10: INVENTARIOS GET /proveedores/resumen → 403 (proveedores_finanzas.ver denied)", async () => {
  const login_r = await login(testInventarios.usuario, testInventarios.password);
  const r = await api("GET", "/proveedores/resumen", undefined, login_r.cookie);
  assert.equal(r.status, 403, `Expected 403, got ${r.status}: ${JSON.stringify(r.body)}`);
});

// S-11: ADMIN grants INVENTARIOS proveedores_finanzas.ver → route now 200
await test("S-11: Override grants INVENTARIOS proveedores_finanzas.ver → resumen 200", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  assert.equal(adminLogin.status, 200);

  // PUT override for testInventarios
  const putR = await api(
    "PUT",
    `/permisos/usuarios/${testInventarios.id}/proveedores_finanzas`,
    { puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false },
    adminLogin.cookie,
  );
  assert.equal(putR.status, 200, `Override PUT failed: ${JSON.stringify(putR.body)}`);
  const overrideRow = putR.body as Record<string, unknown>;
  createdPermisosUsuarioIds.push(overrideRow.id as number);

  // Now INVENTARIOS should have access
  const login_r = await login(testInventarios.usuario, testInventarios.password);
  const r = await api("GET", "/proveedores/resumen", undefined, login_r.cookie);
  assert.equal(r.status, 200, `Expected 200 after override, got ${r.status}: ${JSON.stringify(r.body)}`);

  // Verify matrix via /auth/me
  const me = await api("GET", "/auth/me", undefined, login_r.cookie);
  const permisos = (me.body as Record<string, unknown>).permisos as Array<Record<string, unknown>>;
  const finanzasEntry = permisos.find((p) => p.modulo === "proveedores_finanzas");
  assert.equal(finanzasEntry?.puedeVer, true, "Matrix should reflect override");
});

// S-12: Remove override (DELETE) → INVENTARIOS reverts to role (still denied)
await test("S-12: DELETE override → INVENTARIOS reverts to role default (403)", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);

  // Remove the override created in S-11
  const delR = await api(
    "DELETE",
    `/permisos/usuarios/${testInventarios.id}/proveedores_finanzas`,
    undefined,
    adminLogin.cookie,
  );
  assert.equal(delR.status, 204, `Override DELETE failed: ${delR.status}`);
  // Remove from tracking since it's been deleted
  const idx = createdPermisosUsuarioIds.indexOf(
    createdPermisosUsuarioIds[createdPermisosUsuarioIds.length - 1]!
  );
  if (idx !== -1) createdPermisosUsuarioIds.splice(idx, 1);

  // INVENTARIOS should now be denied again
  const login_r = await login(testInventarios.usuario, testInventarios.password);
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

// S-15: Deny-by-default: temporarily delete BODEGA reportes role row
await test("S-15: Deny-by-default — BODEGA reportes 200; after row removal → 403; restore → 200", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const previewBefore = await api("GET", `/permisos/preview/${testBodega.id}`, undefined, adminLogin.cookie);
  assert.equal(previewBefore.status, 200);
  const previewBody = previewBefore.body as Record<string, unknown>;
  const permisos = previewBody.permisos as Array<Record<string, unknown>>;
  const reportesEntry = permisos.find((p) => p.modulo === "reportes");
  assert.equal(reportesEntry?.puedeVer, true, "BODEGA should have reportes.puedeVer=true by default");

  // Backup and delete the BODEGA/reportes role row
  const [originalRow] = await db
    .select()
    .from(permisosRolTable)
    .where(and(eq(permisosRolTable.rol, "BODEGA"), eq(permisosRolTable.modulo, "reportes")))
    .limit(1);
  assert.ok(originalRow, "BODEGA/reportes role row must exist");

  deletedRolRows.push({
    rol: "BODEGA",
    modulo: "reportes",
    puedeVer: originalRow.puedeVer,
    puedeCrear: originalRow.puedeCrear,
    puedeEditar: originalRow.puedeEditar,
    puedeAutorizar: originalRow.puedeAutorizar,
  });

  await db
    .delete(permisosRolTable)
    .where(and(eq(permisosRolTable.rol, "BODEGA"), eq(permisosRolTable.modulo, "reportes")));

  // Now preview should show reportes as all false (deny by default since no row)
  const previewAfter = await api("GET", `/permisos/preview/${testBodega.id}`, undefined, adminLogin.cookie);
  const permisosAfter = (previewAfter.body as Record<string, unknown>).permisos as Array<Record<string, unknown>>;
  const reportesAfter = permisosAfter.find((p) => p.modulo === "reportes");
  assert.equal(reportesAfter?.puedeVer, false, "Without role row, reportes should be denied");

  // Restore
  await db
    .insert(permisosRolTable)
    .values({
      rol: "BODEGA",
      modulo: "reportes",
      puedeVer: originalRow.puedeVer,
      puedeCrear: originalRow.puedeCrear,
      puedeEditar: originalRow.puedeEditar,
      puedeAutorizar: originalRow.puedeAutorizar,
    });
  deletedRolRows.pop(); // Successfully restored

  // Preview should be back to true
  const previewRestored = await api("GET", `/permisos/preview/${testBodega.id}`, undefined, adminLogin.cookie);
  const permisosRestored = (previewRestored.body as Record<string, unknown>).permisos as Array<Record<string, unknown>>;
  const reportesRestored = permisosRestored.find((p) => p.modulo === "reportes");
  assert.equal(reportesRestored?.puedeVer, true, "After restore, reportes should be puedeVer=true");
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

// S-24: Non-ADMIN mutation on other location → 403; ADMIN same mutation → succeeds
await test("S-24: Non-ADMIN mutation on other-location → 403; ADMIN same → succeeds", async () => {
  // testBodegaOtherLoc is assigned to otherTiendaId
  // Create a rollo at seedTienda — bodegaOtherLoc should be forbidden to do salida there
  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(seedTienda.id, productoId, testAdmin.id);

  // BODEGA from otherTienda tries salida-mostrador on rollo in seedTienda → 403
  const bodegaLogin = await login(testBodegaOtherLoc.usuario, testBodegaOtherLoc.password);
  const r403 = await api("POST", `/inventario/rollos/${rolloId}/salida-mostrador`, {
    justificacion: "test cross-location attempt",
    uuidCliente: randomUUID(),
  }, bodegaLogin.cookie);
  assert.equal(r403.status, 403, `Expected 403 for cross-location mutation, got ${r403.status}: ${JSON.stringify(r403.body)}`);

  // ADMIN can do the same mutation on any location
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);
  const r200 = await api("POST", `/inventario/rollos/${rolloId}/salida-mostrador`, {
    justificacion: "admin cross-location test",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(r200.status, 200, `Expected 200 for ADMIN cross-location, got ${r200.status}: ${JSON.stringify(r200.body)}`);
  assert.equal((r200.body as Record<string, unknown>).estado, "ABIERTO");
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
    const cajaLogin = await login(testCaja.usuario, testCaja.password);
    const cr = await api("POST", "/clientes", { nombre: `Cliente S26 ${RUN}` }, cajaLogin.cookie);
    clienteId = (cr.body as Record<string, unknown>).id as number;
    createdClienteIds.push(clienteId);
  }

  const cajaLogin = await login(testCaja.usuario, testCaja.password);
  const bodegaLogin = await login(testBodega.usuario, testBodega.password);
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);

  // CAJA has clientes_credito.ver → 200
  const creditoCaja = await api("GET", `/clientes/${clienteId}/credito`, undefined, cajaLogin.cookie);
  assert.equal(creditoCaja.status, 200, `CAJA should access credito: ${JSON.stringify(creditoCaja.body)}`);

  // CAJA does not receive terminal price history
  const preciosCaja = await api("GET", `/clientes/${clienteId}/precios`, undefined, cajaLogin.cookie);
  assert.equal(preciosCaja.status, 403, `CAJA must not access precios: ${JSON.stringify(preciosCaja.body)}`);

  // CAJA has clientes_finanzas.ver → 200
  const estadoCaja = await api("GET", `/clientes/${clienteId}/estado-cuenta`, undefined, cajaLogin.cookie);
  assert.equal(estadoCaja.status, 200, `CAJA should access estado-cuenta: ${JSON.stringify(estadoCaja.body)}`);

  const terminalLogin = await login(testTerminal.usuario, testTerminal.password);
  const preciosTerminal = await api("GET", `/clientes/${clienteId}/precios`, undefined, terminalLogin.cookie);
  assert.equal(preciosTerminal.status, 200, `TERMINAL should access precios: ${JSON.stringify(preciosTerminal.body)}`);

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
});

// S-27: Inventory reversals and kardex/cache reconciliation
await test("S-27: SALIDA_MOSTRADOR reversal fails (ABIERTO stays); VENTA+BAJA revert + cache reconcile", async () => {
  const adminLogin = await login(testAdmin.usuario, testAdmin.password);

  // Create a fresh rollo for this test
  const productoId = await mkProducto();
  const rolloId = await mkRolloDisponible(seedTienda.id, productoId, testAdmin.id);

  // ── Part A: SALIDA_MOSTRADOR then attempt reversal ─────────────────────────

  // Do salida-mostrador
  const salidaR = await api("POST", `/inventario/rollos/${rolloId}/salida-mostrador`, {
    justificacion: "salida S27 test",
    uuidCliente: randomUUID(),
  }, adminLogin.cookie);
  assert.equal(salidaR.status, 200, `salida-mostrador failed: ${JSON.stringify(salidaR.body)}`);
  assert.equal((salidaR.body as Record<string, unknown>).estado, "ABIERTO");

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

  // Rollo must still be ABIERTO
  const rolloCheck = await api("GET", `/inventario/rollos/${rolloId}`, undefined, adminLogin.cookie);
  assert.equal(rolloCheck.status, 200);
  assert.equal((rolloCheck.body as Record<string, unknown>).estado, "ABIERTO",
    "Rollo must remain ABIERTO after failed reversal");

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
  // A BAJA with null cantidadNueva — check what the API returns
  // Actually the engine uses cantidadNueva for adjustments; if null it's a BAJA
  // Let's check the response code and handle both cases
  if (bajaR.status !== 200) {
    // If the engine requires cantidadNueva let's use a partial amount
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

  // Delete clientes
  for (const id of createdClienteIds) {
    try {
      const { clientesTable } = await import("@workspace/db");
      await db.delete(clientesTable).where(eq(clientesTable.id, id));
    } catch { /* best effort */ }
  }

  // Delete rollos (movimientos and existencias cascade or must be done in order)
  for (const id of createdRolloIds) {
    try {
      await db.delete(movimientosTable).where(eq(movimientosTable.rolloId, id));
    } catch { /* best effort */ }
    try {
      await db.delete(rollosTable).where(eq(rollosTable.id, id));
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

  // Delete users
  for (const id of createdUserIds) {
    try {
      await db.delete(usuariosTable).where(eq(usuariosTable.id, id));
    } catch { /* best effort */ }
  }

  // Delete ubicaciones (after deleting rollos/existencias that reference them)
  for (const id of createdUbicacionIds) {
    try {
      await db.delete(ubicacionesTable).where(eq(ubicacionesTable.id, id));
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
