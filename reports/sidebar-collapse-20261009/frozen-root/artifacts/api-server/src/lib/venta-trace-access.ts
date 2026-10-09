export function canReadLinkedVentaTrace(input: {
  rol: string;
  ubicacionId: number | null;
  puedeVerSalidas: boolean;
  puedeVerSalidasVenta: boolean;
  linkedOrigins: readonly number[];
}): boolean {
  return input.rol === "ADMIN" ||
    (input.puedeVerSalidasVenta && input.linkedOrigins.length > 0) ||
    (input.puedeVerSalidas && input.ubicacionId != null && input.linkedOrigins.includes(input.ubicacionId));
}

export function canDeliverVenta(input: {
  rol: string;
  assignedLocationId: number | null;
  originId: number;
  puedeVerSalidas: boolean;
  puedeEditarSalidas: boolean;
}): boolean {
  return input.rol === "ADMIN" ||
    (input.assignedLocationId === input.originId &&
      (input.puedeVerSalidas || input.puedeEditarSalidas));
}