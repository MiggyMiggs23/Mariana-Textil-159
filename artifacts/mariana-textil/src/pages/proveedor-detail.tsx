import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useGetProveedor, 
  useUpdateProveedor,
  getGetProveedorQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
  TipoProveedor,
  Moneda
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Save, Building2, MapPin, Mail, Phone, ShoppingBag, Globe2, Wallet } from "lucide-react";

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

export default function ProveedorDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const { data: proveedor, isLoading } = useGetProveedor(Number(id), {
    query: { enabled: !!id, queryKey: getGetProveedorQueryKey(Number(id)) }
  });

  const updateProveedor = useUpdateProveedor();
  const [isEditing, setIsEditing] = useState(false);
  const initializedForId = useRef<number | null>(null);

  const [formData, setFormData] = useState<{
    nombre: string;
    tipo: TipoProveedor;
    monedaDefault: Moneda;
    contactoNombre: string;
    telefono: string;
    correo: string;
    pais: string;
    notas: string;
    activo: boolean;
  }>({
    nombre: "",
    tipo: TipoProveedor.NACIONAL,
    monedaDefault: Moneda.MXN,
    contactoNombre: "",
    telefono: "",
    correo: "",
    pais: "",
    notas: "",
    activo: true
  });

  useEffect(() => {
    if (proveedor && initializedForId.current !== proveedor.id) {
      initializedForId.current = proveedor.id;
      setFormData({
        nombre: proveedor.nombre,
        tipo: proveedor.tipo,
        monedaDefault: proveedor.monedaDefault,
        contactoNombre: proveedor.contactoNombre || "",
        telefono: proveedor.telefono || "",
        correo: proveedor.correo || "",
        pais: proveedor.pais || "",
        notas: proveedor.notas || "",
        activo: proveedor.activo
      });
    }
  }, [proveedor]);

  const canEdit = user?.rol === Role.ADMIN || user?.rol === Role.INVENTARIOS || user?.rol === Role.BODEGA;
  const canToggleActive = user?.rol === Role.ADMIN;

  const handleSave = () => {
    if (!proveedor) return;
    if (!formData.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    updateProveedor.mutate({
      id: proveedor.id,
      data: {
        nombre: formData.nombre.trim(),
        tipo: formData.tipo,
        monedaDefault: formData.monedaDefault,
        contactoNombre: formData.contactoNombre.trim() || null,
        telefono: formData.telefono.trim() || null,
        correo: formData.correo.trim() || null,
        pais: formData.pais.trim() || null,
        notas: formData.notas.trim() || null,
        ...(canToggleActive ? { activo: formData.activo } : {})
      }
    }, {
      onSuccess: (updated) => {
        toast.success("Proveedor actualizado exitosamente");
        queryClient.setQueryData(getGetProveedorQueryKey(proveedor.id), updated);
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
          <div className="h-48 bg-muted rounded-xl"></div>
          <div className="h-64 bg-muted rounded-xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!proveedor) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-12 text-center text-muted-foreground flex flex-col items-center">
          <Building2 className="w-12 h-12 mb-4 opacity-20" />
          <h2 className="text-xl font-bold mb-2">Proveedor no encontrado</h2>
          <Link href="/proveedores" className="text-primary hover:underline">Volver al listado</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/proveedores" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a proveedores
          </Link>
          {canEdit && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-supplier">
              Editar Perfil
            </Button>
          )}
          {canEdit && isEditing && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={updateProveedor.isPending} data-testid="button-save-supplier">
                <Save className="w-4 h-4 mr-2" /> Guardar
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-sm border-sidebar-border/10">
            <CardHeader className="pb-4 border-b bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-sidebar flex items-center justify-center text-white shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    {isEditing ? (
                      <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})} className="font-bold text-lg max-w-sm mb-1" data-testid="input-edit-supplier-nombre" />
                    ) : (
                      <CardTitle className="text-2xl text-sidebar font-bold" data-testid="display-supplier-nombre">{proveedor.nombre}</CardTitle>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className={proveedor.tipo === TipoProveedor.NACIONAL ? "border-emerald-200 text-emerald-700" : "border-blue-200 text-blue-700"}>
                        {proveedor.tipo === TipoProveedor.NACIONAL ? <MapPin className="w-3 h-3 mr-1" /> : <Globe2 className="w-3 h-3 mr-1" />}
                        {proveedor.tipo}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-xs"><Wallet className="w-3 h-3 mr-1"/>{proveedor.monedaDefault}</Badge>
                    </div>
                  </div>
                </div>
                {!isEditing && (
                  <Badge variant={proveedor.activo ? "default" : "secondary"}>
                    {proveedor.activo ? "Activo" : "Inactivo"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="py-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {isEditing ? (
                  <>
                    <div className="space-y-1">
                      <Label>Tipo de Proveedor</Label>
                      <Select value={formData.tipo} onValueChange={(v: TipoProveedor) => setFormData({...formData, tipo: v})}>
                        <SelectTrigger data-testid="input-edit-supplier-tipo"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TipoProveedor.NACIONAL}>Nacional</SelectItem>
                          <SelectItem value={TipoProveedor.IMPORTACION}>Importación</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Moneda de Pago</Label>
                      <Select value={formData.monedaDefault} onValueChange={(v: Moneda) => setFormData({...formData, monedaDefault: v})}>
                        <SelectTrigger data-testid="input-edit-supplier-moneda"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={Moneda.MXN}>MXN (Pesos)</SelectItem>
                          <SelectItem value={Moneda.USD}>USD (Dólares)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}

                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/> País / Origen</Label>
                  {isEditing ? (
                    <Input value={formData.pais} onChange={e => setFormData({...formData, pais: e.target.value.toUpperCase()})} data-testid="input-edit-supplier-pais" />
                  ) : (
                    <div className="font-medium h-10 flex items-center" data-testid="display-supplier-pais">{proveedor.pais || "-"}</div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground">Contacto Principal</Label>
                  {isEditing ? (
                    <Input value={formData.contactoNombre} onChange={e => setFormData({...formData, contactoNombre: e.target.value})} data-testid="input-edit-supplier-contacto" />
                  ) : (
                    <div className="font-medium h-10 flex items-center">{proveedor.contactoNombre || "-"}</div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3"/> Teléfono</Label>
                  {isEditing ? (
                    <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} type="tel" data-testid="input-edit-supplier-telefono" />
                  ) : (
                    <div className="font-medium h-10 flex items-center">{proveedor.telefono || "-"}</div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3"/> Correo</Label>
                  {isEditing ? (
                    <Input value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} type="email" data-testid="input-edit-supplier-correo" />
                  ) : (
                    <div className="font-medium h-10 flex items-center">{proveedor.correo || "-"}</div>
                  )}
                </div>

                <div className="col-span-2 space-y-1">
                  <Label className="text-muted-foreground">Notas Adicionales</Label>
                  {isEditing ? (
                    <Input value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} data-testid="input-edit-supplier-notas" />
                  ) : (
                    <div className="text-sm bg-muted/20 p-4 rounded-md min-h-[60px] border border-dashed">
                      {proveedor.notas || <span className="text-muted-foreground italic">Sin notas registradas.</span>}
                    </div>
                  )}
                </div>

                {isEditing && canToggleActive && (
                  <div className="col-span-2 flex items-center space-x-2 p-4 border rounded-lg bg-background mt-2">
                    <Checkbox id="edit-active" checked={formData.activo} onCheckedChange={c => setFormData({...formData, activo: c===true})} data-testid="input-edit-supplier-activo" />
                    <Label htmlFor="edit-active" className="cursor-pointer font-medium text-destructive">Desactivar bloquea nuevas compras a este proveedor</Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Historial Placeholder */}
          <div className="md:col-span-1">
            <Card className="h-full border-dashed shadow-none bg-muted/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="w-5 h-5" />
                  Historial de Compras
                </CardTitle>
                <CardDescription>Módulo en desarrollo</CardDescription>
              </CardHeader>
              <CardContent className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground h-full min-h-[300px]">
                <Globe2 className="w-12 h-12 opacity-20 mb-4" />
                <p className="font-medium">Las órdenes de compra se mostrarán aquí.</p>
                <p className="text-sm mt-2 opacity-70">
                  Próximamente podrás visualizar el volumen de compras, saldos pendientes y contenedores en tránsito para este proveedor.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
