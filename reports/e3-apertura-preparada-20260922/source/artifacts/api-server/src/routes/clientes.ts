import { Router, type IRouter, type Response } from "express";
import ExcelJS from "exceljs";
import { legacyPaymentCaptureGuard } from "../lib/e3-legacy-capture";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  CreateClientePagoBody,
  CreateClientePagoResponse,
  GetClienteNotaCreditoResponse,
  GetClientePagoDetalleResponse,
  PreviewClientePagoBody,
  ReimprimirClienteNotaResponse,
  ListarComportamientoPagoClientesResponse,
  ObtenerComportamientoPagoClienteParams,
  ObtenerComportamientoPagoClienteResponse,
} from "@workspace/api-zod";
import {
  auditoriaTable,
  aplicacionesCreditoTable,
  clientesTable,
  db,
  movimientosCreditoTable,
  pool,
  productosTable,
  ticketLineasTable,
  ticketsTable,
} from "@workspace/db";
import {
  ADVISORY_LOCK_NAMESPACES,
  transactionAdvisoryLock,
} from "@workspace/db/advisory-locks";
import {
  centsToMoney,
  isValidPaymentDestination,
  moneyToCents,
  projectCreditLedger,
  type CreditLedgerCharge,
} from "../lib/credit-allocation";
import { requireSession } from "../middlewares/auth";
import { requierePermiso, resolvePermiso } from "../lib/permisos";
import { getRequestIp } from "../lib/request";
import { createLatin1TextPdf } from "../lib/pdf";
import {
  canLinkAdjustmentToTicket,
  creditStatus,
  deriveEstadoNota,
} from "../lib/clientes-aging";
import { calendarDate } from "../lib/date-only";
import {
  loadCustomerCreditLedger,
  loadCustomerCreditProjectionInTransaction,
  loadCustomerCreditProjection,
  loadCustomerCreditProjections,
  type CustomerCreditProjection,
} from "../lib/credit-aging-read-model";
import {
  isActiveNonSystemNameConflict,
  isClientCreditTerm,
  parseClientCreditTerms,
} from "../lib/clientes-create";
import {
  EXCEL_NUMBER_FORMAT,
  formatNumber,
  toExcelNumber,
} from "@workspace/number-format";
import { ordenarEspanol } from "../lib/spanish-order";
import { buildTicketDetail } from "../lib/pos";
import { breakdownIvaIncluded } from "../lib/iva";
import { accountedDocumentAt, accountedDocumentPredicate } from "../lib/accounted-document";
import { loadPaymentBehaviorList } from "../lib/payment-behavior";
import { buildCreditMovementDetail } from "../lib/credit-movement-detail";
import {
  FechaEfectivaValidationError,
  parseFechaEfectiva,
} from "../lib/fecha-efectiva";
import {
  CarteraScopeError,
  loadClientesCartera,
} from "../lib/clientes-cartera-read-model";
import {
  GLOBAL_CREDIT_SCOPE_LABEL,
  SCOPED_DETAIL_LABEL,
  buildEstadoCuentaExportReadQuery,
  resolveClienteFinancialReadScope,
  scopeDescription,
  ticketScopeClause,
  type ClienteFinancialReadScope,
} from "../lib/clientes-financial-read-scope";
import {
  renderClientesCarteraPdf,
  renderClientesCarteraXlsx,
} from "../lib/clientes-cartera-export";
import { resolveReadScope } from "./inventario";
import {
  readCreditEvidenceInput, canonicalCreditMoney, assertCreditEvidenceAccess,
  assertCreditEvidenceScope, claimCreditOperation, insertCreditMovementE1,
  assertCreditCaptureEnabled, CreditEvidenceError,
} from "../lib/credit-evidence";
import {
  evaluateAbonoEvidence,
  finalizePhysicalAbonoEvidence,
} from "../lib/credit-abono-evidence";

const router: IRouter = Router();

router.use("/clientes", requireSession);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Operational fields only — no financial data */
function presentClienteOperativo(row: typeof clientesTable.$inferSelect) {
  return {
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    correo: row.correo,
    direccionParticular: row.direccionParticular,
    direccionEntrega: row.direccionEntrega,
    direccion: row.direccionParticular,
    rfc: row.rfc,
    notas: row.notas,
    activo: row.activo,
    esSistema: row.esSistema,
    contactoNombre: row.contactoNombre,
    recibeNotaSinPrecios: row.recibeNotaSinPrecios,
    diasCredito: row.diasCredito,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseId(value: string | string[]): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function creditDueDays(fechaVencimiento: unknown): number {
  if (fechaVencimiento == null) return 0;
  const due = dateOnly(fechaVencimiento);
  if (!due) return 0;
  // A paid note also reports the calendar age at query time; it is evidence,
  // not a persisted delinquency status.
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const today = Object.fromEntries(
    todayParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const todayCalendar = `${today.year}-${today.month}-${today.day}`;
  const difference =
    Date.parse(`${todayCalendar}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`);
  return Math.max(0, Math.floor(difference / 86_400_000));
}

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  return calendarDate(value as string | Date);
}

function todayMexicoCity(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type EstadoCuentaExportRow = Record<string, any>;
export type EstadoCuentaExportProjection = Pick<
  CustomerCreditProjection,
  "movementProjections" | "allCharges" | "balanceCents" | "overpaymentCents"
>;
export type EstadoCuentaGlobalCreditSummary = {
  deudaActual: string;
  saldoAFavor: string;
  limiteCredito: string;
  creditoDisponible: string;
};

function globalCreditSummary(
  limiteCredito: string,
  projection: EstadoCuentaExportProjection,
): EstadoCuentaGlobalCreditSummary {
  const deudaActual = centsToMoney(projection.balanceCents);
  const saldoAFavor = centsToMoney(projection.overpaymentCents);
  return {
    deudaActual,
    saldoAFavor,
    limiteCredito,
    creditoDisponible: Math.max(0, Number(limiteCredito) - Number(deudaActual)).toFixed(2),
  };
}

function addFinancialScopeWorksheet(
  workbook: ExcelJS.Workbook,
  scope: ClienteFinancialReadScope,
  summary?: EstadoCuentaGlobalCreditSummary,
): void {
  const includeScopedGlobalSummary = scope.tipo === "SITIOS" && summary != null;
  const sheet = workbook.addWorksheet("Alcance");
  sheet.columns = [{ width: 32 }, { width: 88 }];
  sheet.addRows([
    ["Alcance aplicado", scope.tipo],
    ["Sitios autorizados", scopeDescription(scope)],
    ["Resumen global de crédito", GLOBAL_CREDIT_SCOPE_LABEL],
    ["Detalle", SCOPED_DETAIL_LABEL],
    ["Límite de crédito", includeScopedGlobalSummary ? toExcelNumber(summary.limiteCredito) : "No incluido en este archivo"],
    ["Deuda actual", includeScopedGlobalSummary ? toExcelNumber(summary.deudaActual) : "No incluido en este archivo"],
    ["Saldo a favor", includeScopedGlobalSummary ? toExcelNumber(summary.saldoAFavor) : "No incluido en este archivo"],
    ["Crédito disponible", includeScopedGlobalSummary ? toExcelNumber(summary.creditoDisponible) : "No incluido en este archivo"],
  ]);
  if (includeScopedGlobalSummary) {
    for (const row of [5, 6, 7, 8]) {
      sheet.getCell(`B${row}`).numFmt = EXCEL_NUMBER_FORMAT.money;
    }
  }
}

/**
 * Builds the exact estado-cuenta workbook used by the XLSX route.
 *
 * Kept separate from the query/HTTP handler so the production serialization
 * can be verified with an in-memory statement fixture without a DB write or
 * live request.
 */
export function buildEstadoCuentaWorkbook(
  rows: EstadoCuentaExportRow[],
  projection: EstadoCuentaExportProjection,
  scope: ClienteFinancialReadScope = {
    tipo: "GLOBAL",
    ubicaciones: [],
    generadoEn: "",
    saldoAFavorDisponible: true,
  },
  summary?: EstadoCuentaGlobalCreditSummary,
): ExcelJS.Workbook {
  const projectedMovements = new Map(
    projection.movementProjections.map((movement) => [
      movement.movementId,
      movement,
    ]),
  );
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Estado de cuenta");
  sheet.columns = [
    { header: "Fecha", key: "fecha", width: 22 }, { header: "Tipo", key: "tipo", width: 18 },
    { header: "Fecha de vencimiento", key: "fechaVencimiento", width: 22 },
    { header: "Importe", key: "importe", width: 14 }, { header: "Saldo corrido histórico", key: "saldoCorridoHistorico", width: 22 },
    { header: "Saldo actual proyectado", key: "saldoActualProyectado", width: 22 },
    { header: "Saldo a favor", key: "saldoAFavor", width: 18 },
    { header: "Saldo deudor proyectado", key: "saldoDeudorProyectado", width: 24 },
    { header: "Saldo a favor proyectado", key: "saldoAFavorProyectado", width: 24 },
    { header: "Saldo pendiente", key: "saldoPendiente", width: 18 },
    { header: "Estado de nota", key: "estadoNota", width: 18 },
    { header: "Folio", key: "folio", width: 12 }, { header: "Forma de pago", key: "formaPago", width: 18 },
    { header: "Subtotal facturado", key: "subtotalFacturado", width: 18 }, { header: "IVA facturado", key: "ivaFacturado", width: 16 },
    { header: "Referencia", key: "referencia", width: 24 }, { header: "Usuario", key: "usuario", width: 24 },
  ];
  sheet.getColumn("importe").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("saldoCorridoHistorico").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("subtotalFacturado").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("ivaFacturado").numFmt = EXCEL_NUMBER_FORMAT.money;
  const includeGlobalRowBalances = scope.tipo === "GLOBAL";
  sheet.addRows(rows.map((row) => {
    const charge = projection.allCharges.find(
      (candidate) => candidate.movimientoId === Number(row.id),
    );
    const saldoPendiente = charge && row.tipo === "VENTA_CREDITO"
      ? centsToMoney(charge.pendienteCents)
      : null;
    const estadoNota = charge && row.tipo === "VENTA_CREDITO"
      ? deriveEstadoNota({
          importeOriginal: centsToMoney(charge.originalCents),
          saldoPendiente: saldoPendiente!,
          fechaVencimiento: charge.dueAt,
          hoy: todayMexicoCity(),
        })
      : null;
    const projected = projectedMovements.get(Number(row.id));
    const saldoDeudorProyectado = projected == null
      ? null
      : centsToMoney(projected.saldoDeudorProyectadoCents);
    const saldoAFavorProyectado = projected == null
      ? null
      : centsToMoney(projected.saldoAFavorProyectadoCents);
    return {
      ...row,
      fechaVencimiento: row.fechaVencimiento == null
        ? null
        : calendarDate(row.fechaVencimiento as string | Date),
      estadoNota,
      ...(row.formaPago === "FACTURADO"
        ? (() => {
            const breakdown = breakdownIvaIncluded(
              Math.abs(moneyToCents(row.importe)),
            );
            return {
              subtotalFacturado: breakdown.subtotalCents / 100,
              ivaFacturado: breakdown.ivaCents / 100,
            };
          })()
        : {}),
      folio: row.folio == null ? "" : String(row.folio),
      importe: toExcelNumber(row.importe),
       // The complete ledger is still projected before this point.  These
       // cumulative numeric values would disclose other sites in a scoped
       // export, so only the approved global summary carries them there.
       saldoCorridoHistorico: includeGlobalRowBalances
         ? toExcelNumber(row.saldoCorridoHistorico)
         : null,
       saldoDeudorProyectado: includeGlobalRowBalances && saldoDeudorProyectado != null
         ? toExcelNumber(saldoDeudorProyectado)
         : null,
       saldoAFavorProyectado: includeGlobalRowBalances && saldoAFavorProyectado != null
         ? toExcelNumber(saldoAFavorProyectado)
         : null,
       saldoPendiente: includeGlobalRowBalances && saldoPendiente != null
         ? toExcelNumber(saldoPendiente)
         : null,
    };
  }));
  const summaryRow = sheet.addRow({
    tipo: "SALDO ACTUAL PROYECTADO",
    saldoActualProyectado: toExcelNumber(centsToMoney(projection.balanceCents)),
    saldoAFavor: toExcelNumber(centsToMoney(projection.overpaymentCents)),
    saldoPendiente: toExcelNumber(centsToMoney(projection.balanceCents)),
    estadoNota: "SALDO_DEUDOR",
  });
  summaryRow.getCell("saldoActualProyectado").numFmt = EXCEL_NUMBER_FORMAT.money;
  addFinancialScopeWorksheet(workbook, scope, summary);
  return workbook;
}

export function buildAnaliticaClientesWorkbook(
  rows: Array<Record<string, any>>,
  scope: ClienteFinancialReadScope,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Analítica");
  sheet.columns = [
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Folio", key: "folio", width: 12 },
    { header: "Fecha", key: "fecha", width: 22 },
    { header: "Subtotal", key: "subtotal", width: 14 },
    { header: "Modalidad", key: "modalidad", width: 14 },
    { header: "Unidad", key: "unidad", width: 12 },
    { header: "Cantidad", key: "cantidad", width: 14 },
    { header: "Utilidad", key: "margen", width: 14 },
  ];
  sheet.getColumn("subtotal").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.getColumn("cantidad").numFmt = EXCEL_NUMBER_FORMAT.quantity;
  sheet.getColumn("margen").numFmt = EXCEL_NUMBER_FORMAT.money;
  sheet.addRows(rows.map((row) => ({
    ...row,
    modalidad: row.tipo === "METREADO" ? "METRAJE" : "ROLLO",
    folio: row.folio == null ? "" : String(row.folio),
    subtotal: toExcelNumber(row.subtotal),
    cantidad: toExcelNumber(row.cantidad),
    margen: row.margen == null ? null : toExcelNumber(row.margen),
  })));
  addFinancialScopeWorksheet(workbook, scope);
  return workbook;
}

function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function statementRowPresentation(
  row: EstadoCuentaExportRow,
  projection: EstadoCuentaExportProjection,
  includeGlobalRowBalances: boolean,
) {
  const charge = projection.allCharges.find(
    (candidate) => candidate.movimientoId === Number(row.id),
  );
  const saldoPendiente = charge && row.tipo === "VENTA_CREDITO"
    ? centsToMoney(charge.pendienteCents)
    : null;
  const estadoNota = charge && row.tipo === "VENTA_CREDITO"
    ? deriveEstadoNota({
        importeOriginal: centsToMoney(charge.originalCents),
        saldoPendiente: saldoPendiente!,
        fechaVencimiento: charge.dueAt,
        hoy: todayMexicoCity(),
      })
    : null;
  const projected = new Map(
    projection.movementProjections.map((movement) => [
      movement.movementId,
      movement,
    ]),
  ).get(Number(row.id));
  return {
    saldoPendiente: includeGlobalRowBalances ? saldoPendiente : null,
    estadoNota,
    projected: includeGlobalRowBalances ? projected : undefined,
  };
}

export function renderEstadoCuentaPrintHtml(
  clienteNombre: string,
  rows: EstadoCuentaExportRow[],
  projection: EstadoCuentaExportProjection,
  scope: ClienteFinancialReadScope,
  summary: EstadoCuentaGlobalCreditSummary,
): string {
  const bodyRows = rows.map((item) => {
    const { saldoPendiente, estadoNota, projected } = statementRowPresentation(
      item,
      projection,
      scope.tipo === "GLOBAL",
    );
    const globalValue = (value: string | null | undefined) =>
      scope.tipo === "GLOBAL"
        ? formatNumber(value, { kind: "money" })
        : "No incluido por alcance de sitio";
    return `<tr><td>${htmlEscape(new Date(item.created_at ?? item.fecha).toLocaleDateString("es-MX"))}</td><td>${htmlEscape(item.tipo)}</td><td>${htmlEscape(formatNumber(item.importe, { kind: "money" }))}</td><td>${htmlEscape(globalValue(item.saldoCorridoHistorico))}</td><td>${htmlEscape(globalValue(projected == null ? null : centsToMoney(projected.saldoDeudorProyectadoCents)))}</td><td>${htmlEscape(globalValue(projected == null ? null : centsToMoney(projected.saldoAFavorProyectadoCents)))}</td><td>${htmlEscape(globalValue(saldoPendiente))}</td><td>${htmlEscape(estadoNota)}</td><td>${htmlEscape(item.notas)}</td></tr>`;
  }).join("");
  const summarySection = scope.tipo === "GLOBAL"
    ? `<p>Saldo actual proyectado: ${htmlEscape(formatNumber(centsToMoney(projection.balanceCents), { kind: "money" }))}</p><p>Saldo a favor: ${htmlEscape(formatNumber(centsToMoney(projection.overpaymentCents), { kind: "money" }))}</p>`
    : `<p>${GLOBAL_CREDIT_SCOPE_LABEL}</p><p>Deuda actual global: ${htmlEscape(formatNumber(summary.deudaActual, { kind: "money" }))}</p><p>Saldo a favor global: ${htmlEscape(formatNumber(summary.saldoAFavor, { kind: "money" }))}</p><p>Límite de crédito global: ${htmlEscape(formatNumber(summary.limiteCredito, { kind: "money" }))}</p><p>Crédito disponible global: ${htmlEscape(formatNumber(summary.creditoDisponible, { kind: "money" }))}</p>`;
  const scopeMetadata = `<p>${GLOBAL_CREDIT_SCOPE_LABEL}</p><p>${SCOPED_DETAIL_LABEL}</p><p>Alcance aplicado: ${htmlEscape(scope.tipo)} (${htmlEscape(scopeDescription(scope))})</p>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Estado de cuenta</title><style>@page{size:A4;margin:15mm}body{font:12px Arial}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px;text-align:left}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir / guardar PDF</button><h1>Estado de cuenta</h1><h2>${htmlEscape(clienteNombre)}</h2><section>${summarySection}${scope.tipo === "GLOBAL" ? scopeMetadata : `<p>${SCOPED_DETAIL_LABEL}</p><p>Alcance aplicado: ${htmlEscape(scope.tipo)} (${htmlEscape(scopeDescription(scope))})</p>`}</section><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Importe</th><th>Saldo corrido histórico</th><th>Saldo deudor proyectado</th><th>Saldo a favor proyectado</th><th>Saldo pendiente</th><th>Estado de nota</th><th>Notas</th></tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
}

export function renderEstadoCuentaPdf(
  clienteId: number,
  rows: EstadoCuentaExportRow[],
  projection: EstadoCuentaExportProjection,
  scope: ClienteFinancialReadScope,
  summary: EstadoCuentaGlobalCreditSummary,
): Buffer {
  const renderedRows = rows.map((row) => {
        if (scope.tipo === "GLOBAL") {
          const { saldoPendiente, estadoNota, projected } = statementRowPresentation(
            row,
            projection,
            true,
          );
          return `${new Date(row.created_at ?? row.fecha).toISOString().slice(0, 10)} | ${row.tipo} | ${formatNumber(row.importe, { kind: "money" })} | saldo corrido histórico ${formatNumber(row.saldoCorridoHistorico, { kind: "money" })} | saldo deudor proyectado ${formatNumber(centsToMoney(projected?.saldoDeudorProyectadoCents ?? 0), { kind: "money" })} | saldo a favor proyectado ${formatNumber(centsToMoney(projected?.saldoAFavorProyectadoCents ?? 0), { kind: "money" })} | saldo pendiente ${formatNumber(saldoPendiente, { kind: "money" })} | estado ${estadoNota ?? "-"} | folio ${row.folio ?? "-"}`;
        }
        const { estadoNota } = statementRowPresentation(row, projection, false);
        return `${new Date(row.created_at ?? row.fecha).toISOString().slice(0, 10)} | ${row.tipo} | ${formatNumber(row.importe, { kind: "money" })} | saldo corrido histórico No incluido por alcance de sitio | saldo deudor proyectado No incluido por alcance de sitio | saldo a favor proyectado No incluido por alcance de sitio | saldo pendiente No incluido por alcance de sitio | estado ${estadoNota ?? "-"} | folio ${row.folio ?? "-"}`;
      });
  if (scope.tipo === "GLOBAL") {
    return createLatin1TextPdf(
      `Estado de cuenta - cliente ${clienteId} - saldo actual proyectado ${formatNumber(centsToMoney(projection.balanceCents), { kind: "money" })} - saldo a favor ${formatNumber(centsToMoney(projection.overpaymentCents), { kind: "money" })}`,
      [...renderedRows, GLOBAL_CREDIT_SCOPE_LABEL, SCOPED_DETAIL_LABEL, `Alcance aplicado: ${scope.tipo} | sitios autorizados: ${scopeDescription(scope)}`],
    );
  }
  return createLatin1TextPdf(
    `Estado de cuenta - cliente ${clienteId}`,
    [
      GLOBAL_CREDIT_SCOPE_LABEL,
      `Deuda actual global ${formatNumber(summary.deudaActual, { kind: "money" })} | saldo a favor global ${formatNumber(summary.saldoAFavor, { kind: "money" })} | límite de crédito global ${formatNumber(summary.limiteCredito, { kind: "money" })} | crédito disponible global ${formatNumber(summary.creditoDisponible, { kind: "money" })}`,
      SCOPED_DETAIL_LABEL,
      `Alcance aplicado: ${scope.tipo} | sitios autorizados: ${scopeDescription(scope)}`,
      ...renderedRows,
    ],
  );
}

/** Historical alias retained for clients that still read estado/resultado. */
function legacyNoteState(
  importeOriginal: string,
  saldoPendiente: string,
  fechaVencimiento: string | null,
): "PENDIENTE" | "PARCIAL" | "PAGADA" {
  const canonical = deriveEstadoNota({
    importeOriginal,
    saldoPendiente,
    fechaVencimiento,
    hoy: todayMexicoCity(),
  });
  if (canonical === "PAGADA") return "PAGADA";
  if (canonical === "ABONO_PARCIAL" || canonical === "CON_RETRASO") {
    return "PARCIAL";
  }
  return "PENDIENTE";
}

function presentAllocations(
  charges: CreditLedgerCharge[],
  allocations: ReturnType<typeof projectCreditLedger>["allocations"],
) {
  const salesById = new Map(charges.map((charge) => [charge.movimientoId, charge]));
  return allocations.map((allocation) => {
    const sale = salesById.get(allocation.targetId)!;
    return {
      folio: sale.folio,
      ticketId: sale.ticketId,
      movimientoVentaId: sale.movimientoId,
      vencimiento: sale.dueAt,
      saldoAntes: centsToMoney(allocation.balanceBeforeCents),
      aplicado: centsToMoney(allocation.appliedCents),
      saldoDespues: centsToMoney(allocation.balanceAfterCents),
      resultado: allocation.balanceAfterCents === 0 ? "SALDADA" : "PARCIAL",
    };
  });
}

function creditMovementAuditSnapshot(
  movement: Pick<
    typeof movimientosCreditoTable.$inferSelect,
    "id" | "clienteId" | "tipo" | "createdAt" | "importe"
  >,
) {
  return {
    id: movement.id,
    clienteId: movement.clienteId,
    tipo: movement.tipo,
    createdAt: movement.createdAt,
    importe: movement.importe,
  };
}

function previewPaymentProjection(
  movements: Parameters<typeof projectCreditLedger>[0],
  amountCents: number,
  effectiveAt: Date,
) {
  // Database IDs are increasing, so a hypothetical row with the same effective
  // timestamp as an existing movement must sort after that existing evidence,
  // exactly as the subsequently inserted row will.
  const sourceId = Number.MAX_SAFE_INTEGER;
  const projection = projectCreditLedger([
    ...movements,
    {
      id: sourceId,
      ticketId: null,
      tipo: "ABONO" as const,
      importe: centsToMoney(-amountCents),
      createdAt: effectiveAt,
    },
  ]);
  const allocations = projection.allocations.filter(
    (allocation) => allocation.sourceId === sourceId,
  );
  const appliedCents = allocations.reduce(
    (sum, allocation) => sum + allocation.appliedCents,
    0,
  );
  return { projection, allocations, remainingCents: amountCents - appliedCents };
}

function period(req: { query: Record<string, unknown> }) {
  const desde = typeof req.query.desde === "string" ? req.query.desde : null;
  const hasta = typeof req.query.hasta === "string" ? req.query.hasta : null;
  const valid = /^\d{4}-\d{2}-\d{2}$/;
  if ((desde && !valid.test(desde)) || (hasta && !valid.test(hasta))) {
    throw new Error("INVALID_PERIOD");
  }
  return { desde, hasta };
}
function carteraQuery(req: { query: Record<string, unknown> }) {
  return {
    ubicacionId: req.query.ubicacionId,
    ubicacionIds: req.query.ubicacionIds,
  };
}

function carteraScopeError(error: unknown, res: Response): boolean {
  if (!(error instanceof CarteraScopeError)) return false;
  res.status(error.status).json({ error: error.message });
  return true;
}

function carteraReadDependencies() {
  return { resolveReadScope };
}

// ── GET /clientes/resumen ─────────────────────────────────────────────────────
// Must come BEFORE /:id to avoid Express matching "resumen" as an id.
// clientes_finanzas module (cartera, vencidos)

router.get(
  "/clientes/resumen",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const result = await loadClientesCartera(
        req.auth!,
        carteraQuery(req),
        carteraReadDependencies(),
      );
      res.json({ ...result.resumen, alcance: result.alcance });
    } catch (e) {
      if (carteraScopeError(e, res)) return;
      next(e);
    }
  },
);

// ── GET /clientes ─────────────────────────────────────────────────────────────

router.get(
  "/clientes",
  requierePermiso("clientes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const rows = ordenarEspanol(
        await db.select().from(clientesTable),
      );

      const permiso = await resolvePermiso(
        req.auth!.user.id,
        req.auth!.user.rol,
        "clientes_finanzas",
      );
      if (req.auth!.user.rol !== "ADMIN" && !permiso?.puedeVer) {
        res.json(rows.map(presentClienteOperativo));
        return;
      }
      const projections = await loadCustomerCreditProjections(rows.map((row) => row.id));
      const byId = new Map(
        [...projections].map(([id, projection]) => [
          id,
          {
            saldoActual: centsToMoney(projection.balanceCents),
            saldoAFavor: centsToMoney(projection.overpaymentCents),
          },
        ]),
      );
      res.json(
        rows.map((row) => ({
          ...presentClienteOperativo(row),
          limiteCredito: row.limiteCredito,
          saldoActual: byId.get(row.id)?.saldoActual ?? "0.00",
          saldoAFavor: byId.get(row.id)?.saldoAFavor ?? "0.00",
        })),
      );
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(e);
    }
  },
);

// ── POST /clientes ────────────────────────────────────────────────────────────

router.post(
  "/clientes",
  requierePermiso("clientes", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const { nombre, telefono, correo, direccion, direccionParticular, direccionEntrega, rfc, notas, contactoNombre, recibeNotaSinPrecios, diasCredito, limiteCredito } =
        req.body as Record<string, unknown>;
      const direccionParticularInput =
        direccionParticular !== undefined ? direccionParticular : direccion;

      if (
        req.auth!.user.rol === "SUPERVISOR" &&
        (diasCredito !== undefined || limiteCredito !== undefined)
      ) {
        res.status(403).json({
          error:
            "El rol SUPERVISOR no puede capturar términos financieros del cliente.",
        });
        return;
      }

      if (typeof nombre !== "string" || nombre.trim().length < 1) {
        res.status(400).json({ error: "El nombre es obligatorio." });
        return;
      }
      if (
        recibeNotaSinPrecios !== undefined &&
        typeof recibeNotaSinPrecios !== "boolean"
      ) {
        res.status(400).json({ error: "recibeNotaSinPrecios debe ser booleano." });
        return;
      }
      const normalizedName = nombre.trim();
      const creditTerms = parseClientCreditTerms(limiteCredito, diasCredito);
      if (!creditTerms.ok) {
        res.status(400).json({ error: creditTerms.error });
        return;
      }

      const [duplicate] = await db
        .select({ id: clientesTable.id })
        .from(clientesTable)
        .where(and(
          eq(clientesTable.activo, true),
          eq(clientesTable.esSistema, false),
          sql`lower(btrim(${clientesTable.nombre})) = lower(${normalizedName})`,
        ))
        .limit(1);
      if (duplicate) {
        res.status(409).json({
          error: "Ya existe un cliente activo con ese nombre.",
          code: "CLIENT_NAME_CONFLICT",
          existingClientId: duplicate.id,
        });
        return;
      }

      const [created] = await db
        .insert(clientesTable)
        .values({
          nombre: normalizedName,
          telefono: typeof telefono === "string" ? telefono.trim() || null : null,
          correo: typeof correo === "string" ? correo.trim() || null : null,
          direccionParticular: typeof direccionParticularInput === "string" ? direccionParticularInput.trim() || null : null,
          direccionEntrega: typeof direccionEntrega === "string" ? direccionEntrega.trim() || null : null,
          rfc: typeof rfc === "string" ? rfc.trim() || null : null,
          notas: typeof notas === "string" ? notas.trim() || null : null,
          contactoNombre:
            typeof contactoNombre === "string" ? contactoNombre.trim() || null : null,
          recibeNotaSinPrecios: recibeNotaSinPrecios === true,
          limiteCredito: creditTerms.limiteCredito,
          diasCredito: creditTerms.diasCredito,
        })
        .returning();

      await db.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "CREAR",
        entidad: "clientes",
        entidadId: String(created.id),
        datosDespues: presentClienteOperativo(created) as Record<string, unknown>,
        ip: getRequestIp(req),
      });

      res.status(201).json(presentClienteOperativo(created));
    } catch (e) {
      if (isActiveNonSystemNameConflict(e)) {
        const nombre = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
        const [duplicate] = await db
          .select({ id: clientesTable.id })
          .from(clientesTable)
          .where(and(
            eq(clientesTable.activo, true),
            eq(clientesTable.esSistema, false),
            sql`lower(btrim(${clientesTable.nombre})) = lower(${nombre})`,
          ))
          .limit(1);
        if (duplicate) {
          res.status(409).json({
            error: "Ya existe un cliente activo con ese nombre.",
            code: "CLIENT_NAME_CONFLICT",
            existingClientId: duplicate.id,
          });
          return;
        }
      }
      next(e);
    }
  },
);

// ── GET /clientes/:id ─────────────────────────────────────────────────────────

router.get(
  "/clientes/cartera",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      res.json(await loadClientesCartera(
        req.auth!,
        carteraQuery(req),
        carteraReadDependencies(),
      ));
    } catch (error) {
      if (carteraScopeError(error, res)) return;
      next(error);
    }
  },
);

router.get(
  "/clientes/analitica",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const { desde, hasta } = period(req);
      const result = await pool.query(
        `SELECT
          COALESCE(SUM(l.importe), 0)::text AS ventas,
          COUNT(DISTINCT t.id)::int AS tickets,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.costo_total_congelado),0)::text END AS costo,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END AS margen,
          COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)::int AS "lineasSinCosto",
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad = 'METRO'), 0)::text AS metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad = 'KILO'), 0)::text AS kilos,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad = 'BOLSA'), 0)::text AS bolsas,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='METRO'),0)::text AS "rollosMetros",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='KILO'),0)::text AS "rollosKilos",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='BOLSA'),0)::text AS "rollosBolsas",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='METRO'),0)::text AS "metrajeMetros",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='BOLSA'),0)::text AS "metrajeBolsas"
        FROM tickets t
        JOIN ticket_lineas l ON l.ticket_id = t.id
        JOIN productos p ON p.id = l.producto_id
        WHERE ${accountedDocumentPredicate("t")}
          AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date)
          AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date + interval '1 day')`,
        [desde, hasta],
      );
      const [tops, pareto, segmentos, mensual, productosGlobal, coloresGlobal, riesgo] = await Promise.all([
        pool.query(
          `SELECT c.id,c.nombre,SUM(l.importe)::text AS ventas,
             CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
               ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END AS margen
           FROM tickets t JOIN clientes c ON c.id=t.cliente_id JOIN ticket_lineas l ON l.ticket_id=t.id
            WHERE ${accountedDocumentPredicate("t")} AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date)
             AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date+interval '1 day')
           GROUP BY c.id,c.nombre ORDER BY ventas DESC LIMIT 20`, [desde, hasta]),
        pool.query(
          `WITH x AS (SELECT c.id,c.nombre,SUM(l.importe) ventas FROM tickets t JOIN clientes c ON c.id=t.cliente_id JOIN ticket_lineas l ON l.ticket_id=t.id WHERE ${accountedDocumentPredicate("t")} AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date) AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date+interval '1 day') GROUP BY c.id,c.nombre)
           SELECT id,nombre,ventas::text, (SUM(ventas) OVER (ORDER BY ventas DESC)/NULLIF(SUM(ventas) OVER (),0))::text AS acumulado FROM x ORDER BY ventas DESC`, [desde, hasta]),
        pool.query(
          `SELECT CASE WHEN c.es_sistema THEN 'PUBLICO' ELSE 'REGISTRADO' END AS segmento,
             SUM(t.subtotal)::text AS ventas,COUNT(*)::int AS tickets
           FROM tickets t JOIN clientes c ON c.id=t.cliente_id WHERE ${accountedDocumentPredicate("t")}
            AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date) AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date+interval '1 day')
           GROUP BY c.es_sistema`, [desde, hasta]),
        pool.query(
          `SELECT to_char(${accountedDocumentAt("t")},'YYYY-MM') mes,SUM(l.importe)::text ventas,
              CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
                ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END margen
           FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id WHERE ${accountedDocumentPredicate("t")}
            AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date) AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date+interval '1 day')
           GROUP BY mes ORDER BY mes`, [desde, hasta]),
        pool.query(
          `SELECT p.id,p.sku,p.tela,p.color,l.tipo,p.unidad,SUM(l.cantidad)::text cantidad,SUM(l.importe)::text ventas
           FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
            WHERE ${accountedDocumentPredicate("t")} AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date) AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date+interval '1 day')
            GROUP BY p.id,l.tipo,p.unidad ORDER BY ventas DESC LIMIT 30`, [desde,hasta]),
        pool.query(
          `SELECT p.color,l.tipo,p.unidad,SUM(l.importe)::text ventas,SUM(l.cantidad)::text cantidad
           FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
            WHERE ${accountedDocumentPredicate("t")} AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date) AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date+interval '1 day')
            GROUP BY p.color,l.tipo,p.unidad ORDER BY ventas DESC LIMIT 30`, [desde,hasta]),
        pool.query(
          `SELECT c.id,c.nombre,MIN(${accountedDocumentAt("t")}) AS "primeraCompra",MAX(${accountedDocumentAt("t")}) AS "ultimaCompra"
           FROM clientes c LEFT JOIN tickets t ON t.cliente_id=c.id AND ${accountedDocumentPredicate("t")}
           WHERE NOT c.es_sistema GROUP BY c.id,c.nombre`, []),
      ]);
      const riskProjections = await loadCustomerCreditProjections(
        riesgo.rows.map((item) => Number(item.id)),
      );
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Mexico_City",
      });
      const riskRows = riesgo.rows.map((item) => ({
        ...item,
        vencido: centsToMoney(
          (riskProjections.get(Number(item.id))?.charges ?? [])
            .filter((charge) => charge.dueAt != null && charge.dueAt < today)
            .reduce((sum, charge) => sum + charge.pendienteCents, 0),
        ),
      }));
      res.json({
        periodo: { desde, hasta }, ...result.rows[0],
        topVentas: tops.rows,
        topMargen: [...tops.rows].sort((a, b) =>
          a.margen == null ? 1 : b.margen == null ? -1 : Number(b.margen) - Number(a.margen)),
        pareto: pareto.rows,
        publicoVsRegistrado: segmentos.rows,
        mensual: mensual.rows,
        productos: productosGlobal.rows,
        colores: coloresGlobal.rows,
        clientesNuevos: riskRows.filter((item) => item.primeraCompra && (!desde || new Date(item.primeraCompra) >= new Date(desde))),
        clientesRiesgo: riskRows.filter((item) => Number(item.vencido) > 0),
        clientesInactivos: riskRows.filter((item) => item.ultimaCompra && Date.now()-new Date(item.ultimaCompra).getTime() > 90*86400000),
        distribucionMargen: tops.rows.map((item) => ({ clienteId: item.id, margen: item.margen })),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(error);
    }
  },
);

router.get(
  "/clientes/analitica.xlsx",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const { desde, hasta } = period(req);
      const scope = await resolveClienteFinancialReadScope(
        req.auth!,
        carteraQuery(req),
        pool,
        resolveReadScope,
      );
      const siteClause = ticketScopeClause(scope, "t", 3);
      const result = await pool.query(
        `SELECT c.nombre AS cliente, t.folio, ${accountedDocumentAt("t")} AS fecha,
          t.subtotal::text,l.tipo,p.unidad,l.cantidad::text,
          CASE WHEN l.costo_total_congelado IS NOT NULL
            THEN (l.importe - l.costo_total_congelado)::text END AS margen
         FROM tickets t JOIN clientes c ON c.id=t.cliente_id
         JOIN ticket_lineas l ON l.ticket_id=t.id
         JOIN productos p ON p.id=l.producto_id
          WHERE ${accountedDocumentPredicate("t")}
           AND ($1::date IS NULL OR ${accountedDocumentAt("t")} >= $1::date)
           AND ($2::date IS NULL OR ${accountedDocumentAt("t")} < $2::date + interval '1 day')
            ${siteClause.text}
          ORDER BY ${accountedDocumentAt("t")} DESC`,
        [desde, hasta, ...siteClause.values],
      );
      const workbook = buildAnaliticaClientesWorkbook(result.rows, scope);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="analitica-clientes.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      if (carteraScopeError(error, res)) return;
      next(error);
    }
  },
);

router.get(
  "/clientes/cartera.xlsx",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const result = await loadClientesCartera(
        req.auth!,
        carteraQuery(req),
        carteraReadDependencies(),
      );
      const workbook = await renderClientesCarteraXlsx(result);
      res.type(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.attachment("cartera-clientes.xlsx");
      res.send(workbook);
    } catch (error) {
      if (carteraScopeError(error, res)) return;
      next(error);
    }
  },
);

router.get(
  "/clientes/cartera.pdf",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const result = await loadClientesCartera(
        req.auth!,
        carteraQuery(req),
        carteraReadDependencies(),
      );
      const pdf = renderClientesCarteraPdf(result);
      res.type("application/pdf");
      res.attachment("cartera-clientes.pdf");
      res.send(pdf);
    } catch (error) {
      if (carteraScopeError(error, res)) return;
      next(error);
    }
  },
);

router.get(
  "/clientes/comportamiento-pago",
  requierePermiso("clientes_credito", "ver"),
  async (_req, res, next) => {
    try {
      res.json(ListarComportamientoPagoClientesResponse.parse(await loadPaymentBehaviorList()));
    } catch (error) { next(error); }
  },
);

router.get(
  "/clientes/:id/comportamiento-pago",
  requierePermiso("clientes_credito", "ver"),
  async (req, res, next) => {
    try {
      const { id } = ObtenerComportamientoPagoClienteParams.parse(req.params);
      const item = (await loadPaymentBehaviorList()).find((row) => row.clienteId === id);
      if (!item) { res.status(404).json({ error: "Cliente no encontrado." }); return; }
      res.json(ObtenerComportamientoPagoClienteResponse.parse(item));
    } catch (error) { next(error); }
  },
);

router.get(
  "/clientes/:id",
  requierePermiso("clientes", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const permiso = await resolvePermiso(
        req.auth!.user.id,
        req.auth!.user.rol,
        "clientes_finanzas",
      );
      if (req.auth!.user.rol !== "ADMIN" && !permiso?.puedeVer) {
        res.json(presentClienteOperativo(row));
        return;
      }
      const balance = await loadCustomerCreditProjection(id);
      res.json({
        ...presentClienteOperativo(row),
        limiteCredito: row.limiteCredito,
        saldoActual: centsToMoney(balance.balanceCents),
        saldoAFavor: centsToMoney(balance.overpaymentCents),
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── PATCH /clientes/:id ───────────────────────────────────────────────────────

router.patch(
  "/clientes/:id",
  requierePermiso("clientes", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [before] = await db
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!before) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const { nombre, telefono, correo, direccion, direccionParticular, direccionEntrega, rfc, notas, activo, contactoNombre, recibeNotaSinPrecios, diasCredito, limiteCredito } =
        req.body as Record<string, unknown>;
      const direccionParticularInput =
        direccionParticular !== undefined ? direccionParticular : direccion;
      if (diasCredito !== undefined || limiteCredito !== undefined) {
        res.status(403).json({
          error: "Los términos de crédito solo se modifican en /clientes/:id/credito.",
        });
        return;
      }
      if (
        before.esSistema &&
        ((nombre !== undefined && nombre !== "Venta a Público") ||
          activo === false)
      ) {
        res.status(409).json({
          error: "Venta a Público es un cliente protegido y no puede renombrarse, desactivarse ni recibir crédito.",
          code: "SYSTEM_CLIENT_PROTECTED",
        });
        return;
      }
      if (activo !== undefined) {
        res.status(403).json({
          error: "El estado del cliente solo se modifica mediante /clientes/:id/baja o /clientes/:id/reactivar.",
        });
        return;
      }
      if (
        recibeNotaSinPrecios !== undefined &&
        typeof recibeNotaSinPrecios !== "boolean"
      ) {
        res.status(400).json({ error: "recibeNotaSinPrecios debe ser booleano." });
        return;
      }

      const updates: Partial<typeof clientesTable.$inferInsert> = {};
      if (typeof nombre === "string") updates.nombre = nombre.trim();
      if (typeof telefono === "string" || telefono === null)
        updates.telefono = telefono as string | null;
      if (typeof correo === "string" || correo === null)
        updates.correo = correo as string | null;
      if (typeof direccionParticularInput === "string" || direccionParticularInput === null)
        updates.direccionParticular = direccionParticularInput as string | null;
      if (typeof direccionEntrega === "string" || direccionEntrega === null)
        updates.direccionEntrega = direccionEntrega as string | null;
      if (typeof rfc === "string" || rfc === null)
        updates.rfc = rfc as string | null;
      if (typeof notas === "string" || notas === null)
        updates.notas = notas as string | null;
      if (typeof contactoNombre === "string" || contactoNombre === null)
        updates.contactoNombre = contactoNombre as string | null;
      if (typeof recibeNotaSinPrecios === "boolean")
        updates.recibeNotaSinPrecios = recibeNotaSinPrecios;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "No se enviaron cambios." });
        return;
      }

      const [updated] = await db
        .update(clientesTable)
        .set(updates)
        .where(eq(clientesTable.id, id))
        .returning();

      await db.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "ACTUALIZAR",
        entidad: "clientes",
        entidadId: String(id),
        datosAntes: presentClienteOperativo(before) as Record<string, unknown>,
        datosDespues: presentClienteOperativo(updated) as Record<string, unknown>,
        ip: getRequestIp(req),
      });

      res.json(presentClienteOperativo(updated));
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /clientes/:id/credito ─────────────────────────────────────────────────
// clientes_credito module: limit, balance, available, canBuyCredit

router.get(
  "/clientes/:id/credito",
  requierePermiso("clientes_credito", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select()
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const balance = await loadCustomerCreditProjection(id);
      const limite = parseFloat(row.limiteCredito ?? "0");
      const saldo = balance.balanceCents / 100;
       const saldoParaLimite = balance.balanceCents / 100;
      const disponible = Math.max(0, limite - saldoParaLimite);
      const puedeComprarCredito = disponible > 0;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
      const aging = balance.charges.map((charge) => {
        const diasVencido = charge.dueAt == null ? 0 : Math.max(0,
          Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${charge.dueAt}T00:00:00Z`)) / 86_400_000));
        return { fechaVencimiento: charge.dueAt, pendiente: centsToMoney(charge.pendienteCents),
          diasVencido, sinPlazo: charge.dueAt == null,
          estado: creditStatus(charge.pendienteCents / 100, charge.dueAt, today) };
      });
      const activity = await pool.query(
        `SELECT MIN(created_at) FILTER (WHERE estado='VENDIDO') AS "primeraCompra",
          GREATEST(MAX(created_at), (SELECT MAX(created_at) FROM movimientos_credito WHERE cliente_id=$1)) AS "ultimaActividad"
         FROM tickets WHERE cliente_id=$1`,
        [id],
      );
      const totalVencido = aging
        .filter((item) => item.diasVencido > 0)
        .reduce((sum, item) => sum + Number(item.pendiente), 0);

      res.json({
        clienteId: row.id,
        limiteCredito: row.limiteCredito,
        saldoActual: saldo.toFixed(2),
         saldoAFavor: centsToMoney(balance.overpaymentCents),
        creditoDisponible: disponible.toFixed(2),
        puedeComprarCredito,
        diasCredito: row.diasCredito,
        utilizacion: limite > 0 ? ((saldo / limite) * 100).toFixed(2) : "0.00",
        totalVencido: totalVencido.toFixed(2),
        primerVencimiento: aging[0]?.fechaVencimiento ?? null,
        primeraCompra: activity.rows[0]?.primeraCompra ?? null,
        ultimaActividad: activity.rows[0]?.ultimaActividad ?? null,
        antiguedad: aging,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/clientes/:id/credito",
  requierePermiso("clientes_credito", "editar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      const limiteCredito = Number(req.body?.limiteCredito);
      const diasCredito = req.body?.diasCredito;
      if (
        !id ||
        !Number.isFinite(limiteCredito) ||
        limiteCredito < 0 ||
        !isClientCreditTerm(diasCredito)
      ) {
        res.status(400).json({
          error: "El límite debe ser válido y los días de crédito deben ser 0, 7, 15, 30 o 60.",
        });
        return;
      }
      const [client] = await db
        .select({ id: clientesTable.id, esSistema: clientesTable.esSistema })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);
      if (!client) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      if (client.esSistema) {
        res.status(409).json({ error: "Venta a Público no admite términos de crédito." });
        return;
      }
      const [updated] = await db
        .update(clientesTable)
        .set({ limiteCredito: limiteCredito.toFixed(2), diasCredito })
        .where(eq(clientesTable.id, id))
        .returning();
      await db.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        accion: "ACTUALIZAR_CREDITO",
        entidad: "clientes",
        entidadId: String(id),
        datosDespues: { limiteCredito: updated!.limiteCredito, diasCredito },
        ip: getRequestIp(req),
      });
      res.json({
        clienteId: id,
        limiteCredito: updated!.limiteCredito,
        diasCredito: updated!.diasCredito,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ── GET /clientes/:id/precios ─────────────────────────────────────────────────
// clientes_precios module: only unit prices + date + avg-3. No amounts, no quantities.

router.get(
  "/clientes/:id/precios",
  requierePermiso("clientes_precios", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select({ id: clientesTable.id })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const rows = await db
        .select({
          productoId: ticketLineasTable.productoId,
          sku: productosTable.sku,
          precioUnitario: ticketLineasTable.precioUnitario,
          fecha: ticketsTable.createdAt,
        })
        .from(ticketLineasTable)
        .innerJoin(
          ticketsTable,
          eq(ticketLineasTable.ticketId, ticketsTable.id),
        )
        .innerJoin(
          productosTable,
          eq(ticketLineasTable.productoId, productosTable.id),
        )
        .where(
          and(
            eq(ticketsTable.clienteId, id),
            eq(ticketsTable.estado, "VENDIDO"),
          ),
        )
        .orderBy(desc(ticketsTable.createdAt))
        .limit(200);
      const latestByProduct = new Map<number, string[]>();
      for (const item of rows) {
        const list = latestByProduct.get(item.productoId) ?? [];
        if (list.length < 3) list.push(item.precioUnitario);
        latestByProduct.set(item.productoId, list);
      }
      res.json({
        clienteId: id,
        precios: rows.map((item) => {
          const recent = latestByProduct.get(item.productoId) ?? [];
          const promedio =
            recent.reduce((sum, value) => sum + Number(value), 0) /
            Math.max(recent.length, 1);
          return {
            productoId: item.productoId,
            sku: item.sku,
            precioUnitario: item.precioUnitario,
            fecha: item.fecha.toISOString().slice(0, 10),
            promedio3: promedio.toFixed(2),
          };
        }),
        nota: null,
      });
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /clientes/:id/estado-cuenta ──────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/estado-cuenta",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const [row] = await db
        .select({
          id: clientesTable.id,
        })
        .from(clientesTable)
        .where(eq(clientesTable.id, id))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }

      const { desde, hasta } = period(req);
      const tipo = typeof req.query.tipo === "string" ? req.query.tipo : null;
      if (
        tipo &&
        !["VENTA_CREDITO", "ABONO", "REVERSO", "AJUSTE"].includes(tipo)
      ) {
        res.status(400).json({ error: "Tipo de movimiento inválido." });
        return;
      }
      const [movements, balance] = await Promise.all([
        pool.query(
          `WITH ledger AS (
             SELECT m.id, m.ticket_id, m.tipo, m.importe, m.created_at, m.notas,
                m.forma_pago, m.cuenta_destino, m.referencia, m.dias_plazo, m.fecha_vencimiento,
                t.folio AS ticket_folio,
               u.nombre AS nombre_usuario,
               SUM(m.importe) OVER (ORDER BY m.created_at,m.id) AS saldo_corrido
             FROM movimientos_credito m
             LEFT JOIN tickets t ON t.id=m.ticket_id
             JOIN usuarios u ON u.id=m.usuario_id
             WHERE m.cliente_id=$1
           )
           SELECT id AS "movimientoId", ticket_id AS "ticketId", tipo, importe::text, ledger.created_at AS fecha,
              ledger.created_at AS "fechaEfectiva",
              CASE WHEN tipo='VENTA_CREDITO' AND fecha_vencimiento IS NULL
                THEN CONCAT_WS(' · ', notas, 'Sin plazo definido (crédito legado)')
                ELSE notas END AS notas,
               forma_pago AS "formaPago", cuenta_destino AS "cuentaDestino", dias_plazo AS "diasPlazo",
              fecha_vencimiento AS "fechaVencimiento",
               NULL::text AS estado,
              CASE WHEN tipo='VENTA_CREDITO' THEN '0.00' ELSE NULL END AS "saldoPendiente",
             referencia, ticket_folio AS "ticketFolio",
             nombre_usuario AS "nombreUsuario", saldo_corrido::text AS "saldoCorrido"
            FROM ledger
             WHERE ($2::date IS NULL OR ledger.created_at >= $2::date)
              AND ($3::date IS NULL OR ledger.created_at < $3::date+interval '1 day')
             AND ($4::text IS NULL OR tipo::text=$4)
            ORDER BY ledger.created_at,ledger.id`,
          [id, desde, hasta, tipo],
        ),
         loadCustomerCreditProjection(id, pool, {
           includeMovementProjections: true,
         }),
      ]);
       const projectedCharges = new Map(balance.allCharges.map((charge) => [charge.movimientoId, charge]));
        const projectedMovements = new Map(
          balance.movementProjections.map((movement) => [
            movement.movementId,
            movement,
          ]),
        );
       const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
       const withBalance = movements.rows.map((movement) => ({
         ...movement,
         desgloseIva: movement.formaPago === "FACTURADO"
           ? (() => {
               const breakdown = breakdownIvaIncluded(
                 Math.abs(moneyToCents(movement.importe)),
               );
               return {
                 subtotal: centsToMoney(breakdown.subtotalCents),
                 iva: centsToMoney(breakdown.ivaCents),
               };
             })()
           : null,
          saldoPendiente: movement.tipo === "VENTA_CREDITO"
             ? centsToMoney(projectedCharges.get(Number(movement.movimientoId))?.pendienteCents ?? 0) : null,
          estado: movement.tipo === "VENTA_CREDITO"
            ? creditStatus(
                (projectedCharges.get(Number(movement.movimientoId))?.pendienteCents ?? 0) / 100,
                dateOnly(movement.fechaVencimiento),
                today,
              )
            : null,
          estadoNota: movement.tipo === "VENTA_CREDITO"
            ? deriveEstadoNota({
                importeOriginal: centsToMoney(
                  projectedCharges.get(Number(movement.movimientoId))?.originalCents ?? 0,
                ),
                saldoPendiente: projectedCharges.get(Number(movement.movimientoId))
                  ?.pendienteCents == null
                  ? "0.00"
                  : centsToMoney(
                      projectedCharges.get(Number(movement.movimientoId))!.pendienteCents,
                    ),
                fechaVencimiento: dateOnly(movement.fechaVencimiento),
                hoy: today,
              })
            : null,
          // These are the canonical FIFO projections for this chronological
          // prefix.  `saldoCorrido` remains the raw signed historical SUM for
          // clients that still consume that legacy field.
          saldoDeudorProyectado: centsToMoney(
            projectedMovements.get(Number(movement.movimientoId))
              ?.saldoDeudorProyectadoCents ?? 0,
          ),
          saldoAFavorProyectado: centsToMoney(
            projectedMovements.get(Number(movement.movimientoId))
              ?.saldoAFavorProyectadoCents ?? 0,
          ),
         fechaVencimiento:
           movement.fechaVencimiento == null
             ? null
              : dateOnly(movement.fechaVencimiento),
       }));
      res.json({
        clienteId: id,
        movimientos: [...withBalance].reverse(),
         saldoActual: centsToMoney(balance.balanceCents),
          saldoAFavor: centsToMoney(balance.overpaymentCents),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/clientes/:id/estado-cuenta/imprimir",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const scope = await resolveClienteFinancialReadScope(
        req.auth!,
        carteraQuery(req),
        pool,
        resolveReadScope,
      );
      const client = await pool.query(
        'SELECT nombre,limite_credito::text AS "limiteCredito" FROM clientes WHERE id=$1',
        [id],
      );
      if (!client.rows[0]) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      const statementQuery = buildEstadoCuentaExportReadQuery(id, scope);
      const [movements, projection] = await Promise.all([pool.query(
        statementQuery.text,
        [...statementQuery.values],
      ), loadCustomerCreditProjection(id, pool, {
         includeMovementProjections: true,
       })]);
      res.type("html").send(renderEstadoCuentaPrintHtml(
        client.rows[0].nombre,
        movements.rows,
        projection,
        scope,
        globalCreditSummary(client.rows[0].limiteCredito, projection),
      ));
    } catch (error) {
      if (carteraScopeError(error, res)) return;
      next(error);
    }
  },
);

router.get(
  "/clientes/:id/estado-cuenta.xlsx",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const scope = await resolveClienteFinancialReadScope(
        req.auth!,
        carteraQuery(req),
        pool,
        resolveReadScope,
      );
      const client = await pool.query<{ limiteCredito: string }>(
        'SELECT limite_credito::text AS "limiteCredito" FROM clientes WHERE id=$1',
        [id],
      );
      if (!client.rows[0]) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      const statementQuery = buildEstadoCuentaExportReadQuery(id, scope);
      const [result, projection] = await Promise.all([pool.query(
        statementQuery.text,
        [...statementQuery.values],
      ), loadCustomerCreditProjection(id, pool, {
         includeMovementProjections: true,
       })]);
       const workbook = buildEstadoCuentaWorkbook(
         result.rows,
         projection,
         scope,
         globalCreditSummary(client.rows[0].limiteCredito, projection),
       );
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.attachment(`estado-cuenta-${id}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      if (carteraScopeError(error, res)) return;
      next(error);
    }
  },
);

router.get(
  "/clientes/:id/estado-cuenta.pdf",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const scope = await resolveClienteFinancialReadScope(
        req.auth!,
        carteraQuery(req),
        pool,
        resolveReadScope,
      );
      const client = await pool.query<{ limiteCredito: string }>(
        'SELECT limite_credito::text AS "limiteCredito" FROM clientes WHERE id=$1',
        [id],
      );
      if (!client.rows[0]) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      const statementQuery = buildEstadoCuentaExportReadQuery(id, scope);
      const [result, projection] = await Promise.all([pool.query(
        statementQuery.text,
        [...statementQuery.values],
      ), loadCustomerCreditProjection(id, pool, {
         includeMovementProjections: true,
       })]);
       const pdf = renderEstadoCuentaPdf(
         id,
         result.rows,
         projection,
         scope,
         globalCreditSummary(client.rows[0].limiteCredito, projection),
       );
      res.type("application/pdf");
      res.attachment(`estado-cuenta-${id}.pdf`);
      res.send(pdf);
    } catch (error) {
      if (carteraScopeError(error, res)) return;
      next(error);
    }
  },
);

// ── GET /clientes/:id/compras ─────────────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/compras",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const { desde, hasta } = period(req);
      const result = await pool.query(
        `SELECT t.id, t.folio, ${accountedDocumentAt("t")} AS fecha, t.subtotal::text,
          t.iva::text, t.total::text,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='METRO'), 0)::text AS metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='KILO'), 0)::text AS kilos,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='BOLSA'), 0)::text AS bolsas,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='METRO'),0)::text AS "rollosMetros",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='KILO'),0)::text AS "rollosKilos",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='BOLSA'),0)::text AS "rollosBolsas",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='METRO'),0)::text AS "metrajeMetros",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='BOLSA'),0)::text AS "metrajeBolsas",
          CASE WHEN COUNT(*) FILTER
            (WHERE l.costo_total_congelado IS NULL) = 0
            THEN SUM(l.importe-l.costo_total_congelado)::text END AS margen,
          COUNT(*) FILTER
            (WHERE l.costo_total_congelado IS NULL)::int AS "lineasSinCosto"
         FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
         JOIN productos p ON p.id=l.producto_id
          WHERE t.cliente_id=$1 AND ${accountedDocumentPredicate("t")}
           AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date)
           AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date + interval '1 day')
         GROUP BY t.id ORDER BY ${accountedDocumentAt("t")} DESC`,
        [id, desde, hasta],
      );
      res.json({
        clienteId: id,
        periodo: { desde, hasta },
        compras: result.rows,
        total: result.rowCount ?? 0,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(e);
    }
  },
);

router.get(
  "/clientes/:id/analitica",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const { desde, hasta } = period(req);
      const args = [id, desde, hasta];
      const [productos, telas, tendencia, pagos, actividad, facturacion, financiero, semana] = await Promise.all([
        pool.query(`SELECT p.id,p.sku,p.tela,p.color,l.tipo,p.unidad,SUM(l.cantidad)::text cantidad,SUM(l.importe)::text ventas,
          MAX(${accountedDocumentAt("t")}) AS "ultimaCompra",
          SUM((l.precio_sugerido*l.cantidad)-l.importe)::text AS descuento,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END margen
          FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
          WHERE t.cliente_id=$1 AND ${accountedDocumentPredicate("t")} AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date) AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date+interval '1 day')
          GROUP BY p.id,l.tipo,p.unidad ORDER BY ventas DESC`, args),
        pool.query(`SELECT p.tela,p.color,l.tipo,p.unidad,SUM(l.importe)::text ventas,COUNT(DISTINCT t.id)::int tickets
          FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id JOIN productos p ON p.id=l.producto_id
          WHERE t.cliente_id=$1 AND ${accountedDocumentPredicate("t")} AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date) AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date+interval '1 day')
          GROUP BY p.tela,p.color,l.tipo,p.unidad ORDER BY ventas DESC`, args),
        pool.query(`SELECT to_char(${accountedDocumentAt("t")},'YYYY-MM') mes,COUNT(*)::int tickets,SUM(subtotal)::text ventas
          FROM tickets t WHERE cliente_id=$1 AND ${accountedDocumentPredicate("t")} AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date) AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date+interval '1 day') GROUP BY mes ORDER BY mes`, args),
        pool.query(`SELECT forma_pago AS forma,COALESCE(SUM(-importe),0)::text importe,COUNT(*)::int movimientos
          FROM movimientos_credito WHERE cliente_id=$1 AND tipo='ABONO' AND ($2::date IS NULL OR created_at >= $2::date) AND ($3::date IS NULL OR created_at < $3::date+interval '1 day') GROUP BY forma_pago`, args),
        pool.query(`SELECT MAX(${accountedDocumentAt("t")}) AS "ultimaCompra",COUNT(*)::int tickets,AVG(total)::text AS "ticketPromedio",
          MAX(total)::text AS "ticketMaximo" FROM tickets t WHERE cliente_id=$1 AND ${accountedDocumentPredicate("t")} AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date) AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date+interval '1 day')`, args),
        pool.query(`SELECT facturado,COUNT(*)::int tickets,SUM(subtotal)::text subtotal,SUM(iva)::text iva FROM tickets t
          WHERE cliente_id=$1 AND ${accountedDocumentPredicate("t")} AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date) AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date+interval '1 day') GROUP BY facturado`, args),
        pool.query(`WITH s AS (SELECT created_at,SUM(importe) OVER (ORDER BY created_at,id) saldo FROM movimientos_credito WHERE cliente_id=$1)
          SELECT COALESCE(MAX(saldo),0)::text AS "saldoMaximo",
            (SELECT AVG(EXTRACT(day FROM m.created_at-t.created_at))::text FROM movimientos_credito m JOIN tickets t ON t.id=m.ticket_id WHERE m.cliente_id=$1 AND m.tipo='ABONO') AS "diasPromedioPago"
          FROM s`, [id]),
        pool.query(`SELECT EXTRACT(isodow FROM ${accountedDocumentAt("t")})::int dia,COUNT(*)::int tickets,SUM(subtotal)::text ventas
          FROM tickets t WHERE cliente_id=$1 AND ${accountedDocumentPredicate("t")} AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date) AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date+interval '1 day') GROUP BY dia ORDER BY dia`, args),
      ]);
      const totalVentas = productos.rows.reduce((sum, item) => sum + Number(item.ventas), 0);
      res.json({
        clienteId: id,
        periodo: { desde, hasta },
        productos: productos.rows.map((item) => ({
          ...item,
          participacion: totalVentas > 0 ? (Number(item.ventas) / totalVentas).toFixed(4) : "0",
          detenido: item.ultimaCompra
            ? Date.now() - new Date(item.ultimaCompra).getTime() > 90 * 86400000
            : true,
        })),
        telasColores: telas.rows,
        tendencia: tendencia.rows,
        estacionalidadMensual: tendencia.rows,
        mezclaPagos: pagos.rows,
        actividad: actividad.rows[0],
        frecuencia: { tickets: actividad.rows[0]?.tickets ?? 0, porMes: tendencia.rows },
        facturacion: facturacion.rows,
        financiero: financiero.rows[0],
        diaSemana: semana.rows,
        concentracion: productos.rows[0]
          ? { productoPrincipal: productos.rows[0].sku, porcentaje: (Number(productos.rows[0].ventas) / Math.max(totalVentas, 1) * 100).toFixed(2) }
          : null,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(error);
    }
  },
);

// ── GET /clientes/:id/estadisticas ────────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/estadisticas",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const { desde, hasta } = period(req);
      const result = await pool.query(
        `SELECT COALESCE(SUM(l.importe),0)::text AS "totalCompras",
          COUNT(DISTINCT t.id)::int AS "comprasCount",
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='METRO'),0)::text AS metros,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='KILO'),0)::text AS kilos,
          COALESCE(SUM(l.cantidad) FILTER (WHERE p.unidad='BOLSA'),0)::text AS bolsas,
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='METRO'),0)::text AS "rollosMetros",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='KILO'),0)::text AS "rollosKilos",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='NORMAL' AND p.unidad='BOLSA'),0)::text AS "rollosBolsas",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='METRO'),0)::text AS "metrajeMetros",
          COALESCE(SUM(l.cantidad) FILTER (WHERE l.tipo='METREADO' AND p.unidad='BOLSA'),0)::text AS "metrajeBolsas",
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.costo_total_congelado),0)::text END AS costo,
          CASE WHEN COUNT(*) FILTER (WHERE l.costo_total_congelado IS NULL)>0 THEN NULL
            ELSE COALESCE(SUM(l.importe-l.costo_total_congelado),0)::text END AS margen,
          COALESCE(SUM(l.importe-l.costo_total_congelado)
            FILTER (WHERE l.costo_total_congelado IS NOT NULL),0)::text AS "utilidadAcumulada",
          COUNT(*) FILTER
            (WHERE l.costo_total_congelado IS NULL)::int AS "lineasSinCosto"
         FROM tickets t JOIN ticket_lineas l ON l.ticket_id=t.id
         JOIN productos p ON p.id=l.producto_id
          WHERE t.cliente_id=$1 AND ${accountedDocumentPredicate("t")}
           AND ($2::date IS NULL OR ${accountedDocumentAt("t")} >= $2::date)
           AND ($3::date IS NULL OR ${accountedDocumentAt("t")} < $3::date + interval '1 day')`,
        [id, desde, hasta],
      );
      const summary = result.rows[0];
      res.json({
        clienteId: id,
        periodo: { desde, hasta },
        totalCompras: summary?.totalCompras ?? "0.00",
        comprasCount: summary?.comprasCount ?? 0,
        metros: summary?.metros ?? "0.000",
        kilos: summary?.kilos ?? "0.000",
        costo: summary?.costo ?? "0.00",
        margen: summary?.margen ?? "0.00",
        utilidadAcumulada: summary?.utilidadAcumulada ?? "0.00",
        lineasExcluidasSinCosto: summary?.lineasSinCosto ?? 0,
        lineasSinCosto: summary?.lineasSinCosto ?? 0,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_PERIOD") {
        res.status(400).json({ error: "Periodo inválido; usa YYYY-MM-DD." });
        return;
      }
      next(e);
    }
  },
);

// ── GET /clientes/:id/pagos ───────────────────────────────────────────────────
// clientes_finanzas module

router.get(
  "/clientes/:id/pagos",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      const rows = await db
        .select({
          id: movimientosCreditoTable.id,
          importe: movimientosCreditoTable.importe,
          fecha: movimientosCreditoTable.createdAt,
          formaPago: movimientosCreditoTable.formaPago,
          cuentaDestino: movimientosCreditoTable.cuentaDestino,
          referencia: movimientosCreditoTable.referencia,
          ticketId: movimientosCreditoTable.ticketId,
          notas: movimientosCreditoTable.notas,
           reversoMovimientoId: sql<number | null>`(SELECT r.id FROM movimientos_credito r WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=${movimientosCreditoTable.id} LIMIT 1)`,
           motivoReverso: sql<string | null>`(SELECT r.notas FROM movimientos_credito r WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=${movimientosCreditoTable.id} LIMIT 1)`,
        })
        .from(movimientosCreditoTable)
        .where(
          and(
            eq(movimientosCreditoTable.clienteId, id),
            eq(movimientosCreditoTable.tipo, "ABONO"),
          ),
        )
        .orderBy(desc(movimientosCreditoTable.createdAt));
      res.json({
        clienteId: id,
        pagos: rows.map((row) => ({ ...row, revertido: row.reversoMovimientoId != null })),
      });
    } catch (e) {
      next(e);
    }
  },
);

// Application rows remain link evidence; current balances always come from the
// immutable ledger projection.
router.get(
  "/clientes/:id/notas/:ticketId",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const clienteId = parseId(req.params.id);
      const ticketId = parseId(req.params.ticketId);
      if (!clienteId || !ticketId) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const [sale, projection] = await Promise.all([pool.query(
        `SELECT m.id AS "movimientoVentaId",m.importe::text AS "importeOriginal",
           m.fecha_vencimiento AS "fechaVencimiento"
         FROM movimientos_credito m
         WHERE m.cliente_id=$1 AND m.ticket_id=$2 AND m.tipo='VENTA_CREDITO'
         ORDER BY m.created_at,m.id LIMIT 1`,
        [clienteId, ticketId],
      ), loadCustomerCreditProjection(clienteId)]);
      const movement = sale.rows[0];
      if (!movement) {
        res.status(404).json({ error: "La nota de crédito no corresponde al cliente." });
        return;
      }
      const ticket = await buildTicketDetail(db, ticketId, true);
      if (!ticket || ticket.clienteId !== clienteId) {
        res.status(404).json({ error: "Ticket no encontrado." });
        return;
      }
      const abonos = await pool.query(
        `SELECT a.abono_movimiento_id AS "movimientoPagoId",ab.created_at AS fecha,
           a.importe::text AS "montoAplicado",ABS(ab.importe)::text AS "montoTotalAbono",
           ab.forma_pago AS "formaPago",ab.cuenta_destino AS "cuentaDestino",
           ab.referencia,u.nombre AS "usuarioRegistrador",
           EXISTS (SELECT 1 FROM movimientos_credito r
             WHERE r.tipo='REVERSO' AND r.movimiento_origen_id=ab.id) AS revertido
         FROM aplicaciones_credito a
         JOIN movimientos_credito ab ON ab.id=a.abono_movimiento_id
         JOIN usuarios u ON u.id=ab.usuario_id
         WHERE a.venta_movimiento_id=$1
         ORDER BY ab.created_at,a.id`,
        [movement.movimientoVentaId],
      );
      const projectedCharge = projection.allCharges.find(
        (charge) => charge.movimientoId === Number(movement.movimientoVentaId),
      );
      const saldoActual = centsToMoney(projectedCharge?.pendienteCents ?? 0);
       const fechaVencimiento = dateOnly(movement.fechaVencimiento);
       const estadoNota = deriveEstadoNota({
         importeOriginal: movement.importeOriginal,
         saldoPendiente: saldoActual,
         fechaVencimiento,
         hoy: todayMexicoCity(),
       });
      res.json(GetClienteNotaCreditoResponse.parse({
        clienteId,
        ticket,
        movimientoVentaId: Number(movement.movimientoVentaId),
        importeOriginal: movement.importeOriginal,
        saldoActual,
         estado: legacyNoteState(
           movement.importeOriginal,
           saldoActual,
           fechaVencimiento,
         ),
         estadoNota,
         fechaVencimiento,
        diasVencidos: creditDueDays(movement.fechaVencimiento),
        abonos: abonos.rows.map((row) => ({
          ...row,
          movimientoPagoId: Number(row.movimientoPagoId),
          fecha: new Date(row.fecha).toISOString(),
        })),
      }));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/clientes/:id/pagos/:pagoId",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const clienteId = parseId(req.params.id);
      const pagoId = parseId(req.params.pagoId);
      if (!clienteId || !pagoId) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const snapshot = await pool.connect();
      try {
        await snapshot.query(
          "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
        );
        const detail = await buildCreditMovementDetail(
          snapshot,
          clienteId,
          pagoId,
        );
        await snapshot.query("COMMIT");
        if (!detail) {
          res.status(404).json({ error: "El movimiento no corresponde al cliente." });
          return;
        }
        res.json(GetClientePagoDetalleResponse.parse(detail));
      } catch (error) {
        await snapshot.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        snapshot.release();
      }
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/clientes/:id/notas/:ticketId/reimprimir",
  requierePermiso("clientes_finanzas", "ver"),
  async (req, res, next): Promise<void> => {
    try {
      const clienteId = parseId(req.params.id);
      const ticketId = parseId(req.params.ticketId);
      if (!clienteId || !ticketId) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      const note = await pool.query(
        `SELECT t.folio,t.ubicacion_id AS "sitioId"
         FROM tickets t JOIN movimientos_credito m ON m.ticket_id=t.id
         WHERE t.id=$1 AND t.cliente_id=$2 AND m.cliente_id=$2
           AND m.tipo='VENTA_CREDITO'`,
        [ticketId, clienteId],
      );
      const ticket = note.rows[0];
      if (!ticket) {
        res.status(404).json({ error: "La nota de crédito no corresponde al cliente." });
        return;
      }
      const reimpresoAt = new Date();
      await db.insert(auditoriaTable).values({
        usuarioId: req.auth!.user.id,
        sitioId: Number(ticket.sitioId),
        modulo: "clientes_finanzas",
        accion: "REIMPRIMIR_NOTA_CREDITO",
        entidad: "tickets",
        entidadId: String(ticketId),
        datosDespues: {
          clienteId,
          ticketId,
          folio: Number(ticket.folio),
          usuarioId: req.auth!.user.id,
          sitioId: Number(ticket.sitioId),
        },
        ip: getRequestIp(req),
      });
      res.status(201).json(ReimprimirClienteNotaResponse.parse({
        clienteId,
        ticketId,
        folio: Number(ticket.folio),
        reimpresoAt: reimpresoAt.toISOString(),
      }));
    } catch (error) {
      next(error);
    }
  },
);

// ── POST /clientes/:id/pagos ──────────────────────────────────────────────────
// clientes_finanzas module + crear

router.post(
  "/clientes/:id/pagos/vista-previa",
  legacyPaymentCaptureGuard(),
  requierePermiso("clientes_finanzas", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }
      if (req.body?.ticketId != null) {
        res.status(400).json({ error: "Un abono no puede dirigirse a un ticket; se aplica FIFO." });
        return;
      }
      let fechaEfectiva: Date;
      try {
        // Validate the raw HTTP value before zod's coerce.date() can turn a
        // date-only string into an ambiguous UTC midnight.
        fechaEfectiva = parseFechaEfectiva(req.body?.fechaEfectiva);
      } catch (error) {
        if (error instanceof FechaEfectivaValidationError) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }
        throw error;
      }
      const body = PreviewClientePagoBody.parse(req.body);
      if (fechaEfectiva > new Date()) {
        res.status(400).json({ error: "Fecha efectiva inválida o futura." });
        return;
      }
      const [client] = await db.select({ id: clientesTable.id })
        .from(clientesTable).where(eq(clientesTable.id, id)).limit(1);
      if (!client) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      const ledger = await loadCustomerCreditLedger(id);
      const amountCents = moneyToCents(body.importe);
      const allocation = previewPaymentProjection(
        ledger,
        amountCents,
        fechaEfectiva,
      );
      res.json({
        monto: centsToMoney(amountCents),
        asignaciones: presentAllocations(allocation.projection.allCharges, allocation.allocations),
         saldoAFavor: centsToMoney(allocation.projection.overpaymentCents),
         saldoAFavorGenerado: centsToMoney(allocation.remainingCents),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/clientes/:id/pagos",
  legacyPaymentCaptureGuard(),
  requierePermiso("clientes_finanzas", "crear"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        10,
      );
      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido." });
        return;
      }

      let fechaEfectiva: Date;
      try {
        // Keep this validation before CreateClientePagoBody.parse for the same
        // strict RFC 3339 contract as the preview endpoint.
        fechaEfectiva = parseFechaEfectiva(req.body?.fechaEfectiva);
      } catch (error) {
        if (error instanceof FechaEfectivaValidationError) {
          res.status(error.statusCode).json({ error: error.message });
          return;
        }
        throw error;
      }
      const evidence = readCreditEvidenceInput(req.body);
      const body = CreateClientePagoBody.parse(req.body);
      const intent = {
        clienteId: id, importe: canonicalCreditMoney(body.importe),
        formaPago: body.formaPago, cuentaDestino: body.cuentaDestino,
        referencia: body.referencia ?? null, notas: body.notas ?? null,
        fechaEfectiva: req.body?.fechaEfectiva == null ? null : fechaEfectiva.toISOString(),
        ticketId: req.body?.ticketId == null ? null : Number(req.body.ticketId),
        destinos: [],
        ...evidence,
      };
      if (!["EFECTIVO", "TRANSFERENCIA", "FACTURADO"].includes(body.formaPago)) {
        res.status(400).json({ error: "Forma de pago inválida." });
        return;
      }
      if (!isValidPaymentDestination(body.formaPago, body.cuentaDestino)) {
        res.status(400).json({ error: "La cuenta destino no corresponde a la forma de pago." });
        return;
      }
      if (fechaEfectiva > new Date()) {
        res.status(400).json({ error: "Fecha efectiva inválida o futura." });
        return;
      }
      // Source-controlled E3 gate precedes claims, locks and any database work.
      // Opening income never opens returns or retained receipts.
      assertCreditCaptureEnabled(evidence, body.formaPago, "ABONO_ORDINARIO", "ABONO");
      const result = await db.transaction(async (tx) => {
        await assertCreditEvidenceAccess(req, evidence, tx);
        const claim = await claimCreditOperation(tx, {
          productor: "ABONO_ORDINARIO", clave: evidence.operacionClave,
          naturaleza: evidence.naturaleza, actorId: req.auth!.user.id, contenido: intent,
        });
        if (claim.replay) {
          const audit = await tx.select({ data: auditoriaTable.datosDespues })
            .from(auditoriaTable).where(and(
              eq(auditoriaTable.accion, "PAGO_CLIENTE"),
              sql`${auditoriaTable.datosDespues}->>'movimientoCreditoId' = ${String(claim.movement.id)}`,
            )).limit(1);
          const saved = audit[0]?.data as { asignaciones: ReturnType<typeof presentAllocations>; saldoAFavor: string; saldoAFavorGenerado: string } | undefined;
          if (!saved) throw new CreditEvidenceError("No se encontró la respuesta auditada del abono original.", 409);
          return { created: claim.movement, asignaciones: saved.asignaciones, saldoAFavor: saved.saldoAFavor, saldoAFavorGenerado: saved.saldoAFavorGenerado };
        }
        await assertCreditEvidenceScope(req, evidence, tx);
        await transactionAdvisoryLock(
          tx,
          ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT,
          id,
        );
        const [client] = await tx
          .select()
          .from(clientesTable)
          .where(eq(clientesTable.id, id))
          .for("update")
          .limit(1);
        if (!client) throw new CreditEvidenceError("Cliente no encontrado.", 404);
        if (!client.activo) throw new Error("INACTIVE_CLIENT");
        if (req.body?.ticketId != null) throw new Error("DIRECTED_PAYMENT");
        const importe = body.importe.toFixed(2);
        if (client.esSistema) throw new Error("SYSTEM_CLIENT_CREDIT");
        const created = await insertCreditMovementE1(tx, {
            clienteId: id,
            ticketId: null,
            tipo: "ABONO",
            importe: `-${importe}`,
            usuarioId: req.auth!.user.id,
            notas: [
              `Forma: ${body.formaPago}`,
              body.referencia ? `Referencia: ${body.referencia}` : null,
              body.notas ?? null,
            ]
              .filter(Boolean)
              .join(" · "),
            formaPago: body.formaPago as "EFECTIVO" | "TRANSFERENCIA" | "FACTURADO",
            cuentaDestino: body.cuentaDestino,
            referencia: body.referencia ?? null,
            createdAt: fechaEfectiva,
            metadata: JSON.stringify({
              origen: "CLIENTES",
              notas: body.notas ?? null,
              fechaCaptura: new Date().toISOString(),
            }),
          }, evidence, "ABONO_ORDINARIO");
        const projection = await loadCustomerCreditProjectionInTransaction(
          id,
          tx,
        );
        const allocations = projection.allocations.filter(
          (allocation) => allocation.sourceId === created!.id,
        );
        if (allocations.length > 0) {
          await tx.insert(aplicacionesCreditoTable).values(
            allocations.map((item) => ({
              abonoMovimientoId: item.sourceId,
              ventaMovimientoId: item.targetId,
              importe: centsToMoney(item.appliedCents),
            })),
          );
        }
        const asignaciones = presentAllocations(projection.allCharges, allocations);
        const appliedCents = allocations.reduce(
          (sum, allocation) => sum + allocation.appliedCents,
          0,
        );
        const sourceRemainderCents = moneyToCents(importe) - appliedCents;
        await finalizePhysicalAbonoEvidence(tx, {
          movementId: created!.id,
          productor: "ABONO_ORDINARIO",
          formaPago: body.formaPago,
          cuentaDestino: body.cuentaDestino,
          evidence,
          evaluation: evaluateAbonoEvidence(
            moneyToCents(importe),
            allocations.map(({ targetId, appliedCents: allocated }) => ({
              targetId,
              appliedCents: allocated,
            })),
          ),
        });
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "PAGO_CLIENTE",
          entidad: "clientes",
          entidadId: String(id),
          datosDespues: {
            movimientoCreditoId: created!.id,
            movimiento: creditMovementAuditSnapshot(created!),
            importe,
            formaPago: body.formaPago,
            cuentaDestino: body.cuentaDestino,
            asignaciones,
             saldoAFavor: centsToMoney(projection.overpaymentCents),
             saldoAFavorGenerado: centsToMoney(sourceRemainderCents),
          },
          ip: getRequestIp(req),
        });
         return {
           created: created!,
           asignaciones,
           saldoAFavor: centsToMoney(projection.overpaymentCents),
           saldoAFavorGenerado: centsToMoney(sourceRemainderCents),
         };
      });
      if (!result) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      res.status(201).json(
        CreateClientePagoResponse.parse({
          id: result.created.id,
          clienteId: id,
          monto: result.created.importe.startsWith("-") ? result.created.importe.slice(1) : result.created.importe,
          cuentaDestino: result.created.cuentaDestino,
          asignaciones: result.asignaciones,
          saldoAFavor: result.saldoAFavor,
           saldoAFavorGenerado: result.saldoAFavorGenerado,
        }),
      );
    } catch (e) {
      if (e instanceof CreditEvidenceError) {
        res.status(e.statusCode).json({ error: e.message }); return;
      }
      if (e instanceof Error && e.message === "SYSTEM_CLIENT_CREDIT") {
        res.status(400).json({ error: "Venta a Público no admite movimientos de crédito." });
        return;
      }
      if (e instanceof Error && e.message === "INACTIVE_CLIENT") {
        res.status(409).json({ error: "El cliente está inactivo.", code: "INACTIVE_CLIENT" });
        return;
      }
      if (e instanceof Error && e.message === "DIRECTED_PAYMENT") {
        res.status(400).json({ error: "Un abono no puede dirigirse a un ticket; se aplica FIFO." });
        return;
      }
      next(e);
    }
  },
);

// A mistaken ABONO is never edited or deleted: the exact inverse is appended
// and its historical FIFO applications simply cease to be active.
router.post(
  "/clientes/:id/pagos/:pagoId/reversar",
  requierePermiso("clientes_finanzas", "autorizar"),
  async (req, res, next): Promise<void> => {
    try {
      const clienteId = parseId(req.params.id);
      const pagoId = parseId(req.params.pagoId);
      const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
      if (!clienteId || !pagoId || !motivo) {
        res.status(400).json({ error: "ID y motivo son obligatorios." }); return;
      }
      const evidence = readCreditEvidenceInput(req.body);
      const importe = canonicalCreditMoney(req.body?.importe);
      if (Number(importe) <= 0) throw new CreditEvidenceError("Declara el importe positivo del abono a reversar.", 400);
      const physical = evidence.naturaleza === "DEVOLUCION_FISICA";
      if (physical) {
        // E2 physical refunds have a separate inactive workflow; accounting corrections stay separate.
        const { assertCreditRefundEnabled } = await import("../lib/credit-refund-contract");
        assertCreditRefundEnabled();
        throw new CreditEvidenceError("Usa el flujo dedicado de devolución física E2.", 409);
      }
      const formaPago = physical ? req.body?.formaPago : null;
      const cuentaDestino = physical ? req.body?.cuentaDestino : null;
      const referencia = typeof req.body?.referencia === "string" ? req.body.referencia.trim() : null;
      if (physical && (!["EFECTIVO", "TRANSFERENCIA", "FACTURADO"].includes(formaPago) || !isValidPaymentDestination(formaPago, cuentaDestino))) {
        throw new CreditEvidenceError("Declara el medio y cuenta de la devolución real.", 400);
      }
      if (physical && formaPago === "TRANSFERENCIA" && !referencia) {
        throw new CreditEvidenceError("La devolución por transferencia requiere referencia.", 400);
      }
      const reverso = await db.transaction(async (tx) => {
        await assertCreditEvidenceAccess(req, evidence, tx);
        const claim = await claimCreditOperation(tx, {
          productor: "REVERSO_ABONO", clave: evidence.operacionClave,
          naturaleza: evidence.naturaleza, actorId: req.auth!.user.id,
          contenido: { clienteId, pagoId, importe, motivo, formaPago, cuentaDestino, referencia, destinos: [{ movimientoOrigenId: pagoId, importe }], ...evidence },
        });
        if (claim.replay) return claim.movement;
        await assertCreditEvidenceScope(req, evidence, tx);
        await transactionAdvisoryLock(
          tx,
          ADVISORY_LOCK_NAMESPACES.CUSTOMER_CREDIT,
          clienteId,
        );
        const original = await tx.execute<any>(sql`
          SELECT * FROM movimientos_credito
          WHERE id=${pagoId} AND cliente_id=${clienteId} AND tipo='ABONO' FOR UPDATE`);
        const abono = original.rows[0];
        if (!abono) throw new Error("PAYMENT_NOT_FOUND");
        if (canonicalCreditMoney(Math.abs(Number(abono.importe))) !== importe) {
          throw new CreditEvidenceError("El importe declarado no coincide con el abono original.", 409);
        }
        const prior = await tx.execute(sql`
          SELECT id FROM movimientos_credito
          WHERE tipo='REVERSO' AND movimiento_origen_id=${pagoId}`);
        if (prior.rows[0]) throw new Error("PAYMENT_ALREADY_REVERSED");
        const apps = await tx.execute(sql`
          SELECT venta_movimiento_id, importe::text AS importe FROM aplicaciones_credito
          WHERE abono_movimiento_id=${pagoId} ORDER BY id`);
        const created = await insertCreditMovementE1(tx, {
          clienteId, tipo: "REVERSO", importe: Math.abs(Number(abono.importe)).toFixed(2),
          movimientoOrigenId: pagoId, usuarioId: req.auth!.user.id, notas: motivo,
          formaPago, cuentaDestino, referencia,
          createdAt: new Date(),
          metadata: JSON.stringify({ origen: "REVERSO_ABONO", motivo }),
        }, evidence, "REVERSO_ABONO");
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id, accion: "REVERSAR_PAGO_CLIENTE",
          entidad: "movimientos_credito", entidadId: String(created!.id),
          datosAntes: { pagoId, importe: abono.importe, asignaciones: apps.rows },
          datosDespues: {
            reversoId: created!.id,
            movimiento: creditMovementAuditSnapshot(created!),
            importe: created!.importe,
            motivo,
            asignaciones: apps.rows,
          },
          ip: getRequestIp(req),
        });
        return created!;
      });
      res.status(201).json(reverso);
    } catch (error) {
      if (error instanceof CreditEvidenceError) {
        res.status(error.statusCode).json({ error: error.message }); return;
      }
      if (error instanceof Error && error.message === "PAYMENT_NOT_FOUND") {
        res.status(404).json({ error: "El abono no corresponde al cliente." }); return;
      }
      if (error instanceof Error && error.message === "PAYMENT_ALREADY_REVERSED") {
        res.status(409).json({ error: "El abono ya fue revertido." }); return;
      }
      next(error);
    }
  },
);

router.post(
  "/clientes/:id/ajustes",
  requierePermiso("clientes_finanzas", "autorizar"),
  async (req, res, next): Promise<void> => {
    try {
      const id = parseId(req.params.id);
      const importe = Number(req.body?.importe);
      const motivo =
        typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
      const fechaEfectiva =
        typeof req.body?.fechaEfectiva === "string"
          ? new Date(req.body.fechaEfectiva)
          : new Date();
      if (!id || !Number.isFinite(importe) || importe === 0 || motivo.length < 10) {
        res.status(400).json({
          error: "Importe distinto de cero y motivo de al menos 10 caracteres son obligatorios.",
        });
        return;
      }
      if (Number.isNaN(fechaEfectiva.getTime()) || fechaEfectiva > new Date()) {
        res.status(400).json({ error: "Fecha efectiva inválida o futura." });
        return;
      }
      const ticketId =
        Number.isInteger(Number(req.body?.ticketId))
          ? Number(req.body.ticketId)
          : null;
      if (!canLinkAdjustmentToTicket(importe, ticketId)) {
        res.status(400).json({
          error:
            "Los ajustes negativos se aplican por antigüedad y no pueden ligarse a un ticket.",
        });
        return;
      }
      const evidence = readCreditEvidenceInput(req.body);
      if (!evidence.notaOrigenId && !evidence.origenJustificacion?.trim()) {
        throw new CreditEvidenceError("Elige tienda y justifica el origen si no puedes identificar la nota.", 400);
      }
      if (ticketId != null && evidence.notaOrigenId !== ticketId) {
        throw new CreditEvidenceError("La nota de origen debe coincidir con el ticket del ajuste.", 400);
      }
      const referencia = typeof req.body?.referencia === "string" ? req.body.referencia : null;
      const result = await db.transaction(async (tx) => {
        await assertCreditEvidenceAccess(req, evidence, tx);
        const claim = await claimCreditOperation(tx, {
          productor: "AJUSTE_MANUAL", clave: evidence.operacionClave,
          naturaleza: evidence.naturaleza, actorId: req.auth!.user.id,
          contenido: {
            clienteId: id, importe: canonicalCreditMoney(importe), motivo, ticketId, referencia,
            destinos: ticketId == null ? [] : [{ ticketId, importe: canonicalCreditMoney(importe) }],
            fechaEfectiva: req.body?.fechaEfectiva == null ? null : fechaEfectiva.toISOString(), ...evidence,
          },
        });
        if (claim.replay) return claim.movement;
        await assertCreditEvidenceScope(req, evidence, tx);
        if (evidence.notaOrigenId != null) {
          const [note] = await tx.select({ id: ticketsTable.id }).from(ticketsTable)
            .where(and(eq(ticketsTable.id, evidence.notaOrigenId), eq(ticketsTable.clienteId, id),
              eq(ticketsTable.ubicacionId, evidence.sitioOrigenId))).limit(1);
          if (!note) throw new CreditEvidenceError("La nota de origen no pertenece al cliente y sitio autorizado.", 400);
        }
        const [client] = await tx
          .select({
            id: clientesTable.id,
            esSistema: clientesTable.esSistema,
            activo: clientesTable.activo,
          })
          .from(clientesTable)
          .where(eq(clientesTable.id, id))
          .for("update")
          .limit(1);
        if (!client) throw new CreditEvidenceError("Cliente no encontrado.", 404);
        if (!client.activo) throw new Error("INACTIVE_CLIENT");
        if (client.esSistema) throw new Error("SYSTEM_CLIENT_CREDIT");
        if (ticketId != null) {
          const [ticket] = await tx
            .select({ id: ticketsTable.id })
            .from(ticketsTable)
            .where(
              and(
                eq(ticketsTable.id, ticketId),
                eq(ticketsTable.clienteId, id),
              ),
            )
            .limit(1);
          if (!ticket) throw new Error("INVALID_PAYMENT_TICKET");
        }
        const created = await insertCreditMovementE1(tx, {
            clienteId: id,
            tipo: "AJUSTE",
            importe: importe.toFixed(2),
            usuarioId: req.auth!.user.id,
            notas: motivo,
            ticketId,
            referencia,
            createdAt: fechaEfectiva,
            metadata: JSON.stringify({
              origen: "AJUSTE_MANUAL",
              ip: getRequestIp(req),
            }),
          }, evidence, "AJUSTE_MANUAL");
        await tx.insert(auditoriaTable).values({
          usuarioId: req.auth!.user.id,
          accion: "AJUSTE_CREDITO",
          entidad: "clientes",
          entidadId: String(id),
          datosDespues: {
            movimientoCreditoId: created!.id,
            movimiento: creditMovementAuditSnapshot(created!),
            importe,
            motivo,
          },
          ip: getRequestIp(req),
        });
        return created;
      });
      if (!result) {
        res.status(404).json({ error: "Cliente no encontrado." });
        return;
      }
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof CreditEvidenceError) {
        res.status(error.statusCode).json({ error: error.message }); return;
      }
      if (error instanceof Error && error.message === "SYSTEM_CLIENT_CREDIT") {
        res.status(400).json({ error: "Venta a Público no admite ajustes de crédito." });
        return;
      }
      if (error instanceof Error && error.message === "INACTIVE_CLIENT") {
        res.status(409).json({ error: "El cliente está inactivo.", code: "INACTIVE_CLIENT" });
        return;
      }
      if (error instanceof Error && error.message === "INVALID_PAYMENT_TICKET") {
        res.status(400).json({ error: "El ticket no pertenece al cliente." });
        return;
      }
      next(error);
    }
  },
);

export default router;
