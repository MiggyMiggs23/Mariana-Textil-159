import {
  buildCommercialReport,
  type DomainReportContext as CommercialReportContext,
} from "./reportes-commercial";
import { buildControlOperativoReport } from "./reportes-control-operativo";
import {
  buildInventoryReport,
  type DomainReportContext as InventoryReportContext,
} from "./reportes-inventory";
import { buildQueComprarReport } from "./reportes-que-comprar";
import {
  buildSalesReport,
  type DomainReportContext as SalesReportContext,
} from "./reportes-sales";
import {
  buildReport,
  omitEconomicReportFilters,
  redactEconomic,
  reportRange,
  ReportInputError,
  type Report,
} from "./reportes";
import {
  compareStores,
  getDifferences,
  parseAnalyticsFilters,
} from "./admin-analytics";
import { listHeaderEligibleLocations } from "./header-locations";

export const COMPOSED_REPORT_VIEWS = [
  "ventas",
  "que-comprar",
  "utilidad",
  "clientes",
  "control-operativo",
] as const;

export type ComposedReportView = (typeof COMPOSED_REPORT_VIEWS)[number];
export type ComposedReportMode = "normal" | "comparar";

type ReportContent = {
  kpis: any[];
  charts: any[];
  tables: any[];
  warnings: string[];
};

export type ComposedReportInput = Record<string, unknown> & {
  modo?: ComposedReportMode;
  umbralCorte?: number;
  umbralTienda?: number;
  agrupacion?: "semana" | "mes";
  ubicacionId?: number;
};

export type ComposedReport = Report & {
  alerts?: Array<{
    sesionId: number;
    tipo: "FALTANTE" | "SOBRANTE";
    mensaje: string;
    importe: string;
    href?: string;
  }>;
};

export type ComposedAuthorization = {
  rol?: string;
  alcanceConsulta?: string | null;
};

type Context = {
  input: Record<string, unknown>;
  locations?: number[];
  range: ReturnType<typeof reportRange>;
};

const asContext = (ctx: Context): SalesReportContext => ctx;

/**
 * The five report tabs are compositions of the existing builders.  This
 * function deliberately does not merge or recalculate rows: each source's
 * tables, totals, KPIs, warnings, and chart matrices are appended intact.
 */
export function composeReportContent(
  view: ComposedReportView,
  sources: Array<{ section: string; content: ReportContent }>,
): ReportContent {
  return {
    kpis: sources.flatMap(({ content }) => content.kpis),
    charts: sources.flatMap(({ content }) => content.charts),
    tables: sources.flatMap(({ content }) => content.tables),
    warnings: sources.flatMap(({ content }) => content.warnings),
  };
}

function decorateComparisonFrame(
  content: ReportContent,
  site: { id: number; label: string },
): ReportContent & { alerts?: NonNullable<ComposedReport["alerts"]> } {
  const prefix = `sitio-${site.id}`;
  const frameLabel = `${site.label} (#${site.id})`;
  const decorateBlock = (block: any) => ({
    ...block,
    id: `${prefix}-${String(block.id ?? "bloque")}`,
    title: block.title ? `${frameLabel} · ${block.title}` : block.title,
    siteId: site.id,
    siteLabel: site.label,
  });
  return {
    kpis: content.kpis.map(decorateBlock),
    charts: content.charts.map(decorateBlock),
    tables: content.tables.map(decorateBlock),
    warnings: content.warnings.map((warning) => `[${frameLabel}] ${warning}`),
    ...("alerts" in content ? { alerts: (content as any).alerts } : {}),
  };
}

function ids(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => typeof item === "string" ? item.split(",") : [item])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .filter((id, index, all) => all.indexOf(id) === index);
}

function strictLocationIds(value: unknown): number[] {
  if (value === undefined || value === null || value === "") return [];
  const values = Array.isArray(value) ? value : [value];
  const parsed: number[] = [];
  for (const item of values) {
    for (const token of String(item).split(",")) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const id = Number(trimmed);
      if (!Number.isInteger(id) || id < 1) {
        throw new ReportInputError("El filtro de ubicaciones contiene un sitio inválido.");
      }
      if (!parsed.includes(id)) parsed.push(id);
    }
  }
  return parsed;
}

function sourceContext(ctx: Context): Context {
  // Keep the same context object shape for every existing domain builder.  In
  // particular, `locations` is the canonical PROPIA scope and is never
  // replaced by a requested multi-site filter.
  return ctx;
}

async function buildSource(
  section: string,
  ctx: Context,
  economic: boolean,
): Promise<ReportContent> {
  const sourceInput = economic ? ctx.input : omitEconomicReportFilters(ctx.input);
  const sourceContextValue = sourceContext({ ...ctx, input: sourceInput });
  let content: ReportContent;
  if (section === "ventas" || section === "utilidad") {
    content = await buildSalesReport(section, asContext(sourceContextValue));
  } else if (section === "inventario" || section === "mapas-calor" || section === "color") {
    content = await buildInventoryReport(section, sourceContextValue as InventoryReportContext);
  } else if (section === "que-comprar") {
    content = await buildQueComprarReport(sourceContextValue);
  } else if (section === "compras" || section === "clientes") {
    content = await buildCommercialReport(section, sourceContextValue as CommercialReportContext);
  } else if (section === "pagos-dirigidos") {
    // This source has a private builder in reportes.ts because it is shared
    // with the original endpoint. Calling it through that same builder keeps
    // its SQL and authorization/redaction contract unchanged.
    const result = await buildReport(section as "pagos-dirigidos", sourceInput, ctx.locations, economic);
    content = {
      kpis: (result.kpis as any[]) ?? [],
      charts: (result.charts as any[]) ?? [],
      tables: (result.tables as any[]) ?? [],
      warnings: (result.warnings as string[]) ?? [],
    };
    return content;
  } else {
    throw new Error(`Fuente de reporte compuesta no soportada: ${section}`);
  }

  return economic ? content : redactEconomic(content) as ReportContent;
}

export function comparisonTable(comparison: Awaited<ReturnType<typeof compareStores>>) {
  const columns = [
    { key: "nombreUbicacion", label: "Tienda", kind: "text" },
    { key: "participacion", label: "Part. %", kind: "percentage" },
    { key: "ventas", label: "Ventas", kind: "money", economic: true },
    { key: "tendenciaPorcentaje", label: "Tendencia", kind: "percentage", economic: true },
    { key: "margen", label: "Utilidad", kind: "money", economic: true },
    { key: "tickets", label: "Tickets", kind: "count" },
    { key: "ticketPromedio", label: "Promedio", kind: "money", economic: true },
    { key: "rollosMetraje", label: "Rollos / Metraje", kind: "text" },
    { key: "mediosPago", label: "Medios de Pago", kind: "text" },
    { key: "mejorPeorDia", label: "Mejor / Peor Día", kind: "text" },
    { key: "porcentajeFacturado", label: "Facturado %", kind: "percentage", economic: true },
    { key: "diferenciaCaja", label: "Dif. Caja", kind: "money", economic: true },
  ];
  const presentDay = (day: { fecha: string | null; ventas: string }) =>
    day.fecha == null ? null : `${day.fecha} (${day.ventas})`;
  const presentQuantities = (source: {
    rollosMetros: unknown;
    rollosKilos: unknown;
    rollosBolsas: unknown;
    metrajeMetros: unknown;
    metrajeBolsas: unknown;
  }) =>
    [
      `Rollos · metros: ${source.rollosMetros}`,
      `Rollos · kilos: ${source.rollosKilos}`,
      `Rollos · bolsas: ${source.rollosBolsas}`,
      `Metraje · metros: ${source.metrajeMetros}`,
      `Metraje · bolsas: ${source.metrajeBolsas}`,
    ].join(" · ");
  const presentPayments = (source: {
    efectivo: unknown;
    transferencia: unknown;
    credito: unknown;
  }) =>
    [
      `Efectivo: ${source.efectivo}`,
      `Transferencia: ${source.transferencia}`,
      `Crédito: ${source.credito}`,
    ].join(" · ");
  const presentDays = (source: {
    mejorDia: { fecha: string | null; ventas: string };
    peorDia: { fecha: string | null; ventas: string };
  }) =>
    [
      presentDay(source.mejorDia) == null ? null : `Mejor: ${presentDay(source.mejorDia)}`,
      presentDay(source.peorDia) == null ? null : `Peor: ${presentDay(source.peorDia)}`,
    ].filter((value): value is string => value !== null).join(" · ") || null;
  const rows = comparison.tiendas.map((store) => ({
    nombreUbicacion: store.nombreUbicacion,
    participacion: store.participacion,
    ventas: store.ventas,
    tendenciaPorcentaje: store.tendenciaPorcentaje,
    margen: store.margen,
    tickets: store.tickets,
    ticketPromedio: store.ticketPromedio,
    rollosMetraje: presentQuantities(store),
    mediosPago: presentPayments(store),
    mejorPeorDia: presentDays(store),
    porcentajeFacturado: store.porcentajeFacturado,
    diferenciaCaja: store.diferenciaCaja,
  }));
  const totals = {
    nombreUbicacion: "Total General",
    participacion: comparison.totales.participacion,
    ventas: comparison.totales.ventas,
    tendenciaPorcentaje: null,
    margen: comparison.totales.margen,
    tickets: comparison.totales.tickets,
    ticketPromedio: comparison.totales.ticketPromedio,
    rollosMetraje: presentQuantities(comparison.totales),
    mediosPago: presentPayments(comparison.totales),
    // X04 does not own a total best/worst-day value. The UI leaves this
    // grouped cell empty rather than deriving a new aggregate.
    mejorPeorDia: null,
    porcentajeFacturado: comparison.totales.porcentajeFacturado,
    diferenciaCaja: comparison.totales.diferenciaCaja,
  };
  return {
    id: "x04-comparativo-tiendas",
    title: "X04 · Tabla comparativa por tienda (TIENDA activa)",
    columns,
    rows,
    totals,
  };
}

function comparisonCharts(comparison: Awaited<ReturnType<typeof compareStores>>) {
  const trendRows = comparison.ventasPorFecha.reduce<Array<Record<string, string | number>>>(
    (rows, point) => {
      const row = rows.find((item) => item.fecha === point.fecha);
      if (row) {
        row[point.nombreUbicacion] = Number(point.ventas);
      } else {
        rows.push({
          fecha: point.fecha,
          [point.nombreUbicacion]: Number(point.ventas),
        });
      }
      return rows;
    },
    [],
  );
  const locations = comparison.tiendas.map((store) => store.nombreUbicacion);
  return [
    {
      id: "x04-comparativo-ventas-tiendas",
      title: "X04 · Ventas por Tienda (TIENDA activa)",
      type: "line",
      categoryKey: "fecha",
      series: locations.map((name) => ({ key: name, label: name, kind: "money", economic: true })),
      rows: trendRows,
    },
    {
      id: "x04-comparativo-participacion-global",
      title: "X04 · Participación Global (TIENDA activa)",
      type: "bar",
      categoryKey: "nombreUbicacion",
      series: [{ key: "ventas", label: "Ventas", kind: "money", economic: true }],
      rows: comparison.tiendas.map((store) => ({
        nombreUbicacion: store.nombreUbicacion,
        ventas: Number(store.ventas),
      })),
    },
    {
      id: "x04-comparativo-mezcla-pago",
      title: "X04 · Mezcla de Pago (TIENDA activa)",
      type: "stacked-bar",
      categoryKey: "nombreUbicacion",
      series: [
        { key: "efectivo", label: "Efectivo", kind: "money", economic: true },
        { key: "transferencia", label: "Transferencia", kind: "money", economic: true },
        { key: "credito", label: "Crédito", kind: "money", economic: true },
      ],
      rows: comparison.tiendas.map((store) => ({
        nombreUbicacion: store.nombreUbicacion,
        efectivo: Number(store.efectivo),
        transferencia: Number(store.transferencia),
        credito: Number(store.credito),
      })),
    },
  ];
}

function cashContent(
  cash: Awaited<ReturnType<typeof getDifferences>>,
  ctx: Context,
  input: ComposedReportInput,
): ReportContent & { alerts: NonNullable<ComposedReport["alerts"]> } {
  const numberKpi = (id: string, label: string, value: number | string, kind: "count" | "money" | "percentage") => ({
    id,
    label,
    value,
    kind,
    ...(kind === "money" || kind === "percentage" ? { economic: true } : {}),
  });
  const groupColumns = [
    { key: "id", label: "Id", kind: "count" },
    { key: "nombre", label: "Nombre", kind: "text" },
    { key: "cortes", label: "Cortes", kind: "count" },
    { key: "exactos", label: "Exactos", kind: "count" },
    { key: "faltantes", label: "Faltantes", kind: "count" },
    { key: "sobrantes", label: "Sobrantes", kind: "count" },
    { key: "importeFaltantes", label: "Importe faltantes", kind: "money", economic: true },
    { key: "importeSobrantes", label: "Importe sobrantes", kind: "money", economic: true },
    { key: "diferenciaNeta", label: "Diferencia neta", kind: "money", economic: true },
    { key: "diferenciaAbsoluta", label: "Diferencia absoluta", kind: "money", economic: true },
    { key: "promedio", label: "Promedio", kind: "money", economic: true },
    { key: "porcentajeExactos", label: "% exactos", kind: "percentage", economic: true },
  ];
  const requestedIds = ids(input.ubicacionIds);
  const scopedLocationId = ctx.locations?.length === 1
    ? ctx.locations[0]
    : input.ubicacionId ?? (requestedIds.length === 1 ? requestedIds[0] : undefined);
  const dateQuery = new URLSearchParams({
    desde: typeof input.desde === "string"
      ? input.desde
      : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(ctx.range.desde),
    hasta: typeof input.hasta === "string"
      ? input.hasta
      : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(ctx.range.hasta),
  });
  if (scopedLocationId != null) dateQuery.set("ubicacionId", String(scopedLocationId));
  const alerts = cash.alertas.map((alert) => ({
    ...alert,
    href: `/caja/cortes?sesionId=${alert.sesionId}&${dateQuery.toString()}`,
  }));
  const warnings = alerts.map((alert) =>
    `Alerta de diferencia de caja [${alert.tipo}] sesión ${alert.sesionId}: ${alert.mensaje} · Importe ${alert.importe}`,
  );
  const trendRows = cash.tendencia.map((row) => ({
    fecha: row.fecha,
    importe: Number(row.importe),
    diferenciaAbsoluta: Number(row.diferenciaAbsoluta),
    cortes: Number(row.cortes),
    exactos: Number(row.exactos),
    porcentajeExactos: Number(row.porcentajeExactos),
  }));
  return {
    kpis: [
      numberKpi("cortes-caja", "Cortes de caja", cash.resumen.cortes, "count"),
      numberKpi("cortes-exactos", "Cortes exactos", cash.resumen.exactos, "count"),
      numberKpi("faltantes-caja", "Impacto faltantes", cash.resumen.importeFaltantes, "money"),
      numberKpi("sobrantes-caja", "Impacto sobrantes", cash.resumen.importeSobrantes, "money"),
      numberKpi("diferencia-neta-caja", "Diferencia neta del periodo", cash.resumen.diferenciaNeta, "money"),
      numberKpi("diferencia-absoluta-caja", "Diferencia absoluta del periodo", cash.resumen.diferenciaAbsoluta, "money"),
      numberKpi("exactitud-caja", "Porcentaje de exactitud", cash.resumen.porcentajeExactos, "percentage"),
    ],
    charts: [
      {
        id: "diferencias-caja-tendencia",
        title: "Tendencia de Diferencia Neta",
        type: "line",
        categoryKey: "fecha",
        series: [
          { key: "importe", label: "Diferencia neta", kind: "money", economic: true },
          { key: "diferenciaAbsoluta", label: "Diferencia absoluta", kind: "money", economic: true },
        ],
        rows: trendRows,
      },
      {
        id: "diferencias-caja-exactitud",
        title: "Porcentaje de Exactitud",
        type: "line",
        categoryKey: "fecha",
        series: [{ key: "porcentajeExactos", label: "% exactos", kind: "percentage", economic: true }],
        rows: trendRows,
      },
    ],
    tables: [
      {
        id: "diferencias-por-cajero",
        title: "Diferencias por Cajero",
        columns: groupColumns,
        rows: cash.porCajero,
        totals: { nombre: "Total General", ...cash.resumen },
      },
      {
        id: "diferencias-por-tienda",
        title: "Diferencias por Tienda",
        columns: groupColumns,
        rows: cash.porTienda,
        totals: { nombre: "Total General", ...cash.resumen },
      },
    ],
    warnings,
    alerts,
  };
}

function rangeToAnalyticsFilters(ctx: Context, input: ComposedReportInput) {
  const requestedIds = ids(input.ubicacionIds);
  if (ctx.locations && ctx.locations.length > 1) {
    throw new ReportInputError(
      "Una fuente de caja no admite un alcance multi-sitio sin marcos explícitos.",
    );
  }
  if (requestedIds.length > 1) {
    throw new ReportInputError(
      "Una fuente de caja no admite un alcance multi-sitio sin marcos explícitos.",
    );
  }
  const ubicacionId = ctx.locations?.length === 1
    ? ctx.locations[0]
    : input.ubicacionId ?? (requestedIds.length === 1 ? requestedIds[0] : undefined);
  return parseAnalyticsFilters({
    desde: ctx.range.desde,
    hasta: ctx.range.hasta,
    ...(ubicacionId === undefined ? {} : { ubicacionId }),
  });
}

async function buildControlContent(
  ctx: Context,
  input: ComposedReportInput,
): Promise<ReportContent & { alerts: NonNullable<ComposedReport["alerts"]> }> {
  const control = await buildControlOperativoReport(ctx);
  const cashFilters = rangeToAnalyticsFilters(ctx, input);
  const cash = await getDifferences(cashFilters, {
    umbralCorte: input.umbralCorte,
    umbralTienda: input.umbralTienda,
    agrupacion: input.agrupacion,
  });
  const cashReport = cashContent(cash, ctx, input);
  const content = composeReportContent("control-operativo", [
    { section: "control-operativo", content: control },
    { section: "diferencias-caja", content: cashReport },
  ]);
  return { ...content, alerts: cashReport.alerts };
}

/**
 * Builds the additive export-only view. Existing single-source endpoint
 * builders and routes remain independent; this function only coordinates
 * their already-authorized read models.
 */
export async function buildComposedReport(
  view: ComposedReportView,
  input: ComposedReportInput,
  locations: number[] | undefined,
  economic: boolean,
  authorization: ComposedAuthorization = {
    rol: "ADMIN",
    alcanceConsulta: "TODAS",
  },
): Promise<ComposedReport> {
  const modo = input.modo ?? "normal";
  if (view === "control-operativo" && !economic) {
    throw new Error("La vista Control Operativo requiere acceso ADMIN.");
  }
  const reportInput = economic ? input : omitEconomicReportFilters(input);
  const requestedIds = strictLocationIds(reportInput.ubicacionIds);
  const requestedSingular = reportInput.ubicacionId == null
    ? undefined
    : Number(reportInput.ubicacionId);
  if (
    requestedSingular !== undefined &&
    (!Number.isInteger(requestedSingular) || requestedSingular < 1)
  ) {
    throw new ReportInputError("El sitio seleccionado no es válido.");
  }
  if (
    requestedSingular !== undefined &&
    requestedIds.length > 0 &&
    (requestedIds.length !== 1 || requestedIds[0] !== requestedSingular)
  ) {
    throw new ReportInputError(
      "ubicacionId y ubicacionIds deben identificar el mismo sitio.",
    );
  }
  if (modo !== "comparar" && requestedIds.length > 1) {
    throw new ReportInputError(
      "Una exportación normal solo admite un sitio; usa Comparar para varios sitios.",
    );
  }
  if (modo !== "comparar" && locations?.length && locations.length > 1) {
    throw new ReportInputError(
      "Una exportación normal solo admite un sitio; usa Comparar para varios sitios.",
    );
  }
  if (
    view === "ventas" &&
    modo === "comparar" &&
    (
      !economic ||
      authorization.rol !== "ADMIN" ||
      authorization.alcanceConsulta !== "TODAS" ||
      locations !== undefined ||
      requestedIds.length > 0 ||
      requestedSingular !== undefined
    )
  ) {
    throw new ReportInputError(
      "El comparativo X04 solo está disponible para ADMIN con alcance TODAS y vista global.",
    );
  }
  // Keep direct builder callers safe as well as the HTTP handler: a requested
  // site list can never fall through to an unrestricted/global context.
  const canonicalLocations = locations ??
    (requestedIds.length > 0
      ? requestedIds
      : requestedSingular === undefined ? undefined : [requestedSingular]);
  const range = reportRange(reportInput);
  const ctx: Context = { input: reportInput, locations: canonicalLocations, range };
  const sections = view === "control-operativo"
    ? []
    : view === "que-comprar"
    ? ["que-comprar", "inventario", "mapas-calor", "color", ...(economic ? ["compras"] : [])]
    : view === "clientes"
      ? ["clientes", ...(economic ? ["pagos-dirigidos"] : [])]
      : [view];

  const sources: Array<{ section: string; content: ReportContent }> = [];
  let comparisonAlerts: NonNullable<ComposedReport["alerts"]> = [];
  let comparisonSiteIds: number[] = [];
  if (modo === "comparar") {
    // Comparison frames are the same active physical locations offered by the
    // header selector.  In particular, Qué comprar may include BODEGA while
    // the legacy X04 source below retains its own active-TIENDA semantics.
    const comparisonLocations = await listHeaderEligibleLocations(locations);
    comparisonSiteIds = comparisonLocations.map((site) => site.id);
    for (const site of comparisonLocations) {
      const frameContext: Context = { ...ctx, locations: [site.id] };
      const frameContent = view === "control-operativo"
        ? await buildControlContent(frameContext, input)
        : composeReportContent(
            view,
            await Promise.all(
              sections.map(async (section) => ({
                section,
                content: await buildSource(section, frameContext, economic),
              })),
            ),
          );
      const decorated = decorateComparisonFrame(frameContent, {
        id: site.id,
        label: site.nombre,
      });
      sources.push({ section: `sitio-${site.id}`, content: decorated });
      if ("alerts" in decorated && Array.isArray(decorated.alerts)) {
        comparisonAlerts.push(...decorated.alerts);
      }
    }
  } else {
    for (const section of sections) {
      sources.push({ section, content: await buildSource(section, ctx, economic) });
    }
  }

  let content: ReportContent & { alerts?: NonNullable<ComposedReport["alerts"]> } =
    composeReportContent(view, sources);
  if (view === "ventas" && modo === "comparar" && economic) {
    // X04 is deliberately one complete global source. Its scope was checked
    // above; retain the canonical context and never clear locations as a
    // fallback, which could turn an assigned source into a global query.
    const comparison = await compareStores(rangeToAnalyticsFilters(ctx, input));
    content = {
      ...content,
      charts: [...content.charts, ...comparisonCharts(comparison)],
      tables: [...content.tables, comparisonTable(comparison)],
    };
  } else if (view === "control-operativo") {
    if (modo !== "comparar") {
      // The new control route is ADMIN-only; this is intentionally one
      // getDifferences call and not a second cash implementation.
      content = await buildControlContent(ctx, input);
    }
  }
  if (comparisonAlerts.length) content.alerts = comparisonAlerts;

  const activeFilters = Object.entries(reportInput)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`);
  if (modo === "comparar") {
    activeFilters.push(`comparisonLocations=${comparisonSiteIds.join(",")}`);
  }
  return {
    section: view,
    generatedAt: new Date().toISOString(),
    hasEconomicAccess: economic,
    range: {
      desde: range.desde.toISOString(),
      hasta: range.hasta.toISOString(),
      previousDesde: range.previousDesde.toISOString(),
      previousHasta: range.previousHasta.toISOString(),
      yearAgoDesde: range.yearAgoDesde.toISOString(),
      yearAgoHasta: range.yearAgoHasta.toISOString(),
    },
    activeFilters,
    ...content,
  };
}