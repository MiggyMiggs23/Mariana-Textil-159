import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListLocations,
  useCreateLocation,
  useUpdateLocation,
  Location,
  LocationInputTipo,
  useGetCurrentUser,
  getListLocationsQueryKey,
  useListPisosLocation,
  useCreatePisoLocation,
  useUpdatePisoLocation,
  getListPisosLocationQueryKey,
  Piso
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Loader2 } from "lucide-react";
import { Modules, hasPermission } from "@/lib/permisos";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";

function PisosSitio({ locationId, active }: { locationId: number, active: boolean }) {
  const queryClient = useQueryClient();
  const { data: pisos, isLoading } = useListPisosLocation(locationId);
  const createPiso = useCreatePisoLocation();
  const updatePiso = useUpdatePisoLocation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editActivo, setEditActivo] = useState(true);

  const [creating, setCreating] = useState(false);
  const [createNombre, setCreateNombre] = useState("");

  const handleCreate = () => {
    if (!createNombre.trim()) return;
    createPiso.mutate({ id: locationId, data: { nombre: createNombre.trim() } }, {
      onSuccess: () => {
        toast.success("Piso creado");
        setCreating(false);
        setCreateNombre("");
        queryClient.invalidateQueries({ queryKey: getListPisosLocationQueryKey(locationId) });
      },
      onError: (err: any) => toast.error("Error al crear piso", { description: err.data?.error || err.message })
    });
  };

  const handleUpdate = (pisoId: number) => {
    if (!editNombre.trim()) return;
    updatePiso.mutate({ id: locationId, pisoId, data: { nombre: editNombre.trim(), activo: editActivo } }, {
      onSuccess: () => {
        toast.success("Piso actualizado");
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListPisosLocationQueryKey(locationId) });
      },
      onError: (err: any) => toast.error("Error al actualizar piso", { description: err.data?.error || err.message })
    });
  };

  if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin w-5 h-5 text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 border-t pt-4 mt-6">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Pisos / Divisiones</h4>
        {active && (
          <Button variant="outline" size="sm" onClick={() => { setCreating(true); setCreateNombre(""); }} disabled={creating}>
            <Plus className="w-3 h-3 mr-1" /> Agregar
          </Button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 p-2 border rounded bg-muted/30">
          <Input
            size={1}
            className="h-8"
            placeholder="Nombre del piso"
            value={createNombre}
            onChange={e => setCreateNombre(e.target.value)}
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleCreate} disabled={!createNombre.trim() || createPiso.isPending}>Guardar</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setCreating(false)}>Cancelar</Button>
        </div>
      )}

      {pisos && pisos.length > 0 ? (
        <div className="space-y-2">
          {pisos.map(piso => (
            <div key={piso.id} className="flex items-center justify-between p-2 border rounded bg-background">
              {editingId === piso.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input size={1} className="h-8 flex-1" value={editNombre} onChange={e => setEditNombre(e.target.value)} />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input type="checkbox" checked={editActivo} onChange={e => setEditActivo(e.target.checked)} className="rounded" /> Activo
                  </label>
                  <Button size="sm" className="h-8" onClick={() => handleUpdate(piso.id)} disabled={!editNombre.trim() || updatePiso.isPending}>Guardar</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancelar</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${!piso.activo ? 'text-muted-foreground line-through' : ''}`}>{piso.nombre}</span>
                    {!piso.activo && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                  </div>
                  {active && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingId(piso.id); setEditNombre(piso.nombre); setEditActivo(piso.activo); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-4 border border-dashed rounded text-muted-foreground text-sm">
          No hay pisos configurados en este sitio.
        </div>
      )}
    </div>
  );
}

export default function Ubicaciones() {
  const { data: locations, isLoading } = useListLocations();
  const updateLocation = useUpdateLocation();
  const createLocation = useCreateLocation();
  const { data: user } = useGetCurrentUser();
  const queryClient = useQueryClient();

  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createInitials, setCreateInitials] = useState("");
  const [createType, setCreateType] = useState<LocationInputTipo>(LocationInputTipo.TIENDA);
  const [editName, setEditName] = useState("");
  const [editInitials, setEditInitials] = useState("");
  const [editActive, setEditActive] = useState(false);
  const [disableConfirmationOpen, setDisableConfirmationOpen] = useState(false);
  const canCreate = hasPermission(user, Modules.UBICACIONES, "crear");
  const canEdit = hasPermission(user, Modules.UBICACIONES, "editar");

  const openEdit = (loc: Location) => {
    setEditingLocation(loc);
    setEditName(loc.nombre);
    setEditInitials(loc.iniciales);
    setEditActive(loc.activa);
  };

  const handleSave = () => {
    if (!editingLocation) return;
    if (editingLocation.activa && !editActive) {
      setDisableConfirmationOpen(true);
      return;
    }
    saveLocation();
  };

  const saveLocation = () => {
    if (!editingLocation) return;

    updateLocation.mutate(
      {
        id: editingLocation.id,
        data: {
           nombre: editName,
           iniciales: editInitials,
          activa: editActive
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
          toast.success("Sitio actualizado correctamente");
           setDisableConfirmationOpen(false);
          setEditingLocation(null);
        },
        onError: (err: any) => {
          toast.error("Error al actualizar", { description: err.error || "Ocurrió un error inesperado" });
        }
      }
    );
  };

  const handleCreate = () => {
    if (!createName.trim() || !/^[A-Z]{2,3}$/.test(createInitials)) return;
    createLocation.mutate({ data: { nombre: createName.trim(), iniciales: createInitials, tipo: createType } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
        toast.success("Sitio creado correctamente");
        setCreateName("");
         setCreateInitials("");
        setCreateType(LocationInputTipo.TIENDA);
        setCreating(false);
      },
      onError: (err: any) => {
        toast.error("Error al crear", { description: err?.data?.error || "Ocurrió un error inesperado" });
      },
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-pulse max-w-5xl mx-auto">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Sitios</h1>
            <p className="text-muted-foreground mt-2">
              Administración de tiendas y bodegas. Los sitios de sistema no pueden ser editados.
            </p>
          </div>
          {canCreate && <Button onClick={() => setCreating(true)} data-testid="button-create-location"><Plus className="mr-2 h-4 w-4" />Nuevo sitio</Button>}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                   <TableHead>Iniciales</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations?.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">
                      {loc.nombre}
                      {loc.esSistema && <Badge variant="secondary" className="ml-2 text-[10px]">SISTEMA</Badge>}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">{loc.iniciales}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{loc.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={loc.activa ? "default" : "secondary"}>
                        {loc.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && !loc.esSistema && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(loc)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!locations || locations.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No hay sitios registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {canCreate && <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo sitio</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={createName} onChange={(event) => setCreateName(event.target.value)} /></div>
            <div className="space-y-2">
              <Label>Iniciales *</Label>
              <Input
                value={createInitials}
                onChange={(event) => setCreateInitials(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
                placeholder="MA"
                maxLength={3}
              />
              <p className="text-xs text-muted-foreground">2 o 3 letras mayúsculas, únicas por sitio.</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={createType} onChange={(event) => setCreateType(event.target.value as LocationInputTipo)}>
                <option value={LocationInputTipo.TIENDA}>Tienda</option>
                <option value={LocationInputTipo.BODEGA}>Bodega</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || !/^[A-Z]{2,3}$/.test(createInitials) || createLocation.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {canEdit && <Dialog open={!!editingLocation} onOpenChange={(open) => !open && setEditingLocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sitio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre del sitio"
              />
            </div>
            <div className="space-y-2">
              <Label>Iniciales</Label>
              <Input
                value={editInitials}
                onChange={(event) => setEditInitials(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
                placeholder="MA"
                maxLength={3}
              />
              <p className="text-xs text-muted-foreground">2 o 3 letras mayúsculas, únicas por sitio.</p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active-checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="active-checkbox">Sitio activo</Label>
            </div>
            {editingLocation && (
              <PisosSitio locationId={editingLocation.id} active={editingLocation.activa} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLocation(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateLocation.isPending || !editName.trim() || !/^[A-Z]{2,3}$/.test(editInitials)}>
              {updateLocation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
      <ConfirmacionTextoExacto
        open={disableConfirmationOpen}
        onOpenChange={setDisableConfirmationOpen}
        titulo="Desactivar sitio"
        descripcion="El sitio dejará de estar disponible para operaciones nuevas."
        textoRequerido={editingLocation?.nombre ?? ""}
        etiqueta="Confirmación del nombre del sitio"
        textoConfirmar="Desactivar sitio"
        pendiente={updateLocation.isPending}
        onConfirm={saveLocation}
      />
    </AppLayout>
  );
}
