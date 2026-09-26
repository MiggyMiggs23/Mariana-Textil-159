import { createHash } from "node:crypto";
import { z } from "zod";
import { E5_ENABLED, E5_REFUND_ENABLED } from "./e5-feature";
import { e11Runtime } from "./e11-runtime";
import type { E5Cobro as Cobro, E5Contexto as Contexto, E5Nota as Nota, E5Propuesta as Propuesta,
  E5Asignacion as Asignacion, E5Aplicacion as Aplicacion, E5Documento as Documento, E5FuenteDevolucion as Fuente } from "@workspace/api-zod";
type Wire<T> = T extends Date ? string : T extends Array<infer U> ? Wire<U>[] : T extends object ? { [K in keyof T]: Wire<T[K]> } : T;
export type E5Cobro = Wire<Cobro>;
export type E5Contexto = Wire<Contexto>;
export type E5Nota = Wire<Nota>;
export type E5Propuesta = Wire<Propuesta>;
export type E5Asignacion = Wire<Asignacion>;
export type E5Aplicacion = Wire<Aplicacion>;
export type E5Documento = Wire<Documento>;
export type E5FuenteDevolucion = Wire<Fuente>;

export class E5Error extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
const randomUUID = () => e11Runtime().uuid();
const uuid = z.string().uuid().transform(v => v.toLowerCase());
const positiveId = z.number().int().positive().max(2147483647);
const text = z.string().trim().min(1).max(2000);
export const e5Money = z.string().max(13).regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/);
export const e5Evidence = z.object({ descripcion: text, referencias: z.array(z.string().trim().min(1).max(500)).max(20) }).strict();
export const e5Allocation = z.object({ notaId: positiveId, movimientoVentaId: positiveId, importe: e5Money }).strict();
const allocations = z.array(e5Allocation).max(100);
export const e5Receive = z.object({
  claveOperacion: uuid, clienteId: positiveId, ubicacionId: positiveId, versionContexto: z.string().min(1).max(200),
  entrada: z.enum(["CAJA", "CLIENTE"]), importe: e5Money, formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
  cuentaDestino: z.enum(["CAJA_FISICA", "CUENTA_FISCAL", "CUENTA_NO_FISCAL"]),
  sesionCajaId: positiveId.optional(), sesionOperativaId: positiveId.optional(),
  notasIndicadas: z.array(positiveId).min(1).max(100), evidencia: e5Evidence,
  aplicarAhora: allocations.min(1).optional(),
}).strict();
const commandBase = { claveOperacion: uuid, revisionEsperada: positiveId };
const contextVersion = z.string().min(1).max(200);
export const e5Proposal = z.object({ ...commandBase, versionContexto: contextVersion,
  asignaciones: allocations, importeFavorPropuesto: e5Money.optional(), evidencia: e5Evidence }).strict();
export const e5Authorize = z.object({ ...commandBase, versionContexto: contextVersion, propuestaId: uuid,
  asignaciones: allocations, importeFavorAutorizado: e5Money.optional(), evidencia: e5Evidence }).strict();
export const e5Reject = z.object({ ...commandBase, propuestaId: uuid, motivo: text }).strict();
export const e5Source = z.object({ tipo: z.enum(["CAJA", "CUENTA", "FONDO"]), ubicacionId: positiveId,
  sesionCajaId: positiveId.optional(), sesionOperativaId: positiveId.optional(),
  cuentaOrigen: z.enum(["CAJA_FISICA", "CUENTA_FISCAL", "CUENTA_NO_FISCAL"]).optional() }).strict();
export const e5Return = z.object({ ...commandBase, peticionCliente: text, evidencia: e5Evidence, fuente: e5Source }).strict();
export const e5Print = z.object({ claveOperacion: uuid, motivo: z.string().trim().min(1).max(500) }).strict();
export type E5Actor = { id: number; nombre: string; rol: string; ubicacionId: number | null; ip: string;
  ver: boolean; recibirCaja: boolean; recibirCliente: boolean; todas: boolean; capacidadAE11: boolean;
  e11PerfilVersion?: number };
export type E5Action = "RECIBIR" | "PROPONER" | "AUTORIZAR" | "RECHAZAR" | "DEVOLVER";
export type E5Operation = { actorId: number; content: string; response: E5Cobro };
export type E5Context = E5Contexto & { deudaGlobal: string; ubicacionNombre: string };
export interface E5Repository {
  lockKey(key: string): Promise<void>;
  replay(key: string): Promise<E5Operation | undefined>;
  load(id: string, actor: E5Actor): Promise<E5Cobro | undefined>;
  context(client: number, site: number, actor: E5Actor): Promise<E5Context>;
  sessions(input: z.infer<typeof e5Receive>, actor: E5Actor): Promise<void>;
  receive(detail: E5Cobro, input: z.infer<typeof e5Receive>, actor: E5Actor): Promise<void>;
  apply(detail: E5Cobro, application: E5Aplicacion, proposal: E5Propuesta, actor: E5Actor): Promise<void>;
  refund(detail: E5Cobro, input: z.infer<typeof e5Return>, actor: E5Actor): Promise<{ salidaId?: number; movimientoFondoId?: string }>;
  save(detail: E5Cobro, oldRevision: number | null): Promise<void>;
  document(document: E5Documento): Promise<void>;
  operation(key: string, action: E5Action, content: string, detail: E5Cobro, actor: E5Actor): Promise<void>;
}
export function e5Canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(e5Canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${e5Canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const e5Hash = (value: unknown) => createHash("sha256").update(e5Canonical(value)).digest("hex");
export function e5Cents(value: string) {
  const [a, b] = e5Money.parse(value).split(".");
  return BigInt(a!) * 100n + BigInt(b!);
}
export const e5Decimal = (value: bigint) => `${value < 0 ? "-" : ""}${(value < 0 ? -value : value) / 100n}.${String((value < 0 ? -value : value) % 100n).padStart(2, "0")}`;
const total = (rows: E5Asignacion[]) => rows.reduce((sum, row) => sum + e5Cents(row.importe), 0n);
export function requireE5(enabled = E5_ENABLED) {
  if (!enabled) throw new E5Error("E5_DISABLED", "E5 no está habilitado.", 403);
}
export function e5Scope(actor: E5Actor, site: number, write = false) {
  if (actor.rol !== "ADMIN" && !(actor.ubicacionId === site || (!write && actor.todas && actor.ver)))
    throw new E5Error("E5_NOT_FOUND", "Cobro o contexto no encontrado.", 404);
}
export function e5Capabilities(actor: E5Actor, detail?: E5Cobro) {
  const admin = actor.rol === "ADMIN", pending = !detail || e5Cents(detail.importePendiente) > 0n;
  const a = e11Runtime().flags.e5Enabled && e11Runtime().flags.e5ContadorA
    && e11Runtime().flags.enabled && e11Runtime().flags.preparation
    && actor.rol === "CONTADOR" && actor.capacidadAE11 === true && actor.e11PerfilVersion !== undefined;
  return { puedeRecibir: ["ADMIN", "SUPERVISOR", "CAJA", "TERMINAL"].includes(actor.rol) && (actor.recibirCaja || actor.recibirCliente),
    puedePreparar: (admin || a) && pending, puedeAutorizar: admin && pending && (!detail || !!detail.propuestaVigenteId),
    puedeRechazar: admin && !!detail?.propuestaVigenteId, puedeDevolver: E5_REFUND_ENABLED && admin && pending && detail?.algunaVezAplicado === false,
    puedeVerAvisos: admin, puedeImprimir: admin, preparacionADisponible: a };
}
export function e5View(detail: E5Cobro, actor: E5Actor, now = e11Runtime().now()) {
  e5Scope(actor, detail.ubicacionId);
  const copy = structuredClone(detail);
  copy.antiguedadDias = Math.max(0, Math.floor((now.getTime() - new Date(copy.fechaRecepcion).getTime()) / 86400000));
  copy.avisoAdmin = actor.rol === "ADMIN" && copy.antiguedadDias >= 3 && e5Cents(copy.importePendiente) > 0n;
  copy.capacidades = e5Capabilities(actor, copy);
  if (actor.rol !== "ADMIN" && copy.devolucion) {
    delete copy.devolucion.fuente; delete copy.devolucion.salidaId; delete copy.devolucion.movimientoFondoId;
    // The store sees a documentary summary, never free text identifying a Fondo withdrawal.
    copy.devolucion.evidencia = { descripcion: "Devolución íntegra documentada por ADMIN.", referencias: [] };
    copy.devolucion.peticionCliente = "Solicitud expresa del cliente documentada por ADMIN.";
  }
  return copy;
}
function contextCurrent(context: E5Context, version: string) {
  if (version !== context.versionContexto) throw new E5Error("E5_NOTA_STALE", "Los saldos cambiaron; recarga y confirma otra vez.");
}
export function validateE5Allocations(rows: E5Asignacion[], context: E5Context, budget: string, favor = "0.00") {
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.movimientoVentaId) || e5Cents(row.importe) <= 0n) throw new E5Error("E5_VALIDATION", "Reparto duplicado o no positivo.", 400);
    seen.add(row.movimientoVentaId);
    const note = context.notas.find(n => n.notaId === row.notaId && n.movimientoVentaId === row.movimientoVentaId);
    if (!note || e5Cents(note.saldoPendiente) < e5Cents(row.importe))
      throw new E5Error("E5_NOTA_STALE", "Nota no disponible o sin saldo suficiente; no se cambia de destino.");
  }
  const amount = total(rows) + e5Cents(favor);
  if (amount <= 0n || amount > e5Cents(budget)) throw new E5Error("E5_VALIDATION", "El reparto excede lo retenido o está vacío.", 400);
  if (e5Cents(favor) > 0n && e5Cents(context.deudaGlobal) !== total(rows))
    throw new E5Error("E5_STATE_CONFLICT", "Favor explícito exige deuda global cero tras el reparto aprobado; no se altera FIFO.");
  return e5Decimal(amount);
}
export async function e5Preview(repo: E5Repository, actor: E5Actor, raw: unknown, enabled = E5_ENABLED) {
  requireE5(enabled);
  const input = e5Receive.parse(raw);
  const context = await validateReception(repo, actor, input);
  return { versionContexto: context.versionContexto, importeRecibido: input.importe,
    importeAplicar: e5Decimal(total(input.aplicarAhora ?? [])),
    pendienteResultante: e5Decimal(e5Cents(input.importe) - total(input.aplicarAhora ?? [])),
    notas: context.notas.filter(n => input.notasIndicadas.includes(n.notaId)),
    mensaje: input.aplicarAhora ? "ADMIN: recepción y aplicación al momento, sin segundo cobro." : "Recibido, pendiente de aplicación; deuda y disponible no cambian.",
    capacidades: e5Capabilities(actor) };
}
async function validateReception(repo: E5Repository, actor: E5Actor, input: z.infer<typeof e5Receive>) {
  if (!e5Capabilities(actor).puedeRecibir || !(input.entrada === "CAJA" ? actor.recibirCaja : actor.recibirCliente))
    throw new E5Error("E5_FORBIDDEN", "No tienes permiso de recepción en esta entrada.", 403);
  e5Scope(actor, input.ubicacionId, true);
  if (input.aplicarAhora && actor.rol !== "ADMIN") throw new E5Error("E5_FORBIDDEN", "Solo ADMIN aplica.", 403);
  if (new Set(input.notasIndicadas).size !== input.notasIndicadas.length || e5Cents(input.importe) <= 0n)
    throw new E5Error("E5_VALIDATION", "Importe positivo y documentos únicos requeridos.", 400);
  const cash = input.formaPago === "EFECTIVO";
  if (cash !== (input.cuentaDestino === "CAJA_FISICA") || (cash ? !input.sesionCajaId : !!input.sesionCajaId) ||
      (input.entrada === "CAJA" && !input.sesionOperativaId) ||
      (cash && input.sesionOperativaId && input.sesionCajaId !== input.sesionOperativaId))
    throw new E5Error("E5_VALIDATION", "Medio, cuenta y sesiones no corresponden.", 400);
  const context = await repo.context(input.clienteId, input.ubicacionId, actor);
  contextCurrent(context, input.versionContexto);
  const notes = context.notas.filter(n => input.notasIndicadas.includes(n.notaId) && e5Cents(n.saldoPendiente) > 0n);
  if (input.notasIndicadas.some(id => !notes.some(n => n.notaId === id)))
    throw new E5Error("E5_NOTA_STALE", "Una nota indicada ya no tiene saldo o no está permitida.");
  const sum = notes.reduce((n, row) => n + e5Cents(row.saldoPendiente), 0n);
  if (actor.rol !== "ADMIN" && sum !== e5Cents(input.importe))
    throw new E5Error("E5_EXACT_REQUIRED", "Sin ADMIN se recibe exactamente el saldo de las notas indicadas.", 400);
  if (input.aplicarAhora) {
    if (input.aplicarAhora.some(a => !input.notasIndicadas.includes(a.notaId)))
      throw new E5Error("E5_VALIDATION", "Aplicación al momento fuera de las notas indicadas.", 400);
    validateE5Allocations(input.aplicarAhora, context, input.importe);
  }
  await repo.sessions(input, actor);
  return context;
}
function makeDocument(detail: E5Cobro, id: string, application?: E5Aplicacion): E5Documento {
  const proposal = application ? detail.propuestas.find(p => p.id === application.propuestaId)! : undefined;
  return { id, tipo: application ? "CONSTANCIA" : "RECIBO", folio: `E5-${application ? "A" : "R"}-${id}`,
    cobroId: detail.id, reciboId: detail.reciboId, reciboFolio: `E5-R-${detail.reciboId}`,
    clienteNombre: detail.clienteNombre, ubicacionNombre: detail.ubicacionNombre, receptor: detail.receptor,
    formaPago: detail.formaPago, cuentaDestino: detail.cuentaDestino,
    ...(application ? { autorizador: application.actor, fechaAplicacion: application.fechaAplicacion } : {}),
    fechaRecepcion: detail.fechaRecepcion, fechaEmision: application?.fechaAplicacion ?? detail.fechaRecepcion,
    importeRecibido: detail.importeRecibido, importeDocumento: application?.importe ?? detail.importeRecibido,
    importeFavorGenerado: application?.importeFavorGenerado ?? "0.00",
    pendienteEnEmision: application ? detail.importePendiente : detail.importeRecibido,
    mensaje: application ? "Constancia de aplicación autorizada. No es un nuevo cobro." : "Recibido, pendiente de aplicación. No es saldo a favor disponible.",
    asignaciones: application?.asignaciones ?? [], notas: proposal?.notas ?? detail.notasIndicadas,
    evidencia: application?.evidencia ?? detail.evidenciaRecepcion, copias: 2 };
}
async function apply(repo: E5Repository, detail: E5Cobro, proposal: E5Propuesta, rows: E5Asignacion[],
  favor: string, context: E5Context, actor: E5Actor, evidence: z.infer<typeof e5Evidence>, now: string) {
  if (rows.some(row => !detail.notasIndicadas.some(note =>
    note.notaId === row.notaId && note.movimientoVentaId === row.movimientoVentaId)))
    throw new E5Error("E5_STATE_CONFLICT", "No se cambia el destino indicado al recibir el dinero.", 409);
  const amount = validateE5Allocations(rows, context, detail.importePendiente, favor);
  if (rows.some(row => !proposal.asignaciones.some(p => p.notaId === row.notaId &&
      p.movimientoVentaId === row.movimientoVentaId && e5Cents(row.importe) <= e5Cents(p.importe))) ||
      e5Cents(favor) > e5Cents(proposal.importeFavorPropuesto ?? "0.00"))
    throw new E5Error("E5_STATE_CONFLICT", "La autorización amplía o cambia la propuesta.");
  // A paid target freezes the whole proposal, even when a different subset was selected.
  if (proposal.asignaciones.some(p => !context.notas.some(n => n.movimientoVentaId === p.movimientoVentaId && e5Cents(n.saldoPendiente) > 0n)))
    throw new E5Error("E5_NOTA_STALE", "Una nota de la propuesta fue pagada; requiere revisión.");
  const application: E5Aplicacion = { id: randomUUID(), propuestaId: proposal.id, importe: amount,
    importeFavorGenerado: favor, asignaciones: rows, fechaAplicacion: now, actor: { id: actor.id, nombre: actor.nombre },
    evidencia: evidence, constanciaId: randomUUID() };
  await repo.apply(detail, application, proposal, actor);
  detail.aplicaciones.push(application); detail.algunaVezAplicado = true;
  detail.importeAplicado = e5Decimal(e5Cents(detail.importeAplicado) + e5Cents(amount));
  detail.importePendiente = e5Decimal(e5Cents(detail.importePendiente) - e5Cents(amount));
  detail.estado = e5Cents(detail.importePendiente) > 0n ? "PARCIAL" : "APLICADO";
  delete detail.propuestaVigenteId;
  await repo.document(makeDocument(detail, application.constanciaId, application));
}
export async function e5Command(repo: E5Repository, actor: E5Actor, action: E5Action, raw: unknown,
  id?: string, enabled = E5_ENABLED) {
  requireE5(enabled);
  if (action === "DEVOLVER" && !E5_REFUND_ENABLED)
    throw new E5Error("E5_DISABLED", "La devolución de dinero E5 permanece cerrada.", 403);
  if (action === "PROPONER" ? !e5Capabilities(actor).puedePreparar : action !== "RECIBIR" && actor.rol !== "ADMIN")
    throw new E5Error("E5_FORBIDDEN", "Acción no autorizada.", 403);
  const schema = action === "RECIBIR" ? e5Receive : action === "PROPONER" ? e5Proposal :
    action === "AUTORIZAR" ? e5Authorize : action === "RECHAZAR" ? e5Reject : e5Return;
  const input = schema.parse(raw);
  if (action !== "RECIBIR") id = uuid.parse(id);
  const content = e5Canonical({ action, id: id ?? null, input });
  await repo.lockKey(input.claveOperacion);
  const prior = await repo.replay(input.claveOperacion);
  if (prior) {
    if (prior.actorId !== actor.id || prior.content !== content)
      throw new E5Error("E5_IDEMPOTENCY_CONFLICT", "UUID usado para otra intención.");
    if (action === "RECIBIR" && !e5Capabilities(actor).puedeRecibir) throw new E5Error("E5_FORBIDDEN", "Recepción no autorizada.", 403);
    return e5View(prior.response, actor);
  }
  const now = e11Runtime().now().toISOString(), author = { id: actor.id, nombre: actor.nombre };
  let detail: E5Cobro, oldRevision: number | null = null;
  if (action === "RECIBIR") {
    const value = e5Receive.parse(input), context = await validateReception(repo, actor, value);
    detail = { id: value.claveOperacion, revision: 1, clienteId: value.clienteId, clienteNombre: context.clienteNombre,
      ubicacionId: value.ubicacionId, ubicacionNombre: context.ubicacionNombre,
      importeRecibido: value.importe, importeAplicado: "0.00", importePendiente: value.importe, importeDevuelto: "0.00",
      fechaRecepcion: now, formaPago: value.formaPago, cuentaDestino: value.cuentaDestino,
      ...(value.sesionCajaId ? { sesionCajaId: value.sesionCajaId } : {}),
      ...(value.sesionOperativaId ? { sesionOperativaId: value.sesionOperativaId } : {}),
      estado: "PENDIENTE", algunaVezAplicado: false, receptor: author, evidenciaRecepcion: value.evidencia,
       notasIndicadas: context.notas.filter(n => value.notasIndicadas.includes(n.notaId) && e5Cents(n.saldoPendiente) > 0n),
      propuestas: [], aplicaciones: [], rechazos: [], reciboId: randomUUID(),
      antiguedadDias: 0, avisoAdmin: false, capacidades: e5Capabilities(actor) };
    await repo.receive(detail, value, actor);
    await repo.document(makeDocument(detail, detail.reciboId));
    if (value.aplicarAhora) {
      const proposal: E5Propuesta = { id: randomUUID(), version: 1, asignaciones: value.aplicarAhora,
        importeFavorPropuesto: "0.00", notas: detail.notasIndicadas, evidencia: value.evidencia, actor: author, createdAt: now };
      detail.propuestas.push(proposal);
      await apply(repo, detail, proposal, value.aplicarAhora, "0.00", context, actor, value.evidencia, now);
    }
  } else {
    const existing = await repo.load(id!, actor);
    if (!existing) throw new E5Error("E5_NOT_FOUND", "Cobro no encontrado.", 404);
    detail = structuredClone(existing); e5Scope(actor, detail.ubicacionId);
    const revision = (input as z.infer<typeof e5Proposal>).revisionEsperada;
    if (detail.revision !== revision) throw new E5Error("E5_VERSION_STALE", "El cobro cambió; recarga su versión.");
    if (e5Cents(detail.importePendiente) <= 0n) throw new E5Error("E5_STATE_CONFLICT", "El cobro no tiene pendiente.");
    oldRevision = detail.revision; detail.revision++;
    if (action === "PROPONER") {
      const value = e5Proposal.parse(input), context = await repo.context(detail.clienteId, detail.ubicacionId, actor);
      contextCurrent(context, value.versionContexto);
      const favor = value.importeFavorPropuesto ?? "0.00";
      if (e5Cents(favor) > 0n && actor.rol !== "ADMIN") throw new E5Error("E5_FORBIDDEN", "Solo ADMIN propone favor explícito.", 403);
      if (value.asignaciones.some(row => !detail.notasIndicadas.some(note =>
        note.notaId === row.notaId && note.movimientoVentaId === row.movimientoVentaId)))
        throw new E5Error("E5_STATE_CONFLICT", "No se cambia el destino indicado al recibir el dinero.", 409);
      validateE5Allocations(value.asignaciones, context, detail.importePendiente, favor);
      const proposal: E5Propuesta = { id: randomUUID(), version: detail.propuestas.length + 1,
        asignaciones: value.asignaciones, importeFavorPropuesto: favor,
        notas: context.notas.filter(n => value.asignaciones.some(a => a.movimientoVentaId === n.movimientoVentaId)),
        evidencia: value.evidencia, actor: author, createdAt: now };
      detail.propuestas.push(proposal); detail.propuestaVigenteId = proposal.id;
    } else if (action === "AUTORIZAR" || action === "RECHAZAR") {
      const value = action === "AUTORIZAR" ? e5Authorize.parse(input) : e5Reject.parse(input);
      const proposal = detail.propuestas.find(p => p.id === value.propuestaId);
      if (!proposal || detail.propuestaVigenteId !== proposal.id)
        throw new E5Error("E5_VERSION_STALE", "Propuesta obsoleta o ya resuelta.");
      if (action === "RECHAZAR") {
        detail.rechazos.push({ propuestaId: proposal.id, motivo: e5Reject.parse(value).motivo, actor: author, createdAt: now });
        delete detail.propuestaVigenteId;
      } else {
        const authorization = e5Authorize.parse(value), context = await repo.context(detail.clienteId, detail.ubicacionId, actor);
        contextCurrent(context, authorization.versionContexto);
        await apply(repo, detail, proposal, authorization.asignaciones, authorization.importeFavorAutorizado ?? "0.00",
          context, actor, authorization.evidencia, now);
      }
    } else {
      const value = e5Return.parse(input);
      if (detail.algunaVezAplicado || detail.aplicaciones.length || detail.importePendiente !== detail.importeRecibido || detail.devolucion)
        throw new E5Error("E5_REFUND_INELIGIBLE", "Solo total íntegro nunca aplicado; residual no devolvible.");
      const effect = await repo.refund(detail, value, actor);
      detail.devolucion = { id: randomUUID(), importe: detail.importeRecibido, fecha: now, actor: author,
        peticionCliente: value.peticionCliente, evidencia: value.evidencia, fuente: value.fuente, ...effect };
      detail.importeDevuelto = detail.importeRecibido; detail.importePendiente = "0.00"; detail.estado = "DEVUELTO";
      delete detail.propuestaVigenteId;
    }
  }
  await repo.save(detail, oldRevision);
  await repo.operation(input.claveOperacion, action, content, detail, actor);
  return e5View(detail, actor);
}