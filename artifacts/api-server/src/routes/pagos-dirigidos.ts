import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { CreateSolicitudPagoDirigidoBody, CreateSolicitudPagoDirigidoResponse, AprobarSolicitudPagoDirigidoParams, AprobarSolicitudPagoDirigidoResponse, RechazarSolicitudPagoDirigidoParams, RechazarSolicitudPagoDirigidoBody, RechazarSolicitudPagoDirigidoResponse, ListSolicitudesPagoDirigidoResponse } from "@workspace/api-zod";
import {
  aplicacionesCreditoTable,
  aplicacionesPagoProveedorTable,
  auditoriaTable,
  db,
  movimientosCreditoTable,
  pagosProveedorTable,
  solicitudesPagoDirigidoTable,
} from "@workspace/db";
import { requireRole, requireSession } from "../middlewares/auth";
import { resolvePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";

const router: IRouter = Router();
router.use("/pagos-dirigidos", requireSession);

type Kind = "CLIENTE" | "PROVEEDOR";
type Payment = { tipo: Kind; entidadId: number; documentoMovimientoId: number; importe: number; formaPago: string; cuentaDestino?: string | null; fechaEfectiva?: Date | null; referencia?: string | null; notas?: string | null; motivo: string };
const positiveId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
function parsePayment(body: unknown): Payment | null {
  const parsed = CreateSolicitudPagoDirigidoBody.safeParse(body);
  if (!parsed.success || parsed.data.motivo.trim().length < 10) return null;
  return { ...parsed.data, motivo: parsed.data.motivo.trim(), referencia: parsed.data.referencia ?? null, notas: parsed.data.notas ?? null, cuentaDestino: parsed.data.cuentaDestino ?? null, fechaEfectiva: parsed.data.fechaEfectiva ?? null };
}

async function apply(tx: any, request: any, userId: number) {
  const supplier = request.tipo === "PROVEEDOR";
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${supplier ? 240025 : 240024}, ${request.entidadId})`);
  const document = await tx.execute(supplier ? sql`
    SELECT p.id,p.importe::text FROM pagos_proveedor p WHERE p.id=${request.documentoMovimientoId}
      AND p.proveedor_id=${request.entidadId} AND p.tipo='COMPRA' FOR UPDATE`
    : sql`SELECT m.id,m.importe::text FROM movimientos_credito m WHERE m.id=${request.documentoMovimientoId}
      AND m.cliente_id=${request.entidadId} AND m.tipo='VENTA_CREDITO' FOR UPDATE`);
  const doc = document.rows[0];
  if (!doc) throw new Error("DIRECTED_DOCUMENT_NOT_FOUND");
  const used = await tx.execute(supplier ? sql`
    SELECT COALESCE(SUM(a.importe),0)::text total FROM aplicaciones_pago_proveedor a
    JOIN pagos_proveedor p ON p.id=a.pago_proveedor_id
    WHERE a.compra_proveedor_id=${doc.id} AND NOT EXISTS
      (SELECT 1 FROM pagos_proveedor r WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=p.id)`
    : sql`SELECT COALESCE(SUM(a.importe),0)::text total FROM aplicaciones_credito a
    JOIN movimientos_credito m ON m.id=a.abono_movimiento_id
    WHERE a.venta_movimiento_id=${doc.id} AND NOT EXISTS
      (SELECT 1 FROM movimientos_credito r WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=m.id)`);
  const availableCents = Math.round(Number(doc.importe) * 100) - Math.round(Number(used.rows[0]?.total ?? 0) * 100);
  const requestedCents = Math.round(Number(request.importe) * 100);
  if (requestedCents > availableCents) throw new Error("DIRECTED_AMOUNT_EXCEEDS_DOCUMENT");
  const amount = (requestedCents / 100).toFixed(2);
  const [movement] = supplier
    ? await tx.insert(pagosProveedorTable).values({ proveedorId: request.entidadId, importe: `-${amount}`, tipo: "PAGO", formaPago: request.formaPago, referencia: request.referencia, notas: request.notas, fecha: request.fechaEfectiva ? new Date(request.fechaEfectiva) : new Date(), usuarioId: userId }).returning()
    : await tx.insert(movimientosCreditoTable).values({ clienteId: request.entidadId, importe: `-${amount}`, tipo: "ABONO", formaPago: request.formaPago, cuentaDestino: request.cuentaDestino, referencia: request.referencia, notas: request.notas, usuarioId: userId, createdAt: request.fechaEfectiva ? new Date(request.fechaEfectiva) : new Date(), metadata: JSON.stringify({ origen: "PAGO_DIRIGIDO", solicitudId: request.id, motivo: request.motivo }) }).returning();
  if (supplier) await tx.insert(aplicacionesPagoProveedorTable).values({ pagoProveedorId: movement.id, compraProveedorId: doc.id, importe: amount });
  else await tx.insert(aplicacionesCreditoTable).values({ abonoMovimientoId: movement.id, ventaMovimientoId: doc.id, importe: amount });
  return movement;
}

async function snapshots(tx: any, data: Payment, userId: number) {
  const user = await tx.execute(sql`SELECT nombre FROM usuarios WHERE id=${userId}`);
  const document = await tx.execute(data.tipo === "CLIENTE" ? sql`
    SELECT c.nombre contraparte, CONCAT('Nota ',t.folio) folio FROM movimientos_credito m
    JOIN clientes c ON c.id=m.cliente_id JOIN tickets t ON t.id=m.ticket_id
    WHERE m.id=${data.documentoMovimientoId} AND m.cliente_id=${data.entidadId} AND m.tipo='VENTA_CREDITO'`
    : sql`SELECT p.nombre contraparte, CONCAT('Compra ',e.folio) folio FROM pagos_proveedor pp
    JOIN proveedores p ON p.id=pp.proveedor_id LEFT JOIN entradas e ON e.id=pp.entrada_id
    WHERE pp.id=${data.documentoMovimientoId} AND pp.proveedor_id=${data.entidadId} AND pp.tipo='COMPRA'`);
  if (!document.rows[0]) throw new Error("DIRECTED_DOCUMENT_NOT_FOUND");
  return { solicitanteNombre: String(user.rows[0]?.nombre ?? ""), contraparteNombre: String(document.rows[0].contraparte), documentoFolio: String(document.rows[0].folio ?? "Sin folio") };
}

function present(row: any) {
  return {
    id: Number(row.id), tipo: row.tipo, entidadId: Number(row.entidadId ?? row.entidad_id),
    documentoMovimientoId: Number(row.documentoMovimientoId ?? row.documento_movimiento_id),
    importe: String(row.importe), formaPago: row.formaPago ?? row.forma_pago,
    cuentaDestino: row.cuentaDestino ?? row.cuenta_destino ?? null, fechaEfectiva: row.fechaEfectiva ?? row.fecha_efectiva ?? null,
    referencia: row.referencia ?? null, notas: row.notas ?? null, motivo: row.motivo,
    motivoRechazo: row.motivoRechazo ?? row.motivo_rechazo ?? null,
    solicitanteId: Number(row.solicitanteId ?? row.solicitante_id), solicitanteNombre: row.solicitanteNombre ?? row.solicitante_nombre,
    autorizadorId: row.autorizadorId ?? row.autorizador_id ?? null, autorizadorNombre: row.autorizadorNombre ?? row.autorizador_nombre ?? null,
    contraparteNombre: row.contraparteNombre ?? row.contraparte_nombre, documentoFolio: row.documentoFolio ?? row.documento_folio,
    movimientoId: row.movimientoId ?? row.movimiento_id ?? null, estado: row.estado, createdAt: row.createdAt ?? row.created_at,
  };
}

router.get("/", async (req, res, next): Promise<void> => {
  try {
    const raw = req.query as Record<string, unknown>;
    const entityId = raw.entidadId == null ? undefined : positiveId(raw.entidadId);
    const tipo = raw.tipo === "CLIENTE" || raw.tipo === "PROVEEDOR" ? raw.tipo : undefined;
    const estado = raw.estado === "PENDIENTE" || raw.estado === "APROBADA" || raw.estado === "RECHAZADA" ? raw.estado : undefined;
    if ((raw.entidadId != null && !entityId) || (raw.tipo != null && !tipo) || (raw.estado != null && !estado)) { res.status(400).json({ error: "Filtros inválidos." }); return; }
    const filters = { entidadId: entityId, tipo, estado };
    let visible: Kind[] = ["CLIENTE", "PROVEEDOR"];
    if (req.auth!.user.rol !== "ADMIN") {
      const [cliente, proveedor] = await Promise.all([
        resolvePermiso(req.auth!.user.id, req.auth!.user.rol, "clientes_finanzas"),
        resolvePermiso(req.auth!.user.id, req.auth!.user.rol, "proveedores_finanzas"),
      ]);
      visible = ([cliente?.puedeVer || cliente?.puedeCrear ? "CLIENTE" : null, proveedor?.puedeVer || proveedor?.puedeCrear ? "PROVEEDOR" : null].filter(Boolean) as Kind[]);
    }
    if (!visible.length) { res.json(ListSolicitudesPagoDirigidoResponse.parse({ solicitudes: [] })); return; }
    const rows = await db.execute(sql`SELECT * FROM solicitudes_pago_dirigido WHERE tipo = ANY(ARRAY[${sql.join(visible.map((v) => sql`${v}`), sql`, `)}]::tipo_solicitud_pago_dirigido[])
      ${filters.tipo ? sql`AND tipo=${filters.tipo}` : sql``}
      ${filters.entidadId ? sql`AND entidad_id=${filters.entidadId}` : sql``}
      ${filters.estado ? sql`AND estado=${filters.estado}` : sql``}
      ${req.auth!.user.rol === "ADMIN" ? sql`` : sql`AND solicitante_id=${req.auth!.user.id}`}
      ORDER BY created_at DESC, id DESC`);
    res.json(ListSolicitudesPagoDirigidoResponse.parse({ solicitudes: rows.rows.map(present) }));
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next): Promise<void> => {
  try {
    const data = parsePayment(req.body);
    if (!data) { res.status(400).json({ error: "Datos inválidos; motivo de al menos 10 caracteres es obligatorio." }); return; }
    if (req.auth!.user.rol !== "ADMIN") {
      const permission = await resolvePermiso(req.auth!.user.id, req.auth!.user.rol, data.tipo === "CLIENTE" ? "clientes_finanzas" : "proveedores_finanzas");
      if (!permission?.puedeCrear) { res.status(403).json({ error: "No tienes permiso para solicitar este pago dirigido." }); return; }
    }
    const effectiveDate = data.fechaEfectiva ? new Date(data.fechaEfectiva) : new Date();
    if (Number.isNaN(effectiveDate.getTime()) || effectiveDate > new Date() || Math.round(data.importe * 100) < 1) { res.status(400).json({ error: "Fecha efectiva inválida o futura, o monto menor a un centavo." }); return; }
    const valid = data.tipo === "CLIENTE"
      ? ["EFECTIVO", "TRANSFERENCIA"].includes(data.formaPago) && ((data.formaPago === "EFECTIVO" && data.cuentaDestino === "CAJA_FISICA") || (data.formaPago === "TRANSFERENCIA" && ["CUENTA_FISCAL", "CUENTA_NO_FISCAL"].includes(data.cuentaDestino ?? "")))
      : ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "OTRO"].includes(data.formaPago);
    if (!valid || (data.tipo === "CLIENTE" && data.formaPago === "TRANSFERENCIA" && !data.referencia)) { res.status(400).json({ error: "Forma de pago, cuenta destino o referencia inválida." }); return; }
    const result = await db.transaction(async (tx) => {
      const isAdmin = req.auth!.user.rol === "ADMIN";
      const snapshot = await snapshots(tx, data, req.auth!.user.id);
      const [request] = await tx.insert(solicitudesPagoDirigidoTable).values({
        ...data, importe: data.importe.toFixed(2), solicitanteId: req.auth!.user.id,
        ...snapshot, estado: "PENDIENTE",
      }).returning();
      const movement = isAdmin ? await apply(tx, request!, req.auth!.user.id) : null;
      let saved = request!;
      if (movement) {
        const authorizer = await tx.execute(sql`SELECT nombre FROM usuarios WHERE id=${req.auth!.user.id}`);
        [saved] = await tx.update(solicitudesPagoDirigidoTable).set({ estado: "APROBADA", autorizadorId: req.auth!.user.id, autorizadorNombre: String(authorizer.rows[0]?.nombre ?? ""), movimientoId: movement.id, resueltaAt: new Date() }).where(sql`${solicitudesPagoDirigidoTable.id}=${request!.id}`).returning();
      }
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: isAdmin ? "APROBAR_APLICAR_PAGO_DIRIGIDO" : "SOLICITAR_PAGO_DIRIGIDO", entidad: "solicitudes_pago_dirigido", entidadId: String(request!.id), datosDespues: { ...data, movimientoId: movement?.id ?? null }, ip: getRequestIp(req) });
      return { request: saved, movement };
    });
    res.status(201).json(CreateSolicitudPagoDirigidoResponse.parse(present(result.request)));
  } catch (error) {
    if (error instanceof Error && error.message === "DIRECTED_DOCUMENT_NOT_FOUND") { res.status(404).json({ error: "Documento no encontrado." }); return; }
    if (error instanceof Error && error.message === "DIRECTED_AMOUNT_EXCEEDS_DOCUMENT") { res.status(409).json({ error: "El monto excede el saldo del documento." }); return; }
    next(error);
  }
});

router.post("/:id/aprobar", requireRole("ADMIN"), async (req, res, next): Promise<void> => {
  try {
    const params = AprobarSolicitudPagoDirigidoParams.safeParse(req.params); if (!params.success) { res.status(400).json({ error: params.error.message }); return; } const id = params.data.id;
    const result = await db.transaction(async (tx) => {
      const found = await tx.execute<any>(sql`SELECT * FROM solicitudes_pago_dirigido WHERE id=${id} FOR UPDATE`);
      const request = found.rows[0]; if (!request) throw new Error("REQUEST_NOT_FOUND");
      if (request.estado !== "PENDIENTE") throw new Error("REQUEST_ALREADY_RESOLVED");
      const movement = await apply(tx, { ...request, entidadId: Number(request.entidad_id), documentoMovimientoId: Number(request.documento_movimiento_id), importe: Number(request.importe), formaPago: request.forma_pago, cuentaDestino: request.cuenta_destino, fechaEfectiva: request.fecha_efectiva, referencia: request.referencia, notas: request.notas }, req.auth!.user.id);
      const authorizer = await tx.execute(sql`SELECT nombre FROM usuarios WHERE id=${req.auth!.user.id}`);
      await tx.update(solicitudesPagoDirigidoTable).set({ estado: "APROBADA", autorizadorId: req.auth!.user.id, autorizadorNombre: String(authorizer.rows[0]?.nombre ?? ""), movimientoId: movement.id, resueltaAt: new Date() }).where(sql`${solicitudesPagoDirigidoTable.id}=${id}`);
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: "APROBAR_APLICAR_PAGO_DIRIGIDO", entidad: "solicitudes_pago_dirigido", entidadId: String(id), datosDespues: { movimientoId: movement.id }, ip: getRequestIp(req) });
      return movement;
    });
    res.status(201).json(AprobarSolicitudPagoDirigidoResponse.parse({ solicitudId: id, movimientoId: result.id, estado: "APROBADA" }));
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_NOT_FOUND") { res.status(404).json({ error: "Solicitud no encontrada." }); return; }
    if (error instanceof Error && error.message === "REQUEST_ALREADY_RESOLVED") { res.status(409).json({ error: "La solicitud ya fue resuelta." }); return; }
    if (error instanceof Error && error.message === "DIRECTED_DOCUMENT_NOT_FOUND") { res.status(404).json({ error: "Documento no encontrado." }); return; }
    if (error instanceof Error && error.message === "DIRECTED_AMOUNT_EXCEEDS_DOCUMENT") { res.status(409).json({ error: "El monto excede el saldo del documento." }); return; }
    next(error);
  }
});

router.post("/:id/rechazar", requireRole("ADMIN"), async (req, res, next): Promise<void> => {
  try {
    const params = RechazarSolicitudPagoDirigidoParams.safeParse(req.params); if (!params.success) { res.status(400).json({ error: params.error.message }); return; } const id = params.data.id;
    const body = RechazarSolicitudPagoDirigidoBody.safeParse(req.body);
    if (!body.success || body.data.motivoRechazo.trim().length < 10) { res.status(400).json({ error: "El motivo de rechazo debe tener al menos 10 caracteres." }); return; }
    const row = await db.transaction(async (tx) => {
      const before = await tx.execute(sql`SELECT * FROM solicitudes_pago_dirigido WHERE id=${id} FOR UPDATE`);
      if (!before.rows[0]) throw new Error("REQUEST_NOT_FOUND");
      const authorizer = await tx.execute(sql`SELECT nombre FROM usuarios WHERE id=${req.auth!.user.id}`);
      const updated = await tx.update(solicitudesPagoDirigidoTable).set({ estado: "RECHAZADA", autorizadorId: req.auth!.user.id, autorizadorNombre: String(authorizer.rows[0]?.nombre ?? ""), motivoRechazo: body.data.motivoRechazo.trim(), resueltaAt: new Date() }).where(sql`${solicitudesPagoDirigidoTable.id}=${id} AND ${solicitudesPagoDirigidoTable.estado}='PENDIENTE'`).returning();
      if (!updated[0]) throw new Error("REQUEST_NOT_PENDING");
      await tx.insert(auditoriaTable).values({ usuarioId: req.auth!.user.id, accion: "RECHAZAR_PAGO_DIRIGIDO", entidad: "solicitudes_pago_dirigido", entidadId: String(id), datosAntes: before.rows[0], datosDespues: present(updated[0]), ip: getRequestIp(req) });
      return updated[0];
    });
    res.json(RechazarSolicitudPagoDirigidoResponse.parse(present(row)));
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_NOT_FOUND") { res.status(404).json({ error: "Solicitud no encontrada." }); return; }
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") { res.status(409).json({ error: "La solicitud no está pendiente." }); return; }
    next(error);
  }
});

export default router;