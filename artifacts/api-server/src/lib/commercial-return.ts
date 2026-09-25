import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db, ticketsTable, ticketLineasTable, rollosTable, usuariosTable, sesionesCajaTable,
  ubicacionesTable, movimientosCreditoTable, salidasDineroCajaTable, auditoriaTable,
} from "@workspace/db";
import { ADVISORY_LOCK_NAMESPACES, transactionAdvisoryLock } from "@workspace/db/advisory-locks";
import { loadCustomerCreditLedgerInTransaction } from "./credit-aging-read-model";
import { centsToMoney, moneyToCents, projectCreditLedger } from "./credit-allocation";
import { readSessionCash } from "./caja-corte-reader";
import { recibirDevolucionComercial } from "./inventario";
import {
  COMMERCIAL_RETURNS_ENABLED, CommercialReturnError, calculateCommercialReturn, exactDecimal, canonicalReturnRequest,
  type CommercialReturnRequest, type CommercialReturnResult, type CommercialReturnPreview,
} from "./commercial-return-contract";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Stored = { actor_id: number; request: CommercialReturnRequest; response: CommercialReturnResult };
function stop(code: string, message: string): never { throw new CommercialReturnError(code, message); }

/** Gate precedes database access. Only MAIN may prepare an enabled rehearsal copy. */
export async function postCommercialReturn(actorId: number, input: CommercialReturnRequest, ip: string): Promise<CommercialReturnResult> {
  if (!COMMERCIAL_RETURNS_ENABLED) throw new CommercialReturnError("DEVOLUCION_COMERCIAL_CERRADA", "Devolución comercial no habilitada.", 403);
  return db.transaction(tx => commercialReturnInTransaction(tx, actorId, input, ip)) as Promise<CommercialReturnResult>;
}

export async function previewCommercialReturn(actorId: number, input: CommercialReturnRequest, ip: string): Promise<CommercialReturnPreview> {
  if (!COMMERCIAL_RETURNS_ENABLED) throw new CommercialReturnError("DEVOLUCION_COMERCIAL_CERRADA", "Devolución comercial no habilitada.", 403);
  return db.transaction(tx => commercialReturnInTransaction(tx, actorId, input, ip, true));
}

/** SQL gate, actor check, and all locks remain mandatory even for internal callers. */
export async function commercialReturnInTransaction(tx: Tx, actorId: number, input: CommercialReturnRequest, ip: string, previewOnly = false): Promise<CommercialReturnResult | CommercialReturnPreview> {
  const gate = await tx.execute(sql`SELECT enabled FROM public.commercial_return_gate WHERE id=1 FOR SHARE`);
  if (gate.rows[0]?.enabled !== true) throw new CommercialReturnError("DEVOLUCION_COMERCIAL_CERRADA", "Compuerta SQL cerrada.", 403);
  const [actor] = await tx.select().from(usuariosTable).where(eq(usuariosTable.id, actorId)).for("share");
  if (!actor?.activo || actor.rol !== "ADMIN") throw new CommercialReturnError("ADMIN_REQUERIDO", "Solo ADMIN puede recibir una devolución comercial.", 403);
  await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.POS_TICKET_IDEMPOTENCY, `commercial-return:${input.uuidCliente}`);
  const prior = await tx.execute(sql`SELECT actor_id,request,response FROM public.devoluciones_comerciales WHERE uuid_cliente=${input.uuidCliente}::uuid`);
  if (prior.rows.length) {
    const stored = prior.rows[0] as unknown as Stored;
    if (stored.actor_id !== actorId || canonicalReturnRequest(stored.request) !== canonicalReturnRequest(input)) {
      stop("IDEMPOTENCIA_CONFLICTO", "La clave ya corresponde a otra solicitud.");
    }
    if (previewOnly) stop("ROLLO_YA_DEVUELTO", "Esta devolución ya fue registrada; recupera su documento con la misma solicitud.");
    return stored.response;
  }
  const [candidate] = await tx.select().from(ticketsTable).where(eq(ticketsTable.id, input.ticketId));
  if (!candidate) stop("NOTA_NO_ENCONTRADA", "Nota no encontrada.");
  await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT, candidate.clienteId);
  await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.CASH_SESSION_SITE, input.ubicacionRecepcionId);
  const [ticket] = await tx.select().from(ticketsTable).where(eq(ticketsTable.id, input.ticketId)).for("update");
  if (!ticket || ticket.clienteId !== candidate.clienteId || ticket.estado !== "VENDIDO" ||
      ticket.documentoTipo !== "NOTA" || ticket.autorizacionEstado !== "AUTORIZADA") {
    stop("NOTA_NO_ELEGIBLE", "Se requiere una nota vendida y autorizada, no cancelada.");
  }
  const [site] = await tx.select().from(ubicacionesTable).where(eq(ubicacionesTable.id, input.ubicacionRecepcionId)).for("share");
  if (!site?.activa || site.tipo !== "TIENDA") stop("SITIO_INVALIDO", "La recepción requiere una tienda activa.");
  if (actor.alcanceConsulta === "PROPIA" &&
      (actor.ubicacionId !== input.ubicacionRecepcionId || actor.ubicacionId !== ticket.ubicacionId)) {
    throw new CommercialReturnError("FUERA_DE_ALCANCE", "Nota o tienda fuera del alcance autorizado.", 404);
  }
  const [session] = await tx.select().from(sesionesCajaTable).where(and(
    eq(sesionesCajaTable.id, input.sesionCajaId), eq(sesionesCajaTable.ubicacionId, input.ubicacionRecepcionId),
  )).for("update");
  const today = await tx.execute(sql`SELECT (clock_timestamp() AT TIME ZONE 'America/Mexico_City')::date::text AS day`);
  if (!session || session.estado !== "ABIERTA" || session.cerradaAt || session.fechaOperativa !== today.rows[0]?.day) {
    stop("CAJA_DEL_DIA_REQUERIDA", "La devolución requiere la caja abierta del día en la tienda receptora.");
  }
  const lines = await tx.select().from(ticketLineasTable).where(eq(ticketLineasTable.ticketId, ticket.id)).for("share");
  const line = lines.find(row => row.id === input.lineaId);
  if (!line?.rolloId || line.tipo !== "NORMAL" || lines.some(row => row.tipo !== "NORMAL" || row.rolloId == null) ||
      lines.filter(row => row.rolloId === line.rolloId).length !== 1 ||
      exactDecimal(input.cantidad, 3) !== exactDecimal(line.cantidad, 3)) {
    stop("DEVOLUCION_NO_INTEGRA", "Solo se admite una línea de rollo completo con su cantidad original exacta; las líneas metreadas no son elegibles.");
  }
  const previous = await tx.execute(sql`SELECT linea_id,importe_rollo::text,efectivo_devuelto::text FROM public.devoluciones_comerciales WHERE ticket_id=${ticket.id}`);
  if (previous.rows.some(row => Number(row.linea_id) === line.id)) stop("ROLLO_YA_DEVUELTO", "Esta línea ya fue devuelta.");
  const ledger = await loadCustomerCreditLedgerInTransaction(ticket.clienteId, tx);
  const projection = projectCreditLedger(ledger);
  const charges = projection.allCharges.filter(row => row.ticketId === ticket.id && row.tipo === "VENTA_CREDITO");
  if (charges.length !== 1 || charges[0]!.originalCents !== moneyToCents(ticket.total) ||
      ledger.some(row => row.ticketId === ticket.id && row.tipo === "REVERSO")) {
    stop("HISTORIA_NO_CONCILIADA", "La nota no tiene un cargo original único y conciliado, o tiene reversos históricos.");
  }
  const charge = charges[0]!;
  const allocations = projection.allocations.filter(row => row.targetId === charge.movimientoId);
  // Directed receipts are reserved by the canonical projector and are not
  // repeated in its ordinary trace.
  const directed = ledger.filter(row => row.tipo === "ABONO" && row.directedMovimientoId === charge.movimientoId);
  const sources = new Set([...allocations.map(row => row.sourceId), ...directed.map(row => row.id)]);
  const sourceRows = sources.size === 0 ? [] : await tx.select().from(movimientosCreditoTable)
    .where(sql`${movimientosCreditoTable.id} = ANY(${[...sources]}::int[])`);
  const correctionFunded = sourceRows.length !== sources.size || sourceRows.some(row =>
    row.tipo !== "ABONO" || row.naturaleza !== "INGRESO_FISICO");
  const originalPaid = allocations.reduce((sum, row) => sum + row.appliedCents, 0) +
    directed.reduce((sum, row) => sum - moneyToCents(row.importe), 0);
  const previouslyReturned = previous.rows.reduce((sum, row) => sum + moneyToCents(String(row.importe_rollo)), 0);
  const previouslyRefunded = previous.rows.reduce((sum, row) => sum + moneyToCents(String(row.efectivo_devuelto)), 0);
  const amounts = calculateCommercialReturn({
    subtotal: ticket.subtotal, iva: ticket.iva, total: ticket.total,
    lineAmounts: lines.map(row => row.importe), returnedLineAmount: line.importe,
    remainingTotal: centsToMoney(moneyToCents(ticket.total) - previouslyReturned),
    pendingDebt: centsToMoney(charge.pendienteCents), paidMoney: centsToMoney(originalPaid - previouslyRefunded),
    correctionFunded,
  });
  const cash = await readSessionCash(tx, session, { efectivoEsperado: "0.00", diferencia: null });
  if (moneyToCents(amounts.efectivoDevuelto) > moneyToCents(cash.efectivoEsperado)) stop("EFECTIVO_INSUFICIENTE", "La caja del día no dispone del efectivo requerido.");
  if (previewOnly) {
    await recibirDevolucionComercial(tx, {
      rolloId: line.rolloId, ticketId: ticket.id, ubicacionId: input.ubicacionRecepcionId,
      cantidad: input.cantidad, usuarioId: actorId, id: input.uuidCliente, motivo: input.motivo, validarSolo: true,
    });
    const [roll] = await tx.select().from(rollosTable).where(eq(rollosTable.id, line.rolloId));
    return { ticketId: ticket.id, lineaId: line.id, serie: roll!.serie, cantidad: input.cantidad,
      ubicacionRecepcionId: input.ubicacionRecepcionId, sesionCajaId: session.id, ...amounts };
  }
  if (!input.revision || input.revision.importeRollo !== amounts.importeRollo ||
      input.revision.deudaCancelada !== amounts.deudaCancelada ||
      input.revision.efectivoDevuelto !== amounts.efectivoDevuelto) {
    stop("REVISION_CAMBIO", "Los importes ya no coinciden con la revisión. Consulta de nuevo antes de confirmar.");
  }
  const id = randomUUID();
  const now = new Date();
  const inventory = await recibirDevolucionComercial(tx, {
    rolloId: line.rolloId, ticketId: ticket.id, ubicacionId: input.ubicacionRecepcionId,
    cantidad: input.cantidad, usuarioId: actorId, id, motivo: input.motivo,
  });
  const [roll] = await tx.select().from(rollosTable).where(eq(rollosTable.id, line.rolloId));
  let outflowId: number | null = null;
  if (moneyToCents(amounts.efectivoDevuelto) > 0) {
    const [outflow] = await tx.insert(salidasDineroCajaTable).values({
      sesionCajaId: session.id, monto: amounts.efectivoDevuelto, cuentaOrigen: "CAJA_FISICA",
      motivo: `Devolución comercial ${id}: ${input.motivo}`, creadoPorId: actorId, createdAt: now,
    }).returning();
    outflowId = outflow!.id;
  }
  // Even a fully paid return has a zero-debt event in the customer statement.
  let creditId: number;
  {
    await tx.execute(sql`INSERT INTO public.operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
      VALUES ('DEVOLUCION_COMERCIAL',${id}::uuid,'OPERACION_CREDITO_SIN_DINERO',${actorId},${JSON.stringify(input)}::jsonb)`);
    const [credit] = await tx.insert(movimientosCreditoTable).values({
      clienteId: ticket.clienteId, ticketId: ticket.id, movimientoOrigenId: charge.movimientoId,
      tipo: sql`'DEVOLUCION_COMERCIAL'::public.tipo_movimiento_credito`, importe: `-${amounts.deudaCancelada}`, usuarioId: actorId,
      metadata: JSON.stringify({ commercialReturnId: id, efectivoDevuelto: amounts.efectivoDevuelto, importeRollo: amounts.importeRollo }),
      notas: input.motivo, sitioOrigenId: input.ubicacionRecepcionId, naturaleza: "OPERACION_CREDITO_SIN_DINERO",
      operacionProductor: "DEVOLUCION_COMERCIAL", operacionClave: id, origenJustificacion: input.motivo, createdAt: now,
    }).returning();
    creditId = credit!.id;
  }
  const response: CommercialReturnResult = {
    id, ticketId: ticket.id, lineaId: line.id, rolloId: line.rolloId, serie: roll!.serie,
    ubicacionRecepcionId: input.ubicacionRecepcionId, sesionCajaId: session.id, cantidad: input.cantidad,
    ...amounts, motivo: input.motivo, createdAt: now.toISOString(),
  };
  await tx.execute(sql`INSERT INTO public.devoluciones_comerciales
    (id,uuid_cliente,ticket_id,linea_id,rollo_id,ubicacion_recepcion_id,sesion_caja_id,actor_id,cantidad,
     importe_rollo,deuda_cancelada,efectivo_devuelto,motivo,movimiento_inventario_id,movimiento_credito_id,
     salida_caja_id,request,response,fuentes_pago,created_at)
    VALUES (${id}::uuid,${input.uuidCliente}::uuid,${ticket.id},${line.id},${line.rolloId},${input.ubicacionRecepcionId},
      ${session.id},${actorId},${input.cantidad}::numeric,${amounts.importeRollo}::numeric,${amounts.deudaCancelada}::numeric,
      ${amounts.efectivoDevuelto}::numeric,${input.motivo},${inventory.id},${creditId},${outflowId},
      ${JSON.stringify(input)}::jsonb,${JSON.stringify(response)}::jsonb,${[...sources]}::int[],${now})`);
  const after = projectCreditLedger(await loadCustomerCreditLedgerInTransaction(ticket.clienteId, tx));
  if (after.balanceCents !== projection.balanceCents - moneyToCents(amounts.deudaCancelada) ||
      after.overpaymentCents !== projection.overpaymentCents ||
      JSON.stringify(after.allocations) !== JSON.stringify(projection.allocations)) {
    stop("PROYECCION_CAMBIO", "La devolución alteraría aplicaciones previas o saldo a favor; operación cancelada.");
  }
  await tx.insert(auditoriaTable).values({
    usuarioId: actorId, ip, accion: "DEVOLUCION_COMERCIAL", entidad: "devoluciones_comerciales",
    entidadId: id, datosDespues: response,
  });
  return response;
}