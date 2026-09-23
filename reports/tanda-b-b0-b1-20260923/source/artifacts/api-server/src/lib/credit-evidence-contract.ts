/** Database-free E1 validation. No permissive legacy defaults and no activation. */
import { E3_ORDINARY_CASH_ENABLED } from "./e3-ordinary-cash-release";

export const CREDIT_NATURES = [
  "INGRESO_FISICO", "DEVOLUCION_FISICA", "CORRECCION_CONTABLE", "OPERACION_CREDITO_SIN_DINERO",
] as const;
export type CreditNature = typeof CREDIT_NATURES[number];
export type CreditProducer = "VENTA_CREDITO" | "CANCELACION_VENTA_CREDITO" | "AJUSTE_MANUAL" |
  "BAJA_INCOBRABLE" | "ABONO_ORDINARIO" | "ABONO_DIRIGIDO" | "REVERSO_ABONO" | "COBRO_PENDIENTE";
export interface CreditEvidenceInput {
  sitioOrigenId: number;
  naturaleza: CreditNature;
  operacionClave: string;
  sesionCajaId?: number | null;
  notaOrigenId?: number | null;
  origenJustificacion?: string | null;
}
export class CreditEvidenceError extends Error {
  readonly statusCode: number;
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "CreditEvidenceError";
    this.statusCode = status;
  }
}
/** Independent, source-controlled release gates. Authorization to receive cash
 * never authorizes returning it. Neither can be opened by env/request data. */
export const CREDIT_CASH_INCOME_CAPTURE_ENABLED = false;
export const CREDIT_CASH_RETURN_CAPTURE_ENABLED = false;
export const CREDIT_PENDING_RECEIPTS_ENABLED = false;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canonicalCreditOperationKey(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new CreditEvidenceError("E1: operacionClave debe ser UUID.");
  return value.toLowerCase();
}

function positiveId(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
    throw new CreditEvidenceError(`E1: ${field} debe ser un identificador válido.`);
  }
  return value;
}
export function readCreditEvidenceInput(body: unknown): CreditEvidenceInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CreditEvidenceError("Faltan datos E1 de origen, naturaleza y operación. Actualiza la aplicación y vuelve a intentar.");
  }
  const value = body as Record<string, unknown>;
  if (value.sitioOrigenId == null || value.naturaleza == null || value.operacionClave == null) {
    throw new CreditEvidenceError("Faltan datos E1 de origen, naturaleza y operación. Actualiza la aplicación y vuelve a intentar.");
  }
  if (!CREDIT_NATURES.includes(value.naturaleza as CreditNature)) throw new CreditEvidenceError("E1: naturaleza desconocida.");
  if (value.origenJustificacion != null && typeof value.origenJustificacion !== "string") {
    throw new CreditEvidenceError("E1: justificación de origen inválida.");
  }
  // Deliberately whitelist: credentials, request metadata and arbitrary body keys never enter evidence.
  return {
    sitioOrigenId: positiveId(value.sitioOrigenId, "sitioOrigenId"),
    naturaleza: value.naturaleza as CreditNature,
    operacionClave: canonicalCreditOperationKey(value.operacionClave),
    sesionCajaId: value.sesionCajaId == null ? null : positiveId(value.sesionCajaId, "sesionCajaId"),
    notaOrigenId: value.notaOrigenId == null ? null : positiveId(value.notaOrigenId, "notaOrigenId"),
    origenJustificacion: typeof value.origenJustificacion === "string" ? value.origenJustificacion.trim() || null : null,
  };
}

/** Credit-only request adapters must report legacy metadata before generic Zod
 * errors. Never use this wrapper for a noncredit operation. */
export function readCreditEvidenceBeforeBody<T>(
  value: unknown, parseBody: (value: unknown) => T,
): { evidence: CreditEvidenceInput; body: T } {
  const evidence = readCreditEvidenceInput(value);
  return { evidence, body: parseBody(value) };
}

export function assertCreditProducerNature(productor: CreditProducer, naturaleza: CreditNature): void {
  const allowed: Record<CreditProducer, readonly CreditNature[]> = {
    VENTA_CREDITO: ["OPERACION_CREDITO_SIN_DINERO"],
    CANCELACION_VENTA_CREDITO: ["OPERACION_CREDITO_SIN_DINERO"],
    AJUSTE_MANUAL: ["CORRECCION_CONTABLE"], BAJA_INCOBRABLE: ["CORRECCION_CONTABLE"],
    ABONO_ORDINARIO: ["INGRESO_FISICO", "CORRECCION_CONTABLE"],
    ABONO_DIRIGIDO: ["INGRESO_FISICO", "CORRECCION_CONTABLE"],
    REVERSO_ABONO: ["DEVOLUCION_FISICA", "CORRECCION_CONTABLE"],
    COBRO_PENDIENTE: ["INGRESO_FISICO"],
  };
  if (!allowed[productor]?.includes(naturaleza)) throw new CreditEvidenceError("E1: naturaleza incompatible con el productor.");
}

export type CreditCashCapturePermissions = Readonly<{ income: boolean; returns: boolean }>;
export type CreditMovementKind = "VENTA_CREDITO" | "ABONO" | "REVERSO" | "AJUSTE" | "COBRO_RETENIDO";

const CREDIT_CASH_CAPTURE_PERMISSIONS: CreditCashCapturePermissions = {
  income: CREDIT_CASH_INCOME_CAPTURE_ENABLED,
  returns: CREDIT_CASH_RETURN_CAPTURE_ENABLED,
};

/** Pure policy seam used by offline rollback proofs. Production callers must use
 * assertCreditCaptureEnabled, whose permissions are the constants above. */
export function assertCreditCashCapturePolicy(
  input: CreditEvidenceInput,
  formaPago: string | null | undefined,
  productor: CreditProducer,
  tipo: CreditMovementKind,
  permissions: CreditCashCapturePermissions,
): void {
  if (formaPago !== "EFECTIVO") return;
  if (input.naturaleza === "INGRESO_FISICO") {
    if (!["ABONO_ORDINARIO", "ABONO_DIRIGIDO"].includes(productor) || tipo !== "ABONO") {
      throw new CreditEvidenceError("E3: ingreso físico en efectivo exige productor ABONO y movimiento ABONO.");
    }
    if (!permissions.income) {
      throw new CreditEvidenceError("E3: la captura de ingreso nuevo de efectivo de crédito permanece deshabilitada.", 403);
    }
  }
  if (input.naturaleza === "DEVOLUCION_FISICA") {
    if (productor !== "REVERSO_ABONO" || tipo !== "REVERSO") {
      throw new CreditEvidenceError("E2: devolución física exige productor REVERSO_ABONO y movimiento REVERSO.");
    }
    if (!permissions.returns) {
      throw new CreditEvidenceError("E2: la captura de devolución nueva de efectivo de crédito permanece deshabilitada.", 403);
    }
  }
}

export function assertCreditCaptureEnabled(
  input: CreditEvidenceInput,
  formaPago: string | null | undefined,
  productor: CreditProducer,
  tipo: CreditMovementKind,
): void {
  const ordinaryE3 = E3_ORDINARY_CASH_ENABLED && productor === "ABONO_ORDINARIO"
    && tipo === "ABONO" && input.naturaleza === "INGRESO_FISICO";
  assertCreditCashCapturePolicy(input, formaPago, productor, tipo,
    ordinaryE3 ? { ...CREDIT_CASH_CAPTURE_PERMISSIONS, income: true } : CREDIT_CASH_CAPTURE_PERMISSIONS);
}

export function assertCreditPhysicalContext(input: CreditEvidenceInput, medio?: string | null, cuenta?: string | null): void {
  const physical = input.naturaleza === "INGRESO_FISICO" || input.naturaleza === "DEVOLUCION_FISICA";
  if (!physical) {
    if (input.sesionCajaId != null) throw new CreditEvidenceError("E1: una operación sin dinero real no puede imputar sesión de caja.");
    if (input.naturaleza === "CORRECCION_CONTABLE" && !input.origenJustificacion?.trim()) {
      throw new CreditEvidenceError("E1: corrección/recaptura exige justificación explícita.");
    }
  } else if (medio === "EFECTIVO") {
    if (cuenta !== "CAJA_FISICA" || input.sesionCajaId == null) throw new CreditEvidenceError("E1: efectivo requiere CAJA_FISICA y sesión explícita.");
  } else if (medio === "TRANSFERENCIA" || medio === "FACTURADO") {
    if (!["CUENTA_FISCAL", "CUENTA_NO_FISCAL"].includes(cuenta ?? "") || input.sesionCajaId != null) {
      throw new CreditEvidenceError("E1: transferencia/facturado requiere cuenta bancaria y ninguna sesión.");
    }
  } else {
    throw new CreditEvidenceError("E1: medio físico no soportado.");
  }
}

/** Exact cents, never floating-point rounding or silent precision loss. */
export function canonicalCreditMoney(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") throw new CreditEvidenceError("E1: importe inválido.");
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100)) {
    throw new CreditEvidenceError("E1: importe fuera de precisión segura.");
  }
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new CreditEvidenceError("E1: importe debe tener como máximo dos decimales.");
  const cents = BigInt(match[2]!) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  if (cents > 999999999999n) throw new CreditEvidenceError("E1: importe fuera de numeric(12,2).");
  return `${match[1] && cents !== 0n ? "-" : ""}${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

/** Explicit dates only; timestamp strings are not guessed from free-form text.
 * Callers normalize named monetary fields with canonicalCreditMoney first. */
export function canonicalCreditContent(value: unknown): string {
  const ancestors = new Set<object>();
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) throw new CreditEvidenceError("E1: número canónico inválido.");
      return Object.is(item, -0) ? 0 : item;
    }
    if (item instanceof Date) {
      if (!Number.isFinite(item.getTime())) throw new CreditEvidenceError("E1: fecha canónica inválida.");
      return item.toISOString();
    }
    if (!item || typeof item !== "object") throw new CreditEvidenceError("E1: contenido canónico no es JSON.");
    if (ancestors.has(item)) throw new CreditEvidenceError("E1: contenido canónico circular.");
    ancestors.add(item);
    try {
      if (Array.isArray(item)) {
        if (Object.keys(item).length !== item.length) throw new CreditEvidenceError("E1: arreglo canónico incompleto.");
        return item.map(normalize);
      }
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
        throw new CreditEvidenceError("E1: objeto canónico inválido.");
      }
      const result: Record<string, unknown> = Object.create(null);
      for (const key of Object.keys(item).sort()) {
        if (/password|credential|credencial|sessiontoken|session_token|authorization|cookie|secret|token/i.test(key)) {
          throw new CreditEvidenceError("E1: las credenciales no pertenecen al contenido canónico.");
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!("value" in descriptor)) throw new CreditEvidenceError("E1: contenido canónico con accesor.");
        result[key] = normalize(descriptor.value);
      }
      return result;
    } finally {
      ancestors.delete(item);
    }
  };
  return JSON.stringify(normalize(value));
}

export function assertCreditOperationContentEqual(stored: unknown, incoming: unknown): void {
  if (canonicalCreditContent(stored) !== canonicalCreditContent(incoming)) {
    throw new CreditEvidenceError("E1: la clave ya fue usada con otro contenido, actor o naturaleza.", 409);
  }
}

export function assertCreditActorAccess(
  actor: { activo: boolean; rol: string; ubicacionId: number | null } | null | undefined,
  sitioOrigenId: number,
): void {
  if (!actor?.activo || !["ADMIN", "SUPERVISOR", "CAJA", "TERMINAL"].includes(actor.rol)) {
    throw new CreditEvidenceError("E1: actor inactivo o sin rol operativo autorizado.", 403);
  }
  if (actor.rol !== "ADMIN" && actor.ubicacionId !== sitioOrigenId) {
    throw new CreditEvidenceError("E1: no tienes permiso para operar en el sitio de origen.", 403);
  }
}

export interface CreditOperationClaim {
  productor: CreditProducer;
  clave: string;
  naturaleza: CreditNature;
  actorId: number;
  contenido: Record<string, unknown>;
}
export interface CreditOperationRecord {
  productor: CreditProducer;
  clave: string;
  naturaleza: CreditNature;
  usuarioId: number;
  solicitudCanonica: Record<string, unknown>;
}
/** Injectable atomic storage protocol. Production adapter uses INSERT ON CONFLICT
 * DO NOTHING; no process-local map or mutex provides production idempotency. */
export interface CreditOperationStore<M> {
  loadOperation(productor: CreditProducer, clave: string): Promise<Omit<CreditOperationRecord, "productor"> | null>;
  insertOperation(record: CreditOperationRecord): Promise<boolean>;
  loadMovement(productor: CreditProducer, clave: string): Promise<M | null>;
}
export type CreditOperationResult<M> = { replay: true; movement: M } | { replay: false; movement: null };
export async function claimCreditOperationCore<M>(
  store: CreditOperationStore<M>, input: CreditOperationClaim,
): Promise<CreditOperationResult<M>> {
  if (input.productor === "COBRO_PENDIENTE" && !CREDIT_PENDING_RECEIPTS_ENABLED) {
    throw new CreditEvidenceError("E1: el modo de cobro retenido permanece deshabilitado.", 403);
  }
  const clave = canonicalCreditOperationKey(input.clave);
  positiveId(input.actorId, "actorId");
  const solicitudCanonica = JSON.parse(canonicalCreditContent({
    productor: input.productor, naturaleza: input.naturaleza, actorId: input.actorId, intent: input.contenido,
  })) as Record<string, unknown>;
  const prior = await store.loadOperation(input.productor, clave);
  if (prior) assertCreditOperationContentEqual(prior.solicitudCanonica, solicitudCanonica);
  if (!prior) assertCreditProducerNature(input.productor, input.naturaleza);
  const inserted = !prior && await store.insertOperation({
    productor: input.productor, clave, naturaleza: input.naturaleza, usuarioId: input.actorId, solicitudCanonica,
  });
  if (inserted) return { replay: false, movement: null };
  const stored = await store.loadOperation(input.productor, clave);
  if (!stored) throw new CreditEvidenceError("E1: no se pudo recuperar la operación; reintenta.", 409);
  assertCreditOperationContentEqual(stored.solicitudCanonica, solicitudCanonica);
  if (stored.usuarioId !== input.actorId || stored.naturaleza !== input.naturaleza) {
    throw new CreditEvidenceError("E1: actor/naturaleza distintos en la misma clave.", 409);
  }
  const movement = await store.loadMovement(input.productor, clave);
  if (!movement) throw new CreditEvidenceError("E1: operación existente sin movimiento recuperable; requiere revisión.", 409);
  return { replay: true, movement };
}