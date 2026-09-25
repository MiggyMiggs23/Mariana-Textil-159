import { projectCreditLedger } from "./credit-allocation";
import { calendarDate } from "./date-only";

export const CREDIT_TERMS = [7, 15, 30, 60] as const;
export type CreditTerm = (typeof CREDIT_TERMS)[number];
export type CreditStatus =
  | "VIGENTE"
  | "POR_VENCER"
  | "VENCIDA"
  | "PAGADA"
  | "SIN_PLAZO";

/** Canonical customer-facing credit-note status. */
export type EstadoNota =
  | "PENDIENTE"
  | "ABONO_PARCIAL"
  | "PAGADA"
  | "CON_RETRASO";

/**
 * Derives the note state from immutable balance evidence and the due date.
 *
 * Yellow means an open note (with or without a partial payment), green means
 * paid, and red means an open overdue note.  The red overdue meaning wins
 * over the yellow partial meaning so urgency is never hidden by a payment.
 */
export function deriveEstadoNota(input: {
  importeOriginal: string | number;
  saldoPendiente: string | number;
  fechaVencimiento?: string | null;
  hoy: string;
}): EstadoNota {
  const originalCents = moneyCents(input.importeOriginal);
  const pendienteCents = Math.max(0, moneyCents(input.saldoPendiente));
  if (pendienteCents <= 0) return "PAGADA";
  if (
    input.fechaVencimiento != null &&
    input.fechaVencimiento.slice(0, 10) < input.hoy.slice(0, 10)
  ) {
    return "CON_RETRASO";
  }
  return pendienteCents < originalCents ? "ABONO_PARCIAL" : "PENDIENTE";
}

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

export type TicketCreditPayment = {
  formaPago: string;
  importe: string | number;
};

export type TicketCreditMovement = {
  ticketId: number | null;
  directedMovimientoId?: number | null;
  movimientoOrigenId?: number | null;
  tipo: "VENTA_CREDITO" | "ABONO" | "REVERSO" | "AJUSTE" | "DEVOLUCION_COMERCIAL";
  importe: string | number;
  diasPlazo?: number | null;
  fechaVencimiento?: string | Date | null;
  createdAt: Date;
  id: number;
};

function moneyCents(value: string | number): number {
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
  _payments: TicketCreditPayment[],
  movements: TicketCreditMovement[],
): {
  esCredito: boolean;
  importeCredito: string;
  diasPlazo: CreditTerm | null;
  fechaVencimiento: string | null;
  saldoPendiente: string;
} {
  // VENTA_CREDITO movements are the accounting source of truth.  In
  // particular, ticket_pagos can be missing for historical tickets, while
  // aplicaciones_credito remains allocation evidence and must not change the
  // outstanding balance independently of the ledger projection.
  const sales = movements.filter(
    (movement) =>
      movement.tipo === "VENTA_CREDITO" && movement.ticketId === ticketId,
  );
  const creditCents = sales.reduce(
    (sum, movement) => sum + moneyCents(movement.importe),
    0,
  );
  if (creditCents <= 0) {
    return {
      esCredito: false,
      importeCredito: "0.00",
      diasPlazo: null,
      fechaVencimiento: null,
      saldoPendiente: "0.00",
    };
  }

  const projection = projectCreditLedger(movements);
  const outstanding = projection.charges
    .filter((charge) => charge.ticketId === ticketId)
    .reduce((sum, charge) => sum + charge.pendienteCents, 0);
  const sale = sales[0];

  return {
    esCredito: true,
    importeCredito: decimalMoney(creditCents),
    diasPlazo: isCreditTerm(sale?.diasPlazo) ? sale.diasPlazo : null,
    fechaVencimiento:
      sale?.fechaVencimiento == null
        ? null
        : calendarDate(sale.fechaVencimiento),
    saldoPendiente: decimalMoney(outstanding),
  };
}

export function canLinkAdjustmentToTicket(
  amount: number,
  ticketId: number | null,
): boolean {
  return amount >= 0 || ticketId === null;
}