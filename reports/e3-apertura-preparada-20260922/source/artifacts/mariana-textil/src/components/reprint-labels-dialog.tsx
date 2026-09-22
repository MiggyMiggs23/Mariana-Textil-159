import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
} from "@workspace/api-client-react";
import { LabelPrint } from "@/components/label-print";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { etiquetasApi, type EtiquetaRollo } from "@/lib/etiquetas-api";
import { hasPermission, Modules } from "@/lib/permisos";
import { printWhenReady } from "@/lib/print";

const MOTIVOS = [
  "Etiqueta dañada",
  "Etiqueta despegada",
  "Etiqueta ilegible",
  "Etiqueta mojada",
  "Otro",
];

export interface ReprintLabelsDialogProps {
  rolloIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type PrintData = {
  rollos: EtiquetaRollo[];
  createdAt: string;
};

/**
 * Shared authorization, audit, and printing flow for label reprints.
 *
 * The dialog deliberately resolves every rollo again when it opens. Search
 * results and detail pages can be stale by the time a user authorizes a
 * reprint, especially for the repeat-reprint warning.
 */
export function ReprintLabelsDialog({
  rolloIds,
  open,
  onOpenChange,
  onSuccess,
}: ReprintLabelsDialogProps) {
  const idsInputKey = rolloIds.join(",");
  const normalizedIds = useMemo(
    () => [...new Set(rolloIds.filter((id) => Number.isInteger(id) && id > 0))],
    [idsInputKey],
  );
  const batchKey = normalizedIds.join(",");
  const tooMany = normalizedIds.length > 50;

  const { data: user, isLoading: userLoading } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() },
  });
  const queryClient = useQueryClient();
  const isAdmin = user?.rol === "ADMIN";
  const canPrint = hasPermission(user, Modules.ETIQUETAS, "crear");

  const [motivoOption, setMotivoOption] = useState("");
  const [otroMotivo, setOtroMotivo] = useState("");
  const [adminUsuario, setAdminUsuario] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [printMode, setPrintMode] = useState<"thermal" | "sheet">("thermal");
  const [confirmedWarnings, setConfirmedWarnings] = useState<Set<number>>(
    new Set(),
  );
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [printing, setPrinting] = useState(false);

  const detailsQuery = useQuery({
    queryKey: ["etiquetas", "reprint-dialog", normalizedIds],
    queryFn: () => Promise.all(normalizedIds.map((id) => etiquetasApi.obtenerRollo(id))),
    enabled: open && normalizedIds.length > 0 && !tooMany,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const rollos = detailsQuery.data ?? [];
  const loadingDetails = detailsQuery.isLoading || detailsQuery.isFetching;

  // Reopening the dialog must never retain an old reason, credential, or
  // warning confirmation. A changed count is also a new warning decision.
  useEffect(() => {
    if (!open) return;
    setMotivoOption("");
    setOtroMotivo("");
    setAdminUsuario("");
    setAdminPassword("");
    setConfirmedWarnings(new Set());
  }, [open, batchKey]);

  const warningSignature = rollos
    .filter((rollo) => rollo.reimpresiones >= 3)
    .map((rollo) => `${rollo.id}:${rollo.reimpresiones}`)
    .join("|");

  useEffect(() => {
    setConfirmedWarnings(new Set());
  }, [batchKey, warningSignature]);

  useEffect(() => {
    if (open && tooMany) {
      toast({
        title: "Límite alcanzado",
        description: "Puedes reimprimir un máximo de 50 etiquetas por operación.",
        variant: "destructive",
      });
    }
  }, [open, tooMany]);

  const effectiveReason =
    motivoOption === "Otro" ? otroMotivo.trim() : motivoOption.trim();
  const warningRollos = rollos.filter((rollo) => rollo.reimpresiones >= 3);
  const warningsConfirmed = warningRollos.every((rollo) =>
    confirmedWarnings.has(rollo.id),
  );

  const mutation = useMutation({
    mutationFn: async (body: Parameters<typeof etiquetasApi.reimprimir>[0]) => {
      const result = await etiquetasApi.reimprimir(body);
      if (!result || typeof result !== "object") {
        throw new Error(
          "La respuesta de reimpresión está incompleta; no se generaron etiquetas para imprimir.",
        );
      }
      const returnedRollos = (result as { rollos?: unknown }).rollos;
      const returnedIds = Array.isArray(returnedRollos)
        ? returnedRollos.map((rollo) =>
            rollo && typeof rollo === "object" && "id" in rollo
              ? Number((rollo as { id: unknown }).id)
              : NaN,
          )
        : [];
      const expectedIds = [...normalizedIds].sort((a, b) => a - b);
      const actualIds = [...returnedIds].sort((a, b) => a - b);
      if (
        !Array.isArray(returnedRollos) ||
        returnedRollos.length !== normalizedIds.length ||
        actualIds.some((id, index) => id !== expectedIds[index]) ||
        typeof result.createdAt !== "string" ||
        !result.createdAt.trim()
      ) {
        throw new Error(
          "La respuesta de reimpresión está incompleta; no se generaron etiquetas para imprimir.",
        );
      }
      return result;
    },
    onSuccess: (result) => {
      setPrintData({
        rollos: result.rollos,
        createdAt: result.createdAt,
      });
      void queryClient.invalidateQueries({ queryKey: ["etiquetas"] });
      for (const rolloId of normalizedIds) {
        void queryClient.invalidateQueries({
          queryKey: ["etiquetas", "rollo", rolloId, "resumen"],
        });
      }
      toast({
        title: "Reimpresión autorizada",
        description: `${result.rollos.length} etiqueta(s) registradas. Revisa la vista antes de imprimir.`,
      });
      setPendingPrint(true);
    },
    onError: (error) =>
      toast({
        title: "No se pudo autorizar la reimpresión",
        description: getApiErrorMessage(error),
        variant: "destructive",
      }),
  });

  const canSubmit =
    !userLoading &&
    canPrint &&
    !tooMany &&
    !loadingDetails &&
    !detailsQuery.isError &&
    rollos.length === normalizedIds.length &&
    rollos.length > 0 &&
    effectiveReason.length >= 10 &&
    warningsConfirmed &&
    (isAdmin || (!!adminUsuario.trim() && !!adminPassword)) &&
    !mutation.isPending;

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (mutation.isPending || pendingPrint || printing)) return;
    onOpenChange(nextOpen);
  };

  const submit = () => {
    if (!canSubmit) {
      if (effectiveReason.length < 10) {
        toast({
          title: "Motivo incompleto",
          description: "El motivo debe tener al menos 10 caracteres.",
          variant: "destructive",
        });
      } else if (!isAdmin && (!adminUsuario.trim() || !adminPassword)) {
        toast({
          title: "Autorización requerida",
          description: "Ingresa usuario y contraseña de un ADMIN.",
          variant: "destructive",
        });
      }
      return;
    }

    mutation.mutate({
      rolloIds: normalizedIds,
      motivo: effectiveReason,
      ...(isAdmin
        ? {}
        : { adminUsuario: adminUsuario.trim(), adminPassword }),
    });
  };

  useEffect(() => {
    if (!pendingPrint || !printData) return;
    setPendingPrint(false);
    setPrinting(true);
    void printWhenReady(
      printMode === "thermal" ? "printing-labels" : "printing-label-sheet",
    )
      .then(() => {
        setPrinting(false);
        onOpenChange(false);
        onSuccess?.();
      })
      .catch((error) => {
        setPrinting(false);
        toast({
          title: "No se pudo iniciar la impresión",
          description: getApiErrorMessage(error),
          variant: "destructive",
        });
      });
  }, [pendingPrint, printData, printMode, onOpenChange, onSuccess]);

  return (
    <>
      {printData &&
        createPortal(
          <div
            className={`print-only etiquetas-print ${
              printMode === "sheet" ? "etiquetas-sheet-print" : ""
            }`}
          >
            {printData.rollos.map((rollo) => (
              <LabelPrint
                key={rollo.id}
                data={{
                  sku: rollo.sku,
                  serie: rollo.serie,
                  tela: rollo.tela || rollo.producto || "Producto",
                  color: rollo.color,
                  cantidad: rollo.cantidad,
                  unidad: rollo.unidad,
                  reimpresaEn: printData.createdAt,
                }}
                className={printMode === "sheet" ? "sheet-label" : ""}
              />
            ))}
            {printMode === "sheet" && (
              <div className="print-only label-sheet-note">
                Etiquetas recomendadas: papel térmico adhesivo 100 × 70 mm
              </div>
            )}
          </div>,
          document.body,
        )}

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="sm:max-w-lg max-h-[90dvh] overflow-y-auto"
          onEscapeKeyDown={(event) => {
            if (mutation.isPending || pendingPrint || printing) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (mutation.isPending || pendingPrint || printing) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Autorizar reimpresión</DialogTitle>
            <DialogDescription>
              Se registrará una reimpresión permanente para {normalizedIds.length}{" "}
              rollo(s). La serie no cambiará.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {tooMany ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Demasiadas etiquetas</AlertTitle>
                <AlertDescription>
                  Selecciona como máximo 50 etiquetas por operación.
                </AlertDescription>
              </Alert>
            ) : normalizedIds.length === 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No hay etiquetas seleccionadas</AlertTitle>
                <AlertDescription>
                  Selecciona al menos un rollo para solicitar una reimpresión.
                </AlertDescription>
              </Alert>
            ) : loadingDetails ? (
              <div className="grid place-items-center rounded-lg border p-6">
                <Loader2
                  className="h-6 w-6 animate-spin text-primary"
                  aria-label="Cargando etiquetas"
                />
              </div>
            ) : detailsQuery.isError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No se pudieron cargar las etiquetas</AlertTitle>
                <AlertDescription>
                  {getApiErrorMessage(detailsQuery.error)}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
                {rollos.map((rollo) => (
                  <div
                    key={rollo.id}
                    className="rounded-md border bg-muted/20 p-3"
                    data-testid={`row-reprint-label-${rollo.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono font-bold" data-testid={`text-reprint-serie-${rollo.id}`}>
                          {rollo.serie}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {rollo.producto || rollo.tela || "Producto"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {rollo.reimpresiones} reimpresiones
                      </span>
                    </div>
                    {rollo.reimpresiones >= 3 && (
                      <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        <Checkbox
                          checked={confirmedWarnings.has(rollo.id)}
                          onCheckedChange={(checked) =>
                            setConfirmedWarnings((current) => {
                              const next = new Set(current);
                              if (checked === true) next.add(rollo.id);
                              else next.delete(rollo.id);
                              return next;
                            })
                          }
                          aria-label={`Confirmar reimpresión de ${rollo.serie}`}
                          data-testid={`checkbox-confirm-reprint-${rollo.id}`}
                        />
                        <span>
                          Confirmo reimprimir la serie {rollo.serie}; ya cuenta
                          con {rollo.reimpresiones} reimpresiones.
                        </span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select value={motivoOption} onValueChange={setMotivoOption}>
                <SelectTrigger data-testid="select-reprint-reason">
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((motivo) => (
                    <SelectItem key={motivo} value={motivo}>
                      {motivo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {motivoOption === "Otro" && (
              <div className="space-y-2">
                <Label htmlFor="reprint-other-reason">Describe el motivo *</Label>
                <Textarea
                  id="reprint-other-reason"
                  value={otroMotivo}
                  onChange={(event) => setOtroMotivo(event.target.value)}
                  placeholder="Mínimo 10 caracteres"
                  data-testid="textarea-reprint-reason"
                />
              </div>
            )}
            {motivoOption && motivoOption !== "Otro" && (
              <p className="text-xs text-muted-foreground">
                Motivo: {motivoOption} ({motivoOption.trim().length} caracteres)
              </p>
            )}
            {motivoOption === "Otro" && (
              <p className="text-xs text-muted-foreground">
                {effectiveReason.length}/10 caracteres mínimos
              </p>
            )}

            <div className="space-y-2">
              <Label>Formato de impresión</Label>
              <Select
                value={printMode}
                onValueChange={(value: "thermal" | "sheet") =>
                  setPrintMode(value)
                }
              >
                <SelectTrigger data-testid="select-reprint-print-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thermal">Térmica 100 × 70 mm</SelectItem>
                  <SelectItem value="sheet">
                    Hoja carta múltiple (hasta 6 por hoja)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isAdmin && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div>
                  <p className="font-semibold text-amber-900">
                    Credenciales de ADMIN
                  </p>
                  <p className="text-xs text-amber-800">
                    El administrador presente debe autorizar esta operación.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-user">Usuario</Label>
                  <Input
                    id="admin-user"
                    value={adminUsuario}
                    onChange={(event) => setAdminUsuario(event.target.value)}
                    autoComplete="off"
                    data-testid="input-reprint-admin-user"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">Contraseña</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    autoComplete="new-password"
                    data-testid="input-reprint-admin-password"
                  />
                </div>
              </div>
            )}
          </div>

          {!canPrint && !userLoading && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Sin permiso</AlertTitle>
              <AlertDescription>
                Reimprimir requiere el permiso etiquetas.crear.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              data-testid="button-cancel-reprint"
            >
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={!canSubmit}
              data-testid="button-authorize-reprint"
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Autorizar y generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
