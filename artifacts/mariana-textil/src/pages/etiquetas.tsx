import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Filter, History, Loader2, Printer, Search, Tags, X } from "lucide-react";
import {
  getGetCurrentUserQueryKey, getListLocationsQueryKey, getListProductosQueryKey, getListUsersQueryKey,
  useGetCurrentUser, useListLocations, useListProductos, useListUsers,
} from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { AppLayout } from "@/components/layout/app-layout";
import { LabelPrint } from "@/components/label-print";
import { ReprintLabelsDialog } from "@/components/reprint-labels-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { etiquetasApi, type EtiquetaRollo, type HistorialReimpresion } from "@/lib/etiquetas-api";
import { hasPermission, Modules } from "@/lib/permisos";
import { CampoEscaneo } from "@/components/campo-escaneo";
import {
  advertenciaSkuEscaneado,
  type CodigoEscaneadoInterpretado,
} from "@workspace/scanned-code";
import {
  toggleLabelSelection,
  updateVisibleLabelSelection,
} from "@/lib/label-selection";

const ESTADOS = ["DISPONIBLE", "VENDIDO", "MOSTRADOR", "EN_TRANSITO", "BAJA", "PROGRAMADO"];
const estadoClass: Record<string, string> = {
  DISPONIBLE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  VENDIDO: "bg-slate-100 text-slate-700 border-slate-200",
  MOSTRADOR: "bg-blue-100 text-blue-800 border-blue-200",
  EN_TRANSITO: "bg-amber-100 text-amber-800 border-amber-200",
  BAJA: "bg-red-100 text-red-800 border-red-200",
  PROGRAMADO: "bg-violet-100 text-violet-800 border-violet-200",
};

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" }).format(new Date(value));
}

export default function Etiquetas() {
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const isAdmin = user?.rol === "ADMIN";
  const canPrint = hasPermission(user, Modules.ETIQUETAS, "crear");
  const preselectedId = Number(new URLSearchParams(window.location.search).get("rolloId")) || undefined;
  const initialTab = new URLSearchParams(window.location.search).get("tab") === "historial" ? "historial" : "buscar";
  const fitReportEnabled = new URLSearchParams(window.location.search).get("fitReport") === "1";

  const [tab, setTab] = useState(initialTab);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [lastScannedCode, setLastScannedCode] =
    useState<CodigoEscaneadoInterpretado | null>(null);
  const [skuWarning, setSkuWarning] = useState<string | null>(null);
  const [sitioId, setSitioId] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [productoId, setProductoId] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [folioEntrada, setFolioEntrada] = useState("");
  const [selected, setSelected] = useState<Map<number, EtiquetaRollo>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);

  const [hDesde, setHDesde] = useState("");
  const [hHasta, setHHasta] = useState("");
  const [hSitio, setHSitio] = useState("todos");
  const [hUsuario, setHUsuario] = useState("todos");
  const [hProducto, setHProducto] = useState("todos");

  useEffect(() => {
    if (tab === "buscar") requestAnimationFrame(() => searchRef.current?.focus());
  }, [tab]);

  useEffect(() => {
    const restore = () => searchRef.current?.focus();
    window.addEventListener("focus", restore);
    return () => window.removeEventListener("focus", restore);
  }, []);

  const { data: locations } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const { data: products } = useListProductos(undefined, { query: { queryKey: getListProductosQueryKey() } });
  const { data: users } = useListUsers({ query: { enabled: isAdmin, queryKey: getListUsersQueryKey() } });

  const searchParams = {
    q: search,
    sitioId: sitioId === "todos" ? undefined : sitioId,
    estado: estado === "todos" ? undefined : estado,
    productoId: productoId === "todos" ? undefined : productoId,
    fechaDesde,
    fechaHasta,
    folio: folioEntrada,
  };
  const rollosQuery = useQuery({
    queryKey: ["etiquetas", "rollos", searchParams],
    queryFn: () => preselectedId && !search
      ? etiquetasApi.obtenerRollo(preselectedId).then((item) => ({ items: [item], total: 1 }))
      : etiquetasApi.buscar(searchParams),
    retry: false,
  });

  useEffect(() => {
    if (
      rollosQuery.isFetching ||
      !lastScannedCode?.serie ||
      lastScannedCode.serie !== search ||
      !rollosQuery.data
    ) {
      return;
    }
    const rollo = rollosQuery.data.items.find(
      (item) => item.serie === lastScannedCode.serie,
    );
    setSkuWarning(
      rollo ? advertenciaSkuEscaneado(lastScannedCode, rollo.sku) : null,
    );
    setLastScannedCode(null);
  }, [lastScannedCode, rollosQuery.data, rollosQuery.isFetching, search]);

  const handleSearchDraftChange = (value: string) => {
    setSearchDraft(value);
    setLastScannedCode(null);
    setSkuWarning(null);
  };

  const handleSearchScan = (
    value: string,
    codigo: CodigoEscaneadoInterpretado,
  ) => {
    setSearch(value.trim());
    setLastScannedCode(codigo.sku ? codigo : null);
    setSkuWarning(null);
  };

  const submitSearch = () => {
    setSearch(searchDraft.trim());
    setLastScannedCode(null);
    setSkuWarning(null);
  };

  useEffect(() => {
    const preselected = rollosQuery.data?.items.find((item) => item.id === preselectedId);
    if (preselected) {
      setSelected(new Map([[preselected.id, preselected]]));
    }
  }, [preselectedId, rollosQuery.data]);

  const historyParams = {
    fechaDesde: hDesde,
    fechaHasta: hHasta,
    sitioId: hSitio === "todos" ? undefined : hSitio,
    usuarioId: hUsuario === "todos" ? undefined : hUsuario,
    productoId: hProducto === "todos" ? undefined : hProducto,
  };
  const historyQuery = useQuery({
    queryKey: ["etiquetas", "historial", historyParams],
    queryFn: () => etiquetasApi.historial(historyParams),
    enabled: isAdmin && tab === "historial",
    retry: false,
  });

  const selectedRollos = useMemo(() => {
    return [...selected.values()];
  }, [selected]);

  const toggle = (id: number) => {
    const item = rollosQuery.data?.items.find((rollo) => rollo.id === id);
    if (!item) {
      toast({ title: "Etiqueta no disponible", description: "Actualiza los resultados e inténtalo de nuevo.", variant: "destructive" });
      return;
    }
    if (!selected.has(id) && selected.size >= 50) {
      toast({ title: "Límite alcanzado", description: "Puedes reimprimir un máximo de 50 etiquetas por operación.", variant: "destructive" });
      return;
    }
    setSelected(toggleLabelSelection(selected, item));
  };

  const openPrintDialog = (rollo?: EtiquetaRollo) => {
    if (rollo) setSelected(new Map([[rollo.id, rollo]]));
    setDialogOpen(true);
  };

  const exportHistory = async () => {
    try {
      const anchor = document.createElement("a");
      anchor.href = etiquetasApi.exportUrl(historyParams);
      anchor.download = "historial-reimpresiones.xlsx";
      anchor.click();
    } catch (error) {
      toast({ title: "No se pudo exportar", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const clearFilters = () => {
    setSitioId("todos"); setEstado("todos"); setProductoId("todos");
    setFechaDesde(""); setFechaHasta(""); setFolioEntrada("");
  };

  if (fitReportEnabled && products) {
    return <CatalogLabelFitReport products={products} />;
  }

  return (
    <AppLayout>
      <div className="no-print mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary"><Tags className="h-4 w-4" /> OPERACIÓN</div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Etiquetas</h1>
            <p className="mt-1 text-muted-foreground">Busca rollos y solicita reimpresiones con trazabilidad.</p>
          </div>
          <Button
            size="lg"
            onClick={() => openPrintDialog()}
            disabled={!canPrint || selected.size === 0}
          >
            <Printer className="mr-2 h-4 w-4" /> Reimprimir seleccionadas ({selected.size})
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="buscar"><Search className="mr-2 h-4 w-4" />Buscar rollos</TabsTrigger>
            {isAdmin && <TabsTrigger value="historial"><History className="mr-2 h-4 w-4" />Historial de reimpresiones</TabsTrigger>}
          </TabsList>

          <TabsContent value="buscar" className="space-y-5">
            <Card className="border-primary/20 shadow-sm">
              <CardContent className="pt-6">
                <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}>
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <CampoEscaneo ref={searchRef} value={searchDraft} onChange={handleSearchDraftChange}
                      onScan={handleSearchScan} clearOnScan={false}
                      className="h-14 pl-12 text-lg" containerClassName="w-full"
                      placeholder="Escanea QR o busca por serie, SKU, tela o color…" autoComplete="off" />
                  </div>
                  <Button className="h-14 px-6" type="submit">Buscar</Button>
                </form>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  <FilterSelect label="Sitio" value={sitioId} onChange={setSitioId}
                    items={(locations ?? []).map((x) => ({ value: String(x.id), label: x.nombre }))} />
                  <FilterSelect label="Estado" value={estado} onChange={setEstado}
                    items={ESTADOS.map((x) => ({ value: x, label: x.replace("_", " ") }))} />
                  <FilterSelect label="Producto" value={productoId} onChange={setProductoId}
                    items={(products ?? []).map((x) => ({ value: String(x.id), label: `${x.sku} · ${x.tela} ${x.color}` }))} />
                  <DateInput label="Alta desde" value={fechaDesde} onChange={setFechaDesde} />
                  <DateInput label="Alta hasta" value={fechaHasta} onChange={setFechaHasta} />
                  <div className="space-y-1.5"><Label>Folio de entrada</Label><Input value={folioEntrada} onChange={(e) => setFolioEntrada(e.target.value)} placeholder="Ej. 000123" /></div>
                </div>
                <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}><X className="mr-1 h-4 w-4" />Limpiar filtros</Button>
              </CardContent>
            </Card>

            {skuWarning && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Verifica la etiqueta</AlertTitle>
                <AlertDescription>{skuWarning}</AlertDescription>
              </Alert>
            )}
            {rollosQuery.isError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>No se pudieron cargar los rollos</AlertTitle><AlertDescription>{getApiErrorMessage(rollosQuery.error)}</AlertDescription></Alert>}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Resultados <span className="ml-2 text-sm font-normal text-muted-foreground">{formatNumber(rollosQuery.data?.total ?? 0, { kind: "count" })} rollos</span></CardTitle>
                <span className="text-sm text-muted-foreground">{selected.size}/50 seleccionados</span>
              </CardHeader>
              <CardContent className="p-0">
                {rollosQuery.isLoading ? <div className="grid place-items-center p-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> :
                !rollosQuery.data?.items.length ? <div className="p-16 text-center text-muted-foreground">No hay rollos que coincidan con la búsqueda.</div> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-10"><Checkbox aria-label="Seleccionar resultados" checked={rollosQuery.data.items.length > 0 && rollosQuery.data.items.every((x) => selected.has(x.id))}
                        onCheckedChange={(checked) => setSelected((current) => updateVisibleLabelSelection(current, rollosQuery.data.items, checked === true))} /></TableHead>
                      <TableHead>Serie</TableHead><TableHead>Producto</TableHead><TableHead>Color</TableHead><TableHead>SKU</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead><TableHead>Unidad</TableHead><TableHead>Sitio</TableHead>
                      <TableHead>Estado</TableHead><TableHead>Entrada</TableHead><TableHead className="text-right">Acción</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{rollosQuery.data.items.map((rollo) => (
                      <TableRow key={rollo.id} data-state={selected.has(rollo.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(rollo.id)} onCheckedChange={() => toggle(rollo.id)} aria-label={`Seleccionar ${rollo.serie}`} /></TableCell>
                        <TableCell className="font-mono font-bold">
                          <div className="flex items-center gap-2">{rollo.serie}{rollo.reimpresiones >= 3 && <span title={`${rollo.reimpresiones} reimpresiones`}><AlertTriangle className="h-4 w-4 text-amber-600" /></span>}</div>
                          {rollo.reimpresiones >= 3 && <span className="text-[10px] font-sans font-semibold text-amber-700">{rollo.reimpresiones} reimpresiones</span>}
                        </TableCell>
                        <TableCell className="max-w-56 font-medium">{rollo.producto || rollo.tela}</TableCell>
                        <TableCell>{rollo.color}</TableCell><TableCell className="font-mono text-xs">{rollo.sku}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatNumber(rollo.cantidad, { kind: "quantity" })}</TableCell>
                        <TableCell>{formatUnit(rollo.unidad)}</TableCell><TableCell>{rollo.sitio}</TableCell>
                        <TableCell><Badge variant="outline" className={estadoClass[rollo.estado]}>{rollo.estado.replace("_", " ")}</Badge></TableCell>
                        <TableCell>{rollo.entradaId ? <Link className="font-medium text-primary hover:underline" href={`/entradas/${rollo.entradaId}/documento`}>{rollo.entradaFolio ?? rollo.entradaId}</Link> : "—"}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" disabled={!canPrint} onClick={() => openPrintDialog(rollo)}><Printer className="mr-2 h-4 w-4" />Reimprimir etiqueta</Button></TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && <TabsContent value="historial" className="space-y-5">
            <Card><CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <DateInput label="Desde" value={hDesde} onChange={setHDesde} /><DateInput label="Hasta" value={hHasta} onChange={setHHasta} />
                <FilterSelect label="Sitio" value={hSitio} onChange={setHSitio} items={(locations ?? []).map((x) => ({ value: String(x.id), label: x.nombre }))} />
                <FilterSelect label="Usuario" value={hUsuario} onChange={setHUsuario} items={(users ?? []).map((x) => ({ value: String(x.id), label: x.nombre }))} />
                <FilterSelect label="Producto" value={hProducto} onChange={setHProducto} items={(products ?? []).map((x) => ({ value: String(x.id), label: `${x.tela} ${x.color}` }))} />
              </div>
            </CardContent></Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>Historial de reimpresiones</CardTitle><Button variant="outline" onClick={exportHistory}><Download className="mr-2 h-4 w-4" />Exportar a Excel</Button></CardHeader>
              <CardContent className="p-0"><HistoryTable loading={historyQuery.isLoading} items={historyQuery.data?.items ?? []} /></CardContent>
            </Card>
          </TabsContent>}
        </Tabs>
      </div>

      <ReprintLabelsDialog
        rolloIds={selectedRollos.map((rollo) => rollo.id)}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setSelected(new Map());
          queryClient.invalidateQueries({ queryKey: ["etiquetas"] });
        }}
      />
    </AppLayout>
  );
}

type FitReportProduct = {
  id: number;
  sku: string;
  tela: string;
  color: string;
  unidad: string;
};

function CatalogLabelFitReport({ products }: { products: FitReportProduct[] }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<{
    steps: Record<string, number>;
    overflows: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const inspect = async () => {
      await document.fonts?.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.dispatchEvent(new Event("beforeprint"));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled || !reportRef.current) return;
      const names = [...reportRef.current.querySelectorAll<HTMLElement>('[data-testid="label-product-name"]')];
      const allFields = [...reportRef.current.querySelectorAll<HTMLElement>("[data-fit-state]")];
      const steps: Record<string, number> = {};
      for (const name of names) {
        const step = name.dataset.fontStep ?? "sin medir";
        steps[step] = (steps[step] ?? 0) + 1;
      }
      const overflows = allFields
        .filter((field) => field.dataset.fitState !== "fits")
        .map((field) => field.textContent?.trim() || "(texto vacío)");
      setSummary({ steps, overflows });
    };
    void inspect();
    return () => {
      cancelled = true;
    };
  }, [products]);

  return (
    <AppLayout>
      <div ref={reportRef} className="mx-auto max-w-[1500px] space-y-6 p-6" data-testid="catalog-label-fit-report">
        <header className="rounded-lg border bg-white p-5">
          <h1 className="text-2xl font-bold">Reporte renderizado de ajuste de etiquetas</h1>
          <p>{products.length} productos del catálogo · todos los campos AutoFitText medidos con la fuente cargada.</p>
          {!summary ? (
            <p role="status">Midiendo…</p>
          ) : (
            <div data-testid="catalog-label-fit-summary">
              <p>Escalones del nombre: {Object.entries(summary.steps).sort(([a], [b]) => Number(b) - Number(a)).map(([step, count]) => `${step}px: ${count}`).join(" · ")}</p>
              <p className={summary.overflows.length ? "font-bold text-destructive" : "font-bold text-emerald-700"}>
                Sin caber al mínimo: {summary.overflows.length}
              </p>
              {summary.overflows.length > 0 && <ul>{summary.overflows.map((text, index) => <li key={`${text}-${index}`}>{text}</li>)}</ul>}
            </div>
          )}
        </header>
        <div className="grid gap-4 xl:grid-cols-2">
          {products.map((product) => (
            <LabelPrint
              key={product.id}
              data={{
                sku: product.sku,
                serie: String(product.id).padStart(7, "0").slice(-7),
                tela: product.tela,
                color: product.color,
                cantidad: "9999999.999",
                unidad: product.unidad,
              }}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function FilterSelect({ label, value, onChange, items }: { label: string; value: string; onChange: (value: string) => void; items: Array<{ value: string; label: string }> }) {
  return <div className="min-w-0 space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function HistoryTable({ loading, items }: { loading: boolean; items: HistorialReimpresion[] }) {
  if (loading) return <div className="grid place-items-center p-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!items.length) return <div className="p-16 text-center text-muted-foreground">No hay reimpresiones en este periodo.</div>;
  return <Table><TableHeader><TableRow><TableHead>Fecha y hora</TableHead><TableHead>Serie</TableHead><TableHead>Producto</TableHead><TableHead>Sitio</TableHead><TableHead>Solicitó</TableHead><TableHead>Autorizó</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
    <TableBody>{items.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap">{formatDate(item.createdAt, true)}</TableCell><TableCell className="font-mono font-bold">{item.rolloId ? <Link href={`/inventario/rollos/${item.rolloId}`} className="text-primary hover:underline">{item.serie}</Link> : item.serie}</TableCell><TableCell>{item.producto}</TableCell><TableCell>{item.sitio}</TableCell><TableCell>{item.solicito}</TableCell><TableCell>{item.autorizo || "—"}</TableCell><TableCell className="max-w-sm">{item.motivo}</TableCell></TableRow>)}</TableBody>
  </Table>;
}