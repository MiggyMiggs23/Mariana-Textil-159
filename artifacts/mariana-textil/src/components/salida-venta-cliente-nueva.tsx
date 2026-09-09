import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { getListSalidasQueryKey, useCrearEnviarSalidaVentaCliente, useGetUbicacionesSalida, useGetCurrentUser, Role } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { ClientSelector } from "@/components/client-selector";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ApiErrorDetails } from "@/lib/api-error";
import { Package, Trash2 } from "lucide-react";
import {
  normalizarSerieEscaneada,
  type CodigoEscaneadoInterpretado,
} from "@workspace/scanned-code";

export function SalidaVentaClienteNueva() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { data: locations } = useGetUbicacionesSalida();
  const [origenId, setOrigenId] = useState<number | null>(user?.rol === Role.ADMIN ? null : user?.ubicacion?.id ?? null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [series, setSeries] = useState<string[]>([]);
  const [serie, setSerie] = useState("");
  const [nota, setNota] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const create = useCrearEnviarSalidaVentaCliente();
  const originOptions = locations?.filter((location) => (location.tipo === "TIENDA" || location.tipo === "BODEGA") && location.activa) ?? [];
  const addSerie = (
    rawValue = serie,
    codigoEntregado?: CodigoEscaneadoInterpretado,
  ) => {
    const value = normalizarSerieEscaneada(codigoEntregado ?? rawValue);
    if (!value) return;
    if (series.includes(value)) toast({ title: "Serie repetida", description: "Este rollo ya está seleccionado.", variant: "destructive" });
    else setSeries((current) => [...current, value]);
    setSerie("");
    scanRef.current?.focus();
  };
  const submit = () => {
    if (!origenId || !clienteId || clienteId === 1 || !series.length) {
      toast({ title: "Faltan datos", description: "Selecciona un cliente real (no Venta a Público), origen y al menos un rollo identificado.", variant: "destructive" });
      return;
    }
    create.mutate({ data: { uuidCliente: crypto.randomUUID(), origenId, clienteId, series, nota: nota.trim() || null } }, {
      onSuccess: async (salida) => {
        await queryClient.invalidateQueries({ queryKey: getListSalidasQueryKey() });
        setLocation(`/salidas/${salida.id}`);
      },
      onError: (error) => toast({ title: "No se pudo crear la salida", description: <ApiErrorDetails error={error} />, variant: "destructive" }),
    });
  };
  return <AppLayout><div className="mx-auto max-w-3xl space-y-5 pb-12">
    <div><Link href="/salidas" className="text-primary underline">Volver a salidas</Link><h1 className="mt-3 text-2xl font-bold">Nueva salida para venta a cliente</h1><p className="text-sm text-muted-foreground">La mercancía permanece en el origen y el cliente la recoge ahí. Solo se aceptan rollos identificados por serie.</p></div>
    <Card><CardHeader><CardTitle>Datos de la salida</CardTitle></CardHeader><CardContent className="space-y-4">
      <div><label className="text-sm font-medium">Origen</label><Select value={origenId ? String(origenId) : ""} onValueChange={(value) => setOrigenId(Number(value))} disabled={user?.rol !== Role.ADMIN}><SelectTrigger><SelectValue placeholder="Seleccionar origen" /></SelectTrigger><SelectContent>{originOptions.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.nombre}</SelectItem>)}</SelectContent></Select></div>
      <div><label className="text-sm font-medium">Cliente (no Venta a Público)</label><ClientSelector value={clienteId} onChange={(client) => setClienteId(client.id === 1 || client.esSistema ? null : client.id)} required /></div>
      <div><label className="text-sm font-medium">Serie exacta del rollo</label><CampoEscaneo ref={scanRef} value={serie} onChange={setSerie} onScan={(value, codigo) => addSerie(value, codigo)} placeholder="Escanea la serie identificada y presiona Enter" /><p className="mt-1 text-xs text-muted-foreground">No se puede reservar por cantidad ni agregar líneas sin serie.</p></div>
      <div className="space-y-2">{series.map((value) => <div key={value} className="flex items-center justify-between rounded border p-2 font-mono"><span>{value}</span><Button variant="ghost" size="icon" onClick={() => setSeries((current) => current.filter((item) => item !== value))} aria-label={`Quitar serie ${value}`}><Trash2 className="h-4 w-4" /></Button></div>)}</div>
      <Input value={nota} onChange={(event) => setNota(event.target.value)} placeholder="Nota opcional" />
      <Button className="w-full" onClick={submit} disabled={create.isPending || !origenId || !clienteId || !series.length}><Package className="mr-2 h-4 w-4" />Crear y enviar salida para venta</Button>
    </CardContent></Card>
  </div></AppLayout>;
}