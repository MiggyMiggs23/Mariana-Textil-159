import { ReporteChart } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, BarChart, Bar, ScatterChart, Scatter, Treemap } from "recharts";
import { formatNumber, NumberFormatKind } from "@workspace/number-format";

// We'll use the CSS variables we defined
const CHART_COLORS = [
  "hsl(var(--report-header))",
  "hsl(var(--report-modality-metraje))", // Warm accent
  "hsl(var(--report-abc-b))", // Medium blue
  "hsl(var(--report-positive))", // Green
  "hsl(var(--report-abc-c))", // Light blue
  "hsl(var(--report-modality-rollos))",
  "hsl(var(--report-negative))", // Red
];

// Special colors for known series keys
const getSeriesColor = (key: string, index: number) => {
  const k = key.toUpperCase();
  if (k.includes('ROLLOS')) return "hsl(var(--report-modality-rollos))";
  if (k.includes('METRAJE') || k.includes('METROS')) return "hsl(var(--report-modality-metraje))";
  if (k.includes('UTILIDAD') && !k.includes('MARGEN')) return "hsl(var(--report-positive))";
  return CHART_COLORS[index % CHART_COLORS.length];
};

export function ReportCharts({ charts }: { charts: ReporteChart[] }) {
  if (!charts || charts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="report-charts">
      {charts.map(chart => (
        <Card key={chart.id} className={(chart.type as string) === "heatmap" || (chart.type as string) === "line" || (chart.type as string) === "composed" ? "lg:col-span-2" : "border-border shadow-sm"} data-testid={`chart-card-${chart.id}`}>
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-report-header">{chart.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-5 pb-5">
            {chart.type === "heatmap" ? (
              <div className="w-full overflow-x-auto custom-scrollbar touch-pan-x" data-testid={`heatmap-${chart.id}`}>
                <div className="min-w-[600px] flex flex-col gap-1.5">
                  {chart.rows.map((row: any, i: number) => (
                    <div key={i} className="flex gap-1 h-12">
                      <div className="w-36 flex items-center text-sm font-medium text-report-text-muted truncate pr-2" title={row.label}>
                        {row.label}
                      </div>
                      <div className="flex-1 flex gap-1">
                        {(chart.series || []).map((s) => {
                          const k = s.key;
                          const val = row[k];
                          const max = 100;
                          const opacity = val ? Math.min(1, Math.max(0.1, Number(val) / max)) : 0.05;
                          return (
                            <div
                              key={k}
                              className="flex-1 rounded-sm relative group cursor-pointer border border-transparent hover:border-report-header transition-colors"
                              style={{ backgroundColor: val ? `hsl(var(--report-header) / ${opacity})` : 'hsl(var(--report-stripe))' }}
                              title={`${k}: ${val || 0}`}
                            >
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-report-header text-report-header-foreground text-xs rounded-sm transition-opacity font-mono font-bold shadow-md">
                                {val ? formatNumber(val, { kind: "count" }) : "0"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {chart.series && (
                    <div className="flex gap-1 mt-2">
                      <div className="w-36" />
                      <div className="flex-1 flex gap-1">
                        {chart.series.map(s => (
                          <div key={s.key} className="flex-1 text-[11px] text-center font-medium text-report-text-muted truncate px-1" title={s.key}>
                            {s.key}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[320px] w-full mt-2" data-testid={`rechart-${chart.id}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <ChartRenderer chart={chart} />
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartRenderer({ chart }: { chart: ReporteChart }) {
  const xAxisKey = (chart as any).xAxisKey || "name";
  const keys = (chart.series ? chart.series.map((s: any) => s.key) : Object.keys(chart.rows[0] || {})).filter(k => k !== xAxisKey);
  const valueKindStr = String("count");
  const valueKind = valueKindStr as NumberFormatKind;

  const axisStyle = {
    fontSize: 12,
    fill: 'hsl(var(--report-text-muted))',
    fontWeight: 500,
  };

  switch (chart.type) {
    case "line":
      return (
        <LineChart data={chart.rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
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
              stroke={getSeriesColor(key, i)}
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
        <BarChart data={chart.rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
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
              fill={getSeriesColor(key, i)}
              radius={chart.type === "stacked-bar" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              stackId={chart.type === "stacked-bar" ? "a" : undefined}
            />
          ))}
        </BarChart>
      );
    case "scatter":
      return (
        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} />
          <XAxis dataKey={xAxisKey} type="category" allowDuplicatedCategory={false} tickLine={false} axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }} tickMargin={12} tick={axisStyle} />
          <YAxis dataKey={keys[0] || "value"} tickFormatter={v => valueKindStr === 'money' ? `$${v/1000}k` : v} tickLine={false} axisLine={false} width={60} tick={axisStyle} />
          <RechartsTooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--report-text-muted))' }}
            contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px', fontWeight: 500 }} iconType="circle" />
          {keys.map((key, i) => (
            <Scatter key={key} name={key} data={chart.rows} fill={getSeriesColor(key, i)} />
          ))}
        </ScatterChart>
      );
    case "treemap":
      return (
        <Treemap
          data={chart.rows.map((row, index) => ({
            ...row,
            name: `${String(row[xAxisKey] ?? row.name ?? "Elemento")} · ${index + 1}`,
          }))}
          dataKey={keys[0] || "value"}
          aspectRatio={4 / 3}
          stroke="var(--background)"
          fill="hsl(var(--report-header))"
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
