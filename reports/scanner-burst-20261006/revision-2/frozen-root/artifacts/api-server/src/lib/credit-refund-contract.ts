import { canonicalCreditMoney, canonicalCreditOperationKey, CreditEvidenceError } from "./credit-evidence-contract";

/** Authorization to build is NOT authorization to activate. No runtime override. */
export const CREDIT_REFUNDS_ENABLED = false;
export const CREDIT_REFUND_INACTIVE_COPY = "Devolución física no disponible: pendiente de autorización de activación E2.";
export const CREDIT_REFUND_OPTIONS_WARNING = "Estas recepciones son referencias documentales, no una declaración de saldo disponible ni de elegibilidad. La devolución exige validar íntegramente el origen, su historial y la evidencia positiva al ejecutar el flujo autorizado.";
export type CreditRefundOptions = {
  enabled: false;
  motivoInactivo: string;
  advertencia: string;
  candidatas: Array<{
    origen: "ABONO" | "COBRO_RETENIDO"; abonoId: number | null; cobroClave: string | null;
    folio: number | null; referencia: string | null; importe: string;
    sitioOrigenId: number; sitioNombre: string;
  }>;
  /** All ADMIN-authorized stores open today; may differ from candidate's historical site.
   * POST sitioOrigenId comes from the selected session, NOT from the candidate. */
  sesiones: Array<{ id: number; sitioOrigenId: number; sitioNombre: string; abiertaAt: string }>;
};
export function assertCreditRefundEnabled(): void {
  if (!CREDIT_REFUNDS_ENABLED) throw new CreditEvidenceError(CREDIT_REFUND_INACTIVE_COPY, 403);
}
export type CreditRefundInput = {
  operacionClave: string; clienteId: number; origen: "ABONO" | "COBRO_RETENIDO";
  abonoId: number | null; cobroClave: string | null; importe: string;
  sitioOrigenId: number; sesionCajaId: number; motivo: string;
};
export type CreditRefundReply = {
  operacionClave: string; salidaId: number; reversoId: number | null;
  importe: string; sesionCajaId: number;
};
function id(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 2147483647) throw new CreditEvidenceError("E2: identificador inválido.");
  return Number(value);
}
export function readCreditRefundInput(clienteId: number, body: unknown): CreditRefundInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CreditEvidenceError("E2: solicitud inválida.");
  const b = body as Record<string, unknown>;
  if (b.origen !== "ABONO" && b.origen !== "COBRO_RETENIDO") throw new CreditEvidenceError("E2: origen inválido.");
  const motivo = typeof b.motivo === "string" ? b.motivo.trim() : "";
  if (!motivo || motivo.length > 500) throw new CreditEvidenceError("E2: motivo obligatorio (máximo 500 caracteres).");
  const importe = canonicalCreditMoney(b.importe);
  if (Number(importe) <= 0) throw new CreditEvidenceError("E2: importe positivo obligatorio.");
  if ((b.origen === "ABONO" && b.cobroClave != null) || (b.origen === "COBRO_RETENIDO" && b.abonoId != null)) throw new CreditEvidenceError("E2: declara un solo origen.");
  return { clienteId: id(clienteId), operacionClave: canonicalCreditOperationKey(b.operacionClave),
    origen: b.origen, abonoId: b.origen === "ABONO" ? id(b.abonoId) : null,
    cobroClave: b.origen === "COBRO_RETENIDO" ? canonicalCreditOperationKey(b.cobroClave) : null,
    importe, motivo, sitioOrigenId: id(b.sitioOrigenId), sesionCajaId: id(b.sesionCajaId) };
}
export function refundSourceKey(input: Pick<CreditRefundInput, "origen" | "abonoId" | "cobroClave">): string {
  return input.origen === "ABONO" ? `ABONO:${input.abonoId}` : `COBRO_RETENIDO:${input.cobroClave}`;
}
export function assertRefundReplay(stored: unknown, input: CreditRefundInput): void {
  // Compare normalized fields, independent of JSONB key ordering.
  if (!stored || Object.entries(input).some(([k, v]) => (stored as Record<string, unknown>)[k] !== v)) {
    throw new CreditEvidenceError("E2: UUID reutilizado con contenido diferente.", 409);
  }
}