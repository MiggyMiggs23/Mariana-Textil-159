import { pool } from "@workspace/db";
import { buildHeatmapMatrix } from "./report-heatmap";
import { parseMexicoDateQuery } from "./mexico-date";

const ZONE = "America/Mexico_City";
const MONTH_COUNT = 12;
/**
 * Suggestions need three observed calendar months.  With less history one
 * unusual week can distort the projection and turn a coincidence into a
 * number that looks like analysis.  This is intentionally the only threshold
 * used by this report: changing it changes every suggestion, not the facts.
 */
export const HISTORY_MIN_MONTHS = 3;

const ACTUAL_EXIT_TYPES = new Set([
  "VENTA",
  "SALIDA_MOSTRADOR",
  "TRANSFERENCIA_SALIDA",
]);
/**
 * Inventory and sale documents are deliberately separate concepts.  A
 * SALIDA_MOSTRADOR is the terminal physical-removal path used by
 * /salidas/mostrador (its document is SALIDA/<id>); it is not evidence that a
 * customer bought anything.  Customer-sale evidence is produced by the POS
 * paths as a VENTA tied to a ticket/nota, including the three unit-specific
 * ticket document types used by FIFO consumption.
 */
const CUSTOMER_SALE_DOCUMENT_TYPES = new Set([
  "TICKET",
  "NOTA",
  "TICKET_BOLSA_NORMAL",
  "TICKET_BOLSA_METREADO",
  "TICKET_PIEZA_NORMAL",
]);
const QUARTER_MONTHS = 3;

type Primitive = string | number | boolean | null;
type Row = Record<string, Primitive>;

export type QueComprarMovement = {
  id: number;
  productoId: number;
  ubicacionId: number;
  date: string | Date;
  type: string;
  quantity: number | string;
  documentType?: string | null;
  documentId?: string | number | null;
  movementOriginId?: number | null;
};

export type QueComprarEpisode = {
  id: number;
  productoId: number;
  ubicacionId: number;
  minimum: number;
  existence: number;
  difference: number;
  openedAt: string | Date;
  closedAt?: string | Date | null;
  movementId?: number | null;
  causa?: "MOVIMIENTO" | "CONFIGURACION" | "SNAPSHOT";
  /** Context-only episode that was already open at the requested start. */
  carriedIntoPeriod?: boolean;
};

export type QueComprarProductSite = {
  productoId: number;
  ubicacionId: number;
  sku: string;
  tela: string;
  color: string;
  unidad: string;
  sitio: string;
  existenciaActual: number;
  minimoCapturado: number | null;
};

export type QueComprarRow = Row & {
  productoId: number;
  ubicacionId: number;
  evidenceUrl: string;
};

export type QueComprarAggregation = {
  movements: QueComprarMovement[];
  consumptionMovements: QueComprarMovement[];
  saleMovements: QueComprarMovement[];
  consumptionByMonth: Map<string, number>;
  salesByMonth: Map<string, number>;
  consumptionQuantity: number;
  earliestObservation: Date | null;
};

function finiteNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function parseIds(value: unknown): number[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));
}

function parseStrings(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function dateValue(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function monthKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(dateValue(value));
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function mexicoDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return [
    parts.find((part) => part.type === "year")?.value,
    parts.find((part) => part.type === "month")?.value,
    parts.find((part) => part.type === "day")?.value,
  ].join("-");
}

function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export function monthSeries(end: string | Date, count = MONTH_COUNT): string[] {
  const endMonth = monthKey(end);
  const cursor = monthDate(endMonth);
  const result: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const item = new Date(cursor);
    item.setUTCMonth(item.getUTCMonth() - index);
    result.push(item.toISOString().slice(0, 7));
  }
  return result;
}

function mexicoCalendarParts(value: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const numberPart = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: numberPart("year"),
    month: numberPart("month"),
    day: numberPart("day"),
    hour: numberPart("hour"),
    minute: numberPart("minute"),
    second: numberPart("second"),
    // Milliseconds are not exposed by Intl, but they are invariant when
    // comparing two instants in the same timezone.
    millisecond: value.getUTCMilliseconds(),
  };
}

function mexicoCalendarDate(value: Date): Date {
  const parts = mexicoCalendarParts(value);
  return new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  ));
}

/** Full elapsed calendar months, not the number of month buckets touched. */
function elapsedMonths(from: Date | null, to: Date): number {
  if (!from || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return 0;
  const localFrom = mexicoCalendarDate(from);
  const localTo = mexicoCalendarDate(to);
  if (localFrom > localTo) return 0;
  let result = (localTo.getUTCFullYear() - localFrom.getUTCFullYear()) * 12 +
    localTo.getUTCMonth() - localFrom.getUTCMonth();
  // setUTCMonth intentionally retains JavaScript's end-of-month overflow
  // semantics: Jan 31 + 3 months is May 1, so Jan 31 -> Apr 30 is two
  // complete calendar months rather than three touched buckets.
  const anniversary = new Date(localFrom);
  anniversary.setUTCMonth(anniversary.getUTCMonth() + result);
  if (anniversary > localTo) result -= 1;
  return Math.max(0, result);
}

function periodDays(from: Date | null, to: Date): number {
  if (!from || from > to) return 0;
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
}

/**
 * A cancellation is an accounting reversal of the origin movement.  The
 * origin and its cancellation are both excluded from facts, so a ticket or a
 * salida cannot be counted twice through its original and reversal rows.
 */
export function aggregateLedgerEvidence(
  movements: QueComprarMovement[],
): QueComprarAggregation {
  // A ledger row is one fact.  De-duplicate by its immutable movement id
  // before deriving either consumption or customer-sale facts.
  const uniqueMovements = [...new Map(movements.map((movement) => [movement.id, movement])).values()];
  const cancelledOrigins = new Set(
    uniqueMovements
      .filter((movement) => movement.type === "CANCELACION" && movement.movementOriginId != null)
      .map((movement) => String(movement.movementOriginId)),
  );
  const actual = uniqueMovements.filter((movement) =>
    ACTUAL_EXIT_TYPES.has(movement.type) &&
    !cancelledOrigins.has(String(movement.id)) &&
    finiteNumber(movement.quantity) < 0,
  );
  const consumptionMovements = actual;
  const saleMovements = actual.filter(isCustomerSaleMovement);
  const consumptionByMonth = new Map<string, number>();
  const salesByMonth = new Map<string, number>();
  let earliestObservation: Date | null = null;
  for (const movement of uniqueMovements) {
    const date = dateValue(movement.date);
    if (!Number.isFinite(date.getTime())) continue;
    // A cancellation is an accounting event, not a new observation of stock
    // at this product/site pair.  Every other ledger movement, including
    // receipts and transfer entries, establishes that the pair was observed.
    if (movement.type === "CANCELACION") continue;
    if (!earliestObservation || date < earliestObservation) earliestObservation = date;
  }
  for (const movement of actual) {
    const date = dateValue(movement.date);
    if (!Number.isFinite(date.getTime())) continue;
    const quantity = Math.abs(finiteNumber(movement.quantity));
    const month = monthKey(date);
    consumptionByMonth.set(month, (consumptionByMonth.get(month) ?? 0) + quantity);
    if (isCustomerSaleMovement(movement)) {
      salesByMonth.set(month, (salesByMonth.get(month) ?? 0) + quantity);
    }
  }
  return {
    movements: uniqueMovements,
    consumptionMovements,
    saleMovements,
    consumptionByMonth,
    salesByMonth,
    consumptionQuantity: consumptionMovements.reduce(
      (sum, movement) => sum + Math.abs(finiteNumber(movement.quantity)),
      0,
    ),
    earliestObservation,
  };
}

export function isCustomerSaleMovement(movement: QueComprarMovement): boolean {
  return movement.type === "VENTA" &&
    movement.documentId != null &&
    String(movement.documentId).trim() !== "" &&
    movement.documentType != null &&
    CUSTOMER_SALE_DOCUMENT_TYPES.has(String(movement.documentType).trim().toUpperCase());
}

export function splitEpisodesByRequestedPeriod(
  episodes: QueComprarEpisode[],
  desde: Date,
  hasta: Date,
): { period: QueComprarEpisode[]; carried: QueComprarEpisode[] } {
  const period: QueComprarEpisode[] = [];
  const carried: QueComprarEpisode[] = [];
  for (const episode of episodes) {
    const openedAt = dateValue(episode.openedAt);
    if (!Number.isFinite(openedAt.getTime()) || openedAt > hasta) continue;
    if (openedAt >= desde) {
      period.push({ ...episode, carriedIntoPeriod: false });
      continue;
    }
    const closedAt = episode.closedAt == null ? null : dateValue(episode.closedAt);
    if (closedAt == null || (Number.isFinite(closedAt.getTime()) && closedAt >= desde)) {
      carried.push({ ...episode, carriedIntoPeriod: true });
    }
  }
  return { period, carried };
}

function trailingNoMovementMonths(months: string[], values: Map<string, number>, firstMonth: string | null): number {
  if (!firstMonth) return 0;
  let result = 0;
  for (let index = months.length - 1; index >= 0; index -= 1) {
    const month = months[index]!;
    if (month < firstMonth) break;
    if ((values.get(month) ?? 0) !== 0) break;
    result += 1;
  }
  return result;
}

function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthDate(month));
}

function suggestionText(input: {
  historyMonths: number;
  minimum: number | null;
  coverageDays: number | null;
  noMovementMonths: number;
  episodes: number;
  months: string[];
  consumptionByMonth: Map<string, number>;
  firstMonth: string | null;
  end: Date;
  firstObservation: Date | null;
}): string | null {
  if (input.historyMonths < HISTORY_MIN_MONTHS) {
    return `Sin información suficiente; cuenta con ${input.historyMonths} meses de historia.`;
  }
  const suggestions: string[] = [];
  if (input.minimum != null && input.coverageDays != null) {
    suggestions.push(`Tu mínimo cubre ${formatNumber(input.coverageDays)} días al ritmo observado.`);
  }
  if (input.minimum != null && input.noMovementMonths > 0) {
    suggestions.push(`Este color no se ha movido en ${input.noMovementMonths} meses y tiene mínimo puesto.`);
  }
  if (input.episodes > 0) {
    suggestions.push(`Te quedaste bajo el mínimo ${input.episodes} veces desde que el motor tiene historial.`);
  }
  if (input.firstMonth && elapsedMonths(input.firstObservation, input.end) >= QUARTER_MONTHS * 2) {
    // This comparison is a fixed quarter-over-quarter observation.  It must
    // not change when the history threshold is edited.
    const recent = input.months.slice(-QUARTER_MONTHS)
      .reduce((sum, month) => sum + (input.consumptionByMonth.get(month) ?? 0), 0);
    const prior = input.months.slice(-(QUARTER_MONTHS * 2), -QUARTER_MONTHS)
      .reduce((sum, month) => sum + (input.consumptionByMonth.get(month) ?? 0), 0);
    const recentStart = monthDate(input.months[input.months.length - QUARTER_MONTHS]!);
    const priorStart = monthDate(input.months[input.months.length - (QUARTER_MONTHS * 2)]!);
    const recentDays = periodDays(recentStart, input.end);
    const priorDays = Math.max(1, Math.floor((recentStart.getTime() - priorStart.getTime()) / 86400000));
    const recentRate = recent / recentDays;
    const priorRate = prior / priorDays;
    if (priorRate > 0 && recentRate > priorRate) {
      suggestions.push(`Este color se consume ${formatNumber(recentRate / priorRate)} veces más que hace un trimestre (tasas observadas por día).`);
    }
  }
  return suggestions.length ? suggestions.join(" · ") : null;
}

export function buildQueComprarRow(input: {
  productSite: QueComprarProductSite;
  movements: QueComprarMovement[];
  episodes?: QueComprarEpisode[];
  months: string[];
  end: Date;
  evidenceUrl?: string;
}): QueComprarRow {
  const aggregation = aggregateLedgerEvidence(input.movements);
  const firstMonth = aggregation.earliestObservation ? monthKey(aggregation.earliestObservation) : null;
  const historyMonths = elapsedMonths(aggregation.earliestObservation, input.end);
  const consumptionPeriodDays = periodDays(aggregation.earliestObservation, input.end);
  const averageDailyConsumption = consumptionPeriodDays > 0
    ? aggregation.consumptionQuantity / consumptionPeriodDays
    : 0;
  const coverageDaysMinimum = input.productSite.minimoCapturado != null && averageDailyConsumption > 0
    ? input.productSite.minimoCapturado / averageDailyConsumption
    : null;
  const coverageDaysExistence = averageDailyConsumption > 0
    ? input.productSite.existenciaActual / averageDailyConsumption
    : null;
  const noMovementMonths = trailingNoMovementMonths(input.months, aggregation.consumptionByMonth, firstMonth);
  const episodes = input.episodes ?? [];
  const evidenceUrl = input.evidenceUrl ?? "";
  const row: Record<string, Primitive> = {
    productoId: input.productSite.productoId,
    ubicacionId: input.productSite.ubicacionId,
    sku: input.productSite.sku,
    tela: input.productSite.tela,
    color: input.productSite.color,
    unidad: input.productSite.unidad,
    sitio: input.productSite.sitio,
    ventaRealCliente: input.months.reduce((sum, month) => sum + (aggregation.salesByMonth.get(month) ?? 0), 0),
    existenciaActual: input.productSite.existenciaActual,
    minimoCapturado: input.productSite.minimoCapturado,
    coberturaDiasMinimo: coverageDaysMinimum,
    coberturaDiasExistencia: coverageDaysExistence,
    deficitMinimoObservado: input.productSite.minimoCapturado == null
      ? null
      : Math.max(0, input.productSite.minimoCapturado - input.productSite.existenciaActual),
    mesesHistoria: historyMonths,
    periodoConsumoDias: consumptionPeriodDays,
    consumoPromedioDiario: averageDailyConsumption,
    noMovimiento: noMovementMonths > 0,
    mesesSinMovimiento: noMovementMonths,
    bajoMinimo: input.productSite.minimoCapturado != null &&
      input.productSite.existenciaActual < input.productSite.minimoCapturado,
    episodiosBajoMinimo: episodes.length,
    historialInicio: aggregation.earliestObservation?.toISOString() ?? null,
    sugerencia: suggestionText({
      historyMonths,
      minimum: input.productSite.minimoCapturado,
      coverageDays: coverageDaysMinimum,
      noMovementMonths,
      episodes: episodes.length,
      months: input.months,
      consumptionByMonth: aggregation.consumptionByMonth,
      firstMonth,
      end: input.end,
      firstObservation: aggregation.earliestObservation,
    }),
    evidenceUrl,
  };
  input.months.forEach((month, index) => {
    row[`consumoMes${String(index + 1).padStart(2, "0")}`] =
      firstMonth && month >= firstMonth ? aggregation.consumptionByMonth.get(month) ?? 0 : null;
  });
  return row as QueComprarRow;
}

export function buildEvidenceReconciliation(
  enabled: boolean,
  movements: QueComprarMovement[],
  expected?: {
    row?: QueComprarRow;
    episodes?: QueComprarEpisode[];
    months?: string[];
    end?: Date;
  },
): {
  enabled: boolean;
  movementIds: number[];
  consumptionQuantity: number;
  movementQuantity: number;
  difference: number;
  matches: boolean;
  monthlyQuantitiesMatch?: boolean;
  customerSaleMatch?: boolean;
  coverageMatch?: boolean;
  episodeCountMatch?: boolean;
  historyMatch?: boolean;
  rowEpisodeCount?: number;
  ledgerEpisodeCount?: number;
} {
  if (!enabled) {
    return {
      enabled: false,
      movementIds: [],
      consumptionQuantity: 0,
      movementQuantity: 0,
      difference: 0,
      matches: true,
    };
  }
  const aggregation = aggregateLedgerEvidence(movements);
  const movementQuantity = aggregation.consumptionQuantity;
  const row = expected?.row;
  // Keep the two sides independent: the row-side quantity comes from the
  // displayed equation while the movement-side quantity comes from the
  // ledger once.  The old response names are retained for the evidence UI.
  const rowConsumptionQuantity = row
    ? finiteNumber(row.consumoPromedioDiario) * finiteNumber(row.periodoConsumoDias)
    : movementQuantity;
  const difference = rowConsumptionQuantity - movementQuantity;
  let monthlyQuantitiesMatch: boolean | undefined;
  let customerSaleMatch: boolean | undefined;
  let coverageMatch: boolean | undefined;
  let episodeCountMatch: boolean | undefined;
  let historyMatch: boolean | undefined;

  if (row && expected?.months && expected.end) {
    const firstMonth = aggregation.earliestObservation
      ? monthKey(aggregation.earliestObservation)
      : null;
    monthlyQuantitiesMatch = expected.months.every((month, index) => {
      const key = `consumoMes${String(index + 1).padStart(2, "0")}`;
      const expectedValue = firstMonth && month >= firstMonth
        ? aggregation.consumptionByMonth.get(month) ?? 0
        : null;
      const actualValue = row[key];
      return expectedValue == null
        ? actualValue == null
        : actualValue != null && Math.abs(finiteNumber(actualValue) - expectedValue) <= 0.001;
    });
    const expectedSale = expected.months.reduce(
      (sum, month) => sum + (aggregation.salesByMonth.get(month) ?? 0),
      0,
    );
    customerSaleMatch = Math.abs(finiteNumber(row.ventaRealCliente) - expectedSale) <= 0.001;

    const period = periodDays(aggregation.earliestObservation, expected.end);
    const average = period > 0 ? movementQuantity / period : 0;
    const expectedMinimumCoverage =
      row.minimoCapturado != null && average > 0
        ? finiteNumber(row.minimoCapturado) / average
        : null;
    const expectedExistenceCoverage =
      average > 0 ? finiteNumber(row.existenciaActual) / average : null;
    const minimumCoverageMatch =
      expectedMinimumCoverage == null
        ? row.coberturaDiasMinimo == null
        : row.coberturaDiasMinimo != null &&
          Math.abs(finiteNumber(row.coberturaDiasMinimo) - expectedMinimumCoverage) <= 0.001;
    const existenceCoverageMatch =
      expectedExistenceCoverage == null
        ? row.coberturaDiasExistencia == null
        : row.coberturaDiasExistencia != null &&
          Math.abs(finiteNumber(row.coberturaDiasExistencia) - expectedExistenceCoverage) <= 0.001;
    coverageMatch =
      Math.abs(finiteNumber(row.periodoConsumoDias) - period) <= 0.001 &&
      Math.abs(finiteNumber(row.consumoPromedioDiario) - average) <= 0.001 &&
      minimumCoverageMatch &&
      existenceCoverageMatch;
    historyMatch =
      Math.abs(finiteNumber(row.mesesHistoria) -
        elapsedMonths(aggregation.earliestObservation, expected.end)) <= 0.001;
  }

  if (row && expected?.episodes) {
    // Episodes and episodeEvents are two views of the same episode facts;
    // count the persisted episode rows exactly once.
    const ledgerEpisodeCount = expected.episodes.length;
    episodeCountMatch = finiteNumber(row.episodiosBajoMinimo) === ledgerEpisodeCount;
  }

  const checks = [
    Math.abs(difference) <= 0.001,
    monthlyQuantitiesMatch,
    customerSaleMatch,
    coverageMatch,
    episodeCountMatch,
    historyMatch,
  ].filter((value): value is boolean => value !== undefined);
  return {
    enabled: true,
    movementIds: aggregation.consumptionMovements.map((movement) => movement.id),
    consumptionQuantity: rowConsumptionQuantity,
    movementQuantity,
    difference,
    matches: checks.every(Boolean),
    monthlyQuantitiesMatch,
    customerSaleMatch,
    coverageMatch,
    episodeCountMatch,
    historyMatch,
    ...(row && expected?.episodes
      ? {
          rowEpisodeCount: finiteNumber(row.episodiosBajoMinimo),
          ledgerEpisodeCount: expected.episodes.length,
        }
      : {}),
  };
}

function table(
  id: string,
  title: string,
  fields: Array<[string, string, string, boolean?, boolean?]>,
  rows: Row[],
) {
  return {
    id,
    title,
    columns: fields.map(([key, label, kind, economic, estimated]) => ({
      key,
      label,
      kind,
      ...(economic ? { economic: true } : {}),
      ...(estimated ? { estimated: true } : {}),
    })),
    rows,
    // Quantities from different units are deliberately never totalled.
    totals: {},
  };
}

function scopeValues(ctx: DomainReportContext, locationColumn: string, alias: string) {
  const values: unknown[] = [];
  const clauses: string[] = [];
  const add = (expression: string, value: unknown, cast: string) => {
    if (Array.isArray(value) && value.length) {
      values.push(value);
      clauses.push(`${expression}=ANY($${values.length}::${cast})`);
    }
  };
  add(`${alias}.id`, parseIds(ctx.input.productoIds), "int[]");
  add(`${alias}.tela`, parseStrings(ctx.input.telas), "text[]");
  add(`${alias}.color`, parseStrings(ctx.input.colores), "text[]");
  add(`${alias}.unidad::text`, parseStrings(ctx.input.unidades), "text[]");
  add(
    locationColumn,
    ctx.locations?.length ? ctx.locations : parseIds(ctx.input.ubicacionIds),
    "int[]",
  );
  return { text: clauses.length ? clauses.join(" AND ") : "TRUE", values };
}

function withOffset(text: string, offset: number): string {
  return text.replace(/\$(\d+)/g, (_, value) => `$${Number(value) + offset}`);
}

function isMissingConfiguration(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42P01" ||
    /stock_minimo_(sitios|episodios|s)\b/.test(candidate.message ?? "");
}

export interface DomainReportContext {
  input: Record<string, unknown>;
  locations?: number[];
  range: {
    desde: Date;
    hasta: Date;
    previousDesde: Date;
    previousHasta: Date;
    yearAgoDesde: Date;
    yearAgoHasta: Date;
  };
}

type EnabledSite = { ubicacionId: number; sitio: string };

function emptyReport(warnings: string[]) {
  return {
    kpis: [
      { id: "renglones", label: "Renglones producto-sitio", value: 0, kind: "count" },
      { id: "sitios-habilitados", label: "Sitios habilitados", value: 0, kind: "count" },
    ],
    charts: [],
    tables: [table(
      "que-comprar",
      "Qué comprar por producto y sitio",
      [["sku", "SKU", "text"], ["sitio", "Sitio", "text"]],
      [],
    )],
    warnings,
  };
}

function reportFilters(ctx: DomainReportContext, initial: unknown[] = []) {
  const scope = scopeValues(ctx, "ss.ubicacion_id", "p");
  return {
    text: scope.text,
    values: [...initial, ...scope.values],
  };
}

async function readEnabledSites(ctx: DomainReportContext): Promise<EnabledSite[]> {
  const requested = ctx.locations?.length ? ctx.locations : parseIds(ctx.input.ubicacionIds);
  const result = await pool.query(
    `SELECT ss.ubicacion_id,u.nombre
       FROM stock_minimo_sitios ss
       JOIN ubicaciones u ON u.id=ss.ubicacion_id
      WHERE ss.habilitado=true AND u.activa=true
        AND ($1::int[] IS NULL OR ss.ubicacion_id=ANY($1::int[]))
      ORDER BY u.nombre,ss.ubicacion_id`,
    [requested.length ? requested : null],
  );
  return result.rows.map((row) => ({
    ubicacionId: Number(row.ubicacion_id),
    sitio: String(row.nombre),
  }));
}

function activeSitesCte() {
  return `(
    SELECT ss.ubicacion_id,u.nombre
      FROM stock_minimo_sitios ss
      JOIN ubicaciones u ON u.id=ss.ubicacion_id
     WHERE ss.habilitado=true AND u.activa=true
  )`;
}

export async function buildQueComprarReport(ctx: DomainReportContext) {
  let sites: EnabledSite[];
  try {
    sites = await readEnabledSites(ctx);
  } catch (error) {
    if (isMissingConfiguration(error)) {
      return emptyReport([
        "No hay configuración de stock mínimo disponible; primero habilita al menos un sitio.",
      ]);
    }
    throw error;
  }
  if (!sites.length) {
    return emptyReport([
      "No hay sitios habilitados para stock mínimo; este reporte no calcula ni muestra productos.",
    ]);
  }

  const months = monthSeries(ctx.range.hasta);
  const baseCte = activeSitesCte();
  const productScope = reportFilters(ctx);
  const until = ctx.range.hasta;
  try {
    const [inventory, minimums, movementResult, episodeResult] = await Promise.all([
      pool.query(
        `SELECT e.producto_id,e.ubicacion_id,p.sku,p.tela,p.color,p.unidad,
                a.nombre sitio,COALESCE(e.cantidad_total,0)::float existencia
           FROM existencias e
           JOIN productos p ON p.id=e.producto_id AND p.activo=true
           JOIN ${baseCte} a ON a.ubicacion_id=e.ubicacion_id
          WHERE ${productScope.text.replace(/ss\.ubicacion_id/g, "e.ubicacion_id")}
                `.replace(/\s+$/, ""),
        productScope.values,
      ),
      pool.query(
        `SELECT sm.producto_id,sm.ubicacion_id,sm.cantidad::float minimo,
                p.sku,p.tela,p.color,p.unidad,a.nombre sitio
           FROM stock_minimos sm
           JOIN productos p ON p.id=sm.producto_id AND p.activo=true
           JOIN ${baseCte} a ON a.ubicacion_id=sm.ubicacion_id
          WHERE ${productScope.text.replace(/ss\.ubicacion_id/g, "sm.ubicacion_id")}`,
        productScope.values,
      ),
      pool.query(
        `SELECT m.id,m.producto_id,m.ubicacion_id,m.created_at,m.tipo,m.cantidad,
                m.documento_tipo,m.documento_id,m.movimiento_origen_id,
                p.sku,p.tela,p.color,p.unidad,a.nombre sitio
           FROM movimientos m
           JOIN productos p ON p.id=m.producto_id AND p.activo=true
           JOIN ${baseCte} a ON a.ubicacion_id=m.ubicacion_id
          WHERE m.created_at <= $1
            AND ${withOffset(productScope.text.replace(/ss\.ubicacion_id/g, "m.ubicacion_id"), 1)}`,
        [until, ...productScope.values],
      ),
      pool.query(
        `SELECT se.id,se.producto_id,se.ubicacion_id,se.minimo,se.existencia,
                se.diferencia,se.abierto_at,se.cerrado_at,se.movimiento_id,se.causa
           FROM stock_minimo_episodios se
           JOIN productos p ON p.id=se.producto_id AND p.activo=true
           JOIN ${baseCte} a ON a.ubicacion_id=se.ubicacion_id
           WHERE se.abierto_at >= $2
             AND se.abierto_at <= $1
             AND ${withOffset(productScope.text.replace(/ss\.ubicacion_id/g, "se.ubicacion_id"), 2)}`,
        [until, ctx.range.desde, ...productScope.values],
      ),
    ]);

    const products = new Map<string, QueComprarProductSite>();
    const key = (productoId: number, ubicacionId: number) => `${productoId}:${ubicacionId}`;
    for (const row of inventory.rows) {
      products.set(key(Number(row.producto_id), Number(row.ubicacion_id)), {
        productoId: Number(row.producto_id),
        ubicacionId: Number(row.ubicacion_id),
        sku: String(row.sku),
        tela: String(row.tela),
        color: String(row.color),
        unidad: String(row.unidad),
        sitio: String(row.sitio),
        existenciaActual: finiteNumber(row.existencia),
        minimoCapturado: null,
      });
    }
    const minimumByPair = new Map<string, number>();
    for (const row of minimums.rows) {
      const productoId = Number(row.producto_id);
      const ubicacionId = Number(row.ubicacion_id);
      const pair = key(productoId, ubicacionId);
      minimumByPair.set(pair, finiteNumber(row.minimo));
      products.set(pair, {
        productoId,
        ubicacionId,
        sku: String(row.sku),
        tela: String(row.tela),
        color: String(row.color),
        unidad: String(row.unidad),
        sitio: String(row.sitio),
        existenciaActual: products.get(pair)?.existenciaActual ?? 0,
        minimoCapturado: finiteNumber(row.minimo),
      });
    }
    const movementByPair = new Map<string, QueComprarMovement[]>();
    for (const row of movementResult.rows) {
      const movement = asMovement(row as Record<string, unknown>);
      const pair = key(movement.productoId, movement.ubicacionId);
      const current = movementByPair.get(pair) ?? [];
      current.push(movement);
      movementByPair.set(pair, current);
      const existing = products.get(pair);
      if (!existing) {
        const source = movementResult.rows.find((candidate) =>
          Number(candidate.producto_id) === movement.productoId &&
          Number(candidate.ubicacion_id) === movement.ubicacionId,
        )!;
        products.set(pair, {
          productoId: movement.productoId,
          ubicacionId: movement.ubicacionId,
          sku: String(source.sku),
          tela: String(source.tela),
          color: String(source.color),
          unidad: String(source.unidad),
          sitio: String(source.sitio),
          existenciaActual: 0,
          minimoCapturado: minimumByPair.get(pair) ?? null,
        });
      }
    }
    const episodesByPair = new Map<string, QueComprarEpisode[]>();
    for (const row of episodeResult.rows) {
      const episode: QueComprarEpisode = {
        id: Number(row.id),
        productoId: Number(row.producto_id),
        ubicacionId: Number(row.ubicacion_id),
        minimum: finiteNumber(row.minimo),
        existence: finiteNumber(row.existencia),
        difference: finiteNumber(row.diferencia),
        openedAt: new Date(row.abierto_at).toISOString(),
        closedAt: row.cerrado_at == null ? null : new Date(row.cerrado_at).toISOString(),
        movementId: row.movimiento_id == null ? null : Number(row.movimiento_id),
        causa: row.causa == null
          ? "SNAPSHOT"
          : String(row.causa) as QueComprarEpisode["causa"],
      };
      const pair = key(episode.productoId, episode.ubicacionId);
      const current = episodesByPair.get(pair) ?? [];
      current.push(episode);
      episodesByPair.set(pair, current);
    }

    const rows = [...products.values()]
      .filter((product) => sites.some((site) => site.ubicacionId === product.ubicacionId))
      .sort((left, right) =>
        left.sitio.localeCompare(right.sitio, "es-MX") ||
        left.tela.localeCompare(right.tela, "es-MX") ||
        left.color.localeCompare(right.color, "es-MX") ||
        left.sku.localeCompare(right.sku, "es-MX"),
      )
      .map((product) => {
        const pair = key(product.productoId, product.ubicacionId);
        const pairMovements = movementByPair.get(pair) ?? [];
        const query = new URLSearchParams({
          productoId: String(product.productoId),
          ubicacionId: String(product.ubicacionId),
          // Episodes are counted in the selected report period.  The
          // evidence endpoint receives the identical local-date bounds.
          desde: mexicoDateKey(ctx.range.desde),
          hasta: mexicoDateKey(ctx.range.hasta),
        });
        return buildQueComprarRow({
          productSite: {
            ...product,
            minimoCapturado: minimumByPair.has(pair) ? minimumByPair.get(pair)! : product.minimoCapturado,
          },
          movements: pairMovements,
          episodes: episodesByPair.get(pair) ?? [],
          months,
          end: ctx.range.hasta,
          evidenceUrl: `/api/reportes/que-comprar/evidencia?${query.toString()}`,
        });
      });

    const heatmapRows = [...movementByPair.values()]
      .flatMap((movements) => aggregateLedgerEvidence(movements).saleMovements)
      .map((movement) => {
        const source = products.get(key(movement.productoId, movement.ubicacionId));
        return source
          ? { color: source.color, mes: monthKey(movement.date), cantidad: Math.abs(finiteNumber(movement.quantity)) }
          : null;
      })
      .filter((row): row is { color: string; mes: string; cantidad: number } =>
        row != null && row.mes >= months[0]! && row.mes <= months[months.length - 1]!,
      );
    const chart = {
      id: "mes-color",
      title: "Mes × color · venta real al cliente",
      type: "heatmap",
      ...buildHeatmapMatrix({
        rows: heatmapRows,
        rowKey: "color",
        columnKey: "mes",
        valueKey: "cantidad",
        columns: months,
        kind: "quantity",
        formatColumnLabel: formatMonth,
      }),
    };
    const consumptionColumns = months.map((month, index): [string, string, string] => [
      `consumoMes${String(index + 1).padStart(2, "0")}`,
      `Consumo ${formatMonth(month)}`,
      "quantity",
    ]);
    const reportedRows = rows as Row[];
    return {
      kpis: [
        { id: "renglones", label: "Renglones producto-sitio", value: rows.length, kind: "count" },
        { id: "sitios-habilitados", label: "Sitios habilitados", value: sites.length, kind: "count" },
        { id: "bajo-minimo", label: "Bajo mínimo", value: rows.filter((row) => row.bajoMinimo === true).length, kind: "count" },
        { id: "sin-historia-suficiente", label: "Sin información suficiente", value: rows.filter((row) => Number(row.mesesHistoria) < HISTORY_MIN_MONTHS).length, kind: "count" },
      ],
      charts: [chart],
      tables: [table(
        "que-comprar",
        "Qué comprar por producto y sitio",
        [
          ["sku", "SKU", "text"], ["tela", "Tela", "text"], ["color", "Color", "text"],
          ["unidad", "Unidad", "text"], ["sitio", "Sitio", "text"],
          ...consumptionColumns, ["ventaRealCliente", "Venta real al cliente", "quantity"],
          ["existenciaActual", "Existencia actual", "quantity"],
          ["minimoCapturado", "Mínimo capturado", "quantity"],
          ["coberturaDiasExistencia", "Días de cobertura de existencia actual", "days"],
          ["coberturaDiasMinimo", "Días que cubre el mínimo", "days"],
          ["deficitMinimoObservado", "Déficit observado contra mínimo (no pedido)", "quantity"],
          ["mesesHistoria", "Meses de historia", "count"],
          ["periodoConsumoDias", "Periodo de consumo observado (días)", "days"],
          ["noMovimiento", "Sin movimiento en periodo", "boolean"],
          ["mesesSinMovimiento", "Meses sin movimiento", "count"],
          ["bajoMinimo", "Bajo mínimo", "boolean"],
          ["episodiosBajoMinimo", "Episodios bajo mínimo", "count"],
          ["sugerencia", "Observación", "text"], ["evidenceUrl", "Evidencia", "text"],
        ],
        reportedRows,
      )],
      warnings: [
        "El consumo por producto y sitio suma salidas de venta y traslado desde el ledger real. No se suma entre sitios: un traslado contaría dos veces.",
         "La venta real al cliente es una cifra separada y usa únicamente VENTA con documento POS de ticket o nota; una SALIDA_MOSTRADOR solo acredita remoción física.",
        "La cobertura de existencia actual y la cobertura que representa el mínimo son medidas distintas. El déficit observado contra mínimo no es una cantidad a pedir.",
        "Las sugerencias son observaciones sustentadas en movimientos y episodios; el sistema no supone plazo de reposición ni recomienda cantidades inventadas.",
        "Los episodios bajo mínimo se cuentan desde que el motor tiene historial; no se afirma que existieran antes.",
         "El movimiento asociado a un episodio es una fotografía del último movimiento del producto y sitio al abrirlo. Solo causa MOVIMIENTO prueba un cruce observado; SNAPSHOT no permite inferir un cruce histórico.",
      ],
    };
  } catch (error) {
    if (isMissingConfiguration(error)) {
      return emptyReport([
        "La configuración de stock mínimo no está disponible; no se calculó ningún producto.",
      ]);
    }
    throw error;
  }
}

export type EvidenceInput = {
  productoId: number;
  ubicacionId: number;
  desde: Date;
  hasta: Date;
};

export type QueComprarEvidenceResponse = {
  productoId: number;
  ubicacionId: number;
  filters: {
    desde: string;
    hasta: string;
  };
  inputs: {
    minimum: number | null;
    existence: number;
    consumptionQuantity: number;
    consumptionPeriodDays: number;
    averageDailyConsumption: number;
    minimumCoverageDays: number | null;
    equation: string;
  };
  movements: Array<{
    id: number;
    date: string;
    type: string;
    quantity: number;
    documentType: string | null;
    documentId: string | null;
    includedInConsumption: boolean;
    includedInCustomerSale: boolean;
  }>;
  episodes: QueComprarEpisode[];
  carriedEpisodes: QueComprarEpisode[];
  episodeEvents: Array<{
    episodeId: number;
    movementId: number | null | undefined;
    movement: QueComprarMovement | null;
    openedAt: string;
    closedAt: string | null;
    minimum: number;
    existence: number;
    difference: number;
    causa: "MOVIMIENTO" | "CONFIGURACION" | "SNAPSHOT";
    carriedIntoPeriod: boolean;
  }>;
  reconciliation: ReturnType<typeof buildEvidenceReconciliation>;
  row: QueComprarRow;
};

function asMovement(row: Record<string, unknown>): QueComprarMovement {
  return {
    id: Number(row.id),
    productoId: Number(row.producto_id),
    ubicacionId: Number(row.ubicacion_id),
    date: new Date(String(row.created_at)).toISOString(),
    type: String(row.tipo),
    quantity: finiteNumber(row.cantidad),
    documentType: row.documento_tipo == null ? null : String(row.documento_tipo),
    documentId: row.documento_id == null ? null : String(row.documento_id),
    movementOriginId: row.movimiento_origen_id == null ? null : Number(row.movimiento_origen_id),
  };
}

export async function getQueComprarEvidence(input: EvidenceInput): Promise<QueComprarEvidenceResponse | null> {
  let config;
  try {
    config = await pool.query(
      `SELECT p.id producto_id,p.sku,p.tela,p.color,p.unidad,
              u.id ubicacion_id,u.nombre sitio,u.activa,
              sm.cantidad::float minimo,e.cantidad_total::float existencia
         FROM productos p
         JOIN ubicaciones u ON u.id=$2 AND u.activa=true
         JOIN stock_minimo_sitios ss ON ss.ubicacion_id=u.id AND ss.habilitado=true
         LEFT JOIN stock_minimos sm ON sm.producto_id=p.id AND sm.ubicacion_id=u.id
         LEFT JOIN existencias e ON e.producto_id=p.id AND e.ubicacion_id=u.id
        WHERE p.id=$1 AND p.activo=true`,
      [input.productoId, input.ubicacionId],
    );
  } catch (error) {
    if (isMissingConfiguration(error)) return null;
    throw error;
  }
  const product = config.rows[0];
  if (!product) return null;
  const movementsResult = await pool.query(
    `SELECT id,producto_id,ubicacion_id,created_at,tipo,cantidad,
            documento_tipo,documento_id,movimiento_origen_id
       FROM movimientos
      WHERE producto_id=$1 AND ubicacion_id=$2
        AND created_at <= $3
      ORDER BY created_at,id`,
    [input.productoId, input.ubicacionId, input.hasta],
  );
  const episodesResult = await pool.query(
    `SELECT id,producto_id,ubicacion_id,minimo,existencia,diferencia,
            abierto_at,cerrado_at,movimiento_id,causa
       FROM stock_minimo_episodios
       WHERE producto_id=$1 AND ubicacion_id=$2
         AND abierto_at <= $4
         AND (cerrado_at IS NULL OR cerrado_at >= $3)
      ORDER BY abierto_at,id`,
    [input.productoId, input.ubicacionId, input.desde, input.hasta],
  );
  const movements = movementsResult.rows.map((row) => asMovement(row as Record<string, unknown>));
  const episodes = episodesResult.rows.map((row) => {
    const openedAt = new Date(row.abierto_at);
    return {
      id: Number(row.id),
      productoId: Number(row.producto_id),
      ubicacionId: Number(row.ubicacion_id),
      minimum: finiteNumber(row.minimo),
      existence: finiteNumber(row.existencia),
      difference: finiteNumber(row.diferencia),
      openedAt: openedAt.toISOString(),
      closedAt: row.cerrado_at == null ? null : new Date(row.cerrado_at).toISOString(),
      movementId: row.movimiento_id == null ? null : Number(row.movimiento_id),
      causa: row.causa == null
        ? "SNAPSHOT"
        : String(row.causa) as QueComprarEpisode["causa"],
      // The query keeps overlapping rows so an already-open episode can be
      // useful context, but it must not inflate the period's count.
      carriedIntoPeriod: openedAt < input.desde,
    };
  });
  const episodePeriod = splitEpisodesByRequestedPeriod(episodes, input.desde, input.hasta);
  const periodEpisodes = episodePeriod.period;
  const carriedEpisodes = episodePeriod.carried;
  const row = buildQueComprarRow({
    productSite: {
      productoId: input.productoId,
      ubicacionId: input.ubicacionId,
      sku: String(product.sku),
      tela: String(product.tela),
      color: String(product.color),
      unidad: String(product.unidad),
      sitio: String(product.sitio),
      existenciaActual: finiteNumber(product.existencia),
      minimoCapturado: product.minimo == null ? null : finiteNumber(product.minimo),
    },
    movements,
    episodes: periodEpisodes,
    months: monthSeries(input.hasta),
    end: input.hasta,
  });
  const aggregation = aggregateLedgerEvidence(movements);
  const movementById = new Map(movements.map((movement) => [movement.id, movement]));
  return {
    productoId: input.productoId,
    ubicacionId: input.ubicacionId,
    filters: {
      desde: input.desde.toISOString(),
      hasta: input.hasta.toISOString(),
    },
    inputs: {
      minimum: row.minimoCapturado as number | null,
      existence: row.existenciaActual as number,
      consumptionQuantity: aggregation.consumptionQuantity,
      consumptionPeriodDays: row.periodoConsumoDias as number,
      averageDailyConsumption: row.consumoPromedioDiario as number,
      minimumCoverageDays: row.coberturaDiasMinimo as number | null,
      equation: "minimumCoverageDays = minimum / (consumptionQuantity / consumptionPeriodDays)",
    },
    movements: movements.map((movement) => ({
      id: movement.id,
      date: dateValue(movement.date).toISOString(),
      type: movement.type,
      quantity: finiteNumber(movement.quantity),
      documentType: movement.documentType ?? null,
      documentId: movement.documentId == null ? null : String(movement.documentId),
      includedInConsumption: aggregation.consumptionMovements.some((item) => item.id === movement.id),
      includedInCustomerSale: aggregation.saleMovements.some((item) => item.id === movement.id),
    })),
    episodes: periodEpisodes,
    carriedEpisodes,
    episodeEvents: episodes.map((episode) => ({
      episodeId: episode.id,
      movementId: episode.movementId,
      movement: episode.movementId == null ? null : movementById.get(episode.movementId) ?? null,
      openedAt: episode.openedAt,
      closedAt: episode.closedAt,
      minimum: episode.minimum,
      existence: episode.existence,
      difference: episode.difference,
      causa: episode.causa ?? "SNAPSHOT",
      carriedIntoPeriod: episode.carriedIntoPeriod === true,
    })),
    reconciliation: buildEvidenceReconciliation(true, movements, {
      row,
      episodes: periodEpisodes,
      months: monthSeries(input.hasta),
      end: input.hasta,
    }),
    row,
  };
}

export function parseEvidenceDate(value: unknown, side: "start" | "end"): Date | null {
  return typeof value === "string" ? parseMexicoDateQuery(value, side) ?? null : null;
}