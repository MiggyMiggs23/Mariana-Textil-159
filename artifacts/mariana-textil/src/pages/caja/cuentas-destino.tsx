import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetAdminCuentasDestino,
  exportAdminCuentasDestinoXlsx,
  exportAdminCuentasDestinoPdf,
  type AdminCuentasDestino,
  type AdminMatrizDestinoCell,
  type ListAdminCuentaDestinoMovimientosFormaPago,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Download, FileText, Wallet, RefreshCw, Loader2, AlertCircle, ArrowUpRight, ArrowDownRight, Store } from "lucide-react";
import { ACCOUNT_DESTINATION_ORDER, formatAccountDestination, formatNumber, normalizeAccountDestination } from "@workspace/number-format";
import { format, subDays, startOfWeek, startOfMonth, startOfQuarter, startOfYear, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getAccountDestinationChartColor } from "@/lib/report-chart-colors";
import { Link } from "wouter";

type ReconciledHeader = AdminCuentasDestino["encabezado"] & {
  cobradoVariacionPorcentaje: string;
  porCobrarVariacionPorcentaje: string;
  vendidoVariacionPorcentaje: string;
};

const MatrixCellView = ({
  cell,
  facturado,
  formaPago,
  inheritedParams,
}: {
  cell: AdminMatrizDestinoCell;
  facturado: boolean | null;
  formaPago: ListAdminCuentaDestinoMovimientosFormaPago;
  inheritedParams: URLSearchParams;
}) => {
  if (Number(cell.importe) === 0) return <span className="text-muted-foreground">-</span>;

  const params = new URLSearchParams(inheritedParams.toString());
  if (facturado !== null) params.set("facturado", String(facturado));
  params.set("formaPago", formaPago);

  return (
    <div className="flex flex-col items-start">
      {cell.cuentaDestino ? (
        <Link
          href={`/caja/cuentas-destino/${cell.cuentaDestino}?${params.toString()}`}
          className="text-primary hover:underline font-mono font-medium"
          data-testid={`link-matriz-${cell.cuentaDestino}-${formaPago}`}
        >
          {formatNumber(cell.importe, { kind: "money" })}
        </Link>
      ) : (
        <span className="font-mono font-medium">{formatNumber(cell.importe, { kind: "money" })}</span>
      )}
      {cell.cuentaDestino && (
        <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight uppercase font-semibold tracking-wider">
          {formatAccountDestination(cell.cuentaDestino)}
        </span>
      )}
    </div>
  );
};

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
    const destination = normalizeAccountDestination(curr.cuentaDestino) ?? curr.cuentaDestino;
    entry[destination] = Number(curr.importe);
    return acc;
  }, []);

  const keys = [
    ...ACCOUNT_DESTINATION_ORDER.filter((destination) =>
      data?.tendencia.some((trend) => normalizeAccountDestination(trend.cuentaDestino) === destination),
    ),
    ...Array.from(new Set(
      (data?.tendencia ?? [])
        .map((trend) => normalizeAccountDestination(trend.cuentaDestino) ?? trend.cuentaDestino)
        .filter((destination) => !normalizeAccountDestination(destination)),
    )),
  ];

  const inheritedFilters = new URLSearchParams({ desde, hasta });
  if (selectedLocationId != null) inheritedFilters.set("ubicacionId", String(selectedLocationId));

  const showOtras = data?.matriz?.filas.some(f => Number(f.otras.importe) !== 0) ?? false;

  const orderMap: Record<string, number> = { "CAJA_FISICA": 1, "CUENTA_NO_FISCAL": 2, "CUENTA_FISCAL": 3 };
  const cuentasSegundaFila = (data?.resumen ?? [])
    .filter(r => ["CAJA_FISICA", "CUENTA_NO_FISCAL", "CUENTA_FISCAL"].includes(r.cuentaDestino))
    .sort((a, b) => orderMap[a.cuentaDestino] - orderMap[b.cuentaDestino]);
  const header = data?.encabezado as ReconciledHeader | undefined;
  const topStats = header
    ? [
        {
          title: "Cobrado",
          amount: header.cobrado,
          prev: header.cobradoAnterior,
          variation: header.cobradoVariacionPorcentaje,
          className: "border-l-4 border-l-primary",
        },
        {
          title: "Por Cobrar",
          amount: header.porCobrar,
          prev: header.porCobrarAnterior,
          variation: header.porCobrarVariacionPorcentaje,
          className: "border-l-4 border-l-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10 border-dashed",
        },
        {
          title: "Vendido",
          amount: header.vendido,
          prev: header.vendidoAnterior,
          variation: header.vendidoVariacionPorcentaje,
          className: "border-l-4 border-l-sidebar",
        },
      ]
    : [];

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              Cuentas Destino
            </h1>
            <p className="text-sm text-muted-foreground">Flujos financieros por destino.</p>
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
          <div className="space-y-8 animate-in fade-in">
            {/* Top Cards: Cobrado, Por Cobrar, Vendido */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topStats.map((stat) => {
                const varPct = Number(stat.variation);
                const isPositive = varPct > 0;
                return (
                  <Card key={stat.title} className={`relative overflow-hidden ${stat.className}`}>
                    <CardContent className="pt-6">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                      <h2 className="text-3xl font-black text-sidebar mt-2" data-testid={`text-monto-${stat.title.toLowerCase().replace(' ', '-')}`}>
                        {formatNumber(stat.amount, { kind: "money" })}
                      </h2>
                      <div className="flex items-center justify-between mt-3 text-sm">
                        <span className="text-muted-foreground">Ant: {formatNumber(stat.prev, { kind: "money" })}</span>
                        <div className={`flex items-center gap-1 font-semibold ${isPositive ? "text-green-600" : varPct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : varPct < 0 ? <ArrowDownRight className="w-4 h-4" /> : null}
                          {formatNumber(stat.variation, { kind: "percentage", percentageInput: "percent" })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Second Row: Caja Fisica, No Fiscal, Fiscal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cuentasSegundaFila.map((row) => {
                const varPct = Number(row.variacionPorcentaje);
                const isPositive = varPct > 0;
                return (
                  <Link
                    key={row.cuentaDestino}
                    href={`/caja/cuentas-destino/${row.cuentaDestino}?${inheritedFilters.toString()}`}
                    className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`link-cuenta-destino-${row.cuentaDestino}`}
                  >
                    <Card className="relative h-full overflow-hidden transition-colors hover:border-primary/60 hover:bg-muted/20">
                      <CardContent className="pt-5 pb-5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{formatAccountDestination(row.cuentaDestino)}</p>
                        <div className="flex items-end justify-between mt-1">
                          <h3 className="text-2xl font-bold text-sidebar">{formatNumber(row.importe, { kind: "money" })}</h3>
                          <span className="font-bold text-sidebar bg-sidebar/5 px-2 py-0.5 rounded text-xs">
                            {formatNumber(row.porcentaje, { kind: "percentage", percentageInput: "percent" })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs">
                          {row.cuentaDestino === "CAJA_FISICA" ? (
                            <span className="font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Facturado: {formatNumber(row.cajaFisicaFacturado, { kind: "money" })}</span>
                          ) : <span />}
                          <div className={`flex items-center gap-0.5 font-semibold ${isPositive ? "text-green-600" : varPct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : varPct < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                            {formatNumber(row.variacionPorcentaje, { kind: "percentage", percentageInput: "percent" })} vs ant.
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Incongruencias Alert */}
            {data.incongruencias.conteo > 0 && (
              <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 stroke-amber-600 dark:stroke-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300 font-bold">Incongruencias detectadas</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                  <span className="text-amber-700 dark:text-amber-400/90 font-medium">Se encontraron {data.incongruencias.conteo} movimientos con destinos incongruentes por un total de {formatNumber(data.incongruencias.importe, { kind: "money" })}.</span>
                  <span className="flex flex-wrap gap-2">
                    {(["CUENTA_NO_FISCAL", "CUENTA_FISCAL"] as const).map((destination) => (
                      <Link
                        key={destination}
                        href={`/caja/cuentas-destino/${destination}?incongruente=true&${inheritedFilters.toString()}`}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                          data-testid={`link-incongruencias-${destination}`}
                        >
                          {formatAccountDestination(destination)}
                        </Button>
                      </Link>
                    ))}
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Stacked Chart */}
              <div className="xl:col-span-2">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">Flujos Diarios por Cuenta</CardTitle>
                    <CardDescription>
                      Flujos reconocidos (cobrado y por cobrar)
                      {/* Documentación: Se elige mantener crédito/por cobrar en la gráfica porque representa flujos reconocidos de ventas, vitales para visualizar el total de ingresos generados en el periodo aunque su liquidación sea diferida. */}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--report-stripe))" strokeWidth={2} opacity={0.5} />
                            <XAxis
                              dataKey="fecha"
                              tickLine={false}
                              axisLine={{ stroke: 'hsl(var(--report-text-muted)/0.3)' }}
                              tick={{ fill: 'hsl(var(--report-text-muted))', fontSize: 11, fontWeight: 500 }}
                              tickMargin={12}
                            />
                            <YAxis
                              tickFormatter={(v) => `$${v / 1000}k`}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: 'hsl(var(--report-text-muted))', fontSize: 11, fontWeight: 500 }}
                              width={60}
                            />
                            <Tooltip
                              cursor={{ fill: 'hsl(var(--report-stripe))', opacity: 0.6 }}
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
                                              <span className="text-muted-foreground">{formatAccountDestination(String(entry.name))}</span>
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
                                name={formatAccountDestination(key)}
                                stackId="a"
                                fill={getAccountDestinationChartColor(key, index)}
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

              {/* Matriz and Fiscal Resumen */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Matriz de Operaciones
                      {!data.matriz.cierra && (
                         <div className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" title="Los importes no cuadran perfectamente">
                           Descuadre
                         </div>
                      )}
                    </CardTitle>
                    <CardDescription>Resumen de cobros por tipo de comprobante</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead>Comprobante</TableHead>
                            <TableHead>Efectivo</TableHead>
                            <TableHead>Transferencia</TableHead>
                            <TableHead>Por cobrar</TableHead>
                            {showOtras && <TableHead>Otras</TableHead>}
                            <TableHead className="font-bold border-l text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.matriz.filas.map((row) => (
                            <TableRow key={String(row.facturado)} className={row.facturado === null ? "bg-muted/20 font-bold border-t-2" : ""}>
                              <TableCell className="font-medium">
                                {row.facturado === true ? "Facturado" : row.facturado === false ? "Sin factura" : "Total"}
                              </TableCell>
                              <TableCell><MatrixCellView cell={row.efectivo} facturado={row.facturado} formaPago="EFECTIVO" inheritedParams={inheritedFilters} /></TableCell>
                              <TableCell><MatrixCellView cell={row.transferencia} facturado={row.facturado} formaPago="TRANSFERENCIA" inheritedParams={inheritedFilters} /></TableCell>
                              <TableCell><MatrixCellView cell={row.porCobrar} facturado={row.facturado} formaPago="POR_COBRAR" inheritedParams={inheritedFilters} /></TableCell>
                              {showOtras && <TableCell><MatrixCellView cell={row.otras} facturado={row.facturado} formaPago="OTRAS" inheritedParams={inheritedFilters} /></TableCell>}
                              <TableCell className="font-mono font-black text-right border-l text-sidebar">{formatNumber(row.total, { kind: "money" })}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="p-4 border-t bg-muted/10 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Base Facturada</p>
                        <p className="text-lg font-bold text-sidebar mt-1">{formatNumber(data.ivaFacturado.base, { kind: "money" })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">IVA Facturado</p>
                        <p className="text-lg font-bold text-sidebar mt-1">{formatNumber(data.ivaFacturado.iva, { kind: "money" })}</p>
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
                <CardDescription>Acumulados de venta y cobro a nivel ubicación</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Tienda</TableHead>
                        <TableHead className="text-right">Cobrado</TableHead>
                        <TableHead className="text-right border-l">Por Cobrar</TableHead>
                        <TableHead className="text-right font-bold border-l">Vendido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porTienda.map(t => (
                        <TableRow key={t.ubicacionId}>
                          <TableCell className="font-bold flex items-center gap-2">
                            <Store className="w-4 h-4 text-muted-foreground" />
                            {t.nombreUbicacion}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatNumber(t.cobrado, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono border-l text-muted-foreground">{formatNumber(t.porCobrar, { kind: "money" })}</TableCell>
                          <TableCell className="text-right font-mono font-black border-l text-sidebar">{formatNumber(t.vendido, { kind: "money" })}</TableCell>
                        </TableRow>
                      ))}
                      {data.porTienda.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
