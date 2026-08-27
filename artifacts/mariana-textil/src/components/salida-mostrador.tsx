import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  getListSalidasQueryKey,
  Role,
  useCrearSalidaMostrador,
  useGetCurrentUser,
  useGetUbicacionesSalida,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Barcode, Loader2, MapPin, Package, Trash2 } from "lucide-react";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { interpretarCodigoEscaneado } from "@workspace/scanned-code";
import { ConfirmacionTextoExacto } from "@/components/confirmacion-texto-exacto";

export function SalidaMostrador() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetCurrentUser();
  const { data: locations } = useGetUbicacionesSalida();
  const createMutation = useCrearSalidaMostrador();
  const inputRef = useRef<HTMLInputElement>(null);
  const uuidRef = useRef(crypto.randomUUID());
  const [origenId, setOrigenId] = useState<number | "">("");
  const [input, setInput] = useState("");
  const [series, setSeries] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const isAdmin = user?.rol === Role.ADMIN;

  useEffect(() => {
    if (!isAdmin && user?.ubicacion?.id) setOrigenId(user.ubicacion.id);
  }, [isAdmin, user]);

  const addSeries = (raw: string) => {
    const code = interpretarCodigoEscaneado(raw);
    const serie = (code.serie ?? code.textoOriginal).trim().toUpperCase();
    if (!serie) return;
    if (series.includes(serie)) {
      toast({
        title: "Rollo repetido",
        description: `La serie ${serie} ya está capturada.`,
        variant: "destructive",
      });
      setInput("");
      return;
    }
    setSeries((current) => [...current, serie]);
    setInput("");
  };

  const executeConfirm = async () => {
    if (!origenId || !series.length) return;
    try {
      const document = await createMutation.mutateAsync({
        data: {
          uuidCliente: uuidRef.current,
          origenId: Number(origenId),
          series,
          observaciones: observaciones.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListSalidasQueryKey() });
      toast({
        title: "Salida a mostrador confirmada",
        description: `Se generó el folio ${document.folioFormateado}.`,
      });
      setLocation(`/salidas/${document.id}/documento/salida`);
    } catch (error) {
      toast({
        title: "No se pudo confirmar la salida",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
      inputRef.current?.focus();
    }
  };

  const confirm = () => {
    if (series.length > 5) {
      setConfirmationOpen(true);
      return;
    }
    void executeConfirm();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Sitio de origen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isAdmin ? (
            <Select value={origenId ? String(origenId) : ""} onValueChange={(value) => setOrigenId(Number(value))}>
              <SelectTrigger data-testid="select-origen-mostrador">
                <SelectValue placeholder="Selecciona un sitio" />
              </SelectTrigger>
              <SelectContent>
                {locations?.filter((location) => location.activa).map((location) => (
                  <SelectItem key={location.id} value={String(location.id)}>
                    {location.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p data-testid="text-origen-mostrador" className="rounded-md border bg-slate-50 p-3 text-sm font-medium">
              {user?.ubicacion?.nombre ?? "Sin ubicación asignada"}
            </p>
          )}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Observaciones</label>
            <Textarea
              data-testid="input-observaciones-mostrador"
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              maxLength={2000}
              placeholder="Opcional"
            />
          </div>
          <Button
            data-testid="button-confirmar-mostrador"
            className="w-full"
            disabled={!origenId || !series.length || createMutation.isPending}
            onClick={confirm}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar salida de {series.length} rollo{series.length === 1 ? "" : "s"}
          </Button>
          <p className="text-xs text-muted-foreground">
            La confirmación retira completamente todos los rollos y genera una hoja foliada imprimible.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-primary/20">
          <CardContent className="p-2">
            <CampoEscaneo
              ref={inputRef}
              data-testid="input-serie-mostrador"
              value={input}
              onChange={setInput}
              onScan={addSeries}
              disabled={!origenId || createMutation.isPending}
              placeholder="Escanea la serie de cada rollo"
              autoFocus
              className="h-14 pl-12 text-lg font-semibold"
            />
            <Barcode className="pointer-events-none absolute ml-3 -mt-10 h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Rollos capturados ({series.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {series.length === 0 ? (
              <p data-testid="status-mostrador-vacio" className="p-10 text-center text-sm text-muted-foreground">
                Escanea al menos un rollo para continuar.
              </p>
            ) : (
              <div className="divide-y">
                {series.map((serie) => (
                  <div key={serie} data-testid={`row-rollo-mostrador-${serie}`} className="flex items-center justify-between px-5 py-3">
                    <span className="font-mono font-semibold">{serie}</span>
                    <Button
                      data-testid={`button-quitar-mostrador-${serie}`}
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ${serie}`}
                      onClick={() => setSeries((current) => current.filter((item) => item !== serie))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmacionTextoExacto
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        titulo="Confirmar salida a mostrador"
        descripcion="Se retirarán más de 5 rollos del inventario y se generará una hoja foliada imprimible."
        textoRequerido="MOSTRADOR"
        etiqueta="Confirmación de salida"
        textoConfirmar="Confirmar salida"
        pendiente={createMutation.isPending}
        onConfirm={() => void executeConfirm()}
      />
    </div>
  );
}