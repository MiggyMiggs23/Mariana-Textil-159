import type { AccionPermiso } from "./permisos";

/**
 * Immutable authorization ceiling for SUPERVISOR. Database permissions may
 * remove actions from this set, but can never add actions to it.
 */
export const SUPERVISOR_PERMISSION_CEILING: Readonly<
  Record<string, ReadonlySet<AccionPermiso>>
> = {
  dashboard: new Set(["ver"]),
  inventario: new Set(["ver"]),
  productos: new Set(["ver"]),
  entradas: new Set(["ver", "crear", "editar"]),
  salidas: new Set(["ver", "crear", "editar", "autorizar"]),
  viajes: new Set(["ver", "crear"]),
  movimientos: new Set(["ver"]),
  ajustes: new Set(["ver", "crear", "autorizar"]),
  etiquetas: new Set(["ver", "crear"]),
  contenedores: new Set(["ver", "crear", "editar", "autorizar"]),
  clientes: new Set(["ver", "crear", "editar"]),
  proveedores: new Set(["ver", "crear", "editar"]),
  reportes: new Set(["ver"]),
};

export function supervisorAllows(
  modulo: string,
  accion: AccionPermiso,
): boolean {
  return SUPERVISOR_PERMISSION_CEILING[modulo]?.has(accion) === true;
}