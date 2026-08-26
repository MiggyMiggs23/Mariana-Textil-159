import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { CampoEscaneo } from "@/components/campo-escaneo";
import {
  useGetCurrentUser,
  useGetUbicacionesSalida,
  useCrearSalida,
  getGetCurrentUserQueryKey,
  getGetUbicacionesSalidaQueryKey,
  getEscanearRolloSalidaQueryOptions,
  SalidaRolloEscaneado,
  Role,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  Loader2,
  Package,
  Printer,
  Trash2,
  MapPin,
  Clock,
  Truck,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatNumber } from "@workspace/number-format";
import {
  advertenciaSkuEscaneado,
  interpretarCodigoEscaneado,
  type CodigoEscaneadoInterpretado,
} from "@workspace/scanned-code";

export default function SalidaNueva() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: locations } = useGetUbicacionesSalida({ query: { queryKey: getGetUbicacionesSalidaQueryKey() } });

  const createMutation = useCrearSalida();

  const [origenId, setOrigenId] = useState<number | "">("");
  const [destinoId, setDestinoId] = useState<number | "">("");
  const [transportista, setTransportista] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [serieInput, setSerieInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedRolls, setScannedRolls] = useState<SalidaRolloEscaneado[]>([]);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const [successFolio, setSuccessFolio] = useState<number | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  const isAdmin = user?.rol === Role.ADMIN;
  const validDestinations = locations?.filter(l => (l.tipo === 'TIENDA' || l.tipo === 'BODEGA') && l.activa && l.id !== origenId) || [];

  // Init origen based on role
  useEffect(() => {
    if (!isAdmin && user?.ubicacion?.id) {
      setOrigenId(user.ubicacion.id);
    }
  }, [user, isAdmin]);

  // Keep scanner focused
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && !successFolio) {
        scannerInputRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [successFolio]);

  const playSound = (type: 'success' | 'error') => {
    try {
      const AudioContextClass = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type === 'success' ? 'sine' : 'square';
      oscillator.frequency.value = type === 'success' ? 880 : 220;
      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.14);
      oscillator.addEventListener('ended', () => void context.close());
    } catch {
      // Browsers may suppress sound until the first explicit user interaction.
    }
  };

  const handleScan = async (
    scannedValue: string,
    codigoEntregado?: CodigoEscaneadoInterpretado,
  ) => {
    const codigo = codigoEntregado ?? interpretarCodigoEscaneado(scannedValue);
    const serie = (codigo.serie ?? scannedValue).trim().toUpperCase();
    if (!serie) return;

    if (!origenId) {
      toast({ title: "Atención", description: "Selecciona un origen primero", variant: "destructive" });
      playSound('error');
      return;
    }

    if (scannedRolls.some(r => r.serie === serie)) {
      toast({ title: "Atención", description: `El rollo ${serie} ya está en la lista`, variant: "destructive" });
      playSound('error');
      setSerieInput("");
      return;
    }

    setIsScanning(true);
    try {
      const options = getEscanearRolloSalidaQueryOptions(serie, { origenId: Number(origenId) });
      const roll = await queryClient.fetchQuery({
        ...options,
        staleTime: 0,
      });

      const warning = advertenciaSkuEscaneado(codigo, roll.sku);
      if (warning) {
        toast({
          title: "Verifica la etiqueta",
          description: warning,
        });
      }
      setScannedRolls(prev => [roll, ...prev]);
      setSerieInput("");
      playSound('success');
    } catch (error: any) {
      playSound('error');
      toast({
        title: "Error al escanear",
        description: getApiErrorMessage(error),
        variant: "destructive"
      });
      setSerieInput("");
    } finally {
      setIsScanning(false);
      setTimeout(() => scannerInputRef.current?.focus(), 50);
    }
  };

  const handleRemoveRoll = (serie: string) => {
    setScannedRolls(prev => prev.filter(r => r.serie !== serie));
    scannerInputRef.current?.focus();
  };

  const handleConfirm = () => {
    if (!origenId || !destinoId) {
      toast({ title: "Atención", description: "Origen y destino son requeridos", variant: "destructive" });
      return;
    }
    if (scannedRolls.length === 0) {
      toast({ title: "Atención", description: "No hay rollos escaneados", variant: "destructive" });
      return;
    }

    const uuidCliente = crypto.randomUUID();

    createMutation.mutate({
      data: {
        uuidCliente,
        origenId: Number(origenId),
        destinoId: Number(destinoId),
        transportista: transportista || null,
        observaciones: observaciones || null,
        rolloIds: scannedRolls.map(r => r.id)
      }
    }, {
      onSuccess: (data) => {
        setSuccessFolio(data.folio);
        setSuccessId(data.id);
        setScannedRolls([]);
      },
      onError: (error) => {
        toast({ title: "Error al registrar", description: getApiErrorMessage(error), variant: "destructive" });
      }
    });
  };

  const totals = scannedRolls.reduce((acc, curr) => {
    if (curr.unidad === 'METRO') acc.metros += Number(curr.cantidadActual);
    else if (curr.unidad === 'KILO') acc.kilos += Number(curr.cantidadActual);
    return acc;
  }, { metros: 0, kilos: 0 });

  const productSummary = Array.from(scannedRolls.reduce((acc, roll) => {
    const key = `${roll.sku}-${roll.tela}-${roll.color}-${roll.unidad}`;
    if (!acc.has(key)) {
      acc.set(key, {
        sku: roll.sku,
        tela: roll.tela,
        color: roll.color,
        unidad: roll.unidad,
        rollos: 0,
        cantidad: 0
      });
    }
    const current = acc.get(key)!;
    current.rollos += 1;
    current.cantidad += Number(roll.cantidadActual);
    return acc;
  }, new Map<string, { sku: string, tela: string, color: string, unidad: string, rollos: number, cantidad: number }>()).values());

  if (successFolio && successId) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto pt-16 flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Salida en armado</h1>
          <p className="text-xl text-slate-500 mb-8 font-medium">Folio: <span className="text-primary font-bold">{String(successFolio).padStart(6, '0')}</span></p>

          <div className="flex gap-4 w-full justify-center">
            <Button size="lg" variant="outline" onClick={() => setLocation("/salidas")} className="w-48 text-base">
              Ir al Historial
            </Button>
            <Link href={`/salidas/${successId}/documento/salida`}>
              <Button size="lg" className="w-48 text-base bg-primary hover:bg-primary/90">
                <Printer className="w-5 h-5 mr-2" />
                Imprimir Documento
              </Button>
            </Link>
          </div>

          <Button variant="ghost" onClick={() => {
            setSuccessFolio(null);
            setSuccessId(null);
            setDestinoId("");
            setTransportista("");
            setObservaciones("");
            if (!isAdmin && user?.ubicacion?.id) setOrigenId(user.ubicacion.id);
            else setOrigenId("");
          }} className="mt-8 text-slate-500 hover:text-slate-900">
            Capturar nueva salida
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <Link href="/salidas">
            <Button variant="ghost" size="icon" className="shrink-0 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Nueva Salida</h1>
            <p className="text-muted-foreground mt-1 text-sm">Escanea los rollos para armarla. El inventario no se moverá hasta enviarla.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Metadata Column */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Datos de Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha de registro</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-medium text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Origen</label>
                  <Select
                    value={String(origenId)}
                    onValueChange={v => setOrigenId(Number(v))}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccione origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.filter(l => l.tipo === 'TIENDA' || l.tipo === 'BODEGA').map(l => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destino</label>
                  <Select
                    value={String(destinoId)}
                    onValueChange={v => setDestinoId(Number(v))}
                    disabled={!origenId}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccione destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {validDestinations.map(l => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transportista (Opcional)</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={transportista}
                      onChange={e => setTransportista(e.target.value)}
                      placeholder="Nombre, placas..."
                      className="pl-9 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Observaciones (Opcional)</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Textarea
                      value={observaciones}
                      onChange={e => setObservaciones(e.target.value)}
                      placeholder="Notas del envío..."
                      className="pl-9 bg-white min-h-[80px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scanner & List Column */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-slate-200 shadow-sm border-2 border-primary/20">
              <CardContent className="p-1">
                <div className="relative flex items-center gap-2">
                  <div className="absolute left-4 z-10 flex items-center justify-center bg-primary/10 w-10 h-10 rounded-full">
                    <Barcode className="w-5 h-5 text-primary" />
                  </div>
                  <CampoEscaneo
                    ref={scannerInputRef}
                    value={serieInput}
                    onChange={setSerieInput}
                    onScan={handleScan}
                    placeholder="Escanea o ingresa la serie del rollo y presiona Enter..."
                    className="h-16 pl-16 text-xl font-bold bg-white border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:font-normal placeholder:text-base placeholder:text-slate-400"
                    containerClassName="min-w-0 flex-1"
                    autoFocus
                    disabled={isScanning || createMutation.isPending}
                  />
                  <div>
                    <Button type="button" onClick={() => void handleScan(serieInput)} disabled={!serieInput.trim() || isScanning} size="sm" className="h-10 px-4">
                      {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : "Agregar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      Rollos Capturados ({scannedRolls.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[400px] overflow-y-auto custom-scrollbar">
                      {scannedRolls.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                          <Barcode className="w-12 h-12 opacity-20" />
                          <p className="font-medium text-slate-500">Aún no hay rollos escaneados</p>
                          <p className="text-sm">Usa el escáner para agregar productos</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {scannedRolls.map((roll, index) => (
                            <div key={roll.serie} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors animate-in slide-in-from-top-2">
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                                  {scannedRolls.length - index}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-mono font-bold text-slate-900">{roll.serie}</p>
                                  <p className="text-xs text-slate-500 truncate mt-0.5">{roll.sku} • {roll.tela} {roll.color}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="font-semibold text-primary">{formatNumber(roll.cantidadActual, { kind: "quantity" })}</p>
                                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{roll.unidad}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveRoll(roll.serie)}
                                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="md:col-span-1">
                <Card className="border-slate-200 shadow-sm sticky top-24">
                  <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-base font-semibold">Resumen por Producto</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar border-b border-slate-100">
                      {productSummary.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-400">Sin productos</div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {productSummary.map((item, i) => (
                            <div key={i} className="p-3 bg-white">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-sm text-slate-800 line-clamp-1" title={item.tela}>{item.tela}</span>
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0">{formatNumber(item.rollos, { kind: "count" })} rollos</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">{item.color} • {item.sku}</span>
                                <span className="text-sm font-bold text-primary">{formatNumber(item.cantidad, { kind: "quantity" })} <span className="text-[10px] font-bold text-slate-400">{item.unidad}</span></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardContent className="pt-4 space-y-3 bg-slate-50/50">
                    <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Rollos</span>
                       <span className="text-2xl font-black text-slate-900">{formatNumber(scannedRolls.length, { kind: "count" })}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Metros</span>
                       <span className="text-lg font-bold text-slate-700">{formatNumber(totals.metros, { kind: "quantity" })}</span>
                    </div>
                    <div className="flex justify-between items-end pb-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kilos</span>
                       <span className="text-lg font-bold text-slate-700">{formatNumber(totals.kilos, { kind: "quantity" })}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-slate-50/50 border-t border-slate-100 pt-4">
                    <Button
                      className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm"
                      onClick={handleConfirm}
                      disabled={scannedRolls.length === 0 || !origenId || !destinoId || createMutation.isPending}
                    >
                      {createMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                      Guardar armado
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
