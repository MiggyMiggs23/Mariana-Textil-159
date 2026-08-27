import { Router } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  auditoriaTable, camionetasTable, choferesTable, clientesTable, db, productosTable,
  rollosTable, salidaRollosTable, salidasTable, ticketLineasTable, ticketsTable,
  ubicacionesTable, viajeFolioTable, viajeSalidasTable, viajeTicketsTable, viajesTable,
} from "@workspace/db";
import { requireSession, type AuthContext } from "../middlewares/auth";
import { requierePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";

const router = Router();
const createBody = z.object({
  origenId: z.number().int().positive(), camionetaId: z.number().int().positive(),
  choferId: z.number().int().positive(), salidaAt: z.coerce.date(),
  observaciones: z.string().trim().max(2000).nullable().optional(),
  ticketIds: z.array(z.number().int().positive()).default([]),
  salidaIds: z.array(z.number().int().positive()).default([]),
});

async function reserveFolio(tx: any, origenId: number) {
  await tx.insert(viajeFolioTable).values({ ubicacionId: origenId, ultimoFolio: 0 }).onConflictDoNothing();
  const [counter] = await tx.select().from(viajeFolioTable).where(eq(viajeFolioTable.ubicacionId, origenId)).for("update");
  const folio = counter.ultimoFolio + 1;
  await tx.update(viajeFolioTable).set({ ultimoFolio: folio }).where(eq(viajeFolioTable.ubicacionId, origenId));
  return folio;
}

async function buildViajeDetails(viajes: any[]) {
  if (!viajes.length) return new Map<number, any>();
  const viajeIds = viajes.map(viaje => viaje.id);
  const [tickets, salidas] = await Promise.all([
    db.select({ viajeId: viajeTicketsTable.viajeId, id: ticketsTable.id, folio: ticketsTable.folio, destinatario: ticketsTable.nombreDestinatario, direccion: ticketsTable.direccionEntregaSnapshot, cliente: clientesTable.nombre })
      .from(viajeTicketsTable).innerJoin(ticketsTable, eq(viajeTicketsTable.ticketId, ticketsTable.id))
      .leftJoin(clientesTable, eq(ticketsTable.clienteId, clientesTable.id)).where(inArray(viajeTicketsTable.viajeId, viajeIds)),
    db.select({ viajeId: viajeSalidasTable.viajeId, id: salidasTable.id, folio: salidasTable.folio, destino: ubicacionesTable.nombre })
      .from(viajeSalidasTable).innerJoin(salidasTable, eq(viajeSalidasTable.salidaId, salidasTable.id))
      .leftJoin(ubicacionesTable, eq(salidasTable.destinoId, ubicacionesTable.id)).where(inArray(viajeSalidasTable.viajeId, viajeIds)),
  ]);
  const ticketIds = tickets.map(ticket => ticket.id);
  const salidaIds = salidas.map(salida => salida.id);
  const [ticketLines, salidaRollos] = await Promise.all([
    ticketIds.length ? db.select({ ticketId: ticketLineasTable.ticketId, serie: rollosTable.serie, tipo: ticketLineasTable.tipo, cantidad: ticketLineasTable.cantidad, unidad: productosTable.unidad, sku: productosTable.sku, tela: productosTable.tela, color: productosTable.color })
      .from(ticketLineasTable).innerJoin(productosTable, eq(ticketLineasTable.productoId, productosTable.id))
      .leftJoin(rollosTable, eq(ticketLineasTable.rolloId, rollosTable.id)).where(inArray(ticketLineasTable.ticketId, ticketIds)) : [],
    salidaIds.length ? db.select({ salidaId: salidaRollosTable.salidaId, serie: rollosTable.serie, cantidad: salidaRollosTable.cantidadEnviada, unidad: productosTable.unidad, sku: productosTable.sku, tela: productosTable.tela, color: productosTable.color })
      .from(salidaRollosTable).innerJoin(rollosTable, eq(salidaRollosTable.rolloId, rollosTable.id))
      .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id)).where(inArray(salidaRollosTable.salidaId, salidaIds)) : [],
  ]);
  const ticketsByViaje = new Map<number, any[]>();
  const salidasByViaje = new Map<number, any[]>();
  for (const ticket of tickets) ticketsByViaje.set(ticket.viajeId, [...(ticketsByViaje.get(ticket.viajeId) ?? []), ticket]);
  for (const salida of salidas) salidasByViaje.set(salida.viajeId, [...(salidasByViaje.get(salida.viajeId) ?? []), salida]);
  const ticketLinesByTicket = new Map<number, any[]>();
  const salidaRollosBySalida = new Map<number, any[]>();
  for (const line of ticketLines) ticketLinesByTicket.set(line.ticketId, [...(ticketLinesByTicket.get(line.ticketId) ?? []), line]);
  for (const line of salidaRollos) salidaRollosBySalida.set(line.salidaId, [...(salidaRollosBySalida.get(line.salidaId) ?? []), line]);
  return new Map(viajes.map(viaje => {
    const attachedTickets = ticketsByViaje.get(viaje.id) ?? [];
    const attachedSalidas = salidasByViaje.get(viaje.id) ?? [];
    const viajeTicketLines = attachedTickets.flatMap(ticket => ticketLinesByTicket.get(ticket.id) ?? []);
    const viajeSalidaRollos = attachedSalidas.flatMap(salida => salidaRollosBySalida.get(salida.id) ?? []);
    const rollos = [
      ...viajeTicketLines.filter(line => line.tipo === "NORMAL" && line.serie).map(line => ({ documento: "NOTA", documentoId: line.ticketId, serie: line.serie!, cantidad: line.cantidad, unidad: line.unidad, sku: line.sku, tela: line.tela, color: line.color })),
      ...viajeSalidaRollos.map(line => ({ documento: "SALIDA", documentoId: line.salidaId, ...line })),
    ];
    const quantities = [...viajeTicketLines, ...viajeSalidaRollos];
    const totalMetros = quantities.filter(item => item.unidad === "METRO").reduce((sum, item) => sum + Number(item.cantidad), 0).toFixed(3);
    const totalKilos = quantities.filter(item => item.unidad === "KILO").reduce((sum, item) => sum + Number(item.cantidad), 0).toFixed(3);
    const destinos = [...new Set([...attachedTickets.map(ticket => ticket.direccion || ticket.destinatario || ticket.cliente || "Sin destino"), ...attachedSalidas.map(salida => salida.destino || "Mostrador")])];
    return [viaje.id, { documentos: attachedTickets.length + attachedSalidas.length, totalRollos: rollos.length, totalMetros, totalKilos, destinos, tickets: attachedTickets.map(({ viajeId, ...ticket }) => ticket), salidas: attachedSalidas.map(({ viajeId, ...salida }) => salida), rollos }];
  }));
}

function ownSite(auth: AuthContext): number | null {
  return auth.user.alcanceConsulta === "PROPIA" ? auth.user.ubicacionId : null;
}

function requireOwnSite(auth: AuthContext): number | null {
  const siteId = ownSite(auth);
  if (auth.user.alcanceConsulta === "PROPIA" && siteId == null) {
    throw new Error("VIAJE_LOCATION_FORBIDDEN");
  }
  return siteId;
}

router.get("/viajes/catalogo-operativo", requireSession, requierePermiso("viajes", "ver"), async (req, res, next) => {
  try {
    const siteId = requireOwnSite(req.auth!);
    const [camionetas, choferes, ubicaciones] = await Promise.all([
      db.select().from(camionetasTable).where(eq(camionetasTable.activa, true)).orderBy(asc(camionetasTable.nombre)),
      db.select().from(choferesTable).where(eq(choferesTable.activo, true)).orderBy(asc(choferesTable.nombreCompleto)),
      db.select().from(ubicacionesTable).where(and(eq(ubicacionesTable.activa, true), inArray(ubicacionesTable.tipo, ["TIENDA", "BODEGA"]), ...(siteId ? [eq(ubicacionesTable.id, siteId)] : []))).orderBy(asc(ubicacionesTable.nombre)),
    ]);
    res.json({ camionetas, choferes, ubicaciones });
  } catch (error) { next(error); }
});
router.get("/viajes/elegibles", requireSession, requierePermiso("viajes", "crear"), async (req, res, next) => {
  try {
    const q = z.object({ origenId: z.coerce.number().int().positive().optional(), search: z.string().trim().optional() }).parse(req.query);
    const siteId = requireOwnSite(req.auth!);
    if (siteId != null && q.origenId != null && q.origenId !== siteId) {
      res.status(403).json({ error: "No puedes consultar documentos de otro origen.", code: "VIAJE_LOCATION_FORBIDDEN" }); return;
    }
    const origenId = siteId ?? q.origenId;
    const term = q.search ? `%${q.search}%` : null;
    const ticketConditions = [eq(ticketsTable.documentoTipo, "NOTA"), sql`NOT EXISTS (SELECT 1 FROM viaje_tickets vt WHERE vt.ticket_id = ${ticketsTable.id})`, sql`${ticketsTable.estado} <> 'CANCELADO'`, ...(origenId ? [eq(ticketsTable.ubicacionId, origenId)] : []), ...(term ? [or(ilike(ticketsTable.nombreDestinatario, term), ilike(clientesTable.nombre, term), sql`CAST(${ticketsTable.folio} AS text) ILIKE ${term}`)] : [])];
    const salidaConditions = [sql`NOT EXISTS (SELECT 1 FROM viaje_salidas vs WHERE vs.salida_id = ${salidasTable.id})`, sql`${salidasTable.estado} <> 'CANCELADA'`, ...(origenId ? [eq(salidasTable.origenId, origenId)] : [])];
    const [tickets, salidas] = await Promise.all([
      db.select({ id: ticketsTable.id, folio: ticketsTable.folio, destinatario: ticketsTable.nombreDestinatario, cliente: clientesTable.nombre }).from(ticketsTable).leftJoin(clientesTable, eq(ticketsTable.clienteId, clientesTable.id)).where(and(...ticketConditions)).orderBy(desc(ticketsTable.createdAt)).limit(100),
      db.select({ id: salidasTable.id, folio: salidasTable.folio, destino: ubicacionesTable.nombre }).from(salidasTable).leftJoin(ubicacionesTable, eq(salidasTable.destinoId, ubicacionesTable.id)).where(and(...salidaConditions)).orderBy(desc(salidasTable.createdAt)).limit(100),
    ]);
    res.json({ tickets, salidas });
  } catch (error) { next(error); }
});

router.post("/viajes", requireSession, requierePermiso("viajes", "crear"), async (req, res, next): Promise<void> => {
  try {
    const input = createBody.parse(req.body);
    const siteId = requireOwnSite(req.auth!);
    if (siteId != null && input.origenId !== siteId) {
      res.status(403).json({ error: "No puedes crear viajes desde otro origen.", code: "VIAJE_LOCATION_FORBIDDEN" }); return;
    }
    if (!input.ticketIds.length && !input.salidaIds.length) { res.status(400).json({ error: "El viaje debe incluir al menos un documento." }); return; }
    if (new Set(input.ticketIds).size !== input.ticketIds.length || new Set(input.salidaIds).size !== input.salidaIds.length) { res.status(400).json({ error: "No se puede repetir un documento." }); return; }
    const viaje = await db.transaction(async (tx) => {
      const [[vehicle], [driver], [origin]] = await Promise.all([
        tx.select().from(camionetasTable).where(eq(camionetasTable.id, input.camionetaId)).for("update"),
        tx.select().from(choferesTable).where(eq(choferesTable.id, input.choferId)).for("update"),
        tx.select().from(ubicacionesTable).where(eq(ubicacionesTable.id, input.origenId)).limit(1),
      ]);
      if (!vehicle?.activa || !driver?.activo) throw new Error("TRANSPORT_INACTIVE");
      if (!origin?.activa || !["TIENDA", "BODEGA"].includes(origin.tipo)) throw new Error("INVALID_ORIGIN");
      const tickets = input.ticketIds.length ? await tx.select({ id: ticketsTable.id, tipo: ticketsTable.documentoTipo, estado: ticketsTable.estado, origenId: ticketsTable.ubicacionId }).from(ticketsTable).where(inArray(ticketsTable.id, input.ticketIds)).for("update") : [];
      const salidas = input.salidaIds.length ? await tx.select({ id: salidasTable.id, estado: salidasTable.estado, origenId: salidasTable.origenId }).from(salidasTable).where(inArray(salidasTable.id, input.salidaIds)).for("update") : [];
      if (tickets.length !== input.ticketIds.length || tickets.some(t => t.tipo !== "NOTA" || t.estado === "CANCELADO")) throw new Error("INVALID_TICKET");
      if (salidas.length !== input.salidaIds.length || salidas.some(s => s.estado === "CANCELADA")) throw new Error("INVALID_SALIDA");
      if (tickets.some(ticket => ticket.origenId !== input.origenId) || salidas.some(salida => salida.origenId !== input.origenId)) throw new Error("DOCUMENT_ORIGIN_MISMATCH");
      const attachedTickets = input.ticketIds.length ? await tx.select().from(viajeTicketsTable).where(inArray(viajeTicketsTable.ticketId, input.ticketIds)) : [];
      const attachedSalidas = input.salidaIds.length ? await tx.select().from(viajeSalidasTable).where(inArray(viajeSalidasTable.salidaId, input.salidaIds)) : [];
      if (attachedTickets.length || attachedSalidas.length) throw new Error("DOCUMENT_ALREADY_ATTACHED");
      const folio = await reserveFolio(tx, input.origenId);
      const [created] = await tx.insert(viajesTable).values({ ...input, folio, creadoPorId: req.auth!.user.id, observaciones: input.observaciones || null }).returning();
      if (input.ticketIds.length) await tx.insert(viajeTicketsTable).values(input.ticketIds.map(ticketId => ({ viajeId: created.id, ticketId })));
      if (input.salidaIds.length) await tx.insert(viajeSalidasTable).values(input.salidaIds.map(salidaId => ({ viajeId: created.id, salidaId })));
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, sitioId: input.origenId, accion: "CREAR", entidad: "viajes", entidadId: String(created.id), datosDespues: { folio, ...input }, ip: getRequestIp(req) });
      return created;
    });
    res.status(201).json(viaje);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el viaje.";
    res.status(message === "VIAJE_LOCATION_FORBIDDEN" ? 403 : ["TRANSPORT_INACTIVE", "INVALID_ORIGIN", "INVALID_TICKET", "INVALID_SALIDA", "DOCUMENT_ALREADY_ATTACHED", "DOCUMENT_ORIGIN_MISMATCH"].includes(message) ? 409 : 400).json({ error: message });
  }
});

router.get("/viajes", requireSession, requierePermiso("viajes", "ver"), async (req, res, next) => {
  try {
    const q = z.object({ fechaDesde: z.coerce.date().optional(), fechaHasta: z.coerce.date().optional(), camionetaId: z.coerce.number().int().positive().optional(), choferId: z.coerce.number().int().positive().optional(), origenId: z.coerce.number().int().positive().optional(), destino: z.string().trim().optional() }).parse(req.query);
    const siteId = requireOwnSite(req.auth!);
    const conditions = [q.fechaDesde && gte(viajesTable.salidaAt, q.fechaDesde), q.fechaHasta && lte(viajesTable.salidaAt, q.fechaHasta), q.camionetaId && eq(viajesTable.camionetaId, q.camionetaId), q.choferId && eq(viajesTable.choferId, q.choferId), (siteId ?? q.origenId) && eq(viajesTable.origenId, siteId ?? q.origenId!)].filter(Boolean) as any[];
    const rows = await db.select({ id: viajesTable.id, folio: viajesTable.folio, salidaAt: viajesTable.salidaAt, origenId: viajesTable.origenId, nombreOrigen: ubicacionesTable.nombre, iniciales: ubicacionesTable.iniciales, camioneta: camionetasTable.nombre, placas: camionetasTable.placas, chofer: choferesTable.nombreCompleto }).from(viajesTable).innerJoin(ubicacionesTable, eq(viajesTable.origenId, ubicacionesTable.id)).innerJoin(camionetasTable, eq(viajesTable.camionetaId, camionetasTable.id)).innerJoin(choferesTable, eq(viajesTable.choferId, choferesTable.id)).where(and(...conditions)).orderBy(desc(viajesTable.salidaAt));
    const details = await buildViajeDetails(rows);
    const destino = q.destino?.toLocaleLowerCase();
    res.json(rows.filter(row => !destino || details.get(row.id)!.destinos.some((value: string) => value.toLocaleLowerCase().includes(destino))).map(row => {
      const { tickets: _tickets, salidas: _salidas, rollos: _rollos, ...summary } = details.get(row.id)!;
      return { ...row, salidaAt: row.salidaAt.toISOString(), folioFormateado: `${row.iniciales}-${String(row.folio).padStart(6, "0")}`, ...summary };
    }));
  } catch (error) { next(error); }
});

router.get("/viajes/:id", requireSession, requierePermiso("viajes", "ver"), async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const [viaje] = await db.select({
      id: viajesTable.id, folio: viajesTable.folio, salidaAt: viajesTable.salidaAt,
      observaciones: viajesTable.observaciones, origenId: viajesTable.origenId,
      nombreOrigen: ubicacionesTable.nombre, iniciales: ubicacionesTable.iniciales,
      camioneta: camionetasTable.nombre, placas: camionetasTable.placas, chofer: choferesTable.nombreCompleto,
    }).from(viajesTable).innerJoin(ubicacionesTable, eq(viajesTable.origenId, ubicacionesTable.id))
      .innerJoin(camionetasTable, eq(viajesTable.camionetaId, camionetasTable.id))
      .innerJoin(choferesTable, eq(viajesTable.choferId, choferesTable.id)).where(eq(viajesTable.id, id)).limit(1);
    if (!viaje) { res.status(404).json({ error: "Viaje no encontrado." }); return; }
    const siteId = requireOwnSite(req.auth!);
    if (siteId != null && viaje.origenId !== siteId) { res.status(403).json({ error: "No puedes consultar viajes de otro origen.", code: "VIAJE_LOCATION_FORBIDDEN" }); return; }
    const details = await buildViajeDetails([viaje]);
    res.json({ ...viaje, salidaAt: viaje.salidaAt.toISOString(), folioFormateado: `${viaje.iniciales}-${String(viaje.folio).padStart(6, "0")}`, ...details.get(viaje.id)! });
  } catch (error) { next(error); }
});

export default router;