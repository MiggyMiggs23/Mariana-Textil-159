import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Link } from "wouter";
import {
  useListProveedores,
  useCreateProveedor,
  getListProveedoresQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
  TipoProveedor,
  Moneda,
  useGetAnaliticaGlobalProveedores,
  getGetAnaliticaGlobalProveedoresQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Plus, Truck, Building2, Globe2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { hasPermission, Modules } from "@/lib/permisos";
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

function formatDate(dateStr: string | null): string {
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

export default function Proveedores() {
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const { data: proveedores, isLoading } = useListProveedores({
    query: { queryKey: getListProveedoresQueryKey() }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState("ALL");
  const [filterEstado, setFilterEstado] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"AZ" | "SALDO">("AZ");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const canEdit = hasPermission(user, Modules.PROVEEDORES, 'crear');
  const canViewFinanzas = hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'ver');
  const { data: analitica, isLoading: isAnaliticaLoading } = useGetAnaliticaGlobalProveedores({
    query: { enabled: canViewFinanzas, queryKey: getGetAnaliticaGlobalProveedoresQueryKey() }
  });

  const filteredProveedores = useMemo(() => {
    if (!proveedores?.items) return [];
    return proveedores.items.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.contactoNombre || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filterTipo === "ALL" || p.tipo === filterTipo;
      const matchEstado = filterEstado === "ALL" ||
                          (filterEstado === "ACTIVE" ? p.activo : !p.activo);
      return matchSearch && matchTipo && matchEstado;
    });
  }, [proveedores, searchTerm, filterTipo, filterEstado]);

  // Sort by A-Z or balance
  const sortedProveedores = useMemo(() => {
    const list = [...filteredProveedores].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
    if (sortOrder === "SALDO" && canViewFinanzas) {
      return list.sort((a, b) => {
        const saldoA = parseFloat(a.saldoPendiente ?? "0") || 0;
        const saldoB = parseFloat(b.saldoPendiente ?? "0") || 0;
        return saldoB - saldoA;
      });
    }
    return list;
  }, [canViewFinanzas, filteredProveedores, sortOrder]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Proveedores</h1>
            <p className="text-muted-foreground mt-2">
              Gestión de proveedores nacionales y de importación.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto" data-testid="button-create-supplier">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Proveedor
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {canViewFinanzas && (
            <>
              <Card>
                <CardContent className="p-4 flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Total Deuda</span>
                  <span className="text-2xl font-bold">{formatNumber(proveedores?.totalDeuda ?? "0", { kind: "money" })}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Compras del Mes</span>
                  <span className="text-2xl font-bold">{formatNumber(proveedores?.comprasMes ?? "0", { kind: "money" })}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Proveedores con Saldo</span>
                  <span className="text-2xl font-bold">{formatNumber(proveedores?.proveedoresConSaldo || 0, { kind: "count" })}</span>
                </CardContent>
              </Card>
            </>
          )}
          <Card>
            <CardContent className="p-4 flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Total Proveedores</span>
              <span className="text-2xl font-bold">{formatNumber(proveedores?.totalProveedores || 0, { kind: "count" })}</span>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="proveedores">
          <TabsList>
            <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
            {canViewFinanzas && <TabsTrigger value="analisis">Análisis global</TabsTrigger>}
          </TabsList>
          <TabsContent value="proveedores">
        <Card>
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center bg-muted/20">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o contacto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full bg-background"
                data-testid="input-search-supplier"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-[150px] bg-background" data-testid="select-filter-supplier-tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos (Tipo)</SelectItem>
                <SelectItem value={TipoProveedor.NACIONAL}>Nacional</SelectItem>
                <SelectItem value={TipoProveedor.IMPORTACION}>Importación</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-full sm:w-[150px] bg-background" data-testid="select-filter-supplier-estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos (Estado)</SelectItem>
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="INACTIVE">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            {canViewFinanzas && (
              <Select value={sortOrder} onValueChange={(val: "AZ" | "SALDO") => setSortOrder(val)}>
                <SelectTrigger className="w-full sm:w-[150px] bg-background" data-testid="select-sort-supplier">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AZ">Nombre A-Z</SelectItem>
                  <SelectItem value="SALDO">Mayor Deuda</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableHead>Proveedor / Contacto</TableHead>
                    <TableHead>Tipo</TableHead>
                    {canViewFinanzas && (
                      <>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Comprado (12m)</TableHead>
                      </>
                    )}
                    {canViewFinanzas && <TableHead>Última Compra</TableHead>}
                    <TableHead className="text-right">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={canViewFinanzas ? 6 : 4} className="h-32 text-center">
                        <div className="animate-pulse flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                          Cargando proveedores...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sortedProveedores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canViewFinanzas ? 6 : 4} className="h-32 text-center text-muted-foreground">
                        No se encontraron proveedores.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedProveedores.map(p => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        data-testid={`row-supplier-${p.id}`}
                      >
                        <TableCell>
                          <Link href={`/proveedores/${p.id}`} className="block h-full w-full py-2">
                            <div className="font-bold text-foreground text-base" data-testid={`display-supplier-name-${p.id}`}>{p.nombre}</div>
                            {p.contactoNombre && <div className="text-xs text-muted-foreground">{p.contactoNombre}</div>}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={p.tipo === TipoProveedor.NACIONAL ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
                              {p.tipo === TipoProveedor.NACIONAL ? <Building2 className="w-3 h-3 mr-1" /> : <Globe2 className="w-3 h-3 mr-1" />}
                              {p.tipo}
                            </Badge>
                          </div>
                        </TableCell>
                        {canViewFinanzas && (
                          <>
                            <TableCell className="text-right">
                              <div className={`font-semibold ${parseFloat(p.saldoPendiente ?? "0") > 0 ? "text-destructive" : ""}`}>
                                 {formatNumber(p.saldoPendiente ?? "0", { kind: "money" })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-sm font-medium">{formatNumber(p.totalComprado12Meses ?? "0", { kind: "money" })}</div>
                            </TableCell>
                          </>
                        )}
                        {canViewFinanzas && (
                          <TableCell>
                            <div className="text-sm">{formatDate(p.ultimaCompra ?? null)}</div>
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <Badge variant={p.activo ? "default" : "secondary"}>
                            {p.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
          </TabsContent>
          {canViewFinanzas && (
            <TabsContent value="analisis" className="space-y-6">
              {isAnaliticaLoading ? <Card><CardContent className="p-12 text-center">Calculando análisis...</CardContent></Card> : analitica && (
                <>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card><CardContent className="pt-6"><h2 className="font-semibold mb-4">Tendencia mensual de compras</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={analitica.tendenciaMensual}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="mes"/><YAxis/><Tooltip formatter={(v) => formatNumber(Number(v), { kind: "money" })}/><Bar dataKey="total" fill="hsl(var(--primary))"/></BarChart></ResponsiveContainer></div></CardContent></Card>
                    <Card><CardContent className="pt-6"><h2 className="font-semibold mb-4">Deuda por proveedor</h2><div className="space-y-3">{analitica.deuda.map(d => <div key={d.proveedorId} className="flex justify-between border-b pb-2"><Link href={`/proveedores/${d.proveedorId}`} className="font-medium hover:underline">{d.proveedor}</Link><span className="text-destructive font-semibold">{formatNumber(d.saldo, { kind: "money" })}</span></div>)}</div></CardContent></Card>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card><CardContent className="pt-6"><h2 className="font-semibold mb-4">Pareto de compras</h2><Table><TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead className="text-right">Comprado</TableHead><TableHead className="text-right">% acumulado</TableHead></TableRow></TableHeader><TableBody>{analitica.pareto.map(p => <TableRow key={p.proveedorId}><TableCell>{p.proveedor}</TableCell><TableCell className="text-right">{formatNumber(p.total, { kind: "money" })}</TableCell><TableCell className="text-right">{formatNumber(p.porcentajeAcumulado, { kind: "percentage", percentageInput: "percent" })}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
                    <Card><CardContent className="pt-6"><h2 className="font-semibold mb-4">Costos al alza</h2><Table><TableHeader><TableRow><TableHead>Producto / proveedor</TableHead><TableHead className="text-right">Anterior</TableHead><TableHead className="text-right">Actual</TableHead></TableRow></TableHeader><TableBody>{analitica.costosAlAlza.map(c => <TableRow key={`${c.productoId}-${c.proveedor}`}><TableCell><b>{c.sku}</b><div className="text-xs text-muted-foreground">{c.proveedor} · +{formatNumber(c.variacionPct, { kind: "percentage", percentageInput: "percent" })}</div></TableCell><TableCell className="text-right">{formatNumber(c.costoAnterior, { kind: "money" })}</TableCell><TableCell className="text-right font-semibold">{formatNumber(c.costoActual, { kind: "money" })}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6">
                    <Card><CardContent className="pt-6"><h2 className="font-semibold mb-4">Antigüedad global de deuda</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={[
                      { rango:"0–30", saldo:Number(analitica.antiguedadDeuda.hasta30) },
                      { rango:"31–60", saldo:Number(analitica.antiguedadDeuda.de31a60) },
                      { rango:"61–90", saldo:Number(analitica.antiguedadDeuda.de61a90) },
                      { rango:"90+", saldo:Number(analitica.antiguedadDeuda.mas90) },
                    ]}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="rango"/><YAxis/><Tooltip formatter={(v) => formatNumber(Number(v), { kind: "money" })}/><Bar dataKey="saldo" fill="hsl(var(--destructive))"/></BarChart></ResponsiveContainer></div></CardContent></Card>
                    <Card className="md:col-span-2"><CardContent className="pt-6"><h2 className="font-semibold mb-4">Comparación del mismo producto entre proveedores</h2><div className="max-h-80 overflow-auto"><Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Costos por proveedor</TableHead><TableHead className="text-right">Más barato / ahorro</TableHead></TableRow></TableHeader><TableBody>{analitica.comparacionCostos.map(p => <TableRow key={p.productoId}><TableCell><b>{p.sku}</b><div className="text-xs text-muted-foreground">{p.unidad}</div></TableCell><TableCell className="text-xs">{p.proveedores.map(x => `${x.proveedor}: ${formatNumber(x.costoUnitario, { kind: "money" })}`).join(" · ")}</TableCell><TableCell className="text-right"><b>{p.proveedorMasBarato}</b><div className="text-xs text-emerald-700">hasta {formatNumber(p.ahorroPct, { kind: "percentage", percentageInput: "percent" })}</div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
                  </div>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      <CreateProveedorDialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </AppLayout>
  );
}

function CreateProveedorDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const createProveedor = useCreateProveedor();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    nombre: string;
    tipo: TipoProveedor;
    monedaDefault: Moneda;
    contactoNombre: string;
    telefono: string;
    correo: string;
    pais: string;
    notas: string;
  }>({
    nombre: "",
    tipo: TipoProveedor.NACIONAL,
    monedaDefault: Moneda.MXN,
    contactoNombre: "",
    telefono: "",
    correo: "",
    pais: "",
    notas: ""
  });

  const handleSubmit = () => {
    if (!formData.nombre.trim()) {
      toast.error("Datos incompletos", { description: "El nombre del proveedor es obligatorio." });
      return;
    }

    createProveedor.mutate({
      data: {
        nombre: formData.nombre.trim(),
        tipo: formData.tipo,
        monedaDefault: formData.monedaDefault,
        contactoNombre: formData.contactoNombre.trim() || null,
        telefono: formData.telefono.trim() || null,
        correo: formData.correo.trim() || null,
        pais: formData.pais.trim() || null,
        notas: formData.notas.trim() || null
      }
    }, {
      onSuccess: () => {
        toast.success("Proveedor creado exitosamente");
        queryClient.invalidateQueries({ queryKey: getListProveedoresQueryKey() });
        setFormData({
          nombre: "", tipo: TipoProveedor.NACIONAL, monedaDefault: Moneda.MXN, contactoNombre: "", telefono: "", correo: "", pais: "", notas: ""
        });
        onClose();
      },
      onError: (err: any) => {
        toast.error("Error al crear proveedor", { description: getErrorMessage(err) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Proveedor</DialogTitle>
          <DialogDescription>Registra un nuevo socio comercial en el sistema.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Razón Social / Nombre Comercial *</Label>
            <Input
              value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})}
              placeholder="TEXTILES DE MÉXICO S.A. DE C.V."
              data-testid="input-create-supplier-nombre"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Proveedor</Label>
              <Select value={formData.tipo} onValueChange={(v: TipoProveedor) => setFormData({...formData, tipo: v})}>
                <SelectTrigger data-testid="input-create-supplier-tipo"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TipoProveedor.NACIONAL}>Nacional</SelectItem>
                  <SelectItem value={TipoProveedor.IMPORTACION}>Importación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Moneda por Defecto</Label>
              <Select value={formData.monedaDefault} onValueChange={(v: Moneda) => setFormData({...formData, monedaDefault: v})}>
                <SelectTrigger data-testid="input-create-supplier-moneda"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value={Moneda.MXN}>MXN - Peso Mexicano</SelectItem>
                  <SelectItem value={Moneda.USD}>USD - Dólar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2">
            <div className="space-y-2">
              <Label>Nombre de Contacto</Label>
              <Input value={formData.contactoNombre} onChange={e => setFormData({...formData, contactoNombre: e.target.value})} data-testid="input-create-supplier-contacto" />
            </div>
            <div className="space-y-2">
              <Label>País de Origen</Label>
              <Input value={formData.pais} onChange={e => setFormData({...formData, pais: e.target.value.toUpperCase()})} placeholder="Ej. MÉXICO, CHINA" data-testid="input-create-supplier-pais" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} type="tel" data-testid="input-create-supplier-telefono" />
            </div>
            <div className="space-y-2">
              <Label>Correo Electrónico</Label>
              <Input value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} type="email" data-testid="input-create-supplier-correo" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas Adicionales</Label>
            <Input value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} placeholder="Condiciones de crédito, tiempos de entrega, etc." data-testid="input-create-supplier-notas" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createProveedor.isPending} data-testid="button-save-supplier-create">
            {createProveedor.isPending ? "Guardando..." : "Registrar Proveedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
