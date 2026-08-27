import assert from "node:assert/strict";
import {
  SUPERVISOR_PERMISSION_CEILING,
  supervisorAllows,
} from "./supervisor-policy";

const forbidden = [
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
  "proveedores_finanzas",
];

for (const modulo of forbidden) {
  for (const accion of ["ver", "crear", "editar", "autorizar"] as const) {
    assert.equal(
      supervisorAllows(modulo, accion),
      false,
      `${modulo}.${accion} must remain forbidden`,
    );
  }
}

assert.equal(supervisorAllows("productos", "ver"), true);
assert.equal(supervisorAllows("productos", "crear"), false);
assert.equal(supervisorAllows("productos", "editar"), false);
assert.equal(supervisorAllows("clientes", "crear"), true);
assert.equal(supervisorAllows("clientes", "editar"), true);
assert.equal(supervisorAllows("clientes", "autorizar"), false);
assert.equal(supervisorAllows("proveedores", "crear"), true);
assert.equal(supervisorAllows("proveedores", "editar"), true);
assert.equal(supervisorAllows("proveedores", "autorizar"), false);
assert.equal(supervisorAllows("entradas", "crear"), true);
assert.equal(supervisorAllows("salidas", "editar"), true);
assert.equal(supervisorAllows("contenedores", "crear"), true);

assert.deepEqual(
  Object.keys(SUPERVISOR_PERMISSION_CEILING).sort(),
  [
    "ajustes",
    "clientes",
    "contenedores",
    "dashboard",
    "entradas",
    "etiquetas",
    "inventario",
    "movimientos",
    "productos",
    "proveedores",
    "reportes",
    "salidas",
  ],
);