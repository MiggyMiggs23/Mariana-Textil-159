import React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useLocation, useParams, Link } from "wouter";
import {
  getListCajaTiendaVentasQueryKey,
  useListCajaTiendaVentas,
  ListCajaTiendaVentasFormaPago,
  useGetCajaTiendaVentasGlobal,
  getGetCajaTiendaVentasGlobalQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Loader2, AlertCircle, RefreshCw, Filter, ArrowLeft, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { useQueryClient } from "@tanstack/react-query";

function mexicoCityToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readPaymentFilter(value: string | null): ListCajaTiendaVentasFormaPago | "all" {
  return Object.values(ListCajaTiendaVentasFormaPago).includes(
    value as ListCajaTiendaVentasFormaPago,
  )
    ? value as ListCajaTiendaVentasFormaPago
    : "all";
}

function mexicoCityDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function paymentLabel(value: string): string {
  return {
    EFECTIVO: "Efectivo",
    TRANSFERENCIA: "Transferencia",
    CREDITO: "Crédito",
    MIXTO: "Mixto",
    SIN_COBRO: "Sin cobro",
  }[value] ?? value;
}

function collectionStatusLabel(value: string): string {
  return {
    COBRADO: "Cobrado",
    CREDITO: "A crédito",
    PENDIENTE: "Pendiente",
  }[value] ?? value;
}

function GlobalTab({ ubicacionId, desde, hasta }: { ubicacionId: number, desde: string, hasta: string }) {
  const { data, isLoading, isError, error, refetch, isRefetching } = useGetCajaTiendaVentasGlobal(ubicacionId, { desde, hasta }, {
    query: {
      enabled: true,
      queryKey: getGetCajaTiendaVentasGlobalQueryKey(ubicacionId, { desde, hasta })
    }
  });

  const [expandedTelas, setExpandedTelas] = React.useState<Set<string>>(new Set());

  const toggleTela = (tela: string) => {
    setExpandedTelas(prev => {
      const next = new Set(prev);
      if (next.has(tela)) next.delete(tela);
      else next.add(tela);
      return next;
    });
  };

  const showImporte = data?.totalImporte !== undefined || data?.telas.some(t => t.importe !== undefined);
  const showUtilityRolls = data?.telas.some(t => t.utilityRollos !== undefined);
  const showUtilityMetered = data?.telas.some(t => t.utilityMetraje !== undefined);

  if (isLoading && !isRefetching) {
    return (
      <Card>
        <CardContent className="p-10 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-destructive">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{getApiErrorMessage(error, "Error al cargar el resumen global")}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.telas.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 flex flex-col items-center justify-center text-muted-foreground">
          <p>No se encontraron ventas para los filtros seleccionados.</p>
        </CardContent>
      </Card>
    );
  }

  const renderModalidades = (
    modalidades: Array<{ tipo: string; unidad: string; cantidad: string }>,
  ) => {
    if (!modalidades?.length) return "—";
    return (
      <div className="flex flex-col items-end gap-0.5">
        {modalidades.map((modalidad) => (
          <span key={`${modalidad.tipo}-${modalidad.unidad}`} className="whitespace-nowrap tabular-nums">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {modalidad.tipo === "NORMAL" ? "Rollos" : "Metraje"}:
            </span>{" "}
            {formatNumber(modalidad.cantidad, { kind: "quantity" })}{" "}
            <span className="text-[10px] text-muted-foreground">{formatUnit(modalidad.unidad)}</span>
          </span>
        ))}
      </div>
    );
  };

  const renderUtility = (
    value: string | null | undefined,
    status: string | undefined,
    excluded: number,
  ) => {
    if (status === "PENDIENTE") {
      return <span className="font-sans text-amber-700 dark:text-amber-400">Pendiente</span>;
    }
    if (value == null) return "—";
    return (
      <div className="flex items-center justify-end">
        {formatNumber(value, { kind: "money" })}
        {renderWarning(excluded)}
      </div>
    );
  };

  const renderWarning = (lineasSinCosto?: number) => {
    if (!lineasSinCosto) return null;
    return (
      <span title={`${lineasSinCosto} ${lineasSinCosto === 1 ? "línea" : "líneas"} sin costo asignado`} className="inline-flex ml-1.5 text-amber-500">
        <AlertTriangle className="w-3.5 h-3.5" />
      </span>
    );
  };

  return (
    <Card className={isRefetching ? "opacity-50 pointer-events-none transition-opacity duration-200" : ""}>
      <CardContent className="p-0">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <Table className="w-full text-sm min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 whitespace-nowrap">
                <TableHead className="w-8"></TableHead>
                <TableHead>Tela / Color</TableHead>
                <TableHead className="text-right">Cantidades</TableHead>
                <TableHead className="text-right">Operaciones</TableHead>
                {showImporte && <TableHead className="text-right">Importe</TableHead>}
                {showUtilityRolls && <TableHead className="text-right">Utilidad (Rollos)</TableHead>}
                {showUtilityMetered && <TableHead className="text-right">Utilidad (Metraje)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.telas.map(tela => (
                <React.Fragment key={tela.tela}>
                  <TableRow
                    className="bg-secondary/20 hover:bg-secondary/30 cursor-pointer border-b border-border/50"
                    onClick={() => toggleTela(tela.tela)}
                  >
                    <TableCell className="p-3">
                      {expandedTelas.has(tela.tela) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-bold py-3">
                      <Link href={`/inventario?search=${encodeURIComponent(tela.tela)}`} onClick={(e) => e.stopPropagation()} className="hover:underline text-foreground">
                        {tela.tela}
                      </Link>
                    </TableCell>
                    <TableCell className="py-3 pr-4">
                       {renderModalidades(tela.modalidades)}
                    </TableCell>
                    <TableCell className="text-right font-bold py-3">
                      {formatNumber(tela.operaciones, { kind: "count" })}
                    </TableCell>
                    {showImporte && (
                      <TableCell className="text-right font-mono font-medium py-3 text-foreground">
                        {tela.importe !== undefined ? formatNumber(tela.importe, { kind: "money" }) : "—"}
                      </TableCell>
                    )}
                    {showUtilityRolls && (
                      <TableCell className="text-right font-mono font-medium text-green-700 dark:text-green-500 py-3">
                         {renderUtility(
                           tela.utilityRollos,
                           tela.utilityRollosStatus,
                           tela.modalidades
                             .filter((item) => item.tipo === "NORMAL")
                             .reduce((sum, item) => sum + (item.lineasExcluidasSinCosto ?? 0), 0),
                         )}
                      </TableCell>
                    )}
                    {showUtilityMetered && (
                      <TableCell className="text-right font-mono font-medium text-green-700 dark:text-green-500 py-3">
                         {renderUtility(
                           tela.utilityMetraje,
                           tela.utilityMetrajeStatus,
                           tela.modalidades
                             .filter((item) => item.tipo === "METREADO")
                             .reduce((sum, item) => sum + (item.lineasExcluidasSinCosto ?? 0), 0),
                         )}
                      </TableCell>
                    )}
                  </TableRow>
                  {expandedTelas.has(tela.tela) && tela.colores.map((color, idx) => (
                    <TableRow key={color.color} className={idx === tela.colores.length - 1 ? "border-b-2 border-border/50" : "border-b-0"}>
                      <TableCell></TableCell>
                      <TableCell className="pl-6 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                          <span className="font-medium text-sm">
                            <Link href={`/inventario?search=${encodeURIComponent(tela.tela + ' ' + color.color)}`} className="hover:underline text-foreground">
                              {color.color}
                            </Link>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 pr-4">
                         {renderModalidades(color.modalidades)}
                      </TableCell>
                      <TableCell className="text-right py-2.5 tabular-nums">
                        {formatNumber(color.operaciones, { kind: "count" })}
                      </TableCell>
                      {showImporte && (
                        <TableCell className="text-right font-mono py-2.5 text-muted-foreground">
                          {color.importe !== undefined ? formatNumber(color.importe, { kind: "money" }) : "—"}
                        </TableCell>
                      )}
                      {showUtilityRolls && (
                        <TableCell className="text-right font-mono py-2.5 text-green-700/80 dark:text-green-500/80">
                           {renderUtility(
                             color.utilityRollos,
                             color.utilityRollosStatus,
                             color.modalidades
                               .filter((item) => item.tipo === "NORMAL")
                               .reduce((sum, item) => sum + (item.lineasExcluidasSinCosto ?? 0), 0),
                           )}
                        </TableCell>
                      )}
                      {showUtilityMetered && (
                        <TableCell className="text-right font-mono py-2.5 text-green-700/80 dark:text-green-500/80">
                           {renderUtility(
                             color.utilityMetraje,
                             color.utilityMetrajeStatus,
                             color.modalidades
                               .filter((item) => item.tipo === "METREADO")
                               .reduce((sum, item) => sum + (item.lineasExcluidasSinCosto ?? 0), 0),
                           )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter className="border-t-2 border-primary/40 bg-primary/10">
              <TableRow className="hover:bg-primary/10">
                <TableCell></TableCell>
                <TableCell className="whitespace-nowrap py-4 font-bold text-foreground">TOTALES</TableCell>
                <TableCell className="py-4 pr-4">
                   {renderModalidades(data.modalidades)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums text-foreground">
                  {formatNumber(data.totalOperaciones, { kind: "count" })}
                </TableCell>
                {showImporte && (
                  <TableCell className="text-right font-bold font-mono text-primary">
                    {data.totalImporte !== undefined ? formatNumber(data.totalImporte, { kind: "money" }) : "—"}
                  </TableCell>
                )}
                {showUtilityRolls && <TableCell></TableCell>}
                {showUtilityMetered && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {data.lineasExcluidasSinCosto !== undefined && (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            Ventas entregadas en {data.nombreUbicacion} del {desde} al {hasta}, agrupadas por tela y color;
            incluye ventas a crédito, excluye tickets cancelados y separa la utilidad de Rollos y Metraje.{" "}
            {formatNumber(data.lineasExcluidasSinCosto, { kind: "count" })}{" "}
            {data.lineasExcluidasSinCosto === 1 ? "línea quedó fuera" : "líneas quedaron fuera"} de la utilidad por no tener costo asignado.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TiendaVentas() {
  const params = useParams();
  const ubicacionId = Number(params.ubicacionId);
  const isValidLocationId = Number.isInteger(ubicacionId) && ubicacionId > 0;
  const [, setLocationStr] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const queryClient = useQueryClient();

  const todayStr = mexicoCityToday();

  const desde = searchParams.get("desde") || todayStr;
  const hasta = searchParams.get("hasta") || todayStr;
  const formaPago = readPaymentFilter(searchParams.get("formaPago"));
  const activeTab = searchParams.get("tab") === "detail" ? "detail" : "global";
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 50;

  const updateFilters = (updates: Record<string, string | number | null>) => {
    const newParams = new URLSearchParams(window.location.search);
    let changed = false;
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "all") {
        if (newParams.has(key)) {
          newParams.delete(key);
          changed = true;
        }
      } else {
        if (newParams.get(key) !== String(val)) {
          newParams.set(key, String(val));
          changed = true;
        }
      }
    }

    // Always reset to page 1 when changing filters, unless explicitly setting page
    if (!("page" in updates) && newParams.has("page")) {
        newParams.delete("page");
        changed = true;
    }

    if (changed) {
      setLocationStr(`${window.location.pathname}?${newParams.toString()}`);
    }
  };

  const apiFormaPago = formaPago !== "all" ? formaPago : undefined;

  const changeTab = (tab: string) => {
    const newParams = new URLSearchParams(window.location.search);
    if (tab === "detail") {
      newParams.set("tab", "detail");
    } else {
      newParams.delete("tab");
      newParams.delete("formaPago");
      newParams.delete("page");
    }
    const search = newParams.toString();
    const nextLocation = `${window.location.pathname}${search ? `?${search}` : ""}`;
    const currentLocation = `${window.location.pathname}${window.location.search}`;
    if (nextLocation !== currentLocation) setLocationStr(nextLocation);
  };

  const { data: detailData, isLoading: detailLoading, isError: detailIsError, error: detailError, refetch: detailRefetch, isRefetching: detailIsRefetching } = useListCajaTiendaVentas(ubicacionId, {
    desde,
    hasta,
    formaPago: apiFormaPago,
    page,
    pageSize
  }, {
    query: {
      enabled: isValidLocationId && activeTab === "detail",
      queryKey: getListCajaTiendaVentasQueryKey(ubicacionId, {
        desde,
        hasta,
        formaPago: apiFormaPago,
        page,
        pageSize,
      }),
    },
  });

  const handleRefresh = () => {
    if (activeTab === "detail") {
      detailRefetch();
    } else {
      queryClient.invalidateQueries({ queryKey: getGetCajaTiendaVentasGlobalQueryKey(ubicacionId, { desde, hasta }) });
    }
  };

  const showUtility =
    detailData?.items.some((item) => "utilidad" in item) ?? false;

  const titleLocationName = detailData?.nombreUbicacion ?? `Tienda #${ubicacionId}`;

  if (!isValidLocationId) {
    return (
      <AppLayout>
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-10 text-center text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>La tienda solicitada no es válida.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/caja/tiempo-real">Volver a Caja en Tiempo Real</Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" asChild className="-ml-2 h-8 w-8 text-muted-foreground hover:text-sidebar">
                <Link href="/caja/tiempo-real">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold tracking-tight text-sidebar">
                Ventas de {titleLocationName}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Consulta global por tela o el detalle de tickets para la tienda seleccionada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border">
              <Input
                type="date"
                value={desde}
                onChange={e => updateFilters({ desde: e.target.value })}
                className="h-8 text-sm bg-background border-none w-[130px]"
              />
              <span className="text-muted-foreground text-sm">-</span>
              <Input
                type="date"
                value={hasta}
                onChange={e => updateFilters({ hasta: e.target.value })}
                className="h-8 text-sm bg-background border-none w-[130px]"
              />
            </div>

            {activeTab === "detail" && <div className="flex items-center relative">
              <Filter className="w-4 h-4 absolute left-2.5 text-muted-foreground z-10" />
              <Select value={formaPago} onValueChange={v => updateFilters({ formaPago: v })}>
                <SelectTrigger className="w-[180px] h-9 bg-background pl-8">
                  <SelectValue placeholder="Forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las formas</SelectItem>
                  <SelectItem value={ListCajaTiendaVentasFormaPago.EFECTIVO}>Efectivo</SelectItem>
                  <SelectItem value={ListCajaTiendaVentasFormaPago.TRANSFERENCIA}>Transferencia</SelectItem>
                  <SelectItem value={ListCajaTiendaVentasFormaPago.CREDITO}>Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>}

            <Button variant="outline" size="icon" onClick={handleRefresh} title="Actualizar" disabled={activeTab === "detail" && detailIsRefetching}>
              <RefreshCw className={`h-4 w-4 ${activeTab === "detail" && detailIsRefetching ? "animate-spin text-primary" : ""}`} />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={changeTab}>
          <TabsList className="flex w-full flex-wrap sm:w-auto">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="detail">Detalle</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "global" ? (
          <GlobalTab ubicacionId={ubicacionId} desde={desde} hasta={hasta} />
        ) : <>
          <Card>
          <CardContent className="p-0">
            {detailLoading ? (
              <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : detailIsError ? (
              <div className="p-10 text-center text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{getApiErrorMessage(detailError, "Error al cargar las ventas")}</p>
                <Button variant="outline" className="mt-4" onClick={() => detailRefetch()}>Reintentar</Button>
              </div>
            ) : detailData?.items.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-muted-foreground">
                 <p>No se encontraron ventas para los filtros seleccionados.</p>
                 <Button variant="outline" className="mt-4" onClick={() => updateFilters({ desde: null, hasta: null, formaPago: null })}>
                    Restablecer a hoy
                 </Button>
              </div>
            ) : (
              <div className="overflow-x-auto w-full custom-scrollbar">
                <Table className="w-full text-sm min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 whitespace-nowrap">
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Folio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>F. Pago</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                       {showUtility && (
                        <TableHead className="text-right">Utilidad</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailData?.items.map(row => {
                      return (
                        <TableRow
                          key={row.id}
                          className="hover:bg-muted/50 transition-colors whitespace-nowrap"
                        >
                          <TableCell>
                            <span className="font-medium text-sidebar">
                               {mexicoCityDateTime(row.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-primary font-medium">
                            <Link href={`/tickets/${row.id}`} className="hover:underline">
                              {formatNumber(row.folio, { kind: "identifier" })}
                            </Link>
                          </TableCell>
                          <TableCell className="truncate max-w-[200px]" title={row.cliente}>
                            {row.cliente || "Sin cliente"}
                          </TableCell>
                          <TableCell>
                             {paymentLabel(row.formaPago)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${
                              row.estadoCobro === "COBRADO" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                              row.estadoCobro === "CREDITO" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}>
                               {collectionStatusLabel(row.estadoCobro)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-foreground">
                            {formatNumber(row.importe, { kind: "money" })}
                          </TableCell>
                           {showUtility && (
                            <TableCell className="text-right font-mono font-medium text-green-700 dark:text-green-500">
                                {row.utilidad === undefined || row.utilidad === null
                                  ? "—"
                                  : formatNumber(row.utilidad, { kind: "money" })}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {detailData && (
            <div className="border-t px-4 py-3 text-xs text-muted-foreground">
              Tickets vendidos en {detailData.nombreUbicacion} del {desde} al {hasta};
              {formaPago === "all"
                ? " incluye todas las formas de pago, también crédito,"
                : ` muestra solo ${paymentLabel(formaPago).toLowerCase()},`} y excluye tickets cancelados.
            </div>
          )}
          </Card>

          {detailData && detailData.total > pageSize && (
          <div className="mt-4 flex flex-col items-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    className="gap-1 pl-2.5 h-9"
                    disabled={page === 1}
                    onClick={() => updateFilters({ page: page - 1 })}
                  >
                    Anterior
                  </Button>
                </PaginationItem>

                {/* Simplified pagination logic for brevity, just showing current page text */}
                <PaginationItem className="px-4 text-sm text-muted-foreground">
                  Página {page} de {Math.ceil(detailData.total / pageSize)}
                </PaginationItem>

                <PaginationItem>
                  <Button
                    variant="outline"
                    className="gap-1 pr-2.5 h-9"
                    disabled={page >= Math.ceil(detailData.total / pageSize)}
                    onClick={() => updateFilters({ page: page + 1 })}
                  >
                    Siguiente
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
          )}
        </>}
      </div>
    </AppLayout>
  );
}