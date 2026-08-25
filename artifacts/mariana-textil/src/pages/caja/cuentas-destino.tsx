import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetAdminCuentasDestino,
  exportAdminCuentasDestinoXlsx,
  exportAdminCuentasDestinoPdf
} from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
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
  TableRow
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Download, FileText, Wallet, RefreshCw, Loader2, AlertCircle, ArrowUpRight, ArrowDownRight, Store } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { format, subDays, startOfWeek, startOfMonth, startOfQuarter, startOfYear, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

export default function CajaCuentasDestino() {
  const { selectedLocationId } = useLocationScope();
  const { toast } = useToast();

  const [preset, setPreset] = useState("mes");
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data, isLoading, isError, error, refetch } = useGetAdminCuentasDestino({
    desde,
    hasta,
    ubicacionId: selectedLocationId ?? undefined
  });

  const applyPreset = (val: string) => {
    setPreset(val);
    const today = new Date();
    setHasta(format(today, "yyyy-MM-dd"));
    switch (val) {
      case "hoy": setDesde(format(today, "yyyy-MM-dd")); break;
      case "semana": setDesde(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd")); break;
      case "mes": setDesde(format(startOfMonth(today), "yyyy-MM-dd")); break;
      case "trimestre": setDesde(format(startOfQuarter(today), "yyyy-MM-dd")); break;
      case "semestre": setDesde(format(subDays(today, 180), "yyyy-MM-dd")); break;
      case "ano": setDesde(format(startOfYear(today), "yyyy-MM-dd")); break;
    }
  };

  const handleExportXlsx = async () => {
    try {
      const blob = await exportAdminCuentasDestinoXlsx({ desde, hasta, ubicacionId: selectedLocationId ?? undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuentas-destino-${desde}-a-${hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Error al exportar", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const blob = await exportAdminCuentasDestinoPdf({ desde, hasta, ubicacionId: selectedLocationId ?? undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuentas-destino-${desde}-a-${hasta}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Error al exportar", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const chartData = (data?.tendencia || []).reduce<Record<string, string | number>[]>((acc, curr) => {
    const dateStr = format(parseISO(curr.fecha), "dd MMM", { locale: es });
    let entry = acc.find(x => x.fecha === dateStr);
    if (!entry) {
      entry = { fecha: dateStr };
      acc.push(entry);
    }
    entry[curr.cuentaDestino] = Number(curr.importe);
    return acc;
  }, []);

  const keys = Array.from(new Set(data?.tendencia.map(t => t.cuentaDestino) || []));
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              Cuentas Destino
            </h1>
            <p className="text-sm text-muted-foreground">Flujos financieros, cuentas fiscales y cajas físicas.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="w-[140px] h-9 bg-background">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoy">Hoy</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="mes">Este mes</SelectItem>
                <SelectItem value="trimestre">Este trimestre</SelectItem>
                <SelectItem value="semestre">Últimos 6 meses</SelectItem>
                <SelectItem value="ano">Este año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {preset === "custom" && (
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border">
                <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-8 text-sm bg-background border-none w-[130px]" />
                <span className="text-muted-foreground text-sm">-</span>
                <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-8 text-sm bg-background border-none w-[130px]" />
              </div>
            )}

            <Button variant="outline" size="icon" onClick={() => refetch()} title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportXlsx}>
              <Download className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText className="h-4 w-4 mr-2" /> PDF
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
            <p className="font-semibold">{getApiErrorMessage(error, "No se pudo cargar la información de cuentas")}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Intentar de nuevo</Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in">
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {data.resumen.slice(0, 4).map((row, i) => {
                const varPct = Number(row.variacionPorcentaje);
                const isPositive = varPct > 0;
                return (
                  <Card key={i} className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Wallet className="w-12 h-12" />
                    </div>
                    <CardContent className="pt-6">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{row.cuentaDestino}</p>
                      <div className="flex items-end gap-2 mt-2">
                        <h2 className="text-3xl font-black text-sidebar">{formatNumber(row.importe, { kind: "money" })}</h2>
                      </div>
                      <div className="flex items-center justify-between mt-3 text-sm">
                        <span className="font-bold text-sidebar bg-sidebar/10 px-2 py-0.5 rounded">
                          {formatNumber(row.porcentaje, { kind: "percentage", percentageInput: "percent" })}
                        </span>
                        <div className={`flex items-center gap-1 font-semibold ${isPositive ? "text-green-600" : varPct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : varPct < 0 ? <ArrowDownRight className="w-4 h-4" /> : null}
                          {formatNumber(Math.abs(varPct), { kind: "percentage", percentageInput: "percent" })} vs ant.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Stacked Chart */}
              <div className="xl:col-span-2">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">Flujos Diarios por Cuenta</CardTitle>
                    <CardDescription>Monto cobrado por día y destino</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis
                              dataKey="fecha"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                              tickMargin={10}
                            />
                            <YAxis
                              tickFormatter={(v) => `$${v / 1000}k`}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                              width={60}
                            />
                            <Tooltip
                              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-background border rounded-lg shadow-xl p-3 text-sm min-w-[200px]">
                                      <p className="font-bold mb-2 pb-2 border-b">{label}</p>
                                      <div className="space-y-1.5">
                                        {payload.map((entry, index) => (
                                          <div key={index} className="flex justify-between items-center gap-4">
                                            <div className="flex items-center gap-2">
                                              <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: entry.color }} />
                                              <span className="text-muted-foreground">{entry.name}</span>
                                            </div>
                                            <span className="font-mono font-bold">{formatNumber(Number(entry.value), { kind: "money" })}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                            {keys.map((key, index) => (
                              <Bar
                                key={key}
                                dataKey={key}
                                stackId="a"
                                fill={colors[index % colors.length]}
                                radius={index === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                barSize={30}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                        No hay datos suficientes para graficar
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Facturacion & IVA */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resumen Fiscal</CardTitle>
                    <CardDescription>Impacto de IVA y comprobantes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/40 p-4 rounded-lg border">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold">Total Ingresado</p>
                          <p className="text-2xl font-black text-sidebar mt-1">{formatNumber(data.totalCobrado, { kind: "money" })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase font-semibold">IVA Recaudado</p>
                          <p className="text-xl font-bold mt-1">{formatNumber(data.ivaCobrado, { kind: "money" })}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="font-semibold text-sidebar">Operaciones Facturadas</span>
                        <span className="font-mono font-bold text-green-700">{formatNumber(data.facturacion.facturadoTotal, { kind: "money" })}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm pl-4">
                        <span className="text-muted-foreground">Efectivo</span>
                        <span className="font-mono">{formatNumber(data.facturacion.facturadoEfectivo, { kind: "money" })}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm pl-4 pb-2 border-b">
                        <span className="text-muted-foreground">Transferencia</span>
                        <span className="font-mono">{formatNumber(data.facturacion.facturadoTransferencia, { kind: "money" })}</span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b pt-2">
                        <span className="font-semibold text-sidebar">Público General (No Fact.)</span>
                        <span className="font-mono font-bold">{formatNumber(data.facturacion.noFacturadoTotal, { kind: "money" })}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm pl-4">
                        <span className="text-muted-foreground">Efectivo</span>
                        <span className="font-mono">{formatNumber(data.facturacion.noFacturadoEfectivo, { kind: "money" })}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm pl-4">
                        <span className="text-muted-foreground">Transferencia</span>
                        <span className="font-mono">{formatNumber(data.facturacion.noFacturadoTransferencia, { kind: "money" })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Tiendas Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Desglose por Tienda</CardTitle>
                <CardDescription>Acumulados por cuenta destino a nivel ubicación</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Tienda</TableHead>
                        <TableHead className="text-right">Caja Física</TableHead>
                        <TableHead className="text-right">Cuenta Fiscal</TableHead>
                        <TableHead className="text-right">No Fiscal</TableHead>
                        <TableHead className="text-right border-l">Por Cobrar</TableHead>
                        <TableHead className="text-right font-bold border-l">Total General</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porTienda.map(t => (
                        <TableRow key={t.ubicacionId}>
                          <TableCell className="font-bold flex items-center gap-2">
                            <Store className="w-4 h-4 text-muted-foreground" />
                            {t.nombreUbicacion}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(t.cajaFisica, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono text-green-700">{formatNumber(t.cuentaFiscal, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono text-amber-700">{formatNumber(t.cuentaNoFiscal, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono border-l text-muted-foreground">{formatNumber(t.cuentasPorCobrar, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono font-black border-l text-sidebar">{formatNumber(t.total, { kind: "money" })}</TableCell>
                        </TableRow>
                      ))}
                      {data.porTienda.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Sin movimientos en el periodo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
