import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetAdminComparacionTiendas,
  GetAdminComparacionTiendasPeriodo
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, BarChart, Bar } from "recharts";
import { BarChart3, RefreshCw, Loader2, AlertCircle, ArrowUpDown, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { format, subDays, startOfWeek, startOfMonth, startOfQuarter, startOfYear, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getCategoricalChartColor,
  REPORT_CATEGORICAL_COLORS,
} from "@/lib/report-chart-colors";

type SortKey = "nombreUbicacion" | "participacion" | "ventas" | "margen" | "tickets" | "ticketPromedio" | "metros" | "efectivo" | "transferencia" | "credito" | "diferenciaCaja" | "porcentajeFacturado";

export default function CajaComparativo({ embedded = false }: { embedded?: boolean }) {
  const [periodo, setPeriodo] = useState<GetAdminComparacionTiendasPeriodo>("mensual");
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(new Date(), "yyyy-MM-dd"));

  const [sortKey, setSortKey] = useState<SortKey>("ventas");
  const [sortAsc, setSortAsc] = useState(false);

  // If not 'personalizado', we don't send dates to API
  const isCustom = periodo as string === "personalizado";

  const { data, isLoading, isError, error, refetch } = useGetAdminComparacionTiendas(
    isCustom
      ? { periodo: "personalizado", desde, hasta }
      : { periodo }
  );

  const applyPreset = (val: string) => {
    if (val === "personalizado") {
      setPeriodo(val as GetAdminComparacionTiendasPeriodo);
      return;
    }
    setPeriodo(val as GetAdminComparacionTiendasPeriodo);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortableHead = ({ label, sortName, align = "left" }: { label: string, sortName: SortKey, align?: "left" | "right" }) => (
    <TableHead className={`${align === "right" ? "text-right" : ""} cursor-pointer hover:bg-muted/60 select-none`} onClick={() => handleSort(sortName)}>
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label} <ArrowUpDown className="w-3 h-3 opacity-50" />
      </div>
    </TableHead>
  );

  const sortedTiendas = useMemo(() => {
    if (!data?.tiendas) return [];
    return [...data.tiendas].sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a];
      const bVal = b[sortKey as keyof typeof b];

      let valA: string | number = aVal as string | number;
      let valB: string | number = bVal as string | number;

      if (typeof valA === "string" && !isNaN(Number(valA))) valA = Number(valA);
      if (typeof valB === "string" && !isNaN(Number(valB))) valB = Number(valB);

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortAsc]);

  // Chart transformations
  const trendData = (data?.ventasPorFecha || []).reduce<Record<string, string | number>[]>((acc, curr) => {
    const dateStr = format(parseISO(curr.fecha), "dd MMM", { locale: es });
    let entry = acc.find(x => x.fecha === dateStr);
    if (!entry) {
      entry = { fecha: dateStr };
      acc.push(entry);
    }
    entry[curr.nombreUbicacion] = Number(curr.ventas);
    return acc;
  }, []);

  const keys = Array.from(new Set(data?.ventasPorFecha.map(t => t.nombreUbicacion) || []));
  const pieData = sortedTiendas.map(t => ({
    name: t.nombreUbicacion,
    value: Number(t.ventas)
  }));

  const mixData = sortedTiendas.map(t => ({
    name: t.nombreUbicacion,
    Efectivo: Number(t.efectivo),
    Transferencia: Number(t.transferencia),
    Credito: Number(t.credito)
  }));

  const content = (
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Comparativo de Tiendas
            </h1>
            <p className="text-sm text-muted-foreground">Evaluación de rendimiento, ventas y medios de pago por ubicación.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={periodo} onValueChange={applyPreset}>
              <SelectTrigger className="w-[150px] h-9 bg-background">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Hoy</SelectItem>
                <SelectItem value="semanal">Esta Semana</SelectItem>
                <SelectItem value="mensual">Este Mes</SelectItem>
                <SelectItem value="trimestral">Este Trimestre</SelectItem>
                <SelectItem value="semestral">Este Semestre</SelectItem>
                <SelectItem value="anual">Este Año</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {isCustom && (
              <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-md border">
                <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 text-sm bg-background border-none w-[130px]" />
                <span className="text-muted-foreground text-sm">-</span>
                <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 text-sm bg-background border-none w-[130px]" />
              </div>
            )}

            <Button variant="outline" size="icon" onClick={() => refetch()} title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
          </div>
        ) : isError || !data ? (
          <div className="p-10 text-center text-destructive bg-destructive/5 rounded-xl border border-destructive/20">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-80" />
            <p className="font-semibold">{getApiErrorMessage(error, "No se pudo cargar el comparativo")}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Intentar de nuevo</Button>
          </div>
        ) : data.tiendas.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No hay datos de operación en este periodo.</div>
        ) : (
          <div className="space-y-6 animate-in fade-in">
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Ventas por Tienda</CardTitle>
                  <CardDescription>Evolución diaria de ventas facturadas y público general</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} opacity={0.5} />
                        <XAxis dataKey="fecha" tickLine={false} axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }} tickMargin={12} tick={{ fontSize: 11, fill: 'hsl(var(--report-text-muted))', fontWeight: 500 }} />
                        <YAxis tickFormatter={v => `$${v/1000}k`} tickLine={false} axisLine={false} width={50} tick={{ fontSize: 11, fill: 'hsl(var(--report-text-muted))', fontWeight: 500 }} />
                        <RechartsTooltip
                          formatter={(value: number) => formatNumber(value, { kind: "money" })}
                          contentStyle={{ borderRadius: '8px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                          labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--report-header))', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px', fontWeight: 500 }} iconType="circle" />
                        {keys.map((key, i) => (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={getCategoricalChartColor(i)}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground" data-testid="comparison-sales-chart-explanation">Suma ventas sin IVA por fecha y tienda dentro del periodo seleccionado, con líneas sin costo aún incluidas.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Participación Global</CardTitle>
                  <CardDescription>Distribución de los ingresos</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="45%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={getCategoricalChartColor(index)} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number) => formatNumber(value, { kind: "money" })}
                          contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '15px' }} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground" data-testid="comparison-share-chart-explanation">Distribuye las ventas sin IVA del periodo seleccionado entre todas las tiendas visibles, incluidas líneas sin costo.</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Mezcla de Pago</CardTitle>
                <CardDescription>Preferencias de cobro por tienda</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer>
                    <BarChart data={mixData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} opacity={0.5} />
                      <XAxis type="number" tickFormatter={v => `$${v/1000}k`} tickLine={false} axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }} tickMargin={12} tick={{ fontSize: 11, fill: 'hsl(var(--report-text-muted))', fontWeight: 500 }} />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 11, fill: 'hsl(var(--report-text-muted))', fontWeight: 500 }} />
                      <RechartsTooltip
                        formatter={(value: number) => formatNumber(value, { kind: "money" })}
                        contentStyle={{ borderRadius: '6px', fontSize: '13px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        cursor={{ fill: 'hsl(var(--report-stripe))', opacity: 0.6 }}
                      />
                      <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px', fontWeight: 500 }} iconType="circle" />
                      <Bar dataKey="Efectivo" stackId="a" fill={REPORT_CATEGORICAL_COLORS[0]} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Transferencia" stackId="a" fill={REPORT_CATEGORICAL_COLORS[1]} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Credito" stackId="a" fill={REPORT_CATEGORICAL_COLORS[3]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                  <p className="mt-3 text-sm text-muted-foreground" data-testid="comparison-payment-chart-explanation">Suma cobros monetarios por medio de pago y tienda dentro del periodo seleccionado.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full custom-scrollbar">
                  <Table className="w-full text-xs">
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40 whitespace-nowrap">
                        <SortableHead label="Tienda" sortName="nombreUbicacion" />
                        <SortableHead label="Part. %" sortName="participacion" align="right" />
                        <SortableHead label="Ventas" sortName="ventas" align="right" />
                        <TableHead className="text-right">Tendencia</TableHead>
                        <SortableHead label="Utilidad" sortName="margen" align="right" />
                        <SortableHead label="Tickets" sortName="tickets" align="right" />
                        <SortableHead label="Promedio" sortName="ticketPromedio" align="right" />
                        <SortableHead label="Rollos / Metraje" sortName="metros" align="right" />
                        <TableHead className="text-right">Medios de Pago</TableHead>
                        <TableHead className="text-right">Mejor / Peor Día</TableHead>
                        <SortableHead label="Facturado %" sortName="porcentajeFacturado" align="right" />
                        <SortableHead label="Dif. Caja" sortName="diferenciaCaja" align="right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTiendas.map((t, idx) => {
                        const trend = Number(t.tendenciaPorcentaje);
                        return (
                          <TableRow key={t.ubicacionId} className="hover:bg-muted/30 whitespace-nowrap">
                            <TableCell className="font-bold text-sidebar">
                              {t.nombreUbicacion}
                            </TableCell>
                            <TableCell className="text-right font-bold text-muted-foreground">
                              {formatNumber(t.participacion, { kind: "percentage", percentageInput: "percent" })}
                            </TableCell>
                            <TableCell className="text-right font-black text-sidebar text-sm">
                              {formatNumber(t.ventas, { kind: "money" })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={`inline-flex items-center gap-1 font-bold ${trend > 0 ? "text-green-600" : trend < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                                {formatNumber(Math.abs(trend), { kind: "percentage", percentageInput: "percent" })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium text-green-700 dark:text-green-500">
                              {t.margen == null ? "Pendiente" : formatNumber(t.margen, { kind: "money" })}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(t.tickets, { kind: "count" })}
                              {t.cancelaciones > 0 && <span className="text-destructive text-[10px] block font-bold">-{t.cancelaciones} canc.</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="font-mono">{formatNumber(t.ticketPromedio, { kind: "money" })}</div>
                              <div className={`text-[10px] font-bold ${Number(t.diferenciaTicketPromedio) > 0 ? "text-green-600" : "text-destructive"}`}>
                                {Number(t.diferenciaTicketPromedio) > 0 ? "+" : ""}{formatNumber(t.diferenciaTicketPromedio, { kind: "money" })} vs Gen
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <div>Rollos: {formatNumber(t.rollosMetros, { kind: "quantity" })} {formatUnit("METRO")}</div>
                              <div className="text-muted-foreground text-[10px]">Rollos: {formatNumber(t.rollosKilos, { kind: "quantity" })} {formatUnit("KILO")}</div>
                              <div className="text-muted-foreground text-[10px]">Metraje: {formatNumber(t.metrajeMetros, { kind: "quantity" })} {formatUnit("METRO")}</div>
                              <div className="text-muted-foreground text-[10px]">Cajas completas: {formatNumber(t.rollosBolsas, { kind: "quantity" })} {formatUnit("BOLSA")}</div>
                              <div className="text-muted-foreground text-[10px]">Bolsas sueltas: {formatNumber(t.metrajeBolsas, { kind: "quantity" })} {formatUnit("BOLSA")}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-[10px] text-muted-foreground">Ef: <span className="font-mono font-medium text-foreground">{formatNumber(t.efectivo, { kind: "money" })}</span></div>
                              <div className="text-[10px] text-muted-foreground">Tr: <span className="font-mono font-medium text-foreground">{formatNumber(t.transferencia, { kind: "money" })}</span></div>
                              <div className="text-[10px] text-muted-foreground">Cr: <span className="font-mono font-medium text-foreground">{formatNumber(t.credito, { kind: "money" })}</span></div>
                            </TableCell>
                            <TableCell className="text-right">
                              {t.mejorDia.fecha && <div className="text-[10px] text-green-700 font-bold">▲ {format(parseISO(t.mejorDia.fecha), "dd MMM")} ({formatNumber(t.mejorDia.ventas, { kind: "money" })})</div>}
                              {t.peorDia.fecha && <div className="text-[10px] text-destructive font-bold">▼ {format(parseISO(t.peorDia.fecha), "dd MMM")} ({formatNumber(t.peorDia.ventas, { kind: "money" })})</div>}
                            </TableCell>
                            <TableCell className="text-right font-bold text-muted-foreground">
                              {formatNumber(t.porcentajeFacturado, { kind: "percentage", percentageInput: "percent" })}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              <span className={Number(t.diferenciaCaja) < 0 ? "text-destructive" : Number(t.diferenciaCaja) > 0 ? "text-amber-600" : ""}>
                                {Number(t.diferenciaCaja) > 0 ? "+" : ""}{formatNumber(t.diferenciaCaja, { kind: "money" })}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    {data.totales && (
                      <TableFooter>
                        <TableRow className="whitespace-nowrap font-bold bg-sidebar/5">
                          <TableCell>Total General</TableCell>
                          <TableCell className="text-right">100%</TableCell>
                          <TableCell className="text-right font-black text-sm">{formatNumber(data.totales.ventas, { kind: "money" })}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right font-mono text-green-700">{data.totales.margen == null ? "Pendiente" : formatNumber(data.totales.margen, { kind: "money" })}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(data.totales.tickets, { kind: "count" })}
                            {data.totales.cancelaciones > 0 && <span className="text-destructive text-[10px] block font-bold">-{data.totales.cancelaciones} canc.</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(data.totales.ticketPromedio, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono">
                            <div>Rollos: {formatNumber(data.totales.rollosMetros, { kind: "quantity" })} {formatUnit("METRO")}</div>
                            <div className="text-muted-foreground text-[10px]">Rollos: {formatNumber(data.totales.rollosKilos, { kind: "quantity" })} {formatUnit("KILO")}</div>
                            <div className="text-muted-foreground text-[10px]">Metraje: {formatNumber(data.totales.metrajeMetros, { kind: "quantity" })} {formatUnit("METRO")}</div>
                            <div className="text-muted-foreground text-[10px]">Cajas completas: {formatNumber(data.totales.rollosBolsas, { kind: "quantity" })} {formatUnit("BOLSA")}</div>
                            <div className="text-muted-foreground text-[10px]">Bolsas sueltas: {formatNumber(data.totales.metrajeBolsas, { kind: "quantity" })} {formatUnit("BOLSA")}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-[10px] text-muted-foreground">Ef: <span className="font-mono font-medium text-foreground">{formatNumber(data.totales.efectivo, { kind: "money" })}</span></div>
                            <div className="text-[10px] text-muted-foreground">Tr: <span className="font-mono font-medium text-foreground">{formatNumber(data.totales.transferencia, { kind: "money" })}</span></div>
                            <div className="text-[10px] text-muted-foreground">Cr: <span className="font-mono font-medium text-foreground">{formatNumber(data.totales.credito, { kind: "money" })}</span></div>
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right text-muted-foreground font-bold">{formatNumber(data.totales.porcentajeFacturado, { kind: "percentage", percentageInput: "percent" })}</TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={Number(data.totales.diferenciaCaja) < 0 ? "text-destructive" : Number(data.totales.diferenciaCaja) > 0 ? "text-amber-600" : ""}>
                                {Number(data.totales.diferenciaCaja) > 0 ? "+" : ""}{formatNumber(data.totales.diferenciaCaja, { kind: "money" })}
                            </span>
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
                <p className="px-6 pb-4 pt-3 text-sm text-muted-foreground" data-testid="comparison-table-explanation">Compara por tienda ventas sin IVA, utilidad con costo congelado, tickets, cantidades por unidad y cobros del periodo seleccionado; la utilidad queda pendiente si falta costo.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
  );
  return embedded ? content : <AppLayout>{content}</AppLayout>;
}