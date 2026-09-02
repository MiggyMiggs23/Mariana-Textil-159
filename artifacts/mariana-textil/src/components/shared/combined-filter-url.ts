export type CombinedFilterCriteria = {
  proveedorIds: number[];
  ubicacionIds: number[];
  telas: string[];
  colores: string[];
  desde?: string;
  hasta?: string;
};

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function values(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

function ids(params: URLSearchParams, key: string): number[] {
  return values(params, key).map(Number).filter((value) => Number.isInteger(value) && value > 0);
}

export function readCombinedFilterCriteria(params: URLSearchParams): CombinedFilterCriteria {
  const desde = params.get("desde") ?? undefined;
  const hasta = params.get("hasta") ?? undefined;
  return {
    proveedorIds: ids(params, "proveedorIds"),
    ubicacionIds: ids(params, "ubicacionIds"),
    telas: values(params, "telas"),
    colores: values(params, "colores"),
    desde: desde && validDate(desde) ? desde : undefined,
    hasta: hasta && validDate(hasta) ? hasta : undefined,
  };
}

export function writeCombinedFilterCriteria(params: URLSearchParams, criteria: CombinedFilterCriteria): void {
  for (const key of ["proveedorIds", "ubicacionIds", "telas", "colores", "desde", "hasta"]) params.delete(key);
  if (criteria.proveedorIds.length) params.set("proveedorIds", criteria.proveedorIds.join(","));
  if (criteria.ubicacionIds.length) params.set("ubicacionIds", criteria.ubicacionIds.join(","));
  if (criteria.telas.length) params.set("telas", criteria.telas.join(","));
  if (criteria.colores.length) params.set("colores", criteria.colores.join(","));
  if (criteria.desde) params.set("desde", criteria.desde);
  if (criteria.hasta) params.set("hasta", criteria.hasta);
}

export function sanitizeCombinedFilterCriteria(
  criteria: CombinedFilterCriteria,
  catalogs: { proveedorIds: number[]; ubicacionIds: number[]; telas: string[]; colores: string[] },
): CombinedFilterCriteria {
  const allowedProviders = new Set(catalogs.proveedorIds);
  const allowedSites = new Set(catalogs.ubicacionIds);
  const allowedFabrics = new Set(catalogs.telas);
  const allowedColors = new Set(catalogs.colores);
  return {
    proveedorIds: criteria.proveedorIds.filter((id) => allowedProviders.has(id)),
    ubicacionIds: criteria.ubicacionIds.filter((id) => allowedSites.has(id)),
    telas: criteria.telas.filter((value) => allowedFabrics.has(value)),
    colores: criteria.colores.filter((value) => allowedColors.has(value)),
    desde: criteria.desde,
    hasta: criteria.hasta,
  };
}