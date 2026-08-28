import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { CurrentUser } from "@workspace/api-client-react";
import {
  getVisibleNavGroups,
  NAV_GROUPS,
} from "@/components/layout/app-navigation";
import { Modules, type Module } from "@/lib/permisos";

const root = new URL("../../../../", import.meta.url);

function user(rol: string, visibleModules: Module[]): CurrentUser {
  return {
    rol,
    permisos: visibleModules.map((modulo) => ({
      modulo,
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    })),
  } as CurrentUser;
}

const namesFor = (currentUser: CurrentUser) =>
  getVisibleNavGroups(currentUser).flatMap((group) =>
    group.items.map((item) => item.name),
  );

const SISTEMAS_DENIED_MODULES: Module[] = [
  Modules.POS,
  Modules.RESUMEN_CAJA,
  Modules.CORTES,
  Modules.COBROS_PAGOS,
];
const SISTEMAS_MODULES = Object.values(Modules).filter(
  (module) => !SISTEMAS_DENIED_MODULES.includes(module),
);

const CONTADOR_MODULES = [
  Modules.DASHBOARD,
  Modules.ENTRADAS,
  Modules.SALIDAS,
  Modules.MOVIMIENTOS,
  Modules.INVENTARIO,
  Modules.PRODUCTOS,
  Modules.PRECIOS,
  Modules.CLIENTES,
  Modules.PROVEEDORES,
  Modules.CONTENEDORES,
  Modules.RESUMEN_CAJA,
  Modules.CORTES,
  Modules.COBROS_PAGOS,
  Modules.REPORTES,
  Modules.CONCILIACION,
  Modules.VIAJES,
];

test("SISTEMAS navigation follows its matrix without POS or CAJA", () => {
  const groups = getVisibleNavGroups(user("SISTEMAS", SISTEMAS_MODULES));
  const names = groups.flatMap((group) =>
    group.items.map((item) => item.name),
  );

  assert.ok(!names.includes("Ventas / POS"));
  assert.ok(!groups.some((group) => group.title === "CAJA"));
  assert.deepEqual(
    names.filter((name) =>
      ["Entradas", "Salidas", "Viajes", "Movimientos"].includes(name),
    ),
    ["Entradas", "Salidas", "Viajes", "Movimientos"],
  );
  assert.deepEqual(
    groups
      .find((group) => group.title === "CONFIGURACIÓN")
      ?.items.map((item) => item.name),
    [
      "Sitios",
      "Camionetas",
      "Choferes",
      "Usuarios",
      "Permisos",
      "Conciliación de Kardex",
      "Bitácora",
    ],
  );
});

test("CONTADOR gets complete CAJA and read-only destinations, without forbidden sections", () => {
  const groups = getVisibleNavGroups(user("CONTADOR", CONTADOR_MODULES));
  const names = namesFor(user("CONTADOR", CONTADOR_MODULES));

  assert.deepEqual(
    groups
      .find((group) => group.title === "CAJA")
      ?.items.map((item) => item.name),
    ["Cuentas", "Cobros", "Cortes", "Alertas"],
  );
  for (const expected of [
    "Tiempo Real",
    "Entradas",
    "Salidas",
    "Viajes",
    "Movimientos",
  ]) {
    assert.ok(names.includes(expected));
  }
  for (const forbidden of ["Ventas / POS", "Ajustes", "Etiquetas"]) {
    assert.ok(!names.includes(forbidden));
  }
  assert.ok(!groups.some((group) => group.title === "CONFIGURACIÓN"));
});

test("permission filtering never returns an empty navigation section", () => {
  const roleModules: Record<string, Module[]> = {
    TERMINAL: [
      Modules.POS,
      Modules.SALIDAS,
      Modules.INVENTARIO,
      Modules.PRODUCTOS,
      Modules.CLIENTES,
    ],
    CAJA: [
      Modules.SALIDAS,
      Modules.INVENTARIO,
      Modules.CLIENTES,
      Modules.RESUMEN_CAJA,
      Modules.CORTES,
      Modules.COBROS_PAGOS,
    ],
    SUPERVISOR: [
      Modules.DASHBOARD,
      Modules.ENTRADAS,
      Modules.SALIDAS,
      Modules.MOVIMIENTOS,
      Modules.ETIQUETAS,
      Modules.INVENTARIO,
      Modules.PRODUCTOS,
      Modules.AJUSTES,
      Modules.CLIENTES,
      Modules.PROVEEDORES,
      Modules.CONTENEDORES,
      Modules.REPORTES,
      Modules.VIAJES,
    ],
    BODEGA: [
      Modules.DASHBOARD,
      Modules.ENTRADAS,
      Modules.SALIDAS,
      Modules.MOVIMIENTOS,
      Modules.ETIQUETAS,
      Modules.INVENTARIO,
      Modules.AJUSTES,
      Modules.CONTENEDORES,
      Modules.VIAJES,
    ],
    SISTEMAS: SISTEMAS_MODULES,
    CONTADOR: CONTADOR_MODULES,
  };

  for (const [role, modules] of Object.entries(roleModules)) {
    const groups = getVisibleNavGroups(user(role, modules));
    assert.ok(groups.length > 0, `${role} needs at least one section`);
    assert.ok(
      groups.every((group) => group.items.length > 0),
      `${role} rendered an empty section`,
    );
  }

  assert.ok(
    getVisibleNavGroups(user("ADMIN", [])).every(
      (group) => group.items.length > 0,
    ),
  );
  assert.equal(
    NAV_GROUPS.find((group) => group.title === "CAJA")?.items.find(
      (item) => item.name === "Cortes",
    )?.module,
    Modules.CORTES,
  );
});

test("ticket detail preserves POS/Cobros readers and explicit fiscal reviewers", async () => {
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(
    app,
    /path="\/tickets\/:id"[\s\S]*allowedAnyModules=\{\[Modules\.COBROS_PAGOS, Modules\.POS\]\}[\s\S]*allowedRoles=\{\["ADMIN", "CONTADOR", "SISTEMAS"\]\}/,
  );
  assert.ok(
    hasReadableModule(user("TERMINAL", [Modules.POS]), [Modules.COBROS_PAGOS, Modules.POS]),
  );
  assert.ok(
    hasReadableModule(user("CAJA", [Modules.COBROS_PAGOS]), [Modules.COBROS_PAGOS, Modules.POS]),
  );
  assert.ok(["ADMIN", "CONTADOR", "SISTEMAS"].includes(user("SISTEMAS", []).rol));
});

function hasReadableModule(currentUser: CurrentUser, modules: Module[]) {
  return modules.some((module) =>
    currentUser.permisos?.some((permission) =>
      permission.modulo === module && permission.puedeVer,
    ),
  );
}

test("routes use matrix permissions while notifications remain admin-only", async () => {
  const app = await readFile(
    new URL("artifacts/mariana-textil/src/App.tsx", root),
    "utf8",
  );

  assert.match(
    app,
    /component=\{PreciosList\} allowedModule=\{Modules\.PRECIOS\}/,
  );
  assert.match(
    app,
    /component=\{CajaTiempoReal\}[\s\S]*?allowedModule=\{Modules\.RESUMEN_CAJA\}/,
  );
  assert.match(
    app,
    /component=\{CajaCortes\}[\s\S]*?allowedModule=\{Modules\.CORTES\}/,
  );
  assert.match(
    app,
    /component=\{Auditoria\}[\s\S]*?allowedModule=\{Modules\.AUDITORIA\}/,
  );
  assert.match(app, /component=\{Notificaciones\} adminOnly/);
  assert.equal((app.match(/\badminOnly\s*\/?>/g) ?? []).length, 1);
});