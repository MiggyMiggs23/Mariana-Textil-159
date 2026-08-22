import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useListLocations, 
  useUpdateLocation, 
  Location, 
  getListLocationsQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // I need to create switch.tsx or just use a checkbox
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

export default function Ubicaciones() {
  const { data: locations, isLoading } = useListLocations();
  const updateLocation = useUpdateLocation();
  const queryClient = useQueryClient();
  
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(false);

  const openEdit = (loc: Location) => {
    setEditingLocation(loc);
    setEditName(loc.nombre);
    setEditActive(loc.activa);
  };

  const handleSave = () => {
    if (!editingLocation) return;
    
    updateLocation.mutate(
      { 
        id: editingLocation.id, 
        data: { 
          nombre: editName,
          activa: editActive
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
          toast.success("Ubicación actualizada correctamente");
          setEditingLocation(null);
        },
        onError: (err: any) => {
          toast.error("Error al actualizar", { description: err.error || "Ocurrió un error inesperado" });
        }
      }
    );
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Ubicaciones</h1>
          <p className="text-muted-foreground mt-2">
            Administración de tiendas y bodegas. Las ubicaciones de sistema no pueden ser editadas.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
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
                    <TableCell>
                      <Badge variant="outline">{loc.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={loc.activa ? "default" : "secondary"}>
                        {loc.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!loc.esSistema && (
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
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No hay ubicaciones registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingLocation} onOpenChange={(open) => !open && setEditingLocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Ubicación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                placeholder="Nombre de la ubicación"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="active-checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="active-checkbox">Ubicación activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLocation(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateLocation.isPending || !editName.trim()}>
              {updateLocation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
