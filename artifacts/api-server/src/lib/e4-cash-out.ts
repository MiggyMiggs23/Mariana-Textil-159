/** E4 is prepared only. Release requires separate authorization and prepared SQL. */
export const E4_CASH_OUT_ENABLED = false;
export const E4_MARIANA_LOCATION_ID = 1;

/** Select the existing operational permission only for E4 capture/list/catalog.
 * Review and administrative cuts keep their own cortes permission unchanged. */
export function e4CashOutPermission<T>(
  action: "ver" | "crear",
  requirePermission: (module: string, action: "ver" | "crear") => T,
  enabled = E4_CASH_OUT_ENABLED,
): T {
  return requirePermission(enabled ? "cobros_pagos" : "cortes", action);
}

export class E4CashOutError extends Error {
  constructor(message: string, public code: string, public status = 400) { super(message); }
}
export type E4Actor = { id: number; rol: string; ubicacionId: number | null };
export type E4Kind = "EXTRAORDINARIA" | "PROVEEDOR";
export type E4Action = "ACEPTAR" | "RECLAMAR" | "RESPONDER";
export type E4State = "PENDIENTE" | "RECLAMADA" | "RESPONDIDA" | "ACEPTADA" | "NO_APLICA";
export type E4Event = {
  accion: E4Action; version: number; usuarioId: number; createdAt: string;
  explicacion: string | null; comprobanteUrl: string | null;
};
export type E4Revision = {
  tipo: E4Kind; estado: E4State; version: number; claveOperacion: string; historial: E4Event[];
};
export type E4CreateInput = {
  sesionCajaId: number; monto: string; motivo: string;
  proveedorId?: number | null; cuentaOrigen: "CAJA_FISICA" | "CUENTA_NO_FISCAL" | "CUENTA_FISCAL";
  tipo?: E4Kind; claveOperacion?: string; ip: string;
  desbloqueoCajaE12?: { motivo: string };
};
export type E4ReviewInput = {
  sesionCajaId: number; salidaId: number; accion: E4Action; version: number;
  claveOperacion: string; explicacion?: string; comprobanteUrl?: string | null; ip: string;
};
export type E4Salida = {
  id: number; sesionCajaId: number; monto: string; motivo: string;
  proveedorId: number | null; cuentaOrigen: E4CreateInput["cuentaOrigen"];
  creadoPorId: number; createdAt: Date | string; e4: E4Revision;
};
export type E4Session = { id: number; ubicacionId: number; estado: string; esTienda: boolean };
export type E4Operation = { actorId: number; request: string; response: E4Salida | E4Revision };
/** Every production method uses the same DB transaction; tests provide a synthetic repository. */
export interface E4Repository {
  lockOperation(key: string): Promise<void>;
  session(id: number): Promise<E4Session | undefined>;
  operation(key: string): Promise<E4Operation | undefined>;
  providerActive(id: number): Promise<boolean>;
  insert(input: E4CreateInput & { tipo: E4Kind; claveOperacion: string }, actor: E4Actor): Promise<E4Salida>;
  lockSalida(id: number): Promise<{ salida: E4Salida; ubicacionId: number } | undefined>;
  updateRevision(id: number, revision: E4Revision): Promise<void>;
  saveOperation(key: string, salidaId: number, operation: E4Operation): Promise<void>;
  audit(salidaId: number, actorId: number, action: string, data: unknown, ip: string): Promise<void>;
}
function fail(message: string, code: string, status = 400): never {
  throw new E4CashOutError(message, code, status);
}
export function requireE4(enabled = E4_CASH_OUT_ENABLED): void {
  if (!enabled) fail("Las salidas extraordinarias E4 aún no están liberadas.", "E4_DISABLED", 403);
}
export function assertE4Actor(actor: E4Actor, roles: string[]): void {
  if (!roles.includes(actor.rol)) fail("Rol no autorizado para esta operación de caja.", "E4_ROLE_FORBIDDEN", 403);
}
function scope(actor: E4Actor, location: number): void {
  if (actor.rol !== "ADMIN" && actor.ubicacionId !== location)
    fail("Solo puedes operar en tu propia tienda.", "E4_LOCATION_FORBIDDEN", 403);
}
function uuid(value: string | undefined): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    fail("Se requiere una clave UUID de operación.", "E4_INVALID_KEY");
  return value.toLowerCase();
}
function text(value: string | undefined, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail(`La explicación o motivo es obligatorio y admite hasta ${max} caracteres.`, "E4_INVALID_REASON");
  return value.trim();
}
function retry(operation: E4Operation, actor: E4Actor, request: string) {
  if (operation.actorId !== actor.id || operation.request !== request)
    fail("La clave de operación ya se utilizó con otro contenido o actor.", "E4_IDEMPOTENCY_CONFLICT", 409);
  return operation.response;
}
export async function createE4CashOut(
  repo: E4Repository, actor: E4Actor, input: E4CreateInput, enabled = E4_CASH_OUT_ENABLED,
): Promise<E4Salida> {
  requireE4(enabled);
  assertE4Actor(actor, ["ADMIN", "SUPERVISOR", "CAJA"]);
  const claveOperacion = uuid(input.claveOperacion);
  if (input.tipo !== "EXTRAORDINARIA" && input.tipo !== "PROVEEDOR")
    fail("Selecciona explícitamente extraordinaria o proveedor.", "E4_KIND_REQUIRED");
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.monto))
    fail("Monto inválido.", "E4_INVALID_AMOUNT");
  const [whole, fraction = ""] = input.monto.split(".");
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents <= 0n || cents > 999999999999n) fail("Monto fuera de rango.", "E4_INVALID_AMOUNT");
  const monto = `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
  const motivo = text(input.motivo, 500);
  const proveedorId = input.proveedorId ?? null;
  if (!["CAJA_FISICA", "CUENTA_NO_FISCAL", "CUENTA_FISCAL"].includes(input.cuentaOrigen))
    fail("Cuenta de origen inválida.", "E4_INVALID_ACCOUNT");
  if (input.tipo === "EXTRAORDINARIA" && (proveedorId !== null || input.cuentaOrigen !== "CAJA_FISICA"))
    fail("La extraordinaria sale de caja física y no admite proveedor ni Fondo.", "E4_EXTRAORDINARY_ACCOUNT");
  if (input.tipo === "PROVEEDOR" && (!Number.isInteger(proveedorId) || Number(proveedorId) <= 0))
    fail("El pago a proveedor exige un proveedor activo.", "E4_PROVIDER_REQUIRED");
  const normalized = { ...input, monto, motivo, proveedorId, tipo: input.tipo, claveOperacion };
  const request = JSON.stringify({
    kind: "CREAR", sesionCajaId: input.sesionCajaId, monto, motivo, proveedorId,
    cuentaOrigen: input.cuentaOrigen, tipo: input.tipo,
    ...(input.desbloqueoCajaE12 ? { desbloqueoCajaE12: input.desbloqueoCajaE12 } : {}),
  });
  await repo.lockOperation(claveOperacion);
  const session = await repo.session(input.sesionCajaId);
  if (!session) fail("Sesión no encontrada.", "E4_SESSION_NOT_FOUND", 404);
  scope(actor, session.ubicacionId);
  if (!session.esTienda) fail("La salida requiere una tienda.", "E4_STORE_REQUIRED", 403);
  if (input.tipo === "PROVEEDOR" && session.ubicacionId !== E4_MARIANA_LOCATION_ID)
    fail("Solo Mariana registra pagos a proveedor.", "E4_PROVIDER_LOCATION", 403);
  const previous = await repo.operation(claveOperacion);
  if (previous) return retry(previous, actor, request) as E4Salida;
  if (session.estado !== "ABIERTA") fail("La sesión de caja está cerrada.", "E4_SESSION_CLOSED", 409);
  if (proveedorId !== null && !await repo.providerActive(proveedorId))
    fail("El proveedor no existe o está inactivo.", "E4_PROVIDER_INACTIVE");
  const created = await repo.insert(normalized, actor);
  await repo.saveOperation(claveOperacion, created.id, { actorId: actor.id, request, response: created });
  await repo.audit(created.id, actor.id, "SALIDA_DINERO_CAJA", {
    ...created, ubicacionId: session.ubicacionId,
  }, input.ip);
  return created;
}
export async function reviewE4CashOut(
  repo: E4Repository, actor: E4Actor, input: E4ReviewInput, enabled = E4_CASH_OUT_ENABLED,
): Promise<E4Revision> {
  requireE4(enabled);
  assertE4Actor(actor, input.accion === "RESPONDER" ? ["SUPERVISOR"] : ["ADMIN"]);
  if (!["ACEPTAR", "RECLAMAR", "RESPONDER"].includes(input.accion))
    fail("Acción de revisión inválida.", "E4_INVALID_ACTION");
  const key = uuid(input.claveOperacion);
  if (!Number.isInteger(input.version) || input.version < 0) fail("Versión inválida.", "E4_INVALID_VERSION");
  const explicacion = input.accion === "ACEPTAR"
    ? (input.explicacion === undefined ? null : text(input.explicacion, 2000))
    : text(input.explicacion, 2000);
  const comprobanteUrl = input.comprobanteUrl ?? null;
  if (comprobanteUrl !== null) {
    let valid = false;
    try { const url = new URL(comprobanteUrl); valid = url.protocol === "https:" && !url.username && !url.password; } catch { /* invalid */ }
    if (input.accion !== "RESPONDER" || !valid || comprobanteUrl.length > 2000)
      fail("Solo la respuesta admite un enlace HTTPS de comprobante.", "E4_INVALID_PROOF");
  }
  const request = JSON.stringify({
    kind: "REVISAR", sesionCajaId: input.sesionCajaId, salidaId: input.salidaId,
    accion: input.accion, version: input.version, explicacion, comprobanteUrl,
  });
  await repo.lockOperation(key);
  const record = await repo.lockSalida(input.salidaId);
  if (!record || record.salida.sesionCajaId !== input.sesionCajaId)
    fail("Salida E4 no encontrada en esta sesión.", "E4_OUT_NOT_FOUND", 404);
  scope(actor, record.ubicacionId);
  const previous = await repo.operation(key);
  if (previous) return retry(previous, actor, request) as E4Revision;
  const current = record.salida.e4;
  if (current.tipo !== "EXTRAORDINARIA") fail("El proveedor no usa revisión de extraordinarias.", "E4_REVIEW_KIND", 409);
  if (current.version !== input.version) fail("La salida cambió; actualiza antes de decidir.", "E4_VERSION_CONFLICT", 409);
  const allowed = input.accion === "RESPONDER" ? ["RECLAMADA"] : ["PENDIENTE", "RESPONDIDA"];
  if (!allowed.includes(current.estado)) fail("La acción no corresponde al estado actual.", "E4_STATE_CONFLICT", 409);
  const next: E4Revision = {
    ...current,
    estado: input.accion === "ACEPTAR" ? "ACEPTADA" : input.accion === "RECLAMAR" ? "RECLAMADA" : "RESPONDIDA",
    version: current.version + 1,
    historial: [...current.historial, {
      accion: input.accion, version: current.version + 1, usuarioId: actor.id,
      createdAt: new Date().toISOString(), explicacion, comprobanteUrl,
    }],
  };
  await repo.updateRevision(record.salida.id, next);
  await repo.saveOperation(key, record.salida.id, { actorId: actor.id, request, response: next });
  await repo.audit(record.salida.id, actor.id, `E4_${input.accion}`, { antes: current, despues: next }, input.ip);
  return next;
}