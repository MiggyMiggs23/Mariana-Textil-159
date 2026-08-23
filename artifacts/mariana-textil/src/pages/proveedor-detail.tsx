import { useState, useRef, useEffect, useMemo } from "react";
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
  Moneda,
  useListComprasProveedor,
  getListComprasProveedorQueryKey,
  useEstadoCuentaProveedor,
  getEstadoCuentaProveedorQueryKey,
  useRegistrarPagoProveedor,
  useRegistrarAjusteProveedor,
  useEstadisticasProveedor,
  getEstadisticasProveedorQueryKey,
  getListProveedoresQueryKey,
  exportarProveedorXlsx,
  CompraConEstadoEstado,
  FormaPagoProveedor,
  TipoPagoProveedor
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Save, Building2, MapPin, Mail, Phone, ShoppingBag, Globe2, Wallet, Download, Printer, Plus, ExternalLink, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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

function formatCurrency(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "$0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(num);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "short",
      day: "2-digit"
    }).format(new Date(dateStr));
  } catch (e) {
    return "-";
  }
}

export default function ProveedorDetail() {
  const { id } = useParams();
  const provId = Number(id);
  const queryClient = useQueryClient();

  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const { data: proveedor, isLoading: isProvLoading } = useGetProveedor(provId, {
    query: { enabled: !!provId, queryKey: getGetProveedorQueryKey(provId) }
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

  const canEdit = hasPermission(user, Modules.PROVEEDORES, 'editar');
  const canToggleActive = user?.rol === Role.ADMIN; // Admins only for active status? Or keep based on rule
  const isAdmin = user?.rol === Role.ADMIN;
  const canViewFinanzas = hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'ver');

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

  // ----- COMPRAS TAB -----
  const [comprasFiltroEstado, setComprasFiltroEstado] = useState<string>("ALL");
  const [comprasFiltroDesde, setComprasFiltroDesde] = useState<string>("");
  const [comprasFiltroHasta, setComprasFiltroHasta] = useState<string>("");
  const comprasQuery = useMemo(() => ({
    estado: comprasFiltroEstado === "ALL" ? undefined : (comprasFiltroEstado as any),
    desde: comprasFiltroDesde || undefined,
    hasta: comprasFiltroHasta || undefined,
    page: 1,
    pageSize: 1000
  }), [comprasFiltroEstado, comprasFiltroDesde, comprasFiltroHasta]);

  const { data: comprasData, isLoading: isComprasLoading } = useListComprasProveedor(provId,
    comprasQuery,
    { query: { enabled: !!provId && canViewFinanzas, queryKey: getListComprasProveedorQueryKey(provId, comprasQuery) } }
  );

  // ----- PAGOS TAB -----
  const { data: estadoCuenta, isLoading: isEstadoCuentaLoading } = useEstadoCuentaProveedor(provId, {}, {
    query: { enabled: !!provId && canViewFinanzas, queryKey: getEstadoCuentaProveedorQueryKey(provId, {}) }
  });

  const [isPagoOpen, setIsPagoOpen] = useState(false);
  const [pagoPreselectedEntrada, setPagoPreselectedEntrada] = useState<number | null>(null);

  const [isAjusteOpen, setIsAjusteOpen] = useState(false);

  // ----- ESTADÍSTICAS TAB -----
  const initDesde = new Date();
  initDesde.setFullYear(initDesde.getFullYear() - 1);
  const [estDesde, setEstDesde] = useState(initDesde.toISOString().split("T")[0]);
  const [estHasta, setEstHasta] = useState(new Date().toISOString().split("T")[0]);

  const { data: estadisticas, isLoading: isEstadisticasLoading } = useEstadisticasProveedor(provId,
    { desde: estDesde, hasta: estHasta },
    { query: { enabled: !!provId && !!estDesde && !!estHasta && canViewFinanzas, queryKey: getEstadisticasProveedorQueryKey(provId, { desde: estDesde, hasta: estHasta }) } }
  );

  // EXPORT
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportarProveedorXlsx(provId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
      a.download = `Proveedor_${proveedor?.nombre}_${todayStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Error al exportar", { description: getErrorMessage(err) });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenEntradaDocument = (entradaId: number) => {
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.open(
      `${baseUrl}/entradas/${entradaId}/documento`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (isProvLoading) {
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
      <div className="max-w-5xl mx-auto space-y-6 pb-24">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <Link href="/proveedores" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a proveedores
          </Link>
          <div className="flex items-center gap-2">
            {canViewFinanzas && (
              <>
                <Button variant="outline" onClick={handleExport} disabled={isExporting} data-testid="button-export-excel">
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? "Exportando..." : "Exportar Excel"}
                </Button>
                <Button variant="outline" onClick={handlePrint} data-testid="button-print">
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* PROVEEDOR CARD */}
        <Card className="shadow-sm border-sidebar-border/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sidebar/5 rounded-bl-full pointer-events-none -z-10" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg bg-sidebar flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-sidebar" data-testid="display-supplier-nombre">{proveedor.nombre}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={proveedor.activo ? "default" : "secondary"}>
                      {proveedor.activo ? "Activo" : "Inactivo"}
                    </Badge>
                    <Badge variant="outline" className={proveedor.tipo === TipoProveedor.NACIONAL ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-blue-200 text-blue-700 bg-blue-50"}>
                      {proveedor.tipo === TipoProveedor.NACIONAL ? <MapPin className="w-3 h-3 mr-1" /> : <Globe2 className="w-3 h-3 mr-1" />}
                      {proveedor.tipo}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs bg-muted"><Wallet className="w-3 h-3 mr-1"/>{proveedor.monedaDefault}</Badge>
                    {proveedor.pais && <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3"/> {proveedor.pais}</span>}
                  </div>
                </div>
              </div>

              {canViewFinanzas && (
                <div className="bg-muted/30 p-4 rounded-xl border border-border min-w-[200px] flex flex-col justify-center items-end">
                  <span className="text-sm font-medium text-muted-foreground">Saldo Actual</span>
                  <span className={`text-3xl font-bold tracking-tight ${(estadoCuenta && parseFloat(estadoCuenta.saldoActual) > 0) ? "text-destructive" : ""}`}>
                    {formatCurrency(estadoCuenta?.saldoActual || "0")}
                  </span>
                  {estadoCuenta && parseFloat(estadoCuenta.saldoActual) > 0 && hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'crear') && (
                    <Button size="sm" className="mt-3 w-full" onClick={() => { setPagoPreselectedEntrada(null); setIsPagoOpen(true); }} data-testid="button-registrar-pago-header">
                      Abonar a cuenta
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t print-only">
               <div>
                  <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Contacto</span>
                  <div className="font-medium text-sm mt-1">{proveedor.contactoNombre || "Sin registrar"}</div>
               </div>
               <div>
                  <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Teléfono</span>
                  <div className="font-medium text-sm mt-1 flex items-center"><Phone className="w-3 h-3 mr-2 text-muted-foreground"/> {proveedor.telefono || "Sin registrar"}</div>
               </div>
               <div>
                  <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Correo</span>
                  <div className="font-medium text-sm mt-1 flex items-center"><Mail className="w-3 h-3 mr-2 text-muted-foreground"/> {proveedor.correo || "Sin registrar"}</div>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* TABS */}
        <Tabs defaultValue="datos" className="no-print">
          <TabsList className="flex flex-wrap w-full md:w-auto h-auto">
            <TabsTrigger value="datos" data-testid="tab-datos" className="flex-1 min-w-[120px]">Datos Generales</TabsTrigger>
            {canViewFinanzas && (
              <>
                <TabsTrigger value="compras" data-testid="tab-compras" className="flex-1 min-w-[120px]">Compras</TabsTrigger>
                <TabsTrigger value="pagos" data-testid="tab-pagos" className="flex-1 min-w-[120px]">Estado de Cuenta</TabsTrigger>
                <TabsTrigger value="estadisticas" data-testid="tab-estadisticas" className="flex-1 min-w-[120px]">Estadísticas</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="datos" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Información del Proveedor</CardTitle>
                  <CardDescription>Detalles de contacto y configuración</CardDescription>
                </div>
                {canEdit && !isEditing && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-supplier">
                    Editar Datos
                  </Button>
                )}
                {canEdit && isEditing && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSave} disabled={updateProveedor.isPending} data-testid="button-save-supplier">
                      <Save className="w-4 h-4 mr-2" /> Guardar
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {isEditing ? (
                    <>
                      <div className="space-y-2 md:col-span-2">
                         <Label>Razón Social / Nombre</Label>
                         <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})} data-testid="input-edit-supplier-nombre" />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Proveedor</Label>
                        <Select value={formData.tipo} onValueChange={(v: TipoProveedor) => setFormData({...formData, tipo: v})}>
                          <SelectTrigger data-testid="input-edit-supplier-tipo"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={TipoProveedor.NACIONAL}>Nacional</SelectItem>
                            <SelectItem value={TipoProveedor.IMPORTACION}>Importación</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
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

                  <div className="md:col-span-2 space-y-1">
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
                    <div className="md:col-span-2 flex items-center space-x-2 p-4 border rounded-lg bg-background mt-2">
                      <Checkbox id="edit-active" checked={formData.activo} onCheckedChange={c => setFormData({...formData, activo: c===true})} data-testid="input-edit-supplier-activo" />
                      <Label htmlFor="edit-active" className="cursor-pointer font-medium text-destructive">Desactivar bloquea nuevas compras a este proveedor</Label>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compras" className="mt-6 space-y-4">
            <Card>
              <div className="p-4 border-b flex flex-wrap items-center gap-4 bg-muted/20">
                <div className="text-sm font-semibold flex-1 min-w-[200px]">Órdenes de Compra (Entradas)</div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={comprasFiltroDesde} onChange={e => setComprasFiltroDesde(e.target.value)} className="w-[140px] bg-background" data-testid="input-compras-desde" />
                  <span className="text-muted-foreground text-sm">-</span>
                  <Input type="date" value={comprasFiltroHasta} onChange={e => setComprasFiltroHasta(e.target.value)} className="w-[140px] bg-background" data-testid="input-compras-hasta" />
                </div>
                <Select value={comprasFiltroEstado} onValueChange={setComprasFiltroEstado}>
                  <SelectTrigger className="w-[160px] bg-background" data-testid="select-compras-estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    <SelectItem value="Pendiente">Pendientes</SelectItem>
                    <SelectItem value="Parcial">Parciales</SelectItem>
                    <SelectItem value="Pagada">Pagadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10">
                      <TableHead>Folio</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Rollos / Cantidad</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Abonado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      {hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'crear') && <TableHead className="w-[100px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isComprasLoading ? (
                      <TableRow><TableCell colSpan={hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'crear') ? 9 : 8} className="text-center h-24">Cargando compras...</TableCell></TableRow>
                    ) : comprasData?.items.length === 0 ? (
                      <TableRow><TableCell colSpan={hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'crear') ? 9 : 8} className="text-center h-24 text-muted-foreground">No hay compras registradas para este estado.</TableCell></TableRow>
                    ) : (
                      comprasData?.items.map(compra => (
                        <TableRow
                          key={compra.entradaId}
                          className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => handleOpenEntradaDocument(compra.entradaId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleOpenEntradaDocument(compra.entradaId);
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`Abrir documento de entrada ${compra.folio}`}
                          data-testid={`row-compra-${compra.entradaId}`}
                        >
                          <TableCell className="font-mono font-medium text-primary">
                            <span className="inline-flex items-center gap-1 underline underline-offset-4">
                              #{compra.folio}
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          </TableCell>
                          <TableCell>{formatDate(compra.fecha)}</TableCell>
                          <TableCell>{compra.nombreUbicacion}</TableCell>
                          <TableCell className="text-right text-sm">
                            <div>{compra.totalRollos} rll</div>
                            <div className="text-xs text-muted-foreground">{parseFloat(compra.cantidadTotal).toFixed(2)}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(compra.totalCosto)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(compra.abonado)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(compra.saldoPendiente)}</TableCell>
                          <TableCell>
                            <Badge variant={compra.estado === CompraConEstadoEstado.Pagada ? "default" : compra.estado === CompraConEstadoEstado.Parcial ? "secondary" : "destructive"}>
                              {compra.estado}
                            </Badge>
                          </TableCell>
                          {hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'crear') && (
                            <TableCell>
                              {compra.estado !== CompraConEstadoEstado.Pagada && (
                                <Button size="sm" variant="ghost" className="h-8 w-full text-xs" onClick={(event) => {
                                  event.stopPropagation();
                                  setPagoPreselectedEntrada(compra.entradaId);
                                  setIsPagoOpen(true);
                                }}>
                                  Pagar
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow data-testid="row-compras-totales">
                      <TableCell colSpan={4} className="font-semibold">
                        Compras del periodo: {comprasData?.total ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(comprasData?.totalCostoPeriodo ?? "0")}
                      </TableCell>
                      <TableCell colSpan={hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'crear') ? 4 : 3} className="text-right text-xs text-muted-foreground">
                        Total antes de paginar
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagos" className="mt-6 space-y-4">
            <div className="flex justify-end gap-2 mb-4">
              {hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'crear') && (
                <>
                  <Button variant="outline" onClick={() => setIsAjusteOpen(true)} className="text-muted-foreground" data-testid="button-registrar-ajuste">
                    Registrar Ajuste
                  </Button>
                  <Button onClick={() => { setPagoPreselectedEntrada(null); setIsPagoOpen(true); }} data-testid="button-registrar-pago">
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Pago
                  </Button>
                </>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ref / Folio / Notas</TableHead>
                      <TableHead className="text-right">Cargo (Deuda)</TableHead>
                      <TableHead className="text-right">Abono (Pago)</TableHead>
                      <TableHead className="text-right">Saldo Corrido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isEstadoCuentaLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-24">Cargando movimientos...</TableCell></TableRow>
                    ) : estadoCuenta?.movimientos.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No hay movimientos registrados.</TableCell></TableRow>
                    ) : (
                      estadoCuenta?.movimientos.map(mov => {
                        const importeNum = parseFloat(mov.importe);
                        const isCargo = importeNum > 0;
                        const isAbono = importeNum < 0;
                        return (
                          <TableRow key={mov.id} data-testid={`row-movimiento-${mov.id}`}>
                            <TableCell className="text-sm">{formatDate(mov.fecha)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                mov.tipo === TipoPagoProveedor.COMPRA ? "bg-red-50 text-red-700 border-red-200" :
                                mov.tipo === TipoPagoProveedor.PAGO ? "bg-green-50 text-green-700 border-green-200" :
                                "bg-orange-50 text-orange-700 border-orange-200"
                              }>
                                {mov.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              {mov.folio ? <span className="block font-mono text-xs">Entrada #{mov.folio}</span> : null}
                              {mov.formaPago ? <span className="block text-xs text-muted-foreground">{mov.formaPago}</span> : null}
                              {mov.referencia ? <span className="block text-xs truncate">Ref: {mov.referencia}</span> : null}
                              {mov.notas ? <span className="block text-xs text-muted-foreground truncate">{mov.notas}</span> : null}
                            </TableCell>
                            <TableCell className="text-right font-medium text-destructive">{isCargo ? formatCurrency(Math.abs(importeNum)) : ""}</TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">{isAbono ? formatCurrency(Math.abs(importeNum)) : ""}</TableCell>
                            <TableCell className="text-right font-semibold border-l bg-muted/5">{formatCurrency(mov.saldoAcumulado)}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estadisticas" className="mt-6 space-y-6">
             <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-lg border">
                <div className="space-y-1">
                   <Label>Desde</Label>
                   <Input type="date" value={estDesde} onChange={e => setEstDesde(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1">
                   <Label>Hasta</Label>
                   <Input type="date" value={estHasta} onChange={e => setEstHasta(e.target.value)} className="w-[160px]" />
                </div>
             </div>

             {isEstadisticasLoading ? (
               <div className="h-64 flex items-center justify-center animate-pulse text-muted-foreground">Calculando estadísticas...</div>
             ) : estadisticas ? (
               <>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card>
                       <CardContent className="p-4 flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">Total Comprado</span>
                          <span className="text-2xl font-bold">{formatCurrency(estadisticas.totalCompras)}</span>
                          {estadisticas.variacionVsPeriodoAnterior && (
                            <span className="text-xs text-muted-foreground">Vs ant: {estadisticas.variacionVsPeriodoAnterior}{String(estadisticas.variacionVsPeriodoAnterior).includes("%") ? "" : "%"}</span>
                          )}
                       </CardContent>
                    </Card>
                    <Card>
                       <CardContent className="p-4 flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">Compras</span>
                          <span className="text-2xl font-bold">{estadisticas.comprasCount}</span>
                       </CardContent>
                    </Card>
                    <Card>
                       <CardContent className="p-4 flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">Ticket promedio por compra</span>
                          <span className="text-2xl font-bold">{formatCurrency(estadisticas.ticketPromedio)}</span>
                       </CardContent>
                    </Card>
                    <Card>
                       <CardContent className="p-4 flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">Costo promedio por rollo</span>
                          <span className="text-2xl font-bold">{formatCurrency(estadisticas.costoPromedio)}</span>
                       </CardContent>
                    </Card>
                    <Card>
                       <CardContent className="p-4 flex flex-col gap-1">
                          <span className="text-sm font-medium text-muted-foreground">Última compra</span>
                          <span className="text-xl font-bold">{estadisticas.ultimaCompra ? formatDate(estadisticas.ultimaCompra) : "-"}</span>
                          {estadisticas.diasDesdeUltimaCompra != null && (
                            <span className="text-xs text-muted-foreground">Hace {estadisticas.diasDesdeUltimaCompra} días</span>
                          )}
                       </CardContent>
                    </Card>
                 </div>

                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg">Compras por Mes</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="h-[300px] w-full">
                       {estadisticas.porMes.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={estadisticas.porMes}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                             <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                             <YAxis tickFormatter={(val) => `$${val/1000}k`} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                             <Tooltip formatter={(value: any) => formatCurrency(value)} />
                             <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                           </BarChart>
                         </ResponsiveContainer>
                       ) : (
                         <div className="h-full flex items-center justify-center text-muted-foreground">No hay datos en el periodo</div>
                       )}
                     </div>
                   </CardContent>
                 </Card>

                 <Card>
                   <CardHeader>
                     <CardTitle className="text-lg">Productos Comprados</CardTitle>
                   </CardHeader>
                   <CardContent className="p-0">
                     <Table>
                       <TableHeader>
                         <TableRow className="bg-muted/10">
                           <TableHead>Producto (SKU)</TableHead>
                           <TableHead>Tela / Color</TableHead>
                           <TableHead className="text-right">Rollos / Cantidad</TableHead>
                           <TableHead className="text-right">Costo Promedio</TableHead>
                           <TableHead className="text-right">Total</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {estadisticas.porProducto.length === 0 ? (
                           <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No hay productos en el periodo</TableCell></TableRow>
                         ) : (
                           estadisticas.porProducto.map(prod => (
                             <TableRow key={prod.productoId}>
                               <TableCell className="font-medium font-mono text-sm">{prod.sku}</TableCell>
                               <TableCell>{prod.tela} <Badge variant="secondary" className="ml-2 font-normal text-[10px]">{prod.color}</Badge></TableCell>
                               <TableCell className="text-right text-sm">
                                 <div>{prod.totalRollos} rll</div>
                                 <div className="text-xs text-muted-foreground">{parseFloat(prod.cantidadTotal).toFixed(2)} {prod.unidad}</div>
                               </TableCell>
                               <TableCell className="text-right">
                                 <div className="font-medium">{formatCurrency(prod.costoPromedio)}</div>
                                 {prod.variacionCostoPct && <div className="text-[10px] text-muted-foreground">{prod.variacionCostoPct}{String(prod.variacionCostoPct).includes("%") ? "" : "%"} vs ant</div>}
                               </TableCell>
                               <TableCell className="text-right font-semibold">{formatCurrency(prod.totalCosto)}</TableCell>
                             </TableRow>
                           ))
                         )}
                       </TableBody>
                     </Table>
                   </CardContent>
                 </Card>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                   <Card>
                     <CardHeader>
                       <CardTitle className="text-lg">Por Tela</CardTitle>
                     </CardHeader>
                     <CardContent className="p-0">
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-muted/10">
                             <TableHead>Tela</TableHead>
                             <TableHead className="text-right">Rollos</TableHead>
                             <TableHead className="text-right">Total</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {estadisticas.porTela.map(tela => (
                             <TableRow key={tela.tela}>
                               <TableCell className="font-medium">{tela.tela}</TableCell>
                               <TableCell className="text-right">{tela.rollosCount}</TableCell>
                               <TableCell className="text-right font-semibold">{formatCurrency(tela.totalCosto)}</TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                       </Table>
                     </CardContent>
                   </Card>

                   <Card>
                     <CardHeader>
                       <CardTitle className="text-lg">Por Color</CardTitle>
                     </CardHeader>
                     <CardContent className="p-0">
                       <Table>
                         <TableHeader>
                           <TableRow className="bg-muted/10">
                             <TableHead>Color</TableHead>
                             <TableHead className="text-right">Rollos</TableHead>
                             <TableHead className="text-right">Total</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {estadisticas.porColor.map(color => (
                             <TableRow key={color.color}>
                               <TableCell className="font-medium flex items-center gap-2">
                                 <div className="w-3 h-3 rounded-full border shadow-sm" style={{ backgroundColor: color.color }}></div>
                                 {color.color}
                               </TableCell>
                               <TableCell className="text-right">{color.rollosCount}</TableCell>
                               <TableCell className="text-right font-semibold">{formatCurrency(color.totalCosto)}</TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                       </Table>
                     </CardContent>
                   </Card>
                 </div>
               </>
             ) : null}
          </TabsContent>
        </Tabs>

        <section
          className="print-only print-account-statement"
          aria-label="Estado de cuenta imprimible"
          data-testid="print-account-statement"
        >
          <div className="flex items-start justify-between border-b border-slate-300 pb-3">
            <div>
              <h2>Estado de cuenta del proveedor</h2>
              <p className="font-semibold">{proveedor.nombre}</p>
              <p>
                Generado:{" "}
                {new Intl.DateTimeFormat("es-MX", {
                  timeZone: "America/Mexico_City",
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(new Date())}
              </p>
            </div>
            <div className="text-right">
              <p>Saldo actual</p>
              <p className="text-xl font-bold">
                {formatCurrency(estadoCuenta?.saldoActual ?? "0")}
              </p>
            </div>
          </div>

          <h3>Compras</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Ubicación</th>
                <th className="amount">Rollos</th>
                <th className="amount">Cantidad</th>
                <th className="amount">Total</th>
                <th className="amount">Abonado</th>
                <th className="amount">Saldo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {comprasData?.items.length ? (
                comprasData.items.map((compra) => (
                  <tr key={`print-compra-${compra.entradaId}`}>
                    <td>#{compra.folio}</td>
                    <td>{formatDate(compra.fecha)}</td>
                    <td>{compra.nombreUbicacion}</td>
                    <td className="amount">{compra.totalRollos}</td>
                    <td className="amount">{parseFloat(compra.cantidadTotal).toFixed(2)}</td>
                    <td className="amount">{formatCurrency(compra.totalCosto)}</td>
                    <td className="amount">{formatCurrency(compra.abonado)}</td>
                    <td className="amount">{formatCurrency(compra.saldoPendiente)}</td>
                    <td>{compra.estado}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>No hay compras para los filtros seleccionados.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
                  <strong>Compras del periodo: {comprasData?.total ?? 0}</strong>
                </td>
                <td className="amount">
                  <strong>{formatCurrency(comprasData?.totalCostoPeriodo ?? "0")}</strong>
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>

          <h3>Movimientos y pagos</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Referencia</th>
                <th className="amount">Cargo</th>
                <th className="amount">Abono</th>
                <th className="amount">Saldo corrido</th>
              </tr>
            </thead>
            <tbody>
              {estadoCuenta?.movimientos.length ? (
                estadoCuenta.movimientos.map((movimiento) => {
                  const importe = parseFloat(movimiento.importe);
                  return (
                    <tr key={`print-movimiento-${movimiento.id}`}>
                      <td>{formatDate(movimiento.fecha)}</td>
                      <td>{movimiento.tipo}</td>
                      <td>
                        {movimiento.folio ? `Entrada #${movimiento.folio}` : ""}
                        {movimiento.referencia ? ` · ${movimiento.referencia}` : ""}
                        {movimiento.notas ? ` · ${movimiento.notas}` : ""}
                      </td>
                      <td className="amount">
                        {importe > 0 ? formatCurrency(importe) : ""}
                      </td>
                      <td className="amount">
                        {importe < 0 ? formatCurrency(Math.abs(importe)) : ""}
                      </td>
                      <td className="amount">
                        {formatCurrency(movimiento.saldoAcumulado)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>No hay movimientos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {isAdmin && (
        <PagoDialog
          open={isPagoOpen}
          onClose={() => setIsPagoOpen(false)}
          proveedorId={provId}
          entradaId={pagoPreselectedEntrada}
        />
      )}

      {isAdmin && (
        <AjusteDialog
          open={isAjusteOpen}
          onClose={() => setIsAjusteOpen(false)}
          proveedorId={provId}
        />
      )}
    </AppLayout>
  );
}

function PagoDialog({ open, onClose, proveedorId, entradaId }: { open: boolean, onClose: () => void, proveedorId: number, entradaId: number | null }) {
  const registrarPago = useRegistrarPagoProveedor();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    importe: string;
    formaPago: FormaPagoProveedor;
    fecha: string;
    referencia: string;
    notas: string;
  }>({
    importe: "",
    formaPago: FormaPagoProveedor.TRANSFERENCIA,
    fecha: new Date().toISOString().split("T")[0],
    referencia: "",
    notas: ""
  });

  useEffect(() => {
    if (open) {
      setFormData({
        importe: "",
        formaPago: FormaPagoProveedor.TRANSFERENCIA,
        fecha: new Date().toISOString().split("T")[0],
        referencia: "",
        notas: ""
      });
    }
  }, [open]);

  const handleSubmit = () => {
    const importe = parseFloat(formData.importe);
    if (isNaN(importe) || importe <= 0) {
      toast.error("Importe inválido", { description: "El importe debe ser mayor a 0." });
      return;
    }

    registrarPago.mutate({
      id: proveedorId,
      data: {
        importe: importe,
        formaPago: formData.formaPago,
        fecha: new Date(`${formData.fecha}T12:00:00-06:00`).toISOString(),
        referencia: formData.referencia.trim() || null,
        notas: formData.notas.trim() || null,
        entradaId: entradaId
      }
    }, {
      onSuccess: () => {
        toast.success("Pago registrado exitosamente");
        // Invalidar las queries relevantes
        queryClient.invalidateQueries({ queryKey: getListProveedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListComprasProveedorQueryKey(proveedorId) });
        queryClient.invalidateQueries({ queryKey: getEstadoCuentaProveedorQueryKey(proveedorId) });
        queryClient.invalidateQueries({ queryKey: getEstadisticasProveedorQueryKey(proveedorId) });
        onClose();
      },
      onError: (err: any) => {
        toast.error("Error al registrar pago", { description: getErrorMessage(err) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            {entradaId ? `Abonar a la orden de compra #${entradaId}` : "Abono general a la cuenta del proveedor"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Importe a Pagar *</Label>
              <Input
                type="number" step="0.01" min="0.01"
                value={formData.importe}
                onChange={e => setFormData({...formData, importe: e.target.value})}
                placeholder="0.00"
                data-testid="input-pago-importe"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha del Pago</Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={e => setFormData({...formData, fecha: e.target.value})}
                data-testid="input-pago-fecha"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pago</Label>
            <Select value={formData.formaPago} onValueChange={(v: FormaPagoProveedor) => setFormData({...formData, formaPago: v})}>
              <SelectTrigger data-testid="select-pago-forma"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value={FormaPagoProveedor.TRANSFERENCIA}>Transferencia</SelectItem>
                <SelectItem value={FormaPagoProveedor.CHEQUE}>Cheque</SelectItem>
                <SelectItem value={FormaPagoProveedor.EFECTIVO}>Efectivo</SelectItem>
                <SelectItem value={FormaPagoProveedor.OTRO}>Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Referencia (OP/Cheque)</Label>
            <Input
              value={formData.referencia}
              onChange={e => setFormData({...formData, referencia: e.target.value})}
              placeholder="Ej. OP-1234567"
              data-testid="input-pago-referencia"
            />
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Input
              value={formData.notas}
              onChange={e => setFormData({...formData, notas: e.target.value})}
              placeholder="Comentarios adicionales"
              data-testid="input-pago-notas"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={registrarPago.isPending} data-testid="button-confirm-pago">
            {registrarPago.isPending ? "Procesando..." : "Confirmar Pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AjusteDialog({ open, onClose, proveedorId }: { open: boolean, onClose: () => void, proveedorId: number }) {
  const registrarAjuste = useRegistrarAjusteProveedor();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    importe: string;
    notas: string;
  }>({
    importe: "",
    notas: ""
  });

  useEffect(() => {
    if (open) {
      setFormData({ importe: "", notas: "" });
    }
  }, [open]);

  const handleSubmit = () => {
    const importe = parseFloat(formData.importe);
    if (isNaN(importe)) {
      toast.error("Importe inválido", { description: "Debe ingresar una cantidad." });
      return;
    }
    if (formData.notas.trim().length < 10) {
      toast.error("Notas insuficientes", { description: "La justificación debe tener al menos 10 caracteres." });
      return;
    }

    registrarAjuste.mutate({
      id: proveedorId,
      data: {
        importe: importe,
        notas: formData.notas.trim()
      }
    }, {
      onSuccess: () => {
        toast.success("Ajuste registrado exitosamente");
        queryClient.invalidateQueries({ queryKey: getListProveedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getEstadoCuentaProveedorQueryKey(proveedorId) });
        queryClient.invalidateQueries({ queryKey: getEstadisticasProveedorQueryKey(proveedorId) });
        onClose();
      },
      onError: (err: any) => {
        toast.error("Error al registrar ajuste", { description: getErrorMessage(err) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Registrar Ajuste de Saldo</DialogTitle>
          <DialogDescription>
            Un ajuste positivo (+) aumenta la deuda. Un ajuste negativo (-) reduce la deuda.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Importe del Ajuste *</Label>
            <Input
              type="number" step="0.01"
              value={formData.importe}
              onChange={e => setFormData({...formData, importe: e.target.value})}
              placeholder="Ej. -500.00 para reducir deuda"
              data-testid="input-ajuste-importe"
            />
            <p className="text-[10px] text-muted-foreground">Use signo menos (-) para un saldo a favor de Mariana Textil.</p>
          </div>

          <div className="space-y-2">
            <Label>Justificación (obligatorio) *</Label>
            <Input
              value={formData.notas}
              onChange={e => setFormData({...formData, notas: e.target.value})}
              placeholder="Motivo detallado del ajuste"
              data-testid="input-ajuste-notas"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={registrarAjuste.isPending} data-testid="button-confirm-ajuste">
            {registrarAjuste.isPending ? "Procesando..." : "Confirmar Ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
