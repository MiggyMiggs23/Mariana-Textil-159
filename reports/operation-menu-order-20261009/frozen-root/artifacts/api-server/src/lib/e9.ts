import { randomUUID } from "node:crypto";
import { z } from "zod";
import { E9_ENABLED } from "./e9-feature";
import { e9Canonical } from "./e9-cut";

export class E9Error extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const text = z.string().trim().min(1).max(2000);
export const e9Evidence = z.object({ descripcion: text, referencias: z.array(z.string().trim().min(1).max(500)).max(20) }).strict();
const money = z.string().regex(/^(0|[1-9][0-9]*)\.[0-9]{2}$/).refine(v => v.length <= 13, "Importe fuera de rango");
export const e9Send = z.object({ claveOperacion: uuid, corteId: z.number().int().positive(), versionCorte: z.string().min(1).max(200), evidencia: e9Evidence }).strict();
export const e9Count = z.object({ claveOperacion: uuid, importeRecibido: money, evidencia: e9Evidence }).strict();
export const e9Authorize = z.object({ claveOperacion: uuid, conteoId: uuid, motivo: text.optional() }).strict();
export const e9Close = z.object({ claveOperacion: uuid, conclusion: text, evidencia: e9Evidence }).strict();
export type E9Actor = { id: number; nombre: string; rol: string; ubicacionId: number | null; ip: string; puedeEnviar?: boolean };
type Evidence = z.infer<typeof e9Evidence>;
type Author = { id: number; nombre: string };
type Count = { id: string; importeRecibido: string; diferencia: string; evidencia: Evidence; actor: Author; createdAt: string };
export type E9Detail = {
  id: string; ubicacionId: number; ubicacionNombre: string; corteId: number; versionCorte: string; corteHref: string;
  fechaCorte: string; fechaOperativa: string; importeEnviado: string; estado: "ENVIADA" | "CONTADA" | "AUTORIZADA";
  enviadoPor: Author; enviadoAt: string; evidenciaEnvio: Evidence; conteos: Count[]; conteoVigenteId?: string;
  autorizacion?: { conteoId: string; importeRecibido: string; actor: Author; createdAt: string; motivo?: string };
  investigacion?: { id: string; estado: "ABIERTA" | "CERRADA_DOCUMENTAL"; abiertaAt: string; conteoOrigenId: string;
    cierre?: { conclusion: string; evidencia: Evidence; actor: Author; createdAt: string } };
  /** Historical compatibility only. New E9 authorizations never create Fondo ingress. */
  fondo?: { movimientoId: string; href: string };
};
export type E9Cut = { corteId: number; versionCorte: string; fechaCorte: string; fechaOperativa: string; importeEnviado: string; ubicacionId: number; ubicacionNombre: string };
export type E9Action = "ENVIAR" | "CONTAR" | "AUTORIZAR" | "CERRAR";
export type E9Operation = { actorId: number; content: string; result: E9Detail };
export interface E9Repository {
  lockKey(key: string): Promise<void>;
  replay(key: string): Promise<E9Operation | undefined>;
  cut(id: number, actor: E9Actor): Promise<E9Cut | undefined>;
  sent(cut: number): Promise<boolean>;
  load(id: string): Promise<{ revision: number; detail: E9Detail } | undefined>;
  save(detail: E9Detail, revision: number | null): Promise<void>;
  operation(key: string, action: E9Action, content: string, detail: E9Detail, actor: E9Actor): Promise<void>;
}
export function requireE9(enabled = E9_ENABLED) {
  if (!enabled) throw new E9Error("E9_DISABLED", "E9 todavía no está habilitado.", 403);
}
export const e9Cents = (value: string) => {
  const valid = money.parse(value); const [whole, part] = valid.split(".");
  return BigInt(whole!) * 100n + BigInt(part!);
};
export const e9Decimal = (value: bigint) => `${value < 0n ? "-" : ""}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, "0")}`;
export function e9Scope(actor: E9Actor, site: number) {
  if (actor.rol !== "ADMIN" && actor.ubicacionId !== site) throw new E9Error("E9_NOT_FOUND", "Entrega o corte no encontrado.", 404);
}
export function e9Capabilities(actor: E9Actor, detail?: E9Detail) {
  const admin = actor.rol === "ADMIN", pending = detail?.estado !== "AUTORIZADA";
  return { puedeEnviar: (admin || actor.rol === "SUPERVISOR") && actor.puedeEnviar === true,
    puedeContar: admin && pending, puedeAutorizar: admin && detail?.estado === "CONTADA" &&
      e9Cents(detail.conteos.at(-1)!.importeRecibido) > 0n,
    puedeCerrarInvestigacion: admin && detail?.estado === "AUTORIZADA" && detail.investigacion?.estado === "ABIERTA" };
}
export function e9View(detail: E9Detail, actor: E9Actor) {
  e9Scope(actor, detail.ubicacionId);
  const result = structuredClone(detail);
  if (actor.rol !== "ADMIN") delete result.fondo;
  return { ...result, capacidades: e9Capabilities(actor, detail) };
}
export async function e9Command(repo: E9Repository, actor: E9Actor, action: E9Action,
  raw: unknown, id?: string, enabled = E9_ENABLED) {
  requireE9(enabled);
  if (action === "ENVIAR" && actor.puedeEnviar !== true)
    throw new E9Error("E9_FORBIDDEN", "No tienes permiso efectivo para documentar envío.", 403);
  if (action === "ENVIAR" ? !["ADMIN", "SUPERVISOR"].includes(actor.rol) : actor.rol !== "ADMIN")
    throw new E9Error("E9_FORBIDDEN", "Acción no autorizada para este perfil.", 403);
  const input = action === "ENVIAR" ? e9Send.parse(raw) : action === "CONTAR" ? e9Count.parse(raw)
    : action === "AUTORIZAR" ? e9Authorize.parse(raw) : e9Close.parse(raw);
  if (action !== "ENVIAR") id = uuid.parse(id);
  const content = e9Canonical({ action, id: id ?? null, input });
  await repo.lockKey(input.claveOperacion);
  const previous = await repo.replay(input.claveOperacion);
  if (previous) {
    if (previous.actorId !== actor.id || previous.content !== content)
      throw new E9Error("E9_IDEMPOTENCY_CONFLICT", "La clave identifica otra intención.");
    return e9View(previous.result, actor);
  }
  const author = { id: actor.id, nombre: actor.nombre }, now = new Date().toISOString();
  let detail: E9Detail, revision: number | null = null;
  if (action === "ENVIAR") {
    const value = e9Send.parse(input);
    const cut = await repo.cut(value.corteId, actor);
    if (!cut) throw new E9Error("E9_CORTE_STALE", "Falta cierre congelado canónico; no se infiere efectivo.");
    e9Scope(actor, cut.ubicacionId);
    if (cut.versionCorte !== value.versionCorte) throw new E9Error("E9_CORTE_STALE", "El corte no coincide con la versión confirmada.");
    if (e9Cents(cut.importeEnviado) <= 0n) throw new E9Error("E9_VALIDATION", "El cierre no contiene efectivo positivo enviable.", 400);
    if (await repo.sent(cut.corteId)) throw new E9Error("E9_CORTE_ALREADY_SENT", "El corte ya tiene una entrega completa.");
    detail = { ...cut, id: randomUUID(), corteHref: `/caja/cortes?sesionId=${cut.corteId}`, estado: "ENVIADA",
      enviadoPor: author, enviadoAt: now, evidenciaEnvio: value.evidencia, conteos: [] };
  } else {
    const record = await repo.load(id!);
    if (!record) throw new E9Error("E9_NOT_FOUND", "Entrega no encontrada.", 404);
    detail = structuredClone(record.detail); revision = record.revision;
    e9Scope(actor, detail.ubicacionId);
    if (action === "CONTAR") {
      if (detail.estado === "AUTORIZADA") throw new E9Error("E9_ALREADY_AUTHORIZED", "La recepción ya está autorizada.");
      const value = e9Count.parse(input);
      const count: Count = { id: randomUUID(), importeRecibido: value.importeRecibido,
        diferencia: e9Decimal(e9Cents(value.importeRecibido) - e9Cents(detail.importeEnviado)),
        evidencia: value.evidencia, actor: author, createdAt: now };
      detail.conteos.push(count); detail.conteoVigenteId = count.id; detail.estado = "CONTADA";
      if (count.diferencia !== "0.00" && !detail.investigacion)
        detail.investigacion = { id: randomUUID(), estado: "ABIERTA", abiertaAt: now, conteoOrigenId: count.id };
    } else if (action === "AUTORIZAR") {
      const value = e9Authorize.parse(input);
      if (detail.estado === "AUTORIZADA") throw new E9Error("E9_ALREADY_AUTHORIZED", "Ya existe recepción autorizada.");
      const count = detail.conteos.at(-1);
      if (detail.estado !== "CONTADA" || !count || count.id !== value.conteoId || detail.conteoVigenteId !== count.id)
        throw new E9Error("E9_CONTEO_STALE", "Confirma el conteo vigente.");
      if (e9Cents(count.importeRecibido) <= 0n) throw new E9Error("E9_RECEIVED_ZERO", "Conteo cero: continúa pendiente sin autorización.", 400);
      if (count.diferencia !== "0.00" && !value.motivo) throw new E9Error("E9_VALIDATION", "La diferencia requiere motivo de autorización.", 400);
      detail.autorizacion = { conteoId: count.id, importeRecibido: count.importeRecibido, actor: author, createdAt: now, ...(value.motivo ? { motivo: value.motivo } : {}) };
      delete detail.fondo;
      detail.estado = "AUTORIZADA";
    } else {
      const value = e9Close.parse(input);
      if (detail.estado !== "AUTORIZADA" || detail.investigacion?.estado !== "ABIERTA")
        throw new E9Error("E9_STATE_CONFLICT", "Se requiere recepción autorizada e investigación abierta.");
      detail.investigacion.estado = "CERRADA_DOCUMENTAL";
      detail.investigacion.cierre = { conclusion: value.conclusion, evidencia: value.evidencia, actor: author, createdAt: now };
    }
  }
  await repo.save(detail, revision);
  await repo.operation(input.claveOperacion, action, content, detail, actor);
  return e9View(detail, actor);
}