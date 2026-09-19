import { sql } from "drizzle-orm";
import type { Tx } from "./inventario";
import type { CreditEvidenceInput } from "./credit-evidence";

/**
 * Independent from the refund execution gate. It remains closed until the
 * prepared A+C schema and integration have been separately verified.
 */
export const CREDIT_ABONO_REFUND_EVIDENCE_ENABLED = false;
export const CREDIT_ABONO_EVIDENCE_CONTRACT_REVISION = "e2-abono-evidence-v1";

export type AbonoEvidenceResult = "UNUSED" | "PARTIAL" | "FULL";
export type AbonoEvidenceAllocation = Readonly<{
  targetId: number;
  appliedCents: number;
}>;

export interface AbonoEvidenceEvaluation {
  result: AbonoEvidenceResult;
  receiptCents: number;
  appliedCents: number;
  allocations: readonly AbonoEvidenceAllocation[];
}

export interface AbonoEvidenceFinalizationInput {
  movementId: number;
  productor: "ABONO_ORDINARIO" | "ABONO_DIRIGIDO";
  formaPago: string | null | undefined;
  cuentaDestino: string | null | undefined;
  evidence: CreditEvidenceInput;
  evaluation: AbonoEvidenceEvaluation;
}

export interface AbonoEvidenceStore {
  finalize(input: {
    movementId: number;
    productor: "ABONO_ORDINARIO" | "ABONO_DIRIGIDO";
    result: AbonoEvidenceResult;
    appliedCents: number;
    evaluation: Record<string, unknown>;
    contractRevision: string;
  }): Promise<void>;
}

export function assertAbonoEvidencePolicy(covered: boolean, enabled: boolean): void {
  if (covered && !enabled) {
    throw new Error("E2: la captura física permanece bloqueada hasta habilitar evidencia A+C.");
  }
}

/** Classifies existing allocations (canonical FIFO or explicit directed); never recalculates FIFO. */
export function evaluateAbonoEvidence(
  receiptCents: number,
  allocations: readonly AbonoEvidenceAllocation[],
): AbonoEvidenceEvaluation {
  if (!Number.isSafeInteger(receiptCents) || receiptCents <= 0) {
    throw new Error("E2: importe de recepción inválido para evidencia.");
  }
  const normalized = allocations.map((allocation) => {
    if (!Number.isSafeInteger(allocation.targetId) || allocation.targetId <= 0
      || !Number.isSafeInteger(allocation.appliedCents) || allocation.appliedCents <= 0) {
      throw new Error("E2: asignación canónica inválida para evidencia.");
    }
    return { targetId: allocation.targetId, appliedCents: allocation.appliedCents };
  });
  const appliedCents = normalized.reduce((sum, item) => sum + item.appliedCents, 0);
  if (!Number.isSafeInteger(appliedCents) || appliedCents > receiptCents) {
    throw new Error("E2: la evaluación excede el importe íntegro del abono.");
  }
  return {
    result: appliedCents === 0 ? "UNUSED" : appliedCents === receiptCents ? "FULL" : "PARTIAL",
    receiptCents,
    appliedCents,
    allocations: normalized,
  };
}

export async function finalizePhysicalAbonoEvidenceCore(
  store: AbonoEvidenceStore,
  input: AbonoEvidenceFinalizationInput,
  enabled: boolean,
): Promise<void> {
  const covered = input.formaPago === "EFECTIVO"
    && input.cuentaDestino === "CAJA_FISICA"
    && input.evidence.naturaleza === "INGRESO_FISICO";
  assertAbonoEvidencePolicy(covered, enabled);
  if (!covered) return;
  if (input.productor === "ABONO_DIRIGIDO"
    && (input.evaluation.result !== "FULL"
      || input.evaluation.appliedCents !== input.evaluation.receiptCents)) {
    throw new Error("E2: la aplicación dirigida debe finalizar íntegramente como FULL.");
  }
  await store.finalize({
    movementId: input.movementId,
    productor: input.productor,
    result: input.evaluation.result,
    appliedCents: input.evaluation.appliedCents,
    evaluation: {
      contractRevision: CREDIT_ABONO_EVIDENCE_CONTRACT_REVISION,
      // Directed applications are already persisted in full by their producer;
      // they are not FIFO allocations returned by projectCreditLedger.
      projector: input.productor === "ABONO_DIRIGIDO" ? "directedApplication" : "projectCreditLedger",
      receiptCents: input.evaluation.receiptCents,
      appliedCents: input.evaluation.appliedCents,
      allocations: input.evaluation.allocations,
    },
    contractRevision: CREDIT_ABONO_EVIDENCE_CONTRACT_REVISION,
  });
}

/**
 * Records finalization after the existing projector/applications. A failure is
 * intentionally fatal to the surrounding transaction: a covered cash receipt
 * must never commit without its A+C evidence.
 */
export async function finalizePhysicalAbonoEvidence(
  tx: Tx,
  input: AbonoEvidenceFinalizationInput,
): Promise<void> {
  await finalizePhysicalAbonoEvidenceCore({
    async finalize(finalization) {
      await tx.execute(sql`
        SELECT public.e2_finalize_new_abono(
          ${finalization.movementId},
          ${finalization.productor},
          ${finalization.result},
          ${finalization.appliedCents},
          ${JSON.stringify(finalization.evaluation)}::jsonb,
          ${finalization.contractRevision}
        )
      `);
    },
  }, input, CREDIT_ABONO_REFUND_EVIDENCE_ENABLED);
}