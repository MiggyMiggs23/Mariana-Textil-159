import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFondoCurrency } from "@/lib/fondo-utils";
import { useGetFondoMovimiento } from "@/hooks/fondo";
import { CorregirMovimientoDialog } from "@/components/fondo/corregir-movimiento-dialog";

export default function FondoMovimientoDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  
  const { data: mov, isLoading, error } = useGetFondoMovimiento(id);
  const [corregirOpen, setCorregirOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  if (error || !mov) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center space-y-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Movimiento no encontrado.</span>
        </div>
        <Button variant="outline" onClick={() => setLocation("/fondo/movimientos")}>
          Volver a Movimientos
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/fondo/movimientos")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-sidebar">Detalle de Movimiento</h1>
        </div>
        
        {!mov.esInverso && !mov.inversoId && mov.categoria !== "SALDO_INICIAL" && (
          <Button variant="destructive" onClick={() => setCorregirOpen(true)}>
            Corregir (Inverso)
          </Button>
        )}
      </div>

      <Card className={mov.esInverso ? "border-destructive shadow-sm" : "shadow-sm"}>
        <CardHeader className="border-b pb-4 bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {mov.naturaleza === "INGRESO" ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                )}
                <CardTitle className="text-xl">
                  {mov.naturaleza === "INGRESO" ? "Ingreso" : "Retiro"}
                </CardTitle>
                <Badge variant={mov.esInverso ? "destructive" : "outline"} className="ml-2">
                  {mov.categoria.replace("_", " ")}
                  {mov.esInverso && " (CORRECCIÓN INVERSA)"}
                </Badge>
              </div>
              <CardDescription className="pt-2 break-words">
                ID: <span className="font-mono text-xs">{mov.id}</span>
                <span className="mx-2">•</span>
                Ordinal: <span className="font-mono text-xs">{mov.ordinal}</span>
              </CardDescription>
            </div>
            <div className="min-w-0 max-w-full text-left sm:text-right">
              <div className={`break-words text-2xl sm:text-3xl font-bold tracking-tight ${mov.naturaleza === "INGRESO" ? "text-emerald-700" : "text-rose-700"}`}>
                {mov.naturaleza === "INGRESO" ? "+" : "-"}{formatFondoCurrency(mov.importe)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {format(new Date(mov.fecha), "dd MMMM yyyy, HH:mm", { locale: es })}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          
          {mov.advertencia && (
            <div className="p-4 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm uppercase tracking-wider mb-1">Advertencia</p>
                <p className="text-sm">{mov.advertencia}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Motivo</h3>
            <div className="p-4 bg-muted/30 rounded-md border border-border/50 text-foreground whitespace-pre-wrap">
              {mov.motivo}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Autor</h3>
              <p className="font-medium">{mov.autor.nombre}</p>
            </div>
          </div>

          {mov.conciliacionInicial && (
            <div className="mt-6 p-4 bg-primary/5 border rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                Reconocimiento de Saldo Inicial
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Efectivo Físico Contado:</span>
                  <p className="font-semibold">{formatFondoCurrency(mov.conciliacionInicial.efectivoFisicoContado)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Declaración Sin Duplicación:</span>
                  <p className="font-medium">{mov.conciliacionInicial.declaracionSinDuplicacion ? "Sí, confirmado" : "No"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Evidencia:</span>
                  <p className="font-medium whitespace-pre-wrap">{mov.conciliacionInicial.evidencia}</p>
                </div>
              </div>
            </div>
          )}

          {mov.inversoId && (
            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Movimiento Anulado</span>
              </div>
              <p className="text-sm text-destructive/80 mb-3">
                Este movimiento fue corregido mediante un asiento inverso.
              </p>
              <Button variant="outline" size="sm" onClick={() => setLocation(`/fondo/movimientos/${mov.inversoId}`)}>
                Ver Corrección Inversa
              </Button>
            </div>
          )}

          {mov.esInverso && mov.originalId && (
            <div className="mt-6 p-4 bg-muted border rounded-lg">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Corrección de Movimiento Original
              </h3>
              <Button variant="outline" size="sm" onClick={() => setLocation(`/fondo/movimientos/${mov.originalId}`)}>
                Ver Movimiento Original
              </Button>
            </div>
          )}

        </CardContent>
      </Card>

      {corregirOpen && (
        <CorregirMovimientoDialog
          open={corregirOpen}
          onOpenChange={setCorregirOpen}
          movimientoId={mov.id}
          importe={mov.importe}
          naturaleza={mov.naturaleza}
        />
      )}
    </div>
  );
}