import { Role } from "@workspace/api-client-react";

export const Modules = {
  // INICIO
  DASHBOARD: 'dashboard',
  // OPERACIÓN
  VENTAS_POS: 'ventas_pos',
  ENTRADAS: 'entradas',
  SALIDAS: 'salidas',
  TRANSFERENCIAS: 'transferencias',
  MOVIMIENTOS: 'movimientos',
  // INVENTARIO
  INVENTARIO: 'inventario',
  PRODUCTOS: 'productos',
  // ADMINISTRACIÓN
  CLIENTES: 'clientes',
  PROVEEDORES: 'proveedores',
  UBICACIONES: 'ubicaciones',
  USUARIOS: 'usuarios',
  CONTENEDORES: 'contenedores',
  // CAJA OPERATIVA
  CAJA_RESUMEN: 'caja_resumen',
  CAJA_CORTES: 'caja_cortes',
  CAJA_COBROS: 'caja_cobros',
  // REPORTES
  REPORTES: 'reportes'
} as const;

export type Module = typeof Modules[keyof typeof Modules];

export const RolePermissions: Record<Role, Module[]> = {
  [Role.ADMIN]: Object.values(Modules),
  [Role.CAJA]: [
    Modules.DASHBOARD,
    Modules.VENTAS_POS,
    Modules.CLIENTES,
    Modules.CAJA_RESUMEN,
    Modules.CAJA_CORTES,
    Modules.CAJA_COBROS,
    Modules.REPORTES
  ],
  [Role.INVENTARIOS]: [
    Modules.DASHBOARD,
    Modules.INVENTARIO,
    Modules.PRODUCTOS,
    Modules.MOVIMIENTOS,
    Modules.TRANSFERENCIAS,
    Modules.REPORTES
  ],
  [Role.BODEGA]: [
    Modules.DASHBOARD,
    Modules.ENTRADAS,
    Modules.SALIDAS,
    Modules.TRANSFERENCIAS,
    Modules.MOVIMIENTOS,
    Modules.INVENTARIO,
    Modules.CONTENEDORES
  ]
};

export function hasPermission(role: Role, module: Module): boolean {
  return RolePermissions[role]?.includes(module) ?? false;
}
