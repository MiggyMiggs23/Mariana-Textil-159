import { useState, type MouseEvent } from "react";
import { formatNumber } from "@workspace/number-format";
import { format } from "date-fns";
import {
  useGetClienteNotaCredito,
  getGetClienteNotaCreditoQueryKey,
  useGetClientePagoDetalle,
  getGetClientePagoDetalleQueryKey
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClienteNotaEstadoBadge, type EstadoNota } from "@/components/cliente-nota-estado-badge";
import { Input } from "@/components/ui/input";
import { hasPermission, Modules } from "@/lib/permisos";
import { useGetCurrentUser, useReversarClientePago } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

interface ClienteNotaCreditoProps {
  clienteId: number;
  ticketId: number;
}

export function isNormalNotaAplicacionClick(
  event: Pick<
    MouseEvent<HTMLAnchorElement>,
    | "button"
    | "defaultPrevented"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "altKey"
    | "currentTarget"
  >,
) {
  const target = event.currentTarget?.target;
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!target || target === "_self")
  );
}

export function handleNotaAplicacionClick(
  event: Pick<
    MouseEvent<HTMLAnchorElement>,
    | "button"
    | "defaultPrevented"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "altKey"
    | "currentTarget"
  >,
  onNavigate?: () => void,
) {
  if (onNavigate && isNormalNotaAplicacionClick(event)) {
    onNavigate();
  }
}

export function NotaAplicacionFolioLink({
  ticketId,
  folio,
  onNavigate,
}: {
  ticketId: number | null;
  folio: number;
  onNavigate?: () => void;
}) {
  return ticketId != null ? (
    <Link
      href={`/tickets/${ticketId}`}
      className="font-black text-sm text-sidebar hover:text-primary hover:underline"
      onClick={(event) => handleNotaAplicacionClick(event, onNavigate)}
    >
      #{folio}
    </Link>
  ) : (
    <span className="font-black text-sm text-sidebar">#{folio}</span>
  );
}

function parseDate(dString: string) {
  return new Date(dString.includes('T') ? dString : `${dString}T12:00:00`);
}

export function ClienteNotaCredito({ clienteId, ticketId }: ClienteNotaCreditoProps) {
  const { data: nota, isLoading } = useGetClienteNotaCredito(
    clienteId,
    ticketId,
    {
      query: {
        enabled: !!clienteId && !!ticketId,
        queryKey: getGetClienteNotaCreditoQueryKey(clienteId, ticketId),
      }
    }
  );

  const [selectedPagoId, setSelectedPagoId] = useState<number | null>(null);
  const [reversoPagoId, setReversoPagoId] = useState<number | null>(null);
  const [reversoMotivo, setReversoMotivo] = useState("");
  const [reversoConfirm, setReversoConfirm] = useState("");
  const { data: user } = useGetCurrentUser();
  const reversarPago = useReversarClientePago();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pagoDetalle, isLoading: isLoadingPago } = useGetClientePagoDetalle(
    clienteId,
    selectedPagoId || 0,
    {
      query: {
        enabled: !!clienteId && !!selectedPagoId,
        queryKey: getGetClientePagoDetalleQueryKey(clienteId, selectedPagoId || 0),
      }
    }
  );

  if (isLoading) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-primary/60">Cargando detalles de crédito...</p>
      </div>
    );
  }

  if (!nota) return null;
  const notaConEstado = nota as typeof nota & {
    estadoNota?: EstadoNota;
    saldoPendiente?: string;
  };
  const estadoNota = notaConEstado.estadoNota;
  const saldoPendiente = notaConEstado.saldoPendiente ?? nota.saldoActual;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 flex flex-col">
          <CardHeader className="py-4 pb-2 flex-none">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold text-center h-8 flex flex-col justify-end">
              <span>Estado de Nota</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center pb-6">
            <ClienteNotaEstadoBadge estadoNota={estadoNota} id={ticketId} className="scale-125" />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="py-4 pb-2 flex-none">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold text-center h-8 flex flex-col justify-end">
              <span>Saldo pendiente</span>
              {estadoNota !== "PENDIENTE" && (
                <span className="text-[10px] text-muted-foreground/60 font-medium tracking-normal normal-case mt-0.5">
                  De {formatNumber(nota.importeOriginal, { kind: "money" })}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center pb-6">
            <div className={`text-3xl font-black tabular-nums leading-none ${estadoNota === "PAGADA" ? "text-emerald-600" : "text-red-700"}`}>
              {formatNumber(saldoPendiente, { kind: "money" })}
            </div>
          </CardContent>
        </Card>

        <Card className={`flex flex-col ${estadoNota === "CON_RETRASO" ? "border-destructive/50 bg-destructive/5" : ""}`}>
          <CardHeader className="py-4 pb-2 flex-none">
            <CardTitle className={`text-sm uppercase tracking-wider font-bold text-center h-8 flex flex-col justify-end ${estadoNota === "CON_RETRASO" ? "text-destructive" : "text-muted-foreground"}`}>
              <span>Vencimiento</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center pb-6 text-center">
            {nota.fechaVencimiento ? (
              <div className="flex flex-col items-center justify-center">
                <div className={`text-2xl font-black leading-none ${estadoNota === "CON_RETRASO" ? "text-destructive" : ""}`}>
                  {format(parseDate(nota.fechaVencimiento), "dd/MM/yyyy")}
                </div>
                {estadoNota === "CON_RETRASO" && (
                  <div className="text-xs text-destructive font-bold mt-1.5 bg-destructive/10 px-2 py-0.5 rounded-full">
                    {nota.diasVencidos} días de retraso
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground font-medium">No establecido</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-muted/30 pb-4 border-b">
          <CardTitle className="text-lg">Historial de Abonos ({nota.abonos.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {nota.abonos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-medium">
              No se han registrado abonos a esta nota.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="p-4 font-bold text-muted-foreground">Fecha</th>
                    <th className="p-4 font-bold text-muted-foreground">Aplicado a Nota</th>
                    <th className="p-4 font-bold text-muted-foreground">Forma / Ref</th>
                    <th className="p-4 font-bold text-muted-foreground">Usuario</th>
                    <th className="p-4 font-bold text-muted-foreground text-right">Total del Pago</th>
                    <th className="p-4 font-bold text-muted-foreground text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {nota.abonos.map((abono, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 font-medium">{format(parseDate(abono.fecha), "dd/MM/yyyy")}</td>
                      <td className="p-4 font-black text-emerald-600 tabular-nums">{formatNumber(abono.montoAplicado, { kind: "money" })}</td>
                      <td className="p-4">
                        <div className="font-bold">{abono.formaPago || "—"}</div>
                        {abono.referencia && <div className="text-xs text-muted-foreground mt-0.5">{abono.referencia}</div>}
                      </td>
                      <td className="p-4">{abono.usuarioRegistrador || "—"}</td>
                      <td className="p-4 text-right font-medium tabular-nums">{formatNumber(abono.montoTotalAbono, { kind: "money" })}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-bold"
                            onClick={() => setSelectedPagoId(abono.movimientoPagoId)}
                          >
                            Ver Reparto
                          </Button>
                          <Link
                            href={`/clientes/${clienteId}/movimientos/${abono.movimientoPagoId}`}
                            className="inline-flex h-8 items-center rounded-md px-2 text-xs font-bold text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            data-testid={`link-abono-movimiento-${abono.movimientoPagoId}`}
                          >
                            ABONO · Movimiento #{abono.movimientoPagoId}
                          </Link>
                          {abono.revertido ? (
                            <Badge variant="outline" className="h-8 border-destructive/40 text-destructive">
                              REVERTIDO
                            </Badge>
                          ) : hasPermission(user, Modules.CLIENTES_FINANZAS, 'autorizar') && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 text-xs font-bold"
                              onClick={() => setReversoPagoId(abono.movimientoPagoId)}
                            >
                              <Ban className="h-4 w-4 mr-1" /> Reversar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPagoId} onOpenChange={(val) => !val && setSelectedPagoId(null)}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
          <DialogHeader className="bg-sidebar p-6 text-white pb-6">
            <DialogTitle className="text-xl">Detalle de Reparto de Pago</DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-secondary/10">
            {isLoadingPago ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !pagoDetalle ? (
              <div className="text-center p-8 text-destructive">No se pudo cargar el detalle.</div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between bg-white p-4 rounded-xl border shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Abonado</div>
                    <div className="text-2xl font-black tabular-nums">{formatNumber(pagoDetalle.montoTotalAbono, { kind: "money" })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Fecha</div>
                    <div className="font-medium">{format(parseDate(pagoDetalle.fecha), "dd/MM/yyyy")}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sidebar border-b pb-2">Aplicaciones de este pago</h4>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {pagoDetalle.aplicaciones.map((asig, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border shadow-sm flex items-center justify-between ${asig.ticketId === ticketId ? "bg-primary/5 border-primary/30" : "bg-white"}`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <NotaAplicacionFolioLink
                              ticketId={asig.ticketId}
                              folio={asig.folio}
                              onNavigate={() => setSelectedPagoId(null)}
                            />
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${asig.resultado === "PAGADA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {asig.resultado}
                            </span>
                            {asig.ticketId === ticketId && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-primary/20 text-primary">Esta Nota</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Saldo: {formatNumber(asig.importeOriginal, { kind: "money" })} → <span className="font-bold text-sidebar">{formatNumber(asig.saldoActual, { kind: "money" })}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Aplicado</span>
                          <span className="font-black text-primary tabular-nums">+{formatNumber(asig.aplicado, { kind: "money" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reversoPagoId} onOpenChange={(val) => {
        if (!val) {
          setReversoPagoId(null);
          setReversoMotivo("");
          setReversoConfirm("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" /> Reversar Abono
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Esta acción anulará el pago y restaurará los saldos pendientes de todas las notas afectadas por el mismo.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-sidebar uppercase tracking-wider">Motivo del reverso</label>
              <Input
                value={reversoMotivo}
                onChange={(e) => setReversoMotivo(e.target.value)}
                placeholder="Explica por qué se anula este pago..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-sidebar uppercase tracking-wider">
                Escribe <span className="text-destructive select-all">REVERSAR</span> para confirmar
              </label>
              <Input
                value={reversoConfirm}
                onChange={(e) => setReversoConfirm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReversoPagoId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={reversoConfirm !== "REVERSAR" || reversoMotivo.trim().length < 5 || reversarPago.isPending}
              onClick={() => {
                if (reversoPagoId) {
                  reversarPago.mutate(
                    { id: clienteId, pagoId: reversoPagoId, data: { motivo: reversoMotivo } },
                    {
                      onSuccess: () => {
                        toast({ title: "Abono reversado exitosamente" });
                        setReversoPagoId(null);
                        setReversoMotivo("");
                        setReversoConfirm("");
                        queryClient.invalidateQueries({ queryKey: getGetClienteNotaCreditoQueryKey(clienteId, ticketId) });
                        queryClient.invalidateQueries({ queryKey: ["cliente-account", clienteId] });
                         queryClient.invalidateQueries({
                           predicate: (query) => {
                             const key = query.queryKey[0];
                             return typeof key === "string" && (key.startsWith("/api/clientes/") || key.startsWith("/api/tickets/"));
                           },
                         });
                      },
                      onError: (err) => {
                        toast({ title: "Error al reversar", description: "Ocurrió un problema.", variant: "destructive" });
                      }
                    }
                  );
                }
              }}
            >
              {reversarPago.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar Reverso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
