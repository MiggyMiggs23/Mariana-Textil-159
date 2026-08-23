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
  Moneda
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
import { toast } from "sonner";
import { Search, Plus, Truck, Building2, Globe2 } from "lucide-react";
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

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(num);
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const canEdit = hasPermission(user, Modules.PROVEEDORES, 'crear');
  const canViewFinanzas = hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'ver');

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

  // Sort by pending balance desc
  const sortedProveedores = useMemo(() => {
    if (!canViewFinanzas) return filteredProveedores;
    return [...filteredProveedores].sort((a, b) => {
      const saldoA = parseFloat(a.saldoPendiente ?? "0") || 0;
      const saldoB = parseFloat(b.saldoPendiente ?? "0") || 0;
      return saldoB - saldoA;
    });
  }, [canViewFinanzas, filteredProveedores]);

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
                  <span className="text-2xl font-bold">{formatCurrency(proveedores?.totalDeuda ?? "0")}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Compras del Mes</span>
                  <span className="text-2xl font-bold">{formatCurrency(proveedores?.comprasMes ?? "0")}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col gap-1">
                  <span className="text-sm font-medium text-muted-foreground">Proveedores con Saldo</span>
                  <span className="text-2xl font-bold">{proveedores?.proveedoresConSaldo || 0}</span>
                </CardContent>
              </Card>
            </>
          )}
          <Card>
            <CardContent className="p-4 flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Total Proveedores</span>
              <span className="text-2xl font-bold">{proveedores?.totalProveedores || 0}</span>
            </CardContent>
          </Card>
        </div>

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
                                {formatCurrency(p.saldoPendiente ?? "0")}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="text-sm font-medium">{formatCurrency(p.totalComprado12Meses ?? "0")}</div>
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
