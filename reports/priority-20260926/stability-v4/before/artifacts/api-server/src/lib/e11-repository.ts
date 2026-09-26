import { sql } from "drizzle-orm";
import type { E5Sql } from "./e5-repository";
import { createE11Runtime, e11Runtime, type E11RuntimeOptions } from "./e11-runtime";
import { E11Error, E11OutcomeError, e11Capability, e11Hash, e11Money, e11Cents, e11Period, e11Range,
  e11Date, e11LocalDate, e11Advance, type E11Identity, type E11PeriodType } from "./e11";
import { accountedDocumentAt, accountedDocumentPredicate } from "./accounted-document";
import { projectCreditLedger } from "./credit-allocation";
import { e5Command, type E5Actor } from "./e5";
import { e5Context, e5Repository, type E5Dependencies } from "./e5-repository";
import { z } from "zod";
import type { AssignE11PerfilBody, CreateE11ConciliacionBody, DecideE11ConciliacionBody, PrepareE11AplicacionBody } from "@workspace/api-zod";

export type E11Sql = E5Sql;
type ProfileInput = z.infer<typeof AssignE11PerfilBody>;
type SnapshotInput = z.infer<typeof CreateE11ConciliacionBody>;
type DecisionInput = z.infer<typeof DecideE11ConciliacionBody>;
type PreparationInput = z.infer<typeof PrepareE11AplicacionBody>;
const iso = (value: unknown) => new Date(value as string | Date).toISOString();
const randomUUID = () => e11Runtime().uuid();
const gate = (enabled: boolean) => { if (!enabled) throw new E11Error("E11_DISABLED", "E11 no está habilitado.", 403); };
export async function e11SecurityLock(tx: E11Sql, exclusive = false) {
  if (!e11Runtime().flags.enabled) return;
  await tx.execute(exclusive
    ? sql`SELECT pg_advisory_xact_lock(hashtextextended('E11:security',0))`
    : sql`SELECT pg_advisory_xact_lock_shared(hashtextextended('E11:security',0))`);
}
export async function e11Identity(tx: E11Sql, userId: number, sessionId?: string): Promise<E11Identity> {
  gate(e11Runtime().flags.enabled);
  await e11SecurityLock(tx);
  const user = (await tx.execute(sql`SELECT id,rol,activo FROM usuarios WHERE id=${userId} FOR SHARE`)).rows[0];
  if (!user || !user.activo) throw new E11Error("NO_AUTENTICADO", "La cuenta no está vigente.", 401);
  if (sessionId) {
    const now = e11Runtime().now();
    const session = (await tx.execute(sql`SELECT id FROM sesiones WHERE id=${sessionId}::uuid
      AND usuario_id=${userId} AND expira_at>${now.toISOString()}::timestamptz
      AND created_at>${new Date(now.getTime() - 16 * 3600000).toISOString()}::timestamptz FOR SHARE`)).rows[0];
    if (!session) throw new E11Error("NO_AUTENTICADO", "La sesión no está vigente.", 401);
  }
  const row = (await tx.execute(sql`SELECT perfil,version FROM e11_perfiles WHERE usuario_id=${userId} FOR SHARE`)).rows[0];
  const perfil = user.rol === "CONTADOR" ? (row?.perfil === "A" ? "A" : "F") : null;
  const capacidades = user.rol === "ADMIN"
    ? ["FISCAL_LEER", "FINANZAS_LIMITADAS_LEER", ...(e11Runtime().flags.profiles ? ["PERFILES_ADMINISTRAR"] : [])]
    : perfil === "F" ? ["FISCAL_LEER", ...(e11Runtime().flags.reconciliation ? ["FISCAL_CONCILIAR"] : [])]
    : perfil === "A" ? ["FINANZAS_LIMITADAS_LEER",
      ...(e11Runtime().flags.preparation && e11Runtime().flags.e5Enabled && e11Runtime().flags.e5ContadorA ? ["E5_PREPARAR"] : [])] : [];
  return { usuarioId: userId, rolBase: String(user.rol), perfil, perfilVersion: Number(row?.version ?? 0),
    permisosVersion: e11Hash({ perfil, version: row?.version ?? 0, capacidades }), capacidades };
}
export function e11AssertVersion(identity: E11Identity, expected: number) {
  if (identity.perfilVersion !== expected) throw new E11Error("PERFIL_CAMBIADO", "El perfil cambió; descarta la intención anterior.");
}
async function freshCommandActor(tx: E11Sql, actor: E11Identity, capability: string) {
  const current = await e11Identity(tx, actor.usuarioId);
  e11Capability(current, capability);
  if (e11Hash(current) !== e11Hash(actor)) throw new E11Error("PERFIL_CAMBIADO", "La identidad de la intención perdió vigencia.");
  return current;
}
/** Shared by HTTP auth; no sidecar access or additional users columns while OFF. */
export async function e11AuthIdentity(userId: number, sessionId: string) {
  if (!e11Runtime().flags.enabled) return undefined;
  return e11Runtime().transaction(tx => e11Identity(tx, userId, sessionId));
}
export async function e11Replay<T>(tx: E11Sql, actor: E11Identity, operation: string, uuid: string,
  input: unknown, work: () => Promise<T>): Promise<T> {
  const key = `${actor.usuarioId}:${operation}:${uuid.toLowerCase()}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"E11:" + key},0))`);
  const hash = e11Hash(input);
  const prior = (await tx.execute(sql`SELECT solicitud_hash,respuesta,estado FROM e11_operaciones
    WHERE actor_id=${actor.usuarioId} AND operacion=${operation} AND uuid=${uuid}::uuid`)).rows[0];
  if (prior) {
    if (prior.estado === "CERRADA_SIN_EFECTO")
      throw new E11Error("OPERACION_CERRADA_SIN_EFECTO", "ADMIN cerró esta intención sin efecto; no puede ejecutarse.");
    if (prior.solicitud_hash !== hash) throw new E11Error("UUID_REUTILIZADO", "UUID utilizado para otra intención.");
    return prior.respuesta as T;
  }
  const result = await work();
  await tx.execute(sql`INSERT INTO e11_operaciones(actor_id,operacion,uuid,solicitud_hash,respuesta)
    VALUES (${actor.usuarioId},${operation},${uuid}::uuid,${hash},${JSON.stringify(result)}::jsonb)`);
  return result;
}
export async function e11AssignProfile(tx: E11Sql, actor: E11Identity, userId: number, input: ProfileInput) {
  gate(e11Runtime().flags.profiles);
  await e11SecurityLock(tx, true);
  actor = await freshCommandActor(tx, actor, "PERFILES_ADMINISTRAR");
  if (actor.rolBase !== "ADMIN") throw new E11Error("ADMIN_REQUERIDO", "Sólo ADMIN real asigna perfiles.", 403);
  if (!input.motivo.trim()) throw new E11Error("VALIDACION", "Motivo obligatorio.", 400);
  return e11Replay(tx, actor, "PERFIL", input.uuid, { userId, input }, async () => {
    const target = (await tx.execute(sql`SELECT id,rol,activo FROM usuarios WHERE id=${userId} FOR UPDATE`)).rows[0];
    if (!target || !target.activo || target.rol !== "CONTADOR")
      throw new E11Error("USUARIO_NO_CONTADOR", "El destinatario debe ser un CONTADOR activo.", 422);
    const prior = (await tx.execute(sql`SELECT perfil,version FROM e11_perfiles WHERE usuario_id=${userId} FOR UPDATE`)).rows[0];
    if (Number(prior?.version ?? 0) !== input.revisionEsperada)
      throw new E11Error("REVISION_OBSOLETA", "La versión del destinatario cambió.");
    const revision = input.revisionEsperada + 1;
    const event = { id: randomUUID(), uuid: input.uuid, usuarioId: userId, actorId: actor.usuarioId,
      anterior: prior?.perfil ?? "F", posterior: input.perfil, revision, motivo: input.motivo.trim(), creadoEn: e11Runtime().now().toISOString() };
    await tx.execute(sql`INSERT INTO e11_perfiles(usuario_id,perfil,version,actor_id,updated_at)
      VALUES (${userId},${input.perfil},${revision},${actor.usuarioId},${event.creadoEn}::timestamptz)
      ON CONFLICT(usuario_id) DO UPDATE SET perfil=excluded.perfil,version=excluded.version,
      actor_id=excluded.actor_id,updated_at=excluded.updated_at`);
    await e11WriteProfileEvent(tx, event);
    return event;
  });
}
async function e11WriteProfileEvent(tx: E11Sql, event: Record<string, unknown>) {
  await tx.execute(sql`INSERT INTO e11_perfil_eventos(id,usuario_id,actor_id,revision,uuid,datos)
    VALUES (${event.id}::uuid,${event.usuarioId},${event.actorId},${event.revision},${event.uuid}::uuid,${JSON.stringify(event)}::jsonb)`);
}
/** Call before UPDATE usuarios in the same transaction; exclusive security lock must precede all row locks. */
export async function e11UserRoleChange(tx: E11Sql, userId: number, nextRole: string, nextActive: boolean, actorId: number) {
  if (!e11Runtime().flags.enabled) return;
  await e11SecurityLock(tx, true);
  const current = (await tx.execute(sql`SELECT rol,activo FROM usuarios WHERE id=${userId} FOR UPDATE`)).rows[0];
  if (!current || (current.rol === nextRole && current.activo === nextActive)) return;
  if (current.rol !== "CONTADOR" && nextRole !== "CONTADOR") return;
  const prior = (await tx.execute(sql`SELECT perfil,version FROM e11_perfiles WHERE usuario_id=${userId} FOR UPDATE`)).rows[0];
  const profile = nextRole === "CONTADOR" && nextActive ? "F" : null;
  const revision = Number(prior?.version ?? 0) + 1;
  const event = { id: randomUUID(), uuid: randomUUID(), usuarioId: userId, actorId,
    anterior: current.rol === "CONTADOR" ? prior?.perfil ?? "F" : null, posterior: profile,
    revision, motivo: "Revocación por cambio de rol o actividad; reingreso sin recuperar A.", creadoEn: e11Runtime().now().toISOString() };
  await tx.execute(sql`INSERT INTO e11_perfiles(usuario_id,perfil,version,actor_id,updated_at)
    VALUES (${userId},${profile},${revision},${actorId},${event.creadoEn}::timestamptz)
    ON CONFLICT(usuario_id) DO UPDATE SET perfil=excluded.perfil,version=excluded.version,
    actor_id=excluded.actor_id,updated_at=excluded.updated_at`);
  await e11WriteProfileEvent(tx, event);
}
export async function e11ProfileHistory(tx: E11Sql, userId: number) {
  const exists = (await tx.execute(sql`SELECT id FROM usuarios WHERE id=${userId}`)).rows[0];
  if (!exists) throw new E11Error("NO_ENCONTRADO", "Usuario no encontrado.", 404);
  return (await tx.execute(sql`SELECT datos FROM e11_perfil_eventos WHERE usuario_id=${userId} ORDER BY revision,id`))
    .rows.map(row => row.datos);
}
export type E11FiscalSale = {
  facturaId: number; ventaId: number; folioFactura: string; cliente: { clienteId: number; nombre: string };
  fechaFacturacion: string; totalFacturado: string; moneda: "MXN"; estado: "VIGENTE" | "CANCELADA";
};
export async function e11FiscalSales(tx: E11Sql, desde?: string, hasta?: string, clienteId?: number) {
  const range = desde && hasta ? e11Range(desde, hasta) : undefined;
  const rows = (await tx.execute(sql`SELECT t.id,t.folio,t.cliente_id,c.nombre,t.total::text,
    ${sql.raw(accountedDocumentAt("t"))} AS fecha
    FROM tickets t JOIN clientes c ON c.id=t.cliente_id
    WHERE t.facturado=true AND ${sql.raw(accountedDocumentPredicate("t"))}
    ${range ? sql`AND ${sql.raw(accountedDocumentAt("t"))}>=${range.start.toISOString()}::timestamptz
      AND ${sql.raw(accountedDocumentAt("t"))}<${range.end.toISOString()}::timestamptz` : sql``}
    ${clienteId ? sql`AND t.cliente_id=${clienteId}` : sql``} ORDER BY t.id`)).rows;
  const items: E11FiscalSale[] = rows.map(row => ({ facturaId: Number(row.id), ventaId: Number(row.id),
    folioFactura: String(row.folio), cliente: { clienteId: Number(row.cliente_id), nombre: String(row.nombre) },
    fechaFacturacion: iso(row.fecha), totalFacturado: String(row.total), moneda: "MXN", estado: "VIGENTE" }));
  return { items, fuenteRevision: e11Hash(items),
    totalFacturado: e11Money(items.reduce((sum, item) => sum + e11Cents(item.totalFacturado), 0n)) };
}
export async function e11FiscalClients(tx: E11Sql) {
  return (await tx.execute(sql`SELECT DISTINCT c.id,c.nombre FROM clientes c JOIN tickets t ON t.cliente_id=c.id
    WHERE t.facturado=true AND ${sql.raw(accountedDocumentPredicate("t"))} ORDER BY c.id`)).rows
    .map(row => ({ clienteId: Number(row.id), nombre: String(row.nombre) }));
}
export async function e11FinanceClient(tx: E11Sql, id: number) {
  const row = (await tx.execute(sql`SELECT id,nombre,telefono,correo,limite_credito::text FROM clientes
    WHERE id=${id} AND es_sistema=false`)).rows[0];
  if (!row) throw new E11Error("NO_ENCONTRADO", "Cliente no encontrado.", 404);
  const ledger = await e11Runtime().ledger(tx, id);
  const projection = projectCreditLedger(ledger);
  return { cliente: { clienteId: Number(row.id), nombre: String(row.nombre),
    contacto: row.telefono == null ? row.correo == null ? null : String(row.correo) : String(row.telefono),
    limiteCredito: String(row.limite_credito), saldo: e11Money(BigInt(projection.balanceCents)) }, ledger, projection };
}
export async function e11FinanceClients(tx: E11Sql) {
  const ids = (await tx.execute(sql`SELECT id FROM clientes WHERE es_sistema=false ORDER BY id`)).rows;
  const result = [];
  for (const row of ids) result.push((await e11FinanceClient(tx, Number(row.id))).cliente);
  return result;
}
export async function e11FinanceNotes(tx: E11Sql, id: number) {
  const data = await e11FinanceClient(tx, id);
  const docs = (await tx.execute(sql`SELECT t.id,t.folio,t.facturado,t.total::text,m.id AS movimiento
    FROM tickets t JOIN movimientos_credito m ON m.ticket_id=t.id AND m.tipo='VENTA_CREDITO'
    WHERE m.cliente_id=${id} AND t.documento_tipo='NOTA' AND ${sql.raw(accountedDocumentPredicate("t"))}
    ORDER BY m.id`)).rows;
  return docs.map(row => {
    const charge = data.projection.allCharges.find(c => c.movimientoId === Number(row.movimiento));
    if (!charge) throw new E11Error("DEPENDENCIA_NO_DISPONIBLE", "Nota sin cargo canónico.", 503);
    return { notaId: Number(row.id), movimientoVentaId: Number(row.movimiento), folio: String(row.folio),
      clienteId: id, fecha: charge.createdAt.toISOString(), facturada: row.facturado === true,
      total: String(row.total), saldo: e11Money(BigInt(charge.pendienteCents)) };
  });
}
export async function e11FinanceStatement(tx: E11Sql, id: number) {
  const data = await e11FinanceClient(tx, id);
  return { cliente: data.cliente, items: data.ledger.map(m => ({
    id: m.id, tipo: m.tipo === "VENTA_CREDITO" ? "VENTA" : m.tipo,
    fechaEfectiva: e11LocalDate(m.createdAt), importe: Number(m.importe).toFixed(2), notaId: m.ticketId,
  })) };
}
type Snapshot = {
  id: string; uuid: string; periodo: ReturnType<typeof e11Period>; revision: number; anteriorId: string | null;
  fuenteRevision: string; vigente: boolean; congeladoEn: string; actorId: number; totalFacturado: string;
  cantidadVentas: number; evidenciaHash: string; decisiones: Decision[];
};
type Decision = {
  id: string; uuid: string; actorId: number; creadoEn: string; resultado: "ACEPTADA" | "NO_CUADRA";
  totalExterno: string; referenciaExterna: string; observacion: string; avisoAdminId: string | null;
};
export async function e11Snapshot(tx: E11Sql, id: string): Promise<Snapshot> {
  const row = (await tx.execute(sql`SELECT datos FROM e11_conciliaciones WHERE id=${id}::uuid`)).rows[0];
  if (!row) throw new E11Error("NO_ENCONTRADO", "Conciliación no encontrada.", 404);
  const snapshot = structuredClone(row.datos as Snapshot);
  snapshot.decisiones = (await tx.execute(sql`SELECT datos FROM e11_decisiones WHERE conciliacion_id=${id}::uuid ORDER BY created_at,id`))
    .rows.map(r => r.datos as Decision);
  const current = await e11FiscalSales(tx, snapshot.periodo.inicio, snapshot.periodo.finExclusivo);
  const latest = (await tx.execute(sql`SELECT id FROM e11_conciliaciones WHERE tipo=${snapshot.periodo.tipo}
    AND inicio=${snapshot.periodo.inicio}::date ORDER BY revision DESC LIMIT 1`)).rows[0];
  snapshot.vigente = latest?.id === id && current.fuenteRevision === snapshot.fuenteRevision;
  snapshot.periodo.ultimaConciliacionId = String(latest?.id ?? id);
  snapshot.periodo.estado = !snapshot.vigente ? "REQUIERE_REVISION" :
    snapshot.decisiones.at(-1)?.resultado ?? "CONGELADO";
  return snapshot;
}
export async function e11SnapshotSales(tx: E11Sql, id: string) {
  const snapshot = await e11Snapshot(tx, id);
  const items = (await tx.execute(sql`SELECT datos FROM e11_conciliacion_ventas WHERE conciliacion_id=${id}::uuid ORDER BY venta_id`))
    .rows.map(r => r.datos as E11FiscalSale);
  if (e11Hash(items) !== snapshot.evidenciaHash)
    throw new E11Error("DEPENDENCIA_NO_DISPONIBLE", "La evidencia congelada no coincide.", 503);
  return { items, fuenteRevision: snapshot.fuenteRevision, totalFacturado: snapshot.totalFacturado };
}
export async function e11CreateSnapshot(tx: E11Sql, actor: E11Identity, input: SnapshotInput) {
  gate(e11Runtime().flags.reconciliation);
  actor = await freshCommandActor(tx, actor, "FISCAL_CONCILIAR"); e11AssertVersion(actor, input.perfilVersion);
  return e11Replay(tx, actor, "SNAPSHOT", input.uuid, input, async () => {
    const period = e11Period(input.tipo, input.inicio, e11Runtime().now());
    if (period.estado === "ABIERTO") throw new E11Error("PERIODO_ABIERTO", "El periodo aún no termina.");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"E11:period:" + input.tipo + input.inicio},0))`);
    const last = (await tx.execute(sql`SELECT id,revision FROM e11_conciliaciones WHERE tipo=${input.tipo}
      AND inicio=${input.inicio}::date ORDER BY revision DESC LIMIT 1`)).rows[0];
    if ((last?.id ?? null) !== input.revisionAnteriorId) throw new E11Error("REVISION_OBSOLETA", "Debe enlazar la última revisión.");
    const source = await e11FiscalSales(tx, period.inicio, period.finExclusivo);
    if (source.fuenteRevision !== input.fuenteRevision) throw new E11Error("FUENTE_CAMBIADA", "Cambió el conjunto facturado.");
    const id = randomUUID();
    const snapshot: Snapshot = { id, uuid: input.uuid, periodo: { ...period, estado: "CONGELADO", ultimaConciliacionId: id },
      revision: Number(last?.revision ?? 0) + 1, anteriorId: input.revisionAnteriorId,
      fuenteRevision: source.fuenteRevision, vigente: true, congeladoEn: e11Runtime().now().toISOString(),
      actorId: actor.usuarioId, totalFacturado: source.totalFacturado, cantidadVentas: source.items.length,
      evidenciaHash: e11Hash(source.items), decisiones: [] };
    await tx.execute(sql`INSERT INTO e11_conciliaciones(id,tipo,inicio,revision,anterior_id,actor_id,perfil_version,datos)
      VALUES (${id}::uuid,${input.tipo},${input.inicio}::date,${snapshot.revision},
      ${input.revisionAnteriorId}::uuid,${actor.usuarioId},${actor.perfilVersion},${JSON.stringify(snapshot)}::jsonb)`);
    for (const sale of source.items) await tx.execute(sql`INSERT INTO e11_conciliacion_ventas(conciliacion_id,venta_id,datos)
      VALUES (${id}::uuid,${sale.ventaId},${JSON.stringify(sale)}::jsonb)`);
    return snapshot;
  });
}
export async function e11DecideSnapshot(tx: E11Sql, actor: E11Identity, id: string, input: DecisionInput) {
  gate(e11Runtime().flags.reconciliation);
  actor = await freshCommandActor(tx, actor, "FISCAL_CONCILIAR"); e11AssertVersion(actor, input.perfilVersion);
  if (!input.referenciaExterna.trim() || (input.resultado === "NO_CUADRA" && !input.observacion.trim()))
    throw new E11Error("VALIDACION", "Referencia y observación de discrepancia obligatorias.", 400);
  return e11Replay(tx, actor, "DECISION", input.uuid, { id, input }, async () => {
    const first = await e11Snapshot(tx, id);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"E11:period:" + first.periodo.tipo + first.periodo.inicio},0))`);
    const snapshot = await e11Snapshot(tx, id);
    if (snapshot.revision !== input.revisionEsperada) throw new E11Error("REVISION_OBSOLETA", "Revisión obsoleta.");
    if (!snapshot.vigente || snapshot.fuenteRevision !== input.fuenteRevision)
      throw new E11Error("FUENTE_CAMBIADA", "La fuente cambió; crea otra revisión.");
    if (snapshot.decisiones.length) throw new E11Error("ESTADO_INVALIDO", "La revisión ya tiene decisión.");
    if (input.resultado === "ACEPTADA" && e11Cents(input.totalExterno) !== e11Cents(snapshot.totalFacturado))
      throw new E11Error("IMPORTE_NO_COINCIDE", "El total externo no coincide con FACTURADO.", 422);
    const aviso = input.resultado === "NO_CUADRA" ? randomUUID() : null;
    const decision: Decision = { id: randomUUID(), uuid: input.uuid, actorId: actor.usuarioId,
      creadoEn: e11Runtime().now().toISOString(), resultado: input.resultado, totalExterno: input.totalExterno,
      referenciaExterna: input.referenciaExterna.trim(), observacion: input.observacion.trim(), avisoAdminId: aviso };
    await tx.execute(sql`INSERT INTO e11_decisiones(id,conciliacion_id,actor_id,perfil_version,uuid,datos)
      VALUES (${decision.id}::uuid,${id}::uuid,${actor.usuarioId},${actor.perfilVersion},${input.uuid}::uuid,${JSON.stringify(decision)}::jsonb)`);
    if (aviso) {
      await tx.execute(sql`INSERT INTO e11_avisos(id,conciliacion_id,decision_id) VALUES (${aviso}::uuid,${id}::uuid,${decision.id}::uuid)`);
      // Existing notification reader treats a null recipient as ADMIN-only; no accounting write.
      await tx.execute(sql`INSERT INTO notificaciones_sistema(tipo,titulo,mensaje,prioridad,entidad,entidad_id,destinatario_usuario_id)
        VALUES ('E11_NO_CUADRA','Conciliación facturada no cuadra',
        ${"Revisar /contabilidad/conciliaciones/" + id},'ALTA','e11_conciliaciones',${id},NULL)`);
    }
    return e11Snapshot(tx, id);
  });
}
export async function e11Periods(tx: E11Sql, desde: string, hasta: string) {
  e11Range(desde, hasta);
  const all = [];
  // Paging happens at the HTTP boundary; bounded range prevents unbounded calendar expansion.
  if ((e11Date(hasta).getTime() - e11Date(desde).getTime()) / 86400000 > 3660)
    throw new E11Error("VALIDACION", "Consulta como máximo diez años por rango.", 400);
  const rows = (await tx.execute(sql`SELECT DISTINCT ON(tipo,inicio) id,tipo,inicio::text FROM e11_conciliaciones
    WHERE inicio>=${desde}::date AND inicio<${hasta}::date ORDER BY tipo,inicio,revision DESC`)).rows;
  for (let day = desde; day < hasta; day = e11Advance(day, 1)) {
    for (const kind of ["DIA", "SEMANA", "MES"] as E11PeriodType[]) {
      if (kind === "SEMANA" && new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) continue;
      if (kind === "MES" && !day.endsWith("-01")) continue;
      const previous = rows.find(r => r.tipo === kind && r.inicio === day);
      all.push(previous ? (await e11Snapshot(tx, String(previous.id))).periodo : e11Period(kind, day, e11Runtime().now()));
    }
  }
  return all;
}
const preparationDeps: E5Dependencies = {
  ledger: (tx, client) => e11Runtime().ledger(tx, client),
  async cash() { throw new E11Error("PERFIL_DENEGADO", "A no consulta ni opera caja.", 403); },
};
async function e11PreparationActor(tx: E11Sql, identity: E11Identity, ip = ""): Promise<E5Actor> {
  if (!e11Runtime().flags.e5Enabled || !e11Runtime().flags.e5ContadorA || !e11Runtime().flags.preparation)
    throw new E11Error("E5_DISABLED", "La preparación E5 no está habilitada.", 403);
  e11Capability(identity, "E5_PREPARAR");
  const row = (await tx.execute(sql`SELECT nombre,ubicacion_id FROM usuarios WHERE id=${identity.usuarioId} FOR SHARE`)).rows[0]!;
  return { id: identity.usuarioId, nombre: String(row.nombre), rol: "CONTADOR",
    ubicacionId: row.ubicacion_id == null ? null : Number(row.ubicacion_id), ip,
    ver: true, recibirCaja: false, recibirCliente: false, todas: true, capacidadAE11: true,
    e11PerfilVersion: identity.perfilVersion };
}
export async function e11Preparation(tx: E11Sql, identity: E11Identity, id: string) {
  const actor = await e11PreparationActor(tx, identity);
  const repo = e5Repository(tx, preparationDeps);
  const detail = await repo.load(id, actor);
  if (!detail) throw new E11Error("NO_ENCONTRADO", "Cobro no encontrado.", 404);
  const context = await e5Context(tx, preparationDeps, detail.clienteId, detail.ubicacionId, actor);
  const notes = await e11FinanceNotes(tx, detail.clienteId);
  return { cobroId: detail.id, clienteId: detail.clienteId, revision: detail.revision,
    fuenteRevision: context.versionContexto, retenido: detail.importePendiente,
    notas: notes.filter(n => context.notas.some(c => c.movimientoVentaId === n.movimientoVentaId)),
    propuestaId: detail.propuestaVigenteId ?? null };
}
export async function e11Preparations(tx: E11Sql, identity: E11Identity, clienteId?: number) {
  await e11PreparationActor(tx, identity);
  const rows = (await tx.execute(sql`SELECT id FROM e5_cobros WHERE detail->>'estado' IN ('PENDIENTE','PARCIAL')
    ${clienteId ? sql`AND cliente_id=${clienteId}` : sql``} ORDER BY id`)).rows;
  const results = [];
  for (const row of rows) results.push(await e11Preparation(tx, identity, String(row.id)));
  return results;
}
export async function e11Prepare(tx: E11Sql, identity: E11Identity, id: string, input: PreparationInput, ip: string) {
  identity = await freshCommandActor(tx, identity, "E5_PREPARAR");
  e11AssertVersion(identity, input.perfilVersion);
  const actor = await e11PreparationActor(tx, identity, ip);
  if (new Set(input.asignaciones.map(a => a.notaId)).size !== input.asignaciones.length)
    throw new E11Error("VALIDACION", "Notas duplicadas.", 400);
  return e11Replay(tx, identity, "PREPARACION", input.uuid, { id, input }, async () => {
    await e5Command(e5Repository(tx, preparationDeps), actor, "PROPONER", {
      claveOperacion: input.uuid, revisionEsperada: input.revisionEsperada,
      versionContexto: input.fuenteRevision, asignaciones: input.asignaciones,
      evidencia: { descripcion: "Preparación E11 por perfil A explícito; no aplicación.",
        referencias: [`E11:${input.uuid}:perfil:${identity.perfilVersion}`] },
    }, id, e11Runtime().flags.e5Enabled);
    return e11Preparation(tx, identity, id);
  });
}

export const E11RecoveryTarget = z.object({
  actorId: z.coerce.number().int().positive().max(2147483647),
  accion: z.enum(["PERFIL", "SNAPSHOT", "DECISION", "PREPARACION"]),
  uuidOriginal: z.string().uuid().transform(s => s.toLowerCase()),
}).strict();
export const E11RecoveryInput = z.object({
  uuid: z.string().uuid().transform(s => s.toLowerCase()),
  revisionEsperada: z.string().regex(/^[a-f0-9]{64}$/),
  identidadVersion: z.string().regex(/^[a-f0-9]{64}$/),
  motivo: z.string().trim().min(1).max(500),
}).strict();
export const E11RecoveryOutput = E11RecoveryTarget.extend({
  estado: z.enum(["PENDIENTE", "CONFIRMADA", "CERRADA_SIN_EFECTO"]),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  resolucionId: z.string().uuid().nullable(),
  resueltoEn: z.string().datetime().nullable(),
});
type RecoveryTarget = z.infer<typeof E11RecoveryTarget>;
async function recoveryAdmin(tx: E11Sql, actor: E11Identity) {
  gate(e11Runtime().flags.enabled);
  actor = await freshCommandActor(tx, actor, "FISCAL_LEER");
  if (actor.rolBase !== "ADMIN") throw new E11Error("ADMIN_REQUERIDO", "Sólo ADMIN real resuelve intenciones.", 403);
  return actor;
}
async function recoveryState(tx: E11Sql, target: RecoveryTarget) {
  // SAME lock and unique operation key as every producer's e11Replay.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${
    `E11:${target.actorId}:${target.accion}:${target.uuidOriginal}`},0))`);
  const owner = (await tx.execute(sql`SELECT id FROM usuarios WHERE id=${target.actorId}`)).rows[0];
  if (!owner) throw new E11Error("NO_ENCONTRADO", "Actor original no encontrado.", 404);
  const operation = (await tx.execute(sql`SELECT estado FROM e11_operaciones
    WHERE actor_id=${target.actorId} AND operacion=${target.accion} AND uuid=${target.uuidOriginal}::uuid`)).rows[0];
  const resolution = (await tx.execute(sql`SELECT id,created_at FROM e11_resoluciones
    WHERE actor_original_id=${target.actorId} AND accion=${target.accion} AND uuid_original=${target.uuidOriginal}::uuid`)).rows[0];
  const metadata = { ...target, estado: operation ? operation.estado === "CERRADA_SIN_EFECTO"
    ? "CERRADA_SIN_EFECTO" as const : "CONFIRMADA" as const : "PENDIENTE" as const,
    resolucionId: resolution ? String(resolution.id) : null,
    resueltoEn: resolution ? iso(resolution.created_at) : null };
  return { ...metadata, revision: e11Hash(metadata) };
}
export async function e11Recovery(tx: E11Sql, actor: E11Identity, target: RecoveryTarget) {
  await recoveryAdmin(tx, actor);
  return recoveryState(tx, E11RecoveryTarget.parse(target));
}
export async function e11Resolve(tx: E11Sql, actor: E11Identity, target: RecoveryTarget,
  input: z.infer<typeof E11RecoveryInput>) {
  actor = await recoveryAdmin(tx, actor);
  target = E11RecoveryTarget.parse(target); input = E11RecoveryInput.parse(input);
  if (actor.permisosVersion !== input.identidadVersion)
    throw new E11Error("PERFIL_CAMBIADO", "Recarga la identidad ADMIN antes de resolver.");
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${
    `E11:resolution:${actor.usuarioId}:${input.uuid}`},0))`);
  const hash = e11Hash({ target, input });
  const replay = (await tx.execute(sql`SELECT solicitud_hash,respuesta FROM e11_resoluciones
    WHERE admin_id=${actor.usuarioId} AND uuid_resolutor=${input.uuid}::uuid`)).rows[0];
  if (replay) {
    if (replay.solicitud_hash !== hash) throw new E11Error("UUID_REUTILIZADO", "UUID resolutor utilizado para otra intención.");
    return E11RecoveryOutput.parse(replay.respuesta);
  }
  const current = await recoveryState(tx, target);
  if (current.revision !== input.revisionEsperada || current.resolucionId)
    throw new E11Error("REVISION_OBSOLETA", "Consulta nuevamente la intención exacta.");
  const id = randomUUID(), now = e11Runtime().now().toISOString();
  const metadata = { ...target,
    estado: current.estado === "PENDIENTE" ? "CERRADA_SIN_EFECTO" as const : current.estado,
    resolucionId: id, resueltoEn: now };
  const response = { ...metadata, revision: e11Hash(metadata) };
  if (current.estado === "PENDIENTE") {
    // Unique PK shared with producers is the serialization backstop even when
    // SERIALIZABLE took its snapshot before waiting on the advisory lock.
    await tx.execute(sql`INSERT INTO e11_operaciones(actor_id,operacion,uuid,solicitud_hash,respuesta,estado)
      VALUES (${target.actorId},${target.accion},${target.uuidOriginal}::uuid,${hash},
      ${JSON.stringify(response)}::jsonb,'CERRADA_SIN_EFECTO')`);
  }
  await tx.execute(sql`INSERT INTO e11_resoluciones
    (id,actor_original_id,accion,uuid_original,admin_id,uuid_resolutor,solicitud_hash,revision_anterior,identidad_version,motivo,estado,respuesta,created_at)
    VALUES (${id}::uuid,${target.actorId},${target.accion},${target.uuidOriginal}::uuid,${actor.usuarioId},
    ${input.uuid}::uuid,${hash},${current.revision},${input.identidadVersion},${input.motivo},
    ${response.estado},${JSON.stringify(response)}::jsonb,${now}::timestamptz)`);
  return response;
}

export type E11Execution<T> = {
  userId: number; sessionId: string; capability: string | null; exclusive?: boolean;
  /** Present for HTTP mutations only, validated from the original intent before work starts. */
  mutationUuid?: string;
  work: (tx: E11Sql, identity: E11Identity) => Promise<unknown>;
  parse: (value: unknown) => T;
  deliver: (payload: T, identity: E11Identity) => void | Promise<void>;
};
/** Actual route coordinator: commit all work or rollback, then reauthorize delivery under lock. */
export async function e11Execute<T>(command: E11Execution<T>): Promise<void> {
  let workCompleted = false;
  let result: { identity: E11Identity; payload: T };
  try {
    result = await e11Runtime().transaction(async tx => {
      await e11SecurityLock(tx, command.exclusive);
      const identity = await e11Identity(tx, command.userId, command.sessionId);
      if (command.capability) e11Capability(identity, command.capability);
      const value = await command.work(tx, identity);
      let payload: T;
      try { payload = command.parse(value); }
      catch { throw new E11Error("DEPENDENCIA_NO_DISPONIBLE", "La proyección no satisface el contrato E11.", 503); }
      workCompleted = true;
      return { identity, payload };
    }, { isolationLevel: "serializable" });
  } catch (error) {
    const pg = error as { code?: string; cause?: { code?: string } };
    const code = pg?.code ?? pg?.cause?.code ?? "";
    // PostgreSQL constraint/transaction-rollback errors prove failure to commit.
    // Lost transport/unknown COMMIT acknowledgment after work completed does not.
    const provenRollback = /^(23|40)[A-Z0-9]{3}$/.test(code);
    if (command.mutationUuid && workCompleted && !provenRollback)
      throw new E11OutcomeError(command.mutationUuid, false);
    throw error;
  }
  try {
    await e11Runtime().transaction(async tx => {
      const current = await e11Identity(tx, command.userId, command.sessionId);
      if (e11Hash(current) !== e11Hash(result.identity))
        throw new E11Error("PERFIL_CAMBIADO", "El perfil cambió antes de responder.");
      if (command.capability) e11Capability(current, command.capability);
      await command.deliver(result.payload, current);
    });
  } catch (error) {
    // The write transaction has committed. Neither failed reauthorization nor
    // delivery can roll it back; never report a definitive pre-commit refusal.
    if (command.mutationUuid) throw new E11OutcomeError(command.mutationUuid, true);
    throw error;
  }
}
/** Factory binds infrastructure only. Every exported policy and fresh identity read remains real. */
export function createE11Service(options: E11RuntimeOptions = {}) {
  const scope = createE11Runtime(options);
  return Object.freeze({
    run: scope.run,
    recovery: (...args: Parameters<typeof e11Recovery>) => scope.run(() => e11Recovery(...args)),
    resolve: (...args: Parameters<typeof e11Resolve>) => scope.run(() => e11Resolve(...args)),
    execute: <T>(command: E11Execution<T>) => scope.run(() => e11Execute(command)),
    identity: (...args: Parameters<typeof e11Identity>) => scope.run(() => e11Identity(...args)),
    assignProfile: (...args: Parameters<typeof e11AssignProfile>) => scope.run(() => e11AssignProfile(...args)),
    userRoleChange: (...args: Parameters<typeof e11UserRoleChange>) => scope.run(() => e11UserRoleChange(...args)),
    profileHistory: (...args: Parameters<typeof e11ProfileHistory>) => scope.run(() => e11ProfileHistory(...args)),
    fiscalSales: (...args: Parameters<typeof e11FiscalSales>) => scope.run(() => e11FiscalSales(...args)),
    fiscalClients: (...args: Parameters<typeof e11FiscalClients>) => scope.run(() => e11FiscalClients(...args)),
    financeClients: (...args: Parameters<typeof e11FinanceClients>) => scope.run(() => e11FinanceClients(...args)),
    financeNotes: (...args: Parameters<typeof e11FinanceNotes>) => scope.run(() => e11FinanceNotes(...args)),
    financeStatement: (...args: Parameters<typeof e11FinanceStatement>) => scope.run(() => e11FinanceStatement(...args)),
    periods: (...args: Parameters<typeof e11Periods>) => scope.run(() => e11Periods(...args)),
    createSnapshot: (...args: Parameters<typeof e11CreateSnapshot>) => scope.run(() => e11CreateSnapshot(...args)),
    snapshot: (...args: Parameters<typeof e11Snapshot>) => scope.run(() => e11Snapshot(...args)),
    snapshotSales: (...args: Parameters<typeof e11SnapshotSales>) => scope.run(() => e11SnapshotSales(...args)),
    decideSnapshot: (...args: Parameters<typeof e11DecideSnapshot>) => scope.run(() => e11DecideSnapshot(...args)),
    preparations: (...args: Parameters<typeof e11Preparations>) => scope.run(() => e11Preparations(...args)),
    preparation: (...args: Parameters<typeof e11Preparation>) => scope.run(() => e11Preparation(...args)),
    prepare: (...args: Parameters<typeof e11Prepare>) => scope.run(() => e11Prepare(...args)),
  });
}