import { useState, useEffect, useRef } from "react";
import {
  useObtenerSesionCajaActual,
  useAbrirSesionCaja,
  useObtenerCorteCaja,
  useCerrarSesionCaja,
  useListarTicketsCaja,
  useObtenerTicket,
  useCobrarTicket,
  getObtenerSesionCajaActualQueryKey,
  getListarTicketsCajaQueryKey,
  getObtenerTicketQueryKey,
  getObtenerCorteCajaQueryKey,
  FormaPagoTicket,
} from "@workspace/api-client-react";
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
    if (isNaN(fondoNum) || fondoNum < 0) {
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
  const [clienteId, setClienteId] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [showSplit, setShowSplit] = useState(false);

  const initializedForTicketId = useRef<number | null>(null);

  useEffect(() => {
    if (ticket && open && initializedForTicketId.current !== ticket.id) {
      initializedForTicketId.current = ticket.id;
      setPagos([]);
      setClienteId(ticket.clienteId == null ? "" : String(ticket.clienteId));
    }
  }, [ticket, open]);

  useEffect(() => {
    if (!open) {
      initializedForTicketId.current = null;
      setPagos([]);
      setClienteId("");
      setAdminUser("");
      setAdminPass("");
      setShowSplit(false);
    }
  }, [open]);

  const totalPagado = pagos.reduce(
    (sum, p) => sum + (Number(p.importe) || 0),
    0,
  );
  const totalTicket = Number(ticket?.total || 0);
  const isPaymentSelected = pagos.length > 0;
  const faltante = isPaymentSelected ? totalTicket - totalPagado : totalTicket;
  const usaCredito = pagos.some(
    (pago) => pago.formaPago === FormaPagoTicket.CREDITO,
  );
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

    if (usaCredito && !clienteId) {
      toast({
        title: "Selecciona un cliente",
        description: "El crédito debe quedar asociado a un cliente.",
        variant: "destructive",
      });
      return;
    }

    cobrarTicket.mutate(
      {
        id: ticket.id,
        data: {
          pagos: pagosValidos,
          clienteId: clienteId ? Number(clienteId) : undefined,
          credencialesAdmin:
            adminUser && adminPass
              ? { usuario: adminUser, password: adminPass }
              : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Ticket cobrado exitosamente" });
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
      newPagos.push({ formaPago, importe: ticket?.total || "0" });
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
                    {totalTicket.toLocaleString("es-MX", {
                      style: "currency",
                      currency: "MXN",
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xl text-sidebar">
                    Folio {ticket.folio}
                  </div>
                  <div className="text-sm font-medium px-2 py-0.5 bg-sidebar/10 text-sidebar rounded inline-block mt-1">
                    {ticket.tipo}
                  </div>
                </div>
              </div>
              {ticket.facturado && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>
                      {Number(ticket.subtotal).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>
                      IVA ({(Number(ticket.tasaIva) * 100).toFixed(0)}%)
                    </span>
                    <span>
                      {Number(ticket.iva).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-primary/15 pt-2 font-bold text-primary">
                    <span>Total a cobrar</span>
                    <span>
                      {totalTicket.toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
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
                      disabled={ticket.tipo === "METREADO"}
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
                        primaryPago?.formaPago === FormaPagoTicket.CREDITO
                          ? "default"
                          : "outline"
                      }
                      className={`h-28 flex flex-col items-center justify-center gap-3 transition-all ${primaryPago?.formaPago === FormaPagoTicket.CREDITO ? "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground shadow-md" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground border-2"}`}
                      disabled={ticket.tipo === "METREADO"}
                      onClick={() =>
                        setPrimaryFormaPago(FormaPagoTicket.CREDITO)
                      }
                    >
                      <CreditCard className="h-8 w-8" />
                      <span className="font-bold text-base">Crédito</span>
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
                            {ticket.tipo !== "METREADO" && (
                              <>
                                <SelectItem
                                  value={FormaPagoTicket.TRANSFERENCIA}
                                  className="font-medium py-3 cursor-pointer"
                                >
                                  Transferencia
                                </SelectItem>
                                <SelectItem
                                  value={FormaPagoTicket.CREDITO}
                                  className="font-medium py-3 cursor-pointer"
                                >
                                  Crédito
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

              {usaCredito && (
                <div className="space-y-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-amber-800 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-bold text-sm uppercase tracking-wider">
                      Validación de Crédito
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold text-amber-900">
                      Cliente para crédito
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={clienteId}
                      onChange={(event) => setClienteId(event.target.value)}
                      placeholder="ID del cliente"
                      className="bg-white border-amber-200 h-12 focus-visible:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-3 pt-3">
                    <p className="text-xs font-medium text-amber-700/80">
                      Si el importe rebasa el límite, captura la autorización de
                      un ADMIN.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-amber-900">
                          USUARIO ADMIN
                        </Label>
                        <Input
                          value={adminUser}
                          onChange={(event) => setAdminUser(event.target.value)}
                          autoComplete="off"
                          className="bg-white border-amber-200 h-10 focus-visible:ring-amber-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-amber-900">
                          CONTRASEÑA ADMIN
                        </Label>
                        <Input
                          type="password"
                          value={adminPass}
                          onChange={(event) => setAdminPass(event.target.value)}
                          autoComplete="new-password"
                          className="bg-white border-amber-200 h-10 focus-visible:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
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
                  {Math.abs(faltante).toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  })}
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
                disabled={Math.abs(faltante) > 0.01 || cobrarTicket.isPending}
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

export default function CobrosPage() {
  const { selectedLocationId } = useLocationScope();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [cobroOpen, setCobroOpen] = useState(false);

  // Dialogs
  const [cierreOpen, setCierreOpen] = useState(false);
  const [efectivoContado, setEfectivoContado] = useState("");
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
    data: corteData,
    isError: corteFailed,
    error: corteError,
    refetch: retryCorte,
  } = useObtenerCorteCaja(sesionData?.sesion?.id || 0, {
    query: {
      enabled: cierreOpen && !!selectedLocationId && !!sesionData?.sesion,
      queryKey: getObtenerCorteCajaQueryKey(sesionData?.sesion?.id || 0),
    },
  });

  const cerrarCaja = useCerrarSesionCaja();

  const handlePrintCorte = () => {
    document.body.classList.add("print-corte");
    window.print();
    window.setTimeout(() => document.body.classList.remove("print-corte"), 500);
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
        onSuccess: () => {
          toast({ title: "Caja cerrada correctamente" });
          setCierreOpen(false);
          queryClient.invalidateQueries({
            queryKey: getObtenerSesionCajaActualQueryKey({
              ubicacionId: selectedLocationId || 0,
            }),
          });
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
            Selecciona una ubicación
          </h2>
          <p>Debes seleccionar tu ubicación para operar la caja.</p>
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
                            Folio: {t.folio}
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
                            {Number(t.total).toLocaleString("es-MX", {
                              style: "currency",
                              currency: "MXN",
                            })}
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
          setSelectedTicketId(null);
          queryClient.invalidateQueries({
            queryKey: getListarTicketsCajaQueryKey({
              ubicacionId: selectedLocationId || 0,
            }),
          });
          queryClient.invalidateQueries({
            queryKey: getObtenerCorteCajaQueryKey(sesionId),
          });
        }}
      />

      <Dialog open={cierreOpen} onOpenChange={setCierreOpen}>
        <DialogContent className="corte-print max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Corte y Cierre de Caja</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {corteFailed ? (
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
                      {Number(corteData.fondoInicial).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-md text-center">
                    <div className="text-xs text-muted-foreground">
                      Total Cobrado
                    </div>
                    <div className="font-bold">
                      {Number(corteData.totalCobrado).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </div>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-md text-center">
                    <div className="text-xs text-muted-foreground">
                      IVA Cobrado
                    </div>
                    <div className="font-bold text-primary">
                      {Number(corteData.ivaCobrado).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN",
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-primary">
                      Efectivo Esperado:
                    </span>
                    <span className="text-xl font-bold text-primary">
                      {Number(corteData.efectivoEsperado).toLocaleString(
                        "es-MX",
                        { style: "currency", currency: "MXN" },
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Incluye fondo inicial + cobros en efectivo.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <CorteSection title="Formas de pago">
                    {corteData.formasPago.map((row) => (
                      <CorteRow
                        key={row.formaPago}
                        label={`${row.formaPago} (${row.ticketsCount} tickets)`}
                        value={row.importe}
                      />
                    ))}
                  </CorteSection>
                  <CorteSection title="Cuentas destino">
                    {corteData.cuentasDestino.map((row) => (
                      <CorteRow
                        key={`${row.formaPago}-${row.cuentaDestino}`}
                        label={row.cuentaDestino}
                        value={row.importe}
                      />
                    ))}
                  </CorteSection>
                  <CorteSection title="Facturación">
                    {corteData.facturacion.map((row) => (
                      <CorteFiscalRow key={String(row.facturado)} row={row} />
                    ))}
                  </CorteSection>
                  <CorteSection title="Normal / Metreado">
                    {corteData.metreado.map((row) => (
                      <CorteRow
                        key={row.tipo}
                        label={`${row.tipo} · ${row.cantidad}`}
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
                        key={row.productoId}
                        label={`${row.sku} · ${row.tela} ${row.color} · ${row.cantidad} ${row.unidad}`}
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
                        label={`Folio ${row.folio} · ${row.nombreCliente || "Mostrador"}`}
                        value={row.total}
                      />
                    ))
                  )}
                </CorteSection>

                <div className="space-y-2">
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
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCierreOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintCorte}
              disabled={!corteData}
            >
              Imprimir Corte
            </Button>
            <Button
              onClick={handleCerrarCaja}
              disabled={cerrarCaja.isPending || !efectivoContado}
            >
              {cerrarCaja.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar Cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
        {Number(value).toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
        })}
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
          {row.facturado ? "Facturado" : "No facturado"} ({row.ticketsCount})
        </span>
        <span>
          {Number(row.importe).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
          })}
        </span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal</span>
        <span>
          {Number(row.subtotal).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
          })}
        </span>
      </div>
      <div className="mt-0.5 flex justify-between text-muted-foreground">
        <span>IVA</span>
        <span>
          {Number(row.iva).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
          })}
        </span>
      </div>
    </div>
  );
}
