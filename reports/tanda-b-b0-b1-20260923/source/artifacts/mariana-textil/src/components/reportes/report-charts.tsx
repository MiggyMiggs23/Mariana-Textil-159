import { ReporteChart } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, BarChart, Bar, ScatterChart, Scatter, Treemap } from "recharts";
import { formatNumber, NumberFormatKind } from "@workspace/number-format";
import {
  getCategoricalChartColor,
  getReportSeriesColor,
} from "@/lib/report-chart-colors";
import { getReportBlockExplanation } from "./report-explanations";

export function ReportCharts({ charts, section }: { charts: ReporteChart[]; section?: string }) {
  if (!charts || charts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="report-charts">
      {charts.map(chart => {
        let minVal = 0;
        let maxVal = 0;
        let hasHeatmapValues = false;
        if (chart.type === "heatmap" && chart.series && chart.rows) {
          let currentMin = Infinity;
          let currentMax = -Infinity;
          chart.rows.forEach((row: any) => {
            chart.series.forEach((s) => {
              const v = row[s.key];
              if (v != null) {
                const num = Number(v);
                if (!Number.isFinite(num)) return;
                if (num < currentMin) currentMin = num;
                if (num > currentMax) currentMax = num;
              }
            });
          });
          if (currentMin !== Infinity) {
            hasHeatmapValues = true;
            minVal = currentMin;
            maxVal = currentMax;
          }
        }

        return (
          <Card key={chart.id} className={(chart.type as string) === "heatmap" || (chart.type as string) === "line" || (chart.type as string) === "composed" ? "lg:col-span-2" : "border-border shadow-sm"} data-testid={`chart-card-${chart.id}`}>
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-lg font-semibold tracking-tight text-report-header">{chart.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-5 pb-5">
              {chart.type === "heatmap" ? (
                <div className="w-full overflow-x-auto custom-scrollbar touch-pan-x" data-testid={`heatmap-${chart.id}`}>
                  <div className="min-w-[600px] flex flex-col gap-1.5">
                    {/* Header Row (Column Labels) */}
                    {chart.series && (
                      <div className="flex gap-1 mb-2">
                        <div className="w-36 shrink-0" />
                        <div className="flex-1 flex gap-1">
                          {chart.series.map(s => (
                            <div key={s.key} className="flex-1 text-xs font-semibold text-report-header truncate px-1 text-center" title={s.key}>
                              {s.label || s.key}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Rows */}
                    {chart.rows.map((row: any, i: number) => (
                      <div key={i} className="flex gap-1 h-10">
                        <div className="w-36 shrink-0 flex items-center text-sm font-semibold text-report-header truncate pr-2" title={row.label || row.name || `Row ${i+1}`}>
                          {row.label || row.name || `Fila ${i+1}`}
                        </div>
                        <div className="flex-1 flex gap-1">
                          {(chart.series || []).map((s) => {
                            const k = s.key;
                            const val = row[k];
                            const parsed = val == null || val === "" ? NaN : Number(val);
                            const isNull = !Number.isFinite(parsed);
                            const num = isNull ? 0 : parsed;

                            // Normalize intensity between 0.1 and 1.0 based on actual min/max
                            let intensity = 0;
                            if (!isNull) {
                              const range = maxVal - minVal;
                              const normalized = range === 0 ? 1 : (num - minVal) / range;
                              intensity = 0.1 + (normalized * 0.9);
                            }

                            return (
                              <div
                                key={k}
                                className="flex-1 rounded-sm relative group cursor-pointer border border-transparent hover:border-report-header transition-all overflow-hidden flex items-center justify-center"
                                style={{
                                  backgroundColor: isNull
                                    ? 'transparent'
                                    : num === 0
                                      ? 'hsl(var(--report-stripe))'
                                      : `hsl(var(--report-header) / ${intensity})`
                                }}
                                title={`${s.label || s.key}: ${isNull ? 'N/D' : val}`}
                              >
                                {isNull ? (
                                  <span className="text-[10px] text-muted-foreground/50 font-medium select-none">-</span>
                                ) : (
                                  <span className={`text-xs font-mono font-bold select-none ${intensity > 0.5 ? 'text-white' : 'text-report-header'}`}>
                                    {formatNumber(num, { kind: "count" })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {/* Min-Max Legend */}
                    <div className="flex justify-end items-center gap-3 mt-4 pt-3 border-t">
                      <span className="text-xs text-muted-foreground font-medium">N/D</span>
                      <div className="w-4 h-4 rounded-sm border border-dashed border-muted-foreground/30 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground/50">-</span>
                      </div>
                      {hasHeatmapValues ? (
                        <>
                          <div className="w-px h-4 bg-border mx-1" />
                          <span className="text-xs text-muted-foreground font-medium">Menor ({formatNumber(minVal, { kind: "count" })})</span>
                          <div className="w-24 h-3 rounded bg-gradient-to-r from-[hsl(var(--report-header)/0.1)] to-[hsl(var(--report-header)/1)]" />
                          <span className="text-xs text-muted-foreground font-medium">Mayor ({formatNumber(maxVal, { kind: "count" })})</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">Sin valores disponibles</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[320px] w-full mt-2" data-testid={`rechart-${chart.id}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ChartRenderer chart={chart} />
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-3 text-sm text-muted-foreground" data-testid={`report-explanation-${chart.id}`}>
                {getReportBlockExplanation(chart.id, section)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ChartRenderer({
  chart,
  width,
  height,
}: {
  chart: ReporteChart;
  width?: number;
  height?: number;
}) {
  const xAxisKey = (chart as any).categoryKey || (chart as any).xAxisKey || "name";
  const keys = (chart.series ? chart.series.map((s: any) => s.key) : Object.keys(chart.rows[0] || {})).filter(k => k !== xAxisKey);
  const valueKindStr = String(chart.series?.[0]?.kind ?? "count");
  const valueKind = valueKindStr as NumberFormatKind;

  const axisStyle = {
    fontSize: 12,
    fill: 'hsl(var(--report-text-muted))',
    fontWeight: 500,
  };

  switch (chart.type) {
    case "line":
      return (
        <LineChart width={width} height={height} data={chart.rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} />
          <XAxis dataKey={xAxisKey} tickLine={false} axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }} tickMargin={12} tick={axisStyle} />
          <YAxis tickFormatter={v => valueKindStr === 'money' ? `$${v/1000}k` : v} tickLine={false} axisLine={false} width={60} tick={axisStyle} />
          <RechartsTooltip
            formatter={(value: number) => formatNumber(value, { kind: valueKind, percentageInput: valueKindStr === 'percentage' ? 'percent' : undefined })}
            contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--report-header))', marginBottom: '4px' }}
          />
          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px', fontWeight: 500 }} iconType="circle" />
          {keys.map((key, i) => (
            <Line
              key={key}
              name={key}
              type="monotone"
              dataKey={key}
              stroke={getReportSeriesColor(key, i)}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      );
    case "bar":
    case "stacked-bar":
      return (
        <BarChart width={width} height={height} data={chart.rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} />
          <XAxis dataKey={xAxisKey} tickLine={false} axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }} tickMargin={12} tick={axisStyle} />
          <YAxis tickFormatter={v => valueKindStr === 'money' ? `$${v/1000}k` : v} tickLine={false} axisLine={false} width={60} tick={axisStyle} />
          <RechartsTooltip
            formatter={(value: number) => formatNumber(value, { kind: valueKind, percentageInput: valueKindStr === 'percentage' ? 'percent' : undefined })}
            contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--report-header))', marginBottom: '4px' }}
            cursor={{ fill: 'hsl(var(--report-stripe))', opacity: 0.6 }}
          />
          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px', fontWeight: 500 }} iconType="circle" />
          {keys.map((key, i) => (
            <Bar
              key={key}
              name={key}
              dataKey={key}
              fill={getReportSeriesColor(key, i)}
              radius={chart.type === "stacked-bar" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              stackId={chart.type === "stacked-bar" ? "a" : undefined}
            />
          ))}
        </BarChart>
      );
    case "scatter":
      return (
        <ScatterChart width={width} height={height} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} />
          <XAxis dataKey={xAxisKey} type="category" allowDuplicatedCategory={false} tickLine={false} axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }} tickMargin={12} tick={axisStyle} />
          <YAxis dataKey={keys[0] || "value"} tickFormatter={v => valueKindStr === 'money' ? `$${v/1000}k` : v} tickLine={false} axisLine={false} width={60} tick={axisStyle} />
          <RechartsTooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--report-text-muted))' }}
            contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px', fontWeight: 500 }} iconType="circle" />
          {keys.map((key, i) => (
            <Scatter key={key} name={key} data={chart.rows} fill={getReportSeriesColor(key, i)} />
          ))}
        </ScatterChart>
      );
    case "treemap":
      return (
        <Treemap
          width={width}
          height={height}
          data={chart.rows.map((row, index) => ({
            ...row,
            name: `${String(row[xAxisKey] ?? row.name ?? "Elemento")} · ${index + 1}`,
          }))}
          dataKey={keys[0] || "value"}
          aspectRatio={4 / 3}
          stroke="var(--background)"
          fill={getCategoricalChartColor(0)}
        >
          <RechartsTooltip
            contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
        </Treemap>
      );
    default:
      return null;
  }
}
