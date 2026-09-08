import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetAdminCuentasDestino,
  exportAdminCuentasDestinoXlsx,
  exportAdminCuentasDestinoPdf,
  type AdminCuentasDestino,
  type AdminMatrizDestinoCell,
  type ListAdminCuentaDestinoMovimientosFormaPago,
  type ListAdminCuentaDestinoMovimientosFuenteItem,
  type GetAdminCuentasDestinoPreset,
} from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Download,
  FileText,
  Wallet,
  RefreshCw,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Store,
} from "lucide-react";
import {
  ACCOUNT_DESTINATION_ORDER,
  formatAccountDestination,
  formatNumber,
  normalizeAccountDestination,
} from "@workspace/number-format";
import {
  format,
  subDays,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getAccountDestinationChartColor } from "@/lib/report-chart-colors";
import { Link, useSearch, useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function comparisonLabel(
  preset: GetAdminCuentasDestinoPreset,
  previousDesde: string,
  previousHasta: string,
) {
  const end = parseISO(previousHasta);
  if (preset === "hoy") return "Ayer a esta hora";
  if (preset === "semana") {
    return `Semana pasada al ${format(end, "EEEE", { locale: es })}`;
  }
  if (preset === "mes") {
    return `${format(parseISO(previousDesde), "MMMM", { locale: es })} al día ${format(end, "d")}`;
  }
  return `${format(parseISO(previousDesde), "d MMM", { locale: es })}–${format(end, "d MMM", { locale: es })}`;
}

const MatrixCellView = ({
  cell,
  facturado,
  formaPago,
  fuentes,
  inheritedParams,
}: {
  cell: AdminMatrizDestinoCell;
  facturado: boolean | null;
  formaPago: ListAdminCuentaDestinoMovimientosFormaPago;
  fuentes: ListAdminCuentaDestinoMovimientosFuenteItem[];
  inheritedParams: URLSearchParams;
}) => {
  if (Number(cell.importe) === 0)
    return <span className="text-muted-foreground">-</span>;

  const params = new URLSearchParams(inheritedParams.toString());
  if (facturado !== null) params.set("facturado", String(facturado));
  params.set("formaPago", formaPago);
  params.delete("fuente");
  fuentes.forEach((fuente) => params.append("fuente", fuente));

  return (
    <div className="flex flex-col items-start">
      <Link
        href={`/caja/cuentas-destino/${cell.cuentaDestino ?? "TODAS"}?${params.toString()}`}
        className="text-primary hover:underline font-mono font-medium"
        data-testid={`link-matriz-${cell.cuentaDestino ?? "TODAS"}-${formaPago}`}
      >
        {formatNumber(cell.importe, { kind: "money" })}
      </Link>
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

  const search = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(search);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const desde = searchParams.get("desde") || todayStr;
  const hasta = searchParams.get("hasta") || todayStr;
  const compare = searchParams.get("compare") === "true";
  const preset = (searchParams.get("preset") || "hoy") as GetAdminCuentasDestinoPreset;

  const updateFilters = (updates: Record<string, string | boolean | null>) => {
    const params = new URLSearchParams(search);
    for (const [key, val] of Object.entries(updates)) {
      if (val === null) params.delete(key);
      else params.set(key, String(val));
    }
    setLocation(`/caja/cuentas-destino?${params.toString()}`, {
      replace: true,
    });
  };

  const { data, isLoading, isError, error, refetch } =
    useGetAdminCuentasDestino({
      desde,
      hasta,
      ubicacionId: selectedLocationId ?? undefined,
      compare,
      preset,
    });

  const applyPreset = (val: GetAdminCuentasDestinoPreset) => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    let newDesde = todayStr;
    switch (val) {
      case "hoy":
        newDesde = todayStr;
        break;
      case "semana":
        newDesde = format(
          startOfWeek(today, { weekStartsOn: 1 }),
          "yyyy-MM-dd",
        );
        break;
      case "mes":
        newDesde = format(startOfMonth(today), "yyyy-MM-dd");
        break;
      case "trimestre":
        newDesde = format(startOfQuarter(today), "yyyy-MM-dd");
        break;
      case "semestre":
        newDesde = format(subDays(today, 180), "yyyy-MM-dd");
        break;
      case "ano":
        newDesde = format(startOfYear(today), "yyyy-MM-dd");
        break;
      case "custom":
        newDesde = desde;
        break;
    }
    updateFilters({
      preset: val,
      desde: newDesde,
      hasta: val === "custom" ? hasta : todayStr,
    });
  };

  const handleExportXlsx = async () => {
    try {
      const blob = await exportAdminCuentasDestinoXlsx({
        desde,
        hasta,
        ubicacionId: selectedLocationId ?? undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuentas-destino-${desde}-a-${hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Error al exportar",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleExportPdf = async () => {
    try {
      const blob = await exportAdminCuentasDestinoPdf({
        desde,
        hasta,
        ubicacionId: selectedLocationId ?? undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuentas-destino-${desde}-a-${hasta}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Error al exportar",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const chartData = (data?.tendencia || []).reduce<
    Record<string, string | number>[]
  >((acc, curr) => {
    const dateStr = format(parseISO(curr.fecha), "dd MMM", { locale: es });
    let entry = acc.find((x) => x.fecha === dateStr);
    if (!entry) {
      entry = { fecha: dateStr };
      acc.push(entry);
    }
    const destination =
      normalizeAccountDestination(curr.cuentaDestino) ?? curr.cuentaDestino;
    entry[destination] = Number(curr.importe);
    return acc;
  }, []);

  const keys = [
    ...ACCOUNT_DESTINATION_ORDER.filter((destination) =>
      data?.tendencia.some(
        (trend) =>
          normalizeAccountDestination(trend.cuentaDestino) === destination,
      ),
    ),
    ...Array.from(
      new Set(
        (data?.tendencia ?? [])
          .map(
            (trend) =>
              normalizeAccountDestination(trend.cuentaDestino) ??
              trend.cuentaDestino,
          )
          .filter((destination) => !normalizeAccountDestination(destination)),
      ),
    ),
  ];

  const inheritedFilters = new URLSearchParams({
    desde,
    hasta,
    preset,
    ...(compare ? { compare: "true" } : {}),
  });
  if (selectedLocationId != null)
    inheritedFilters.set("ubicacionId", String(selectedLocationId));

  const detailHref = (
    destination: string,
    fuentes: ListAdminCuentaDestinoMovimientosFuenteItem[],
    extra: Record<string, string | boolean | null> = {},
  ) => {
    const params = new URLSearchParams(inheritedFilters.toString());
    params.delete("fuente");
    fuentes.forEach((fuente) => params.append("fuente", fuente));
    for (const [key, value] of Object.entries(extra)) {
      if (value === null) params.delete(key);
      else params.set(key, String(value));
    }
    return `/caja/cuentas-destino/${destination}?${params.toString()}`;
  };

  const showOtras =
    data?.matriz?.filas.some((f) => Number(f.otras.importe) !== 0) ?? false;

  const orderMap: Record<string, number> = {
    CAJA_FISICA: 1,
    CUENTA_NO_FISCAL: 2,
    CUENTA_FISCAL: 3,
  };
  const cuentasSegundaFila = (data?.resumen ?? [])
    .filter((r) =>
      ["CAJA_FISICA", "CUENTA_NO_FISCAL", "CUENTA_FISCAL"].includes(
        r.cuentaDestino,
      ),
    )
    .sort((a, b) => orderMap[a.cuentaDestino] - orderMap[b.cuentaDestino]);
  const header = data?.encabezado;
  const topStats = header
    ? [
        {
          title: "Vendido",
          amount: header.vendido.total,
          prev: header.vendido.totalAnterior,
          variation: header.vendido.variacionPorcentaje,
          fuentes: ["POS", "CREDITO"] as ListAdminCuentaDestinoMovimientosFuenteItem[],
          breakdown: [
            { label: "Contado", amount: header.vendido.contado, fuentes: ["POS"] as ListAdminCuentaDestinoMovimientosFuenteItem[] },
            { label: "Crédito", amount: header.vendido.credito, fuentes: ["CREDITO"] as ListAdminCuentaDestinoMovimientosFuenteItem[] },
          ],
          className: "border-l-4 border-l-sidebar",
        },
        {
          title: "Por cobrar (notas de crédito al día)",
          amount: header.porCobrar.periodo,
          prev: header.porCobrar.periodoAnterior,
          variation: header.porCobrar.variacionPorcentaje,
          fuentes: ["CREDITO"] as ListAdminCuentaDestinoMovimientosFuenteItem[],
          breakdown: [],
          className:
            "border-l-4 border-l-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10 border-dashed",
        },
        {
          title: "Cobrado",
          amount: header.cobrado.total,
          prev: header.cobrado.totalAnterior,
          variation: header.cobrado.variacionPorcentaje,
          fuentes: ["POS", "ABONO", "ABONO_SALDO_FAVOR"] as ListAdminCuentaDestinoMovimientosFuenteItem[],
          breakdown: [
             { label: "De ventas del periodo", amount: header.cobrado.contado, fuentes: ["POS"] as ListAdminCuentaDestinoMovimientosFuenteItem[] },
             { label: "De notas anteriores", amount: header.cobrado.abonos, fuentes: ["ABONO"] as ListAdminCuentaDestinoMovimientosFuenteItem[] },
             { label: "A cuenta, sin aplicar", amount: header.cobrado.saldosFavor, fuentes: ["ABONO_SALDO_FAVOR"] as ListAdminCuentaDestinoMovimientosFuenteItem[] },
          ],
          className: "border-l-4 border-l-primary",
        },
      ]
    : [];

  const renderVariation = (variation: string | null) => {
    if (variation === null) {
      return (
        <div
          className="flex items-center gap-1 font-semibold text-muted-foreground text-xs"
          title="Sin periodo anterior para comparar"
        >
          - sin periodo anterior
        </div>
      );
    }
    const varPct = Number(variation);
    const isPositive = varPct > 0;
    return (
      <div
        className={`flex items-center gap-1 font-semibold ${isPositive ? "text-green-600" : varPct < 0 ? "text-destructive" : "text-muted-foreground"}`}
      >
        {isPositive ? (
          <ArrowUpRight className="w-4 h-4" />
        ) : varPct < 0 ? (
          <ArrowDownRight className="w-4 h-4" />
        ) : null}
        {formatNumber(variation, {
          kind: "percentage",
          percentageInput: "percent",
        })}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" />
              Cuentas Destino
            </h1>
            <p className="text-sm text-muted-foreground">
              Flujos financieros por destino.
            </p>
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
                <Input
                  type="date"
                  value={desde}
                  onChange={(e) => updateFilters({ desde: e.target.value })}
                  className="h-8 text-sm bg-background border-none w-[130px]"
                />
                <span className="text-muted-foreground text-sm">-</span>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => updateFilters({ hasta: e.target.value })}
                  className="h-8 text-sm bg-background border-none w-[130px]"
                />
              </div>
            )}

            <div className="flex items-center gap-2 px-2 border-l ml-1">
              <Switch
                id="compare-mode"
                checked={compare}
                onCheckedChange={(checked) =>
                  updateFilters({ compare: checked ? true : null })
                }
              />
              <Label
                htmlFor="compare-mode"
                className="text-sm font-medium whitespace-nowrap"
              >
                Comparar con periodo anterior
              </Label>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              title="Actualizar"
            >
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
            <p className="font-semibold">
              {getApiErrorMessage(
                error,
                "No se pudo cargar la información de cuentas",
              )}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => refetch()}
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in">
            {/* Top Cards: Vendido, Por Cobrar, Cobrado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topStats.map((stat) => {
                const currentHref = detailHref("TODAS", stat.fuentes);
                const previousHref = data.encabezado.previousDesde && data.encabezado.previousHasta
                  ? detailHref("TODAS", stat.fuentes, {
                      desde: format(parseISO(data.encabezado.previousDesde), "yyyy-MM-dd"),
                      hasta: format(parseISO(data.encabezado.previousHasta), "yyyy-MM-dd"),
                      compare: null,
                      preset: "custom",
                    })
                  : currentHref;
                return (
                  <Card
                    key={stat.title}
                    className={`relative overflow-hidden ${stat.className}`}
                  >
                    <CardContent className="pt-6">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {stat.title}
                      </p>
                      <Link
                        href={currentHref}
                        className="mt-2 inline-block text-3xl font-black text-sidebar hover:text-primary hover:underline"
                        data-testid={`text-monto-${stat.title.toLowerCase().replace(" ", "-")}`}
                      >
                        {formatNumber(stat.amount, { kind: "money" })}
                      </Link>
                      {stat.breakdown.length > 0 && (
                        <div className="mt-4 grid gap-2 border-t pt-3">
                          {stat.breakdown.map((part) => (
                            <Link
                              key={part.label}
                              href={detailHref("TODAS", part.fuentes)}
                              className="flex items-center justify-between gap-3 text-sm hover:text-primary hover:underline"
                            >
                              <span className="text-muted-foreground">{part.label}</span>
                              <span className="font-mono font-semibold">
                                {formatNumber(part.amount, { kind: "money" })}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {compare && (
                        <div className="flex flex-col gap-1 mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {header?.previousDesde && header?.previousHasta
                                ? comparisonLabel(preset, header.previousDesde, header.previousHasta)
                                : "Periodo anterior"}
                            </span>
                            <Link href={previousHref} className="font-medium hover:text-primary hover:underline">
                              {formatNumber(stat.prev, { kind: "money" })}
                            </Link>
                          </div>
                          <Link href={currentHref} className="flex justify-end hover:opacity-80">
                            {renderVariation(stat.variation)}
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Second Row: Caja Fisica, No Fiscal, Fiscal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cuentasSegundaFila.map((row) => {
                const currentHref = detailHref(row.cuentaDestino, []);
                const previousHref = data.encabezado.previousDesde && data.encabezado.previousHasta
                  ? detailHref(row.cuentaDestino, [], {
                      desde: format(parseISO(data.encabezado.previousDesde), "yyyy-MM-dd"),
                      hasta: format(parseISO(data.encabezado.previousHasta), "yyyy-MM-dd"),
                      compare: null,
                      preset: "custom",
                    })
                  : currentHref;
                return (
                  <Card
                    key={row.cuentaDestino}
                    className="relative h-full overflow-hidden transition-colors hover:border-primary/60 hover:bg-muted/20"
                    data-testid={`link-cuenta-destino-${row.cuentaDestino}`}
                  >
                    <CardContent className="pt-5 pb-5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {formatAccountDestination(row.cuentaDestino)}
                        </p>
                        <div className="flex items-end justify-between mt-1">
                          <Link href={currentHref} className="text-2xl font-bold text-sidebar hover:text-primary hover:underline">
                            {formatNumber(row.importe, { kind: "money" })}
                          </Link>
                          <Link href={currentHref} className="font-bold text-sidebar bg-sidebar/5 px-2 py-0.5 rounded text-xs hover:text-primary hover:underline">
                            {formatNumber(row.porcentaje, {
                              kind: "percentage",
                              percentageInput: "percent",
                            })}
                          </Link>
                        </div>
                        {compare && (
                          <div className="flex flex-col gap-1 mt-3 pt-2 border-t text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                {data.encabezado.previousDesde && data.encabezado.previousHasta
                                  ? comparisonLabel(preset, data.encabezado.previousDesde, data.encabezado.previousHasta)
                                  : "Periodo anterior"}
                              </span>
                              <Link href={previousHref} className="font-medium hover:text-primary hover:underline">
                                {formatNumber(row.importeAnterior, {
                                  kind: "money",
                                })}
                              </Link>
                            </div>
                            <Link href={currentHref} className="flex justify-end scale-90 origin-right hover:opacity-80">
                              {renderVariation(row.variacionPorcentaje)}
                            </Link>
                          </div>
                        )}
                        {row.cuentaDestino === "CAJA_FISICA" && (
                          <div className="mt-2 text-xs">
                            <Link
                              href={detailHref("CAJA_FISICA", ["POS", "ABONO", "ABONO_SALDO_FAVOR"], { facturado: true })}
                              className="font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded hover:text-primary hover:underline"
                            >
                              Facturado:{" "}
                              {formatNumber(row.cajaFisicaFacturado, {
                                kind: "money",
                              })}
                            </Link>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Incongruencias Alert */}
            {data.incongruencias.conteo > 0 && (
              <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 stroke-amber-600 dark:stroke-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300 font-bold">
                  Incongruencias detectadas
                </AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                  <span className="text-amber-700 dark:text-amber-400/90 font-medium">
                    Se encontraron{" "}
                    <Link href={detailHref("TODAS", [], { incongruente: true })} className="font-bold underline">
                      {data.incongruencias.conteo} movimientos
                    </Link>{" "}
                    con
                    destinos incongruentes por un total de{" "}
                    <Link href={detailHref("TODAS", [], { incongruente: true })} className="font-bold underline">
                      {formatNumber(data.incongruencias.importe, {
                        kind: "money",
                      })}
                    </Link>
                    .
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {(["CUENTA_NO_FISCAL", "CUENTA_FISCAL"] as const).map(
                      (destination) => (
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
                      ),
                    )}
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Stacked Chart */}
              <div className="xl:col-span-2">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Flujos Diarios por Cuenta
                    </CardTitle>
                    <CardDescription>
                      Flujos reconocidos (cobrado y por cobrar)
                      {/* Documentación: Se elige mantener crédito/por cobrar en la gráfica porque representa flujos reconocidos de ventas, vitales para visualizar el total de ingresos generados en el periodo aunque su liquidación sea diferida. */}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chartData}
                            margin={{
                              top: 10,
                              right: 10,
                              left: 20,
                              bottom: 20,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="hsl(var(--report-stripe))"
                              strokeWidth={2}
                              opacity={0.5}
                            />
                            <XAxis
                              dataKey="fecha"
                              tickLine={false}
                              axisLine={{
                                stroke: "hsl(var(--report-text-muted)/0.3)",
                              }}
                              tick={{
                                fill: "hsl(var(--report-text-muted))",
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                              tickMargin={12}
                            />
                            <YAxis
                              tickFormatter={(v) => `$${v / 1000}k`}
                              tickLine={false}
                              axisLine={false}
                              tick={{
                                fill: "hsl(var(--report-text-muted))",
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                              width={60}
                            />
                            <Tooltip
                              cursor={{
                                fill: "hsl(var(--report-stripe))",
                                opacity: 0.6,
                              }}
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-background border rounded-lg shadow-xl p-3 text-sm min-w-[200px]">
                                      <p className="font-bold mb-2 pb-2 border-b">
                                        {label}
                                      </p>
                                      <div className="space-y-1.5">
                                        {payload.map((entry, index) => (
                                          <div
                                            key={index}
                                            className="flex justify-between items-center gap-4"
                                          >
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="w-2.5 h-2.5 rounded-[2px]"
                                                style={{
                                                  backgroundColor: entry.color,
                                                }}
                                              />
                                              <span className="text-muted-foreground">
                                                {formatAccountDestination(
                                                  String(entry.name),
                                                )}
                                              </span>
                                            </div>
                                            <span className="font-mono font-bold">
                                              {formatNumber(
                                                Number(entry.value),
                                                { kind: "money" },
                                              )}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend
                              wrapperStyle={{
                                paddingTop: "20px",
                                fontSize: "12px",
                              }}
                            />
                            {keys.map((key, index) => (
                              <Bar
                                key={key}
                                dataKey={key}
                                name={formatAccountDestination(key)}
                                stackId="a"
                                fill={getAccountDestinationChartColor(
                                  key,
                                  index,
                                )}
                                radius={
                                  index === keys.length - 1
                                    ? [4, 4, 0, 0]
                                    : [0, 0, 0, 0]
                                }
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
                      Matriz de Operaciones (Ventas)
                      {!data.matriz.cierra && (
                        <div
                          className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                          title="Los importes no cuadran perfectamente"
                        >
                          Descuadre
                        </div>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Ventas realizadas en el periodo
                    </CardDescription>
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
                            <TableHead className="font-bold border-l text-right">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.matriz.filas.map((row) => (
                            <TableRow
                              key={String(row.facturado)}
                              className={
                                row.facturado === null
                                  ? "bg-muted/20 font-bold border-t-2"
                                  : ""
                              }
                            >
                              <TableCell className="font-medium">
                                {row.facturado === true
                                  ? "Facturado"
                                  : row.facturado === false
                                    ? "Sin factura"
                                    : "Total"}
                              </TableCell>
                              <TableCell>
                                <MatrixCellView
                                  cell={row.efectivo}
                                  facturado={row.facturado}
                                  formaPago="EFECTIVO"
                                  fuentes={["POS"]}
                                  inheritedParams={inheritedFilters}
                                />
                              </TableCell>
                              <TableCell>
                                <MatrixCellView
                                  cell={row.transferencia}
                                  facturado={row.facturado}
                                  formaPago="TRANSFERENCIA"
                                  fuentes={["POS"]}
                                  inheritedParams={inheritedFilters}
                                />
                              </TableCell>
                              <TableCell>
                                <MatrixCellView
                                  cell={row.porCobrar}
                                  facturado={row.facturado}
                                  formaPago="POR_COBRAR"
                                  fuentes={["CREDITO"]}
                                  inheritedParams={inheritedFilters}
                                />
                              </TableCell>
                              {showOtras && (
                                <TableCell>
                                  <MatrixCellView
                                    cell={row.otras}
                                    facturado={row.facturado}
                                    formaPago="OTRAS"
                                    fuentes={["POS"]}
                                    inheritedParams={inheritedFilters}
                                  />
                                </TableCell>
                              )}
                              <TableCell className="font-mono font-black text-right border-l text-sidebar">
                                <Link
                                  href={detailHref("TODAS", ["POS", "CREDITO"], {
                                    facturado: row.facturado,
                                  })}
                                  className="text-primary hover:underline"
                                >
                                  {formatNumber(row.total, { kind: "money" })}
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {data.cobrosAnteriores.length > 0 && (
                      <div className="mt-4 border-t">
                        <div className="px-4 py-3 bg-muted/40 font-semibold text-sm flex items-center justify-between">
                          Cobros de periodos anteriores
                          <span className="text-muted-foreground font-normal text-xs">
                            Abonos recibidos hoy de ventas pasadas
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Cuenta Destino</TableHead>
                                <TableHead>Origen</TableHead>
                                <TableHead className="text-right">
                                  Importe
                                </TableHead>
                                {compare && (
                                  <TableHead className="text-right">
                                    Anterior
                                  </TableHead>
                                )}
                                {compare && (
                                  <TableHead className="text-right">
                                    Var
                                  </TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.cobrosAnteriores.map(
                                (cobro) => {
                                  const currentHref = detailHref(cobro.cuentaDestino, [cobro.fuente]);
                                  const previousHref = data.encabezado.previousDesde && data.encabezado.previousHasta
                                    ? detailHref(cobro.cuentaDestino, [cobro.fuente], {
                                        desde: format(parseISO(data.encabezado.previousDesde), "yyyy-MM-dd"),
                                        hasta: format(parseISO(data.encabezado.previousHasta), "yyyy-MM-dd"),
                                        compare: null,
                                        preset: "custom",
                                      })
                                    : currentHref;
                                  return (
                                  <TableRow key={`${cobro.cuentaDestino}-${cobro.fuente}`}>
                                    <TableCell className="font-medium text-xs">
                                      {formatAccountDestination(
                                        cobro.cuentaDestino,
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {cobro.fuente === "ABONO" ? "Abonos" : "Saldos a favor"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold">
                                      <Link
                                        href={currentHref}
                                        className="text-primary hover:underline"
                                      >
                                        {formatNumber(cobro.importe, {
                                          kind: "money",
                                        })}
                                      </Link>
                                    </TableCell>
                                    {compare && (
                                      <TableCell className="text-right font-mono text-muted-foreground">
                                        <Link href={previousHref} className="hover:text-primary hover:underline">
                                          {formatNumber(cobro.importeAnterior, {
                                            kind: "money",
                                          })}
                                        </Link>
                                      </TableCell>
                                    )}
                                    {compare && (
                                      <TableCell className="text-right scale-90 origin-right">
                                        <Link href={currentHref} className="inline-flex hover:opacity-80">
                                          {renderVariation(
                                            cobro.variacionPorcentaje ?? null,
                                          )}
                                        </Link>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                  );
                                },
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    <div className="p-4 border-t bg-muted/10 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">
                          Base Facturada
                        </p>
                        <p className="text-lg font-bold text-sidebar mt-1">
                          {formatNumber(data.ivaFacturado.base, {
                            kind: "money",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">
                          IVA Facturado
                        </p>
                        <p className="text-lg font-bold text-sidebar mt-1">
                          {formatNumber(data.ivaFacturado.iva, {
                            kind: "money",
                          })}
                        </p>
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
                <CardDescription>
                  Acumulados de venta y cobro a nivel ubicación
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Tienda</TableHead>
                        <TableHead className="text-right">Cobrado</TableHead>
                        <TableHead className="text-right border-l">
                          Por Cobrar
                        </TableHead>
                        <TableHead className="text-right font-bold border-l">
                          Vendido
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.porTienda.map((t) => (
                        <TableRow key={t.ubicacionId}>
                          <TableCell className="font-bold flex items-center gap-2">
                            <Store className="w-4 h-4 text-muted-foreground" />
                            {t.nombreUbicacion}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(t.cobrado, { kind: "money" })}
                          </TableCell>
                          <TableCell className="text-right font-mono border-l text-muted-foreground">
                            {formatNumber(t.porCobrar, { kind: "money" })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-black border-l text-sidebar">
                            {formatNumber(t.vendido, { kind: "money" })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.porTienda.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground py-8"
                          >
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
