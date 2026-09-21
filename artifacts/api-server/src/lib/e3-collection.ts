import { createHash } from "node:crypto";
import { z } from "zod";
import { centsToMoney, projectCreditLedger, type CreditLedgerMovement } from "./credit-allocation";
import { canonicalCreditContent, type CreditEvidenceInput } from "./credit-evidence-contract";

/** Source controlled, independent from E1 cash/refund/retained gates. */
export const E3_ENABLED = false;
export const E3_DIRECTED_ENABLED = false;
export class E3Error extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
export const e3InputSchema = z.object({
  clienteId: z.number().int().positive().max(2147483647),
  importeCentavos: z.number().int().positive().max(999999999999),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
  cuentaDestino: z.enum(["CAJA_FISICA", "CUENTA_FISCAL", "CUENTA_NO_FISCAL"]),
  sitioId: z.number().int().positive().max(2147483647),
  sesionCajaId: z.number().int().positive().nullable(),
  operacionClave: z.string().uuid().transform(s => s.toLowerCase()),
  motivo: z.string().trim().min(1).max(2000).optional(),
  fechaRecepcion: z.string().datetime({ offset: true }).optional(),
  previewToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export type E3Input = z.infer<typeof e3InputSchema>;
export type E3Origin = "CAJA" | "RECAPTURA";
export type E3Actor = { id: number; rol: string };
export type E3Allocation = {
  movimientoVentaId: number; ticketId: number | null; folio: number | null;
  aplicadoCentavos: number; saldoAntesCentavos: number; saldoDespuesCentavos: number;
};
export type E3Preview = {
  previewToken: string; clienteId: number; importeCentavos: number; asignaciones: E3Allocation[];
  remanenteCentavos: number; saldoAFavorCentavos: number; deudaCentavos: number; origen: E3Origin;
};
export type E3Receipt = Omit<E3Preview, "previewToken"> & {
  version: 1; folio: string; movimientoId: number; clienteNombre: string;
  clienteTelefono: string | null; clienteRfc: string | null; sitioNombre: string; actorNombre: string;
  formaPago: E3Input["formaPago"]; cuentaDestino: string; sitioId: number;
  sesionCajaId: number | null; recibidoEn: string; registradoEn: string;
  actorId: number; motivo: string | null;
};
export interface E3State {
  clienteNombre: string;
  clienteTelefono: string | null; clienteRfc: string | null; sitioNombre: string; actorNombre: string;
  movements: CreditLedgerMovement[];
}
export interface E3Transaction {
  /** Locks operation key then shared CUSTOMER_CREDIT namespace; rechecks actor/site/session. */
  lockAndLoad(input: E3Input, origin: E3Origin, actor: E3Actor): Promise<E3State>;
  findReceipt(key: string): Promise<{ intentHash: string; receipt: E3Receipt } | null>;
  findPreview(key: string): Promise<{ intentHash: string } | null>;
  savePreview(key: string, token: string, actorId: number, at: Date, intentHash: string): Promise<void>;
  allocateFolio(sitioId: number): Promise<string>;
  hasPreview(key: string, token: string, actorId: number, at: Date): Promise<boolean>;
  insertMovement(input: E3Input, evidence: CreditEvidenceInput, at: Date, actor: E3Actor): Promise<number>;
  saveReceipt(key: string, intentHash: string, receipt: E3Receipt): Promise<void>;
  saveAllocations(movementId: number, allocations: E3Allocation[]): Promise<void>;
}
export interface E3Repository {
  transaction<T>(work: (tx: E3Transaction) => Promise<T>): Promise<T>;
}
const hash = (value: unknown) => createHash("sha256").update(canonicalCreditContent(value)).digest("hex");

export function parseE3Input(raw: unknown, origin: E3Origin, now: Date): E3Input {
  const input = e3InputSchema.parse(raw);
  if ((input.formaPago === "EFECTIVO") !== (input.cuentaDestino === "CAJA_FISICA")) {
    throw new E3Error("PAYMENT_DESTINATION", "El medio no corresponde a la cuenta.", 400);
  }
  if (origin === "CAJA") {
    if (!input.sesionCajaId || input.fechaRecepcion || input.motivo) {
      throw new E3Error("CAJA_CONTEXT", "Caja requiere sesión abierta y recepción actual; no permite recapturas.", 400);
    }
  } else if (input.sesionCajaId !== null || !input.motivo || !input.fechaRecepcion ||
      new Date(input.fechaRecepcion).getTime() > now.getTime()) {
    throw new E3Error("RECAPTURE_CONTEXT", "Recaptura exige motivo, fecha no futura y ninguna sesión.", 400);
  }
  return input;
}
export function e3Evidence(input: E3Input, origin: E3Origin): CreditEvidenceInput {
  return {
    naturaleza: origin === "CAJA" ? "INGRESO_FISICO" : "CORRECCION_CONTABLE",
    sitioOrigenId: input.sitioId, operacionClave: input.operacionClave,
    // Operational Caja association is in the receipt; E1 bank money is NEVER cash.
    sesionCajaId: origin === "CAJA" && input.formaPago === "EFECTIVO" ? input.sesionCajaId : null,
    notaOrigenId: null, origenJustificacion: origin === "RECAPTURA" ? input.motivo! : null,
  };
}
function intent(input: E3Input, origin: E3Origin, actor: E3Actor) {
  const { previewToken: _token, ...body } = input;
  return { body, origin, actorId: actor.id };
}
function projection(state: E3State, input: E3Input, origin: E3Origin, at: Date, sourceId: number) {
  const p = projectCreditLedger([...state.movements, {
    id: sourceId, ticketId: null, tipo: "ABONO", importe: centsToMoney(-input.importeCentavos), createdAt: at,
  }]);
  const asignaciones = p.allocations.filter(a => a.sourceId === sourceId).map(a => {
    const charge = p.allCharges.find(c => c.movimientoId === a.targetId)!;
    return {
      movimientoVentaId: a.targetId, ticketId: charge.ticketId, folio: charge.folio,
      aplicadoCentavos: a.appliedCents, saldoAntesCentavos: a.balanceBeforeCents, saldoDespuesCentavos: a.balanceAfterCents,
    };
  });
  return {
    clienteId: input.clienteId, importeCentavos: input.importeCentavos, asignaciones,
    remanenteCentavos: input.importeCentavos - asignaciones.reduce((n, a) => n + a.aplicadoCentavos, 0),
    saldoAFavorCentavos: p.overpaymentCents, deudaCentavos: p.balanceCents, origen: origin,
  };
}
function previewOf(state: E3State, input: E3Input, origin: E3Origin, actor: E3Actor, now: Date): E3Preview {
  const p = projection(state, input, origin, new Date(input.fechaRecepcion ?? now), Number.MAX_SAFE_INTEGER);
  // Includes immutable ledger inputs and displayed results, never a wall-clock timestamp for Caja.
  return { ...p, previewToken: hash({ intent: intent(input, origin, actor), state, p }) };
}
export async function previewE3(repo: E3Repository, input: E3Input, origin: E3Origin, actor: E3Actor, now: Date) {
  return repo.transaction(async tx => {
    const preview = previewOf(await tx.lockAndLoad(input, origin, actor), input, origin, actor, now);
    const intentHash = hash(intent(input, origin, actor));
    const bound = await tx.findPreview(input.operacionClave);
    if (bound && bound.intentHash !== intentHash) throw new E3Error("IDEMPOTENCY_CONFLICT", "La clave de vista previa ya está vinculada a otro actor o intención.");
    const receipt = await tx.findReceipt(input.operacionClave);
    if (receipt && receipt.intentHash !== intentHash) throw new E3Error("IDEMPOTENCY_CONFLICT", "La clave identifica un recibo de otra intención.");
    await tx.savePreview(input.operacionClave, preview.previewToken, actor.id, now, intentHash);
    return preview;
  });
}
export async function confirmE3(repo: E3Repository, input: E3Input, origin: E3Origin, actor: E3Actor, now: Date) {
  if (!input.previewToken) throw new E3Error("PREVIEW_REQUIRED", "Confirma una vista previa vigente.", 400);
  return repo.transaction(async tx => {
    const state = await tx.lockAndLoad(input, origin, actor);
    const intentHash = hash(intent(input, origin, actor));
    const previous = await tx.findReceipt(input.operacionClave);
    if (previous) {
      if (previous.intentHash !== intentHash) throw new E3Error("IDEMPOTENCY_CONFLICT", "La clave ya corresponde a otra intención.");
      return { recibo: validateE3Receipt(previous.receipt), replay: true };
    }
    const preview = previewOf(state, input, origin, actor, now);
    if (input.previewToken !== preview.previewToken) throw new E3Error("PREVIEW_STALE", "Cambió el estado. Revisa una nueva vista previa.");
    if (!await tx.hasPreview(input.operacionClave, input.previewToken, actor.id, now)) {
      throw new E3Error("PREVIEW_REQUIRED", "La vista previa no fue emitida para este actor o ya venció.", 409);
    }
    const at = new Date(input.fechaRecepcion ?? now);
    const movimientoId = await tx.insertMovement(input, e3Evidence(input, origin), at, actor);
    const result = projection(state, input, origin, at, movimientoId);
    // In particular, historical equal timestamps must not silently change the displayed split.
    const { previewToken: _token, ...expected } = preview;
    if (hash(result) !== hash(expected)) throw new E3Error("PREVIEW_STALE", "Cambió el reparto al registrar.");
    const receipt: E3Receipt = {
      ...result, version: 1, folio: await tx.allocateFolio(input.sitioId), movimientoId,
      clienteNombre: state.clienteNombre, formaPago: input.formaPago, cuentaDestino: input.cuentaDestino,
      clienteTelefono: state.clienteTelefono, clienteRfc: state.clienteRfc, sitioNombre: state.sitioNombre, actorNombre: state.actorNombre,
      sitioId: input.sitioId, sesionCajaId: origin === "CAJA" ? input.sesionCajaId : null,
      recibidoEn: at.toISOString(), registradoEn: now.toISOString(), actorId: actor.id, motivo: input.motivo ?? null,
    };
    await tx.saveAllocations(movimientoId, result.asignaciones);
    await tx.saveReceipt(input.operacionClave, intentHash, receipt);
    return { recibo: receipt, replay: false };
  });
}
const nonnegative = z.number().int().nonnegative();
const receiptSchema = z.object({
  version: z.literal(1), folio: z.string().startsWith("E3-"), movimientoId: z.number().int().positive(),
  clienteId: z.number().int().positive(), clienteNombre: z.string().min(1), importeCentavos: z.number().int().positive(),
  clienteTelefono: z.string().nullable(), clienteRfc: z.string().nullable(), sitioNombre: z.string().min(1), actorNombre: z.string().min(1),
  formaPago: z.enum(["EFECTIVO", "TRANSFERENCIA"]), cuentaDestino: z.string().min(1), sitioId: z.number().int().positive(),
  sesionCajaId: z.number().int().positive().nullable(), recibidoEn: z.string().datetime(), registradoEn: z.string().datetime(),
  actorId: z.number().int().positive(), origen: z.enum(["CAJA", "RECAPTURA"]), motivo: z.string().nullable(),
  asignaciones: z.array(z.object({
    movimientoVentaId: z.number().int().positive(), ticketId: z.number().int().positive().nullable(),
    folio: z.number().nullable(), aplicadoCentavos: nonnegative, saldoAntesCentavos: nonnegative, saldoDespuesCentavos: nonnegative,
  })), remanenteCentavos: nonnegative, saldoAFavorCentavos: nonnegative, deudaCentavos: nonnegative,
});
export function validateE3Receipt(value: unknown): E3Receipt {
  const result = receiptSchema.safeParse(value);
  if (!result.success) throw new E3Error("RECEIPT_INCOMPLETE", `Evidencia incompleta: ${result.error.issues.map(i => i.path.join(".")).join(", ")}. No se reconstruye.`);
  const row = result.data;
  if (row.asignaciones.reduce((sum, a) => sum + a.aplicadoCentavos, row.remanenteCentavos) !== row.importeCentavos ||
      row.asignaciones.some(a => a.saldoAntesCentavos - a.aplicadoCentavos !== a.saldoDespuesCentavos) ||
      (row.origen === "RECAPTURA" && (row.sesionCajaId !== null || !row.motivo?.trim())) ||
      (row.origen === "CAJA" && row.sesionCajaId === null)) {
    throw new E3Error("RECEIPT_INCOMPLETE", "Evidencia monetaria/origen inconsistente. No se reconstruye.");
  }
  return result.data;
}
/** Prepared policy only; pending receipt producer stays independently CLOSED until E5/E7. */
export function assertE3DirectedExact(isAdmin: boolean, amount: number, pending: readonly number[]) {
  if (!pending.length || pending.some(n => !Number.isSafeInteger(n) || n <= 0) ||
      (!isAdmin && amount !== pending.reduce((a, b) => a + b, 0))) {
    throw new E3Error("P6_EXACT_REQUIRED", "Sin ADMIN se exige el saldo pendiente exacto de las notas.");
  }
}