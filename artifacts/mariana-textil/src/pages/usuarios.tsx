import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useListUsers, 
  useCreateUser,
  useUpdateUser,
  useListLocations,
  User, 
  Role,
  getListUsersQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function Usuarios() {
  const { data: users, isLoading } = useListUsers();
  const { data: locations } = useListLocations();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nombre: "",
    usuario: "",
    password: "",
    rol: Role.CAJA as Role,
    ubicacionId: "null",
    activo: true
  });

  const resetForm = () => {
    setFormData({
      nombre: "",
      usuario: "",
      password: "",
      rol: Role.CAJA as Role,
      ubicacionId: "null",
      activo: true
    });
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (user: User) => {
    setFormData({
      nombre: user.nombre,
      usuario: user.usuario,
      password: "", // Empty so it's not updated unless typed
      rol: user.rol,
      ubicacionId: user.ubicacion?.id ? String(user.ubicacion.id) : "null",
      activo: user.activo
    });
    setEditingUser(user);
  };

  const closeDialogs = () => {
    setIsCreateOpen(false);
    setEditingUser(null);
  };

  const handleSave = () => {
    if (!formData.nombre.trim() || !formData.usuario.trim()) {
      toast.error("Datos incompletos", { description: "Nombre y usuario son obligatorios" });
      return;
    }

    const payload: any = {
      nombre: formData.nombre,
      usuario: formData.usuario,
      rol: formData.rol,
      ubicacionId: formData.ubicacionId === "null" ? null : Number(formData.ubicacionId)
    };

    if (isCreateOpen) {
      if (!formData.password) {
        toast.error("Datos incompletos", { description: "La contraseña es obligatoria para nuevos usuarios" });
        return;
      }
      payload.password = formData.password;
      
      createUser.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
            toast.success("Usuario creado correctamente");
            closeDialogs();
          },
          onError: (err: any) => {
            toast.error("Error al crear usuario", { description: err.error });
          }
        }
      );
    } else if (editingUser) {
      if (formData.password) {
        payload.password = formData.password;
      }
      payload.activo = formData.activo;

      updateUser.mutate(
        { id: editingUser.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
            toast.success("Usuario actualizado correctamente");
            closeDialogs();
          },
          onError: (err: any) => {
            toast.error("Error al actualizar", { description: err.error });
          }
        }
      );
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-pulse max-w-6xl mx-auto">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </AppLayout>
    );
  }

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Usuarios</h1>
            <p className="text-muted-foreground mt-2">
              Gestión de personal, accesos y asignación de ubicaciones.
            </p>
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre / Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{user.nombre}</div>
                      <div className="text-xs text-muted-foreground">{user.usuario}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {user.rol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.ubicacion ? user.ubicacion.nombre : <span className="text-muted-foreground italic text-sm">Global</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.activo ? "default" : "secondary"}>
                        {user.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!users || users.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No hay usuarios registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen || !!editingUser} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isCreateOpen ? "Nuevo Usuario" : "Editar Usuario"}</DialogTitle>
            <DialogDescription>
              {isCreateOpen ? "Crea un nuevo acceso al sistema." : "Modifica los datos o permisos del usuario."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <Input 
                  value={formData.nombre} 
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre de usuario</Label>
                <Input 
                  value={formData.usuario} 
                  onChange={(e) => setFormData({...formData, usuario: e.target.value})} 
                  placeholder="juan.p"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={formData.rol} onValueChange={(val) => setFormData({...formData, rol: val as Role})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Role.ADMIN}>Administrador</SelectItem>
                    <SelectItem value={Role.CAJA}>Caja</SelectItem>
                    <SelectItem value={Role.INVENTARIOS}>Inventarios</SelectItem>
                    <SelectItem value={Role.BODEGA}>Bodega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ubicación</Label>
                <Select value={formData.ubicacionId} onValueChange={(val) => setFormData({...formData, ubicacionId: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Global (Sin ubicación)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Global (Sin ubicación)</SelectItem>
                    {locations?.map(loc => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mt-2">
              <Label>Contraseña {editingUser && <span className="text-muted-foreground font-normal">(Dejar en blanco para no cambiar)</span>}</Label>
              <Input 
                type="password"
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                placeholder={editingUser ? "••••••••" : "Mínimo 10 caracteres"}
              />
            </div>

            {editingUser && (
              <div className="flex items-center space-x-2 mt-4 p-3 bg-muted/50 rounded-md border">
                <Checkbox 
                  id="user-active" 
                  checked={formData.activo} 
                  onCheckedChange={(checked) => setFormData({...formData, activo: checked === true})} 
                />
                <Label htmlFor="user-active" className="cursor-pointer">Usuario con acceso activo al sistema</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Guardando..." : (isCreateOpen ? "Crear usuario" : "Guardar cambios")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
