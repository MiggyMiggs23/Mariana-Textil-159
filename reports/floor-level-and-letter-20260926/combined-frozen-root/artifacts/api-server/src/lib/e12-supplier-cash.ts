/** Prepared only: no environment override and no implicit activation of E4/E10. */
export const E12_SUPPLIER_CASH_ENABLED = false;
export class E12Error extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export type E12Actor = { id: number; nombre: string; rol: string; ubicacionId: number | null; ip: string };
export type E12Split = { claveOperacion: string; caja: string; fondo?: string; sesionCajaId?: number | null; desbloqueoCaja?: { motivo: string } };
export type E12Override = { motivo: string; usuarioId: number; createdAt: string; saldoAntes: string; egreso: string };
export type E12ReturnKind = "CORRECCION_CAPTURA" | "RECUPERACION_EFECTIVO";
export type E12Return = { claveOperacion: string; naturaleza: E12ReturnKind; motivo: string; reversoProveedorId: number; caja: string; fondo: string; sesionCajaId: number | null; ingresoCajaId: number | null; movimientoFondoId: string | null; createdAt: string };
export type E12Detail = { claveOperacion: string; pagoProveedorId: number; total: string; caja: string; fondo: string; sesionCajaId: number | null; salidaCajaId: number | null; movimientoFondoId: string | null; createdAt: string; desbloqueoCaja: E12Override | null; retorno: E12Return | null };
export type E12Input = { proveedorId: number; importe: string; split: E12Split; fecha?: string | null; referencia?: string | null; notas?: string | null; documentoDirigidoId?: number };
export type E12Session = { id: number; ubicacionId: number; estado: string };
export type E12Payment = { id: number; proveedorId: number; importe: string; tipo: string; formaPago: string | null; fecha: Date | string; usuarioId: number; createdAt: Date | string; referencia?: string | null; notas?: string | null; saldoDisponible?: string; aplicaciones?: unknown[] };
export type E12Result = { pago: E12Payment; efectivoE12: E12Detail };
export interface E12Repository {
  lock(key: string, supplier: number): Promise<void>;
  replay(key: string): Promise<{ actorId: number; content: string; result: E12Result } | undefined>;
  provider(id: number): Promise<boolean>;
  session(id: number | null): Promise<E12Session | undefined>;
  cashBalance(session: E12Session): Promise<string>;
  fundBalance(): Promise<{ saldo: string; versionSaldo: string | null }>;
  payment(input: E12Input, actor: E12Actor): Promise<E12Payment>;
  outflow(session: number, amount: string, supplier: number, key: string, actor: E12Actor, reason: string): Promise<number>;
  fund(amount: string, key: string, actor: E12Actor, reason: string, original?: string, returnKind?: E12ReturnKind): Promise<string>;
  save(detail: E12Detail, actor: E12Actor, key: string, content: string, result: E12Result): Promise<void>;
  original(paymentId: number, supplier: number): Promise<E12Detail | undefined>;
  reverse(paymentId: number, supplier: number, reason: string, actor: E12Actor): Promise<E12Payment>;
  income(session: number, amount: string, payment: number, kind: E12ReturnKind, actor: E12Actor, reason: string): Promise<number>;
  saveReturn(detail: E12Detail, actor: E12Actor, key: string, content: string, result: E12Result): Promise<void>;
}
export function requireE12(enabled = E12_SUPPLIER_CASH_ENABLED): void {
  if (!enabled) throw new E12Error("E12_DISABLED", "E12 aún no está liberado.", 403);
}
/** Defense-in-depth for JSON endpoints and operation replays after a role change. */
export function omitE12PrivateFields<T>(value: T, role: string | undefined): T {
  if (role === "ADMIN") return value;
  if (Array.isArray(value)) return value.map(item => omitE12PrivateFields(item, role)) as T;
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !["efectivoE12", "pagoProveedorIdE12", "e12DesbloqueoCaja"].includes(key))
    .map(([key, item]) => [key, omitE12PrivateFields(item, role)])) as T;
}
export function e12Money(raw: string): bigint {
  if (!/^(0|[1-9]\d*)\.\d{2}$/.test(raw)) throw new E12Error("E12_AMOUNT", "Importe inválido; usa dos decimales.");
  const [whole, decimals] = raw.split(".");
  const value = BigInt(whole!) * 100n + BigInt(decimals!);
  if (value > 999999999999n) throw new E12Error("E12_AMOUNT", "Importe fuera de rango.");
  return value;
}
export const e12Format = (value: bigint) => `${value < 0n ? "-" : ""}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, "0")}`;
export function canonicalE12(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalE12).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalE12(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function e12Key(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new E12Error("E12_KEY", "Se requiere UUID de operación.");
  return value.toLowerCase();
}
export function e12Scope(actor: E12Actor, usesFund = false): void {
  if ((usesFund && actor.rol !== "ADMIN") || (actor.rol !== "ADMIN" && actor.ubicacionId !== 1))
    throw new E12Error("E12_FORBIDDEN", "Pago exclusivamente de Mariana; Fondo exclusivo ADMIN.", 403);
}
export function e12CashGuard(balance: string, amount: string, actor: Pick<E12Actor, "id" | "rol">, override?: { motivo: string }): E12Override | null {
  const negative = balance.startsWith("-");
  const saldo = e12Money(negative ? balance.slice(1) : balance) * (negative ? -1n : 1n);
  const egreso = e12Money(amount);
  if (override && actor.rol !== "ADMIN") throw new E12Error("E12_FORBIDDEN", "Solo ADMIN desbloquea insuficiencia de caja.", 403);
  if (override && (!override.motivo.trim() || override.motivo.trim().length > 1000))
    throw new E12Error("E12_REASON", "Motivo de desbloqueo obligatorio, máximo 1000 caracteres.");
  if (saldo >= egreso) return null;
  if (!override) throw new E12Error("E12_CAJA_INSUFICIENTE", "Saldo de caja insuficiente; requiere desbloqueo ADMIN motivado.", 409);
  return { motivo: override.motivo.trim(), usuarioId: actor.id, createdAt: new Date().toISOString(), saldoAntes: balance, egreso: amount };
}
function replayResult(previous: { actorId: number; content: string; result: E12Result }, actor: E12Actor, content: string): E12Result {
  if (previous.actorId !== actor.id || previous.content !== content)
    throw new E12Error("E12_IDEMPOTENCY_CONFLICT", "La clave ya identifica otro contenido o actor.", 409);
  return previous.result;
}
export async function payE12(repo: E12Repository, actor: E12Actor, input: E12Input, enabled = E12_SUPPLIER_CASH_ENABLED): Promise<E12Result> {
  requireE12(enabled);
  if (!Number.isSafeInteger(input.proveedorId) || input.proveedorId <= 0)
    throw new E12Error("E12_PROVIDER", "ID de proveedor inválido.");
  const key = e12Key(input.split.claveOperacion);
  const cash = e12Money(input.split.caja), fund = e12Money(input.split.fondo ?? "0.00"), total = e12Money(input.importe);
  e12Scope(actor, fund > 0n);
  if (total === 0n || cash + fund !== total) throw new E12Error("E12_SPLIT", "Las partes deben sumar exactamente el pago.");
  if (cash > 0n && (!Number.isInteger(input.split.sesionCajaId) || Number(input.split.sesionCajaId) <= 0))
    throw new E12Error("E12_SESSION_REQUIRED", "La parte caja requiere sesión abierta de Mariana.", 409);
  if (cash === 0n && input.split.sesionCajaId != null) throw new E12Error("E12_SESSION_UNUSED", "Fondo puro no lleva sesión de caja.");
  if (cash === 0n && input.split.desbloqueoCaja) throw new E12Error("E12_OVERRIDE_UNUSED", "Fondo no admite desbloqueo de saldo.");
  if (input.split.desbloqueoCaja && actor.rol !== "ADMIN") throw new E12Error("E12_FORBIDDEN", "Solo ADMIN desbloquea caja.", 403);
  const normalized = { ...input, split: { ...input.split, claveOperacion: key, fondo: e12Format(fund), sesionCajaId: input.split.sesionCajaId ?? null } };
  const content = canonicalE12({ accion: "PAGO", input: normalized });
  await repo.lock(key, input.proveedorId);
  const previous = await repo.replay(key);
  if (previous) return replayResult(previous, actor, content);
  if (!await repo.provider(input.proveedorId)) throw new E12Error("E12_PROVIDER", "Proveedor inexistente o inactivo.", 404);
  let session: E12Session | undefined, override: E12Override | null = null;
  if (cash > 0n) {
    session = await repo.session(input.split.sesionCajaId!);
    if (!session || session.ubicacionId !== 1 || session.estado !== "ABIERTA")
      throw new E12Error("E12_SESSION_CLOSED", "Se requiere sesión abierta de Mariana.", 409);
    override = e12CashGuard(await repo.cashBalance(session), input.split.caja, actor, input.split.desbloqueoCaja);
  }
  if (fund > 0n) {
    const balance = await repo.fundBalance();
    if (balance.saldo.startsWith("-") || e12Money(balance.saldo) < fund)
      throw new E12Error("E12_FONDO_INSUFICIENTE", "El retiro no puede dejar Fondo negativo.", 409);
  }
  const payment = await repo.payment(normalized, actor);
  const reason = `Pago proveedor ${input.proveedorId}, movimiento ${payment.id}`;
  const outflow = cash > 0n ? await repo.outflow(session!.id, input.split.caja, input.proveedorId, key, actor, reason) : null;
  const fundMovement = fund > 0n ? await repo.fund(e12Format(fund), key, actor, reason) : null;
  const detail: E12Detail = {
    claveOperacion: key, pagoProveedorId: payment.id, total: input.importe,
    caja: input.split.caja, fondo: e12Format(fund), sesionCajaId: session?.id ?? null,
    salidaCajaId: outflow, movimientoFondoId: fundMovement, createdAt: new Date().toISOString(), desbloqueoCaja: override, retorno: null,
  };
  const result = { pago: payment, efectivoE12: detail };
  await repo.save(detail, actor, key, content, result);
  return result;
}
export async function returnE12(repo: E12Repository, actor: E12Actor, input: {
  proveedorId: number; pagoId: number; motivo: string; claveOperacion: string; naturaleza: E12ReturnKind;
}, enabled = E12_SUPPLIER_CASH_ENABLED): Promise<E12Result> {
  requireE12(enabled); e12Scope(actor);
  const key = e12Key(input.claveOperacion);
  if (!input.motivo.trim() || input.motivo.length > 1000 || !["CORRECCION_CAPTURA", "RECUPERACION_EFECTIVO"].includes(input.naturaleza))
    throw new E12Error("E12_REASON", "Naturaleza y motivo del retorno son obligatorios.");
  const content = canonicalE12({ accion: "RETORNO", ...input, claveOperacion: key, motivo: input.motivo.trim() });
  await repo.lock(key, input.proveedorId);
  const original = await repo.original(input.pagoId, input.proveedorId);
  if (!original) throw new E12Error("E12_NOT_FOUND", "Pago E12 no encontrado.", 404);
  e12Scope(actor, e12Money(original.fondo) > 0n);
  const previous = await repo.replay(key);
  if (previous) return replayResult(previous, actor, content);
  if (original.retorno) throw new E12Error("E12_ALREADY_RETURNED", "El pago ya tiene retorno completo.", 409);
  let session: E12Session | undefined;
  if (e12Money(original.caja) > 0n) {
    session = await repo.session(null);
    if (!session || session.ubicacionId !== 1 || session.estado !== "ABIERTA")
      throw new E12Error("E12_SESSION_CLOSED", "El retorno a caja exige sesión actual abierta de Mariana.", 409);
  }
  const reverse = await repo.reverse(input.pagoId, input.proveedorId, input.motivo.trim(), actor);
  const income = session ? await repo.income(session.id, original.caja, input.pagoId, input.naturaleza, actor, input.motivo.trim()) : null;
  const fundMovement = original.movimientoFondoId
    ? await repo.fund(original.fondo, key, actor, input.motivo.trim(), original.movimientoFondoId, input.naturaleza) : null;
  const detail = { ...original, retorno: {
    claveOperacion: key, naturaleza: input.naturaleza, motivo: input.motivo.trim(), reversoProveedorId: reverse.id,
    caja: original.caja, fondo: original.fondo, sesionCajaId: session?.id ?? null, ingresoCajaId: income,
    movimientoFondoId: fundMovement, createdAt: new Date().toISOString(),
  } };
  const result = { pago: reverse, efectivoE12: detail };
  await repo.saveReturn(detail, actor, key, content, result);
  return result;
}