import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListAdminCortes,
  useGetAdminCorte,
  exportAdminCortesXlsx,
  exportAdminCortesPdf,
  getGetAdminCorteQueryKey,
  useListUsers,
  Role,
  User
} from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
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
  TableFooter
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, FileText, Loader2, AlertCircle, RefreshCw, Filter, Search, ArrowUpDown } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import CorteDetail from "@/pages/corte-detail-shared";

type SortKey = "fecha" | "tienda" | "cajero" | "vendido" | "cobrado" | "tickets" | "esperado" | "contado" | "diferencia";

export default function CajaCortes() {
  const { selectedLocationId } = useLocationScope();
  const { toast } = useToast();

  const [desde, setDesde] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(new Date(), "yyyy-MM-dd"));
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Filters
  const [cajeroIdFilter, setCajeroIdFilter] = useState<string>("all");
  const [numeroCorte, setNumeroCorte] = useState("");
  const [soloConDiferencia, setSoloConDiferencia] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortAsc, setSortAsc] = useState(false);

  const [selectedCorteId, setSelectedCorteId] = useState<number | null>(null);

  const { data: usersData } = useListUsers();
  const cashiers = (usersData || []).filter((u: User) => u.rol === Role.CAJA);

  // Debounced filters for API if needed, or just exact match
  const { data, isLoading, isError, error, refetch } = useListAdminCortes({
    desde,
    hasta,
    ubicacionId: selectedLocationId ?? undefined,
    numeroCorte: numeroCorte ? Number(numeroCorte) : undefined,
    soloConDiferencia: soloConDiferencia || undefined,
    cajeroId: cajeroIdFilter !== "all" ? Number(cajeroIdFilter) : undefined,
    page,
    pageSize
  });

  const {
    data: corteDetail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailApiError,
    refetch: refetchDetail
  } = useGetAdminCorte(selectedCorteId || 0, {
    query: {
      enabled: !!selectedCorteId,
      queryKey: getGetAdminCorteQueryKey(selectedCorteId || 0)
    }
  });

  const handleExportXlsx = async () => {
    try {
      const blob = await exportAdminCortesXlsx({
        desde,
        hasta,
        ubicacionId: selectedLocationId ?? undefined,
        cajeroId: cajeroIdFilter !== "all" ? Number(cajeroIdFilter) : undefined,
        numeroCorte: numeroCorte ? Number(numeroCorte) : undefined,
        soloConDiferencia: soloConDiferencia || undefined
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cortes-${desde}-a-${hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Error al exportar", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const blob = await exportAdminCortesPdf({
        desde,
        hasta,
        ubicacionId: selectedLocationId ?? undefined,
        cajeroId: cajeroIdFilter !== "all" ? Number(cajeroIdFilter) : undefined,
        numeroCorte: numeroCorte ? Number(numeroCorte) : undefined,
        soloConDiferencia: soloConDiferencia || undefined
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cortes-${desde}-a-${hasta}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Error al exportar", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortableHead = ({ label, sortName, align = "left" }: { label: string, sortName: SortKey, align?: "left" | "right" }) => (
    <TableHead className={`${align === "right" ? "text-right" : ""} cursor-pointer hover:bg-muted/60 select-none`} onClick={() => handleSort(sortName)}>
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label} <ArrowUpDown className="w-3 h-3 opacity-50" />
      </div>
    </TableHead>
  );

  const sortedItems = useMemo(() => {
    if (!data?.items) return [];
    let items = [...data.items];

    items.sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;
      switch (sortKey) {
        case "fecha": valA = new Date(a.abiertaAt).getTime(); valB = new Date(b.abiertaAt).getTime(); break;
        case "tienda": valA = a.nombreUbicacion; valB = b.nombreUbicacion; break;
        case "cajero": valA = a.nombreUsuario; valB = b.nombreUsuario; break;
        case "tickets": valA = a.ticketsCobrados; valB = b.ticketsCobrados; break;
        case "vendido": valA = Number(a.vendido || 0); valB = Number(b.vendido || 0); break;
        case "cobrado": valA = Number(a.totalCobrado || 0); valB = Number(b.totalCobrado || 0); break;
        case "esperado": valA = Number(a.efectivoEsperado || 0); valB = Number(b.efectivoEsperado || 0); break;
        case "contado": valA = Number(a.efectivoContado || 0); valB = Number(b.efectivoContado || 0); break;
        case "diferencia": valA = Number(a.diferencia || 0); valB = Number(b.diferencia || 0); break;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return items;
  }, [data?.items, sortKey, sortAsc]);

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar">Historial de Cortes</h1>
            <p className="text-sm text-muted-foreground">Listado de cortes de caja, arqueos y diferencias operativas.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border">
              <Input
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                className="h-8 text-sm bg-background border-none w-[130px]"
              />
              <span className="text-muted-foreground text-sm">-</span>
              <Input
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                className="h-8 text-sm bg-background border-none w-[130px]"
              />
            </div>

            <div className="flex items-center relative">
              <Search className="w-4 h-4 absolute left-2.5 text-muted-foreground" />
              <Input
                placeholder="Corte #"
                value={numeroCorte}
                onChange={e => setNumeroCorte(e.target.value)}
                className="h-9 w-24 pl-8"
              />
            </div>

            <div className="flex items-center relative">
              <Filter className="w-4 h-4 absolute left-2.5 text-muted-foreground z-10" />
              <Select value={cajeroIdFilter} onValueChange={setCajeroIdFilter}>
                <SelectTrigger className="w-[180px] h-9 bg-background pl-8">
                  <SelectValue placeholder="Cajero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los cajeros</SelectItem>
                  {cashiers.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant={soloConDiferencia ? "default" : "outline"}
              size="sm"
              onClick={() => setSoloConDiferencia(!soloConDiferencia)}
              className={soloConDiferencia ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300" : ""}
            >
              Con Diferencia
            </Button>

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

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : isError ? (
              <div className="p-10 text-center text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{getApiErrorMessage(error, "Error al cargar cortes")}</p>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">No se encontraron cortes que coincidan con la búsqueda.</div>
            ) : (
              <div className="overflow-x-auto w-full custom-scrollbar">
                <Table className="w-full text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 whitespace-nowrap">
                      <TableHead className="w-[60px]">ID</TableHead>
                      <SortableHead label="Apertura" sortName="fecha" />
                      <TableHead>Cierre</TableHead>
                      <SortableHead label="Sitio" sortName="tienda" />
                      <SortableHead label="Cajero" sortName="cajero" />
                      <SortableHead label="Tck" sortName="tickets" align="right" />
                      <SortableHead label="Vendido" sortName="vendido" align="right" />
                      <SortableHead label="Cobrado" sortName="cobrado" align="right" />
                      <SortableHead label="Ef. Esperado" sortName="esperado" align="right" />
                      <SortableHead label="Ef. Contado" sortName="contado" align="right" />
                      <SortableHead label="Diferencia" sortName="diferencia" align="right" />
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedItems.map(row => {
                      const dif = Number(row.diferencia || 0);
                      const isDescuadre = dif !== 0 && row.estado === "CERRADA";
                      return (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap"
                          onClick={() => setSelectedCorteId(row.id)}
                        >
                          <TableCell className="font-mono text-muted-foreground text-[10px]">#{row.id}</TableCell>
                          <TableCell>
                            <span className="font-medium text-sidebar">
                              {format(new Date(row.abiertaAt), "dd/MM/yy HH:mm", { locale: es })}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.cerradaAt ? format(new Date(row.cerradaAt), "dd/MM/yy HH:mm", { locale: es }) : "—"}
                          </TableCell>
                          <TableCell className="font-medium truncate max-w-[120px]" title={row.nombreUbicacion}>{row.nombreUbicacion}</TableCell>
                          <TableCell className="truncate max-w-[120px]" title={row.nombreUsuario}>{row.nombreUsuario}</TableCell>
                          <TableCell className="text-right">{formatNumber(row.ticketsCobrados, { kind: "count" })}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatNumber(row.vendido, { kind: "money" })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-green-700 dark:text-green-500">
                            {formatNumber(row.totalCobrado, { kind: "money" })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {formatNumber(row.efectivoEsperado, { kind: "money" })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {row.estado === "ABIERTA" ? "—" : formatNumber(row.efectivoContado || "0", { kind: "money" })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.estado === "ABIERTA" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className={isDescuadre ? (dif < 0 ? "text-destructive font-bold" : "text-amber-600 font-bold") : "text-green-600 font-medium"}>
                                {dif > 0 ? "+" : ""}{formatNumber(row.diferencia || "0", { kind: "money" })}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold ${row.estado === "ABIERTA" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                              {row.estado}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {data?.totales && (
                    <TableFooter>
                      <TableRow className="whitespace-nowrap">
                        <TableCell colSpan={5} className="font-bold">Total Acumulado (Página Actual)</TableCell>
                        <TableCell className="text-right font-bold">{formatNumber(data.totales.tickets, { kind: "count" })}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-muted-foreground">{formatNumber(data.totales.vendido, { kind: "money" })}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-700 dark:text-green-500">{formatNumber(data.totales.cobrado, { kind: "money" })}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-muted-foreground">{formatNumber(data.totales.efectivoEsperado, { kind: "money" })}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatNumber(data.totales.efectivoContado, { kind: "money" })}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          <span className={Number(data.totales.diferencia) < 0 ? "text-destructive" : Number(data.totales.diferencia) > 0 ? "text-amber-600" : ""}>
                            {Number(data.totales.diferencia) > 0 ? "+" : ""}{formatNumber(data.totales.diferencia, { kind: "money" })}
                          </span>
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {data && Math.ceil(data.total / (pageSize || 50)) > 1 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              Mostrando página {page} de {Math.ceil(data.total / (pageSize || 50))} ({data.total} cortes)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / (pageSize || 50))}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selectedCorteId} onOpenChange={(open) => !open && setSelectedCorteId(null)}>
        <DialogContent className="max-w-4xl max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Corte #{selectedCorteId}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : detailError ? (
            <div className="py-10 text-center text-destructive">
              <p>{getApiErrorMessage(detailApiError, "Error al cargar detalle")}</p>
              <Button variant="outline" className="mt-4" onClick={() => refetchDetail()}>Reintentar</Button>
            </div>
          ) : corteDetail ? (
            <CorteDetail corte={corteDetail} />
          ) : null}

          <DialogFooter>
            <Button onClick={() => setSelectedCorteId(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}