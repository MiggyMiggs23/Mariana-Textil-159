import { and, eq, sql } from "drizzle-orm";
import { auditoriasInventarioTable, auditoriaTable, rollosTable, ubicacionesTable } from "@workspace/db";
import { ADVISORY_LOCK_NAMESPACES, transactionAdvisoryLock } from "@workspace/db/advisory-locks";
import { InventarioError, lockInventoryPairs, transferirRolloInmediato, type Tx } from "./inventario";
import { crearSalida, enviarSalida } from "./salidas";
import { assertNoActiveVentaClienteReservation } from "./salida-venta-reservation";
import type { AuditoriaSobranteContexto, AuditoriaSobranteResolucionInput } from "@workspace/api-zod";

type Row = Record<string, unknown>;
const rows = (result: { rows: unknown[] }) => result.rows as Row[];
const numberOrNull = (value: unknown) => value == null ? null : Number(value);
const textOrNull = (value: unknown) => value == null ? null : String(value);

export function prioridadCierreAuditoria(diferencias: { faltantes: number; sobrantes: number; malAcomodados: number }): "NORMAL" | "URGENTE" {
  return diferencias.faltantes + diferencias.sobrantes + diferencias.malAcomodados > 0 ? "URGENTE" : "NORMAL";
}

export function estadoDecisionSobrante(input: {
  decision: string | null; recibido: boolean; salidaEstado: string | null; aplicadaAnteriormente: boolean;
}): AuditoriaSobranteContexto["estadoResolucion"] {
  if ((!input.decision && input.aplicadaAnteriormente) || input.decision === "DEJAR" || (input.decision === "REGRESAR" && input.recibido)) return "RESUELTO";
  if (input.decision === "REGRESAR" && input.salidaEstado === "EN_TRANSITO") return "EN_TRANSITO";
  if (input.decision === "INVESTIGAR") return "EN_INVESTIGACION";
  return "PENDIENTE";
}

export function assertAuditAdmin(rol: string, motivo?: string): void {
  if (rol !== "ADMIN") throw new InventarioError("Solo ADMIN puede decidir sobre estos rollos.", "ADMIN_REQUIRED");
  if (motivo !== undefined && (motivo.trim().length < 10 || motivo.trim().length > 1000)) {
    throw new InventarioError("El motivo debe tener entre 10 y 1000 caracteres.", "JUSTIFICACION_REQUIRED");
  }
}

export function clasificarSobrante(input: {
  existe: boolean; estado: string | null; sitio: number | null; sitioAuditoria: number;
  salidaAbierta: boolean; transitoHaciaSitio: boolean;
}): AuditoriaSobranteContexto["caso"] {
  if (!input.existe) return "SIN_REGISTRO_PREVIO";
  if (input.estado === "VENDIDO") return "VENDIDO_FISICAMENTE_AQUI";
  if (input.estado === "EN_TRANSITO" && input.transitoHaciaSitio) return "EN_TRANSITO_HACIA_SITIO";
  if (input.salidaAbierta) return "APARTADO_SALIDA_ABIERTA";
  if (input.estado === "DISPONIBLE" && input.sitio !== input.sitioAuditoria) return "DISPONIBLE_OTRO_SITIO";
  return "REQUIERE_INVESTIGACION";
}

async function liveSobrante(tx: Tx, auditoriaId: number, sitioId: number, serie: string) {
  const [rollo] = rows(await tx.execute(sql`
    SELECT r.id, r.estado::text estado, r.ubicacion_id, u.nombre ubicacion,
      e.ubicacion_cierre_id, e.ubicacion_cierre, e.estado_cierre
    FROM auditoria_inventario_escaneos e
    LEFT JOIN rollos r ON r.id=e.rollo_id
    LEFT JOIN ubicaciones u ON u.id=r.ubicacion_id
    WHERE e.auditoria_id=${auditoriaId} AND e.serie=${serie}
      AND NOT EXISTS (SELECT 1 FROM auditoria_inventario_snapshot sn
        WHERE sn.auditoria_id=e.auditoria_id AND sn.serie=e.serie)
  `));
  if (!rollo) throw new InventarioError("La serie no es un sobrante de esta auditoría.", "SURPLUS_NOT_FOUND");
  const documents: AuditoriaSobranteContexto["documentos"] = [];
  const salidas = rollo.id == null ? [] : rows(await tx.execute(sql`
    SELECT s.id, s.folio, s.modalidad, s.destino_id, s.estado::text estado,
      u.iniciales, sr.recibido
    FROM salida_rollos sr JOIN salidas s ON s.id=sr.salida_id
    JOIN ubicaciones u ON u.id=s.origen_id
    WHERE sr.rollo_id=${Number(rollo.id)}
      AND ((s.estado IN ('ARMANDO','EN_TRANSITO') AND sr.recibido=false)
        OR (s.modalidad='VENTA_CLIENTE' AND s.estado IN ('EN_TRANSITO','RECIBIDA')))
    ORDER BY s.id
  `));
  for (const salida of salidas) {
    documents.push({ tipo: "SALIDA", id: Number(salida.id), folio: `${salida.iniciales}-${String(salida.folio).padStart(6, "0")}`, href: `/salidas/${salida.id}` });
  }
  if (rollo.estado === "VENDIDO") {
    const [venta] = rows(await tx.execute(sql`
      SELECT documento_tipo, documento_id FROM movimientos
      WHERE rollo_id=${Number(rollo.id)} AND tipo='VENTA'
      ORDER BY id DESC LIMIT 1
    `));
    if (venta?.documento_id != null && /^\d+$/.test(String(venta.documento_id))) {
      const ticketId = Number(venta.documento_id);
      const [ticket] = rows(await tx.execute(sql`
        SELECT t.id, t.folio, u.iniciales FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id
        WHERE t.id=${ticketId}
      `));
      if (ticket && (String(venta.documento_tipo).startsWith("TICKET") || venta.documento_tipo === "NOTA")) {
        documents.push({ tipo: String(venta.documento_tipo), id: ticketId, folio: String(ticket.folio), href: `/tickets/${ticketId}` });
      }
    }
  }
  const caso = clasificarSobrante({
    existe: rollo.id != null, estado: textOrNull(rollo.estado),
    sitio: numberOrNull(rollo.ubicacion_id), sitioAuditoria: sitioId,
    salidaAbierta: salidas.length > 0,
    transitoHaciaSitio: salidas.some((s) => s.modalidad === "TRASLADO" && Number(s.destino_id) === sitioId && s.estado === "EN_TRANSITO"),
  });
  const bloqueo = caso === "SIN_REGISTRO_PREVIO" ? "Sin registro previo: solo se conoce la serie escaneada."
    : caso === "VENDIDO_FISICAMENTE_AQUI" ? "Se cobró mercancía que sigue físicamente aquí. Resolver primero el documento de venta."
      : caso === "APARTADO_SALIDA_ABIERTA" ? "Resolver primero la salida abierta; el rollo está comprometido."
        : caso === "EN_TRANSITO_HACIA_SITIO" ? "Completar primero la recepción desde la salida de traslado."
          : rollo.estado !== "DISPONIBLE" ? "El estado actual requiere investigación antes de mover el rollo."
            : null;
  return { caso, grave: caso === "VENDIDO_FISICAMENTE_AQUI", sitioRegistradoId: numberOrNull(rollo.ubicacion_id), sitioRegistrado: textOrNull(rollo.ubicacion), estadoRegistrado: textOrNull(rollo.estado), documentos: documents, bloqueo };
}

export async function freezeSobranteContextos(tx: Tx, auditoriaId: number, sitioId: number): Promise<void> {
  const extras = rows(await tx.execute(sql`
    SELECT e.serie FROM auditoria_inventario_escaneos e
    WHERE e.auditoria_id=${auditoriaId} AND NOT EXISTS (
      SELECT 1 FROM auditoria_inventario_snapshot s WHERE s.auditoria_id=e.auditoria_id AND s.serie=e.serie)
  `));
  for (const extra of extras) {
    const contexto = await liveSobrante(tx, auditoriaId, sitioId, String(extra.serie));
    await tx.execute(sql`
      INSERT INTO auditoria_sobrante_contextos(auditoria_id,serie,contexto)
      VALUES(${auditoriaId},${String(extra.serie)},${JSON.stringify(contexto)}::jsonb)
      ON CONFLICT DO NOTHING
    `);
  }
}

export async function getSobranteContexto(tx: Tx, auditoriaId: number, sitioId: number, serie: string): Promise<AuditoriaSobranteContexto> {
  const [frozen] = rows(await tx.execute(sql`SELECT contexto FROM auditoria_sobrante_contextos WHERE auditoria_id=${auditoriaId} AND serie=${serie}`));
  const live = await liveSobrante(tx, auditoriaId, sitioId, serie);
  const context = frozen ? frozen.contexto as typeof live : live;
  const history = rows(await tx.execute(sql`
    SELECT d.*, u.nombre usuario, s.estado::text salida_estado, sr.recibido
    FROM auditoria_sobrante_decisiones d JOIN usuarios u ON u.id=d.usuario_id
    LEFT JOIN salidas s ON s.id=d.salida_id
    LEFT JOIN salida_rollos sr ON sr.salida_id=d.salida_id AND sr.rollo_id=d.rollo_id
    WHERE d.auditoria_id=${auditoriaId} AND d.serie=${serie} ORDER BY d.id DESC
  `));
  // A return is an outstanding physical journey, not a UI decision label.
  // Older INVESTIGAR records must not conceal its transit or actual receipt.
  const last = history.find((d) => d.decision === "REGRESAR" && d.salida_estado === "EN_TRANSITO" && d.recibido !== true)
    ?? history.find((d) => d.decision === "REGRESAR" && d.recibido === true)
    ?? history[0];
  const [legacy] = rows(await tx.execute(sql`SELECT resolucion FROM auditoria_inventario_escaneos WHERE auditoria_id=${auditoriaId} AND serie=${serie}`));
  const estadoResolucion = estadoDecisionSobrante({
    decision: textOrNull(last?.decision), recibido: last?.recibido === true,
    salidaEstado: textOrNull(last?.salida_estado), aplicadaAnteriormente: legacy?.resolucion === "APLICADA",
  });
  const documentos = [...context.documentos];
  for (const item of [...live.documentos, ...history.filter((h) => h.salida_id != null).map((h) => ({
    tipo: "SALIDA", id: Number(h.salida_id), folio: `Devolución · salida ${h.salida_id}`, href: `/salidas/${h.salida_id}`,
  }))]) {
    if (!documentos.some((d) => d.tipo === item.tipo && d.id === item.id)) documentos.push(item);
  }
  return {
    ...context, documentos, bloqueo: live.bloqueo ?? (
      frozen && live.sitioRegistradoId !== sitioId && live.sitioRegistradoId !== context.sitioRegistradoId
        ? `El rollo cambió de sitio después del cierre; ahora figura en ${live.sitioRegistrado ?? "otro sitio"}. Investiga antes de regularizar.` : null
    ),
    pendiente: estadoResolucion !== "RESUELTO", estadoResolucion,
    historial: history.map((d) => ({
      id: Number(d.id), decision: String(d.decision), motivo: String(d.motivo),
      usuarioId: Number(d.usuario_id), usuario: String(d.usuario),
      createdAt: new Date(String(d.created_at)), salidaId: numberOrNull(d.salida_id),
    })),
  };
}

export async function resolverSobrante(tx: Tx, input: AuditoriaSobranteResolucionInput & {
  auditoriaId: number; usuarioId: number; rol: string; ip: string;
}): Promise<void> {
  assertAuditAdmin(input.rol, input.motivo);
  await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.INVENTORY_AUDIT_SITE, `resolucion:${input.uuidCliente}`);
  const [header] = await tx.select().from(auditoriasInventarioTable).where(eq(auditoriasInventarioTable.id, input.auditoriaId)).for("update").limit(1);
  if (!header || header.estado !== "CONFIRMADA") throw new InventarioError("Primero confirma y aplica la auditoría; sus sobrantes seguirán pendientes.", "AUDIT_NOT_CONFIRMED");
  const [dup] = rows(await tx.execute(sql`SELECT * FROM auditoria_sobrante_decisiones WHERE uuid_cliente=${input.uuidCliente}::uuid`));
  if (dup) {
    const solicitud = (dup.contexto as { solicitud?: { pisoId: number | null; transportista: string | null } } | null)?.solicitud;
    if (Number(dup.auditoria_id) !== header.id || dup.serie !== input.serie || dup.decision !== input.decision || dup.motivo !== input.motivo.trim() || Number(dup.usuario_id) !== input.usuarioId) {
      throw new InventarioError("El identificador ya se usó para otra decisión.", "UUID_ALREADY_USED");
    }
    if ((solicitud?.pisoId ?? null) !== (input.pisoId ?? null) || (solicitud?.transportista ?? null) !== (input.transportista?.trim() || null)) {
      throw new InventarioError("El identificador ya se usó con otro piso o transportista.", "UUID_ALREADY_USED");
    }
    return;
  }
  const context = await getSobranteContexto(tx, header.id, header.ubicacionId, input.serie);
  if (!context.pendiente) throw new InventarioError("El sobrante ya está resuelto.", "ALREADY_RESOLVED");
  if (context.estadoResolucion === "EN_TRANSITO") throw new InventarioError("La devolución sigue en tránsito: debe recibirla el sitio destino antes de registrar otra decisión.", "RETURN_IN_TRANSIT");
  const [scan] = rows(await tx.execute(sql`
    SELECT e.rollo_id, e.piso_real_id, e.ubicacion_cierre_id FROM auditoria_inventario_escaneos e
    WHERE e.auditoria_id=${header.id} AND e.serie=${input.serie}
  `));
  let salidaId: number | null = null;
  if (input.decision !== "INVESTIGAR") {
    if (!scan?.rollo_id) throw new InventarioError("No hay un rollo registrado que pueda regularizarse.", "UNKNOWN_ROLL");
    if (input.decision === "REGRESAR") {
      if (!input.transportista?.trim()) throw new InventarioError("Indica quién transportará la devolución.", "TRANSPORT_REQUIRED");
      // Match the outbound workflow's global lock order before any roll lock.
      await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.OUTBOUND_DRAFT, `${input.usuarioId}:${header.ubicacionId}`);
      await transactionAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACES.OUTBOUND_IDEMPOTENCY, input.uuidCliente);
      const existingSalida = await tx.execute(sql`SELECT id FROM salidas WHERE uuid_cliente=${input.uuidCliente}::uuid LIMIT 1`);
      if (existingSalida.rows.length) throw new InventarioError("El identificador pertenece a otra salida.", "UUID_ALREADY_USED");
    }
    const [candidate] = await tx.select().from(rollosTable).where(eq(rollosTable.id, Number(scan.rollo_id))).limit(1);
    if (!candidate) throw new InventarioError("Rollo no encontrado.", "ROLLO_NOT_FOUND");
    let origin = numberOrNull(scan.ubicacion_cierre_id) ?? context.sitioRegistradoId;
    if (context.caso === "EN_TRANSITO_HACIA_SITIO") {
      const transfer = context.documentos.find((d) => d.tipo === "SALIDA");
      const [verified] = transfer ? rows(await tx.execute(sql`
        SELECT s.origen_id FROM salidas s JOIN salida_rollos sr ON sr.salida_id=s.id
        WHERE s.id=${transfer.id} AND s.modalidad='TRASLADO' AND s.destino_id=${header.ubicacionId}
          AND sr.rollo_id=${candidate.id}
      `)) : [];
      origin = numberOrNull(verified?.origen_id);
    }
    const [transit] = await tx.select().from(ubicacionesTable).where(and(eq(ubicacionesTable.tipo, "TRANSITO"), eq(ubicacionesTable.activa, true))).limit(1);
    if (input.decision === "REGRESAR" && (origin == null || origin === header.ubicacionId || !transit)) {
      throw new InventarioError("No hay origen distinto verificable o ubicación de tránsito; investiga antes de devolver.", "RETURN_ORIGIN_UNKNOWN");
    }
    await lockInventoryPairs(tx, [
      { productoId: candidate.productoId, ubicacionId: candidate.ubicacionId },
      { productoId: candidate.productoId, ubicacionId: header.ubicacionId },
      ...(input.decision === "REGRESAR" ? [
        { productoId: candidate.productoId, ubicacionId: origin! },
        { productoId: candidate.productoId, ubicacionId: transit!.id },
      ] : []),
    ]);
    // Re-read BEFORE FOR UPDATE: never lock a roll whose current pair is not ours.
    const [refreshed] = await tx.select().from(rollosTable).where(eq(rollosTable.id, candidate.id)).limit(1);
    if (!refreshed || refreshed.productoId !== candidate.productoId || refreshed.ubicacionId !== candidate.ubicacionId || refreshed.estado !== candidate.estado) {
      throw new InventarioError("El rollo cambió mientras se esperaba; vuelve a revisar su situación.", "STALE_ROLL");
    }
    await tx.select().from(rollosTable).where(eq(rollosTable.id, candidate.id)).for("update");
    const current = await getSobranteContexto(tx, header.id, header.ubicacionId, input.serie);
    if (current.bloqueo) throw new InventarioError(current.bloqueo, "DOCUMENT_RESOLUTION_REQUIRED");
    await assertNoActiveVentaClienteReservation(tx, [candidate.id]);
    if (candidate.ubicacionId !== header.ubicacionId) {
      await transferirRolloInmediato(tx, {
        rolloId: candidate.id, ubicacionOrigenId: candidate.ubicacionId, ubicacionDestinoId: header.ubicacionId,
        usuarioId: input.usuarioId, justificacion: `Decisión ADMIN ${input.decision}, auditoría ${header.id}: ${input.motivo.trim()}`,
        documentoTipo: "AUDITORIA_INVENTARIO", documentoId: String(header.id),
        pisoDestinoId: input.pisoId ?? numberOrNull(scan.piso_real_id),
      });
    }
    if (input.decision === "REGRESAR") {
      const salida = await crearSalida(tx, {
        origenId: header.ubicacionId, destinoId: origin!, usuarioSolicitaId: input.usuarioId,
        uuidCliente: input.uuidCliente, rolloIds: [candidate.id], transportista: input.transportista,
        observaciones: `Devolución de sobrante de auditoría ${header.id}: ${input.motivo.trim()}`,
      });
      await enviarSalida(tx, { salidaId: salida.id, usuarioId: input.usuarioId, transportista: input.transportista, notaEnvio: `Auditoría ${header.id}: ${input.motivo.trim()}` });
      salidaId = salida.id;
    }
  }
  await tx.execute(sql`
    INSERT INTO auditoria_sobrante_decisiones(auditoria_id,serie,rollo_id,decision,motivo,usuario_id,salida_id,uuid_cliente,contexto)
    VALUES(${header.id},${input.serie},${numberOrNull(scan?.rollo_id)},${input.decision},${input.motivo.trim()},${input.usuarioId},${salidaId},${input.uuidCliente}::uuid,${JSON.stringify({ ...context, solicitud: { pisoId: input.pisoId ?? null, transportista: input.transportista?.trim() || null } })}::jsonb)
  `);
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId, modulo: "auditoria_inventario", accion: `SOBRANTE_${input.decision}`,
    entidad: "auditorias_inventario", entidadId: String(header.id), sitioId: header.ubicacionId,
    datosDespues: { serie: input.serie, motivo: input.motivo.trim(), salidaId, estado: input.decision === "REGRESAR" ? "EN_TRANSITO" : input.decision === "INVESTIGAR" ? "EN_INVESTIGACION" : "RESUELTO" }, ip: input.ip,
  });
}