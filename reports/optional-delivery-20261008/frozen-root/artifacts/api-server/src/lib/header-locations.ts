import { and, asc, eq, inArray } from "drizzle-orm";
import { db, ubicacionesTable } from "@workspace/db";

/**
 * Report comparison mode uses the physical, active site catalog exposed to
 * the header UI. TRANSITO/EXTERNO are operational locations, but they are
 * not selectable report sites. The legacy inventory catalog endpoint keeps
 * its original broader response contract.
 */
export const HEADER_ELIGIBLE_LOCATION_TYPES = ["TIENDA", "BODEGA"] as const;

export type HeaderEligibleLocation = {
  id: number;
  nombre: string;
  tipo: string;
  activa: boolean;
};

export async function listHeaderEligibleLocations(
  locationIds?: readonly number[],
): Promise<HeaderEligibleLocation[]> {
  const predicates = [
    eq(ubicacionesTable.activa, true),
    inArray(ubicacionesTable.tipo, [...HEADER_ELIGIBLE_LOCATION_TYPES]),
  ];
  if (locationIds?.length) {
    predicates.push(inArray(ubicacionesTable.id, [...locationIds]));
  }
  return db
    .select({
      id: ubicacionesTable.id,
      nombre: ubicacionesTable.nombre,
      tipo: ubicacionesTable.tipo,
      activa: ubicacionesTable.activa,
    })
    .from(ubicacionesTable)
    .where(and(...predicates))
    .orderBy(asc(ubicacionesTable.nombre), asc(ubicacionesTable.id));
}
