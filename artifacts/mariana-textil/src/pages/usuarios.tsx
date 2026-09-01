import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useListLocations,
  useGetCurrentUser,
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
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Modules, hasPermission } from "@/lib/permisos";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";
import { PurgaCatalogoButton } from "@/components/purga-catalogo-button";
import {
  CREATE_USER_FIELD_LIMITS,
  UPDATE_USER_FIELD_LIMITS,
  type UserFormErrors,
  type UserFormField,
  validateUserForm,
} from "@/lib/user-form-validation";

export default function Usuarios() {
  const { data: currentUser } = useGetCurrentUser();
  const { data: users, isLoading } = useListUsers();
  const { data: locations } = useListLocations();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const queryClient = useQueryClient();
  const canCreate = hasPermission(currentUser, Modules.USUARIOS, "crear");
  const canEdit = hasPermission(currentUser, Modules.USUARIOS, "editar");
  const isAdmin = currentUser?.rol === Role.ADMIN;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordVisibilityResetKey, setPasswordVisibilityResetKey] = useState(0);
  const [userConfirmationOpen, setUserConfirmationOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<UserFormErrors>({});
  const [estado, setEstado] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");

  // Form states
  const [formData, setFormData] = useState({
    nombre: "",
    usuario: "",
    password: "",
    rol: Role.CAJA as Role,
    ubicacionId: "null",
    alcanceConsulta: "PROPIA" as "PROPIA" | "TODAS",
    activo: true
  });

  const resetForm = () => {
    setFormErrors({});
    setFormData({
      nombre: "",
      usuario: "",
      password: "",
      rol: Role.CAJA as Role,
      ubicacionId: "null",
      alcanceConsulta: "PROPIA",
      activo: true
    });
  };

  const openCreate = () => {
    resetForm();
    setPasswordVisibilityResetKey((current) => current + 1);
    setIsCreateOpen(true);
  };

  const openEdit = (user: User) => {
    setFormErrors({});
    setFormData({
      nombre: user.nombre,
      usuario: user.usuario,
      password: "", // Empty so it's not updated unless typed
      rol: user.rol,
      ubicacionId: user.ubicacion?.id ? String(user.ubicacion.id) : "null",
      alcanceConsulta: user.alcanceConsulta || "PROPIA",
      activo: user.activo
    });
    setPasswordVisibilityResetKey((current) => current + 1);
    setEditingUser(user);
  };

  const closeDialogs = () => {
    setFormErrors({});
    setIsCreateOpen(false);
    setEditingUser(null);
    setPasswordVisibilityResetKey((current) => current + 1);
  };

  const executeSave = () => {
    setPasswordVisibilityResetKey((current) => current + 1);
    const errors = validateUserForm(
      formData,
      isCreateOpen ? "create" : "update",
    );
    setFormErrors(errors);
    const messages = Object.values(errors);
    if (messages.length > 0) {
      toast.error("Revisa los campos marcados", {
        description: messages.join(" "),
      });
      return;
    }

    const payload: any = {
      nombre: formData.nombre,
      usuario: formData.usuario,
      rol: formData.rol,
      alcanceConsulta: formData.alcanceConsulta,
      ubicacionId: formData.ubicacionId === "null" ? null : Number(formData.ubicacionId)
    };

    if (isCreateOpen) {
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
             setUserConfirmationOpen(false);
            closeDialogs();
          },
          onError: (err: any) => {
            toast.error("Error al actualizar", { description: err.error });
          }
        }
      );
    }
  };

  const handleSave = () => {
    const isDeactivating = !!editingUser && editingUser.activo && !formData.activo;
    const isChangingRole = !!editingUser && editingUser.rol !== formData.rol;
    if (isDeactivating || isChangingRole) {
      setUserConfirmationOpen(true);
      return;
    }
    executeSave();
  };

  const updateField = <Field extends UserFormField>(
    field: Field,
    value: string,
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };
  const fieldLimits = isCreateOpen
    ? CREATE_USER_FIELD_LIMITS
    : UPDATE_USER_FIELD_LIMITS;

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
              Gestión de personal, accesos y asignación de sitios.
            </p>
          </div>
          {canCreate && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          )}
        </div>

        <Card>
          <div className="flex justify-end border-b p-4">
            <Select value={estado} onValueChange={(value) => setEstado(value as typeof estado)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Activos</SelectItem>
                <SelectItem value="INACTIVE">Inactivos</SelectItem>
                <SelectItem value="ALL">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre / Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Sitio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.filter((user) => estado === "ALL" || (estado === "ACTIVE" ? user.activo : !user.activo)).map((user) => (
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
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {user.alcanceConsulta}
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
                      {canEdit && (isAdmin || user.rol !== Role.ADMIN) && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      )}
                      {isAdmin && !user.activo && (
                        <PurgaCatalogoButton entidad="usuarios" id={user.id} nombreVisible={user.nombre} invalidateQueryKey={getListUsersQueryKey()} />
                      )}
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
                <Label htmlFor="user-name">
                  Nombre completo{" "}
                  <span className="font-normal text-muted-foreground">
                    (mínimo {fieldLimits.nombre.min}, máximo{" "}
                    {fieldLimits.nombre.max} caracteres)
                  </span>
                </Label>
                <Input
                  id="user-name"
                  value={formData.nombre}
                  onChange={(e) => updateField("nombre", e.target.value)}
                  placeholder="Juan Pérez"
                  aria-invalid={Boolean(formErrors.nombre)}
                  aria-describedby={formErrors.nombre ? "user-name-error" : undefined}
                />
                {formErrors.nombre && (
                  <p id="user-name-error" role="alert" className="text-sm text-destructive">
                    {formErrors.nombre}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-username">
                  Nombre de usuario{" "}
                  <span className="font-normal text-muted-foreground">
                    (mínimo {fieldLimits.usuario.min}, máximo{" "}
                    {fieldLimits.usuario.max} caracteres)
                  </span>
                </Label>
                <Input
                  id="user-username"
                  value={formData.usuario}
                  onChange={(e) => updateField("usuario", e.target.value)}
                  placeholder="juan.p"
                  aria-invalid={Boolean(formErrors.usuario)}
                  aria-describedby={formErrors.usuario ? "user-username-error" : undefined}
                />
                {formErrors.usuario && (
                  <p id="user-username-error" role="alert" className="text-sm text-destructive">
                    {formErrors.usuario}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={formData.rol}
                  disabled={!!editingUser && editingUser.id === currentUser?.id}
                  onValueChange={(val) => {
                    const rol = val as Role;
                    setFormData({
                      ...formData,
                      rol,
                      alcanceConsulta:
                        rol === Role.ADMIN ||
                        rol === Role.SUPERVISOR ||
                        rol === Role.SISTEMAS ||
                        rol === Role.CONTADOR
                          ? "TODAS"
                          : formData.alcanceConsulta,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                    <SelectContent>
                    {isAdmin && <SelectItem value={Role.ADMIN}>Administrador</SelectItem>}
                    {isAdmin && <SelectItem value={Role.SISTEMAS}>Sistemas</SelectItem>}
                    <SelectItem value={Role.CONTADOR}>Contador</SelectItem>
                    <SelectItem value={Role.TERMINAL}>Terminal</SelectItem>
                    <SelectItem value={Role.CAJA}>Caja</SelectItem>
                    <SelectItem value={Role.SUPERVISOR}>Supervisor</SelectItem>
                    <SelectItem value={Role.BODEGA}>Bodega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Alcance de Consulta</Label>
                <Select
                  value={formData.alcanceConsulta}
                  disabled={
                    formData.rol === Role.ADMIN ||
                    formData.rol === Role.SUPERVISOR ||
                    formData.rol === Role.SISTEMAS ||
                    formData.rol === Role.CONTADOR
                  }
                  onValueChange={(val) => setFormData({...formData, alcanceConsulta: val as "PROPIA" | "TODAS"})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="PROPIA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROPIA">PROPIA (Sólo sitio asignado)</SelectItem>
                    <SelectItem value="TODAS">TODAS (Vista global)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sitio</Label>
              <Select value={formData.ubicacionId} onValueChange={(val) => setFormData({...formData, ubicacionId: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Global (Sin sitio)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Global (Sin sitio)</SelectItem>
                  {locations?.map(loc => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 mt-2">
              <Label htmlFor="user-password">
                Contraseña{" "}
                <span className="text-muted-foreground font-normal">
                  (mínimo {fieldLimits.password.min}, máximo{" "}
                  {fieldLimits.password.max} caracteres
                  {editingUser ? "; dejar en blanco para no cambiar" : ""})
                </span>
              </Label>
              <PasswordInput
                id="user-password"
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder={
                  editingUser
                    ? "Dejar en blanco para no cambiar"
                    : `Mínimo ${fieldLimits.password.min} caracteres`
                }
                autoComplete="new-password"
                visibilityResetKey={passwordVisibilityResetKey}
                toggleTestId="toggle-user-password"
                aria-invalid={Boolean(formErrors.password)}
                aria-describedby={formErrors.password ? "user-password-error" : undefined}
              />
              {formErrors.password && (
                <p id="user-password-error" role="alert" className="text-sm text-destructive">
                  {formErrors.password}
                </p>
              )}
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
      <ConfirmacionTextoExacto
        open={userConfirmationOpen}
        onOpenChange={setUserConfirmationOpen}
        titulo={editingUser?.activo && !formData.activo ? "Desactivar usuario" : "Cambiar rol de usuario"}
        descripcion={
          editingUser?.activo && !formData.activo
            ? "El usuario perderá acceso al sistema."
            : "Se cambiarán los permisos asociados al rol del usuario."
        }
        textoRequerido={editingUser?.usuario ?? ""}
        etiqueta="Confirmación del nombre de usuario"
        textoConfirmar="Confirmar cambio"
        pendiente={isPending}
        onConfirm={executeSave}
      />
    </AppLayout>
  );
}
