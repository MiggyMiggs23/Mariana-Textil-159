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
import { generateSKU } from "./productos";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatNumber } from "@workspace/number-format";

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
      m.cantidad,
      m.saldoPosterior,
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
  }>({
    tela: "",
    color: "",
    unidad: UnidadProducto.METRO,
    precioSugerido: "",
    notas: "",
    activo: true,
    sku: "",
    isCustomSku: false
  });

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (product && initializedForId.current !== product.id) {
      initializedForId.current = product.id;
      setFormData({
        tela: product.tela,
        color: product.color,
        unidad: product.unidad,
        precioSugerido: product.precioSugerido,
        notas: product.notas || "",
        activo: product.activo,
        sku: product.sku,
        isCustomSku: true // start with exact SKU
      });
    }
  }, [product]);

  const isAdmin = user?.rol === Role.ADMIN;
  const canViewPurchaseCosts = user != null && user.rol !== Role.TERMINAL;
  const isBlocked = product?.skuBloqueado === true;

  const autoSku = generateSKU(formData.tela, formData.color);
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
        sku: isBlocked ? undefined : displaySku
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
          {isAdmin && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-product">
              Editar Producto
            </Button>
          )}
          {isAdmin && isEditing && (
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
                        <SelectItem value={UnidadProducto.METRO}>Metros</SelectItem>
                        <SelectItem value={UnidadProducto.KILO}>Kilos</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="font-medium flex items-center h-10">
                      {product.unidad}
                      {product.unidadBloqueada && (
                        <span title="Unidad en uso, no se puede cambiar">
                          <Lock className="w-3 h-3 ml-2 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Precio de Lista</Label>
                  <div className="font-medium text-lg text-emerald-700 h-10 flex items-center justify-between">
                    {formatNumber(product.precioSugerido, { kind: "money" })}
                    {isAdmin && !isEditing && (
                      <Link href={`/precios/${product.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs ml-4" data-testid="button-go-precios">
                          Gestionar Precio
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

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
                    <div className="text-sm font-medium text-sidebar-primary">{product.unidad} TOTALES</div>
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
                      No hay inventario registrado en ningún sitio.
                    </div>
                  ) : (
                    product.inventarioPorUbicacion.map(inv => (
                      <div key={inv.ubicacionId} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="font-medium text-sm">{inv.nombre}</div>
                        <div className="text-right">
                          <div className="font-bold text-foreground">{formatNumber(inv.cantidad, { kind: "quantity" })} <span className="text-xs font-normal text-muted-foreground">{product.unidad}</span></div>
                          <div className="text-xs text-muted-foreground">{formatNumber(inv.rollos, { kind: "count" })} rollos</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {canViewPurchaseCosts && product.comprasResumen && (
          <Card className="border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-xl">Historial de compras</CardTitle>
              <CardDescription>
                El costo por {product.unidad.toLowerCase()} se pondera con la cantidad recibida.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Costo por {product.unidad.toLowerCase()}</div>
                  <div className="text-2xl font-bold text-primary">
                    {formatNumber(product.comprasResumen.costoPorUnidad, { kind: "money" })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Cantidad comprada</div>
                  <div className="text-xl font-semibold">
                    {formatNumber(product.comprasResumen.totalCantidad, { kind: "quantity" })} {product.unidad}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total comprado</div>
                  <div className="text-xl font-semibold">{formatNumber(product.comprasResumen.totalCosto, { kind: "money" })}</div>
                  <div className="text-xs text-muted-foreground">{formatNumber(product.comprasResumen.totalRollos, { kind: "count" })} rollos</div>
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
                      <TableHead className="text-right">Costo por {product.unidad.toLowerCase()}</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.comprasHistorial.length === 0 ? (
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
                           {formatNumber(compra.totalCantidad, { kind: "quantity" })} {product.unidad}
                           <div className="text-xs text-muted-foreground">{formatNumber(compra.totalRollos, { kind: "count" })} rollos</div>
                        </TableCell>
                         <TableCell className="text-right font-semibold">{formatNumber(compra.costoPorUnidad, { kind: "money" })}</TableCell>
                         <TableCell className="text-right">{formatNumber(compra.totalCosto, { kind: "money" })}</TableCell>
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