import { sql, type SQL } from "drizzle-orm";
import { projectCreditLedger, type CreditLedgerMovement } from "./credit-allocation";
import { crearMovimientoFondoEnTransaccion } from "./fondo";
import { e12FondoExecutor } from "./e12-fondo-executor";
import { E5_ENABLED } from "./e5-feature";
import { e11Identity, e11AssertVersion } from "./e11-repository";
import { e11Capability } from "./e11";
import { e11Runtime } from "./e11-runtime";
import { E5Error, e5Scope, e5Cents, e5Decimal, e5Hash, e5Capabilities, e5View,
  type E5Repository, type E5Actor, type E5Context, type E5Cobro, type E5FuenteDevolucion, type E5Documento } from "./e5";

export type E5Sql = { execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }> };
export type E5Dependencies = {
  /** Always the complete canonical ledger, never immutable applications as balance. */
  ledger(tx: E5Sql, client: number): Promise<CreditLedgerMovement[]>;
  cash(tx: E5Sql, session: Record<string, unknown>): Promise<string>;
};
const author = (a: E5Actor) => ({ id: a.id, nombre: a.nombre });
export function e5DerivedKey(label: string) {
  const h = e5Hash(label);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function lockClient(tx: E5Sql, id: number) {
  // Exact existing ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT (650006), int/int overload.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(650006,${id}::int)`);
}
async function liveActor(tx: E5Sql, actor: E5Actor) {
  if (actor.rol === "CONTADOR") {
    const current = await e11Identity(tx, actor.id);
    e11Capability(current, "E5_PREPARAR");
    if (!actor.capacidadAE11 || actor.e11PerfilVersion === undefined)
      throw new E5Error("E5_FORBIDDEN", "Falta identidad E11 explícita.", 403);
    e11AssertVersion(current, actor.e11PerfilVersion);
  }
  const result = await tx.execute(sql`SELECT id,rol,ubicacion_id FROM usuarios WHERE id=${actor.id} AND activo=true FOR SHARE`);
  const row = result.rows[0];
  if (!row || row.rol !== actor.rol || row.ubicacion_id !== actor.ubicacionId)
    throw new E5Error("E5_FORBIDDEN", "La identidad o alcance del actor cambió.", 403);
}
async function openSession(tx: E5Sql, id: number, site: number) {
  const result = await tx.execute(sql`SELECT s.id,s.ubicacion_id AS "ubicacionId",s.estado,
    s.fondo_inicial AS "fondoInicial",s.efectivo_contado AS "efectivoContado",
    s.abierta_at AS "abiertaAt",s.usuario_id AS "usuarioId",s.fecha_operativa AS "fechaOperativa"
    FROM sesiones_caja s JOIN ubicaciones u ON u.id=s.ubicacion_id
    WHERE s.id=${id} AND s.ubicacion_id=${site} AND s.estado='ABIERTA' AND s.cerrada_at IS NULL
    AND u.tipo='TIENDA' AND u.activa=true FOR UPDATE OF s`);
  if (!result.rows[0]) throw new E5Error("E5_SOURCE_UNAVAILABLE", "Sesión actual no disponible; no se inventa una sesión.");
  return result.rows[0];
}
export async function e5Context(tx: E5Sql, deps: E5Dependencies, client: number, site: number, actor: E5Actor): Promise<E5Context> {
  e5Scope(actor, site);
  await liveActor(tx, actor);
  await lockClient(tx, client);
  const identity = await tx.execute(sql`SELECT c.nombre,u.nombre AS sitio FROM clientes c CROSS JOIN ubicaciones u
    WHERE c.id=${client} AND c.activo=true AND c.es_sistema=false AND u.id=${site}
    AND u.tipo='TIENDA' AND u.activa=true FOR SHARE OF c,u`);
  if (!identity.rows[0]) throw new E5Error("E5_NOT_FOUND", "Cliente o tienda no disponible.", 404);
  const ledger = await deps.ledger(tx, client);
  const projection = projectCreditLedger(ledger);
  const docs = await tx.execute(sql`SELECT t.id,t.folio,t.ubicacion_id,t.facturado,m.id AS movement_id
    FROM tickets t JOIN movimientos_credito m ON m.ticket_id=t.id
    WHERE m.cliente_id=${client} AND m.tipo='VENTA_CREDITO' AND t.documento_tipo='NOTA'
    AND t.estado='VENDIDO' AND t.autorizacion_estado='AUTORIZADA'
    AND (${actor.rol === "ADMIN" || actor.todas} OR t.ubicacion_id=${actor.ubicacionId})
    ORDER BY m.id FOR SHARE OF t,m`);
  const notes = projection.allCharges.flatMap(charge => {
    if (charge.pendienteCents <= 0) return [];
    const doc = docs.rows.find(r => Number(r.movement_id) === charge.movimientoId);
    return doc ? [{ notaId: Number(doc.id), movimientoVentaId: charge.movimientoId, folio: String(doc.folio),
      ubicacionId: Number(doc.ubicacion_id), fecha: charge.createdAt.toISOString(),
      saldoPendiente: e5Decimal(BigInt(charge.pendienteCents)), facturada: doc.facturado === true }] : [];
  }).sort((a, b) => a.movimientoVentaId - b.movimientoVentaId);
  const sessions = actor.rol === "CONTADOR" && actor.capacidadAE11 ? { rows: [] } : await tx.execute(sql`SELECT s.id,s.ubicacion_id AS "ubicacionId",u.nombre AS "ubicacionNombre",
    s.fecha_operativa AS "fechaOperativa" FROM sesiones_caja s JOIN ubicaciones u ON u.id=s.ubicacion_id
    WHERE s.estado='ABIERTA' AND s.cerrada_at IS NULL AND s.ubicacion_id=${site} AND u.activa AND u.tipo='TIENDA' ORDER BY s.id`);
  return { clienteId: client, clienteNombre: String(identity.rows[0].nombre), ubicacionId: site,
    ubicacionNombre: String(identity.rows[0].sitio),
    versionContexto: `e5:v1:${e5Hash({ client, site, notes, ledger: ledger.map(m => ({
      id: m.id, importe: m.importe, tipo: m.tipo, fecha: m.createdAt.toISOString(), destino: m.directedMovimientoId ?? null,
    })) })}`, consultadoAt: e11Runtime().now().toISOString(),
    notas: notes, sesiones: sessions.rows as unknown as E5Context["sesiones"],
    capacidades: e5Capabilities(actor), deudaGlobal: e5Decimal(BigInt(projection.balanceCents)) };
}
/** Every effect uses this caller transaction. No pool/connect/commit/nested transaction. */
export function e5Repository(tx: E5Sql, deps: E5Dependencies): E5Repository {
  return {
    async lockKey(key) { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"E5:" + key},0))`); },
    async replay(key) {
      const result = await tx.execute(sql`SELECT actor_id AS "actorId",content,response FROM e5_operaciones WHERE clave=${key}::uuid
        UNION ALL SELECT actor_id AS "actorId",content,NULL AS response FROM e5_impresiones WHERE clave=${key}::uuid`);
      return result.rows[0] as unknown as Awaited<ReturnType<E5Repository["replay"]>>;
    },
    async load(id, actor) {
      await liveActor(tx, actor);
      const result = await tx.execute(sql`SELECT detail FROM e5_cobros WHERE id=${id}::uuid
        AND (${actor.rol === "ADMIN" || actor.todas} OR ubicacion_id=${actor.ubicacionId}) FOR UPDATE`);
      return result.rows[0]?.detail as E5Cobro | undefined;
    },
    context: (client, site, actor) => e5Context(tx, deps, client, site, actor),
    async sessions(input, actor) {
      e5Scope(actor, input.ubicacionId, true);
      const ids = [...new Set([input.sesionCajaId, input.sesionOperativaId].filter((n): n is number => n !== undefined))].sort((a, b) => a - b);
      for (const id of ids) await openSession(tx, id, input.ubicacionId);
    },
    async receive(detail, input, actor) {
      await liveActor(tx, actor);
      e5Scope(actor, detail.ubicacionId, true);
      if (!e5Capabilities(actor).puedeRecibir || !(input.entrada === "CAJA" ? actor.recibirCaja : actor.recibirCliente))
        throw new E5Error("E5_FORBIDDEN", "Productor de recepción E5 no autorizado.", 403);
      if (detail.id !== input.claveOperacion || detail.clienteId !== input.clienteId ||
          detail.ubicacionId !== input.ubicacionId || detail.importeRecibido !== input.importe ||
          detail.formaPago !== input.formaPago || detail.cuentaDestino !== input.cuentaDestino ||
          detail.sesionCajaId !== input.sesionCajaId || detail.sesionOperativaId !== input.sesionOperativaId ||
          detail.receptor.id !== actor.id || detail.algunaVezAplicado || detail.aplicaciones.length ||
          detail.importeAplicado !== "0.00" || detail.importeDevuelto !== "0.00" ||
          detail.importePendiente !== input.importe || detail.estado !== "PENDIENTE" ||
          e5Cents(input.importe) <= 0n)
        throw new E5Error("E5_STATE_CONFLICT", "La atestación de recepción no coincide con la fuente E1.");
      // Immutable source is the positive attestation permitting ONLY this producer through E1.
      await tx.execute(sql`INSERT INTO e5_recepciones
        (id,cliente_id,ubicacion_id,importe,fecha_recepcion,medio,cuenta_destino,sesion_caja_id,actor_id,snapshot)
        VALUES (${detail.id}::uuid,${detail.clienteId},${detail.ubicacionId},${detail.importeRecibido}::numeric,
        ${detail.fechaRecepcion}::timestamptz,${detail.formaPago},${detail.cuentaDestino},${detail.sesionCajaId ?? null},
        ${actor.id},${JSON.stringify(detail)}::jsonb)`);
      await tx.execute(sql`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
        VALUES ('COBRO_PENDIENTE',${detail.id}::uuid,'INGRESO_FISICO',${actor.id},
        ${JSON.stringify({ productor: "E5", actor: author(actor), input })}::jsonb)`);
      await tx.execute(sql`INSERT INTO cobros_credito_pendientes_e1
        (operacion_productor,operacion_clave,naturaleza,cliente_id,importe,fecha_real,sitio_origen_id,medio,cuenta_destino,
         sesion_caja_id,motivo,referencia,usuario_id)
        VALUES ('COBRO_PENDIENTE',${detail.id}::uuid,'INGRESO_FISICO',${detail.clienteId},${detail.importeRecibido}::numeric,
         ${detail.fechaRecepcion}::timestamptz,${detail.ubicacionId},${detail.formaPago}::forma_pago_cuenta,${detail.cuentaDestino},
         ${detail.sesionCajaId ?? null},${input.evidencia.descripcion},${input.evidencia.referencias.join("; ") || null},${actor.id})`);
    },
    async apply(detail, application, proposal, actor) {
      await liveActor(tx, actor);
      if (actor.rol !== "ADMIN") throw new E5Error("E5_FORBIDDEN", "Solo ADMIN aplica.", 403);
      if (application.actor.id !== actor.id || application.propuestaId !== proposal.id || detail.devolucion ||
          !detail.propuestas.some(p => p.id === proposal.id && e5Hash(p) === e5Hash(proposal)))
        throw new E5Error("E5_STATE_CONFLICT", "Aplicación sin propuesta y actor propietarios.");
      await lockClient(tx, detail.clienteId);
      // Reprojection here is deliberate: the adapter never trusts client or stored application sums.
      const fresh = projectCreditLedger(await deps.ledger(tx, detail.clienteId));
      for (const allocation of application.asignaciones) {
        const charge = fresh.allCharges.find(c => c.movimientoId === allocation.movimientoVentaId && c.ticketId === allocation.notaId);
        if (!charge || BigInt(charge.pendienteCents) < e5Cents(allocation.importe))
          throw new E5Error("E5_NOTA_STALE", "El movimiento exacto ya no admite la aplicación.");
      }
      const favor = e5Cents(application.importeFavorGenerado ?? "0.00");
      const applied = application.asignaciones.reduce((sum, a) => sum + e5Cents(a.importe), 0n);
      if (applied + favor !== e5Cents(application.importe) || applied + favor <= 0n ||
          applied + favor > e5Cents(detail.importePendiente) ||
          new Set(application.asignaciones.map(a => a.movimientoVentaId)).size !== application.asignaciones.length ||
          favor > e5Cents(proposal.importeFavorPropuesto ?? "0.00") ||
          application.asignaciones.some(a => e5Cents(a.importe) <= 0n ||
            !proposal.asignaciones.some(p => p.notaId === a.notaId && p.movimientoVentaId === a.movimientoVentaId &&
              e5Cents(a.importe) <= e5Cents(p.importe))) ||
          proposal.asignaciones.some(p => !fresh.allCharges.some(c => c.movimientoId === p.movimientoVentaId &&
            c.ticketId === p.notaId && c.pendienteCents > 0)))
        throw new E5Error("E5_STATE_CONFLICT", "El productor sin dinero excede o cambia su fuente aprobada.");
      if (favor > 0n && BigInt(fresh.balanceCents) !== applied)
        throw new E5Error("E5_STATE_CONFLICT", "Favor explícito incompatible con deuda global.");
      const pieces = [...application.asignaciones.map(a => ({ ...a, favor: false })),
        ...(favor > 0n ? [{ notaId: 0, movimientoVentaId: 0, importe: e5Decimal(favor), favor: true }] : [])];
      for (const piece of pieces) {
        const key = e5DerivedKey(`E5:APLICACION:${application.id}:${piece.movimientoVentaId}`);
        await tx.execute(sql`INSERT INTO e5_aplicaciones
          (id,cobro_id,grupo_id,propuesta_id,movimiento_venta_id,importe,favor,actor_id,fecha_aplicacion,snapshot)
          VALUES (${key}::uuid,${detail.id}::uuid,${application.id}::uuid,${proposal.id}::uuid,
          ${piece.favor ? null : piece.movimientoVentaId},${piece.importe}::numeric,${piece.favor},${actor.id},
          ${application.fechaAplicacion}::timestamptz,${JSON.stringify(application)}::jsonb)`);
        await tx.execute(sql`INSERT INTO operaciones_credito_e1(productor,clave,naturaleza,usuario_id,solicitud_canonica)
          VALUES ('E5_APLICACION_RETENIDA',${key}::uuid,'OPERACION_CREDITO_SIN_DINERO',${actor.id},
          ${JSON.stringify({ cobroId: detail.id, proposal, application, piece })}::jsonb)`);
        const movement = await tx.execute(sql`INSERT INTO movimientos_credito
          (cliente_id,tipo,importe,usuario_id,created_at,notas,forma_pago,cuenta_destino,naturaleza,
           sitio_origen_id,sesion_caja_id,operacion_productor,operacion_clave,origen_justificacion)
          VALUES (${detail.clienteId},'ABONO',${"-" + piece.importe}::numeric,${actor.id},${application.fechaAplicacion}::timestamptz,
          ${"Aplicación E5 " + detail.id},NULL,NULL,'OPERACION_CREDITO_SIN_DINERO',${detail.ubicacionId},NULL,
          'E5_APLICACION_RETENIDA',${key}::uuid,${"Autorización ADMIN E5 " + application.id}) RETURNING id`);
        const movementId = Number(movement.rows[0]?.id);
        if (!Number.isInteger(movementId) || movementId <= 0) throw new E5Error("E5_STATE_CONFLICT", "Falta movimiento de aplicación.");
        if (!piece.favor) {
          // Canonical directed marker comes ONLY from this real ADMIN-approved request.
          await tx.execute(sql`INSERT INTO solicitudes_pago_dirigido
            (tipo,entidad_id,documento_movimiento_id,importe,forma_pago,cuenta_destino,fecha_efectiva,motivo,
             solicitante_id,solicitante_nombre,autorizador_id,autorizador_nombre,contraparte_nombre,documento_folio,
             ubicacion_id,ubicacion_nombre,movimiento_id,estado,resuelta_at)
            VALUES ('CLIENTE',${detail.clienteId},${piece.movimientoVentaId},${piece.importe}::numeric,
            'APLICACION_SIN_DINERO',NULL,${application.fechaAplicacion}::timestamptz,${"E5 propuesta " + proposal.id},
            ${proposal.actor.id},${proposal.actor.nombre},${actor.id},${actor.nombre},${detail.clienteNombre},
            ${proposal.notas.find(n => n.movimientoVentaId === piece.movimientoVentaId)!.folio},
            ${detail.ubicacionId},${detail.ubicacionNombre},${movementId},'APROBADA',${application.fechaAplicacion}::timestamptz)`);
          await tx.execute(sql`INSERT INTO aplicaciones_credito(abono_movimiento_id,venta_movimiento_id,importe)
            VALUES (${movementId},${piece.movimientoVentaId},${piece.importe}::numeric)`);
        }
        await tx.execute(sql`INSERT INTO e5_vinculos_credito(aplicacion_id,movimiento_id)
          VALUES (${key}::uuid,${movementId})`);
      }
      const final = projectCreditLedger(await deps.ledger(tx, detail.clienteId));
      if (final.balanceCents !== fresh.balanceCents - Number(applied) || final.overpaymentCents !== fresh.overpaymentCents + Number(favor))
        throw new E5Error("E5_STATE_CONFLICT", "La proyección canónica no coincide; se revierte toda la operación.");
    },
    async refund(detail, input, actor) {
      await liveActor(tx, actor);
      await lockClient(tx, detail.clienteId);
      if (actor.rol !== "ADMIN") throw new E5Error("E5_FORBIDDEN", "Solo ADMIN devuelve.", 403);
      const consumed = await tx.execute(sql`SELECT 1 FROM e5_aplicaciones WHERE cobro_id=${detail.id}::uuid
        UNION ALL SELECT 1 FROM e5_devoluciones WHERE cobro_id=${detail.id}::uuid`);
      if (consumed.rows.length) throw new E5Error("E5_REFUND_INELIGIBLE", "La fuente tuvo aplicación o devolución.");
      const source = input.fuente;
      e5Scope(actor, source.ubicacionId, true);
      const sites = await tx.execute(sql`SELECT id,nombre FROM ubicaciones WHERE id=${source.ubicacionId} AND activa AND tipo='TIENDA' FOR SHARE`);
      if (!sites.rows[0]) throw new E5Error("E5_SOURCE_UNAVAILABLE", "Origen actual inválido.");
      let effect: { salidaId?: number; movimientoFondoId?: string } = {};
      if (source.tipo === "CAJA") {
        if (!source.sesionCajaId || source.cuentaOrigen !== "CAJA_FISICA" || source.sesionOperativaId)
          throw new E5Error("E5_VALIDATION", "Selecciona la caja actual explícita.", 400);
        const session = await openSession(tx, source.sesionCajaId, source.ubicacionId);
        const cash = await deps.cash(tx, session);
        if (cash.startsWith("-") || e5Cents(cash) < e5Cents(detail.importeRecibido)) throw new E5Error("E5_INSUFFICIENT_FUNDS", "La caja actual no alcanza; no hay desbloqueo de proveedor.");
        const result = await tx.execute(sql`INSERT INTO salidas_dinero_caja(sesion_caja_id,monto,motivo,cuenta_origen,creado_por_id)
          VALUES (${source.sesionCajaId},${detail.importeRecibido}::numeric,${"Devolución E5 " + detail.id},'CAJA_FISICA',${actor.id}) RETURNING id`);
        effect.salidaId = Number(result.rows[0]?.id);
        if (!Number.isInteger(effect.salidaId)) throw new E5Error("E5_STATE_CONFLICT", "Falta salida física.");
      } else if (source.tipo === "CUENTA") {
        if (!["CUENTA_FISCAL", "CUENTA_NO_FISCAL"].includes(source.cuentaOrigen ?? "") || source.sesionCajaId || source.sesionOperativaId)
          throw new E5Error("E5_VALIDATION", "Transferencia de devolución sin sesión física ni sesión inventada.", 400);
        if (!input.evidencia.referencias.length) throw new E5Error("E5_VALIDATION", "La transferencia requiere referencia del comprobante real.", 400);
        // Bank balance is not fabricated from collection totals. This records an evidenced
        // external transfer, just as existing bank payment producers do, not a bank API call.
        await tx.execute(sql`INSERT INTO e5_salidas_bancarias
          (clave,cobro_id,ubicacion_id,cuenta_origen,importe,actor_id,evidencia)
          VALUES (${input.claveOperacion}::uuid,${detail.id}::uuid,${source.ubicacionId},${source.cuentaOrigen},
          ${detail.importeRecibido}::numeric,${actor.id},${JSON.stringify(input.evidencia)}::jsonb)`);
      } else {
        if (source.sesionCajaId || source.sesionOperativaId || source.cuentaOrigen)
          throw new E5Error("E5_VALIDATION", "Fondo no usa sesión ni cuenta bancaria.", 400);
        const fund = e12FondoExecutor(tx);
        const identity = await tx.execute(sql`SELECT ubicacion_id FROM fondo_mariana`);
        if (identity.rows.length !== 1 || Number(identity.rows[0]!.ubicacion_id) !== source.ubicacionId)
          throw new E5Error("E5_SOURCE_UNAVAILABLE", "Fondo exclusivamente Mariana.");
        const result = await crearMovimientoFondoEnTransaccion(fund, actor, { idempotencyKey: e5DerivedKey(`E5:DEVOLUCION:${input.claveOperacion}`),
          categoria: "RETIRO", importe: detail.importeRecibido, motivo: `Devolución E5 ${detail.id}; petición cliente documentada` });
        if (result.replay) throw new E5Error("E5_STATE_CONFLICT", "Retiro sin replay E5 correspondiente.");
        effect.movimientoFondoId = result.value.id;
      }
      await tx.execute(sql`INSERT INTO e5_devoluciones(clave,cobro_id,actor_id,fuente,importe,peticion,evidencia,salida_id,movimiento_fondo_id)
        VALUES (${input.claveOperacion}::uuid,${detail.id}::uuid,${actor.id},${JSON.stringify(source)}::jsonb,
        ${detail.importeRecibido}::numeric,${input.peticionCliente},${JSON.stringify(input.evidencia)}::jsonb,
        ${effect.salidaId ?? null},${effect.movimientoFondoId ?? null}::uuid)`);
      return effect;
    },
    async save(detail, oldRevision) {
      if (oldRevision === null) {
        await tx.execute(sql`INSERT INTO e5_cobros(id,cliente_id,ubicacion_id,revision,detail)
          VALUES (${detail.id}::uuid,${detail.clienteId},${detail.ubicacionId},${detail.revision},${JSON.stringify(detail)}::jsonb)`);
      } else {
        const result = await tx.execute(sql`UPDATE e5_cobros SET detail=${JSON.stringify(detail)}::jsonb,revision=${detail.revision}
          WHERE id=${detail.id}::uuid AND revision=${oldRevision} RETURNING id`);
        if (result.rows.length !== 1) throw new E5Error("E5_VERSION_STALE", "Revisión concurrente; no se guardó la operación.");
      }
    },
    async document(doc) {
      await tx.execute(sql`INSERT INTO e5_documentos(id,cobro_id,tipo,snapshot) VALUES
        (${doc.id}::uuid,${doc.cobroId}::uuid,${doc.tipo},${JSON.stringify(doc)}::jsonb)`);
    },
    async operation(key, action, content, detail, actor) {
      await tx.execute(sql`INSERT INTO e5_operaciones(clave,cobro_id,revision,accion,actor_id,content,response)
        VALUES (${key}::uuid,${detail.id}::uuid,${detail.revision},${action},${actor.id},${content},${JSON.stringify(detail)}::jsonb)`);
      // Full documentary evidence may contain a Fondo source: keep the global audit private.
      await tx.execute(sql`INSERT INTO auditoria(usuario_id,modulo,accion,entidad,entidad_id,datos_despues,ip)
        VALUES (${actor.id},'FONDO',${"E5_" + action},'e5_cobros',${detail.id},${JSON.stringify(detail)}::jsonb,${actor.ip})`);
    },
  };
}
export async function readE5Cobro(tx: E5Sql, id: string, actor: E5Actor, enabled = E5_ENABLED) {
  if (!enabled) throw new E5Error("E5_DISABLED", "E5 no está habilitado.", 403);
  const result = await tx.execute(sql`SELECT detail FROM e5_cobros WHERE id=${id}::uuid
    AND (${actor.rol === "ADMIN" || actor.todas} OR ubicacion_id=${actor.ubicacionId})`);
  if (!result.rows[0]) throw new E5Error("E5_NOT_FOUND", "Cobro no encontrado.", 404);
  return e5View(result.rows[0].detail as E5Cobro, actor);
}
export async function listE5Cobros(tx: E5Sql, actor: E5Actor, query: {
  ubicacionId: number; clienteId?: number; estado?: string; cursor?: string; limit: number;
}, alerts = false, enabled = E5_ENABLED) {
  if (!enabled) throw new E5Error("E5_DISABLED", "E5 no está habilitado.", 403);
  e5Scope(actor, query.ubicacionId);
  if (alerts && actor.rol !== "ADMIN") throw new E5Error("E5_FORBIDDEN", "Avisos exclusivamente ADMIN.", 403);
  const result = await tx.execute(sql`SELECT id,detail FROM e5_cobros WHERE ubicacion_id=${query.ubicacionId}
    ${query.clienteId ? sql`AND cliente_id=${query.clienteId}` : sql``}
    ${query.estado ? sql`AND detail->>'estado'=${query.estado}` : sql``}
    ${query.cursor ? sql`AND id>${query.cursor}::uuid` : sql``}
    ${alerts ? sql`AND (detail->>'importePendiente')::numeric>0
      AND (detail->>'fechaRecepcion')::timestamptz<=now()-interval '72 hours'` : sql``}
    ORDER BY id LIMIT ${query.limit + 1}`);
  const rows = result.rows.slice(0, query.limit);
  return { items: rows.map(row => e5View(row.detail as E5Cobro, actor)),
    ...(result.rows.length > query.limit ? { nextCursor: String(rows.at(-1)!.id) } : {}) };
}
export async function readE5Document(tx: E5Sql, id: string, document: string, actor: E5Actor, enabled = E5_ENABLED): Promise<E5Documento> {
  if (!enabled) throw new E5Error("E5_DISABLED", "E5 no está habilitado.", 403);
  if (actor.rol !== "ADMIN") throw new E5Error("E5_FORBIDDEN", "Impresión exclusivamente ADMIN desde otro equipo.", 403);
  await readE5Cobro(tx, id, actor, enabled);
  const result = await tx.execute(sql`SELECT snapshot FROM e5_documentos WHERE id=${document}::uuid AND cobro_id=${id}::uuid`);
  if (!result.rows[0]) throw new E5Error("E5_NOT_FOUND", "Documento no encontrado.", 404);
  return result.rows[0].snapshot as E5Documento;
}
export async function e5RefundOptions(tx: E5Sql, id: string, actor: E5Actor, enabled = E5_ENABLED) {
  const detail = await readE5Cobro(tx, id, actor, enabled);
  if (actor.rol !== "ADMIN") throw new E5Error("E5_FORBIDDEN", "Orígenes exclusivamente ADMIN.", 403);
  const eligible = !detail.algunaVezAplicado && !detail.devolucion && detail.importePendiente === detail.importeRecibido;
  const sources: E5FuenteDevolucion[] = [];
  if (eligible) {
    const sessions = await tx.execute(sql`SELECT s.id,s.ubicacion_id FROM sesiones_caja s JOIN ubicaciones u ON u.id=s.ubicacion_id
      WHERE s.estado='ABIERTA' AND s.cerrada_at IS NULL AND u.activa AND u.tipo='TIENDA' ORDER BY s.id`);
    for (const s of sessions.rows) sources.push({ tipo: "CAJA", ubicacionId: Number(s.ubicacion_id), sesionCajaId: Number(s.id), cuentaOrigen: "CAJA_FISICA" });
    for (const account of ["CUENTA_FISCAL", "CUENTA_NO_FISCAL"] as const)
      sources.push({ tipo: "CUENTA", ubicacionId: detail.ubicacionId, cuentaOrigen: account });
    const fund = await tx.execute(sql`SELECT f.ubicacion_id FROM fondo_mariana f JOIN ubicaciones u ON u.id=f.ubicacion_id
      WHERE u.activa AND u.tipo='TIENDA' AND upper(btrim(u.nombre))='MARIANA'`);
    if (fund.rows.length === 1) sources.push({ tipo: "FONDO", ubicacionId: Number(fund.rows[0].ubicacion_id) });
  }
  return { elegible: eligible, importe: detail.importeRecibido, fuentes: sources,
    ...(!eligible ? { motivo: "El importe dejó de ser íntegro nunca aplicado." } : {}) };
}