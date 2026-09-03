import { AppLayout } from "@/components/layout/app-layout";
import { useLocation, useParams, Link } from "wouter";
import {
  getListCajaTiendaVentasQueryKey,
  useListCajaTiendaVentas,
  ListCajaTiendaVentasFormaPago,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/table";
import { Loader2, AlertCircle, RefreshCw, Filter, ArrowLeft } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

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

export default function TiendaVentas() {
  const params = useParams();
  const ubicacionId = Number(params.ubicacionId);
  const isValidLocationId = Number.isInteger(ubicacionId) && ubicacionId > 0;
  const [, setLocationStr] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const todayStr = mexicoCityToday();

  const desde = searchParams.get("desde") || todayStr;
  const hasta = searchParams.get("hasta") || todayStr;
  const formaPago = readPaymentFilter(searchParams.get("formaPago"));
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

  const { data, isLoading, isError, error, refetch, isRefetching } = useListCajaTiendaVentas(ubicacionId, {
    desde,
    hasta,
    formaPago: apiFormaPago,
    page,
    pageSize
  }, {
    query: {
      enabled: isValidLocationId,
      queryKey: getListCajaTiendaVentasQueryKey(ubicacionId, {
        desde,
        hasta,
        formaPago: apiFormaPago,
        page,
        pageSize,
      }),
    },
  });
  const showUtility =
    data?.items.some((item) => "utilidad" in item) ?? false;

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
                Ventas de {data?.nombreUbicacion ?? `Tienda #${ubicacionId}`}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">Listado detallado de tickets para la tienda seleccionada.</p>
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

            <div className="flex items-center relative">
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
            </div>

            <Button variant="outline" size="icon" onClick={() => refetch()} title="Actualizar" disabled={isRefetching}>
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin text-primary" : ""}`} />
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : isError ? (
              <div className="p-10 text-center text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{getApiErrorMessage(error, "Error al cargar las ventas")}</p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>Reintentar</Button>
              </div>
            ) : data?.items.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-muted-foreground">
                 <p>No se encontraron ventas para los filtros seleccionados.</p>
                 <Button variant="outline" className="mt-4" onClick={() => updateFilters({ desde: null, hasta: null, formaPago: null })}>
                    Restablecer a hoy
                 </Button>
              </div>
            ) : (
              <div className="overflow-x-auto w-full custom-scrollbar">
                <Table className="w-full text-sm">
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
                    {data?.items.map(row => {
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
                          <TableCell className="text-right font-mono font-medium">
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
        </Card>

        {data && data.total > pageSize && (
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
                  Página {page} de {Math.ceil(data.total / pageSize)}
                </PaginationItem>

                <PaginationItem>
                  <Button
                    variant="outline"
                    className="gap-1 pr-2.5 h-9"
                    disabled={page >= Math.ceil(data.total / pageSize)}
                    onClick={() => updateFilters({ page: page + 1 })}
                  >
                    Siguiente
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
