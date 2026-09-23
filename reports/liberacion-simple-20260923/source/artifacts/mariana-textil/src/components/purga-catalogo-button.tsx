import { useState } from "react";
import {
  useDeleteRegistroInactivo,
  useGetPurgaPreflight,
  getGetPurgaPreflightQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";

type Entidad =
  | "usuarios"
  | "camionetas"
  | "choferes"
  | "clientes"
  | "proveedores"
  | "productos";

function errorMessage(error: unknown): string {
  const candidate = error as { data?: { error?: unknown }; message?: unknown };
  return typeof candidate?.data?.error === "string"
    ? candidate.data.error
    : typeof candidate?.message === "string"
      ? candidate.message
      : "No fue posible comprobar las referencias.";
}

export function PurgaCatalogoButton({
  entidad,
  id,
  nombreVisible,
  invalidateQueryKey,
}: {
  entidad: Entidad;
  id: number;
  nombreVisible: string;
  invalidateQueryKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const preflight = useGetPurgaPreflight(entidad, id, {
    query: { enabled: open, queryKey: getGetPurgaPreflightQueryKey(entidad, id) },
  });
  const remove = useDeleteRegistroInactivo();
  const close = () => {
    setOpen(false);
    setConfirmOpen(false);
  };
  const confirm = (texto: string) =>
    remove.mutate(
      { entidad, id, data: { confirmacion: texto } },
      {
        onSuccess: () => {
          toast.success("Registro eliminado definitivamente.");
          queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
          close();
        },
        onError: (error) =>
          toast.error("No se pudo eliminar", { description: errorMessage(error) }),
      },
    );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive"
        aria-label={`Eliminar definitivamente ${nombreVisible}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={open && !confirmOpen} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprobar purga definitiva</DialogTitle>
            <DialogDescription>
              Se revisarán todas las referencias conocidas antes de habilitar el borrado.
            </DialogDescription>
          </DialogHeader>
          {preflight.isLoading ? (
            <p className="py-6 text-sm text-muted-foreground">Comprobando referencias…</p>
          ) : preflight.error ? (
            <p className="py-6 text-sm text-destructive">
              {errorMessage(preflight.error)}
            </p>
          ) : preflight.data ? (
            <div className="space-y-3 py-2">
              <p className="text-sm">
                Referencias encontradas:{" "}
                <strong>{preflight.data.totalReferencias}</strong>
              </p>
              {preflight.data.referencias.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {preflight.data.referencias.map((reference) => (
                    <li key={reference.tipo}>
                      {reference.tipo}: {reference.cantidad}
                    </li>
                  ))}
                </ul>
              )}
              {preflight.data.motivoBloqueo && (
                <p className="text-sm text-destructive">
                  {preflight.data.motivoBloqueo}
                </p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cerrar</Button>
            <Button
              variant="destructive"
              disabled={!preflight.data?.puedeEliminar}
              onClick={() => setConfirmOpen(true)}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmacionTextoExacto
        open={confirmOpen}
        onOpenChange={(value) => {
          setConfirmOpen(value);
          if (!value) setOpen(false);
        }}
        titulo="Eliminar registro definitivamente"
        descripcion={`Se eliminará ${nombreVisible}.`}
        textoRequerido={preflight.data?.nombreVisible ?? nombreVisible}
        textoConfirmar="Eliminar definitivamente"
        pendiente={remove.isPending}
        onConfirm={confirm}
      />
    </>
  );
}