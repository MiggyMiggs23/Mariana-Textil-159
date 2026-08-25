/**
 * Integration tests for the permission system.
 *
 * Run with:
 *   cd /home/runner/workspace/artifacts/api-server && \
 *   DATABASE_URL="postgres://..." \
 *   pnpm tsx src/lib/permisos.test.ts
 *
 * Covers:
 *  - Permission resolution order (user override > role > deny)
 *  - Deny-by-default when no row exists
 *  - Admin invariants (can't lose usuarios/permisos)
 *  - Self-modification prevention
 *  - Provider/client financial separation
 *  - Role matrix updates
 *  - buildPermissionMatrix
 *
 * All created rows are cleaned up after the run, even on failure.
 */

import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db,
  permisosRolTable,
  permisosUsuarioTable,
  usuariosTable,
  ubicacionesTable,
  type RolUsuario,
} from "@workspace/db";
import {
  resolvePermiso,
  buildPermissionMatrix,
  validateAdminInvariants,
  MODULOS,
} from "./permisos";

// ── Test harness ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const createdUserIds: number[] = [];
const createdPermisosRolIds: number[] = [];
const createdPermisosUsuarioIds: number[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(
      `  ✗ ${name}\n    ${(err as Error).stack ?? (err as Error).message}\n`,
    );
    failed++;
  }
}

// ── Setup: create test users ──────────────────────────────────────────────────

let adminUserId = 0;
let terminalUserId = 0;
let cajaUserId = 0;
let inventariosUserId = 0;
let bodegaUserId = 0;

// Find a location for non-admin users
const [tienda] = await db
  .select({ id: ubicacionesTable.id })
  .from(ubicacionesTable)
  .where(eq(ubicacionesTable.tipo, "TIENDA"))
  .limit(1);

if (!tienda) {
  throw new Error("No hay ubicaciones TIENDA para los tests. Ejecuta el seed primero.");
}

// Create temporary test users (will be cleaned up)
const [admin] = await db
  .insert(usuariosTable)
  .values({
    nombre: "Test Admin Permisos",
    usuario: `test_admin_perms_${Date.now()}`,
    passwordHash: "hash",
    rol: "ADMIN" as RolUsuario,
    ubicacionId: null,
  })
  .returning({ id: usuariosTable.id });
adminUserId = admin.id;
createdUserIds.push(adminUserId);

const [terminal] = await db
  .insert(usuariosTable)
  .values({
    nombre: "Test Terminal Permisos",
    usuario: `test_terminal_perms_${Date.now()}`,
    passwordHash: "hash",
    rol: "TERMINAL" as RolUsuario,
    ubicacionId: tienda.id,
  })
  .returning({ id: usuariosTable.id });
terminalUserId = terminal.id;
createdUserIds.push(terminalUserId);

const [caja] = await db
  .insert(usuariosTable)
  .values({
    nombre: "Test Caja Permisos",
    usuario: `test_caja_perms_${Date.now()}`,
    passwordHash: "hash",
    rol: "CAJA" as RolUsuario,
    ubicacionId: tienda.id,
  })
  .returning({ id: usuariosTable.id });
cajaUserId = caja.id;
createdUserIds.push(cajaUserId);

const [inv] = await db
  .insert(usuariosTable)
  .values({
    nombre: "Test Inventarios Permisos",
    usuario: `test_inv_perms_${Date.now()}`,
    passwordHash: "hash",
    rol: "INVENTARIOS" as RolUsuario,
    ubicacionId: tienda.id,
  })
  .returning({ id: usuariosTable.id });
inventariosUserId = inv.id;
createdUserIds.push(inventariosUserId);

const [bodega] = await db
  .insert(usuariosTable)
  .values({
    nombre: "Test Bodega Permisos",
    usuario: `test_bodega_perms_${Date.now()}`,
    passwordHash: "hash",
    rol: "BODEGA" as RolUsuario,
    ubicacionId: tienda.id,
  })
  .returning({ id: usuariosTable.id });
bodegaUserId = bodega.id;
createdUserIds.push(bodegaUserId);

// ── Tests ─────────────────────────────────────────────────────────────────────

await test("P-01: ADMIN tiene acceso total a dashboard", async () => {
  const p = await resolvePermiso(adminUserId, "ADMIN", "dashboard");
  assert.ok(p, "Debe existir permiso");
  assert.equal(p.puedeVer, true);
  assert.equal(p.puedeCrear, true);
  assert.equal(p.puedeEditar, true);
  assert.equal(p.puedeAutorizar, true);
});

await test("P-02: CAJA no usa dashboard administrativo", async () => {
  const p = await resolvePermiso(cajaUserId, "CAJA", "dashboard");
  assert.ok(p, "Debe existir permiso");
  assert.equal(p.puedeVer, false);
  assert.equal(p.puedeAutorizar, false);
});

await test("P-03: BODEGA no puede acceder a POS", async () => {
  const p = await resolvePermiso(bodegaUserId, "BODEGA", "pos");
  assert.ok(p, "La fila existe con todo false");
  assert.equal(p.puedeVer, false);
  assert.equal(p.puedeCrear, false);
});

await test("P-04: BODEGA no puede ver clientes", async () => {
  const p = await resolvePermiso(bodegaUserId, "BODEGA", "clientes");
  assert.ok(p);
  assert.equal(p.puedeVer, false);
});

await test("P-05: CAJA no puede ver proveedores", async () => {
  const p = await resolvePermiso(cajaUserId, "CAJA", "proveedores");
  assert.ok(p);
  assert.equal(p.puedeVer, false);
});

await test("P-06: CAJA puede ver cobros_pagos pero no POS", async () => {
  const p = await resolvePermiso(cajaUserId, "CAJA", "cobros_pagos");
  assert.ok(p);
  assert.equal(p.puedeVer, true);
  assert.equal((await resolvePermiso(cajaUserId, "CAJA", "pos"))?.puedeVer, false);
});

await test("P-06A: CAJA conserva exactamente los permisos operativos documentados", async () => {
  const matrix = await buildPermissionMatrix(cajaUserId, "CAJA");
  const readable = new Set([
    "salidas",
    "inventario",
    "clientes",
    "clientes_credito",
    "clientes_finanzas",
    "resumen_caja",
    "cortes",
    "cobros_pagos",
  ]);
  const creatable = new Set(["cortes", "cobros_pagos"]);

  for (const modulo of MODULOS) {
    const permission = matrix[modulo];
    assert.equal(permission.puedeVer, readable.has(modulo), `${modulo}.ver`);
    assert.equal(permission.puedeCrear, creatable.has(modulo), `${modulo}.crear`);
    assert.equal(permission.puedeEditar, false, `${modulo}.editar`);
    assert.equal(permission.puedeAutorizar, false, `${modulo}.autorizar`);
  }
});

await test("P-06B: TERMINAL conserva la matriz operativa configurada", async () => {
  const matrix = await buildPermissionMatrix(terminalUserId, "TERMINAL");
  const expected: Record<
    string,
    { ver: boolean; crear: boolean; editar: boolean }
  > = {
    dashboard: { ver: true, crear: false, editar: false },
    pos: { ver: true, crear: true, editar: false },
    salidas: { ver: true, crear: false, editar: false },
    inventario: { ver: true, crear: false, editar: false },
    productos: { ver: true, crear: false, editar: false },
    clientes: { ver: true, crear: true, editar: true },
    clientes_credito: { ver: true, crear: false, editar: false },
    clientes_precios: { ver: true, crear: false, editar: false },
  };

  for (const modulo of MODULOS) {
    const permission = matrix[modulo];
    const wanted = expected[modulo] ?? {
      ver: false,
      crear: false,
      editar: false,
    };
    assert.equal(permission.puedeVer, wanted.ver, `${modulo}.ver`);
    assert.equal(permission.puedeCrear, wanted.crear, `${modulo}.crear`);
    assert.equal(permission.puedeEditar, wanted.editar, `${modulo}.editar`);
    assert.equal(permission.puedeAutorizar, false, `${modulo}.autorizar`);
  }
});

await test("P-07: módulo sin fila en ninguna tabla → denegar (null)", async () => {
  // Use a non-existent module name
  const p = await resolvePermiso(cajaUserId, "CAJA", "modulo_inexistente_xyz");
  assert.equal(p, null, "Debe ser null (deny)");
});

await test("P-08: usuario override sobrescribe permiso del rol", async () => {
  // CAJA normally can see cobros_pagos
  const before = await resolvePermiso(cajaUserId, "CAJA", "cobros_pagos");
  assert.equal(before?.puedeVer, true);

  // Add user override that denies
  const [override] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: cajaUserId,
      modulo: "cobros_pagos",
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(override.id);

  const after = await resolvePermiso(cajaUserId, "CAJA", "cobros_pagos");
  assert.equal(after?.puedeVer, false, "Override should deny");
});

await test("P-09: null override means inherit from role", async () => {
  // Add user override with null values (inherit)
  const [override] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: inventariosUserId,
      modulo: "clientes",
      puedeVer: null,
      puedeCrear: null,
      puedeEditar: null,
      puedeAutorizar: null,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(override.id);

  // INVENTARIOS role has puedeVer=false for clientes
  const p = await resolvePermiso(inventariosUserId, "INVENTARIOS", "clientes");
  assert.ok(p);
  assert.equal(p.puedeVer, false, "Null override should inherit role value");
});

await test("P-10: ADMIN cannot be configured in permisos_rol", async () => {
  const err = validateAdminInvariants("ADMIN", "usuarios", {
    puedeVer: false,
    puedeCrear: true,
    puedeEditar: true,
    puedeAutorizar: true,
  });
  assert.ok(err, "Should return an error message");
  assert.ok(err.includes("acceso total"), "Error should explain ADMIN full access");
});

await test("P-11: ADMIN rejects partial permission updates", async () => {
  const err = validateAdminInvariants("ADMIN", "permisos", {
    puedeVer: true,
    puedeCrear: false,
    puedeEditar: true,
    puedeAutorizar: true,
  });
  assert.ok(err, "Should return an error message");
  assert.ok(err.includes("no puede ser restringido"));
});

await test("P-12: ADMIN rejects even redundant full-access rows", async () => {
  const err = validateAdminInvariants("ADMIN", "usuarios", {
    puedeVer: true,
    puedeCrear: true,
    puedeEditar: true,
    puedeAutorizar: true,
  });
  assert.ok(err, "ADMIN must not have matrix rows");
});

await test("P-13: ADMIN cannot be configured for any module", async () => {
  const err = validateAdminInvariants("ADMIN", "dashboard", {
    puedeVer: false,
    puedeCrear: false,
    puedeEditar: false,
    puedeAutorizar: false,
  });
  assert.ok(err, "Every ADMIN module must bypass the matrix");
});

await test("P-14: validateAdminInvariants allows any value for non-ADMIN roles", async () => {
  const err = validateAdminInvariants("CAJA", "usuarios", {
    puedeVer: false,
    puedeCrear: false,
    puedeEditar: false,
    puedeAutorizar: false,
  });
  assert.equal(err, null, "CAJA role can be restricted");
});

await test("P-15: buildPermissionMatrix returns every configured module", async () => {
  const matrix = await buildPermissionMatrix(adminUserId, "ADMIN");
  assert.equal(
    Object.keys(matrix).length,
    MODULOS.length,
    "Should include every configured module",
  );
  for (const modulo of MODULOS) {
    assert.ok(modulo in matrix, `Module ${modulo} should be in matrix`);
  }
});

await test("P-16: ADMIN matrix has full access to all modules", async () => {
  const matrix = await buildPermissionMatrix(adminUserId, "ADMIN");
  for (const modulo of MODULOS) {
    const p = matrix[modulo];
    assert.equal(p.puedeVer, true, `ADMIN should see ${modulo}`);
    assert.equal(p.puedeCrear, true, `ADMIN should create ${modulo}`);
    assert.equal(p.puedeEditar, true, `ADMIN should edit ${modulo}`);
    assert.equal(p.puedeAutorizar, true, `ADMIN should authorize ${modulo}`);
  }
});

await test("P-17: CAJA has no access to proveedores_finanzas", async () => {
  const matrix = await buildPermissionMatrix(cajaUserId, "CAJA");
  const p = matrix["proveedores_finanzas"];
  assert.ok(p);
  assert.equal(p.puedeVer, false);
});

await test("P-18: CAJA can access clientes_finanzas", async () => {
  const matrix = await buildPermissionMatrix(cajaUserId, "CAJA");
  const p = matrix["clientes_finanzas"];
  assert.ok(p);
  assert.equal(p.puedeVer, true);
});

await test("P-19: CAJA can see clientes_credito", async () => {
  const matrix = await buildPermissionMatrix(cajaUserId, "CAJA");
  const p = matrix["clientes_credito"];
  assert.ok(p);
  assert.equal(p.puedeVer, true);
});

await test("P-20: Dynamically updating role matrix affects future permission checks", async () => {
  // reportes is denied by default, but remains live-configurable.
  // First get current value
  const [existing] = await db
    .select()
    .from(permisosRolTable)
    .where(
      and(
        eq(permisosRolTable.rol, "BODEGA"),
        eq(permisosRolTable.modulo, "reportes"),
      ),
    )
    .limit(1);

  assert.ok(existing, "BODEGA/reportes should exist in seed");
  const originalVer = existing.puedeVer;

  // Grant it live.
  await db
    .update(permisosRolTable)
    .set({ puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false })
    .where(
      and(
        eq(permisosRolTable.rol, "BODEGA"),
        eq(permisosRolTable.modulo, "reportes"),
      ),
    );

  const p = await resolvePermiso(bodegaUserId, "BODEGA", "reportes");
  assert.equal(p?.puedeVer, true, "Should be granted after matrix update");

  // Restore
  await db
    .update(permisosRolTable)
    .set({ puedeVer: originalVer })
    .where(
      and(
        eq(permisosRolTable.rol, "BODEGA"),
        eq(permisosRolTable.modulo, "reportes"),
      ),
    );

  const restored = await resolvePermiso(bodegaUserId, "BODEGA", "reportes");
  assert.equal(restored?.puedeVer, originalVer, "Should be restored");
});

await test("P-21: BODEGA cannot see proveedores_finanzas", async () => {
  const p = await resolvePermiso(bodegaUserId, "BODEGA", "proveedores_finanzas");
  assert.ok(p);
  assert.equal(p.puedeVer, false);
});

await test("P-22: BODEGA has exactly the PROMPT 8 baseline", async () => {
  const matrix = await buildPermissionMatrix(bodegaUserId, "BODEGA");
  const expected: Record<string, { ver: boolean; crear: boolean; editar: boolean }> = {
    dashboard: { ver: true, crear: false, editar: false },
    inventario: { ver: true, crear: false, editar: false },
    entradas: { ver: true, crear: true, editar: false },
    salidas: { ver: true, crear: true, editar: false },
    movimientos: { ver: true, crear: false, editar: false },
    ajustes: { ver: true, crear: true, editar: false },
  };
  for (const modulo of MODULOS) {
    const permission = matrix[modulo];
    const wanted = expected[modulo] ?? { ver: false, crear: false, editar: false };
    assert.equal(permission.puedeVer, wanted.ver, `${modulo}.ver`);
    assert.equal(permission.puedeCrear, wanted.crear, `${modulo}.crear`);
    assert.equal(permission.puedeEditar, wanted.editar, `${modulo}.editar`);
    assert.equal(permission.puedeAutorizar, false, `${modulo}.autorizar`);
  }
  for (const modulo of ["productos", "proveedores", "contenedores", "reportes"]) {
    assert.equal(matrix[modulo].puedeVer, false, `${modulo} must be revoked`);
  }
});

await test("P-23: CAJA cannot see clientes_precios", async () => {
  const p = await resolvePermiso(cajaUserId, "CAJA", "clientes_precios");
  assert.ok(p);
  assert.equal(p.puedeVer, false);
});

await test("P-24: CAJA can see clientes_finanzas", async () => {
  const p = await resolvePermiso(cajaUserId, "CAJA", "clientes_finanzas");
  assert.ok(p);
  assert.equal(p.puedeVer, true);
});

await test("P-25: user override with explicit true overrides role false", async () => {
  // BODEGA cannot see clientes
  const rolePerm = await resolvePermiso(bodegaUserId, "BODEGA", "clientes");
  assert.equal(rolePerm?.puedeVer, false);

  // Add override to grant access
  const [override] = await db
    .insert(permisosUsuarioTable)
    .values({
      usuarioId: bodegaUserId,
      modulo: "clientes",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    })
    .returning({ id: permisosUsuarioTable.id });
  createdPermisosUsuarioIds.push(override.id);

  const overridePerm = await resolvePermiso(bodegaUserId, "BODEGA", "clientes");
  assert.equal(overridePerm?.puedeVer, true, "Explicit true override should grant");
});

await test("P-26: ADMIN ignores a false override on an ordinary module", async () => {
  let overrideId: number | null = null;
  try {
    const [override] = await db
      .insert(permisosUsuarioTable)
      .values({
        usuarioId: adminUserId,
        modulo: "dashboard",
        puedeVer: false,
        puedeCrear: false,
        puedeEditar: false,
        puedeAutorizar: false,
      })
      .returning({ id: permisosUsuarioTable.id });
    overrideId = override.id;

    const effective = await resolvePermiso(adminUserId, "ADMIN", "dashboard");
    assert.deepEqual(effective, {
      modulo: "dashboard",
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeAutorizar: true,
    });
    const matrix = await buildPermissionMatrix(adminUserId, "ADMIN");
    assert.equal(matrix.dashboard.puedeVer, true);
    assert.equal(matrix.dashboard.puedeCrear, true);
    assert.equal(matrix.dashboard.puedeEditar, true);
    assert.equal(matrix.dashboard.puedeAutorizar, true);
  } finally {
    if (overrideId != null) {
      await db
        .delete(permisosUsuarioTable)
        .where(eq(permisosUsuarioTable.id, overrideId));
    }
  }
});

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  // Delete user overrides
  if (createdPermisosUsuarioIds.length > 0) {
    for (const id of createdPermisosUsuarioIds) {
      await db.delete(permisosUsuarioTable).where(eq(permisosUsuarioTable.id, id));
    }
  }

  // Delete test users (cascades should clean up sessions)
  for (const id of createdUserIds) {
    await db.delete(usuariosTable).where(eq(usuariosTable.id, id));
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

await cleanup();

const total = passed + failed;
process.stdout.write(
  `\nPermisos tests: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ""}\n`,
);

if (failed > 0) process.exit(1);
