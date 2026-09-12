import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronRight,
  FileSearch,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportKpis } from "@/components/reportes/report-kpis";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getQueComprarEvidence,
  getQueComprarReport,
  type QueComprarEvidence,
  type QueComprarParams,
  type QueComprarReport as QueComprarReportPayload,
} from "@/lib/stock-minimos-api";

type QueComprarReportProps = {
  params: QueComprarParams;
  dateRangeValid: boolean;
  ubicacionId?: number | null;
};

type EvidenceTarget = {
  productoId: number;
  ubicacionId: number;
  nombre: string;
  evidenceUrl?: string;
};

const MONTH_FIELD_NAMES = [
  "consumoMeses",
  "consumoMensual",
  "consumoPorMes",
  "meses",
];
const CUSTOMER_SALES_FIELD_NAMES = [
  "ventaClienteMeses",
  "ventasClienteMeses",
  "ventaRealClienteMeses",
  "ventasRealesMeses",
];

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No se pudo cargar la información. Intenta de nuevo.";
}

function firstValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown, empty = "—"): string {
  if (value === null || value === undefined || value === "") return empty;
  if (Array.isArray(value)) return value.map((item) => textValue(item, "")).filter(Boolean).join(" · ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeMonthSeries(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Record<string, unknown>;
        const label = entry.mes ?? entry.month ?? entry.label ?? entry.periodo;
        const amount = entry.cantidad ?? entry.value ?? entry.total ?? entry.venta;
        return label == null ? [] : [[String(label), amount]];
      }),
    );
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function rowMonthSeries(
  row: Record<string, unknown>,
  fields = MONTH_FIELD_NAMES,
) {
  return normalizeMonthSeries(firstValue(row, fields));
}

function payloadRows(payload: QueComprarReportPayload | undefined) {
  if (!payload) return [];
  const rows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.productos)
      ? payload.productos
      : payload.tables?.find((table) => table.id === "que-comprar")?.rows ??
        payload.tables?.[0]?.rows ??
        [];
  return rows.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object"),
  );
}

function payloadConsumptionColumns(payload: QueComprarReportPayload | undefined) {
  const table =
    payload?.tables?.find((item) => item.id === "que-comprar") ??
    payload?.tables?.[0];
  return (table?.columns ?? [])
    .filter((column) => column.key.startsWith("consumoMes"))
    .map((column) => ({ key: column.key, label: column.label ?? column.key }));
}

function payloadMonths(
  payload: QueComprarReportPayload | undefined,
  rows: Array<Record<string, unknown>>,
) {
  const explicit = payload?.months ?? payload?.meses;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map((month) =>
      typeof month === "object" && month !== null
        ? textValue((month as Record<string, unknown>).label ?? (month as Record<string, unknown>).mes)
        : String(month),
    );
  }
  const seen = new Set<string>();
  rows.forEach((row) => {
    Object.keys(rowMonthSeries(row)).forEach((month) => seen.add(month));
  });
  return Array.from(seen);
}

function rowProductId(row: Record<string, unknown>) {
  return numberValue(row.productoId);
}

function rowLocationId(row: Record<string, unknown>, fallback?: number | null) {
  return numberValue(row.ubicacionId ?? fallback);
}

function rowLabel(row: Record<string, unknown>) {
  const tela = textValue(row.tela, "");
  const color = textValue(row.color, "");
  return [tela, color].filter(Boolean).join(" / ") || "Producto";
}

function rowSuggestion(row: Record<string, unknown>) {
  // The report API has one canonical observation field. Do not silently
  // interpret stale aliases as a suggestion: that hides a contract mismatch.
  const value = row.sugerencia;
  if (value === undefined || value === null || value === "") return null;
  return textValue(value);
}

function renderNumeric(value: unknown, kind: "quantity" | "days" | "count" = "quantity") {
  const parsed = numberValue(value);
  const formatKind = kind === "days" ? "quantity" : kind;
  return parsed === null ? "—" : formatNumber(parsed, { kind: formatKind });
}

function renderEvidenceValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "object") return String(value);
  return JSON.stringify(value, null, 2);
}

function episodeCauseLabel(value: unknown) {
  if (value === "MOVIMIENTO") return "Movimiento: cruce observado";
  if (value === "CONFIGURACION") return "Configuración: brecha expuesta";
  return "Snapshot: no infiere cruce histórico";
}

function episodePeriodLabel(carriedIntoPeriod: unknown) {
  return carriedIntoPeriod === true
    ? "Anterior al periodo (contexto)"
    : "Apertura en el periodo (contabilizada)";
}

function EpisodeTable({
  episodes,
  title,
  emptyMessage,
  ariaLabel,
}: {
  episodes: Array<Record<string, unknown>>;
  title: string;
  emptyMessage: string;
  ariaLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {episodes.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div
            className="overflow-x-auto overscroll-x-contain"
            role="region"
            tabIndex={0}
            aria-label={ariaLabel}
          >
            <Table className="min-w-[780px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Abierto</TableHead>
                  <TableHead>Cerrado</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Existencia</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Proveniencia de apertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {episodes.map((episode, index) => (
                  <TableRow key={String(episode.id ?? index)}>
                    <TableCell>{textValue(episode.openedAt)}</TableCell>
                    <TableCell>{textValue(episode.closedAt)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {renderNumeric(episode.minimum)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {renderNumeric(episode.existence)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {renderNumeric(episode.difference)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div>{episodeCauseLabel(episode.causa)}</div>
                      <div className="text-xs text-muted-foreground">
                        Movimiento snapshot: {textValue(episode.movementId)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EpisodeEventsCard({
  episodeEvents,
}: {
  episodeEvents: Array<Record<string, unknown>>;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">
          Eventos de episodios ({episodeEvents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {episodeEvents.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            No se recibieron eventos de episodios para este detalle.
          </p>
        ) : (
          <div
            className="overflow-x-auto overscroll-x-contain"
            role="region"
            tabIndex={0}
            aria-label="Eventos de episodios; desplázate horizontalmente para ver el detalle"
          >
            <Table className="min-w-[940px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Abierto</TableHead>
                  <TableHead>Cerrado</TableHead>
                  <TableHead>Causa</TableHead>
                  <TableHead>Episodio</TableHead>
                  <TableHead>Movimiento asociado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {episodeEvents.map((event, index) => {
                  const carriedIntoPeriod = event.carriedIntoPeriod === true;
                  return (
                    <TableRow key={String(event.episodeId ?? index)}>
                      <TableCell>
                        <Badge variant={carriedIntoPeriod ? "secondary" : "outline"}>
                          {episodePeriodLabel(event.carriedIntoPeriod)}
                        </Badge>
                      </TableCell>
                      <TableCell>{textValue(event.openedAt)}</TableCell>
                      <TableCell>{textValue(event.closedAt)}</TableCell>
                      <TableCell>{episodeCauseLabel(event.causa)}</TableCell>
                      <TableCell className="font-mono">
                        {textValue(event.episodeId)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {textValue(event.movementId)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function QueComprarReport({
  params,
  dateRangeValid,
  ubicacionId,
}: QueComprarReportProps) {
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceTarget | null>(null);
  // The operational site comes from the global header. Reuse the report
  // query's existing ubicacionIds parameter rather than introducing a second
  // site picker or an unsupported ubicacionId query parameter.
  const reportParams = useMemo<QueComprarParams>(
    () =>
      ubicacionId == null
        ? params
        : { ...params, ubicacionIds: [ubicacionId] },
    [params, ubicacionId],
  );
  const reportQuery = useQuery({
    queryKey: ["reportes", "que-comprar", reportParams],
    queryFn: () => getQueComprarReport(reportParams),
    enabled: dateRangeValid,
    retry: false,
  });

  const evidenceQuery = useQuery({
    queryKey: [
      "reportes",
      "que-comprar",
      "evidencia",
      evidenceTarget?.productoId,
      evidenceTarget?.ubicacionId,
      reportParams,
      evidenceTarget?.evidenceUrl,
    ],
    queryFn: () =>
      getQueComprarEvidence({
        productoId: evidenceTarget!.productoId,
        ubicacionId: evidenceTarget!.ubicacionId,
        params: reportParams,
        evidenceUrl: evidenceTarget?.evidenceUrl,
      }),
    enabled: evidenceTarget !== null,
    retry: false,
  });

  const rows = useMemo(() => payloadRows(reportQuery.data), [reportQuery.data]);
  const months = useMemo(
    () => payloadMonths(reportQuery.data, rows),
    [reportQuery.data, rows],
  );
  const consumptionColumns = useMemo(
    () => payloadConsumptionColumns(reportQuery.data),
    [reportQuery.data],
  );

  const heatmap = useMemo<{ months: string[]; rows: Array<Record<string, unknown>> } | null>(() => {
    const source = reportQuery.data?.heatmap;
    if (source && typeof source === "object") {
      const sourceRecord = source as Record<string, unknown>;
      const sourceRows: Array<Record<string, unknown>> = Array.isArray(sourceRecord.rows)
        ? sourceRecord.rows.filter(
          (row): row is Record<string, unknown> =>
            Boolean(row && typeof row === "object"),
        )
        : [];
      const sourceMonths = Array.isArray(sourceRecord.months)
        ? sourceRecord.months.map(String)
        : months;
      if (sourceRows.length > 0 && sourceMonths.length > 0) {
        return {
          months: sourceMonths,
          rows: sourceRows,
        };
      }
    }

    const chart = reportQuery.data?.charts?.find((item) => item.type === "heatmap");
    if (chart?.rows?.length && chart.series?.length) {
      const chartMonths = chart.series.map((series) => series.label ?? series.key);
      return {
        months: chartMonths,
        rows: chart.rows.map((sourceRow) => ({
          label: sourceRow.label ?? sourceRow.name,
          ...Object.fromEntries(
            chart.series!.map((series) => [
              series.label ?? series.key,
              sourceRow[series.key],
            ]),
          ),
        })),
      };
    }

    // If the backend embeds monthly real-customer sales on each row, use those
    // values directly. Do not manufacture cells for rows without sales data.
    const derived = rows
      .map((row) => {
        const values = rowMonthSeries(row, CUSTOMER_SALES_FIELD_NAMES);
        return Object.keys(values).length === 0
          ? null
          : { label: rowLabel(row), values };
      })
      .filter((row): row is { label: string; values: Record<string, unknown> } => row !== null);
    if (derived.length === 0) return null;
    const derivedMonths = Array.from(
      new Set(derived.flatMap((row) => Object.keys(row.values))),
    );
    return {
      months: derivedMonths,
      rows: derived.map((row) => ({ label: row.label, ...row.values })),
    };
  }, [reportQuery.data, rows, months]);

  const openEvidence = (row: Record<string, unknown>) => {
    const productoId = rowProductId(row);
    const rowUbicacionId = rowLocationId(row, ubicacionId);
    if (productoId === null || rowUbicacionId === null) return;
    const evidenceUrl = row.evidenceUrl;
    setEvidenceTarget({
      productoId,
      ubicacionId: rowUbicacionId,
      nombre: rowLabel(row),
      evidenceUrl: typeof evidenceUrl === "string" ? evidenceUrl : undefined,
    });
  };

  return (
    <div className="space-y-6" data-testid="report-content-que-comprar">
      <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Cómo leer consumo y venta</AlertTitle>
        <AlertDescription>
          El consumo por sitio es ventas más salidas, incluyendo traslados, y
          no se suma entre sitios. La columna <strong>Venta real al cliente</strong>
          solo considera ventas a clientes y es la cifra que orienta compras.
        </AlertDescription>
      </Alert>

      {!dateRangeValid ? (
        <Alert data-testid="que-comprar-date-warning">
          <Info className="h-4 w-4" />
          <AlertTitle>Selecciona un rango válido</AlertTitle>
          <AlertDescription>
            Selecciona un rango entre 1900 y 2999, de hasta 100 años, para
            generar el reporte.
          </AlertDescription>
        </Alert>
      ) : reportQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-14 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Analizando ventas y movimientos…
          </CardContent>
        </Card>
      ) : reportQuery.isError ? (
        <Alert variant="destructive" data-testid="que-comprar-error">
          <XCircle className="h-4 w-4" />
          <AlertTitle>No se pudo cargar “Qué comprar”</AlertTitle>
          <AlertDescription>{errorMessage(reportQuery.error)}</AlertDescription>
        </Alert>
      ) : (
        <>
          {(reportQuery.data?.warnings ?? []).map((warning, index) => {
            const warningText =
              typeof warning === "string" ? warning : warning.message;
            const warningSeverity =
              typeof warning === "string" ? "info" : warning.severity;
            return (
              <Alert
                key={(typeof warning === "string" ? warning : warning.id) ?? index}
                variant={warningSeverity === "error" ? "destructive" : "default"}
              >
                <Info className="h-4 w-4" />
                <AlertDescription>{warningText}</AlertDescription>
              </Alert>
            );
          })}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Qué comprar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Un renglón por producto y sitio. Las sugerencias solo aparecen
                cuando el backend cuenta con la historia requerida para ese
                renglón; el resto de las mediciones no se oculta.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div
                className="w-full overflow-x-auto overscroll-x-contain"
                role="region"
                tabIndex={0}
                aria-label="Renglones de qué comprar; desplázate horizontalmente para ver todas las columnas"
              >
                <Table className="min-w-[1250px]">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Producto / sitio</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Unidad</TableHead>
                      {consumptionColumns.map((column) => (
                        <TableHead key={column.key} className="text-right">
                          {column.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Existencia</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Días de cobertura</TableHead>
                      <TableHead className="text-right">Déficit contra mínimo</TableHead>
                      <TableHead className="text-right">Venta real al cliente</TableHead>
                      <TableHead className="text-right">Meses de historia</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="min-w-[280px]">Sugerencia</TableHead>
                      <TableHead className="w-32">Evidencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => {
                      const suggestion = rowSuggestion(row);
                      const productId = rowProductId(row);
                      const rowSiteId = rowLocationId(row, ubicacionId);
                      const evidenceUrl = row.evidenceUrl;
                      const notMoved = row.noMovimiento === true;
                      const underMinimum = row.bajoMinimo === true;
                      return (
                        <TableRow key={String(row.id ?? `${productId ?? "row"}-${index}`)}>
                          <TableCell>
                            <div className="font-medium">{rowLabel(row)}</div>
                            {textValue(row.sitio, "") && (
                              <div className="text-xs text-muted-foreground">
                                {textValue(row.sitio)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {textValue(row.sku)}
                          </TableCell>
                          <TableCell>
                            {formatUnit(textValue(row.unidad, ""))}
                          </TableCell>
                          {consumptionColumns.map((column) => (
                            <TableCell key={column.key} className="text-right font-mono">
                              {renderNumeric(row[column.key])}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono">
                            {renderNumeric(row.existenciaActual)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {renderNumeric(row.minimoCapturado)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {renderNumeric(row.coberturaDiasMinimo, "days")}
                          </TableCell>
                           <TableCell className="text-right font-mono">
                             {renderNumeric(row.deficitMinimoObservado)}
                           </TableCell>
                          <TableCell className="text-right font-mono">
                            {renderNumeric(row.ventaRealCliente)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {renderNumeric(row.mesesHistoria, "count")}
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-[180px] flex-wrap gap-1">
                              {notMoved && <Badge variant="outline">Sin movimiento</Badge>}
                              {underMinimum && <Badge variant="destructive">Bajo mínimo</Badge>}
                              {!notMoved && !underMinimum && <span className="text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {suggestion ? (
                                <span className={suggestion.startsWith("Sin información suficiente") ? "text-muted-foreground" : ""}>
                                {suggestion}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {suggestion ? (
                              <Button
                                 type="button"
                                size="sm"
                                variant="outline"
                                disabled={productId === null || rowSiteId === null}
                                onClick={() => openEvidence(row)}
                                data-testid={`que-comprar-evidence-${productId ?? index}`}
                                 aria-label={`Ver evidencia de ${rowLabel(row)}`}
                                title={
                                  evidenceUrl
                                    ? "Abrir movimientos que sustentan la sugerencia"
                                    : "Abrir evidencia de la sugerencia"
                                }
                              >
                                <FileSearch className="mr-1.5 h-4 w-4" />
                                Ver evidencia
                                <ChevronRight className="ml-1 h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">No aplica</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12 + consumptionColumns.length} className="h-28 text-center text-muted-foreground">
                          No hay renglones para este rango.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {reportQuery.data?.kpis && reportQuery.data.kpis.length > 0 && (
            <ReportKpis
              kpis={reportQuery.data.kpis as any}
              hasEconomicAccess={reportQuery.data.hasEconomicAccess ?? false}
            />
          )}

          {heatmap && (
            <Card data-testid="que-comprar-heatmap">
              <CardHeader>
                <CardTitle className="text-lg">Venta real al cliente por mes y color</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Mapa de calor de ventas reales a clientes; no mezcla salidas ni
                  traslados con la venta.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[680px] space-y-1.5">
                    <div className="flex gap-1">
                      <div className="w-52 shrink-0" />
                      {heatmap.months.map((month) => (
                        <div
                          key={month}
                          className="min-w-20 flex-1 truncate px-1 text-center text-xs font-semibold text-muted-foreground"
                        >
                          {month}
                        </div>
                      ))}
                    </div>
                    {heatmap.rows.map((row, index) => (
                      <div key={String(row.id ?? `${row.label ?? row.name}-${index}`)} className="flex h-10 gap-1">
                        <div className="flex w-52 shrink-0 items-center truncate pr-2 text-sm font-medium" title={textValue(row.label ?? row.name)}>
                          {textValue(row.label ?? row.name)}
                        </div>
                        {heatmap.months.map((month) => {
                          const value = numberValue(row[month]);
                          const intensity = value === null ? 0 : Math.min(1, Math.max(0.12, value / Math.max(
                            1,
                            ...heatmap.rows.map((item) => numberValue(item[month]) ?? 0),
                          )));
                          return (
                            <div
                              key={month}
                              className="min-w-20 flex-1 rounded-sm border border-border/40 text-center text-xs font-mono font-semibold"
                              style={{
                                backgroundColor: value === null
                                  ? "transparent"
                                  : `hsl(var(--report-header) / ${intensity})`,
                                color: intensity > 0.5 ? "white" : undefined,
                              }}
                              title={`${month}: ${value === null ? "Sin información" : value}`}
                            >
                              <span className="leading-10">
                                {value === null ? "—" : formatNumber(value, { kind: "quantity" })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog
        open={evidenceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEvidenceTarget(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-h-[90dvh] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Evidencia de la sugerencia</DialogTitle>
            <DialogDescription>
              {evidenceTarget?.nombre ?? "Producto"} · movimientos y eventos
              reales que alimentan la cifra.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {evidenceQuery.isLoading ? (
              <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando evidencia…
              </div>
            ) : evidenceQuery.isError ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>No se pudo cargar la evidencia</AlertTitle>
                <AlertDescription>{errorMessage(evidenceQuery.error)}</AlertDescription>
              </Alert>
            ) : evidenceQuery.data ? (
              <EvidenceContents evidence={evidenceQuery.data} />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                La respuesta no contiene evidencia.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EvidenceContents({ evidence }: { evidence: QueComprarEvidence }) {
  const movementKeys = ["movimientos", "movements", "entradas", "salidas", "ventas"];
  const movementEntries = movementKeys.flatMap((key) => {
    const value = evidence[key];
    return Array.isArray(value)
      ? value.map((entry) => ({ group: key, entry }))
      : [];
  });
  const eventEntries = Array.isArray(evidence.eventos) ? evidence.eventos : [];
  const episodeEvents = Array.isArray(evidence.episodeEvents)
    ? evidence.episodeEvents
    : [];
  const equation = evidence.ecuacion ?? evidence.inputs;
  const episodes = Array.isArray(evidence.episodes) ? evidence.episodes : [];
  const carriedEpisodes = Array.isArray(evidence.carriedEpisodes)
    ? evidence.carriedEpisodes
    : [];
  const reconciliation: Record<string, unknown> | null =
    evidence.reconciliation && typeof evidence.reconciliation === "object"
      ? evidence.reconciliation as Record<string, unknown>
      : null;
  return (
    <div className="space-y-5">
      {equation ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Entradas de la ecuación</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {renderEvidenceValue(equation)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
      {reconciliation && (
        <Alert
          className={
            reconciliation.matches === false
              ? "border-destructive/40 bg-destructive/5"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
          }
        >
          <Info className="h-4 w-4" />
          <AlertTitle>
            {reconciliation.matches === false
              ? "La evidencia no cuadra"
              : "Conciliación de movimientos"}
          </AlertTitle>
          <AlertDescription>
            Consumo calculado:{" "}
            {renderEvidenceValue(reconciliation.consumptionQuantity)} ·
            movimientos incluidos:{" "}
            {renderEvidenceValue(reconciliation.movementQuantity)} ·
            diferencia: {renderEvidenceValue(reconciliation.difference)}
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            Movimientos ({movementEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movementEntries.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              No se recibieron movimientos para este detalle.
            </p>
          ) : (
            <div
              className="overflow-x-auto overscroll-x-contain"
              role="region"
              tabIndex={0}
              aria-label="Movimientos de evidencia; desplázate horizontalmente para ver el detalle"
            >
              <Table className="min-w-[650px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementEntries.map(({ group, entry }, index) => (
                    <TableRow key={`${group}-${index}`}>
                      <TableCell className="font-medium">{group}</TableCell>
                      <TableCell>
                        <pre className="whitespace-pre-wrap text-xs">
                          {renderEvidenceValue(entry)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <EpisodeTable
        episodes={episodes}
        title={`Episodios bajo mínimo en el periodo (${episodes.length})`}
        emptyMessage="No hay episodios bajo mínimo en el periodo."
        ariaLabel="Episodios bajo mínimo del periodo; desplázate horizontalmente para ver el detalle"
      />
      <EpisodeTable
        episodes={carriedEpisodes}
        title={`Episodios anteriores al periodo (no incluidos en conteo) (${carriedEpisodes.length})`}
        emptyMessage="No hay episodios abiertos antes del periodo seleccionado."
        ariaLabel="Episodios anteriores al periodo; desplázate horizontalmente para ver el detalle"
      />
      <EpisodeEventsCard episodeEvents={episodeEvents} />
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            Eventos de entrada ({eventEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se recibieron eventos de entrada para este detalle.
            </p>
          ) : (
            <div className="space-y-2">
              {eventEntries.map((entry, index) => (
                <pre key={index} className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {renderEvidenceValue(entry)}
                </pre>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default QueComprarReport;