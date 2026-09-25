import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2, AlertTriangle, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatFondoCurrency } from "@/lib/fondo-utils";
import { useGetFondoArqueo } from "@/hooks/fondo";

export default function FondoArqueoDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  
  const { data: arq, isLoading, error } = useGetFondoArqueo(id);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  if (error || !arq) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center space-y-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Arqueo no encontrado.</span>
        </div>
        <Button variant="outline" onClick={() => setLocation("/fondo/arqueos")}>
          Volver a Arqueos
        </Button>
      </div>
    );
  }

  const dif = Number(arq.diferencia);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fondo/arqueos")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-sidebar">Detalle de Arqueo</h1>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b pb-4 bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                  <Scale className="w-4 h-4" />
                </div>
                <CardTitle className="text-xl">
                  Arqueo de Fondo
                </CardTitle>
              </div>
              <CardDescription className="pt-2 break-words">
                ID: <span className="font-mono text-xs">{arq.id}</span>
              </CardDescription>
            </div>
            <div className="min-w-0 max-w-full text-left sm:text-right">
              <div className="break-words text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {formatFondoCurrency(arq.efectivoContado)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Efectivo Contado Físicamente
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Saldo en Sistema</p>
              <p className="text-xl font-semibold">{formatFondoCurrency(arq.saldoSistema)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Efectivo Contado</p>
              <p className="text-xl font-semibold">{formatFondoCurrency(arq.efectivoContado)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Diferencia</p>
              <p className={`text-xl font-bold ${
                dif < 0 ? "text-destructive" : dif > 0 ? "text-emerald-600" : "text-muted-foreground"
              }`}>
                {dif > 0 ? "+" : ""}{formatFondoCurrency(dif)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Motivo / Observaciones</h3>
            <div className="p-4 bg-muted/10 rounded-md border border-border/50 text-foreground whitespace-pre-wrap">
              {arq.motivo}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-2">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Autor</h3>
              <p className="font-medium">{arq.autor.nombre}</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fecha de Ejecución</h3>
              <p className="font-medium">{format(new Date(arq.fecha), "dd MMMM yyyy, HH:mm", { locale: es })}</p>
            </div>
          </div>
          
          <div className="space-y-1 pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Versión del Saldo (Snapshot)</h3>
            <p className="font-mono text-xs text-muted-foreground bg-muted p-2 rounded max-w-full truncate">
              {arq.versionSaldo || "Inicial"}
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}