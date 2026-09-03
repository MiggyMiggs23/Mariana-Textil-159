import { useState, useMemo, useEffect, useRef } from "react";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Link } from "wouter";
import {
  useListProductos,
  useCreateProducto,
  useGetCurrentUser,
  usePreviewImportProductos,
  useConfirmImportProductos,
  getListProductosQueryKey,
  getGetCurrentUserQueryKey,
  Producto,
  UnidadProducto,
  ImportPreviewRow,
  ImportPreviewRowEstado,
  ListProductosExistencia
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, Plus, Upload, Search, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { hasPermission, Modules } from "@/lib/permisos";

function getErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) return "Error desconocido";
  const apiError = error as { data?: unknown; message?: unknown };
  if (
    typeof apiError.data === "object" &&
    apiError.data !== null &&
    "error" in apiError.data &&
    typeof (apiError.data as { error?: unknown }).error === "string"
  ) {
    return (apiError.data as { error: string }).error;
  }
  return typeof apiError.message === "string" ? apiError.message : "Error desconocido";
}

/** Visual hint only; the API allocates the authoritative collision-safe SKU. */
export function generateSkuPreview(tela: string, color: string) {
  if (!tela || !color) return "";
  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const telaWords = normalize(tela).trim().split(/\s+/).slice(0, 3);
  let telaPart = telaWords.map(w => {
    if (/^\d+$/.test(w)) return w;
    return w.replace(/[^A-Z0-9]/g, "").substring(0, 3);
  }).join("");
  telaPart = telaPart.substring(0, 12);
  const colorPart = normalize(color).trim().replace(/[^A-Z0-9]/g, "").substring(0, 3);
  return `${telaPart}-${colorPart}`;
}

// Substring matching highlighter
function HighlightMatch({ text, search }: { text: string; search: string }) {
  if (!search.trim()) return <>{text}</>;

  // Escape search term for regex
  const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeSearch})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-300/80 dark:bg-yellow-600/50 rounded-sm text-foreground px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function Productos() {
  const queryClient = useQueryClient();

  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const [filterExistencia, setFilterExistencia] = useHistoryEntryState<ListProductosExistencia>("productos.existencia", ListProductosExistencia.TODOS);

  const queryParams = useMemo(() => ({
    existencia: filterExistencia !== "TODOS" ? filterExistencia : undefined
  }), [filterExistencia]);

  const { data: productos, isLoading } = useListProductos(queryParams, {
    query: { queryKey: getListProductosQueryKey(queryParams) }
  });

  const [searchTerm, setSearchTerm] = useHistoryEntryState("productos.search", "");
  const [filterUnidad, setFilterUnidad] = useHistoryEntryState("productos.unidad", "ALL");
  const [filterEstado, setFilterEstado] = useHistoryEntryState("productos.estado", "ACTIVE");
  const [visibleSpecificationColumns, setVisibleSpecificationColumns] = useHistoryEntryState<Set<string>>("productos.spec-columns", () => new Set());

  const toggleSpecificationColumn = (column: string) => {
    setVisibleSpecificationColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  };

  const [expandedTelas, setExpandedTelas] = useHistoryEntryState<Set<string>>("productos.expanded-telas", () => {
    try {
      const stored = sessionStorage.getItem("expandedTelas");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    sessionStorage.setItem("expandedTelas", JSON.stringify(Array.from(expandedTelas)));
  }, [expandedTelas]);

  const filteredProducts = useMemo(() => {
    if (!productos) return [];
    return productos.filter((p) => {
      const search = searchTerm.toLowerCase();
      const matchSearch = !search ||
        p.tela.toLowerCase().includes(search) ||
        p.color.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search);
      const matchUnidad = filterUnidad === "ALL" || p.unidad === filterUnidad;
      const matchEstado = filterEstado === "ALL" || (filterEstado === "ACTIVE" ? p.activo : !p.activo);
      return matchSearch && matchUnidad && matchEstado;
    });
  }, [productos, searchTerm, filterUnidad, filterEstado]);

  const grouped = useMemo(() => {
    const groups: Record<string, Producto[]> = {};
    filteredProducts.forEach(p => {
      if (!groups[p.tela]) groups[p.tela] = [];
      groups[p.tela].push(p);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProducts]);

  const toggleGroup = (tela: string) => {
    setExpandedTelas(prev => {
      const next = new Set(prev);
      if (next.has(tela)) next.delete(tela);
      else next.add(tela);
      return next;
    });
  };

  const handleExpandAll = () => setExpandedTelas(new Set(grouped.map(g => g[0])));
  const handleCollapseAll = () => setExpandedTelas(new Set());

  // Search auto-expand
  useEffect(() => {
    if (searchTerm.length >= 2) {
      setExpandedTelas(prev => {
        const next = new Set(prev);
        grouped.forEach(([tela]) => next.add(tela));
        return next;
      });
    }
  }, [searchTerm, grouped]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTelaPreFill, setCreateTelaPreFill] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);

  const openCreate = (tela?: string) => {
    setCreateTelaPreFill(tela || "");
    setIsCreateOpen(true);
  };

  const canCreate = hasPermission(user, Modules.PRODUCTOS, "crear");
  const isSupervisor = user?.rol === "SUPERVISOR";
  const canViewPrices = user != null && !isSupervisor;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Catálogo de Productos</h1>
            <p className="text-muted-foreground mt-2">
              Gestión de telas, colores, SKUs e inventario general.
            </p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setIsImportOpen(true)} className="flex-1 sm:flex-none" data-testid="button-import">
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </Button>
              <Button onClick={() => openCreate()} className="flex-1 sm:flex-none" data-testid="button-create-product">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Producto
              </Button>
            </div>
          )}
        </div>

        <Card>
          <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center bg-muted/20">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tela, color o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full bg-background"
                data-testid="input-search-product"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Select value={filterExistencia} onValueChange={(v: ListProductosExistencia) => setFilterExistencia(v)}>
                <SelectTrigger className="w-[150px] bg-background" data-testid="filter-existencia">
                  <SelectValue placeholder="Existencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ListProductosExistencia.TODOS}>Todos los prod.</SelectItem>
                  <SelectItem value={ListProductosExistencia.CON_EXISTENCIA}>Con existencia</SelectItem>
                  <SelectItem value={ListProductosExistencia.AGOTADOS}>Agotados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterUnidad} onValueChange={setFilterUnidad}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las unid.</SelectItem>
                  <SelectItem value={UnidadProducto.METRO}>{formatUnit(UnidadProducto.METRO)}</SelectItem>
                  <SelectItem value={UnidadProducto.KILO}>{formatUnit(UnidadProducto.KILO)}</SelectItem>
                  <SelectItem value={UnidadProducto.BOLSA}>{formatUnit(UnidadProducto.BOLSA)}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Activos</SelectItem>
                  <SelectItem value="INACTIVE">Inactivos</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                <span className="text-xs text-muted-foreground">Columnas:</span>
                {[
                  ["anchoCm", "Ancho"],
                  ["composicion", "Composición"],
                  ["gramajeGm2", "Gramaje"],
                ].map(([column, label]) => (
                  <label key={column} className="flex items-center gap-1 text-xs cursor-pointer">
                    <Checkbox
                      checked={visibleSpecificationColumns.has(column)}
                      onCheckedChange={() => toggleSpecificationColumn(column)}
                      data-testid={`checkbox-product-column-${column}`}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center animate-pulse">
                <div className="h-8 bg-muted rounded w-1/3 mx-auto mb-4"></div>
                <div className="h-64 bg-muted rounded w-full"></div>
              </div>
            ) : grouped.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>No se encontraron productos que coincidan con la búsqueda.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/10 text-sm">
                  <span className="text-muted-foreground font-medium">{filteredProducts.length} productos en {grouped.length} telas</span>
                  <div className="space-x-4">
                    <button onClick={handleExpandAll} className="text-primary hover:underline font-medium" data-testid="button-expand-all">Expandir todo</button>
                    <button onClick={handleCollapseAll} className="text-primary hover:underline font-medium" data-testid="button-collapse-all">Colapsar todo</button>
                  </div>
                </div>

                <div className="w-full">
                  {grouped.map(([tela, groupProducts]) => {
                    const isExpanded = expandedTelas.has(tela);
                    const totalsByUnit = groupProducts.reduce((totals, product) => {
                      const current = totals.get(product.unidad) ?? { rollos: 0, cantidad: 0 };
                      current.rollos += product.rollos;
                      current.cantidad += Number(product.cantidad);
                      totals.set(product.unidad, current);
                      return totals;
                    }, new Map<string, { rollos: number; cantidad: number }>());

                    return (
                      <div key={tela} className="border-b last:border-0">
                        <div
                          className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer select-none transition-colors"
                          onClick={() => toggleGroup(tela)}
                          data-testid={`row-tela-group-${tela}`}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                            <span className="font-bold text-foreground text-lg">
                              <HighlightMatch text={tela} search={searchTerm} />
                            </span>
                            <Badge variant="secondary" className="ml-2">{groupProducts.length} colores</Badge>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="hidden lg:flex items-center gap-2">
                              {[...totalsByUnit.entries()].map(([unidad, total]) => (
                                <Badge key={unidad} variant="outline" data-testid={`total-tela-${tela}-${unidad}`}>
                                  {formatNumber(total.cantidad, { kind: "quantity" })} {formatUnit(unidad)}
                                  <span className="ml-1 text-muted-foreground">
                                    · {formatNumber(total.rollos, { kind: "count" })} {unidad === UnidadProducto.BOLSA ? "cajas" : "rollos"}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                            {canCreate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 z-10 hidden md:flex"
                                onClick={(e) => { e.stopPropagation(); openCreate(tela); }}
                              >
                                <Plus className="w-4 h-4 mr-1" /> Color
                              </Button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-muted/5 p-0">
                            <Table>
                              <TableHeader className="bg-transparent">
                                <TableRow className="hover:bg-transparent border-b-muted">
                                  <TableHead className="w-[100px]">Color</TableHead>
                                  <TableHead>SKU</TableHead>
                                  <TableHead>Unidad</TableHead>
                                   {visibleSpecificationColumns.has("anchoCm") && <TableHead className="text-right">Ancho</TableHead>}
                                   {visibleSpecificationColumns.has("composicion") && <TableHead>Composición</TableHead>}
                                   {visibleSpecificationColumns.has("gramajeGm2") && <TableHead className="text-right">Gramaje</TableHead>}
                                  {canViewPrices && <TableHead className="text-right">Precio</TableHead>}
                                  <TableHead className="text-right">Rollos</TableHead>
                                  <TableHead className="text-right">Cantidad</TableHead>
                                  <TableHead className="text-right">Sitios</TableHead>
                                  <TableHead className="text-right">Estado</TableHead>
                                   {user?.rol === "ADMIN" && <TableHead className="text-right">Acciones</TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupProducts.map(p => {
                                  const isZeroStock = p.rollos === 0 && parseFloat(p.cantidad) === 0;
                                  return (
                                  <TableRow
                                    key={p.id}
                                    className={`transition-colors ${isZeroStock ? "opacity-60 bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/40"}`}
                                    data-testid={`row-product-${p.id}`}
                                  >
                                    <TableCell className="font-semibold text-sidebar">
                                      <Link
                                        href={`/productos/${p.id}`}
                                        className="text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        data-testid={`link-product-${p.id}`}
                                      >
                                        <HighlightMatch text={p.color} search={searchTerm} />
                                      </Link>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                      <HighlightMatch text={p.sku} search={searchTerm} />
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-[10px]">{formatUnit(p.unidad)}</Badge>
                                    </TableCell>
                                    {visibleSpecificationColumns.has("anchoCm") && <TableCell className="text-right">{p.anchoCm == null ? "—" : `${p.anchoCm.toFixed(2)} cm`}</TableCell>}
                                    {visibleSpecificationColumns.has("composicion") && <TableCell>{p.composicion || "—"}</TableCell>}
                                    {visibleSpecificationColumns.has("gramajeGm2") && <TableCell className="text-right">{p.gramajeGm2 == null ? "—" : `${p.gramajeGm2.toFixed(2)} g/m²`}</TableCell>}
                                    {canViewPrices && <TableCell className={`text-right ${isZeroStock ? "text-muted-foreground" : ""}`}>{p.precioSugerido == null ? "Sin precio" : formatNumber(p.precioSugerido, { kind: "money" })}</TableCell>}
                                    <TableCell className={`text-right font-medium ${isZeroStock ? "text-muted-foreground" : ""}`}>{formatNumber(p.rollos, { kind: "count" })}</TableCell>
                                    <TableCell className={`text-right font-medium tabular-nums ${isZeroStock ? "text-muted-foreground" : ""}`}>
                                       {formatNumber(p.cantidad, { kind: "quantity" })} <span className="text-[10px] font-normal text-muted-foreground">{formatUnit(p.unidad)}</span>
                                    </TableCell>
                                    <TableCell className={`text-right font-medium ${isZeroStock ? "text-muted-foreground" : ""}`}>{formatNumber(p.sitiosConExistencia, { kind: "count" })}</TableCell>
                                    <TableCell className="text-right">
                                      <Badge variant={p.activo ? "default" : "secondary"} className={p.activo ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20" : ""}>
                                        {p.activo ? "Activo" : "Inactivo"}
                                      </Badge>
                                    </TableCell>
                                     {user?.rol === "ADMIN" && (
                                       <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                       </TableCell>
                                     )}
                                  </TableRow>
                                )})}
                                {canCreate && (
                                  <TableRow>
                                     <TableCell colSpan={8 + visibleSpecificationColumns.size} className="p-2">
                                      <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-primary h-8" onClick={() => openCreate(tela)}>
                                        <Plus className="w-4 h-4 mr-2" /> Agregar color a {tela}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {productos && (
        <CreateProductDialog
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          initialTela={createTelaPreFill}
          existingProducts={productos}
          canViewPrices={canViewPrices}
        />
      )}

      <ImportProductsDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        canViewPrices={canViewPrices}
      />
    </AppLayout>
  );
}

function CreateProductDialog({ open, onClose, initialTela, existingProducts, canViewPrices }: { open: boolean, onClose: () => void, initialTela: string, existingProducts: Producto[], canViewPrices: boolean }) {
  const createProducto = useCreateProducto();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    sku: string;
    isCustomSku: boolean;
    tela: string;
    color: string;
    unidad: UnidadProducto;
    precioSugerido: string;
    notas: string;
    anchoCm: string;
    composicion: string;
    gramajeGm2: string;
  }>({
    sku: "",
    isCustomSku: false,
    tela: initialTela || "",
    color: "",
    unidad: UnidadProducto.METRO,
    precioSugerido: "",
    notas: "",
    anchoCm: "",
    composicion: "",
    gramajeGm2: "",
  });

  useEffect(() => {
    if (open) {
      const inherited = initialTela
        ? existingProducts.find((product) => product.tela === initialTela)
        : undefined;
      setFormData({
        sku: "",
        isCustomSku: false,
        tela: initialTela || "",
        color: "",
        unidad: inherited?.unidad ?? UnidadProducto.METRO,
        precioSugerido: inherited?.precioSugerido ?? "",
        notas: "",
        anchoCm: inherited?.anchoCm == null ? "" : String(inherited.anchoCm),
        composicion: inherited?.composicion ?? "",
        gramajeGm2: inherited?.gramajeGm2 == null ? "" : String(inherited.gramajeGm2),
      });
    }
  }, [open, initialTela, existingProducts]);

  const uniqueTelas = useMemo(() => Array.from(new Set(existingProducts.map(p => p.tela))), [existingProducts]);
  const uniqueColors = useMemo(() => Array.from(new Set(existingProducts.map(p => p.color))), [existingProducts]);

  const autoSku = useMemo(() => generateSkuPreview(formData.tela, formData.color), [formData.tela, formData.color]);
  const displaySku = formData.isCustomSku ? formData.sku : autoSku;

  const handleSubmit = () => {
    if (!formData.tela.trim() || !formData.color.trim()) {
      toast.error("Datos incompletos", { description: "La tela y el color son obligatorios." });
      return;
    }

    createProducto.mutate({
      data: {
        tela: formData.tela.trim(),
        color: formData.color.trim(),
        unidad: formData.unidad,
        precioSugerido: formData.precioSugerido === "" ? null : formData.precioSugerido,
        notas: formData.notas.trim() || null,
        anchoCm: formData.anchoCm === "" ? null : Number(formData.anchoCm),
        composicion: formData.composicion.trim() || null,
        gramajeGm2: formData.gramajeGm2 === "" ? null : Number(formData.gramajeGm2),
        sku: formData.isCustomSku && formData.sku.trim() ? formData.sku.trim() : undefined
      }
    }, {
      onSuccess: () => {
        toast.success("Producto creado exitosamente");
        queryClient.invalidateQueries({ queryKey: getListProductosQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        toast.error("Error al crear producto", { description: getErrorMessage(err) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nuevo Producto</DialogTitle>
          <DialogDescription>
            Agrega una nueva combinación de tela y color al catálogo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tela</Label>
              <Input
                list="telas-list"
                value={formData.tela}
                onChange={e => setFormData({ ...formData, tela: e.target.value.toUpperCase() })}
                placeholder="Ej. GABARDINA"
                data-testid="input-product-tela"
              />
              <datalist id="telas-list">
                {uniqueTelas.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                list="colors-list"
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value.toUpperCase() })}
                placeholder="Ej. AZUL MARINO"
                data-testid="input-product-color"
              />
              <datalist id="colors-list">
                {uniqueColors.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidad de Medida</Label>
              <Select value={formData.unidad} onValueChange={(v: UnidadProducto) => setFormData({ ...formData, unidad: v })}>
                <SelectTrigger data-testid="select-product-unidad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UnidadProducto.METRO}>{formatUnit(UnidadProducto.METRO)}</SelectItem>
                  <SelectItem value={UnidadProducto.KILO}>{formatUnit(UnidadProducto.KILO)}</SelectItem>
                  <SelectItem value={UnidadProducto.BOLSA}>{formatUnit(UnidadProducto.BOLSA)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canViewPrices && (
              <div className="space-y-2">
                <Label>Precio Sugerido (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precioSugerido}
                  onChange={e => setFormData({ ...formData, precioSugerido: e.target.value })}
                  data-testid="input-product-precio"
                />
              </div>
            )}
          </div>

          <div className="space-y-2 p-3 bg-muted/30 border rounded-md">
            <div className="flex items-center justify-between">
              <Label>SKU del Producto</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="custom-sku"
                  checked={formData.isCustomSku}
                  onCheckedChange={(c) => setFormData({ ...formData, isCustomSku: c === true, sku: c === true ? autoSku : "" })}
                  data-testid="checkbox-custom-sku"
                />
                <Label htmlFor="custom-sku" className="text-xs cursor-pointer font-normal">Personalizar</Label>
              </div>
            </div>
            {formData.isCustomSku ? (
              <Input
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder={autoSku}
                className="font-mono text-sm uppercase"
                data-testid="input-custom-sku"
              />
            ) : (
              <div className="h-9 px-3 flex items-center bg-muted/50 rounded-md border border-dashed font-mono text-sm text-sidebar font-semibold">
                {displaySku || <span className="text-muted-foreground/50 font-normal">Esperando tela y color...</span>}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Vista previa no autoritativa. El servidor asignará el SKU definitivo y resolverá colisiones al guardar.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Especificaciones (opcionales)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="input-product-ancho">Ancho (cm)</Label>
                <Input id="input-product-ancho" type="number" step="0.01" min="0" value={formData.anchoCm} onChange={e => setFormData({ ...formData, anchoCm: e.target.value })} data-testid="input-product-ancho" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="input-product-gramaje">Gramaje (g/m²)</Label>
                <Input id="input-product-gramaje" type="number" step="0.01" min="0" value={formData.gramajeGm2} onChange={e => setFormData({ ...formData, gramajeGm2: e.target.value })} data-testid="input-product-gramaje" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-product-composicion">Composición</Label>
              <Input id="input-product-composicion" value={formData.composicion} onChange={e => setFormData({ ...formData, composicion: e.target.value })} placeholder='Ej. 100% poliéster' data-testid="input-product-composicion" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (Opcional)</Label>
            <Input
              value={formData.notas}
              onChange={e => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Información adicional del producto..."
              data-testid="input-product-notas"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createProducto.isPending} data-testid="button-save-product">
            {createProducto.isPending ? "Guardando..." : "Guardar Producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportProductsDialog({ open, onClose, canViewPrices }: { open: boolean, onClose: () => void, canViewPrices: boolean }) {
  const queryClient = useQueryClient();
  const previewImport = usePreviewImportProductos();
  const confirmImport = useConfirmImportProductos();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [previewData, setPreviewData] = useState<ImportPreviewRow[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setSelectedContent("");
      setPreviewData(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewData(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result?.toString().split(',')[1];
      if (base64) {
        setSelectedContent(base64);
        previewImport.mutate({
          data: { fileName: file.name, content: base64 }
        }, {
          onSuccess: (data) => setPreviewData(data),
          onError: (err: any) => {
            toast.error("Error al procesar archivo", { description: getErrorMessage(err) || "Formato inválido" });
            setSelectedFile(null);
            setSelectedContent("");
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (!previewData || !selectedFile || !selectedContent) return;
    confirmImport.mutate({
      data: { fileName: selectedFile.name, content: selectedContent }
    }, {
      onSuccess: (res) => {
        toast.success("Importación completada", {
          description: `${res.insertados} insertados, ${res.duplicados} omitidos, ${res.errores} errores.`
        });
        queryClient.invalidateQueries({ queryKey: getListProductosQueryKey() });
        onClose();
      },
      onError: (err: any) => {
        toast.error("Error en la importación", { description: getErrorMessage(err) });
      }
    });
  };

  const hasErrors = previewData?.some(r => r.estado === ImportPreviewRowEstado.ERROR) || false;
  const isPending = previewImport.isPending || confirmImport.isPending;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Productos (Excel/CSV)</DialogTitle>
          <DialogDescription>
            Columnas requeridas: <strong>tela</strong>, <strong>color</strong>, <strong>unidad</strong>. <br/>
            <span className="text-xs text-muted-foreground">
              (Opcional: {canViewPrices && <>precio_sugerido, </>}notas)
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {!previewData && (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center flex flex-col items-center justify-center bg-muted/10 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              data-testid="input-file-dropzone"
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileUpload}
              />
              {previewImport.isPending ? (
                <div className="animate-pulse flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-medium">Analizando archivo...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground mb-4" />
                  <p className="text-sm font-medium text-foreground mb-1">Haz clic o arrastra un archivo aquí</p>
                  <p className="text-xs text-muted-foreground">Soporta .xlsx y .csv</p>
                </>
              )}
            </div>
          )}

          {previewData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-md text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Package className="w-4 h-4 text-sidebar" />
                  <span>{selectedFile?.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="text-emerald-600">{previewData.filter(r => r.estado === ImportPreviewRowEstado.NUEVO).length} Nuevos</span>
                  <span className="text-amber-600">{previewData.filter(r => r.estado === ImportPreviewRowEstado.DUPLICADO).length} Duplicados</span>
                  <span className="text-destructive">{previewData.filter(r => r.estado === ImportPreviewRowEstado.ERROR).length} Errores</span>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12 text-center">Fila</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 100).map((row, i) => (
                      <TableRow key={i} className={
                        row.estado === ImportPreviewRowEstado.ERROR ? "bg-destructive/5" :
                        row.estado === ImportPreviewRowEstado.DUPLICADO ? "bg-amber-500/5 text-amber-900" :
                        "bg-emerald-500/5"
                      }>
                        <TableCell className="text-center text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{row.tela} - {row.color}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatUnit(row.unidad)}
                            {canViewPrices && <> | {row.precioSugerido == null ? "Sin precio" : formatNumber(row.precioSugerido, { kind: "money" })}</>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.sku || "Auto"}</TableCell>
                        <TableCell>
                          {row.estado === ImportPreviewRowEstado.ERROR ? (
                            <div className="flex items-center text-destructive text-xs font-medium">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {row.error}
                            </div>
                          ) : row.estado === ImportPreviewRowEstado.DUPLICADO ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-100">Duplicado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-100">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Nuevo
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {previewData.length > 100 && (
                <p className="text-center text-xs text-muted-foreground">Mostrando primeras 100 filas de {previewData.length}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-auto">
          <Button variant="outline" onClick={() => {
            if (previewData) {
              setPreviewData(null);
              setSelectedFile(null);
              setSelectedContent("");
            } else {
              onClose();
            }
          }} disabled={isPending}>
            {previewData ? "Descartar y subir otro" : "Cancelar"}
          </Button>
          <Button onClick={handleConfirm} disabled={!previewData || hasErrors || isPending} data-testid="button-confirm-import">
            {confirmImport.isPending ? "Importando..." : "Confirmar Importación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
