import { useState } from "react";
import { useLocation } from "wouter";
import {
  useObtenerSesionCajaActual,
  useAbrirSesionCaja,
  useObtenerCorteCaja,
  useCerrarSesionCaja,
  useListarTickets,
  useCobrarTicket,
  getObtenerSesionCajaActualQueryKey,
  getListarTicketsQueryKey,
  getObtenerCorteCajaQueryKey,
  EstadoTicket,
  FormaPagoTicket,
  TicketCobroInput,
  TicketPagoInput,
  SesionCajaAperturaInput,
  SesionCajaCierreInput,
  TicketResumen
} from "@workspace/api-client-react";
import { useLocationScope } from "@/lib/location-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Banknote, CreditCard, Wallet, Search, RefreshCw, AlertCircle, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function AbrirCajaForm({ ubicacionId, onSuccess }: { ubicacionId: number, onSuccess: () => void }) {
  const [fondo, setFondo] = useState("");
  const { toast } = useToast();
  const abrirCaja = useAbrirSesionCaja();

  const handleAbrir = () => {
    const fondoNum = Number(fondo);
    if (isNaN(fondoNum) || fondoNum < 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    
    abrirCaja.mutate({ data: { fondoInicial: fondoNum, ubicacionId } }, {
      onSuccess: () => {
        toast({ title: "Caja abierta correctamente" });
        onSuccess();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message || err.error, variant: "destructive" });
      }
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-20 shadow-lg border-primary/20">
      <CardHeader className="bg-primary/5 text-primary text-center pb-6">
        <div className="mx-auto bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
          <Banknote className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl">Apertura de Caja</CardTitle>
        <CardDescription className="text-base text-primary/70">Ingresa el fondo inicial para comenzar a cobrar</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Fondo Inicial (Efectivo)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
          {abrirCaja.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Abrir Turno
        </Button>
      </CardFooter>
    </Card>
  );
}

function CobroPanel({ ticket, onCobrado }: { ticket: TicketResumen, onCobrado: () => void }) {
  const { toast } = useToast();
  const cobrarTicket = useCobrarTicket();
  
  const [pagos, setPagos] = useState<{formaPago: FormaPagoTicket, importe: string, referencia?: string}[]>([
    { formaPago: FormaPagoTicket.EFECTIVO, importe: ticket.total }
  ]);
  const [clienteId, setClienteId] = useState(
    ticket.clienteId == null ? "" : String(ticket.clienteId),
  );
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  
  const totalPagado = pagos.reduce((sum, p) => sum + (Number(p.importe) || 0), 0);
  const totalTicket = Number(ticket.total);
  const faltante = totalTicket - totalPagado;
  const usaCredito = pagos.some(
    (pago) => pago.formaPago === FormaPagoTicket.CREDITO,
  );

  const handleCobrar = () => {
    if (Math.abs(faltante) > 0.01) {
      toast({ title: "El pago no coincide", description: "El total pagado debe ser igual al total del ticket", variant: "destructive" });
      return;
    }

    const pagosValidos = pagos.filter(p => Number(p.importe) > 0).map(p => ({
      formaPago: p.formaPago,
      importe: Number(p.importe),
      referencia: p.referencia || undefined
    }));

    if (usaCredito && !clienteId) {
      toast({
        title: "Selecciona un cliente",
        description: "El crédito debe quedar asociado a un cliente.",
        variant: "destructive",
      });
      return;
    }

    cobrarTicket.mutate({
      id: ticket.id,
      data: {
        pagos: pagosValidos,
        clienteId: clienteId ? Number(clienteId) : undefined,
        credencialesAdmin:
          adminUser && adminPass
            ? { usuario: adminUser, password: adminPass }
            : undefined,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Ticket cobrado exitosamente" });
        onCobrado();
      },
      onError: (err: any) => {
        toast({ title: "Error al cobrar", description: err.message || err.error, variant: "destructive" });
      }
    });
  };

  return (
    <Card className="h-full flex flex-col shadow-sm border-sidebar-border/10">
      <CardHeader className="bg-sidebar text-white pb-4 rounded-t-lg">
        <CardTitle className="text-xl flex justify-between items-center">
          <span>Cobrar Folio: {ticket.folio}</span>
          <span className="text-xl font-bold bg-white/20 px-3 py-1 rounded">
            {totalTicket.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 bg-muted/10">
        <div className="space-y-4">
          <Label className="text-base font-semibold">Desglose de Pago</Label>
          {pagos.map((pago, i) => (
            <div key={i} className="flex items-end gap-3 bg-white p-3 rounded-md border shadow-sm">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Forma de Pago</Label>
                <Select value={pago.formaPago} onValueChange={(v) => {
                  const newPagos = [...pagos];
                  newPagos[i].formaPago = v as FormaPagoTicket;
                  setPagos(newPagos);
                }}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FormaPagoTicket.EFECTIVO}>Efectivo</SelectItem>
                    {ticket.tipo !== "METREADO" && (
                      <>
                        <SelectItem value={FormaPagoTicket.TRANSFERENCIA}>Transferencia</SelectItem>
                        <SelectItem value={FormaPagoTicket.CREDITO}>Crédito</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Importe</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
                    className="pl-8 h-10 font-bold"
                  />
                </div>
              </div>

              {pago.formaPago === FormaPagoTicket.TRANSFERENCIA && (
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Referencia</Label>
                  <Input 
                    placeholder="Opcional" 
                    value={pago.referencia || ""}
                    onChange={(e) => {
                      const newPagos = [...pagos];
                      newPagos[i].referencia = e.target.value;
                      setPagos(newPagos);
                    }}
                    className="h-10"
                  />
                </div>
              )}

              {pagos.length > 1 && (
                <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive mb-0.5" onClick={() => {
                  const newPagos = [...pagos];
                  newPagos.splice(i, 1);
                  setPagos(newPagos);
                }}>
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
            </div>
          ))}
          
          <Button 
            variant="outline" 
            className="w-full border-dashed"
            onClick={() => setPagos([...pagos, { formaPago: FormaPagoTicket.EFECTIVO, importe: "0" }])}
          >
            + Añadir forma de pago combinada
          </Button>

          {usaCredito && (
            <div className="space-y-4 rounded-md border border-primary/20 bg-primary/5 p-4">
              <div className="space-y-2">
                <Label>Cliente para crédito</Label>
                <Input
                  type="number"
                  min="1"
                  value={clienteId}
                  onChange={(event) => setClienteId(event.target.value)}
                  placeholder="ID del cliente"
                />
              </div>
              <div className="space-y-3 border-t border-primary/15 pt-3">
                <p className="text-xs text-muted-foreground">
                  Si el importe rebasa el límite, captura la autorización de un ADMIN.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Usuario ADMIN</Label>
                    <Input
                      value={adminUser}
                      onChange={(event) => setAdminUser(event.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contraseña ADMIN</Label>
                    <Input
                      type="password"
                      value={adminPass}
                      onChange={(event) => setAdminPass(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch p-5 bg-muted/20 border-t gap-4">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">Total Pagado:</span>
          <span>{totalPagado.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
        </div>
        
        {faltante !== 0 && (
          <div className={`flex justify-between items-center text-sm font-bold ${faltante > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            <span>{faltante > 0 ? "Faltan:" : "Cambio (Sobran):"}</span>
            <span>{Math.abs(faltante).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
          </div>
        )}
        
        <Button 
          size="lg" 
          className="w-full h-14 text-lg font-bold"
          disabled={Math.abs(faltante) > 0.01 || cobrarTicket.isPending}
          onClick={handleCobrar}
        >
          {cobrarTicket.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Banknote className="mr-2 h-5 w-5" />}
          Registrar Cobro
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function CobrosPage() {
  const [, setLocation] = useLocation();
  const { selectedLocationId } = useLocationScope();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  
  // Dialogs
  const [cierreOpen, setCierreOpen] = useState(false);
  const [efectivoContado, setEfectivoContado] = useState("");
  const { toast } = useToast();

  const { data: sesionData, isLoading: loadingSesion } = useObtenerSesionCajaActual({
    ubicacionId: selectedLocationId || 0
  }, {
    query: {
      enabled: !!selectedLocationId,
      queryKey: getObtenerSesionCajaActualQueryKey({ ubicacionId: selectedLocationId || 0 })
    }
  });

  const { data: ticketsData, isFetching: fetchingTickets } = useListarTickets({
    ubicacionId: selectedLocationId || 0,
    cobrado: false,
    estado: EstadoTicket.VENDIDO
  }, {
    query: {
      enabled: !!selectedLocationId && !!sesionData?.sesion,
      queryKey: getListarTicketsQueryKey({
        ubicacionId: selectedLocationId || 0,
        cobrado: false,
        estado: EstadoTicket.VENDIDO
      }),
      refetchInterval: 10000 // auto-refresh every 10s for new tickets
    }
  });
  
  const tickets = ticketsData || [];
  const selectedTicket = tickets.find(t => t.id === selectedTicketId);
  
  const { data: corteData } = useObtenerCorteCaja(sesionData?.sesion?.id || 0, {
    query: {
      enabled: cierreOpen && !!selectedLocationId && !!sesionData?.sesion,
      queryKey: getObtenerCorteCajaQueryKey(sesionData?.sesion?.id || 0)
    }
  });

  const cerrarCaja = useCerrarSesionCaja();

  const handlePrintCorte = () => {
    document.body.classList.add("print-corte");
    window.print();
    window.setTimeout(() => document.body.classList.remove("print-corte"), 500);
  };

  const handleCerrarCaja = () => {
    if (!sesionData?.sesion) return;
    const contado = Number(efectivoContado);
    if (isNaN(contado) || contado < 0) {
      toast({ title: "Efectivo contado inválido", variant: "destructive" });
      return;
    }
    
    cerrarCaja.mutate({ id: sesionData.sesion.id, data: { efectivoContado: contado } }, {
      onSuccess: () => {
        toast({ title: "Caja cerrada correctamente" });
        setCierreOpen(false);
        queryClient.invalidateQueries({ queryKey: getObtenerSesionCajaActualQueryKey({ ubicacionId: selectedLocationId || 0 }) });
      },
      onError: (err: any) => {
        toast({ title: "Error al cerrar", description: err.message || err.error, variant: "destructive" });
      }
    });
  };

  if (!selectedLocationId) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
          <h2 className="text-xl font-semibold text-foreground">Selecciona una ubicación</h2>
          <p>Debes seleccionar tu ubicación para operar la caja.</p>
        </div>
      </div>
    );
  }

  if (loadingSesion) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!sesionData || !sesionData.sesion) {
    return (
      <AbrirCajaForm 
        ubicacionId={selectedLocationId} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: getObtenerSesionCajaActualQueryKey({ ubicacionId: selectedLocationId }) })}
      />
    );
  }

  return (
    <div className="flex flex-col h-full max-w-[1600px] mx-auto gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sidebar">Caja Operativa</h1>
          <p className="text-muted-foreground text-sm">Cobro de tickets pendientes y cortes de caja.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold border border-emerald-200">
            Sesión Abierta
          </div>
          <Button variant="outline" onClick={() => setCierreOpen(true)} className="border-destructive/30 text-destructive hover:bg-destructive/10">
            Realizar Corte
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* Left - Tickets Pendientes */}
        <Card className="flex-1 flex flex-col shadow-sm border-sidebar-border/10 min-w-[300px]">
          <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Tickets por Cobrar</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: getListarTicketsQueryKey({ ubicacionId: selectedLocationId || 0, cobrado: false, estado: EstadoTicket.VENDIDO }) })}>
              <RefreshCw className={`h-4 w-4 ${fetchingTickets ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-secondary/10">
            {tickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <CheckCircle className="h-12 w-12 mb-3 text-emerald-500" />
                <p>No hay tickets pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedTicketId === t.id ? "bg-primary/5 border-primary shadow-md" : "bg-white hover:border-primary/50 shadow-sm"}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-lg">Folio: {t.folio}</div>
                        <div className="text-sm text-muted-foreground mt-1">{t.nombreUsuarioTerminal}</div>
                        <div className="text-xs bg-muted inline-block px-1.5 py-0.5 rounded mt-1 font-medium text-muted-foreground">
                          {t.tipo}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xl text-primary">
                          {Number(t.total).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{t.lineasCount || 0} líneas</div>
                         <Button
                           variant="link"
                           size="sm"
                           className="h-7 px-0 text-xs"
                           onClick={(event) => {
                             event.stopPropagation();
                             setLocation(`/tickets/${t.id}`);
                           }}
                         >
                           Ver detalle y márgenes
                         </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Right - Panel de Cobro */}
        <div className="w-full md:w-[450px] lg:w-[500px]">
          {selectedTicket ? (
            <CobroPanel 
              ticket={selectedTicket} 
              onCobrado={() => {
                setSelectedTicketId(null);
                queryClient.invalidateQueries({ queryKey: getListarTicketsQueryKey({ ubicacionId: selectedLocationId || 0, cobrado: false, estado: EstadoTicket.VENDIDO }) });
              }} 
            />
          ) : (
            <Card className="h-full flex items-center justify-center bg-muted/20 border-dashed shadow-none">
              <div className="text-center text-muted-foreground opacity-60">
                <Wallet className="mx-auto h-16 w-16 mb-4" />
                <p className="text-lg">Selecciona un ticket para cobrar</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={cierreOpen} onOpenChange={setCierreOpen}>
        <DialogContent className="corte-print max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Corte y Cierre de Caja</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {!corteData ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-md text-center">
                    <div className="text-xs text-muted-foreground">Fondo Inicial</div>
                    <div className="font-bold">{Number(corteData.fondoInicial).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-md text-center">
                    <div className="text-xs text-muted-foreground">Total Cobrado</div>
                    <div className="font-bold">{Number(corteData.totalCobrado).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</div>
                  </div>
                </div>
                
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-primary">Efectivo Esperado:</span>
                    <span className="text-xl font-bold text-primary">{Number(corteData.efectivoEsperado).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Incluye fondo inicial + cobros en efectivo.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <CorteSection title="Formas de pago">
                    {corteData.formasPago.map((row) => (
                      <CorteRow key={row.formaPago} label={`${row.formaPago} (${row.ticketsCount} tickets)`} value={row.importe} />
                    ))}
                  </CorteSection>
                  <CorteSection title="Cuentas destino">
                    {corteData.cuentasDestino.map((row) => (
                      <CorteRow key={`${row.formaPago}-${row.cuentaDestino}`} label={row.cuentaDestino} value={row.importe} />
                    ))}
                  </CorteSection>
                  <CorteSection title="Facturación">
                    {corteData.facturacion.map((row) => (
                      <CorteRow key={String(row.facturado)} label={row.facturado ? "Facturado" : "No facturado"} value={row.importe} />
                    ))}
                  </CorteSection>
                  <CorteSection title="Normal / Metreado">
                    {corteData.metreado.map((row) => (
                      <CorteRow key={row.tipo} label={`${row.tipo} · ${row.cantidad}`} value={row.importe} />
                    ))}
                  </CorteSection>
                </div>

                <CorteSection title="Productos vendidos">
                  {corteData.productos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin productos cobrados.</p>
                  ) : corteData.productos.map((row) => (
                    <CorteRow key={row.productoId} label={`${row.sku} · ${row.tela} ${row.color} · ${row.cantidad} ${row.unidad}`} value={row.importe} />
                  ))}
                </CorteSection>

                <CorteSection title={`Tickets pendientes (${corteData.pendientes.length})`}>
                  {corteData.pendientes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin tickets pendientes.</p>
                  ) : corteData.pendientes.map((row) => (
                    <CorteRow key={row.ticketId} label={`Folio ${row.folio} · ${row.nombreCliente || "Mostrador"}`} value={row.total} />
                  ))}
                </CorteSection>

                <div className="space-y-2">
                  <Label>Efectivo Físico Contado</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
            <Button variant="outline" onClick={() => setCierreOpen(false)}>Cancelar</Button>
            <Button variant="outline" onClick={handlePrintCorte} disabled={!corteData}>Imprimir Corte</Button>
            <Button onClick={handleCerrarCaja} disabled={cerrarCaja.isPending || !efectivoContado}>
              {cerrarCaja.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CorteSection({ title, children }: { title: string; children: React.ReactNode }) {
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
      <span className="font-mono font-semibold">{Number(value).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
    </div>
  );
}

// Minimal CheckCircle icon needed above
function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}