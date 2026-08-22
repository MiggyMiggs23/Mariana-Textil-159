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
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredProveedores = useMemo(() => {
    if (!proveedores) return [];
    return proveedores.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.contactoNombre || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filterTipo === "ALL" || p.tipo === filterTipo;
      return matchSearch && matchTipo;
    });
  }, [proveedores, searchTerm, filterTipo]);

  const canEdit = user?.rol === Role.ADMIN || user?.rol === Role.INVENTARIOS || user?.rol === Role.BODEGA;

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
              <SelectTrigger className="w-full sm:w-[200px] bg-background" data-testid="select-filter-supplier-tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los tipos</SelectItem>
                <SelectItem value={TipoProveedor.NACIONAL}>Nacional</SelectItem>
                <SelectItem value={TipoProveedor.IMPORTACION}>Importación</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10 hover:bg-muted/10">
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo y Moneda</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="animate-pulse flex flex-col items-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        Cargando proveedores...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProveedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No se encontraron proveedores.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProveedores.map(p => (
                    <TableRow 
                      key={p.id} 
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      data-testid={`row-supplier-${p.id}`}
                    >
                      <TableCell>
                        <Link href={`/proveedores/${p.id}`} className="block h-full w-full py-2">
                          <div className="font-bold text-foreground text-base" data-testid={`display-supplier-name-${p.id}`}>{p.nombre}</div>
                          {p.notas && <div className="text-xs text-muted-foreground truncate max-w-[250px]">{p.notas}</div>}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={p.tipo === TipoProveedor.NACIONAL ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}>
                            {p.tipo === TipoProveedor.NACIONAL ? <Building2 className="w-3 h-3 mr-1" /> : <Globe2 className="w-3 h-3 mr-1" />}
                            {p.tipo}
                          </Badge>
                          <Badge variant="secondary" className="font-mono text-[10px]">{p.monedaDefault}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.contactoNombre ? (
                          <>
                            <div className="font-medium text-sm">{p.contactoNombre}</div>
                            <div className="text-xs text-muted-foreground">{p.telefono || "Sin teléfono"}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Sin contacto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{p.pais || "-"}</div>
                      </TableCell>
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
