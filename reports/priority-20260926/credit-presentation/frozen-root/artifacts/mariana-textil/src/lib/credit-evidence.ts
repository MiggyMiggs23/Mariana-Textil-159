import type { CreditEvidenceInput, CreditNature, CreditMovementEvidence, CreditAttributionInput } from "@workspace/api-client-react";

export const CREDIT_CASH_CAPTURE_ENABLED = false;
export const CREDIT_PENDING_RECEIPTS_ENABLED = false;
export const CREDIT_ATTRIBUTION_ENABLED = false;
export const creditNatureLabels: Record<CreditNature, string> = {
  INGRESO_FISICO: "Ingreso físico",
  DEVOLUCION_FISICA: "Devolución física",
  CORRECCION_CONTABLE: "Corrección contable (sin dinero nuevo)",
  OPERACION_CREDITO_SIN_DINERO: "Operación de crédito sin movimiento de dinero",
};

/** One identity per logical draft; failed transport retries keep the same identity. */
export function createCreditOperationDraft(uuid: () => string = () => crypto.randomUUID()) {
  let signature: string | null = null;
  let key: string | null = null;
  return {
    keyFor(producer: string, intent: unknown) {
      const next = JSON.stringify([producer, intent]);
      if (signature !== next || key === null) {
        signature = next;
        key = uuid();
      }
      return key;
    },
    accepted() { signature = null; key = null; },
  };
}

export function creditEvidenceProblem(input: Partial<CreditEvidenceInput>, medium?: string): string | null {
  if (!Number.isSafeInteger(input.sitioOrigenId) || Number(input.sitioOrigenId) <= 0) return "Selecciona el sitio operativo de origen; no se deduce de la nota.";
  if (!input.naturaleza || !Object.hasOwn(creditNatureLabels, input.naturaleza)) return "Selecciona explícitamente la naturaleza del movimiento.";
  const physical = input.naturaleza === "INGRESO_FISICO" || input.naturaleza === "DEVOLUCION_FISICA";
  if (physical && medium === "EFECTIVO" && !CREDIT_CASH_CAPTURE_ENABLED) return "La captura nueva de efectivo de crédito está deshabilitada en E1.";
  if ((!physical || medium !== "EFECTIVO") && input.sesionCajaId != null) return "Las transferencias y correcciones no llevan sesión de caja.";
  if (input.naturaleza === "CORRECCION_CONTABLE" && !input.origenJustificacion?.trim()) return "La corrección exige justificación del origen y evidencia de la recaptura.";
  return null;
}

/** Whitelist only metadata, never spread credentials or a raw request into evidence. */
export function pickCreditEvidence(input: Partial<CreditEvidenceInput>): CreditEvidenceInput {
  if (!input.operacionClave || !input.naturaleza || !input.sitioOrigenId) throw new Error("Solicitud anterior sin metadatos E1; actualiza o vuelve a preparar el borrador.");
  return {
    sitioOrigenId: input.sitioOrigenId,
    naturaleza: input.naturaleza,
    operacionClave: input.operacionClave,
    sesionCajaId: input.sesionCajaId ?? null,
    notaOrigenId: input.notaOrigenId ?? null,
    origenJustificacion: input.origenJustificacion ?? null,
  };
}

export function prepareCreditAttribution(
  movement: CreditMovementEvidence, id: string, sitioOrigenId: number, evidencia: string, motivo: string,
): CreditAttributionInput {
  const snapshot = movement.identidadSnapshot;
  return {
    id, movimientoId: movement.movimientoId, movimientoCreatedAt: movement.movimientoCreatedAt,
    identidadSnapshot: {
      cliente_id: snapshot.cliente_id, tipo: snapshot.tipo, importe: snapshot.importe,
      ticket_id: snapshot.ticket_id, movimiento_origen_id: snapshot.movimiento_origen_id,
    },
    sitioOrigenId, evidencia: evidencia.trim(), motivo: motivo.trim(),
    anteriorId: movement.ultimaAtribucion?.id ?? null,
  };
}