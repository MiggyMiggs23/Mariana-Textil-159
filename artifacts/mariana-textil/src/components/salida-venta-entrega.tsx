import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  getGetSalidaQueryKey,
  getListSalidasQueryKey,
  getVerificarAutorizacionVentaSalidasQueryKey,
  useEntregarSalidaVentaCliente,
  useGetSalida,
  useVerificarAutorizacionVentaSalidas,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { normalizarSerieEscaneada } from "@workspace/scanned-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { ApiErrorDetails, getApiErrorMessage } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";

type SalidaVentaEntregaProps = {
  salidaId: number;
  estado: string;
};

function isTerminalSalida(estado: string | undefined): boolean {
  return estado === "ENTREGADA" || estado === "CANCELADA";
}

/**
 * Verifies the linked sale and records delivery without taking the operator
 * through the general salida detail page. The detail query is intentionally
 * enabled only while this dialog is open.
 */
export function SalidaVentaEntrega({ salidaId, estado }: SalidaVentaEntregaProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scanRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [folioBusqueda, setFolioBusqueda] = useState("");
  const [folioVerificado, setFolioVerificado] = useState<number | null>(null);
  const [seriesEntrega, setSeriesEntrega] = useState<string[]>([]);
  const [scanValue, setScanValue] = useState("");

  const { data: salida, isLoading, error } = useGetSalida(salidaId, {
    query: {
      enabled: open,
      queryKey: getGetSalidaQueryKey(salidaId),
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  });
  const verify = useVerificarAutorizacionVentaSalidas(
    { folio: folioVerificado ?? 0 },
    {
      query: {
        enabled: open && folioVerificado != null,
        queryKey: getVerificarAutorizacionVentaSalidasQueryKey({
          folio: folioVerificado ?? 0,
        }),
        retry: false,
      },
    },
  );
  const entregar = useEntregarSalidaVentaCliente();

  const resetDeliveryState = () => {
    setFolioBusqueda("");
    setFolioVerificado(null);
    setSeriesEntrega([]);
    setScanValue("");
  };

  const focusScanner = () => {
    window.setTimeout(() => scanRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (open && verify.data) focusScanner();
  }, [open, verify.data]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetDeliveryState();
  };

  const verifyFolio = () => {
    if (!/^\d+$/.test(folioBusqueda)) return;
    const folio = Number(folioBusqueda);
    if (folioVerificado === folio) {
      void verify.refetch();
    } else {
      setFolioVerificado(folio);
    }
    focusScanner();
  };

  const selectedTerminal = isTerminalSalida(salida?.estado ?? estado);
  const expectedSeries = salida?.rollos.map((rollo) => rollo.serie) ?? [];
  const linkedSalida = Boolean(
    verify.data?.salidas.some((linked) => linked.id === salidaId),
  );
  const allSeriesVerified =
    expectedSeries.length > 0 &&
    seriesEntrega.length === expectedSeries.length &&
    expectedSeries.every((serie) => seriesEntrega.includes(serie));
  const canDeliver =
    !selectedTerminal &&
    Boolean(verify.data?.autorizada) &&
    linkedSalida &&
    allSeriesVerified &&
    !entregar.isPending;

  const submitDelivery = () => {
    if (!salida || !canDeliver) return;
    entregar.mutate(
      { id: salidaId, data: { series: seriesEntrega } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getGetSalidaQueryKey(salidaId),
          });
          await queryClient.invalidateQueries({
            queryKey: getListSalidasQueryKey(),
          });
          toast({ title: "Salida entregada" });
          setOpen(false);
          resetDeliveryState();
        },
        onError: (mutationError) =>
          toast({
            title: "No se pudo entregar",
            description: <ApiErrorDetails error={mutationError} />,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid={`btn-entregar-salida-${salidaId}`}
        disabled={isTerminalSalida(estado)}
        onClick={() => setOpen(true)}
        className="gap-1.5 whitespace-nowrap"
        aria-label={
          isTerminalSalida(estado)
            ? `Salida ${salidaId} cerrada`
            : `Verificar y entregar salida ${salidaId}`
        }
      >
        <PackageCheck className="h-4 w-4" />
        Entregar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              Verificar autorización y entregar
            </DialogTitle>
            <DialogDescription>
              Verifica el folio del documento de venta y después escanea
              exactamente cada serie esperada en el origen.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p>Cargando salida...</p>
            </div>
          ) : error || !salida ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-destructive">
              <AlertCircle className="h-6 w-6" />
              <p>{getApiErrorMessage(error, "No se pudo cargar la salida.")}</p>
            </div>
          ) : selectedTerminal ? (
            <div
              className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4"
              data-testid={`status-entrega-terminal-${salidaId}`}
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-slate-500" />
              <div>
                <p className="font-medium text-slate-800">
                  Esta salida ya está cerrada.
                </p>
                <p className="text-sm text-slate-600">
                  No se puede registrar otra entrega para una salida
                  {salida.estado === "CANCELADA"
                    ? " cancelada."
                    : " entregada."}
                </p>
              </div>
            </div>
          ) : (
            <Card className="border-violet-200 bg-violet-50/40">
              <CardHeader>
                <CardTitle className="text-base">
                  Folio y series de entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    data-testid={`input-folio-entrega-${salidaId}`}
                    value={folioBusqueda}
                    onChange={(event) => setFolioBusqueda(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      verifyFolio();
                    }}
                    inputMode="numeric"
                    placeholder="Folio de venta"
                    aria-label="Folio de venta"
                  />
                  <Button
                    type="button"
                    data-testid={`btn-verificar-folio-${salidaId}`}
                    onClick={verifyFolio}
                    disabled={
                      !/^\d+$/.test(folioBusqueda) || verify.isFetching
                    }
                  >
                    {verify.isFetching && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Verificar
                  </Button>
                </div>

                {verify.error && (
                  <p
                    className="text-sm text-destructive"
                    role="alert"
                    data-testid={`error-verificar-folio-${salidaId}`}
                  >
                    {getApiErrorMessage(verify.error)}
                  </p>
                )}

                {verify.data && (
                  <div
                    className={`rounded border p-3 text-sm ${
                      verify.data.autorizada && linkedSalida
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-amber-300 bg-amber-50"
                    }`}
                    data-testid={`status-verificacion-venta-${salidaId}`}
                  >
                    <strong>
                      {verify.data.autorizada && linkedSalida
                        ? "AUTORIZADA"
                        : verify.data.estado}
                    </strong>
                    <Link
                      className="ml-2 text-primary underline"
                      href={verify.data.documentoHref}
                      data-testid={`link-documento-verificado-${salidaId}`}
                    >
                      Documento {verify.data.folioFormateado}
                    </Link>
                    <div className="mt-2">
                      Salidas vinculadas:{" "}
                      {verify.data.salidas.map((linked) => (
                        <Link
                          key={linked.id}
                          className="mr-2 text-primary underline"
                          data-testid={`link-salida-vinculada-${salidaId}-${linked.id}`}
                          href={
                            linked.href.startsWith("/api")
                              ? `/salidas/${linked.id}`
                              : linked.href
                          }
                        >
                          {linked.folioFormateado} · {linked.nombreOrigen}
                        </Link>
                      ))}
                    </div>
                    {!linkedSalida && (
                      <p className="mt-2 text-amber-800" role="alert">
                        Este documento no está vinculado a la salida
                        seleccionada.
                      </p>
                    )}
                  </div>
                )}

                <CampoEscaneo
                  scanMode="serie"
                  ref={scanRef}
                  value={scanValue}
                  onChange={setScanValue}
                  onScan={(_value, codigo) => {
                    const normalized = normalizarSerieEscaneada(codigo);
                    if (!expectedSeries.includes(normalized)) {
                      toast({
                        title: "SERIE NO PERTENECE A ESTA SALIDA",
                        description: `La serie ${normalized} pertenece a otra salida o no está autorizada.`,
                        variant: "destructive",
                      });
                      focusScanner();
                      return;
                    }
                    setSeriesEntrega((current) =>
                      current.includes(normalized)
                        ? current
                        : [...current, normalized],
                    );
                    focusScanner();
                  }}
                  disabled={selectedTerminal}
                  placeholder="Escanea una serie exacta"
                  aria-label="Serie exacta para entregar"
                  data-testid={`input-serie-entrega-${salidaId}`}
                />
                <p
                  className="text-sm font-medium"
                  aria-live="polite"
                  data-testid={`progress-series-entrega-${salidaId}`}
                >
                  Progreso: {seriesEntrega.length} de {expectedSeries.length}{" "}
                  rollos esperados
                </p>
                <div className="flex flex-wrap gap-2">
                  {expectedSeries.map((serie) => (
                    <Badge
                      key={serie}
                      variant="outline"
                      className={
                        seriesEntrega.includes(serie)
                          ? "border-emerald-400 bg-emerald-50"
                          : ""
                      }
                      data-testid={`badge-serie-entrega-${salidaId}-${serie}`}
                    >
                      {serie}
                    </Badge>
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    data-testid={`btn-submit-entrega-${salidaId}`}
                    className="w-full"
                    disabled={!canDeliver}
                    onClick={submitDelivery}
                  >
                    {entregar.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Marcar ENTREGADA
                  </Button>
                </DialogFooter>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
