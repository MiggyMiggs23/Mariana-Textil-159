import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListCamionetas,
  useCreateCamioneta,
  useUpdateCamioneta,
  getListCamionetasQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Camioneta,
  CamionetaInput
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
import { Search, Plus, Truck, Edit } from "lucide-react";
import { hasPermission, Modules } from "@/lib/permisos";
import { Switch } from "@/components/ui/switch";
import { PurgaCatalogoButton } from "@/components/purga-catalogo-button";

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

export default function Camionetas() {
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const { data: camionetas, isLoading } = useListCamionetas(undefined, {
    query: { queryKey: getListCamionetasQueryKey() }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState("ACTIVE");
  const [filterTipo, setFilterTipo] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCamioneta, setEditingCamioneta] = useState<Camioneta | null>(null);

  const canEdit = hasPermission(user, Modules.CAMIONETAS, 'crear');
  const isAdmin = user?.rol === "ADMIN";

  const filteredCamionetas = useMemo(() => {
    if (!camionetas) return [];
    return camionetas.filter(c => {
      const matchSearch = c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.placas.toLowerCase().includes(searchTerm.toLowerCase());
      const matchEstado = filterEstado === "ALL" ||
                          (filterEstado === "ACTIVE" ? c.activa : !c.activa);
      const matchTipo = filterTipo === "ALL" || c.tipo === filterTipo;

      return matchSearch && matchEstado && matchTipo;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [camionetas, searchTerm, filterEstado, filterTipo]);

  const handleEdit = (camioneta: Camioneta) => {
    setEditingCamioneta(camioneta);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCamioneta(null);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Camionetas</h1>
            <p className="text-muted-foreground mt-2">
              Gestión de vehículos propios y subcontratados.
            </p>
          </div>
          {canEdit && (
            <Button onClick={handleCreate} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Camioneta
            </Button>
          )}
        </div>

        <Card>
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center bg-muted/20">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por alias o placas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full bg-background"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-[150px] bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos (Tipo)</SelectItem>
                <SelectItem value="PROPIA">Propia</SelectItem>
                <SelectItem value="CONTRATADA">Contratada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-full sm:w-[150px] bg-background">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos (Estado)</SelectItem>
                <SelectItem value="ACTIVE">Activas</SelectItem>
                <SelectItem value="INACTIVE">Inactivas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableHead>Alias / Nombre</TableHead>
                    <TableHead>Placas</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                    {canEdit && <TableHead className="text-right w-20">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 6 : 5} className="h-32 text-center">
                        <div className="animate-pulse flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                          Cargando camionetas...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredCamionetas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 6 : 5} className="h-32 text-center text-muted-foreground">
                        No se encontraron camionetas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCamionetas.map(c => (
                      <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-bold text-foreground">{c.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{c.placas}</Badge>
                        </TableCell>
                        <TableCell>
                          {(c.marca || c.modelo) ? (
                            <span className="text-sm text-muted-foreground">
                              {[c.marca, c.modelo].filter(Boolean).join(' ')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={c.tipo === "PROPIA" ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : "bg-orange-100 text-orange-800 hover:bg-orange-100"}>
                            <Truck className="w-3 h-3 mr-1" />
                            {c.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={c.activa ? "default" : "secondary"}>
                            {c.activa ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            {isAdmin && !c.activa && (
                              <PurgaCatalogoButton entidad="camionetas" id={c.id} nombreVisible={c.nombre} invalidateQueryKey={getListCamionetasQueryKey()} />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    Cargando camionetas...
                  </div>
                </div>
              ) : filteredCamionetas.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No se encontraron camionetas.
                </div>
              ) : (
                filteredCamionetas.map(c => (
                  <div key={c.id} className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-foreground">{c.nombre}</div>
                        <Badge variant="outline" className="font-mono mt-1">{c.placas}</Badge>
                      </div>
                      <Badge variant={c.activa ? "default" : "secondary"}>
                        {c.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="text-sm text-muted-foreground">
                        {[c.marca, c.modelo].filter(Boolean).join(' ') || "Sin detalles"}
                      </div>
                      <Badge variant="secondary" className={c.tipo === "PROPIA" ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : "bg-orange-100 text-orange-800 hover:bg-orange-100"}>
                        <Truck className="w-3 h-3 mr-1" />
                        {c.tipo}
                      </Badge>
                    </div>

                    {canEdit && (
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        {isAdmin && !c.activa && (
                          <PurgaCatalogoButton entidad="camionetas" id={c.id} nombreVisible={c.nombre} invalidateQueryKey={getListCamionetasQueryKey()} />
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <CamionetaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        camioneta={editingCamioneta}
      />
    </AppLayout>
  );
}

function CamionetaDialog({ open, onClose, camioneta }: { open: boolean, onClose: () => void, camioneta: Camioneta | null }) {
  const createMutation = useCreateCamioneta();
  const updateMutation = useUpdateCamioneta();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CamionetaInput & { activa?: boolean }>({
    nombre: "",
    placas: "",
    marca: "",
    modelo: "",
    tipo: "PROPIA"
  });

  // Load data when opening for edit
  useEffect(() => {
    if (open) {
      if (camioneta) {
        setFormData({
          nombre: camioneta.nombre,
          placas: camioneta.placas,
          marca: camioneta.marca || "",
          modelo: camioneta.modelo || "",
          tipo: camioneta.tipo,
          activa: camioneta.activa
        });
      } else {
        setFormData({
          nombre: "",
          placas: "",
          marca: "",
          modelo: "",
          tipo: "PROPIA",
          activa: true
        });
      }
    }
  }, [open, camioneta]);

  const handleSubmit = () => {
    if (!formData.nombre.trim() || !formData.placas.trim()) {
      toast.error("Datos incompletos", { description: "El nombre y placas son obligatorios." });
      return;
    }

    const payload = {
      nombre: formData.nombre.trim(),
      placas: formData.placas.trim().toUpperCase(),
      marca: formData.marca?.trim() || null,
      modelo: formData.modelo?.trim() || null,
      tipo: formData.tipo,
    };

    if (camioneta) {
      updateMutation.mutate({
        id: camioneta.id,
        data: { ...payload, activa: formData.activa }
      }, {
        onSuccess: () => {
          toast.success("Camioneta actualizada exitosamente");
          queryClient.invalidateQueries({ queryKey: getListCamionetasQueryKey() });
          onClose();
        },
        onError: (err) => {
          toast.error("Error al actualizar camioneta", { description: getErrorMessage(err) });
        }
      });
    } else {
      createMutation.mutate({
        data: payload
      }, {
        onSuccess: () => {
          toast.success("Camioneta registrada exitosamente");
          queryClient.invalidateQueries({ queryKey: getListCamionetasQueryKey() });
          onClose();
        },
        onError: (err) => {
          toast.error("Error al registrar camioneta", { description: getErrorMessage(err) });
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{camioneta ? "Editar Camioneta" : "Nueva Camioneta"}</DialogTitle>
          <DialogDescription>
            {camioneta ? "Modifica los datos de la camioneta seleccionada." : "Registra un nuevo vehículo en el catálogo."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Alias / Nombre *</Label>
              <Input
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value})}
                placeholder="Camioneta 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Placas *</Label>
              <Input
                value={formData.placas}
                onChange={e => setFormData({...formData, placas: e.target.value.toUpperCase()})}
                placeholder="ABC-123-A"
                className="font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Vehículo</Label>
            <Select value={formData.tipo} onValueChange={(v: "PROPIA" | "CONTRATADA") => setFormData({...formData, tipo: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROPIA">Propia</SelectItem>
                <SelectItem value="CONTRATADA">Contratada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Marca (Opcional)</Label>
              <Input
                value={formData.marca || ""}
                onChange={e => setFormData({...formData, marca: e.target.value})}
                placeholder="Nissan"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo (Opcional)</Label>
              <Input
                value={formData.modelo || ""}
                onChange={e => setFormData({...formData, modelo: e.target.value})}
                placeholder="NP300 2024"
              />
            </div>
          </div>

          {camioneta && (
            <div className="flex items-center justify-between mt-4 p-3 bg-muted/50 rounded-md border">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Estado de la camioneta</Label>
                <p className="text-xs text-muted-foreground">
                  Desactivar impide su uso en nuevos viajes
                </p>
              </div>
              <Switch
                checked={formData.activa}
                onCheckedChange={(checked) => setFormData({...formData, activa: checked})}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Guardando..." : (camioneta ? "Guardar cambios" : "Registrar camioneta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
