import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetProducto,
  useUpdateProducto,
  useGetKardex,
  getGetProductoQueryKey,
  getListProductosQueryKey,
  getGetKardexQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  useListLocations,
  Role,
  UnidadProducto
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Package, Save, CheckCircle2, Lock, Download, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { generateSkuPreview } from "./productos";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatNumber, formatQuantityForCsv, formatUnit } from "@workspace/number-format";
import { hasPermission, Modules } from "@/lib/permisos";

// Helper for generic API errors
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

export default function ProductoDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const updateProducto = useUpdateProducto();

  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const { data: product, isLoading } = useGetProducto(Number(id), {
    query: { enabled: !!id, queryKey: getGetProductoQueryKey(Number(id)) }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [kardexUbicacionId, setKardexUbicacionId] = useState<string>("all");
  const [kardexDesde, setKardexDesde] = useState<string>("");
  const [kardexHasta, setKardexHasta] = useState<string>("");
  const [kardexPage, setKardexPage] = useState(1);

  const { data: ubicaciones } = useListLocations();
  const kardexParams = {
    productoId: Number(id),
    ubicacionId: kardexUbicacionId !== "all" ? Number(kardexUbicacionId) : undefined,
    desde: kardexDesde || undefined,
    hasta: kardexHasta || undefined,
    page: kardexPage,
    pageSize: 100
  };
  const { data: kardexRes, isLoading: loadingKardex } = useGetKardex(kardexParams, {
    query: {
      enabled: !!id,
      queryKey: getGetKardexQueryKey(kardexParams)
    }
  });

  const handleExportCsv = () => {
    if (!kardexRes || kardexRes.movimientos.length === 0) return;
    const header = ["Fecha", "Rollo", "Tipo", "Sitio", "Cantidad", "Saldo Posterior", "Referencia"];
    const rows = kardexRes.movimientos.map(m => [
      format(new Date(m.createdAt), "dd/MM/yyyy HH:mm"),
      m.serie || "",
      m.tipo,
      m.nombreUbicacion || "",
      formatQuantityForCsv(m.cantidad),
      formatQuantityForCsv(m.saldoPosterior),
      (m.justificacion || m.documentoId || "").replace(/,/g, " ")
    ]);
    const csvContent = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kardex_${product?.sku || id}_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [formData, setFormData] = useState<{
    tela: string;
    color: string;
    unidad: UnidadProducto;
    precioSugerido: string;
    notas: string;
    activo: boolean;
    sku: string;
    isCustomSku: boolean;
    colorHex?: string | null;
    anchoCm: string;
    composicion: string;
    gramajeGm2: string;
  }>({
    tela: "",
    color: "",
    unidad: UnidadProducto.METRO,
    precioSugerido: "",
    notas: "",
    activo: true,
    sku: "",
    isCustomSku: false,
    colorHex: null,
    anchoCm: "",
    composicion: "",
    gramajeGm2: "",
  });

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (product && initializedForId.current !== product.id) {
      initializedForId.current = product.id;
      setFormData({
        tela: product.tela,
        color: product.color,
        unidad: product.unidad,
        precioSugerido: product.precioSugerido ?? "",
        notas: product.notas || "",
        activo: product.activo,
        sku: product.sku,
        isCustomSku: true, // start with exact SKU
        colorHex: product.colorHex || null,
        anchoCm: product.anchoCm == null ? "" : product.anchoCm.toFixed(2),
        composicion: product.composicion || "",
        gramajeGm2: product.gramajeGm2 == null ? "" : product.gramajeGm2.toFixed(2),
      });
    }
  }, [product]);

  const isAdmin = user?.rol === Role.ADMIN;
  const canEditProduct = hasPermission(user, Modules.PRODUCTOS, "editar");
  const isSupervisor = user?.rol === Role.SUPERVISOR;
  const canViewPurchaseCosts = user != null && user.rol !== Role.TERMINAL && !isSupervisor;
  const canViewPrices = user != null && !isSupervisor;
  const isBlocked = product?.skuBloqueado === true;

  const autoSku = generateSkuPreview(formData.tela, formData.color);
  const displaySku = formData.isCustomSku ? formData.sku : autoSku;

  const handleSave = () => {
    if (!product) return;

    updateProducto.mutate({
      id: product.id,
      data: {
        tela: formData.tela,
        color: formData.color,
        unidad: formData.unidad,
        precioSugerido: formData.precioSugerido,
        notas: formData.notas || null,
        activo: formData.activo,
        sku: isBlocked || !formData.isCustomSku ? undefined : displaySku,
        colorHex: isAdmin ? formData.colorHex : undefined,
        anchoCm: formData.anchoCm === "" ? null : Number(formData.anchoCm),
        composicion: formData.composicion || null,
        gramajeGm2: formData.gramajeGm2 === "" ? null : Number(formData.gramajeGm2),
      }
    }, {
      onSuccess: () => {
        toast.success("Producto actualizado");
        queryClient.invalidateQueries({ queryKey: getGetProductoQueryKey(product.id) });
        queryClient.invalidateQueries({ queryKey: getListProductosQueryKey() });
        setIsEditing(false);
      },
      onError: (err: any) => {
        toast.error("Error al actualizar", { description: getErrorMessage(err) });
      }
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="h-64 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!product) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-12 text-center text-muted-foreground flex flex-col items-center">
          <Package className="w-12 h-12 mb-4 opacity-20" />
          <h2 className="text-xl font-bold mb-2">Producto no encontrado</h2>
          <Link href="/productos" className="text-primary hover:underline">Volver al catálogo</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/productos" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al catálogo
          </Link>
          {canEditProduct && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-product">
              Editar Producto
            </Button>
          )}
          {canEditProduct && isEditing && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={updateProducto.isPending} data-testid="button-save-product">
                <Save className="w-4 h-4 mr-2" /> Guardar
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Detalles Principales */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-sidebar font-bold flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Input value={formData.tela} onChange={e => setFormData({...formData, tela: e.target.value.toUpperCase()})} className="font-bold w-40" data-testid="input-edit-tela" />
                        <Input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value.toUpperCase()})} className="font-bold w-40" data-testid="input-edit-color" />
                      </div>
                    ) : (
                      <>{product.tela} <span className="text-muted-foreground font-light">/</span> {product.color}</>
                    )}
                  </CardTitle>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono bg-muted/50 px-2 py-0.5 rounded border" data-testid="display-sku">
                      {isEditing ? (
                        isBlocked ? <span className="flex items-center"><Lock className="w-3 h-3 mr-1"/>{product.sku}</span> : displaySku
                      ) : product.sku}
                    </span>
                    <span>•</span>
                    <span>Creado el {new Date(product.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {!isEditing && (
                  <Badge variant={product.activo ? "default" : "secondary"} className="text-sm">
                    {product.activo ? "Activo" : "Inactivo"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="py-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Unidad de Medida</Label>
                  {isEditing && !product.unidadBloqueada ? (
                    <Select value={formData.unidad} onValueChange={(v: UnidadProducto) => setFormData({...formData, unidad: v})}>
                      <SelectTrigger data-testid="input-edit-unidad"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UnidadProducto.METRO}>{formatUnit(UnidadProducto.METRO)}</SelectItem>
                        <SelectItem value={UnidadProducto.KILO}>{formatUnit(UnidadProducto.KILO)}</SelectItem>
                        <SelectItem value={UnidadProducto.BOLSA}>{formatUnit(UnidadProducto.BOLSA)}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="font-medium flex items-center h-10">
                      {formatUnit(product.unidad)}
                      {product.unidadBloqueada && (
                        <span title="Unidad en uso, no se puede cambiar">
                          <Lock className="w-3 h-3 ml-2 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                  )}
                  {isEditing && product.unidadBloqueada && (
                    <p className="text-xs text-muted-foreground">
                      La unidad no puede cambiarse porque este producto tiene historial operativo.
                    </p>
                  )}
                </div>

                {canViewPrices && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Precio de Lista</Label>
                    <div className="font-medium text-lg text-emerald-700 h-10 flex items-center justify-between">
                      {formatNumber(product.precioSugerido ?? 0, { kind: "money" })}
                      {isAdmin && !isEditing && (
                        <Link href={`/precios/${product.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs ml-4" data-testid="button-go-precios">
                            Gestionar Precio
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {isEditing && !isBlocked && (
                  <div className="col-span-2 space-y-2 p-4 bg-muted/30 border rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Checkbox id="edit-sku" checked={formData.isCustomSku} onCheckedChange={(c) => setFormData({...formData, isCustomSku: c===true})} data-testid="input-edit-custom-sku" />
                      <Label htmlFor="edit-sku" className="cursor-pointer">Forzar SKU Personalizado</Label>
                    </div>
                    {formData.isCustomSku && (
                      <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} className="font-mono uppercase" data-testid="input-edit-sku" />
                    )}
                  </div>
                )}

                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Ancho</Label>
                    {isEditing ? (
                      <Input type="number" step="0.01" min="0" value={formData.anchoCm} onChange={e => setFormData({...formData, anchoCm: e.target.value})} data-testid="input-edit-ancho-cm" />
                    ) : (
                      <div className="font-medium h-10 flex items-center" data-testid="text-product-ancho-cm">{product.anchoCm == null ? "Sin especificar" : `${product.anchoCm.toFixed(2)} cm`}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Gramaje</Label>
                    {isEditing ? (
                      <Input type="number" step="0.01" min="0" value={formData.gramajeGm2} onChange={e => setFormData({...formData, gramajeGm2: e.target.value})} data-testid="input-edit-gramaje-gm2" />
                    ) : (
                      <div className="font-medium h-10 flex items-center" data-testid="text-product-gramaje-gm2">{product.gramajeGm2 == null ? "Sin especificar" : `${product.gramajeGm2.toFixed(2)} g/m²`}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Composición</Label>
                    {isEditing ? (
                      <Input value={formData.composicion} onChange={e => setFormData({...formData, composicion: e.target.value})} placeholder="Ej. 100% poliéster" data-testid="input-edit-composicion" />
                    ) : (
                      <div className="font-medium h-10 flex items-center" data-testid="text-product-composicion">{product.composicion || "Sin especificar"}</div>
                    )}
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <Label className="text-muted-foreground">Notas</Label>
                  {isEditing ? (
                    <Input value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} data-testid="input-edit-notas" />
                  ) : (
                    <div className="text-sm bg-muted/20 p-3 rounded-md min-h-[60px] border border-dashed">
                      {product.notas || <span className="text-muted-foreground italic">Sin notas adicionales.</span>}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="col-span-2 space-y-1 p-4 border rounded-lg bg-background">
                    <Label className="text-muted-foreground">Color (Muestrario Reportes)</Label>
                    <div className="flex items-center gap-4 mt-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={formData.colorHex || "#cccccc"}
                            onChange={e => setFormData({...formData, colorHex: e.target.value})}
                            className="w-14 h-10 p-1 cursor-pointer"
                            title="Seleccionar color"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData({...formData, colorHex: null})}
                            disabled={!formData.colorHex}
                            type="button"
                          >
                            Limpiar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded border shadow-sm"
                            style={{ backgroundColor: product.colorHex || 'hsl(var(--report-text-muted))' }}
                          />
                          <span className="text-sm font-medium">
                            {product.colorHex ? product.colorHex.toUpperCase() : "Sin color asignado"}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Color representativo usado visualmente en las tablas de reportes (solo ADMIN).</p>
                  </div>
                )}

                {isEditing && (
                  <div className="col-span-2 flex items-center space-x-2 p-4 border rounded-lg bg-background">
                    <Checkbox id="edit-active" checked={formData.activo} onCheckedChange={c => setFormData({...formData, activo: c===true})} data-testid="input-edit-activo" />
                    <Label htmlFor="edit-active" className="cursor-pointer font-medium">Producto visible y activo en el sistema</Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inventario Lateral */}
          <div className="space-y-6 md:col-span-1">
            <Card className="bg-sidebar text-white shadow-xl shadow-sidebar/20 border-sidebar-border relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sidebar-primary rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
              <CardHeader>
                <CardTitle className="text-sidebar-foreground flex items-center gap-2">
                  <Package className="w-5 h-5 text-sidebar-primary" />
                  Inventario Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-4xl font-bold tracking-tighter mb-1">{formatNumber(product.cantidad, { kind: "quantity" })}</div>
                    <div className="text-sm font-medium text-sidebar-primary">{formatUnit(product.unidad)} totales</div>
                  </div>
                  <div className="h-px bg-white/10 w-full"></div>
                  <div>
                    <div className="text-2xl font-bold tracking-tight mb-1">{formatNumber(product.rollos, { kind: "count" })}</div>
                    <div className="text-sm text-sidebar-foreground/70">ROLLOS EN EXISTENCIA</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4 bg-muted/10 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Por Sitio
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {product.inventarioPorUbicacion.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No hay ubicaciones configuradas.
                    </div>
                  ) : (
                    product.inventarioPorUbicacion.map(inv => {
                      const isZero = inv.rollos === 0 && parseFloat(inv.cantidad) === 0;
                      return (
                      <div key={inv.ubicacionId} className={`p-4 flex items-center justify-between hover:bg-muted/30 transition-colors ${isZero ? 'opacity-60 bg-muted/10' : ''}`}>
                        <div className={`font-medium text-sm ${isZero ? 'text-muted-foreground' : ''}`}>{inv.nombre}</div>
                        <div className="text-right">
                          <div className={`font-bold tabular-nums ${isZero ? 'text-muted-foreground' : 'text-foreground'}`}>{formatNumber(inv.cantidad, { kind: "quantity" })} <span className="text-[10px] font-normal text-muted-foreground">{formatUnit(product.unidad)}</span></div>
                          <div className="text-xs text-muted-foreground">{formatNumber(inv.rollos, { kind: "count" })} rollos</div>
                        </div>
                      </div>
                    )})
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rollos Disponibles Section */}
        <Card className="border-t-4 border-t-sidebar-primary">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Package className="w-5 h-5 text-sidebar-primary" />
              Rollos disponibles en almacén
            </CardTitle>
            <CardDescription>
              Rollos disponibles que forman parte de la existencia actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {product.rollosDisponibles.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p>No hay rollos disponibles actualmente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead>Serie</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.rollosDisponibles.map(rollo => (
                      <TableRow key={rollo.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Link
                            href={`/inventario/rollos/${rollo.id}`}
                            className="font-mono font-medium text-primary hover:underline flex items-center gap-1"
                            data-testid={`link-rollo-${rollo.id}`}
                          >
                            {rollo.serie}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {rollo.ubicacionNombre}
                          {rollo.nombrePiso && <span className="ml-2 text-[10px] uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Piso: {rollo.nombrePiso}</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatNumber(rollo.cantidad, { kind: "quantity" })} <span className="text-[10px] font-normal text-muted-foreground">{formatUnit(product.unidad)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className="bg-emerald-100 text-emerald-800 border-emerald-200"
                          >
                            {rollo.estado.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {canViewPurchaseCosts && product.comprasResumen && (
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-xl">Historial de compras</CardTitle>
              <CardDescription>
                El costo por {formatUnit(product.unidad)} se pondera con la cantidad recibida.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Costo por {formatUnit(product.unidad)}</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatNumber(product.comprasResumen?.costoPorUnidad ?? 0, { kind: "money" })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Cantidad comprada</div>
                  <div className="text-xl font-semibold">
                    {formatNumber(product.comprasResumen?.totalCantidad ?? 0, { kind: "quantity" })} {formatUnit(product.unidad)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total comprado</div>
                  <div className="text-xl font-semibold">{formatNumber(product.comprasResumen?.totalCosto ?? 0, { kind: "money" })}</div>
                  <div className="text-xs text-muted-foreground">{formatNumber(product.comprasResumen?.totalRollos ?? 0, { kind: "count" })} rollos</div>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo por {formatUnit(product.unidad)}</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!product.comprasHistorial || product.comprasHistorial.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                          No hay compras registradas.
                        </TableCell>
                      </TableRow>
                    ) : product.comprasHistorial.map((compra) => (
                      <TableRow key={compra.entradaId}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(compra.fecha), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Link href={`/entradas/${compra.entradaId}/documento`} className="font-mono text-primary hover:underline">
                            #{compra.folio}
                          </Link>
                        </TableCell>
                        <TableCell>{compra.proveedorNombre || "Sin proveedor"}</TableCell>
                        <TableCell className="text-right">
                           {formatNumber(compra.totalCantidad ?? 0, { kind: "quantity" })} {formatUnit(product.unidad)}
                           <div className="text-xs text-muted-foreground">{formatNumber(compra.totalRollos ?? 0, { kind: "count" })} rollos</div>
                        </TableCell>
                         <TableCell className="text-right font-semibold">{formatNumber(compra.costoPorUnidad ?? 0, { kind: "money" })}</TableCell>
                         <TableCell className="text-right">{formatNumber(compra.totalCosto ?? 0, { kind: "money" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kardex Section */}
        <Card className="mt-8 border-t-4 border-t-secondary">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 space-y-4 sm:space-y-0 border-b">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-sidebar">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Kardex de Movimientos
              </CardTitle>
              <CardDescription>
                Historial detallado de todas las operaciones de este producto.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!kardexRes || kardexRes.movimientos.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Exportar a Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-muted/10 p-4 border-b flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3"/> Sitio</Label>
                <Select value={kardexUbicacionId} onValueChange={(v) => { setKardexUbicacionId(v); setKardexPage(1); }}>
                  <SelectTrigger className="h-8 bg-background">
                    <SelectValue placeholder="Todos los sitios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los sitios</SelectItem>
                    {ubicaciones?.filter(u => u.activa).map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 w-32">
                <Label className="text-xs">Desde</Label>
                <Input type="date" className="h-8 bg-background" value={kardexDesde} onChange={e => { setKardexDesde(e.target.value); setKardexPage(1); }} />
              </div>
              <div className="space-y-1.5 w-32">
                <Label className="text-xs">Hasta</Label>
                <Input type="date" className="h-8 bg-background" value={kardexHasta} onChange={e => { setKardexHasta(e.target.value); setKardexPage(1); }} />
              </div>
            </div>

            {loadingKardex ? (
              <div className="p-12 text-center text-muted-foreground animate-pulse">Cargando kardex...</div>
            ) : !kardexRes || kardexRes.movimientos.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Package className="w-12 h-12 opacity-20 mb-4" />
                <p className="font-medium">No se encontraron movimientos.</p>
                <p className="text-sm mt-2 opacity-70">Ajusta los filtros para ver más resultados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Fecha</TableHead>
                      <TableHead>Rollo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Sitio</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Referencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kardexRes.movimientos.map((mov) => {
                      const isPositive = ['ALTA', 'RECEPCION', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_POSITIVO'].includes(mov.tipo);
                      const isNegative = ['VENTA', 'TRANSFERENCIA_SALIDA', 'SALIDA_MOSTRADOR', 'AJUSTE_NEGATIVO', 'CANCELACION'].includes(mov.tipo);
                      return (
                        <TableRow key={mov.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {format(new Date(mov.createdAt), "dd/MM/yy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Link href={`/inventario/rollos/${mov.rolloId}`} className="font-mono font-medium hover:underline text-primary">
                              {mov.serie}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"} className="text-[10px]">
                              {mov.tipo.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{mov.nombreUbicacion}</TableCell>
                          <TableCell className={`text-right font-medium tabular-nums ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {isPositive ? '+' : isNegative ? '-' : ''}{formatNumber(Math.abs(parseFloat(mov.cantidad)), { kind: "quantity" })}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {formatNumber(mov.saldoPosterior, { kind: "quantity" })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={mov.justificacion || mov.documentoId || ''}>
                            {mov.documentoTipo && `${mov.documentoTipo} ${mov.documentoId || ''} `}
                            {mov.justificacion}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {kardexRes.total > kardexRes.pageSize && (
                  <div className="p-4 border-t flex items-center justify-between bg-muted/10">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((kardexPage - 1) * kardexRes.pageSize) + 1} a {Math.min(kardexPage * kardexRes.pageSize, kardexRes.total)} de {kardexRes.total}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setKardexPage(p => Math.max(1, p - 1))} disabled={kardexPage === 1}>
                        <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setKardexPage(p => p + 1)} disabled={kardexPage * kardexRes.pageSize >= kardexRes.total}>
                        Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}