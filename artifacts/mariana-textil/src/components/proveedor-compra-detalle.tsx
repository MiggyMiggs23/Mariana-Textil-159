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
import { Input } from "@/components/ui/input";
import { hasPermission, Modules } from "@/lib/permisos";
import { useGetCurrentUser, useReversarPagoProveedor } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
  const [reversoPagoId, setReversoPagoId] = useState<number | null>(null);
  const [reversoMotivo, setReversoMotivo] = useState("");
  const [reversoConfirm, setReversoConfirm] = useState("");
  const { data: user } = useGetCurrentUser();
  const reversarPago = useReversarPagoProveedor();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
                            <div className="flex gap-1 mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] font-bold px-2 py-0"
                                onClick={() => setSelectedPagoId(asig.pagoProveedorId)}
                              >
                                Ver Reparto
                              </Button>
                              {hasPermission(user, Modules.PROVEEDORES_FINANZAS, 'autorizar') && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-6 text-[10px] font-bold px-2 py-0"
                                  onClick={() => setReversoPagoId(asig.pagoProveedorId)}
                                >
                                  Reversar
                                </Button>
                              )}
                            </div>
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
              <Ban className="h-5 w-5" /> Reversar Pago a Proveedor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Esta acción anulará el pago y restaurará la deuda pendiente de todas las compras afectadas por el mismo.
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
                    { id: proveedorId, pagoId: reversoPagoId, data: { motivo: reversoMotivo } },
                    {
                      onSuccess: () => {
                        toast({ title: "Pago reversado exitosamente" });
                        setReversoPagoId(null);
                        setReversoMotivo("");
                        setReversoConfirm("");
                        queryClient.invalidateQueries({ queryKey: getGetProveedorCompraDetalleQueryKey(proveedorId, compraId) });
                        queryClient.invalidateQueries({ queryKey: ["listComprasProveedor", proveedorId] });
                        queryClient.invalidateQueries({ queryKey: ["estadoCuentaProveedor", proveedorId] });
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
    </>
  );
}
