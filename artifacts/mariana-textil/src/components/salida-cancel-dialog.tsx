import { useState, type ReactNode } from "react";
import {
  getGetExistenciasAgrupadasQueryKey,
  getGetExistenciasQueryKey,
  getGetSalidaQueryKey,
  getListarTicketsCajaQueryKey,
  getListarTicketsPendientesQueryKey,
  getListarTicketsQueryKey,
  getListRollosQueryKey,
  getListSalidasQueryKey,
  getObtenerTicketQueryKey,
  Role,
  useCancelarSalida,
  useGetSalida,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  canCancelSalidaDetail,
  canCancelSalidaHistory,
  type SalidaCancellationActor,
} from "@/lib/salida-cancelacion";
import type { SalidaDetail } from "@workspace/api-client-react";

type CancelDialogSalida = Pick<
  SalidaDetail,
  | "id"
  | "folioFormateado"
  | "estado"
  | "modalidad"
  | "origenId"
  | "destinoId"
  | "documentoVenta"
>;

type TriggerRenderProps = {
  onClick: () => void;
};

export type SalidaCancelDialogProps = {
  salida: CancelDialogSalida;
  user: SalidaCancellationActor | null | undefined;
  canCancel: boolean;
  /**
   * History rows use the explicit no-CAJA predicate; detail uses the shared
   * legacy-compatible predicate.
   */
  isHistory?: boolean;
  renderTrigger: (props: TriggerRenderProps) => ReactNode;
};

type RefreshedSalida = SalidaDetail;
type ReturnFloor = { id: number; nombre: string };

function isReturnFloor(value: unknown): value is ReturnFloor {
  if (typeof value !== "object" || value === null) return false;
  const floor = value as { id?: unknown; nombre?: unknown };
  return Number.isInteger(floor.id) && typeof floor.nombre === "string";
}

function isSalidaDetailQueryKey(queryKey: readonly unknown[]): boolean {
  const first = queryKey[0];
  return (
    typeof first === "string" &&
    first.startsWith("/api/salidas/") &&
    !first.endsWith("/cancelar")
  );
}

/**
 * Shared cancellation flow for detail and history.  Opening the action first
 * refreshes the full generated salida DTO; the confirmation form never
 * appears for stale, terminal, or now-out-of-scope rows.
 */
export function SalidaCancelDialog({
  salida,
  user,
  canCancel,
  isHistory = false,
  renderTrigger,
}: SalidaCancelDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cancelMutation = useCancelarSalida();
  const [open, setOpen] = useState(false);
  const [freshSalida, setFreshSalida] = useState<RefreshedSalida | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [motivo, setMotivo] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [pisoRetornoId, setPisoRetornoId] = useState("");
  const [passwordVisibilityResetKey, setPasswordVisibilityResetKey] =
    useState(0);

  const freshQuery = useGetSalida(salida.id, {
    query: {
      enabled: false,
      queryKey: getGetSalidaQueryKey(salida.id),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });

  const isAdmin = user?.rol === Role.ADMIN;
  const currentSalida = freshSalida ?? salida;
  const isTransitTransfer =
    freshSalida?.modalidad !== "VENTA_CLIENTE" &&
    freshSalida?.estado === "EN_TRANSITO";
  const returnFloorsPayload = freshSalida?.pisosRetorno;
  const hasReturnFloorsArray =
    !isTransitTransfer || Array.isArray(returnFloorsPayload);
  const hasValidReturnFloorsShape =
    !isTransitTransfer ||
    (Array.isArray(returnFloorsPayload) &&
      returnFloorsPayload.every(isReturnFloor));
  const returnFloorsShapeError =
    isTransitTransfer &&
    (!hasReturnFloorsArray || !hasValidReturnFloorsShape);
  const activeReturnFloors: ReturnFloor[] =
    isTransitTransfer &&
    Array.isArray(returnFloorsPayload) &&
    hasValidReturnFloorsShape
      ? returnFloorsPayload
      : [];
  const selectedReturnFloorId = pisoRetornoId
    ? Number(pisoRetornoId)
    : undefined;
  const hasValidReturnFloorSelection =
    selectedReturnFloorId != null &&
    Number.isInteger(selectedReturnFloorId) &&
    activeReturnFloors.some((piso) => piso.id === selectedReturnFloorId);
  const returnFloorsReady =
    !isTransitTransfer || !returnFloorsShapeError;
  const returnFloorRequired =
    isTransitTransfer && activeReturnFloors.length > 0;
  const freshCanCancel = freshSalida
    ? isHistory
      ? canCancelSalidaHistory(freshSalida, user)
      : canCancelSalidaDetail(freshSalida, user)
    : false;
  const hasFreshEligibility = freshSalida !== null && freshCanCancel;
  const hasLinkedDocument = Boolean(currentSalida.documentoVenta);

  const resetDialog = () => {
    setOpen(false);
    setFreshSalida(null);
    setRefreshError(null);
    setMotivo("");
    setAdminUsername("");
    setAdminPassword("");
    setPisoRetornoId("");
    setPasswordVisibilityResetKey((current) => current + 1);
  };

  const resetCancellationFields = () => {
    setFreshSalida(null);
    setRefreshError(null);
    setMotivo("");
    setAdminUsername("");
    setAdminPassword("");
    setPisoRetornoId("");
    setPasswordVisibilityResetKey((current) => current + 1);
  };

  const refetchFreshSalida = async () => {
    setFreshSalida(null);
    setRefreshError(null);
    setPisoRetornoId("");

    try {
      const result = await freshQuery.refetch();
      if (result.error || !result.data) {
        setRefreshError(result.error ?? new Error("No se pudo cargar la salida."));
        return;
      }
      setFreshSalida(result.data);
    } catch (error) {
      setRefreshError(error);
    }
  };

  const beginCancel = async () => {
    if (!canCancel || freshQuery.isFetching) return;

    setOpen(true);
    resetCancellationFields();
    await refetchFreshSalida();
  };

  const invalidateAfterCancellation = async (cancelled: RefreshedSalida) => {
    const linkedDocumentId = cancelled.documentoVenta?.id;
    const invalidations = [
      queryClient.invalidateQueries({
        queryKey: getGetSalidaQueryKey(cancelled.id),
      }),
      queryClient.invalidateQueries({
        predicate: (query) => isSalidaDetailQueryKey(query.queryKey),
      }),
      queryClient.invalidateQueries({ queryKey: getListSalidasQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetExistenciasQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getGetExistenciasAgrupadasQueryKey(),
      }),
    ];

    if (linkedDocumentId != null) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: getObtenerTicketQueryKey(linkedDocumentId),
        }),
        queryClient.invalidateQueries({ queryKey: getListarTicketsQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getListarTicketsPendientesQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getListarTicketsCajaQueryKey(),
        }),
      );
    }

    await Promise.all(invalidations);
  };

  const onCancel = () => {
    const trimmedMotivo = motivo.trim();
    if (!freshSalida || !hasFreshEligibility) return;
    setPasswordVisibilityResetKey((current) => current + 1);
    if (trimmedMotivo.length < 10) {
      toast({
        title: "Atención",
        description: "El motivo debe tener al menos 10 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (isTransitTransfer) {
      if (!returnFloorsReady) {
        toast({
          title: "No se pudo cargar el piso de retorno",
          description:
            "La salida no devolvió la lista de pisos del origen. Recarga la información antes de cancelar.",
          variant: "destructive",
        });
        return;
      }
      if (returnFloorRequired && !hasValidReturnFloorSelection) {
        toast({
          title: "Selecciona un piso de retorno",
          description:
            "Elige un piso activo del origen para devolver todos los rollos.",
          variant: "destructive",
        });
        return;
      }
    }

    const returnFloorData =
      isTransitTransfer &&
      returnFloorRequired &&
      hasValidReturnFloorSelection &&
      selectedReturnFloorId != null
        ? { pisoRetornoId: selectedReturnFloorId }
        : {};

    cancelMutation.mutate(
      {
        id: freshSalida.id,
        data: {
          motivo: trimmedMotivo,
          ...returnFloorData,
          ...(!isAdmin
            ? { adminUsuario: adminUsername, adminPassword }
            : {}),
        },
      },
      {
        onSuccess: async () => {
          const grouped = Boolean(freshSalida.documentoVenta);
          await invalidateAfterCancellation(freshSalida);
          toast({
            title: grouped
              ? "Documento y salidas vinculadas cancelados"
              : "Salida cancelada",
            description: grouped
              ? "La operación atómica canceló el documento completo y todas sus salidas agrupadas."
              : undefined,
          });
          resetDialog();
        },
        onError: (error) =>
          toast({
            title: "Error",
            description: getApiErrorMessage(error),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <>
      {renderTrigger({ onClick: beginCancel })}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) resetDialog();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {hasLinkedDocument
                ? "Cancelar documento y salidas vinculadas"
                : "Cancelar Salida"}
            </DialogTitle>
          </DialogHeader>

          {freshQuery.isFetching || (open && !freshSalida && !refreshError) ? (
            <div
              className="flex min-h-32 flex-col items-center justify-center gap-2 text-muted-foreground"
              data-testid={`cancel-refresh-loading-${salida.id}`}
            >
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Cargando información actualizada de la salida...</p>
            </div>
          ) : refreshError ? (
            <div
              className="flex min-h-32 items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-700"
              data-testid={`cancel-refresh-error-${salida.id}`}
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{getApiErrorMessage(refreshError, "No se pudo actualizar la salida.")}</p>
            </div>
          ) : freshSalida && !freshCanCancel ? (
            <div
              className="flex min-h-32 items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-700"
              data-testid={`cancel-refresh-ineligible-${salida.id}`}
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Esta salida ya no está disponible para cancelación con tu
                autorización, sitio o estado actual.
              </p>
            </div>
          ) : hasFreshEligibility ? (
            <>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-slate-500">
                  {freshSalida.documentoVenta
                    ? "Esta operación es atómica: cancelará el documento de venta completo y todas las salidas agrupadas vinculadas, no únicamente esta salida. Se liberarán los bloqueos en cada origen y el documento dejará de autorizar entregas. La cancelación no borra el historial."
                    : `¿Estás seguro de cancelar esta salida? ${
                        freshSalida.modalidad === "VENTA_CLIENTE"
                          ? "Se liberará el bloqueo en el origen; la cancelación no borra el historial."
                          : freshSalida.estado === "EN_TRANSITO"
                            ? "Todos los rollos regresarán al origen original mediante movimientos compensatorios trazables; la cancelación no borra el historial."
                          : "Los rollos seguirán disponibles en el origen."
                      }`}
                </p>
                {isTransitTransfer && (
                  <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">
                      Piso de retorno al origen
                    </p>
                    {returnFloorsShapeError ? (
                      <div
                        className="space-y-2 text-sm text-red-700"
                        role="alert"
                      >
                        <p>
                          No se recibió la lista de pisos activos del origen.
                          Recarga la salida para continuar; no se asumirá que no
                          hay pisos.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void refetchFreshSalida()}
                          disabled={freshQuery.isFetching}
                        >
                          {freshQuery.isFetching && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Recargar salida
                        </Button>
                      </div>
                    ) : activeReturnFloors.length > 0 ? (
                      <Select
                        value={pisoRetornoId}
                        onValueChange={setPisoRetornoId}
                      >
                        <SelectTrigger
                          aria-label="Piso de retorno al origen"
                          aria-required={returnFloorRequired}
                          data-testid="select-piso-retorno"
                        >
                          <SelectValue placeholder="Seleccionar piso activo" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeReturnFloors.map((piso) => (
                            <SelectItem
                              key={piso.id}
                              value={String(piso.id)}
                            >
                              {piso.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-amber-800">
                        El origen no tiene pisos activos; no se enviará un piso
                        de retorno.
                      </p>
                    )}
                  </div>
                )}
                <Textarea
                  data-testid="input-cancel-motivo"
                  placeholder="Motivo de la cancelación (Mínimo 10 caracteres)..."
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                />

                {!isAdmin && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Lock className="h-4 w-4" /> Autorización Requerida
                    </p>
                    <Input
                      data-testid="input-cancel-username"
                      placeholder="Usuario Admin"
                      value={adminUsername}
                      onChange={(event) => setAdminUsername(event.target.value)}
                    />
                    <PasswordInput
                      id="salida-admin-password"
                      data-testid="input-cancel-password"
                      placeholder="Contraseña Admin"
                      aria-label="Contraseña ADMIN"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      autoComplete="current-password"
                      visibilityResetKey={`cancel:${passwordVisibilityResetKey}`}
                      toggleTestId="toggle-salida-admin-password"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetDialog}>
                  Cerrar
                </Button>
                <Button
                  data-testid="btn-submit-cancel"
                  variant="destructive"
                  onClick={onCancel}
                  disabled={
                    cancelMutation.isPending ||
                    motivo.trim().length < 10 ||
                    !returnFloorsReady ||
                    (returnFloorRequired && !hasValidReturnFloorSelection) ||
                    (!isAdmin && (!adminUsername || !adminPassword))
                  }
                >
                  {cancelMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {freshSalida.documentoVenta
                    ? "Cancelar documento y todas sus salidas"
                    : "Confirmar Cancelación"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}