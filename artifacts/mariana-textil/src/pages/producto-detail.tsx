import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useGetProducto, 
  useUpdateProducto,
  getGetProductoQueryKey,
  getListProductosQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
  UnidadProducto
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Package, Save, CheckCircle2, Lock } from "lucide-react";
import { generateSKU } from "./productos";

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
                  <Label className="text-muted-foreground">Precio Sugerido</Label>
                  {isEditing ? (
                    <Input type="number" step="0.01" value={formData.precioSugerido} onChange={e => setFormData({...formData, precioSugerido: e.target.value})} data-testid="input-edit-precio" />
                  ) : (
                    <div className="font-medium text-lg text-emerald-700 h-10 flex items-center">${parseFloat(product.precioSugerido).toFixed(2)}</div>
                  )}
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
                    <div className="text-4xl font-bold tracking-tighter mb-1">{parseFloat(product.cantidad).toFixed(2)}</div>
                    <div className="text-sm font-medium text-sidebar-primary">{product.unidad} TOTALES</div>
                  </div>
                  <div className="h-px bg-white/10 w-full"></div>
                  <div>
                    <div className="text-2xl font-bold tracking-tight mb-1">{product.rollos}</div>
                    <div className="text-sm text-sidebar-foreground/70">ROLLOS EN EXISTENCIA</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4 bg-muted/10 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Por Ubicación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {product.inventarioPorUbicacion.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No hay inventario registrado en ninguna ubicación.
                    </div>
                  ) : (
                    product.inventarioPorUbicacion.map(inv => (
                      <div key={inv.ubicacionId} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="font-medium text-sm">{inv.nombre}</div>
                        <div className="text-right">
                          <div className="font-bold text-foreground">{parseFloat(inv.cantidad).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{product.unidad}</span></div>
                          <div className="text-xs text-muted-foreground">{inv.rollos} rollos</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Kardex Placeholder */}
        <Card className="mt-8 border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-5 h-5" />
              Kardex de Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Package className="w-12 h-12 opacity-20 mb-4" />
            <p className="font-medium">El historial de movimientos estará disponible próximamente.</p>
            <p className="text-sm max-w-sm mt-2 opacity-70">
              Aquí se registrarán todas las entradas, salidas y transferencias de este producto, incluyendo el detalle rollo por rollo.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}