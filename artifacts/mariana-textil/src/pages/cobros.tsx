import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import {
  useObtenerSesionCajaActual,
  useAbrirSesionCaja,
  useObtenerCorteCaja,
  useCerrarSesionCaja,
  useListarTicketsCaja,
  useObtenerTicket,
  useCobrarTicket,
  useListarSesionesCaja,
  useGetCurrentUser,
  Role,
  CorteCaja,
  getObtenerSesionCajaActualQueryKey,
  getListarTicketsCajaQueryKey,
  getObtenerTicketQueryKey,
  getObtenerCorteCajaQueryKey,
  getListarSesionesCajaQueryKey,
  FormaPagoTicket,
  useListarTickets,
  getListarTicketsQueryKey,
  useGetClienteEstadoCuenta,
  getGetClienteEstadoCuentaQueryKey,
  useCreateClientePago,
  TicketDetalle,
  useCrearSalidaDineroCaja,
  useListarSalidasDineroCaja,
  useListarProveedoresActivosCaja,
  getListarSalidasDineroCajaQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useLocationScope } from "@/lib/location-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Banknote,
  CreditCard,
  Wallet,
  RefreshCw,
  AlertCircle,
  XCircle,
  ArrowRightLeft,
  CheckCircle,
  Search,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatAccountDestination, formatNumber, formatUnit } from "@workspace/number-format";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { ClientePagoDialog } from "@/components/cliente-pago-dialog";
import { SolicitudPagoDirigidoDialog } from "@/components/solicitud-pago-dirigido-dialog";
import { hasPermission, Modules } from "@/lib/permisos";
import { Textarea } from "@/components/ui/textarea";

/** Tienda Mariana (MA), the sole location currently authorized for cash disbursements. */
const MARIANA_LOCATION_ID = 1;

function mexicoCityDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function CarteraContent() {
  const [scannedInput, setScannedInput] = useHistoryEntryState("cobros.scanned-input", "");
  const [resolvedTicketId, setResolvedTicketId] = useState<number | null>(null);
  const [searchFolio, setSearchFolio] = useHistoryEntryState<number | null>("cobros.search-folio", null);

  const { data: currentUser } = useGetCurrentUser();
  const canViewFinances = hasPermission(currentUser, Modules.CLIENTES_FINANZAS, "ver");
  const canCreatePayment = hasPermission(currentUser, Modules.CLIENTES_FINANZAS, "crear");

  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialTicketId = searchParams.get("ticketId");
  const initialImporte = searchParams.get("importe");

  useEffect(() => {
    if (initialTicketId) {
      setResolvedTicketId(Number(initialTicketId));
    }
  }, [initialTicketId]);

  const { data: searchResults, isFetching: isSearchingFolio } = useListarTickets(
    { folio: searchFolio || 0 },
    {
      query: {
        enabled: !!searchFolio,
        queryKey: getListarTicketsQueryKey({ folio: searchFolio || 0 }),
      },
    }
  );

  useEffect(() => {
    if (searchFolio && searchResults) {
      if (searchResults.length > 0) {
        setResolvedTicketId(searchResults[0].id);
      }
      setSearchFolio(null);
    }
  }, [searchResults, searchFolio]);

  const { data: ticket, isLoading: isLoadingTicket } = useObtenerTicket(resolvedTicketId || 0, {
    query: {
      enabled: !!resolvedTicketId,
      queryKey: getObtenerTicketQueryKey(resolvedTicketId || 0),
    },
  });

  const clienteId = ticket?.clienteId;

  const { data: cuenta, isLoading: isLoadingCuenta } = useGetClienteEstadoCuenta(
    clienteId || 0,
    undefined,
    {
      query: {
        enabled: !!clienteId && canViewFinances,
        queryKey: getGetClienteEstadoCuentaQueryKey(clienteId || 0),
        retry: false,
      },
    }
  );

  const handleScan = (value: string) => {
    setScannedInput(value);
    let extractedId: number | null = null;
    try {
      const url = new URL(value, window.location.origin);
      if (url.pathname.startsWith("/tickets/")) {
        extractedId = parseInt(url.pathname.split("/")[2] || "", 10);
      } else if (url.pathname === "/cobros" && url.searchParams.get("ticketId")) {
        extractedId = parseInt(url.searchParams.get("ticketId") || "", 10);
      }
    } catch {}

    if (extractedId && !isNaN(extractedId)) {
      setResolvedTicketId(extractedId);
      setLocation(`/cobros?tab=cartera&ticketId=${extractedId}`, { replace: true });
    } else if (/^\d+$/.test(value)) {
      setSearchFolio(parseInt(value, 10));
    }
  };

  const notas = cuenta?.movimientos
    ?.filter((m) => m.tipo === "VENTA_CREDITO" && m.estado !== "PAGADA")
    .sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime()) || [];

  const [paymentOpen, setPaymentOpen] = useState(!!initialImporte);
  const [dirigidoDialog, setDirigidoDialog] = useState<{ open: boolean; nota?: (typeof notas)[number] }>({ open: false });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <Card className="shadow-md border-primary/20">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-xl flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Estado de Cuenta
          </CardTitle>
          <CardDescription>
            Escanea el QR de la nota de crédito o ingresa el folio para consultar y abonar a la cartera.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="max-w-md mx-auto mb-6">
            <Label className="mb-2 block font-semibold text-sidebar">Escáner / Folio de Nota</Label>
            <CampoEscaneo
              value={scannedInput}
              onChange={setScannedInput}
              onScan={handleScan}
              interpretRollCode={false}
              clearOnScan={false}
              placeholder="Ej. https://... o folio"
              containerClassName="h-12"
            />
          </div>

          {!canViewFinances && resolvedTicketId ? (
            <div className="text-center py-10 bg-destructive/5 rounded-lg border border-destructive/20">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3 opacity-80" />
              <h3 className="font-bold text-lg text-destructive">Acceso Restringido</h3>
              <p className="text-destructive/80 text-sm max-w-sm mx-auto mt-2">
                No tienes permisos suficientes para visualizar o modificar los saldos de clientes.
              </p>
            </div>
          ) : isSearchingFolio || isLoadingTicket || isLoadingCuenta ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-primary/60">Consultando información...</p>
            </div>
          ) : resolvedTicketId && !ticket ? (
            <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed text-destructive">
              <p className="font-medium">Ticket o Nota no encontrada.</p>
            </div>
          ) : ticket && !clienteId ? (
            <div className="text-center py-10 bg-amber-50 rounded-lg border border-amber-200 text-amber-700">
              <AlertCircle className="h-8 w-8 mx-auto mb-3 opacity-80" />
              <p className="font-semibold">El ticket #{ticket.folio} no está asociado a un cliente de crédito.</p>
            </div>
          ) : ticket && cuenta ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary p-6 rounded-xl text-primary-foreground shadow-lg">
                <div>
                  <div className="text-primary-foreground/70 text-xs font-bold uppercase tracking-wider mb-1">
                    Cliente de Crédito
                  </div>
                  <h3 className="font-black text-2xl">
                    {ticket.nombreCliente || `Cliente #${clienteId}`}
                  </h3>
                </div>
                <div className="text-left sm:text-right bg-black/10 px-5 py-3 rounded-lg border border-white/10">
                  <div className="text-xs font-bold text-primary-foreground/70 uppercase tracking-wider mb-1">
                    Saldo Global
                  </div>
                  <div className="text-3xl font-black tabular-nums">
                    {formatNumber(cuenta.saldoActual, { kind: "money" })}
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b bg-muted/30">
                  <h4 className="font-bold text-sidebar text-lg">Notas pendientes de pago ({notas.length})</h4>
                  {canCreatePayment && (
                    <Button size="sm" onClick={() => setPaymentOpen(true)} className="font-bold">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Registrar Abono
                    </Button>
                  )}
                </div>

                {notas.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-20 text-emerald-500" />
                    <p className="font-medium text-lg text-emerald-700">El cliente no tiene notas pendientes.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse text-left">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                          <th className="p-4 font-bold">Folio</th>
                          <th className="p-4 font-bold">Fecha Venta</th>
                          <th className="p-4 font-bold">Vencimiento</th>
                          <th className="p-4 font-bold text-right">Importe Orig.</th>
                          <th className="p-4 font-bold text-right">Saldo Pendiente</th>
                          {canCreatePayment && <th className="p-4 font-bold text-right no-print">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y border-b">
                        {notas.map((nota, index) => {
                          const isHighlighted = nota.ticketFolio === ticket.folio;

                          const parseDate = (dString: string) =>
                            new Date(dString.includes('T') ? dString : `${dString}T12:00:00`);

                          const isVencida = nota.fechaVencimiento ? parseDate(nota.fechaVencimiento) < new Date() : false;

                          return (
                            <tr
                              key={nota.ticketFolio ? `nota-folio-${nota.ticketFolio}` : `nota-idx-${index}`}
                              className={`transition-colors ${isHighlighted ? "bg-primary/10 border-primary/20 relative" : "hover:bg-muted/30"}`}
                            >
                              <td className="p-4 font-black text-sidebar relative">
                                {isHighlighted && (
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                                )}
                                #{nota.ticketFolio}
                                {isHighlighted && (
                                  <span className="ml-3 inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                                    ESCANEADA
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-muted-foreground font-medium">
                                {nota.fecha ? format(parseDate(nota.fecha), "dd/MM/yyyy") : "N/A"}
                              </td>
                              <td className="p-4">
                                {nota.fechaVencimiento ? (
                                  <span className={`font-bold ${isVencida ? "text-destructive" : "text-muted-foreground"}`}>
                                    {format(parseDate(nota.fechaVencimiento), "dd/MM/yyyy")}
                                    {isVencida && " (Vencida)"}
                                  </span>
                                ) : "N/A"}
                              </td>
                              <td className="p-4 text-right font-bold text-sidebar tabular-nums">
                                {formatNumber(nota.importe, { kind: "money" })}
                              </td>
                              <td className="p-4 text-right font-bold text-destructive tabular-nums">
                                {nota.saldoPendiente ? formatNumber(nota.saldoPendiente, { kind: "money" }) : "—"}
                              </td>
                              {canCreatePayment && (
                                <td className="p-4 text-right no-print">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[10px] uppercase font-bold"
                                    onClick={(e) => { e.stopPropagation(); setDirigidoDialog({ open: true, nota }); }}
                                  >
                                    Dirigido
                                  </Button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 rounded-xl bg-muted/20 border-2 border-dashed border-muted">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium text-lg">Escanea una nota de crédito para cargar el estado de cuenta.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientePagoDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        clienteId={clienteId || 0}
        saldoActual={cuenta?.saldoActual}
        defaultAmount={initialImporte || ""}
        onSuccess={() => {
          if (clienteId) {
            queryClient.invalidateQueries({ queryKey: getGetClienteEstadoCuentaQueryKey(clienteId) });
          }
        }}
      />

      {dirigidoDialog.nota && (
        <SolicitudPagoDirigidoDialog
          open={dirigidoDialog.open}
          onOpenChange={(val) => !val && setDirigidoDialog({ open: false })}
          tipo="CLIENTE"
          entidadId={clienteId || 0}
          documentoMovimientoId={dirigidoDialog.nota.movimientoId!}
          folio={dirigidoDialog.nota.ticketFolio || "—"}
          saldoPendiente={dirigidoDialog.nota.saldoPendiente ?? "0"}
          onSuccess={() => {
             if (clienteId) {
               queryClient.invalidateQueries({ queryKey: getGetClienteEstadoCuentaQueryKey(clienteId) });
             }
          }}
        />
      )}
    </div>
  );
}

function HistorialCortes() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const {
    data: sesiones,
    isLoading,
    isError,
    error,
    refetch,
  } = useListarSesionesCaja();
  const {
    data: corte,
    isLoading: loadingCorte,
    isError: corteFailed,
    error: corteError,
    refetch: retryCorte,
  } = useObtenerCorteCaja(sessionId || 0, {
    query: {
      enabled: !!sessionId,
      queryKey: getObtenerCorteCajaQueryKey(sessionId || 0),
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sidebar">Historial de cortes</h1>
          <p className="text-sm text-muted-foreground">Sesiones de todos los sitios, de la más reciente a la más antigua.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualizar
        </Button>
      </div>
      {isLoading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        : isError ? <Card className="border-destructive/30"><CardContent className="space-y-3 p-6 text-destructive"><p>{getApiErrorMessage(error, "No se pudo cargar el historial de cortes.")}</p><Button variant="outline" onClick={() => refetch()}>Intentar de nuevo</Button></CardContent></Card>
        : !sesiones?.length ? <Card><CardContent className="p-10 text-center text-muted-foreground">No hay sesiones de caja registradas.</CardContent></Card>
        : <div className="grid gap-3">{sesiones.map((sesion) => (
          <Card key={sesion.id} className="overflow-hidden">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="grid gap-1 text-sm">
                <p className="font-semibold">{sesion.nombreUbicacion} <span className="font-normal text-muted-foreground">· {sesion.nombreUsuario}</span></p>
                <p className="text-muted-foreground">Abrió: {format(new Date(sesion.abiertaAt), "PPP p", { locale: es })} · Cerró: {sesion.cerradaAt ? format(new Date(sesion.cerradaAt), "PPP p", { locale: es }) : "Pendiente"}</p>
                <p><span className="font-medium">Estado:</span> {sesion.estado} · {formatNumber(sesion.ticketsCobrados, { kind: "count" })} cobrados</p>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm md:text-right">
                <span className="text-muted-foreground">Total</span><span className="font-mono font-semibold">{formatNumber(sesion.totalCobrado, { kind: "money" })}</span>
                <span className="text-muted-foreground">Esperado</span><span className="font-mono font-semibold">{formatNumber(sesion.efectivoEsperado, { kind: "money" })}</span>
                <span className="text-muted-foreground">Diferencia</span><span className="font-mono font-semibold">{formatNumber(sesion.diferencia, { kind: "money" })}</span>
              </div>
              <Button variant="outline" onClick={() => setSessionId(sesion.id)}>Ver corte</Button>
            </CardContent>
          </Card>
        ))}</div>}
      <Dialog open={!!sessionId} onOpenChange={(open) => !open && setSessionId(null)}>
        <DialogContent className="corte-print max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>Detalle de corte</DialogTitle></DialogHeader>
          {loadingCorte ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>
            : corteFailed ? <div className="space-y-3 text-destructive"><p>{getApiErrorMessage(corteError, "No se pudo cargar el corte.")}</p><Button variant="outline" onClick={() => retryCorte()}>Intentar de nuevo</Button></div>
            : corte ? <CorteDetail corte={corte} /> : null}
          <DialogFooter><Button variant="outline" onClick={() => {
            document.body.classList.add("print-corte");
            window.print();
            window.setTimeout(() => document.body.classList.remove("print-corte"), 500);
          }} disabled={!corte}>Imprimir Corte</Button><Button onClick={() => setSessionId(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AbrirCajaForm({
  ubicacionId,
  onSuccess,
}: {
  ubicacionId: number;
  onSuccess: () => void;
}) {
  const [fondo, setFondo] = useState("");
  const { toast } = useToast();
  const abrirCaja = useAbrirSesionCaja();

  const handleAbrir = () => {
    const fondoNum = Number(fondo);
    if (!fondo.trim() || isNaN(fondoNum) || fondoNum < 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }

    abrirCaja.mutate(
      { data: { fondoInicial: fondoNum, ubicacionId } },
      {
        onSuccess: () => {
          toast({ title: "Caja abierta correctamente" });
          onSuccess();
        },
        onError: (err: unknown) => {
          toast({
            title: "Error",
            description: getApiErrorMessage(err, "No se pudo abrir la caja."),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-20 shadow-lg border-primary/20">
      <CardHeader className="bg-primary/5 text-primary text-center pb-6">
        <div className="mx-auto bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
          <Banknote className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">Apertura de Caja</CardTitle>
        <CardDescription className="text-base text-primary/70">
          Ingresa el fondo inicial para comenzar a cobrar
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Fondo Inicial (Efectivo)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={fondo}
                required
                onChange={(e) => setFondo(e.target.value)}
                className="pl-8 h-12 text-xl font-bold"
                autoFocus
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full h-12 text-lg"
          onClick={handleAbrir}
          disabled={abrirCaja.isPending}
        >
          {abrirCaja.isPending && (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          )}
          Abrir Turno
        </Button>
      </CardFooter>
    </Card>
  );
}

function CobroDialog({
  ticketId,
  open,
  onOpenChange,
  onCobrado,
}: {
  ticketId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCobrado: () => void;
}) {
  const { toast } = useToast();
  const cobrarTicket = useCobrarTicket();

  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useObtenerTicket(ticketId || 0, {
    query: {
      enabled: open && !!ticketId,
      queryKey: getObtenerTicketQueryKey(ticketId || 0),
    },
  });

  const [pagos, setPagos] = useState<
    { formaPago: FormaPagoTicket; importe: string; referencia?: string }[]
  >([]);
  const [showSplit, setShowSplit] = useState(false);

  const initializedForTicketId = useRef<number | null>(null);

  useEffect(() => {
    if (ticket && open && initializedForTicketId.current !== ticket.id) {
      initializedForTicketId.current = ticket.id;
      setPagos([]);
    }
  }, [ticket, open]);

  useEffect(() => {
    if (!open) {
      initializedForTicketId.current = null;
      setPagos([]);
      setShowSplit(false);
    }
  }, [open]);

  const totalPagado = pagos.reduce(
    (sum, p) => sum + (Number(p.importe) || 0),
    0,
  );
  const facturadoSeleccionado =
    ticket?.facturado === true ||
    pagos.some((pago) => pago.formaPago === FormaPagoTicket.FACTURADO);
  const totalTicket = ticket
    ? facturadoSeleccionado
      ? Number(ticket.subtotal) * (1 + Number(ticket.tasaIva || "0.16"))
      : Number(ticket.total || 0)
    : 0;
  const hasMetreadoLine =
    ticket?.lineas.some((linea) => linea.tipo === "METREADO") ?? false;
  const isPaymentSelected = pagos.length > 0;
  const faltante = isPaymentSelected ? totalTicket - totalPagado : totalTicket;
  const primaryPago = pagos[0];
  const handleCobrar = () => {
    if (!ticket || !isPaymentSelected) return;
    if (Math.abs(faltante) > 0.01) {
      toast({
        title: "El pago no coincide",
        description: "El total pagado debe ser igual al total del ticket",
        variant: "destructive",
      });
      return;
    }

    const pagosValidos = pagos
      .filter((p) => Number(p.importe) > 0)
      .map((p) => ({
        formaPago: p.formaPago,
        importe: Number(p.importe),
        referencia: p.referencia || undefined,
      }));

    cobrarTicket.mutate(
      {
        id: ticket.id,
        data: {
          pagos: pagosValidos,
          facturado: facturadoSeleccionado,
        } as Parameters<typeof cobrarTicket.mutate>[0]["data"],
      },
      {
        onSuccess: (data) => {
          if (data && data.convertidoANotaPorCobro) {
            toast({
              title: "Documento actualizado a NOTA",
              description: "El documento se actualizó a NOTA automáticamente debido a la política de crédito.",
              variant: "default",
            });
          } else {
            toast({ title: "Ticket cobrado exitosamente" });
          }
          onCobrado();
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          toast({
            title: "Error al cobrar",
            description: getApiErrorMessage(
              err,
              "No se pudo registrar el cobro.",
            ),
            variant: "destructive",
          });
        },
      },
    );
  };

  const setPrimaryFormaPago = (formaPago: FormaPagoTicket) => {
    const newPagos = [...pagos];
    if (newPagos.length > 0) {
      newPagos[0].formaPago = formaPago;
    } else {
      newPagos.push({
        formaPago,
        importe: ticket
          ? (formaPago === FormaPagoTicket.FACTURADO
            ? Number(ticket.subtotal) * (1 + Number(ticket.tasaIva || "0.16"))
            : Number(ticket.total)).toFixed(2)
          : "0",
      });
    }
    setPagos(newPagos);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 overflow-hidden"
        aria-describedby="dialog-description"
      >
        <DialogHeader className="p-6 pb-4 bg-sidebar text-white">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Registrar Cobro
          </DialogTitle>
          <DialogDescription id="dialog-description" className="sr-only">
            Seleccione la forma de pago para este ticket
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p>Cargando detalles del ticket...</p>
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-destructive">
              <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium text-lg mb-2">
                No se pudo cargar el ticket
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Intentar de nuevo
              </Button>
            </div>
          ) : ticket ? (
            <div className="pt-4 space-y-6">
              <div className="bg-primary/5 p-5 rounded-xl flex items-center justify-between border border-primary/20">
                <div>
                  <div className="text-sm text-primary/70 font-bold mb-1 uppercase tracking-wider">
                    TOTAL A COBRAR
                  </div>
                  <div className="text-4xl font-black text-primary">
                    {formatNumber(totalTicket, { kind: "money" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xl text-sidebar">
                    Folio {formatNumber(ticket.folio, { kind: "identifier" })}
                  </div>
                  <div className="text-sm font-medium px-2 py-0.5 bg-sidebar/10 text-sidebar rounded inline-block mt-1">
                    {hasMetreadoLine ? "METREADO" : "NORMAL"}
                  </div>
                </div>
              </div>
              {facturadoSeleccionado && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>
                      {formatNumber(ticket.subtotal, { kind: "money" })}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>
                      IVA ({formatNumber(ticket.tasaIva, { kind: "percentage", percentageInput: "ratio" })})
                    </span>
                    <span>
                      {formatNumber(totalTicket - Number(ticket.subtotal), { kind: "money" })}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-primary/15 pt-2 font-bold text-primary">
                    <span>Total a cobrar</span>
                    <span>
                      {formatNumber(totalTicket, { kind: "money" })}
                    </span>
                  </div>
                </div>
              )}

              {!showSplit ? (
                <div className="space-y-5">
                  <Label className="text-base font-semibold text-sidebar">
                    Forma de Pago Principal
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Button
                      type="button"
                      variant={
                        primaryPago?.formaPago === FormaPagoTicket.EFECTIVO
                          ? "default"
                          : "outline"
                      }
                      className={`h-28 flex flex-col items-center justify-center gap-3 transition-all ${primaryPago?.formaPago === FormaPagoTicket.EFECTIVO ? "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground shadow-md" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground border-2"}`}
                      onClick={() =>
                        setPrimaryFormaPago(FormaPagoTicket.EFECTIVO)
                      }
                    >
                      <Banknote className="h-8 w-8" />
                      <span className="font-bold text-base">Efectivo</span>
                    </Button>
                    <Button
                      type="button"
                      variant={
                        primaryPago?.formaPago === FormaPagoTicket.TRANSFERENCIA
                          ? "default"
                          : "outline"
                      }
                      className={`h-28 flex flex-col items-center justify-center gap-3 transition-all ${primaryPago?.formaPago === FormaPagoTicket.TRANSFERENCIA ? "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground shadow-md" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground border-2"}`}
                      disabled={hasMetreadoLine}
                      onClick={() =>
                        setPrimaryFormaPago(FormaPagoTicket.TRANSFERENCIA)
                      }
                    >
                      <ArrowRightLeft className="h-8 w-8" />
                      <span className="font-bold text-base">Transf.</span>
                    </Button>
                    <Button
                      type="button"
                      variant={
                        primaryPago?.formaPago === FormaPagoTicket.FACTURADO
                          ? "default"
                          : "outline"
                      }
                      className={`h-28 flex flex-col items-center justify-center gap-3 transition-all ${primaryPago?.formaPago === FormaPagoTicket.FACTURADO ? "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground shadow-md" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground border-2"}`}
                      disabled={hasMetreadoLine}
                      onClick={() =>
                        setPrimaryFormaPago(FormaPagoTicket.FACTURADO)
                      }
                    >
                      <CreditCard className="h-8 w-8" />
                      <span className="font-bold text-base">Facturado</span>
                    </Button>
                  </div>

                  {primaryPago?.formaPago === FormaPagoTicket.TRANSFERENCIA && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                      <Label className="text-sm font-semibold">
                        Referencia (Opcional)
                      </Label>
                      <Input
                        placeholder="Número de rastreo o autorización"
                        value={primaryPago.referencia || ""}
                        onChange={(e) => {
                          const newPagos = [...pagos];
                          if (newPagos.length > 0) {
                            newPagos[0].referencia = e.target.value;
                            setPagos(newPagos);
                          }
                        }}
                        className="h-12 border-2 focus-visible:ring-0 focus-visible:border-primary"
                      />
                    </div>
                  )}

                  <div className="pt-4 text-center border-t border-dashed">
                    <Button
                      variant="ghost"
                      className="text-muted-foreground hover:text-primary hover:bg-primary/5 font-medium"
                      onClick={() => {
                        setShowSplit(true);
                        if (pagos.length === 0) {
                          setPagos([
                            {
                              formaPago: FormaPagoTicket.EFECTIVO,
                              importe: ticket.total,
                            },
                          ]);
                        }
                      }}
                    >
                      Dividir pago en múltiples formas
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between mb-2 border-b pb-2">
                    <Label className="text-base font-semibold text-sidebar">
                      Desglose de Pago
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs font-medium text-primary hover:bg-primary/10"
                      onClick={() => {
                        setShowSplit(false);
                        setPagos([
                          {
                            formaPago: FormaPagoTicket.EFECTIVO,
                            importe: ticket.total,
                          },
                        ]);
                      }}
                    >
                      Volver a pago único
                    </Button>
                  </div>

                  {pagos.map((pago, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-end gap-3 bg-secondary/20 p-4 rounded-xl border-2 border-transparent focus-within:border-primary/20 transition-colors relative group"
                    >
                      <div className="flex-1 min-w-[140px] space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground">
                          FORMA DE PAGO
                        </Label>
                        <Select
                          value={pago.formaPago}
                          onValueChange={(v) => {
                            const newPagos = [...pagos];
                            newPagos[i].formaPago = v as FormaPagoTicket;
                            setPagos(newPagos);
                          }}
                        >
                          <SelectTrigger className="h-12 bg-white border-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value={FormaPagoTicket.EFECTIVO}
                              className="font-medium py-3 cursor-pointer"
                            >
                              Efectivo
                            </SelectItem>
                            {!hasMetreadoLine && (
                              <>
                                <SelectItem
                                  value={FormaPagoTicket.TRANSFERENCIA}
                                  className="font-medium py-3 cursor-pointer"
                                >
                                  Transferencia
                                </SelectItem>
                                <SelectItem
                                  value={FormaPagoTicket.FACTURADO}
                                  className="font-medium py-3 cursor-pointer"
                                >
                                  Facturado
                                </SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1 min-w-[120px] space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground">
                          IMPORTE
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                            $
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pago.importe}
                            onChange={(e) => {
                              const newPagos = [...pagos];
                              newPagos[i].importe = e.target.value;
                              setPagos(newPagos);
                            }}
                            className="pl-8 h-12 font-bold text-lg bg-white border-2 focus-visible:ring-0 focus-visible:border-primary"
                          />
                        </div>
                      </div>

                      {pago.formaPago === FormaPagoTicket.TRANSFERENCIA && (
                        <div className="w-full space-y-2 mt-1 animate-in fade-in">
                          <Label className="text-xs font-bold text-muted-foreground">
                            REFERENCIA
                          </Label>
                          <Input
                            placeholder="Opcional"
                            value={pago.referencia || ""}
                            onChange={(e) => {
                              const newPagos = [...pagos];
                              newPagos[i].referencia = e.target.value;
                              setPagos(newPagos);
                            }}
                            className="h-10 bg-white border-2"
                          />
                        </div>
                      )}

                      {pagos.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          onClick={() => {
                            const newPagos = [...pagos];
                            newPagos.splice(i, 1);
                            setPagos(newPagos);
                          }}
                        >
                          <XCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    className="w-full border-2 border-dashed h-12 font-bold text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors"
                    onClick={() =>
                      setPagos([
                        ...pagos,
                        { formaPago: FormaPagoTicket.EFECTIVO, importe: "0" },
                      ])
                    }
                  >
                    + Añadir forma de pago combinada
                  </Button>
                </div>
              )}

            </div>
          ) : null}
        </div>

        {ticket && !isLoading && !isError && (
          <div className="p-6 bg-muted/30 border-t flex flex-col gap-4">
            {faltante !== 0 && (
              <div
                className={`p-4 rounded-xl flex justify-between items-center text-sm font-bold border-2 ${faltante > 0 ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm" : "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"}`}
              >
                <span className="uppercase tracking-wider text-xs">
                  {faltante > 0 ? "Falta por cubrir:" : "Cambio (Sobran):"}
                </span>
                <span className="text-xl">
                  {formatNumber(Math.abs(faltante), { kind: "money" })}
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-14 px-6 border-2 font-bold"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-14 text-lg font-black shadow-md hover:shadow-lg transition-all"
                disabled={
                  Math.abs(faltante) > 0.01 ||
                  cobrarTicket.isPending
                }
                onClick={handleCobrar}
              >
                {cobrarTicket.isPending ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  <Wallet className="mr-2 h-6 w-6" />
                )}
                Confirmar Pago
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SalidasDineroPanel({ sesionId }: { sesionId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedorId, setProveedorId] = useState<string>("");
  const [cuentaOrigen, setCuentaOrigen] = useState<"CAJA_FISICA" | "CUENTA_NO_FISCAL" | "CUENTA_FISCAL">("CAJA_FISICA");
  const { data, isLoading, isError, error } = useListarSalidasDineroCaja(sesionId, { query: { queryKey: getListarSalidasDineroCajaQueryKey(sesionId) } });
  const { data: proveedores = [] } = useListarProveedoresActivosCaja();
  const crear = useCrearSalidaDineroCaja();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0 || !motivo.trim()) {
      toast({ title: "Captura un monto mayor a cero y un motivo.", variant: "destructive" }); return;
    }
    crear.mutate({ id: sesionId, data: { monto: valor.toFixed(2), motivo: motivo.trim(), cuentaOrigen, proveedorId: proveedorId ? Number(proveedorId) : null } }, {
      onSuccess: () => {
        setMonto(""); setMotivo(""); setProveedorId("");
        queryClient.invalidateQueries({ queryKey: getListarSalidasDineroCajaQueryKey(sesionId) });
        queryClient.invalidateQueries({ queryKey: getObtenerCorteCajaQueryKey(sesionId) });
        toast({ title: "Salida de dinero registrada." });
      },
      onError: (err: unknown) => toast({ title: "No se pudo registrar la salida", description: getApiErrorMessage(err, "Intenta nuevamente."), variant: "destructive" }),
    });
  };
  return <Card className="border-amber-200">
    <CardHeader><CardTitle className="text-lg">Salidas de dinero</CardTitle><CardDescription>Solo pagos operativos de Tienda Mariana.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2" aria-label="Registrar salida de dinero">
        <div><Label htmlFor="salida-monto">Monto</Label><Input id="salida-monto" type="number" min="0.01" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
        <div><Label htmlFor="salida-cuenta">Cuenta de origen</Label><Select value={cuentaOrigen} onValueChange={(v) => setCuentaOrigen(v as typeof cuentaOrigen)}><SelectTrigger id="salida-cuenta"><SelectValue /></SelectTrigger><SelectContent>{(["CAJA_FISICA", "CUENTA_NO_FISCAL", "CUENTA_FISCAL"] as const).map((cuenta) => <SelectItem key={cuenta} value={cuenta}>{formatAccountDestination(cuenta)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="salida-motivo">Motivo</Label><Input id="salida-motivo" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        <div><Label htmlFor="salida-proveedor">Proveedor (opcional)</Label><Select value={proveedorId} onValueChange={setProveedorId}><SelectTrigger id="salida-proveedor"><SelectValue placeholder="Sin proveedor" /></SelectTrigger><SelectContent>{proveedores.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent></Select></div>
        <Button type="submit" disabled={crear.isPending} className="md:col-span-2">{crear.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar salida</Button>
      </form>
      {isLoading ? <p className="text-sm text-muted-foreground">Cargando salidas…</p> : isError ? <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(error, "No se pudieron cargar las salidas.")}</p> : <div className="space-y-2">{data?.salidas.length ? data.salidas.map((salida) => {
        const nombreProveedor = proveedores.find((proveedor) => proveedor.id === salida.proveedorId)?.nombre;
        return <div key={salida.id} className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"><span>{salida.motivo}{nombreProveedor ? ` · ${nombreProveedor}` : ""}</span><span className="font-medium">{formatAccountDestination(salida.cuentaOrigen)} · {formatNumber(salida.monto, { kind: "money" })}</span></div>;
      }) : <p className="text-sm text-muted-foreground">Sin salidas registradas.</p>}</div>}
    </CardContent>
  </Card>;
}

function CobrosContent() {
  const { selectedLocationId } = useLocationScope();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [cobroOpen, setCobroOpen] = useState(false);

  // Dialogs
  const [cierreOpen, setCierreOpen] = useState(false);
  const [efectivoContado, setEfectivoContado] = useState("");
  const [closedCorte, setClosedCorte] = useState<CorteCaja | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCobroOpen(false);
    setSelectedTicketId(null);
  }, [selectedLocationId]);

  const {
    data: sesionData,
    isLoading: loadingSesion,
    isError: sesionFailed,
    error: sesionError,
    refetch: retrySesion,
  } = useObtenerSesionCajaActual(
    {
      ubicacionId: selectedLocationId || 0,
    },
    {
      query: {
        enabled: !!selectedLocationId,
        queryKey: getObtenerSesionCajaActualQueryKey({
          ubicacionId: selectedLocationId || 0,
        }),
      },
    },
  );

  const {
    data: ticketsData,
    isFetching: fetchingTickets,
    isError: ticketsFailed,
    error: ticketsError,
    refetch: retryTickets,
  } = useListarTicketsCaja(
    {
      ubicacionId: selectedLocationId || 0,
    },
    {
      query: {
        enabled: !!selectedLocationId && !!sesionData?.sesion,
        queryKey: getListarTicketsCajaQueryKey({
          ubicacionId: selectedLocationId || 0,
        }),
        refetchInterval: 10000, // auto-refresh every 10s for new tickets
      },
    },
  );

  const tickets = ticketsData || [];

  const {
    data: fetchedCorteData,
    isError: corteFailed,
    error: corteError,
    refetch: retryCorte,
  } = useObtenerCorteCaja(sesionData?.sesion?.id || 0, {
    query: {
      enabled: cierreOpen && !!selectedLocationId && !!sesionData?.sesion,
      queryKey: getObtenerCorteCajaQueryKey(sesionData?.sesion?.id || 0),
    },
  });
  const corteData = closedCorte || fetchedCorteData;

  const cerrarCaja = useCerrarSesionCaja();

  const handlePrintCorte = () => {
    document.body.classList.add("print-corte");
    window.print();
    window.setTimeout(() => document.body.classList.remove("print-corte"), 500);
  };
  const handlePrintHojaVentas = () => {
    document.body.classList.add("print-hoja-ventas");
    window.print();
    window.setTimeout(() => document.body.classList.remove("print-hoja-ventas"), 500);
  };

  const handleCerrarCaja = () => {
    if (!sesionData?.sesion) {
      toast({
        title: "No hay una sesión de caja abierta",
        variant: "destructive",
      });
      return;
    }
    const contado = Number(efectivoContado);
    if (isNaN(contado) || contado < 0) {
      toast({ title: "Efectivo contado inválido", variant: "destructive" });
      return;
    }

    cerrarCaja.mutate(
      { id: sesionData.sesion.id, data: { efectivoContado: contado } },
      {
        onSuccess: (corte) => {
          toast({ title: "Caja cerrada correctamente" });
          setClosedCorte(corte);
        },
        onError: (err: unknown) => {
          toast({
            title: "Error al cerrar",
            description: getApiErrorMessage(err, "No se pudo cerrar la caja."),
            variant: "destructive",
          });
        },
      },
    );
  };

  if (!selectedLocationId) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
          <h2 className="text-xl font-semibold text-foreground">
            Selecciona un sitio
          </h2>
          <p>Debes seleccionar tu sitio para operar la caja.</p>
        </div>
      </div>
    );
  }

  if (loadingSesion) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sesionFailed) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <Card className="w-full max-w-md border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              No se pudo consultar la caja
            </CardTitle>
            <CardDescription role="alert">
              {getApiErrorMessage(
                sesionError,
                "No se pudo conocer el estado de la sesión de caja.",
              )}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => retrySesion()}
            >
              Intentar de nuevo
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!sesionData || !sesionData.sesion) {
    return (
      <AbrirCajaForm
        ubicacionId={selectedLocationId}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: getObtenerSesionCajaActualQueryKey({
              ubicacionId: selectedLocationId,
            }),
          })
        }
      />
    );
  }
  const sesionId = sesionData.sesion.id;
  const sesionEsAnterior = mexicoCityDate(new Date(sesionData.sesion.abiertaAt)) < mexicoCityDate(new Date());

  return (
    <div className="flex flex-col h-full max-w-[1600px] mx-auto gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sidebar">
            Caja Operativa
          </h1>
          <p className="text-muted-foreground text-sm">
            Cobro de tickets pendientes y cortes de caja.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold border border-emerald-200">
            Sesión Abierta
          </div>
          <Button
            variant="outline"
            onClick={() => setCierreOpen(true)}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            Realizar Corte
          </Button>
        </div>
      </div>
      {sesionEsAnterior && (
        <Card className="border-amber-400 bg-amber-50" role="alert">
          <CardContent className="flex gap-3 p-4 text-amber-950">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p><strong>Sesión de fecha anterior:</strong> esta sesión abrió el {format(new Date(sesionData.sesion.abiertaAt), "PPP", { locale: es })}. Debe cerrarse antes de poder abrir la caja de hoy.</p>
          </CardContent>
        </Card>
      )}
      {sesionData.sesion.ubicacionId === MARIANA_LOCATION_ID && <SalidasDineroPanel sesionId={sesionId} />}

      <div className="flex flex-col flex-1 min-h-0">
        <Card className="flex-1 flex flex-col shadow-sm border-sidebar-border/10">
          <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Tickets de Caja</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Actualizar tickets"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: getListarTicketsCajaQueryKey({
                    ubicacionId: selectedLocationId || 0,
                  }),
                })
              }
            >
              <RefreshCw
                className={`h-4 w-4 ${fetchingTickets ? "animate-spin" : ""}`}
              />
            </Button>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-secondary/10">
            {ticketsFailed ? (
              <div
                className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-destructive"
                role="alert"
              >
                <AlertCircle className="h-10 w-10" />
                <p>
                  {getApiErrorMessage(
                    ticketsError,
                    "No se pudieron cargar los tickets.",
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryTickets()}
                >
                  Intentar de nuevo
                </Button>
              </div>
            ) : tickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <CheckCircle className="h-12 w-12 mb-3 text-emerald-500" />
                <p>No hay tickets pendientes</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl mx-auto">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className={`p-5 rounded-xl border-2 transition-all ${
                      t.cobrado
                        ? "bg-muted/40 border-transparent opacity-75 grayscale-[0.2]"
                        : "bg-card border-border shadow-sm hover:border-primary/40 hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-xl text-sidebar">
                            Folio: {formatNumber(t.folio, { kind: "identifier" })}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2">
                          <span>
                            {format(new Date(t.createdAt), "h:mm a", {
                              locale: es,
                            })}
                          </span>
                          {t.cobrado && t.cobradoAt && (
                            <>
                              <span className="text-border text-xs">•</span>
                              <span className="text-emerald-700">
                                Cobrado a las{" "}
                                {format(new Date(t.cobradoAt), "h:mm a", {
                                  locale: es,
                                })}
                              </span>
                            </>
                          )}
                        </div>
                        {t.cobrado &&
                          t.formasPago &&
                          t.formasPago.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-2 font-bold flex items-center gap-1.5 capitalize tracking-wider">
                              <Wallet className="h-3 w-3" />
                              {t.formasPago
                                .map((fp) =>
                                  fp === "EFECTIVO"
                                    ? "Efectivo"
                                    : fp === "TRANSFERENCIA"
                                      ? "Transferencia"
                                      : fp === "CREDITO"
                                        ? "Crédito"
                                        : fp,
                                )
                                .join(", ")}
                            </div>
                          )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6">
                        <div className="text-right">
                          <div
                            className={`font-black text-2xl ${t.cobrado ? "text-sidebar/70" : "text-primary"}`}
                          >
                            {formatNumber(t.total, { kind: "money" })}
                          </div>
                        </div>

                        {!t.cobrado && (
                          <Button
                            size="lg"
                            className="font-black px-8 h-14 text-lg shadow-md hover:shadow-lg transition-shadow"
                            onClick={() => {
                              setSelectedTicketId(t.id);
                              setCobroOpen(true);
                            }}
                          >
                            Cobrar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <CobroDialog
        ticketId={selectedTicketId}
        open={cobroOpen}
        onOpenChange={(open) => {
          setCobroOpen(open);
          if (!open) {
            setSelectedTicketId(null);
          }
        }}
        onCobrado={() => {
          setCobroOpen(false);
          const printedTicketId = selectedTicketId;
          setSelectedTicketId(null);
          queryClient.invalidateQueries({
            queryKey: getListarTicketsCajaQueryKey({
              ubicacionId: selectedLocationId || 0,
            }),
          });
          queryClient.invalidateQueries({
            queryKey: getObtenerCorteCajaQueryKey(sesionId),
          });
          if (printedTicketId) {
            setLocation(`/tickets/${printedTicketId}?print=3`);
          }
        }}
      />

      <Dialog
        open={cierreOpen}
        onOpenChange={(open) => {
          if (open || !closedCorte) setCierreOpen(open);
        }}
      >
        <DialogContent className="corte-print max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Corte y Cierre de Caja</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {corteFailed && !closedCorte ? (
              <div
                className="space-y-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-center text-destructive"
                role="alert"
              >
                <p>
                  {getApiErrorMessage(
                    corteError,
                    "No se pudo cargar el corte de caja.",
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryCorte()}
                >
                  Intentar de nuevo
                </Button>
              </div>
            ) : !corteData ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="p-3 bg-muted rounded-md text-center">
                    <div className="text-xs text-muted-foreground">
                      Fondo Inicial
                    </div>
                    <div className="font-bold">
                      {formatNumber(corteData.fondoInicial, { kind: "money" })}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-md text-center">
                    <div className="text-xs text-muted-foreground">
                      Total Cobrado
                    </div>
                    <div className="font-bold">
                      {formatNumber(corteData.totalCobrado, { kind: "money" })}
                    </div>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-md text-center">
                    <div className="text-xs text-muted-foreground">
                      IVA Cobrado
                    </div>
                    <div className="font-bold text-primary">
                      {formatNumber(corteData.ivaCobrado, { kind: "money" })}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-primary">
                      Efectivo Esperado:
                    </span>
                    <span className="text-xl font-bold text-primary">
                      {formatNumber(corteData.efectivoEsperado, { kind: "money" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Incluye fondo inicial + cobros en efectivo.
                  </p>
                </div>
                {closedCorte && (
                  <div className="grid gap-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-emerald-700">Efectivo físico contado</p>
                      <p className="text-xl font-bold text-emerald-900">{formatNumber(closedCorte.efectivoContado, { kind: "money" })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-700">Diferencia de cierre</p>
                      <p className="text-xl font-bold text-emerald-900">{formatNumber(closedCorte.diferencia, { kind: "money" })}</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <CorteSection title="Formas de pago">
                    {corteData.formasPago.map((row) => (
                      <CorteRow
                        key={row.formaPago}
                        label={`${row.formaPago} (${formatNumber(row.ticketsCount, { kind: "count" })} tickets)`}
                        value={row.importe}
                      />
                    ))}
                  </CorteSection>
                  <CorteSection title="Cuentas destino">
                    {corteData.cuentasDestino.map((row) => (
                      <CorteRow
                        key={`${row.formaPago}-${row.cuentaDestino}`}
                        label={formatAccountDestination(row.cuentaDestino)}
                        value={row.importe}
                      />
                    ))}
                  </CorteSection>
                  <CorteSection title="Facturación">
                    {corteData.facturacion.map((row) => (
                      <CorteFiscalRow key={String(row.facturado)} row={row} />
                    ))}
                  </CorteSection>
                  <CorteSection title="Rollos / Metraje">
                    {corteData.metreado.map((row) => (
                      <CorteRow
                        key={`${row.tipo}-${row.unidad}`}
                        label={`${row.tipo === "METREADO" ? "METRAJE" : "ROLLOS"} · ${formatNumber(row.cantidad, { kind: "quantity" })} ${formatUnit(row.unidad)}`}
                        value={row.importe}
                      />
                    ))}
                  </CorteSection>
                </div>

                <CorteSection title="Productos vendidos">
                  {corteData.productos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin productos cobrados.
                    </p>
                  ) : (
                    corteData.productos.map((row) => (
                      <CorteRow
                        key={`${row.productoId}-${row.tipo}`}
                        label={`${row.tipo === "METREADO" ? "METRAJE" : "ROLLO"} · ${row.sku} · ${row.tela} ${row.color} · ${formatNumber(row.cantidad, { kind: "quantity" })} ${formatUnit(row.unidad)}`}
                        value={row.importe}
                      />
                    ))
                  )}
                </CorteSection>

                <CorteSection
                  title={`Tickets pendientes (${corteData.pendientes.length})`}
                >
                  {corteData.pendientes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin tickets pendientes.
                    </p>
                  ) : (
                    corteData.pendientes.map((row) => (
                      <CorteRow
                        key={row.ticketId}
                        label={`Folio ${formatNumber(row.folio, { kind: "identifier" })} · ${row.nombreCliente || "Venta a Público"}`}
                        value={row.total}
                      />
                    ))
                  )}
                </CorteSection>

                {!closedCorte && <div className="space-y-2">
                  <Label>Efectivo Físico Contado</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={efectivoContado}
                      onChange={(e) => setEfectivoContado(e.target.value)}
                      className="pl-8 h-12 text-lg font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>}
                {corteData && (
                  <HojaVentasDiaPrint hoja={corteData.hojaVentasDia} />
                )}
              </>
            )}
          </div>

          <DialogFooter>
            {!closedCorte && <Button variant="outline" onClick={() => setCierreOpen(false)}>
              Cancelar
            </Button>}
            <Button
              variant="outline"
              onClick={handlePrintCorte}
              disabled={!corteData}
            >
              Imprimir Corte
            </Button>
            {closedCorte && corteData && (
              <Button
                variant="outline"
                onClick={handlePrintHojaVentas}
              >
                Imprimir hoja de ventas
              </Button>
            )}
            {!closedCorte ? <Button
              onClick={handleCerrarCaja}
              disabled={cerrarCaja.isPending || !efectivoContado}
            >
              {cerrarCaja.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar Cierre
            </Button> : <Button onClick={() => {
              setCierreOpen(false);
              setClosedCorte(null);
              queryClient.invalidateQueries({ queryKey: getObtenerSesionCajaActualQueryKey({ ubicacionId: selectedLocationId || 0 }) });
              queryClient.invalidateQueries({ queryKey: getListarSesionesCajaQueryKey() });
            }}>Finalizar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CobrosPage() {
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.rol === Role.ADMIN;

  const [location] = useLocation();
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : "");
  const defaultTab: "operativa" | "historial" | "cartera" = searchParams.get("tab") === "cartera" ? "cartera" : "operativa";

  const [view, setView] = useState<"operativa" | "historial" | "cartera">(defaultTab);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "cartera") {
      setView("cartera");
    }
  }, [location]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex w-fit rounded-lg border bg-muted/30 p-1">
          <Button variant={view === "operativa" ? "default" : "ghost"} size="sm" onClick={() => setView("operativa")}>Caja operativa</Button>
          <Button variant={view === "cartera" ? "default" : "ghost"} size="sm" onClick={() => setView("cartera")}>Cartera / Estado de cuenta</Button>
          {isAdmin && (
            <Button variant={view === "historial" ? "default" : "ghost"} size="sm" onClick={() => setView("historial")}>Historial de cortes</Button>
          )}
        </div>
        {view === "cartera" ? <CarteraContent /> : (isAdmin && view === "historial" ? <HistorialCortes /> : <CobrosContent />)}
      </div>
    </AppLayout>
  );
}

function CorteDetail({ corte }: { corte: CorteCaja }) {
  return (
    <div className="space-y-5 py-4">
      <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm sm:grid-cols-2">
        <p><span className="text-muted-foreground">Sitio:</span> {corte.sesion.nombreUbicacion}</p>
        <p><span className="text-muted-foreground">Operador:</span> {corte.sesion.nombreUsuario}</p>
        <p><span className="text-muted-foreground">Apertura:</span> {format(new Date(corte.sesion.abiertaAt), "PPP p", { locale: es })}</p>
        <p><span className="text-muted-foreground">Cierre:</span> {corte.sesion.cerradaAt ? format(new Date(corte.sesion.cerradaAt), "PPP p", { locale: es }) : "Sesión abierta"}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CorteRow label="Fondo inicial" value={corte.fondoInicial} />
        <CorteRow label="Total cobrado" value={corte.totalCobrado} />
        <CorteRow label="IVA cobrado" value={corte.ivaCobrado} />
        <CorteRow label="Efectivo esperado" value={corte.efectivoEsperado} />
        <CorteRow label="Efectivo contado" value={corte.efectivoContado ?? "0"} />
      </div>
      <p className="text-right text-sm font-semibold">Diferencia: {formatNumber(corte.diferencia, { kind: "money" })}</p>
      <div className="grid gap-4 md:grid-cols-2">
      <CorteSection title="Formas de pago">{corte.formasPago.map((row) => <CorteRow key={row.formaPago} label={`${row.formaPago} (${formatNumber(row.ticketsCount, { kind: "count" })} tickets)`} value={row.importe} />)}</CorteSection>
        <CorteSection title="Cuentas destino">{corte.cuentasDestino.map((row) => <CorteRow key={`${row.formaPago}-${row.cuentaDestino}`} label={formatAccountDestination(row.cuentaDestino)} value={row.importe} />)}</CorteSection>
      <CorteSection title="Salidas de dinero">{corte.salidas.length ? corte.salidas.map((salida) => <CorteRow key={salida.id} label={`${formatAccountDestination(salida.cuentaOrigen)} · ${salida.motivo}`} value={`-${formatNumber(salida.monto, { kind: "money" })}`} />) : <p className="text-xs text-muted-foreground">Sin salidas registradas.</p>}</CorteSection>
      <CorteSection title="Neto esperado por cuenta">{Object.entries(corte.salidasPorCuenta).map(([cuenta, salida]) => <CorteRow key={cuenta} label={`${formatAccountDestination(cuenta)} · salidas`} value={`-${formatNumber(salida, { kind: "money" })}`} />)}</CorteSection>
        <CorteSection title="Facturación">{corte.facturacion.map((row) => <CorteFiscalRow key={String(row.facturado)} row={row} />)}</CorteSection>
      <CorteSection title="Rollos / Metraje">{corte.metreado.map((row) => <CorteRow key={`${row.tipo}-${row.unidad}`} label={`${row.tipo === "METREADO" ? "METRAJE" : "ROLLOS"} · ${formatNumber(row.cantidad, { kind: "quantity" })} ${formatUnit(row.unidad)}`} value={row.importe} />)}</CorteSection>
      </div>
      <CorteSection title="Productos vendidos">{corte.productos.length ? corte.productos.map((row) => <CorteRow key={row.productoId} label={`${row.sku} · ${row.tela} ${row.color} · ${formatNumber(row.cantidad, { kind: "quantity" })} ${formatUnit(row.unidad)}`} value={row.importe} />) : <p className="text-xs text-muted-foreground">Sin productos cobrados.</p>}</CorteSection>
      <CorteSection title={`Tickets pendientes (${formatNumber(corte.pendientes.length, { kind: "count" })})`}>{corte.pendientes.length ? corte.pendientes.map((row) => <CorteRow key={row.ticketId} label={`Folio ${formatNumber(row.folio, { kind: "identifier" })} · ${row.nombreCliente || "Venta a Público"}`} value={row.total} />) : <p className="text-xs text-muted-foreground">Sin tickets pendientes.</p>}</CorteSection>
    </div>
  );
}

function HojaVentasDiaPrint({ hoja }: { hoja: CorteCaja["hojaVentasDia"] }) {
  return (
    <article className="hoja-ventas-print" aria-label="Hoja de ventas del día">
      <header className="mb-5 border-b-2 border-black pb-3">
        <h1 className="text-xl font-bold">Hoja de Ventas del Día</h1>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><strong>Sitio:</strong> {hoja.sitio}</p>
          <p><strong>Fecha operativa:</strong> {hoja.fechaOperativa}</p>
          <p><strong>Quien hizo el corte:</strong> {hoja.quienCerro ?? "Sesión aún no cerrada"}</p>
          <p><strong>Estado:</strong> {hoja.cerrada ? "Corte cerrado" : "Previsualización — sesión abierta"}</p>
        </div>
      </header>
      {hoja.secciones.map((seccion) => (
        <section key={seccion.modalidad} className="mb-5">
          <h2 className="mb-2 border-b font-bold">{seccion.modalidad}</h2>
          {seccion.lineas.length === 0 ? (
            <p className="text-sm italic">Sin ventas en esta sección.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1 pr-2">Producto</th>
                  <th className="py-1 pr-2">SKU</th>
                  <th className="py-1 pr-2 text-right">Cantidad</th>
                  <th className="py-1 pr-2">Unidad</th>
                  <th className="py-1 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {seccion.lineas.map((linea) => (
                  <tr key={`${linea.productoId}-${linea.tipo}`} className="border-b border-black/20">
                    <td className="py-1 pr-2">{linea.tela} · {linea.color}</td>
                    <td className="py-1 pr-2">{linea.sku}</td>
                    <td className="py-1 pr-2 text-right">{formatNumber(linea.cantidad, { kind: "quantity" })}</td>
                    <td className="py-1 pr-2">{formatUnit(linea.unidad)}</td>
                    <td className="py-1 text-right">{formatNumber(linea.importe, { kind: "money" })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={4} className="pt-2 text-right">Subtotal {seccion.modalidad}</td>
                  <td className="pt-2 text-right">{formatNumber(seccion.subtotal, { kind: "money" })}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      ))}
      <footer className="grid grid-cols-2 gap-x-8 gap-y-1 border-t-2 border-black pt-3 text-sm">
        <p>Total de rollos: <strong>{formatNumber(hoja.totalRollos, { kind: "quantity" })}</strong></p>
        <p>Total de metros: <strong>{formatNumber(hoja.totalMetros, { kind: "quantity" })}</strong></p>
        <p>Total de kilos: <strong>{formatNumber(hoja.totalKilos, { kind: "quantity" })}</strong></p>
        <p>Subtotal antes de IVA: <strong>{formatNumber(hoja.subtotal, { kind: "money" })}</strong></p>
        <p>IVA facturado: <strong>{formatNumber(hoja.ivaFacturado, { kind: "money" })}</strong></p>
        <p className="text-base">Total general: <strong>{formatNumber(hoja.totalGeneral, { kind: "money" })}</strong></p>
      </footer>
    </article>
  );
}

function CorteSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CorteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">
        {formatNumber(value, { kind: "money" })}
      </span>
    </div>
  );
}

function CorteFiscalRow({
  row,
}: {
  row: {
    facturado: boolean;
    ticketsCount: number;
    subtotal: string;
    iva: string;
    importe: string;
  };
}) {
  return (
    <div className="rounded border bg-muted/20 p-2 text-xs">
      <div className="mb-1 flex justify-between font-semibold">
        <span>
          {row.facturado ? "Facturado" : "No facturado"} ({formatNumber(row.ticketsCount, { kind: "count" })})
        </span>
        <span>
          {formatNumber(row.importe, { kind: "money" })}
        </span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal</span>
        <span>
          {formatNumber(row.subtotal, { kind: "money" })}
        </span>
      </div>
      <div className="mt-0.5 flex justify-between text-muted-foreground">
        <span>IVA</span>
        <span>
          {formatNumber(row.iva, { kind: "money" })}
        </span>
      </div>
    </div>
  );
}
