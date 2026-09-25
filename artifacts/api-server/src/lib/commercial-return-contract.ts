/**
 * CLOSED candidate. This contract is independent of receipt/E5 refunds.
 * Money and quantity travel as canonical decimal strings, never JS floats.
 */
export const COMMERCIAL_RETURNS_ENABLED = false;
export const COMMERCIAL_RETURN_PATH = "/devoluciones-comerciales";
export const COMMERCIAL_RETURN_HISTORICAL_SALES_NOTICE =
  "Ventas, cantidades vendidas y utilidad son históricos brutos de los documentos originales, sin descontar devoluciones comerciales posteriores. Una devolución no cancela la venta original: la deuda se ajusta en crédito y únicamente el efectivo devuelto reduce la cobranza de la fecha y tienda receptoras.";

export type CommercialReturnRequest = {
  uuidCliente: string;
  ticketId: number;
  lineaId: number;
  ubicacionRecepcionId: number;
  sesionCajaId: number;
  cantidad: string;
  motivo: string;
  revision?: { importeRollo: string; deudaCancelada: string; efectivoDevuelto: string };
};
export function canonicalReturnRequest(input: CommercialReturnRequest): string {
  return JSON.stringify([input.uuidCliente, input.ticketId, input.lineaId, input.ubicacionRecepcionId,
    input.sesionCajaId, input.cantidad, input.motivo, input.revision?.importeRollo ?? null,
    input.revision?.deudaCancelada ?? null, input.revision?.efectivoDevuelto ?? null]);
}

export type CommercialReturnResult = {
  id: string;
  ticketId: number;
  lineaId: number;
  rolloId: number;
  serie: string;
  ubicacionRecepcionId: number;
  sesionCajaId: number;
  cantidad: string;
  importeRollo: string;
  deudaCancelada: string;
  efectivoDevuelto: string;
  motivo: string;
  createdAt: string;
};
export type CommercialReturnPreview = {
  ticketId: number;
  lineaId: number;
  serie: string;
  cantidad: string;
  ubicacionRecepcionId: number;
  sesionCajaId: number;
  importeRollo: string;
  deudaCancelada: string;
  efectivoDevuelto: string;
};

export class CommercialReturnError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 409) {
    super(message);
  }
}

export function exactDecimal(value: string, scale: number): bigint {
  if (!new RegExp(`^(0|[1-9][0-9]*)\\.[0-9]{${scale}}$`).test(value)) {
    throw new CommercialReturnError("IMPORTE_INVALIDO", "Se requiere un decimal exacto, finito y no negativo.");
  }
  return BigInt(value.replace(".", ""));
}

export function decimal(value: bigint, scale = 2): string {
  const unit = 10n ** BigInt(scale);
  return `${value / unit}.${(value % unit).toString().padStart(scale, "0")}`;
}

export function exactRatio(amount: bigint, numerator: bigint, denominator: bigint): bigint {
  if (amount < 0n || numerator < 0n || denominator <= 0n || numerator > denominator) {
    throw new CommercialReturnError("IMPORTES_NO_CONCILIADOS", "La nota no permite un reparto monetario conciliado.");
  }
  if (amount * numerator % denominator !== 0n) {
    throw new CommercialReturnError("REPARTO_NO_EXACTO", "El reparto proporcional produce fracciones de centavo. Se requiere decisión del propietario; no se redondeará.");
  }
  return amount * numerator / denominator;
}

export type CommercialReturnMoneyInput = {
  subtotal: string;
  iva: string;
  total: string;
  lineAmounts: string[];
  returnedLineAmount: string;
  /** Remaining merchandise value, after earlier full-roll returns. */
  remainingTotal: string;
  pendingDebt: string;
  paidMoney: string;
  correctionFunded: boolean;
};

export function calculateCommercialReturn(input: CommercialReturnMoneyInput) {
  if (input.correctionFunded) {
    throw new CommercialReturnError("LIQUIDACION_NO_MONETARIA", "La nota tiene liquidación por corrección contable o procedencia de pago no demostrable; no se considera dinero pagado.");
  }
  const subtotal = exactDecimal(input.subtotal, 2);
  const iva = exactDecimal(input.iva, 2);
  const total = exactDecimal(input.total, 2);
  const line = exactDecimal(input.returnedLineAmount, 2);
  const remaining = exactDecimal(input.remainingTotal, 2);
  const pending = exactDecimal(input.pendingDebt, 2);
  const paid = exactDecimal(input.paidMoney, 2);
  if (subtotal <= 0n || total !== subtotal + iva ||
      input.lineAmounts.reduce((sum, value) => sum + exactDecimal(value, 2), 0n) !== subtotal ||
      !input.lineAmounts.includes(input.returnedLineAmount) ||
      pending + paid !== remaining || remaining > total || line <= 0n) {
    throw new CommercialReturnError("IMPORTES_NO_CONCILIADOS", "Los importes originales, pagos y deuda de la nota no concilian.");
  }
  const lineTax = exactRatio(iva, line, subtotal);
  const gross = line + lineTax;
  const debt = exactRatio(pending, gross, remaining);
  const refund = exactRatio(paid, gross, remaining);
  if (debt + refund !== gross) {
    throw new CommercialReturnError("IMPORTES_NO_CONCILIADOS", "El importe del rollo no concilia con deuda y pago.");
  }
  return { importeRollo: decimal(gross), deudaCancelada: decimal(debt), efectivoDevuelto: decimal(refund) };
}