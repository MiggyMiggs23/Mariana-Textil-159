export type CreditSalePortion = {
  ticketId: number | null;
  amount: number;
  linkedReversal: number;
};

export const CREDIT_TERMS = [7, 15, 30, 60] as const;
export type CreditTerm = (typeof CREDIT_TERMS)[number];
export type CreditStatus =
  | "VIGENTE"
  | "POR_VENCER"
  | "VENCIDA"
  | "PAGADA"
  | "SIN_PLAZO";

export function isCreditTerm(value: unknown): value is CreditTerm {
  return (
    typeof value === "number" &&
    CREDIT_TERMS.includes(value as CreditTerm)
  );
}

/** Returns the calendar date seen in Mexico City, independent of server TZ. */
export function mexicoCityDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addCalendarDays(isoDate: string, days: CreditTerm): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return date.toISOString().slice(0, 10);
}

export function creditDueDate(saleInstant: Date, term: CreditTerm): string {
  return addCalendarDays(mexicoCityDate(saleInstant), term);
}

export function creditStatus(
  balance: number,
  dueDate: string | null,
  today: string,
): CreditStatus {
  if (balance <= 0) return "PAGADA";
  if (!dueDate) return "SIN_PLAZO";
  const day = (value: string) =>
    Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
  const remaining = day(dueDate) - day(today);
  if (remaining < 0) return "VENCIDA";
  if (remaining <= 3) return "POR_VENCER";
  return "VIGENTE";
}

/** Reference implementation used to verify the SQL FIFO allocation contract. */
export function allocateCreditFifo(
  sales: CreditSalePortion[],
  fifoNegativeAmount: number,
): Array<{ ticketId: number | null; outstanding: number }> {
  let available = Math.max(0, fifoNegativeAmount);
  return sales.flatMap((sale) => {
    const net = Math.max(0, sale.amount - sale.linkedReversal);
    const applied = Math.min(net, available);
    available -= applied;
    const outstanding = net - applied;
    return outstanding > 0 ? [{ ticketId: sale.ticketId, outstanding }] : [];
  });
}

export type TicketCreditPayment = {
  formaPago: string;
  importe: string;
};

export type TicketCreditMovement = {
  ticketId: number | null;
  tipo: "VENTA_CREDITO" | "ABONO" | "REVERSO" | "AJUSTE";
  importe: string;
  diasPlazo: number | null;
  fechaVencimiento: string | null;
  createdAt: Date;
  id: number;
};

function moneyCents(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error("Importe inválido en movimientos de crédito.");
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

function decimalMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Derives the credit-note fields from immutable payments and the same FIFO
 * allocation used by customer aging. Customer defaults and invoice flags are
 * deliberately absent from this function.
 */
export function deriveTicketCreditData(
  ticketId: number,
  payments: TicketCreditPayment[],
  movements: TicketCreditMovement[],
): {
  esCredito: boolean;
  importeCredito: string;
  diasPlazo: CreditTerm | null;
  fechaVencimiento: string | null;
  saldoPendiente: string;
} {
  const creditCents = payments
    .filter((payment) => payment.formaPago === "CREDITO")
    .reduce((sum, payment) => sum + moneyCents(payment.importe), 0);
  if (creditCents <= 0) {
    return {
      esCredito: false,
      importeCredito: "0.00",
      diasPlazo: null,
      fechaVencimiento: null,
      saldoPendiente: "0.00",
    };
  }

  const ordered = [...movements].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id - right.id,
  );
  const reversalsByTicket = new Map<number, number>();
  let fifoNegativeCents = 0;
  for (const movement of ordered) {
    const cents = moneyCents(movement.importe);
    if (
      movement.tipo === "REVERSO" &&
      movement.ticketId != null &&
      cents < 0
    ) {
      reversalsByTicket.set(
        movement.ticketId,
        (reversalsByTicket.get(movement.ticketId) ?? 0) - cents,
      );
    } else if (
      movement.tipo === "ABONO" ||
      (movement.tipo === "AJUSTE" && cents < 0)
    ) {
      fifoNegativeCents += Math.max(0, -cents);
    }
  }

  const charges = ordered.filter(
    (movement) =>
      movement.tipo === "VENTA_CREDITO" ||
      (movement.tipo === "AJUSTE" && moneyCents(movement.importe) > 0),
  );
  const outstanding = allocateCreditFifo(
    charges.map((movement) => ({
      ticketId: movement.ticketId,
      amount: moneyCents(movement.importe),
      linkedReversal:
        movement.tipo === "VENTA_CREDITO" && movement.ticketId != null
          ? (reversalsByTicket.get(movement.ticketId) ?? 0)
          : 0,
    })),
    fifoNegativeCents,
  )
    .filter((portion) => portion.ticketId === ticketId)
    .reduce((sum, portion) => sum + portion.outstanding, 0);
  const sale = charges.find(
    (movement) =>
      movement.tipo === "VENTA_CREDITO" && movement.ticketId === ticketId,
  );

  return {
    esCredito: true,
    importeCredito: decimalMoney(creditCents),
    diasPlazo: isCreditTerm(sale?.diasPlazo) ? sale.diasPlazo : null,
    fechaVencimiento: sale?.fechaVencimiento ?? null,
    saldoPendiente: decimalMoney(outstanding),
  };
}

export function canLinkAdjustmentToTicket(
  amount: number,
  ticketId: number | null,
): boolean {
  return amount >= 0 || ticketId === null;
}