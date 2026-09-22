/**
 * Pure supplier-utility calculations used by contract/regression tests.
 *
 * This module deliberately has no database imports or side effects. Database
 * attribution remains in compras-proveedor.ts; these calculations make the
 * distinct-roll and detail/summary invariants executable without test writes.
 */

export type ProveedorUtilidadSummaryRow = {
  lineaId: number;
  rolloId: number;
  ventas: string;
  costo: string | null;
};

export type ProveedorUtilidadPureSummary = {
  ventas: string;
  costo: string;
  utilidad: string;
  margenPct: string | null;
  lineasIncluidas: number;
  lineasExcluidasSinRollo: number;
  lineasExcluidasSinCosto: number;
  rollosExcluidosSinCosto: number;
};

export function countDistinctRollosSinCosto(
  rows: ReadonlyArray<Pick<ProveedorUtilidadSummaryRow, "rolloId" | "costo">>,
): number {
  return new Set(
    rows
      .filter((row) => row.costo == null)
      .map((row) => row.rolloId),
  ).size;
}

export function summarizeProveedorUtilidadRows(
  rows: ReadonlyArray<ProveedorUtilidadSummaryRow>,
  lineasExcluidasSinRollo = 0,
): ProveedorUtilidadPureSummary {
  const included = rows.filter((row) => row.costo != null);
  const withoutCost = rows.filter((row) => row.costo == null);
  const ventas = included.reduce((sum, row) => sum + Number(row.ventas), 0);
  const costo = included.reduce((sum, row) => sum + Number(row.costo), 0);
  const utilidad = ventas - costo;

  return {
    ventas: ventas.toFixed(2),
    costo: costo.toFixed(2),
    utilidad: utilidad.toFixed(2),
    margenPct: ventas > 0 ? ((utilidad / ventas) * 100).toFixed(2) : null,
    lineasIncluidas: new Set(included.map((row) => row.lineaId)).size,
    lineasExcluidasSinRollo,
    lineasExcluidasSinCosto: new Set(withoutCost.map((row) => row.lineaId)).size,
    rollosExcluidosSinCosto: countDistinctRollosSinCosto(withoutCost),
  };
}