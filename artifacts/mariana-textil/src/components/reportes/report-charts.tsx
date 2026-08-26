import { ReporteChart } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, BarChart, Bar, ScatterChart, Scatter, Treemap } from "recharts";
import { formatNumber, NumberFormatKind } from "@workspace/number-format";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ReportCharts({ charts }: { charts: ReporteChart[] }) {
  if (!charts || charts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="report-charts">
      {charts.map(chart => (
        <Card key={chart.id} className={(chart.type as string) === "heatmap" || (chart.type as string) === "line" || (chart.type as string) === "composed" ? "lg:col-span-2" : ""} data-testid={`chart-card-${chart.id}`}>
          <CardHeader>
            <CardTitle>{chart.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {chart.type === "heatmap" ? (
              <div className="w-full overflow-x-auto custom-scrollbar touch-pan-x" data-testid={`heatmap-${chart.id}`}>
                {/* Minimal Heatmap renderer assuming data is a matrix or array of row objects with column keys */}
                <div className="min-w-[600px] flex flex-col gap-1">
                  {chart.rows.map((row: any, i: number) => (
                    <div key={i} className="flex gap-1 h-10">
                      <div className="w-32 flex items-center text-xs font-medium text-muted-foreground truncate" title={row.label}>
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
                              className="flex-1 rounded-sm relative group cursor-pointer"
                              style={{ backgroundColor: val ? `hsl(var(--primary) / ${opacity})` : 'hsl(var(--muted))' }}
                              title={`${k}: ${val || 0}`}
                            >
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/80 text-white text-[10px] rounded-sm transition-opacity font-mono">
                                {val ? formatNumber(val, { kind: "count" }) : "0"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {chart.series && (
                    <div className="flex gap-1 mt-1">
                      <div className="w-32" />
                      <div className="flex-1 flex gap-1">
                        {chart.series.map(s => (
                          <div key={s.key} className="flex-1 text-[10px] text-center text-muted-foreground truncate" title={s.key}>
                            {s.key}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[300px] w-full" data-testid={`rechart-${chart.id}`}>
                {(chart.type as string) !== "heatmap" && (
                  <ResponsiveContainer width="100%" height="100%">
                    {renderRechart(chart) || <div />}
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function renderRechart(chart: ReporteChart) {
  const xAxisKey = chart.categoryKey || "name";
  const keys = chart.series ? chart.series.map(s => s.key) : Object.keys(chart.rows[0] || {}).filter(k => k !== xAxisKey);
  const valueKindStr = String("count");
  const valueKind = valueKindStr as NumberFormatKind;

  switch (chart.type) {
    case "line":
      return (
        <LineChart data={chart.rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
          <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => valueKindStr === 'money' ? `$${v/1000}k` : v} tickLine={false} axisLine={false} width={50} tick={{ fontSize: 11 }} />
          <RechartsTooltip 
            formatter={(value: number) => formatNumber(value, { kind: valueKind, percentageInput: valueKindStr === 'percentage' ? 'percent' : undefined })} 
            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          {keys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      );
    case "bar":
    case "stacked-bar":
      return (
        <BarChart data={chart.rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
          <XAxis dataKey={xAxisKey} tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => valueKindStr === 'money' ? `$${v/1000}k` : v} tickLine={false} axisLine={false} width={50} tick={{ fontSize: 11 }} />
          <RechartsTooltip 
            formatter={(value: number) => formatNumber(value, { kind: valueKind, percentageInput: valueKindStr === 'percentage' ? 'percent' : undefined })} 
            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          {keys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              stackId={chart.type === "stacked-bar" ? "a" : undefined}
            />
          ))}
        </BarChart>
      );
    case "scatter":
      return (
        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
          <XAxis dataKey={xAxisKey} type="category" allowDuplicatedCategory={false} tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
          <YAxis dataKey={keys[0] || "value"} tickFormatter={v => valueKindStr === 'money' ? `$${v/1000}k` : v} tickLine={false} axisLine={false} width={50} tick={{ fontSize: 11 }} />
          <RechartsTooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          {keys.map((key, i) => (
            <Scatter key={key} name={key} data={chart.rows} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
          stroke="#fff"
          fill={CHART_COLORS[0]}
        >
          <RechartsTooltip />
        </Treemap>
      );
    default:
      return null;
  }
}
