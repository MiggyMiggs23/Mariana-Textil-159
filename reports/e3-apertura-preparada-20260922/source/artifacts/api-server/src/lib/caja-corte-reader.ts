import { and, eq, inArray } from "drizzle-orm";
import { auditoriaTable, cobrosCreditoPendientesE1Table, movimientosCreditoTable, ticketPagosTable, ticketsTable, salidasDineroCajaTable, usuariosTable, proveedoresTable } from "@workspace/db/schema";
import type { db } from "@workspace/db";
import { calculateCash, resolveSessionCash, creditCashDocuments, type CashDocument, type CashBreakdown } from "./caja-cash-ledger";

type Reader = Pick<typeof db, "select">;
type Session = { id: number; estado: string; fondoInicial: string; efectivoContado: string | null; abiertaAt?: Date; usuarioId?: number };

/** Legacy values are supplied by the original surface, intentionally including
 * admin's historical omission of outflows. Never broaden historical coverage. */
export async function readSessionCash(database: Reader, session: Session, legacy: { efectivoEsperado: string; diferencia: string | null }): Promise<{ efectivoEsperado: string; diferencia: string | null; efectivoDesglose?: CashBreakdown }> {
  if (session.estado === "CERRADA") {
    const audits = await database.select({ datos: auditoriaTable.datosDespues }).from(auditoriaTable)
      .where(and(eq(auditoriaTable.accion, "CERRAR_CAJA"), eq(auditoriaTable.entidad, "sesiones_caja"), eq(auditoriaTable.entidadId, String(session.id))));
    const snapshots = audits.filter(row => row.datos && Object.prototype.hasOwnProperty.call(row.datos, "cashSnapshot"));
    return resolveSessionCash(session, snapshots.map(row => row.datos!.cashSnapshot), legacy, () => {
      throw new Error("E2: un corte cerrado nunca lee movimientos actuales");
    });
  }
  return resolveSessionCash(session, [], legacy, () => readOpenCash(database, session));
}

async function readOpenCash(database: Reader, session: Session): Promise<CashBreakdown> {
  const documents: CashDocument[] = [{ origen: "FONDO_INICIAL", id: String(session.id), folio: null, importe: session.fondoInicial, href: null,
    evidencia: { referencia: `Sesión de caja #${session.id}`, motivo: null, fecha: session.abiertaAt?.toISOString() ?? null, usuarioId: session.usuarioId ?? null, proveedorId: null } }];
  const payments = await database.select({ id: ticketPagosTable.id, ticketId: ticketsTable.id, folio: ticketsTable.folio, importe: ticketPagosTable.importe })
    .from(ticketPagosTable).innerJoin(ticketsTable, eq(ticketsTable.id, ticketPagosTable.ticketId))
    .where(and(eq(ticketsTable.sesionCajaId, session.id), eq(ticketsTable.estado, "VENDIDO"), eq(ticketPagosTable.formaPago, "EFECTIVO")));
  for (const payment of payments) documents.push({ origen: "TICKET", id: String(payment.id), folio: String(payment.folio), importe: payment.importe, href: `/tickets/${payment.ticketId}` });
  const movements = await database.select().from(movimientosCreditoTable).where(eq(movimientosCreditoTable.sesionCajaId, session.id));
  const retained = await database.select().from(cobrosCreditoPendientesE1Table).where(eq(cobrosCreditoPendientesE1Table.sesionCajaId, session.id));
  documents.push(...creditCashDocuments(session.id, movements, retained));
  // Physical returns are represented ONLY by their cash outflow, not REVERSO.
  const outflows = await database.select().from(salidasDineroCajaTable).where(and(eq(salidasDineroCajaTable.sesionCajaId, session.id), eq(salidasDineroCajaTable.cuentaOrigen, "CAJA_FISICA")));
  // There is no outflow folio or standalone document route in the current app.
  // Freeze the actual evidence for expansion/print in the existing shared cut.
  for (const outflow of outflows) documents.push({ origen: "SALIDA", id: String(outflow.id), folio: null, importe: outflow.monto, href: null,
    evidencia: { referencia: null, motivo: outflow.motivo, fecha: outflow.createdAt.toISOString(),
      usuarioId: outflow.creadoPorId, proveedorId: outflow.proveedorId } });
  // Resolve actual names only for referenced records, while the session is open.
  // Names are frozen with the cash documents; closed cuts never join live names.
  const userIds = [...new Set(documents.flatMap(d => d.evidencia?.usuarioId == null ? [] : [d.evidencia.usuarioId]))];
  const providerIds = [...new Set(documents.flatMap(d => d.evidencia?.proveedorId == null ? [] : [d.evidencia.proveedorId]))];
  const users = userIds.length === 0 ? [] : await database.select({ id: usuariosTable.id, nombre: usuariosTable.nombre })
    .from(usuariosTable).where(inArray(usuariosTable.id, userIds));
  const providers = providerIds.length === 0 ? [] : await database.select({ id: proveedoresTable.id, nombre: proveedoresTable.nombre })
    .from(proveedoresTable).where(inArray(proveedoresTable.id, providerIds));
  const userNames = new Map(users.map(row => [row.id, row.nombre]));
  const providerNames = new Map(providers.map(row => [row.id, row.nombre]));
  for (const document of documents) {
    if (!document.evidencia) continue;
    document.evidencia.usuarioNombre = document.evidencia.usuarioId == null ? null : userNames.get(document.evidencia.usuarioId) ?? null;
    document.evidencia.proveedorNombre = document.evidencia.proveedorId == null ? null : providerNames.get(document.evidencia.proveedorId) ?? null;
  }
  return calculateCash(documents);
}