import { useState } from "react";
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
import { Loader2, ArrowRightLeft, CalendarClock, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClienteNotaCreditoProps {
  clienteId: number;
  ticketId: number;
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`border-2 ${nota.estado === "PAGADA" ? "border-emerald-500/50 bg-emerald-50/30" : nota.estado === "PARCIAL" ? "border-amber-500/50 bg-amber-50/30" : "border-muted"}`}>
          <CardHeader className="py-4 pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
              Estado de Nota
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {nota.estado === "PAGADA" && <span className="text-emerald-600 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> PAGADA</span>}
              {nota.estado === "PARCIAL" && <span className="text-amber-600 flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> PAGO PARCIAL</span>}
              {nota.estado === "PENDIENTE" && <span className="text-muted-foreground flex items-center gap-2"><CalendarClock className="h-5 w-5" /> PENDIENTE</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4 pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-bold flex justify-between">
              <span>Saldo Actual</span>
              {nota.estado !== "PENDIENTE" && <span className="text-xs text-muted-foreground/60 font-medium">De {formatNumber(nota.importeOriginal, { kind: "money" })}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-black tabular-nums ${Number(nota.saldoActual) > 0 ? "text-sidebar" : "text-emerald-600"}`}>
              {formatNumber(nota.saldoActual, { kind: "money" })}
            </div>
          </CardContent>
        </Card>

        <Card className={`${nota.diasVencidos > 0 && nota.estado !== "PAGADA" ? "border-destructive/50 bg-destructive/5" : ""}`}>
          <CardHeader className="py-4 pb-2">
            <CardTitle className={`text-sm uppercase tracking-wider font-bold ${nota.diasVencidos > 0 && nota.estado !== "PAGADA" ? "text-destructive" : "text-muted-foreground"}`}>
              Vencimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nota.fechaVencimiento ? (
              <div>
                <div className={`text-xl font-black ${nota.diasVencidos > 0 && nota.estado !== "PAGADA" ? "text-destructive" : ""}`}>
                  {format(parseDate(nota.fechaVencimiento), "dd/MM/yyyy")}
                </div>
                {nota.diasVencidos > 0 && nota.estado !== "PAGADA" && (
                  <div className="text-sm text-destructive font-bold mt-1">
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs font-bold"
                          onClick={() => setSelectedPagoId(abono.movimientoPagoId)}
                        >
                          Ver Reparto
                        </Button>
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
                            <span className="font-black text-sm text-sidebar">#{asig.folio}</span>
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
    </div>
  );
}
