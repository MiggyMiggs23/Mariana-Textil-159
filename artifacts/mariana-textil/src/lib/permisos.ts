import { CurrentUser } from "@workspace/api-client-react";

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
} as const;

export type Module = (typeof Modules)[keyof typeof Modules];

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
