import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Chofer,
  ChoferInput,
  getGetCurrentUserQueryKey,
  getListChoferesQueryKey,
  useCreateChofer,
  useGetCurrentUser,
  useListChoferes,
  useUpdateChofer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Edit, Plus, Search, UserRound } from "lucide-react";
import { hasPermission, Modules } from "@/lib/permisos";

function getErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) return "Error desconocido";
  const apiError = error as { data?: { error?: unknown }; message?: unknown };
  return typeof apiError.data?.error === "string"
    ? apiError.data.error
    : typeof apiError.message === "string"
      ? apiError.message
      : "Error desconocido";
}

export default function Choferes() {
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() },
  });
  const {
    data: choferes,
    isLoading,
    error,
  } = useListChoferes(undefined, {
    query: { queryKey: getListChoferesQueryKey() },
  });
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [editing, setEditing] = useState<Chofer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Chofer | null>(null);
  const isCatalogManager = user?.rol === "ADMIN" || user?.rol === "SISTEMAS";
  const canCreate =
    isCatalogManager && hasPermission(user, Modules.CHOFERES, "crear");
  const canUpdate =
    isCatalogManager && hasPermission(user, Modules.CHOFERES, "editar");
  const filtered = useMemo(
    () =>
      (choferes ?? [])
        .filter(
          (chofer) =>
            (estado === "ALL" ||
              (estado === "ACTIVE" ? chofer.activo : !chofer.activo)) &&
            `${chofer.nombreCompleto} ${chofer.telefono}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          a.nombreCompleto.localeCompare(b.nombreCompleto, "es", {
            sensitivity: "base",
          }),
        ),
    [choferes, estado, search],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (chofer: Chofer) => {
    setEditing(chofer);
    setDialogOpen(true);
  };
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">
              Choferes
            </h1>
            <p className="text-muted-foreground mt-2">
              Catálogo histórico de choferes para transporte.
            </p>
          </div>
          {canCreate && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo chofer
            </Button>
          )}
        </div>
        <Card>
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4 bg-muted/20">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 bg-background"
                placeholder="Buscar por nombre o teléfono..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex rounded-md border bg-background p-1">
              {(
                [
                  ["ACTIVE", "Activos"],
                  ["INACTIVE", "Inactivos"],
                  ["ALL", "Todos"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  variant={estado === value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setEstado(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <CardContent className="p-0">
            {error ? (
              <div className="p-8 text-center text-destructive">
                No se pudieron cargar los choferes: {getErrorMessage(error)}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead>Nombre completo</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead className="text-right">Estado</TableHead>
                        {canUpdate && (
                          <TableHead className="w-32 text-right">
                            Acciones
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell
                            colSpan={canUpdate ? 4 : 3}
                            className="h-32 text-center"
                          >
                            Cargando choferes...
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={canUpdate ? 4 : 3}
                            className="h-32 text-center text-muted-foreground"
                          >
                            No se encontraron choferes.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((chofer) => (
                          <TableRow key={chofer.id}>
                            <TableCell className="font-bold">
                              {chofer.nombreCompleto}
                            </TableCell>
                            <TableCell>{chofer.telefono}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  chofer.activo ? "default" : "secondary"
                                }
                              >
                                {chofer.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            {canUpdate && (
                              <TableCell className="text-right space-x-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEdit(chofer)}
                                  aria-label={`Editar ${chofer.nombreCompleto}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setStatusTarget(chofer)}
                                >
                                  {chofer.activo ? "Desactivar" : "Activar"}
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden divide-y">
                  {isLoading ? (
                    <div className="p-8 text-center">Cargando choferes...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No se encontraron choferes.
                    </div>
                  ) : (
                    filtered.map((chofer) => (
                      <div key={chofer.id} className="p-4 space-y-3">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-bold">{chofer.nombreCompleto}</p>
                            <p className="text-sm text-muted-foreground">
                              {chofer.telefono}
                            </p>
                          </div>
                          <Badge
                            variant={chofer.activo ? "default" : "secondary"}
                          >
                            {chofer.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                        {canUpdate && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(chofer)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStatusTarget(chofer)}
                            >
                              {chofer.activo ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <ChoferDialog
        open={dialogOpen}
        chofer={editing}
        onClose={() => setDialogOpen(false)}
      />
      <EstadoDialog
        chofer={statusTarget}
        onClose={() => setStatusTarget(null)}
      />
    </AppLayout>
  );
}

function ChoferDialog({
  open,
  chofer,
  onClose,
}: {
  open: boolean;
  chofer: Chofer | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateChofer();
  const update = useUpdateChofer();
  const [form, setForm] = useState<ChoferInput>({
    nombreCompleto: "",
    telefono: "",
    activo: true,
  });
  useEffect(() => {
    if (open)
      setForm(
        chofer
          ? {
              nombreCompleto: chofer.nombreCompleto,
              telefono: chofer.telefono,
              activo: chofer.activo,
            }
          : { nombreCompleto: "", telefono: "", activo: true },
      );
  }, [open, chofer]);
  const submit = () => {
    const data = {
      ...form,
      nombreCompleto: form.nombreCompleto.trim(),
      telefono: form.telefono.trim(),
    };
    if (!data.nombreCompleto || !data.telefono) {
      toast.error("Datos incompletos", {
        description: "El nombre completo y teléfono son obligatorios.",
      });
      return;
    }
    const callbacks = {
      onSuccess: () => {
        toast.success(
          chofer
            ? "Chofer actualizado exitosamente"
            : "Chofer registrado exitosamente",
        );
        queryClient.invalidateQueries({ queryKey: getListChoferesQueryKey() });
        onClose();
      },
      onError: (error: unknown) =>
        toast.error("No se pudo guardar el chofer", {
          description: getErrorMessage(error),
        }),
    };
    if (chofer) update.mutate({ id: chofer.id, data }, callbacks);
    else create.mutate({ data }, callbacks);
  };
  const pending = create.isPending || update.isPending;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{chofer ? "Editar chofer" : "Nuevo chofer"}</DialogTitle>
          <DialogDescription>
            {chofer
              ? "Modifica los datos del chofer seleccionado."
              : "Registra un chofer en el catálogo histórico."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input
              value={form.nombreCompleto}
              onChange={(event) =>
                setForm({ ...form, nombreCompleto: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono *</Label>
            <Input
              type="tel"
              value={form.telefono}
              onChange={(event) =>
                setForm({ ...form, telefono: event.target.value })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? "Guardando..."
              : chofer
                ? "Guardar cambios"
                : "Registrar chofer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EstadoDialog({
  chofer,
  onClose,
}: {
  chofer: Chofer | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateChofer();
  if (!chofer) return null;
  const activo = !chofer.activo;
  const confirm = () =>
    update.mutate(
      { id: chofer.id, data: { activo } },
      {
        onSuccess: () => {
          toast.success(
            `Chofer ${activo ? "activado" : "desactivado"} exitosamente`,
          );
          queryClient.invalidateQueries({
            queryKey: getListChoferesQueryKey(),
          });
          onClose();
        },
        onError: (error) =>
          toast.error("No se pudo actualizar el estado", {
            description: getErrorMessage(error),
          }),
      },
    );
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activo ? "Activar chofer" : "Desactivar chofer"}
          </DialogTitle>
          <DialogDescription>
            {activo
              ? "El chofer podrá utilizarse nuevamente en operaciones."
              : "El chofer se conservará en el historial, pero no estará disponible para nuevas operaciones."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-md border p-3">
          <UserRound className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">{chofer.nombreCompleto}</span>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={update.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant={activo ? "default" : "destructive"}
            onClick={confirm}
            disabled={update.isPending}
          >
            {update.isPending
              ? "Guardando..."
              : activo
                ? "Activar"
                : "Desactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
