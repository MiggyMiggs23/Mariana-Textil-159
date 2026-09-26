import { CurrentUser } from "@workspace/api-client-react";
import { E3_ENABLED } from "@/lib/e3-feature-flags";

export const Modules = {
  DASHBOARD: "dashboard",
  POS: "pos",
  ENTRADAS: "entradas",
  SALIDAS: "salidas",
  MOVIMIENTOS: "movimientos",
  ETIQUETAS: "etiquetas",
  INVENTARIO: "inventario",
  AUDITORIA_INVENTARIO: "auditoria_inventario",
  PRODUCTOS: "productos",
  AJUSTES: "ajustes",
  CLIENTES: "clientes",
  CLIENTES_CREDITO: "clientes_credito",
  CLIENTES_PRECIOS: "clientes_precios",
  CLIENTES_FINANZAS: "clientes_finanzas",
  PROVEEDORES: "proveedores",
  PROVEEDORES_FINANZAS: "proveedores_finanzas",
  CONTENEDORES: "contenedores",
  UBICACIONES: "ubicaciones",
  USUARIOS: "usuarios",
  PERMISOS: "permisos",
  RESUMEN_CAJA: "resumen_caja",
  CORTES: "cortes",
  COBROS_PAGOS: "cobros_pagos",
  REPORTES: "reportes",
  CONCILIACION: "conciliacion",
  AUDITORIA: "auditoria",
  PRECIOS: "precios",
  CAMIONETAS: "camionetas",
  CHOFERES: "choferes",
  VIAJES: "viajes",
  SALIDAS_VENTA: "salidas_venta",
  EQUIPOS: "equipos",
  CAJA_ABONOS: "caja_abonos",
  CLIENTES_RECAPTURAS: "clientes_recapturas",
} as const;

export type Module = (typeof Modules)[keyof typeof Modules];

// Modules retains typed identifiers even for unreleased capabilities. Every
// operational catalog/editor must enumerate ACTIVE_MODULES, not identifiers.
const E3_PERMISSION_MODULES: readonly Module[] = [
  Modules.CAJA_ABONOS,
  Modules.CLIENTES_RECAPTURAS,
];
export const ACTIVE_MODULES: readonly Module[] = Object.freeze(
  Object.values(Modules).filter(module => E3_ENABLED || !E3_PERMISSION_MODULES.includes(module)),
);

export function hasPermission(
  user: CurrentUser | null | undefined,
  module: string,
  action: "ver" | "crear" | "editar" | "autorizar" = "ver",
): boolean {
  if (!user) return false;
  if (user.rol === "ADMIN") return true;
  if (!user.permisos) return false;
  const perm = user.permisos.find((p) => p.modulo === module);
  if (!perm) return false;

  switch (action) {
    case "ver":
      return perm.puedeVer;
    case "crear":
      return perm.puedeCrear;
    case "editar":
      return perm.puedeEditar;
    case "autorizar":
      return perm.puedeAutorizar;
    default:
      return false;
  }
}
