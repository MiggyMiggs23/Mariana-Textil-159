import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { clientesTable, rollosTable, salidaRollosTable, salidasTable, ubicacionesTable } from "@workspace/db";
import type { Tx } from "./inventario";
import { InventarioError } from "./inventario";

export async function assertNoActiveVentaClienteReservation(
  tx: Tx,
  rolloIds: readonly number[],
  ownSalidaIds: readonly number[] = [],
) {
  if (!rolloIds.length) return;
  const rows = await tx.select({
    rolloId: salidaRollosTable.rolloId, serie: rollosTable.serie,
    salidaId: salidasTable.id, folio: salidasTable.folio,
    iniciales: ubicacionesTable.iniciales, clienteId: clientesTable.id,
    nombreCliente: clientesTable.nombre, enviadaAt: salidasTable.enviadaAt,
  }).from(salidaRollosTable)
    .innerJoin(salidasTable, eq(salidaRollosTable.salidaId, salidasTable.id))
    .innerJoin(rollosTable, eq(salidaRollosTable.rolloId, rollosTable.id))
    .innerJoin(clientesTable, eq(salidasTable.clienteId, clientesTable.id))
    .innerJoin(ubicacionesTable, eq(salidasTable.origenId, ubicacionesTable.id))
    .where(and(
      inArray(salidaRollosTable.rolloId, [...rolloIds]),
      eq(salidasTable.modalidad, "VENTA_CLIENTE"),
      inArray(salidasTable.estado, ["EN_TRANSITO", "RECIBIDA"]),
      ownSalidaIds.length ? notInArray(salidasTable.id, [...ownSalidaIds]) : sql`TRUE`,
    ));
  if (rows.length) throw new InventarioError("ROLLO BLOQUEADO", "ROLLO_BLOQUEADO", rows.map(r => ({
    rolloId: r.rolloId, serie: r.serie, salidaId: r.salidaId,
    salidaFolio: `${r.iniciales}-${String(r.folio).padStart(6, "0")}`,
    clienteId: r.clienteId, nombreCliente: r.nombreCliente,
    bloqueadoDesde: r.enviadaAt!, salidaHref: `/salidas/${r.salidaId}`,
  })));
}