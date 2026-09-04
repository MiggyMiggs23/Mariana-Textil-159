import { clientesTable, db } from "@workspace/db";
import { asc } from "drizzle-orm";
import { loadCustomerCreditLedger } from "./credit-aging-read-model";
import { projectCreditLedger, type CreditLedgerMovement } from "./credit-allocation";
import { mexicoCityDate } from "./clientes-aging";

/** Business traffic-light thresholds; percentages are inclusive. */
export const PAYMENT_BEHAVIOR_GREEN_MIN_PERCENT = 90;
export const PAYMENT_BEHAVIOR_YELLOW_MIN_PERCENT = 70;
/** Five settled notes avoids assigning green from only one or two purchases. */
export const PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES = 5;
/** 75% is substantial utilization while leaving a conservative 25% cushion. */
export const CREDIT_INCREASE_SUBSTANTIAL_UTILIZATION_PERCENT = 75;

export type PaymentBehaviorColor = "GREEN" | "YELLOW" | "RED" | "INSUFFICIENT";

const day = (value: Date | string) =>
  typeof value === "string" ? value.slice(0, 10) : mexicoCityDate(value);

/** Sole behavior projection: it consumes the same immutable ledger and FIFO projection as balances. */
export function projectPaymentBehavior(
  movements: CreditLedgerMovement[],
  limit: string | number,
  today = new Date(),
) {
  const ledger = projectCreditLedger(movements);
  const byId = new Map(movements.map((movement) => [movement.id, movement]));
  const paymentDates = new Map<number, Date[]>();
  for (const allocation of ledger.allocations) {
    const source = byId.get(allocation.sourceId);
    if (source?.tipo === "ABONO") {
      paymentDates.set(allocation.targetId, [...(paymentDates.get(allocation.targetId) ?? []), source.createdAt]);
    }
  }
  for (const movement of movements) {
    if (movement.tipo === "ABONO" && movement.directedMovimientoId != null) {
      paymentDates.set(movement.directedMovimientoId, [
        ...(paymentDates.get(movement.directedMovimientoId) ?? []),
        movement.createdAt,
      ]);
    }
  }
  let settledNotes = 0;
  let onTimeNotes = 0;
  let overdueOpenNotes = 0;
  let openNotDueNotes = 0;
  const todayDay = day(today);
  for (const charge of ledger.allCharges.filter((item) => item.tipo === "VENTA_CREDITO")) {
    const dates = paymentDates.get(charge.movimientoId) ?? [];
    if (charge.pendienteCents === 0 && dates.length > 0) {
      settledNotes += 1;
      const settledAt = dates.reduce((latest, value) => value > latest ? value : latest);
      if (charge.dueAt != null && day(settledAt) <= charge.dueAt) onTimeNotes += 1;
    } else if (charge.pendienteCents > 0 && charge.dueAt != null && charge.dueAt < todayDay) {
      overdueOpenNotes += 1;
    } else if (charge.pendienteCents > 0) {
      openNotDueNotes += 1;
    }
  }
  const evaluatedNotes = settledNotes + overdueOpenNotes;
  const percentage = evaluatedNotes === 0 ? 0 : Math.round(onTimeNotes * 10_000 / evaluatedNotes) / 100;
  const sufficientHistory = settledNotes >= PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES;
  const color: PaymentBehaviorColor = !sufficientHistory ? "INSUFFICIENT"
    : percentage >= PAYMENT_BEHAVIOR_GREEN_MIN_PERCENT ? "GREEN"
    : percentage >= PAYMENT_BEHAVIOR_YELLOW_MIN_PERCENT ? "YELLOW" : "RED";
  const balanceCents = ledger.balanceCents - ledger.overpaymentCents;
  const limitCents = Math.round(Number(limit) * 100);
  const utilizationPercent = limitCents <= 0 ? 0 : Math.round(balanceCents * 10_000 / limitCents) / 100;
  const suggestCreditIncrease = color === "GREEN" &&
    sufficientHistory &&
    utilizationPercent >= CREDIT_INCREASE_SUBSTANTIAL_UTILIZATION_PERCENT &&
    overdueOpenNotes === 0;
  return {
    percentage, settledNotes, evaluatedNotes, onTimeNotes, overdueOpenNotes, openNotDueNotes,
    color, sufficientHistory, utilizationPercent, suggestCreditIncrease,
    suggestionReason: suggestCreditIncrease
      ? `${settledNotes} notas liquidadas, ${percentage}% a tiempo y ${utilizationPercent}% del límite utilizado.`
      : null,
    period: "Todo el historial autorizado hasta hoy",
    explanation: "Mide por nota liquidada si se pagó a más tardar en su vencimiento; incluye vencidas impagas como tardías y excluye abiertas aún no vencidas.",
  };
}

export async function loadPaymentBehaviorList() {
  const clients = await db.select({
    id: clientesTable.id, nombre: clientesTable.nombre, limiteCredito: clientesTable.limiteCredito,
  }).from(clientesTable).orderBy(asc(clientesTable.nombre));
  return Promise.all(clients.map(async (client) => ({
    clienteId: client.id,
    clienteNombre: client.nombre,
    ...projectPaymentBehavior(await loadCustomerCreditLedger(client.id), client.limiteCredito),
  })));
}