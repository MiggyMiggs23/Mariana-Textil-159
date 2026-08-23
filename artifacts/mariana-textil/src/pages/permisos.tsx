import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useListPermisosRoles,
  useUpdatePermisosRol,
  getListPermisosRolesQueryKey,
  useListUsers,
  useGetPermisosUsuario,
  useUpdatePermisosUsuario,
  useResetPermisosUsuario,
  useGetPermisosPreview,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  getGetPermisosUsuarioQueryKey,
  getGetPermisosPreviewQueryKey,
  Role,
  PermissionFlags,
  PermissionFlagsNullable
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Modules } from "@/lib/permisos";
import { Shield, RotateCcw, AlertTriangle, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ALL_MODULES = Object.values(Modules);

export default function Permisos() {
  const { data: user } = useGetCurrentUser();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<Role>(Role.CAJA);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: rolesData, isLoading: isLoadingRoles } = useListPermisosRoles();
  const { data: usersData } = useListUsers();

  const userIdNum = selectedUserId ? parseInt(selectedUserId, 10) : 0;
  
  const { data: overridesData, isLoading: isLoadingOverrides } = useGetPermisosUsuario(userIdNum, {
    query: { enabled: !!userIdNum, queryKey: getGetPermisosUsuarioQueryKey(userIdNum) }
  });
  
  const { data: previewData } = useGetPermisosPreview(userIdNum, {
    query: { enabled: !!userIdNum, queryKey: getGetPermisosPreviewQueryKey(userIdNum) }
  });

  const updateRol = useUpdatePermisosRol();
  const updateUsuario = useUpdatePermisosUsuario();
  const resetUsuario = useResetPermisosUsuario();

  const handleRoleChange = (modulo: string, key: keyof PermissionFlags, checked: boolean) => {
    if (!rolesData) return;
    const current = rolesData.find(r => r.rol === selectedRole && r.modulo === modulo);
    const data: PermissionFlags = {
      puedeVer: current?.puedeVer ?? false,
      puedeCrear: current?.puedeCrear ?? false,
      puedeEditar: current?.puedeEditar ?? false,
      puedeAutorizar: current?.puedeAutorizar ?? false,
      [key]: checked
    };
    
    // Some basic sanity constraints
    if ((key === 'puedeCrear' || key === 'puedeEditar' || key === 'puedeAutorizar') && checked) {
      data.puedeVer = true;
    }
    if (key === 'puedeVer' && !checked) {
      data.puedeCrear = false;
      data.puedeEditar = false;
      data.puedeAutorizar = false;
    }

    updateRol.mutate({ rol: selectedRole, modulo, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPermisosRolesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        if (userIdNum) {
          queryClient.invalidateQueries({ queryKey: getGetPermisosPreviewQueryKey(userIdNum) });
        }
        toast.success(`Permisos de ${modulo} actualizados para rol ${selectedRole}`);
      },
      onError: (err: any) => {
        toast.error("Error al actualizar permisos", { description: err.error });
      }
    });
  };

  const handleUserChange = (modulo: string, key: keyof PermissionFlagsNullable, value: boolean | null) => {
    if (!overridesData || !userIdNum) return;
    const current = overridesData.overrides.find(r => r.modulo === modulo);
    const data: PermissionFlagsNullable = {
      puedeVer: current?.puedeVer ?? null,
      puedeCrear: current?.puedeCrear ?? null,
      puedeEditar: current?.puedeEditar ?? null,
      puedeAutorizar: current?.puedeAutorizar ?? null,
      [key]: value
    };

    updateUsuario.mutate({ id: userIdNum, modulo, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPermisosUsuarioQueryKey(userIdNum) });
        queryClient.invalidateQueries({ queryKey: getGetPermisosPreviewQueryKey(userIdNum) });
        toast.success(`Excepción de ${modulo} guardada`);
      },
      onError: (err: any) => {
        toast.error("Error", { description: err.error });
      }
    });
  };

  const handleResetUserModule = (modulo: string) => {
    if (!userIdNum) return;
    resetUsuario.mutate({ id: userIdNum, modulo }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPermisosUsuarioQueryKey(userIdNum) });
        queryClient.invalidateQueries({ queryKey: getGetPermisosPreviewQueryKey(userIdNum) });
        toast.success(`Permisos de ${modulo} restaurados a los del rol`);
      },
      onError: (err: any) => {
        toast.error("Error al restaurar", { description: err.error });
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Permisos</h1>
            <p className="text-muted-foreground mt-2">
              Gestión de matriz de accesos y excepciones por usuario.
            </p>
          </div>
        </div>

        <Tabs defaultValue="roles" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="roles" className="w-32">Por Rol</TabsTrigger>
            <TabsTrigger value="usuarios" className="w-32">Por Usuario</TabsTrigger>
          </TabsList>

          {/* TAB ROLES */}
          <TabsContent value="roles">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <CardTitle>Matriz de Roles</CardTitle>
                    <CardDescription>
                      Define los accesos base para cada perfil.
                    </CardDescription>
                  </div>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as Role)}>
                    <SelectTrigger className="w-[200px] bg-background">
                      <SelectValue placeholder="Seleccionar Rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Role.CAJA}>Caja</SelectItem>
                      <SelectItem value={Role.INVENTARIOS}>Inventarios</SelectItem>
                      <SelectItem value={Role.BODEGA}>Bodega</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6 bg-blue-50 text-blue-900 border-blue-200">
                  <Shield className="h-4 w-4" color="currentColor" />
                  <AlertTitle>Administrador</AlertTitle>
                  <AlertDescription>
                    El administrador tiene acceso total a todos los módulos y no puede ser restringido.
                  </AlertDescription>
                </Alert>

                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-left font-semibold p-4">Módulo</th>
                        <th className="text-center font-semibold p-4">Ver</th>
                        <th className="text-center font-semibold p-4">Crear</th>
                        <th className="text-center font-semibold p-4">Editar</th>
                        <th className="text-center font-semibold p-4">Autorizar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {isLoadingRoles ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">Cargando...</td>
                        </tr>
                      ) : (
                        ALL_MODULES.map(modulo => {
                          const current = rolesData?.find(r => r.rol === selectedRole && r.modulo === modulo);
                          return (
                            <tr key={modulo} className="hover:bg-muted/10 transition-colors">
                              <td className="p-4 font-medium font-mono text-xs">{modulo}</td>
                              <td className="p-4 text-center">
                                <Checkbox 
                                  checked={current?.puedeVer ?? false}
                                  onCheckedChange={(c) => handleRoleChange(modulo, 'puedeVer', c === true)}
                                />
                              </td>
                              <td className="p-4 text-center">
                                <Checkbox 
                                  checked={current?.puedeCrear ?? false}
                                  onCheckedChange={(c) => handleRoleChange(modulo, 'puedeCrear', c === true)}
                                />
                              </td>
                              <td className="p-4 text-center">
                                <Checkbox 
                                  checked={current?.puedeEditar ?? false}
                                  onCheckedChange={(c) => handleRoleChange(modulo, 'puedeEditar', c === true)}
                                />
                              </td>
                              <td className="p-4 text-center">
                                <Checkbox 
                                  checked={current?.puedeAutorizar ?? false}
                                  onCheckedChange={(c) => handleRoleChange(modulo, 'puedeAutorizar', c === true)}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB USUARIOS */}
          <TabsContent value="usuarios">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <CardTitle>Excepciones por Usuario</CardTitle>
                    <CardDescription>
                      Sobrescribe permisos específicos para un usuario particular.
                    </CardDescription>
                  </div>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-[300px] bg-background">
                      <SelectValue placeholder="Seleccionar Usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {usersData?.filter(u => u.rol !== Role.ADMIN).map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.nombre} ({u.usuario}) - {u.rol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedUserId ? (
                  <div className="text-center p-12 text-muted-foreground border rounded-md bg-muted/20">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    Selecciona un usuario para ver y editar sus permisos.
                  </div>
                ) : user?.id === userIdNum ? (
                  <Alert className="bg-amber-50 text-amber-900 border-amber-200">
                    <AlertTriangle className="h-4 w-4" color="currentColor" />
                    <AlertTitle>Acción Restringida</AlertTitle>
                    <AlertDescription>
                      No puedes editar tus propias excepciones de permisos. Pide a otro Administrador que lo haga si es necesario.
                    </AlertDescription>
                  </Alert>
                ) : isLoadingOverrides ? (
                  <div className="p-8 text-center text-muted-foreground">Cargando permisos del usuario...</div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="text-left font-semibold p-4">Módulo</th>
                            <th className="text-center font-semibold p-4">Ver</th>
                            <th className="text-center font-semibold p-4">Crear</th>
                            <th className="text-center font-semibold p-4">Editar</th>
                            <th className="text-center font-semibold p-4">Autorizar</th>
                            <th className="text-center font-semibold p-4">Herencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {ALL_MODULES.map(modulo => {
                            const currentOverride = overridesData?.overrides.find(r => r.modulo === modulo);
                            const currentPreview = previewData?.permisos.find(r => r.modulo === modulo);
                            
                            const isOverridden = !!currentOverride && (
                              currentOverride.puedeVer != null || 
                              currentOverride.puedeCrear != null || 
                              currentOverride.puedeEditar != null || 
                              currentOverride.puedeAutorizar != null
                            );

                            return (
                              <tr key={modulo} className={`hover:bg-muted/10 transition-colors ${isOverridden ? 'bg-blue-50/30' : ''}`}>
                                <td className="p-4 font-medium font-mono text-xs flex items-center gap-2">
                                  {modulo}
                                  {isOverridden && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">Modificado</span>}
                                </td>
                                
                                {(['puedeVer', 'puedeCrear', 'puedeEditar', 'puedeAutorizar'] as const).map(k => {
                                  const overrideVal = currentOverride?.[k];
                                  const effectiveVal = currentPreview?.[k];
                                   const selectedValue =
                                     overrideVal == null
                                       ? "inherit"
                                       : overrideVal
                                         ? "allow"
                                         : "deny";
                                  
                                  return (
                                    <td key={k} className="p-4 text-center">
                                       <Select
                                         value={selectedValue}
                                         onValueChange={(value) =>
                                           handleUserChange(
                                             modulo,
                                             k,
                                             value === "inherit" ? null : value === "allow",
                                           )
                                         }
                                       >
                                         <SelectTrigger
                                           className={`mx-auto h-8 w-[104px] text-xs ${
                                             overrideVal == null
                                               ? ""
                                               : overrideVal
                                                 ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                 : "border-red-300 bg-red-50 text-red-800"
                                           }`}
                                           aria-label={`${modulo} ${k}`}
                                         >
                                           <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                           <SelectItem value="inherit">
                                             Heredar ({effectiveVal ? "Sí" : "No"})
                                           </SelectItem>
                                           <SelectItem value="allow">Permitir</SelectItem>
                                           <SelectItem value="deny">Denegar</SelectItem>
                                         </SelectContent>
                                       </Select>
                                    </td>
                                  )
                                })}
                                
                                <td className="p-4 text-center">
                                  {isOverridden ? (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => handleResetUserModule(modulo)}
                                      className="text-xs h-7 text-muted-foreground hover:text-destructive"
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Restaurar
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground flex items-center justify-center">
                                      <Check className="w-3 h-3 mr-1 opacity-50" />
                                      Rol
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="text-sm text-muted-foreground bg-muted/20 p-4 rounded-md border flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        Selecciona “Heredar” para una acción individual o usa “Restaurar” para limpiar todas las excepciones del módulo.
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
