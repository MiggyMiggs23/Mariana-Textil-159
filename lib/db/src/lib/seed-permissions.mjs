export const MODULOS = Object.freeze([
  "dashboard",
  "pos",
  "entradas",
  "salidas",
  "movimientos",
  "etiquetas",
  "inventario",
  "productos",
  "precios",
  "ajustes",
  "clientes",
  "clientes_credito",
  "clientes_precios",
  "clientes_finanzas",
  "proveedores",
  "proveedores_finanzas",
  "contenedores",
  "ubicaciones",
  "usuarios",
  "permisos",
  "resumen_caja",
  "cortes",
  "cobros_pagos",
  "reportes",
  "conciliacion",
  "auditoria",
  "camionetas",
  "choferes",
  "viajes",
]);

export const ROLES = Object.freeze([
  "TERMINAL",
  "CAJA",
  "SUPERVISOR",
  "BODEGA",
  "SISTEMAS",
  "CONTADOR",
]);

export const N = Object.freeze([false, false, false, false]);
export const V = Object.freeze([true, false, false, false]);
export const VC = Object.freeze([true, true, false, false]);
export const VCE = Object.freeze([true, true, true, false]);
export const VE = Object.freeze([true, false, true, false]);

// Each row follows ROLES order exactly.
export const MATRIX = Object.freeze({
  dashboard: [V, N, V, V, V, V],
  pos: [VC, N, N, N, N, N],
  entradas: [N, N, VCE, VC, VCE, V],
  salidas: [V, V, VCE, VC, VCE, V],
  movimientos: [N, N, V, V, VCE, V],
  etiquetas: [N, N, VC, VC, VC, N],
  inventario: [V, V, V, V, V, V],
  productos: [V, N, V, N, VCE, V],
  precios: [N, N, N, N, VCE, V],
  ajustes: [N, N, VC, VC, VC, N],
  clientes: [VCE, V, VCE, N, VCE, V],
  clientes_credito: [V, V, N, N, V, V],
  clientes_precios: [V, N, N, N, V, V],
  clientes_finanzas: [N, V, N, N, V, V],
  proveedores: [N, N, VCE, N, VCE, V],
  proveedores_finanzas: [N, N, N, N, V, VCE],
  contenedores: [N, N, VCE, V, VCE, V],
  ubicaciones: [N, N, N, N, VCE, N],
  usuarios: [N, N, N, N, VCE, N],
  permisos: [N, N, N, N, VE, N],
  resumen_caja: [N, V, N, N, N, V],
  cortes: [N, VC, N, N, N, V],
  cobros_pagos: [N, VC, N, N, N, VC],
  reportes: [N, N, V, N, V, V],
  conciliacion: [N, N, N, N, VC, V],
  auditoria: [N, N, N, N, V, N],
  camionetas: [N, N, N, N, VCE, N],
  choferes: [N, N, N, N, VCE, N],
  viajes: [N, N, VC, VC, VCE, V],
});

const VALID_PERMISSION_TUPLES = new Set([N, V, VC, VCE, VE]);

export function assertSeedPermissionMatrix(
  matrix = MATRIX,
  modules = MODULOS,
  roles = ROLES,
) {
  const errors = [];
  const expectedModules = new Set(modules);
  const actualModules = Object.keys(matrix);

  for (const module of modules) {
    if (!(module in matrix)) errors.push(`falta el módulo "${module}"`);
  }
  for (const module of actualModules) {
    if (!expectedModules.has(module)) {
      errors.push(`el módulo "${module}" no existe en MODULOS`);
    }
  }

  for (const [module, row] of Object.entries(matrix)) {
    if (!Array.isArray(row) || row.length !== roles.length) {
      errors.push(
        `"${module}" debe tener exactamente ${roles.length} celdas; tiene ${
          Array.isArray(row) ? row.length : "un valor no iterable"
        }`,
      );
      continue;
    }
    row.forEach((permission, index) => {
      const hasValidValue =
        Array.isArray(permission) &&
        permission.length === 4 &&
        permission.every((value) => typeof value === "boolean");
      if (!hasValidValue || !VALID_PERMISSION_TUPLES.has(permission)) {
        errors.push(
          `"${module}" / "${roles[index]}" no usa una tupla de permisos válida`,
        );
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Matriz de permisos inválida:\n- ${errors.join("\n- ")}`);
  }
}