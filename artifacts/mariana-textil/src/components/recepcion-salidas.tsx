import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSalidaRecepcionQueryKey,
  getListSalidasRecepcionQueryKey,
  useGetSalidaRecepcion,
  useListSalidasRecepcion,
  useRecibirSalida,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { formatNumber } from "@workspace/number-format";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

function folioFromScan(raw: string): number | null {
  const value = raw.trim();
  try {
    const url = new URL(value, window.location.origin);
    const queryFolio = url.searchParams.get("folio");
    if (queryFolio) return folioFromScan(queryFolio);
  } catch {
    // Plain folios are handled below.
  }
  const match = /^(?:[A-Za-z]+[-\s]?)?(\d+)$/.exec(value);
  return match ? Number(match[1]) : null;
}

export function RecepcionSalidas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const initialFolio = folioFromScan(
    new URLSearchParams(window.location.search).get("folio") ?? "",
  );
  const [scan, setScan] = useState("");
  const [folio, setFolio] = useState<number | null>(initialFolio);
  const [completa, setCompleta] = useState(true);
  const [nota, setNota] = useState("");
  const pendientes = useListSalidasRecepcion({
    query: {
      queryKey: getListSalidasRecepcionQueryKey(),
      refetchInterval: 30_000,
    },
  });
  const detalle = useGetSalidaRecepcion(folio ?? 0, {
    query: {
      enabled: folio != null,
      queryKey: getGetSalidaRecepcionQueryKey(folio ?? 0),
      retry: false,
    },
  });
  const receive = useRecibirSalida({
    mutation: {
      onSuccess: async (received) => {
        toast({
          title: "Salida recibida",
          description: `El folio ${received.folioFormateado} y todos sus rollos ya están en el destino.`,
        });
        setFolio(null);
        setCompleta(true);
        setNota("");
        await queryClient.invalidateQueries({
          queryKey: getListSalidasRecepcionQueryKey(),
        });
      },
      onError: (error) =>
        toast({
          title: "No se pudo recibir la salida",
          description: getApiErrorMessage(error),
          variant: "destructive",
        }),
    },
  });

  useEffect(() => {
    setCompleta(true);
    setNota("");
  }, [folio]);

  const selectScan = (raw: string) => {
    const parsed = folioFromScan(raw);
    if (parsed == null) {
      toast({
        title: "Código no válido",
        description: "Escanea el QR de la hoja o escribe únicamente el folio.",
        variant: "destructive",
      });
      return;
    }
    setFolio(parsed);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Escanear salida para recibir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CampoEscaneo
            value={scan}
            onChange={setScan}
            onScan={selectScan}
            interpretRollCode={false}
            autoFocus
            placeholder="Escanea el QR o escribe el folio y presiona Enter"
            aria-label="QR o folio de salida"
          />
        </CardContent>
      </Card>

      {detalle.isLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Consultando salida…
        </div>
      )}
      {detalle.error && (
        <Card className="border-destructive">
          <CardContent className="p-5 text-sm text-destructive">
            {getApiErrorMessage(detalle.error)}
          </CardContent>
        </Card>
      )}
      {detalle.data && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Folio {detalle.data.folioFormateado}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Summary label="Origen" value={detalle.data.nombreOrigen} />
              <Summary label="Destino" value={detalle.data.nombreDestino} />
              <Summary label="Rollos" value={formatNumber(detalle.data.totalRollos ?? 0, { kind: "count" })} />
              <Summary label="Transportista" value={detalle.data.transportista || "—"} />
              <Summary label="Metros" value={formatNumber(detalle.data.totalMetros ?? "0", { kind: "quantity" })} />
              <Summary label="Kilos" value={formatNumber(detalle.data.totalKilos ?? "0", { kind: "quantity" })} />
              <Summary label="Enviado por" value={detalle.data.nombreEnviadoPor || "—"} />
              <Summary
                label="Fecha de envío"
                value={detalle.data.fechaEnvio
                  ? format(new Date(detalle.data.fechaEnvio), "dd MMM yyyy, HH:mm", { locale: es })
                  : "—"}
              />
            </div>
            <div className="space-y-3 border-t pt-4">
              <label className="flex items-center gap-3 font-medium">
                <Checkbox
                  checked={completa}
                  onCheckedChange={(checked) => setCompleta(checked === true)}
                />
                ¿Llegó completo?
              </label>
              {!completa && (
                <div className="space-y-1">
                  <Textarea
                    value={nota}
                    onChange={(event) => setNota(event.target.value)}
                    maxLength={2000}
                    placeholder="Nota opcional sobre lo ocurrido"
                  />
                  <p className="text-xs text-amber-700">
                    Se enviará una notificación a ADMIN.
                  </p>
                </div>
              )}
              <Button
                className="w-full sm:w-auto"
                disabled={receive.isPending}
                onClick={() =>
                  receive.mutate({
                    id: detalle.data.id,
                    data: { completa, nota: nota.trim() || null },
                  })
                }
              >
                {receive.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirmar recepción de todos los rollos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pendientes para este sitio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendientes.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando pendientes…</p>
          ) : pendientes.error ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(pendientes.error)}</p>
          ) : !pendientes.data?.length ? (
            <p className="text-sm text-muted-foreground">No hay salidas en tránsito por recibir.</p>
          ) : pendientes.data.map((salida) => (
            <button
              key={salida.id}
              type="button"
              onClick={() => setFolio(salida.folio)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-left hover:bg-muted"
            >
              <span className="font-semibold">Folio {salida.folioFormateado}</span>
              <span className="text-sm text-muted-foreground">
                {salida.nombreOrigen} → {salida.nombreDestino} · {salida.totalRollos ?? 0} rollos
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}