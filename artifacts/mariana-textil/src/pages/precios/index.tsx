import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListPrecios,
  useUpdatePrecioVentaPorMetro,
  useChangePreciosMasivo,
  getListPreciosQueryKey,
  UnidadProducto,
  SemaforoPrecio,
  PrecioProducto,
  ModoPrecio
} from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Lock, ChevronDown, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  countBelowCost,
  findDuplicateRawTelaSpellings,
  groupPricesByTela,
  isBulkSelectable,
} from "@/lib/precio-groups";

export default function PreciosList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unidad, setUnidad] = useState<string>("all");
  const [semaforo, setSemaforo] = useState<string>("all");
  const [sinPrecio, setSinPrecio] = useState(false);
  const [activeMode, setActiveMode] = useState<ModoPrecio>(ModoPrecio.ROLLO);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const queryParams = {
    search: debouncedSearch || undefined,
    unidad: unidad !== "all" ? (unidad as UnidadProducto) : undefined,
    semaforo: semaforo !== "all" ? (semaforo as SemaforoPrecio) : undefined,
    modoPrecio: activeMode,
    sinPrecio: sinPrecio || undefined,
  };

  const { data: precios, isLoading } = useListPrecios(queryParams, {
    query: {
      queryKey: getListPreciosQueryKey(queryParams)
    }
  });
  const updateVentaPorMetro = useUpdatePrecioVentaPorMetro();
  const changePreciosMasivo = useChangePreciosMasivo();

  const groups = useMemo(() => groupPricesByTela(precios ?? []), [precios]);
  const selectedProducts = useMemo(
    () => (precios ?? []).filter((product) => selectedIds.has(product.id)),
    [precios, selectedIds],
  );
  const numericBulkPrice = Number(bulkPrice);
  const isBulkValid =
    selectedIds.size > 0 &&
    selectedIds.size <= 200 &&
    Number.isFinite(numericBulkPrice) &&
    numericBulkPrice > 0 &&
    bulkReason.trim().length >= 5;
  const belowCostCount = isBulkValid
    ? countBelowCost(selectedProducts, activeMode, numericBulkPrice)
    : 0;

  // This is intentionally derived without a disruptive UI; it is also exported
  // as a testable data-quality report for duplicate stored tela spellings.
  const duplicateTelaSpellings = useMemo(
    () => findDuplicateRawTelaSpellings(precios ?? []),
    [precios],
  );

  useEffect(() => {
    if (debouncedSearch.trim()) {
      setExpandedGroups(new Set(groups.map((group) => group.key)));
    } else {
      setExpandedGroups(new Set());
    }
  }, [debouncedSearch, groups]);

  useEffect(() => {
    const visibleSelectableIds = new Set(
      (precios ?? [])
        .filter((product) => isBulkSelectable(product, activeMode))
        .map((product) => product.id),
    );
    setSelectedIds((current) => {
      const visibleSelection = new Set(
        [...current].filter((id) => visibleSelectableIds.has(id)),
      );
      return visibleSelection.size === current.size ? current : visibleSelection;
    });
  }, [precios, activeMode]);

  const changeMode = (mode: ModoPrecio) => {
    setActiveMode(mode);
    setSelectedIds(new Set());
    setConfirmationOpen(false);
  };

  const toggleProduct = (productId: number, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const toggleGroup = (products: PrecioProducto[], checked: boolean) => {
    const selectable = products.filter((product) =>
      isBulkSelectable(product, activeMode),
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const product of selectable) {
        if (checked) next.add(product.id);
        else next.delete(product.id);
      }
      return next;
    });
  };

  const resetBulkState = () => {
    setSelectedIds(new Set());
    setBulkPrice("");
    setBulkReason("");
    setConfirmationOpen(false);
  };

  const confirmBulkChange = () => {
    if (!isBulkValid) return;
    changePreciosMasivo.mutate(
      {
        data: {
          productoIds: [...selectedIds],
          precioListaNuevo: numericBulkPrice.toFixed(2),
          modoPrecio: activeMode,
          motivo: bulkReason.trim(),
        },
      },
      {
        onSuccess: ({ actualizados }) => {
          toast.success(`${actualizados} precios actualizados`);
          queryClient.invalidateQueries({ queryKey: getListPreciosQueryKey() });
          resetBulkState();
        },
        onError: (error: any) => {
          toast.error("No se pudieron actualizar los precios", {
            description: error?.data?.error ?? error?.message,
          });
        },
      },
    );
  };

  const setVentaPorMetro = (product: PrecioProducto, checked: boolean) => {
    if (product.unidad === UnidadProducto.KILO || product.unidad === UnidadProducto.PIEZA) {
      return;
    }
    const saleLabel =
      product.unidad === UnidadProducto.BOLSA
        ? "venta de bolsas sueltas"
        : "venta por metro";
    updateVentaPorMetro.mutate(
      { id: product.id, data: { seVendePorMetro: checked } },
      {
        onSuccess: () => {
          toast.success(
            checked
              ? `${saleLabel} habilitada`
              : `${saleLabel} deshabilitada`,
          );
          queryClient.invalidateQueries({ queryKey: getListPreciosQueryKey() });
        },
        onError: (error: any) => {
          toast.error("No se pudo actualizar el interruptor", {
            description: error?.data?.error ?? error?.message,
          });
        },
      },
    );
  };

  const getSemaforoBadge = (s: SemaforoPrecio) => {
    switch (s) {
      case SemaforoPrecio.VERDE:
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 px-1.5 py-0 h-5 text-[10px] whitespace-nowrap"><CheckCircle2 className="w-3 h-3 mr-1" /> Saludable</Badge>;
      case SemaforoPrecio.AMBAR:
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 px-1.5 py-0 h-5 text-[10px] whitespace-nowrap"><AlertTriangle className="w-3 h-3 mr-1" /> Precaución</Badge>;
      case SemaforoPrecio.ROJO:
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 px-1.5 py-0 h-5 text-[10px] whitespace-nowrap"><AlertOctagon className="w-3 h-3 mr-1" /> Crítico</Badge>;
      case SemaforoPrecio.SIN_COSTO:
        return <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800 px-1.5 py-0 h-5 text-[10px] whitespace-nowrap"><HelpCircle className="w-3 h-3 mr-1" /> Sin costo</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Precios</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Catálogo central de precios de lista y análisis de márgenes.
            </p>
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 px-4 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por SKU, tela o color..."
                  value={search}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearch(value);
                    if (!value) setDebouncedSearch("");
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && setDebouncedSearch(search)}
                  onBlur={() => setDebouncedSearch(search)}
                  className="pl-9 h-9 text-sm"
                  data-testid="input-search-precios"
                />
              </div>
              <div className="w-[160px]">
                <Select value={unidad} onValueChange={setUnidad}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-unidad">
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las uds.</SelectItem>
                    <SelectItem value={UnidadProducto.METRO}>{formatUnit(UnidadProducto.METRO)}</SelectItem>
                    <SelectItem value={UnidadProducto.KILO}>{formatUnit(UnidadProducto.KILO)}</SelectItem>
                    <SelectItem value={UnidadProducto.BOLSA}>{formatUnit(UnidadProducto.BOLSA)}</SelectItem>
                    <SelectItem value={UnidadProducto.PIEZA}>{formatUnit(UnidadProducto.PIEZA)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[180px]">
                <Select value={semaforo} onValueChange={setSemaforo}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-semaforo">
                    <SelectValue placeholder="Margen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value={SemaforoPrecio.VERDE}>Saludable (Verde)</SelectItem>
                    <SelectItem value={SemaforoPrecio.AMBAR}>Precaución (Ámbar)</SelectItem>
                    <SelectItem value={SemaforoPrecio.ROJO}>Crítico (Rojo)</SelectItem>
                    <SelectItem value={SemaforoPrecio.SIN_COSTO}>Sin costo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant={sinPrecio ? "default" : "outline"}
                size="sm"
                onClick={() => setSinPrecio((value) => !value)}
                aria-pressed={sinPrecio}
                className="h-9"
                data-testid="filter-sin-precio"
              >
                Sin precio
              </Button>
            </div>

            <div className="mt-3 border-t pt-3" data-testid="toolbar-precios-masivo">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Cambio masivo</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-selected-count">
                    {selectedIds.size} {selectedIds.size === 1 ? "color seleccionado" : "colores seleccionados"}
                  </p>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[140px_minmax(200px,1fr)_auto] lg:w-[600px] items-end">
                  <div className="space-y-1">
                    <Label htmlFor="bulk-price" className="text-[10px] uppercase font-semibold text-muted-foreground">Nuevo precio</Label>
                    <Input
                      id="bulk-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={bulkPrice}
                      onChange={(event) => setBulkPrice(event.target.value)}
                      disabled={selectedIds.size === 0}
                      placeholder="0.00"
                      className="h-8 text-sm"
                      data-testid="input-bulk-price"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bulk-reason" className="text-[10px] uppercase font-semibold text-muted-foreground">Motivo (mín. 5 car.)</Label>
                    <Input
                      id="bulk-reason"
                      value={bulkReason}
                      onChange={(event) => setBulkReason(event.target.value)}
                      disabled={selectedIds.size === 0}
                      placeholder="Motivo del cambio"
                      className="h-8 text-sm"
                      data-testid="input-bulk-reason"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={!isBulkValid}
                    onClick={() => setConfirmationOpen(true)}
                    data-testid="button-review-bulk-price"
                  >
                    Revisar
                  </Button>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Se aplicará a la modalidad <span className="font-semibold text-foreground">
                  {activeMode === ModoPrecio.ROLLO
                    ? "Precio por Rollo"
                    : activeMode === ModoPrecio.MAYOREO
                      ? "Mayoreo"
                      : "Menudeo"}
                </span>.
              </p>
            </div>

            <div className="pt-3 mt-1 border-t">
              <Tabs value={activeMode} onValueChange={(v) => changeMode(v as ModoPrecio)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md h-9">
                  <TabsTrigger value={ModoPrecio.ROLLO} className="text-xs">Precio por Rollo</TabsTrigger>
                  <TabsTrigger value={ModoPrecio.MAYOREO} className="text-xs">Mayoreo</TabsTrigger>
                  <TabsTrigger value={ModoPrecio.MENUDEO} className="text-xs">Menudeo</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {duplicateTelaSpellings.length > 0 && (
              <div
                className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                data-testid="text-duplicate-tela-spellings"
              >
                Variantes de nombre de producto detectadas:{" "}
                {duplicateTelaSpellings.map((duplicate) =>
                  duplicate.spellings.map((spelling) => `"${spelling}"`).join(" / ")
                ).join("; ")}.
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto rounded-b-lg border-t">
              <Table className="[&_td]:py-2 [&_td]:px-3 [&_th]:px-3 [&_th]:h-9 [&_th]:py-2 text-sm whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-[70px] text-center">Unidad</TableHead>
                    <TableHead className="w-[130px]">Venta fracc.</TableHead>
                    <TableHead className="text-right w-[180px]">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-semibold text-foreground">Costo base</span>
                        <span className="text-[9px] font-normal leading-tight text-muted-foreground whitespace-normal text-right w-full max-w-[160px]">
                          {activeMode === ModoPrecio.ROLLO
                            ? "Promedio ponderado en existencia"
                            : "Promedio simple recibidos (12m)"}
                        </span>
                      </div>
                    </TableHead>
                    <TableHead className="text-right w-[110px] font-semibold text-foreground">Precio Lista</TableHead>
                    <TableHead className="text-right w-[100px]">Margen $</TableHead>
                    <TableHead className="text-right w-[100px]">Margen %</TableHead>
                    <TableHead className="text-center w-[120px]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                        Cargando precios...
                      </TableCell>
                    </TableRow>
                  ) : !precios || precios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                        No se encontraron productos para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groups.map((group) => {
                      const selectableProducts = group.products.filter((product) =>
                        isBulkSelectable(product, activeMode),
                      );
                      const selectedInGroup = selectableProducts.filter((product) =>
                        selectedIds.has(product.id),
                      ).length;
                      const groupChecked =
                        selectableProducts.length > 0 &&
                        selectedInGroup === selectableProducts.length;
                      const groupIndeterminate =
                        selectedInGroup > 0 && selectedInGroup < selectableProducts.length;
                      const expanded = expandedGroups.has(group.key);
                      const missingPriceCount = group.products.filter(
                        (product) => product.preciosPorModo[activeMode].precioLista == null,
                      ).length;
                      const groupUnits = new Set(group.products.map((product) => product.unidad));
                      const groupUnit = groupUnits.size === 1
                        ? formatUnit(group.products[0]!.unidad)
                        : "Mixtas";

                      return (
                        <Fragment key={group.key}>
                          <TableRow className="bg-muted/40 font-medium hover:bg-muted/50" data-testid={`row-price-group-${group.key}`}>
                            <TableCell>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 text-left hover:text-primary p-1 -ml-1 rounded-md"
                                onClick={() =>
                                  setExpandedGroups((current) => {
                                    const next = new Set(current);
                                    if (next.has(group.key)) next.delete(group.key);
                                    else next.add(group.key);
                                    return next;
                                  })
                                }
                                aria-expanded={expanded}
                                data-testid={`button-toggle-price-group-${group.key}`}
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span className="sr-only">{expanded ? "Plegar" : "Desplegar"} {group.tela}</span>
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={groupIndeterminate ? "indeterminate" : groupChecked}
                                  disabled={selectableProducts.length === 0}
                                  onCheckedChange={(checked) => toggleGroup(group.products, checked === true)}
                                  aria-label={`Seleccionar colores visibles de ${group.tela}`}
                                  data-testid={`checkbox-price-group-${group.key}`}
                                />
                                <span className="font-semibold">{group.tela}</span>
                                <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px]">{group.products.length} colores</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-[11px] font-semibold text-muted-foreground uppercase">{groupUnit}</TableCell>
                            <TableCell className="text-center text-muted-foreground/50">—</TableCell>
                            {/* Group money/margin values are never aggregated or averaged:
                                doing so would imply a financially meaningful value across colors. */}
                            <TableCell className="text-right text-muted-foreground/50">—</TableCell>
                            <TableCell className="text-right text-muted-foreground/50">—</TableCell>
                            <TableCell className="text-right text-muted-foreground/50">—</TableCell>
                            <TableCell className="text-right text-muted-foreground/50">—</TableCell>
                            <TableCell>
                              <div className="flex justify-center" data-testid={`status-price-group-${group.key}`}>
                                {missingPriceCount > 0
                                  ? <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 px-1.5 py-0 h-5 text-[10px]">{missingPriceCount} sin precio</Badge>
                                  : <span className="text-muted-foreground/50">—</span>}
                              </div>
                            </TableCell>
                          </TableRow>
                          {expanded && group.products.map((precio) => {
                            const modeData = precio.preciosPorModo[activeMode];
                            const isLocked = !isBulkSelectable(precio, activeMode);

                            return (
                      <TableRow key={precio.id} className={!precio.activo ? "opacity-60" : "hover:bg-muted/20"}>
                        <TableCell className="font-mono text-[11px]">
                          <Link href={`/precios/${precio.id}?mode=${activeMode}`} className="text-primary hover:underline font-semibold" data-testid={`link-precio-${precio.sku}`}>
                            {precio.sku}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col leading-tight">
                            <span className="font-semibold text-foreground text-sm">{precio.tela}</span>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                              {isLocked ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex cursor-not-allowed">
                                        <Checkbox
                                          disabled
                                          checked={false}
                                          aria-label={`No se puede seleccionar ${precio.sku}`}
                                          data-testid={`checkbox-price-${precio.sku}`}
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {precio.unidad === UnidadProducto.KILO || precio.unidad === UnidadProducto.PIEZA
                                        ? `Los productos por ${precio.unidad === UnidadProducto.PIEZA ? "pieza" : "kilo"} no admiten este modo`
                                        : "Hay que encender la venta fraccionada primero"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Checkbox
                                  checked={selectedIds.has(precio.id)}
                                  onCheckedChange={(checked) => toggleProduct(precio.id, checked === true)}
                                  aria-label={`Seleccionar ${precio.tela} ${precio.color}`}
                                  data-testid={`checkbox-price-${precio.sku}`}
                                />
                              )}
                              <span>{precio.color}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-[11px] text-muted-foreground font-semibold uppercase">
                          {formatUnit(precio.unidad)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={
                                precio.unidad === UnidadProducto.KILO || precio.unidad === UnidadProducto.PIEZA
                                  ? false
                                  : precio.seVendePorMetro
                              }
                              disabled={
                                precio.unidad === UnidadProducto.KILO ||
                                precio.unidad === UnidadProducto.PIEZA ||
                                (updateVentaPorMetro.isPending &&
                                  updateVentaPorMetro.variables?.id === precio.id)
                              }
                              onCheckedChange={(checked) =>
                                setVentaPorMetro(precio, checked)
                              }
                              aria-label={`${precio.unidad === UnidadProducto.BOLSA ? "Venta de bolsas sueltas" : "Venta por metro"} de ${precio.tela} ${precio.color}`}
                              data-testid={`switch-venta-metro-${precio.sku}`}
                              className="scale-75 origin-left"
                            />
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {precio.unidad === UnidadProducto.KILO || precio.unidad === UnidadProducto.PIEZA
                                ? formatUnit(precio.unidad)
                                : precio.seVendePorMetro
                                  ? "Sí"
                                  : "No"}
                            </span>
                          </div>
                        </TableCell>

                        {isLocked ? (
                          <TableCell colSpan={5}>
                            <div className="flex items-center justify-center text-muted-foreground bg-muted/20 py-1.5 rounded border border-dashed border-border/50">
                              <Lock className="w-3.5 h-3.5 mr-1.5" />
                              <span className="text-xs font-medium">Bloqueado para este modo</span>
                            </div>
                          </TableCell>
                        ) : (
                          <>
                            <TableCell className="text-right text-muted-foreground">
                              {activeMode !== ModoPrecio.ROLLO ? (
                                precio.costoReferenciaMetreado.estado === 'NO_COST' ? (
                                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Sin costo</span>
                                ) : (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-sm font-medium">{modeData.costoUnitarioBase && Number(modeData.costoUnitarioBase) > 0 ? formatNumber(modeData.costoUnitarioBase, { kind: "money" }) : "—"}</span>
                                    {precio.costoReferenciaMetreado.esMayorA12Meses && (
                                      <span className="text-[9px] text-amber-600 font-semibold flex items-center gap-0.5 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Obsoleto (&gt;12m)
                                      </span>
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className="text-sm font-medium">
                                  {modeData.costoUnitarioBase && Number(modeData.costoUnitarioBase) > 0 ? formatNumber(modeData.costoUnitarioBase, { kind: "money" }) : "—"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {modeData.precioLista == null ? (
                                <span className="text-xs text-muted-foreground font-medium italic">Sin precio</span>
                              ) : (
                                <span className="text-sm font-bold text-foreground">
                                  {formatNumber(modeData.precioLista, { kind: "money" })}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold">
                                {modeData.margenPesosUnidad && Number(modeData.margenPesosUnidad) !== 0 ? formatNumber(modeData.margenPesosUnidad, { kind: "money" }) : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold">
                                {modeData.margenPorcentajeSubtotal && Number(modeData.margenPorcentajeSubtotal) !== 0 ? formatNumber(modeData.margenPorcentajeSubtotal, { kind: "percentage" }) : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {getSemaforoBadge(modeData.semaforo)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                            );
                          })}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirmar cambio masivo</DialogTitle>
              <DialogDescription>
                Se aplicará {formatNumber(numericBulkPrice || 0, { kind: "money" })} en modo {activeMode} a {selectedProducts.length} colores.
              </DialogDescription>
            </DialogHeader>

            {belowCostCount > 0 && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive"
                data-testid="warning-bulk-below-cost"
              >
                <div className="flex items-start gap-2 font-bold text-sm">
                  <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Confirmación explícita: {belowCostCount} {belowCostCount === 1 ? "color quedará" : "colores quedarán"} por debajo de su costo base.</span>
                </div>
                <p className="mt-1 text-xs ml-6">Revisa cuidadosamente antes de confirmar.</p>
              </div>
            )}

            <div className="space-y-2">
              {groupPricesByTela(selectedProducts).map((group) => (
                <div key={group.key} className="rounded-md border p-2">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="font-semibold text-[13px]">{group.tela}</span>
                    <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px]">{group.products.length} colores</Badge>
                  </div>
                  <ul className="space-y-0.5 text-[12px] text-muted-foreground">
                    {group.products.map((product) => (
                      <li key={product.id} className="flex justify-between gap-3">
                        <span>{product.color}</span>
                        <span className="font-mono">{product.sku}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmationOpen(false)}
                data-testid="button-cancel-bulk-price"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant={belowCostCount > 0 ? "destructive" : "default"}
                disabled={!isBulkValid || changePreciosMasivo.isPending}
                onClick={confirmBulkChange}
                data-testid="button-confirm-bulk-price"
              >
                {changePreciosMasivo.isPending ? "Actualizando..." : belowCostCount > 0 ? "Confirmar debajo del costo" : "Confirmar cambio"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
