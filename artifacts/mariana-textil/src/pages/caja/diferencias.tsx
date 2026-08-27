import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetAdminDiferencias,
  GetAdminDiferenciasAgrupacion,
  AdminDiferenciaGroup
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
import { Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ComposedChart, Bar } from "recharts";
import { AlertCircle, RefreshCw, Loader2, ArrowUpDown } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { format, subDays, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { getApiErrorMessage } from "@/lib/api-error";

type SortKey = "nombre" | "cortes" | "exactos" | "porcentajeExactos" | "diferencia";

export default function CajaDiferencias({ embedded = false }: { embedded?: boolean }) {
  const { selectedLocationId } = useLocationScope();

  const [preset, setPreset] = useState("mes"); // hoy, semana, mes, trimestre, semestre, año, custom
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(new Date(), "yyyy-MM-dd"));
  const [agrupacion, setAgrupacion] = useState<GetAdminDiferenciasAgrupacion>(GetAdminDiferenciasAgrupacion.semana);
  const [umbralCorte, setUmbralCorte] = useState("0");
  const [umbralTienda, setUmbralTienda] = useState("0");

  const [sortKeyCajero, setSortKeyCajero] = useState<SortKey>("diferencia");
  const [sortAscCajero, setSortAscCajero] = useState(true);

  const [sortKeyTienda, setSortKeyTienda] = useState<SortKey>("diferencia");
  const [sortAscTienda, setSortAscTienda] = useState(true);

  const { data, isLoading, isError, error, refetch } = useGetAdminDiferencias({
    desde,
    hasta,
    ubicacionId: selectedLocationId ?? undefined,
    umbralCorte: umbralCorte ? Number(umbralCorte) : undefined,
    umbralTienda: umbralTienda ? Number(umbralTienda) : undefined,
    agrupacion
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

  const sortData = (items: AdminDiferenciaGroup[], key: SortKey, asc: boolean) => {
    return [...items].sort((a, b) => {
      let valA: string | number = a[key as keyof AdminDiferenciaGroup] as string | number;
      let valB: string | number = b[key as keyof AdminDiferenciaGroup] as string | number;
      if (key === "porcentajeExactos" || key === "diferencia") {
        valA = Number(valA);
        valB = Number(valB);
      }
      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });
  };

  const sortedCajeros = useMemo(() => sortData(data?.porCajero || [], sortKeyCajero, sortAscCajero), [data, sortKeyCajero, sortAscCajero]);
  const sortedTiendas = useMemo(() => sortData(data?.porTienda || [], sortKeyTienda, sortAscTienda), [data, sortKeyTienda, sortAscTienda]);

  const handleSort = (type: "cajero" | "tienda", key: SortKey) => {
    if (type === "cajero") {
      if (sortKeyCajero === key) setSortAscCajero(!sortAscCajero);
      else { setSortKeyCajero(key); setSortAscCajero(true); }
    } else {
      if (sortKeyTienda === key) setSortAscTienda(!sortAscTienda);
      else { setSortKeyTienda(key); setSortAscTienda(true); }
    }
  };

  const SortableHead = ({ type, label, sortName, align = "left" }: { type: "cajero"| "tienda", label: string, sortName: SortKey, align?: "left" | "right" }) => (
    <TableHead className={`${align === "right" ? "text-right" : ""} cursor-pointer hover:bg-muted/60 select-none`} onClick={() => handleSort(type, sortName)}>
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label} <ArrowUpDown className="w-3 h-3 opacity-50" />
      </div>
    </TableHead>
  );

  const content = (
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-primary" />
              Control de Diferencias
            </h1>
            <p className="text-sm text-muted-foreground">Análisis de sobrantes y faltantes de caja, exactitud y alertas operativas.</p>
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

            <Select value={agrupacion} onValueChange={(v: GetAdminDiferenciasAgrupacion) => setAgrupacion(v)}>
              <SelectTrigger className="w-[120px] h-9 bg-background">
                <SelectValue placeholder="Agrupar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mes</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Umbral Corte:</span>
              <Input type="number" min="0" value={umbralCorte} onChange={e => setUmbralCorte(e.target.value)} className="h-9 w-20 text-right" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Umbral Tienda:</span>
              <Input type="number" min="0" value={umbralTienda} onChange={e => setUmbralTienda(e.target.value)} className="h-9 w-20 text-right" />
            </div>

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
            <p className="font-semibold">{getApiErrorMessage(error, "No se pudo cargar la información de diferencias")}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Intentar de nuevo</Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in">
            {/* Alertas Severas */}
            {data.alertas.length > 0 && (
              <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-lg space-y-2">
                <div className="flex items-center gap-2 text-destructive font-bold">
                  <AlertCircle className="h-5 w-5" />
                  Alertas de Descuadre Significativo
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {data.alertas.map((alerta, i) => (
                    <div key={i} className="bg-white dark:bg-black/20 p-3 rounded-md shadow-sm border border-destructive/10 text-sm">
                      <p className="font-semibold">{alerta.mensaje}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-muted-foreground text-xs font-mono">Corte #{alerta.sesionId}</span>
                        <span className="font-bold font-mono text-destructive">{formatNumber(alerta.importe, { kind: "money" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPIs Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Cortes Exactos</p>
                  <div className="flex items-end gap-2 mt-2">
                    <h2 className="text-3xl font-black text-sidebar">
                      {formatNumber(data.resumen.porcentajeExactos, { kind: "percentage", percentageInput: "percent" })}
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.resumen.exactos} de {data.resumen.cortes} cortes sin diferencia
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Impacto Faltantes</p>
                  <div className="flex items-end gap-2 mt-2">
                    <h2 className="text-3xl font-black text-destructive">{formatNumber(data.resumen.importeFaltantes, { kind: "money" })}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-destructive/80 font-medium">
                    En {data.resumen.faltantes} cortes con faltante
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Impacto Sobrantes</p>
                  <div className="flex items-end gap-2 mt-2">
                    <h2 className="text-3xl font-black text-amber-600">{formatNumber(data.resumen.importeSobrantes, { kind: "money" })}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-amber-600/80 font-medium">
                    En {data.resumen.sobrantes} cortes con sobrante
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-sidebar text-sidebar-foreground border-none shadow-md">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-sidebar-foreground/70">Diferencia Neta (Periodo)</p>
                  <div className="flex items-end gap-2 mt-2">
                    <h2 className={`text-3xl font-black ${Number(data.resumen.diferenciaNeta) < 0 ? "text-red-400" : "text-white"}`}>
                      {Number(data.resumen.diferenciaNeta) > 0 ? "+" : ""}{formatNumber(data.resumen.diferenciaNeta, { kind: "money" })}
                    </h2>
                  </div>
                  <p className="text-xs text-sidebar-foreground/70 mt-1">
                    Absoluta (descuadre total): {formatNumber(data.resumen.diferenciaAbsoluta, { kind: "money" })}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tendencia */}
            {data.tendencia.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Tendencia de Diferencia Neta</CardTitle>
                    <CardDescription>Diferencias operativas por {agrupacion}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{ importe: { label: "Diferencia neta", color: "hsl(var(--sidebar-primary))" } }}
                      className="h-[300px] w-full"
                    >
                      <ComposedChart data={data.tendencia.map(d => ({
                        fecha: d.fecha,
                        importe: Number(d.importe),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
                        <XAxis dataKey="fecha" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} width={60} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent valueKind="money" />} />
                        <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1} opacity={0.3} />
                        <Bar
                          dataKey="importe"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Porcentaje de Exactitud</CardTitle>
                    <CardDescription>Cortes sin diferencias por {agrupacion}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        porcentajeExactos: { label: "Exactitud", color: "hsl(var(--chart-2))" },
                      }}
                      className="h-[300px] w-full"
                    >
                      <ComposedChart data={data.tendencia.map(d => ({
                        fecha: d.fecha,
                        porcentajeExactos: Number(d.porcentajeExactos),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
                        <XAxis dataKey="fecha" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(value) => formatNumber(value, { kind: "percentage", percentageInput: "percent" })}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          tick={{ fontSize: 11 }}
                        />
                        <ChartTooltip content={
                          <ChartTooltipContent
                            valueKind="percentage"
                            formatter={(value) => formatNumber(
                              Number(Array.isArray(value) ? value[0] : value),
                              { kind: "percentage", percentageInput: "percent" },
                            )}
                          />
                        } />
                        <Line
                          type="monotone"
                          dataKey="porcentajeExactos"
                          name="Exactitud"
                          stroke="var(--color-porcentajeExactos)"
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Agrupaciones */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Diferencias por Cajero</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto w-full custom-scrollbar">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <SortableHead type="cajero" label="Cajero" sortName="nombre" />
                          <SortableHead type="cajero" label="Cortes" sortName="cortes" align="right" />
                          <SortableHead type="cajero" label="Exactos" sortName="exactos" align="right" />
                          <SortableHead type="cajero" label="% Exactitud" sortName="porcentajeExactos" align="right" />
                          <SortableHead type="cajero" label="Diferencia Neta" sortName="diferencia" align="right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCajeros.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.nombre}</TableCell>
                            <TableCell className="text-right">{row.cortes}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{row.exactos}</TableCell>
                            <TableCell className="text-right">
                              {Number(row.porcentajeExactos) >= 90 ? (
                                <span className="text-green-600 font-bold">{formatNumber(row.porcentajeExactos, { kind: "percentage", percentageInput: "percent" })}</span>
                              ) : Number(row.porcentajeExactos) <= 50 ? (
                                <span className="text-destructive font-bold">{formatNumber(row.porcentajeExactos, { kind: "percentage", percentageInput: "percent" })}</span>
                              ) : (
                                <span className="font-medium">{formatNumber(row.porcentajeExactos, { kind: "percentage", percentageInput: "percent" })}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              <span className={Number(row.diferencia) < 0 ? "text-destructive" : Number(row.diferencia) > 0 ? "text-amber-600" : ""}>
                                {Number(row.diferencia) > 0 ? "+" : ""}{formatNumber(row.diferencia, { kind: "money" })}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {sortedCajeros.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin datos</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Diferencias por Tienda</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto w-full custom-scrollbar">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <SortableHead type="tienda" label="Tienda" sortName="nombre" />
                          <SortableHead type="tienda" label="Cortes" sortName="cortes" align="right" />
                          <SortableHead type="tienda" label="Exactos" sortName="exactos" align="right" />
                          <SortableHead type="tienda" label="% Exactitud" sortName="porcentajeExactos" align="right" />
                          <SortableHead type="tienda" label="Diferencia Neta" sortName="diferencia" align="right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTiendas.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.nombre}</TableCell>
                            <TableCell className="text-right">{row.cortes}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{row.exactos}</TableCell>
                            <TableCell className="text-right">
                              {Number(row.porcentajeExactos) >= 90 ? (
                                <span className="text-green-600 font-bold">{formatNumber(row.porcentajeExactos, { kind: "percentage", percentageInput: "percent" })}</span>
                              ) : Number(row.porcentajeExactos) <= 50 ? (
                                <span className="text-destructive font-bold">{formatNumber(row.porcentajeExactos, { kind: "percentage", percentageInput: "percent" })}</span>
                              ) : (
                                <span className="font-medium">{formatNumber(row.porcentajeExactos, { kind: "percentage", percentageInput: "percent" })}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              <span className={Number(row.diferencia) < 0 ? "text-destructive" : Number(row.diferencia) > 0 ? "text-amber-600" : ""}>
                                {Number(row.diferencia) > 0 ? "+" : ""}{formatNumber(row.diferencia, { kind: "money" })}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {sortedTiendas.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin datos</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
  );
  return embedded ? content : <AppLayout>{content}</AppLayout>;
}
