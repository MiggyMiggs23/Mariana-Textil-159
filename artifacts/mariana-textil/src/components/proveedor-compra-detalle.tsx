import { useState } from "react";
import { formatNumber } from "@workspace/number-format";
import { format } from "date-fns";
import { 
  useGetProveedorCompraDetalle, 
  getGetProveedorCompraDetalleQueryKey,
  useGetProveedorPagoDetalle,
  getGetProveedorPagoDetalleQueryKey
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowRightLeft, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProveedorCompraDetalleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedorId: number;
  compraId: number;
}

function parseDate(dString: string) {
  return new Date(dString.includes('T') ? dString : `${dString}T12:00:00`);
}

export function ProveedorCompraDetalle({ open, onOpenChange, proveedorId, compraId }: ProveedorCompraDetalleProps) {
  const { data: compraDetalle, isLoading } = useGetProveedorCompraDetalle(
    proveedorId,
    compraId,
    {
      query: {
        enabled: open && !!compraId,
        queryKey: getGetProveedorCompraDetalleQueryKey(proveedorId, compraId),
      }
    }
  );

  const [selectedPagoId, setSelectedPagoId] = useState<number | null>(null);

  const { data: pagoDetalle, isLoading: isLoadingPago } = useGetProveedorPagoDetalle(
    proveedorId,
    selectedPagoId || 0,
    {
      query: {
        enabled: !!selectedPagoId,
        queryKey: getGetProveedorPagoDetalleQueryKey(proveedorId, selectedPagoId || 0),
      }
    }
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-sidebar p-6 text-white pb-6">
            <DialogTitle className="text-xl">Detalle de Compra y Pagos</DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-secondary/10">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !compraDetalle ? (
              <div className="text-center p-8 text-destructive">No se pudo cargar el detalle de la compra.</div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between bg-white p-4 rounded-xl border shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Compra</div>
                    <div className="text-2xl font-black tabular-nums text-sidebar">{formatNumber(Math.abs(Number(compraDetalle.compra.importe)), { kind: "money" })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Fecha</div>
                    <div className="font-medium">{format(parseDate(compraDetalle.compra.fecha), "dd/MM/yyyy")}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sidebar border-b pb-2">Pagos que aplicaron a esta compra</h4>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                    {compraDetalle.aplicaciones.length === 0 ? (
                      <div className="text-center p-4 text-muted-foreground bg-white rounded-lg border border-dashed">
                        No hay pagos aplicados a esta compra.
                      </div>
                    ) : (
                      compraDetalle.aplicaciones.map((asig, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border shadow-sm flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-black text-sm text-sidebar">
                                {format(parseDate(asig.fecha || new Date().toISOString()), "dd/MM/yyyy")}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${asig.resultado === "SALDADA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                {asig.resultado}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Saldo previo: <span className="font-medium line-through decoration-muted-foreground/50">{formatNumber(Math.abs(Number(asig.saldoAntes)), { kind: "money" })}</span> → <span className="font-bold text-sidebar">{formatNumber(Math.abs(Number(asig.saldoDespues)), { kind: "money" })}</span>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="font-black text-emerald-600 tabular-nums">-{formatNumber(asig.importe, { kind: "money" })}</span>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-6 text-[10px] font-bold px-2 py-0"
                              onClick={() => setSelectedPagoId(asig.pagoProveedorId)}
                            >
                              Ver Reparto
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPagoId} onOpenChange={(val) => !val && setSelectedPagoId(null)}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
          <DialogHeader className="bg-sidebar p-6 text-white pb-6">
            <DialogTitle className="text-xl">Detalle de Reparto de Pago</DialogTitle>
          </DialogHeader>
          <div className="p-6 bg-secondary/10">
            {isLoadingPago ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !pagoDetalle ? (
              <div className="text-center p-8 text-destructive">No se pudo cargar el detalle del pago.</div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between bg-white p-4 rounded-xl border shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Abonado</div>
                    <div className="text-2xl font-black tabular-nums">{formatNumber(Math.abs(Number(pagoDetalle.pago.importe)), { kind: "money" })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Fecha</div>
                    <div className="font-medium">{format(parseDate(pagoDetalle.pago.fecha), "dd/MM/yyyy")}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sidebar border-b pb-2">Aplicaciones de este pago</h4>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {pagoDetalle.aplicaciones.map((asig, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border shadow-sm flex items-center justify-between ${asig.compraProveedorId === compraId ? "bg-primary/5 border-primary/30" : "bg-white"}`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-sm text-sidebar">#{asig.folio || asig.entradaId}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${asig.resultado === "SALDADA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {asig.resultado}
                            </span>
                            {asig.compraProveedorId === compraId && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-primary/20 text-primary">Esta Compra</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Deuda: {formatNumber(Math.abs(Number(asig.saldoAntes)), { kind: "money" })} → <span className="font-bold text-sidebar">{formatNumber(Math.abs(Number(asig.saldoDespues)), { kind: "money" })}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Aplicado</span>
                          <span className="font-black text-primary tabular-nums">+{formatNumber(asig.importe, { kind: "money" })}</span>
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
    </>
  );
}
