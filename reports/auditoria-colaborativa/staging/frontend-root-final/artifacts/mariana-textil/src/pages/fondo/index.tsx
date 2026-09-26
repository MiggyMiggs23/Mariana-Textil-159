import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Wallet, ArrowUpRight, ArrowDownRight, Scale, History, Plus, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFondoCurrency } from "@/lib/fondo-utils";
import { useGetFondo, exportarFondoCSV } from "@/hooks/fondo";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { NuevoMovimientoDialog } from "@/components/fondo/nuevo-movimiento-dialog";
import { NuevoArqueoDialog } from "@/components/fondo/nuevo-arqueo-dialog";

export default function FondoSummary() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: resumen, isLoading, error } = useGetFondo();
  
  const [nuevoMovimientoOpen, setNuevoMovimientoOpen] = useState(false);
  const [nuevoArqueoOpen, setNuevoArqueoOpen] = useState(false);
  const [movimientoTipo, setMovimientoTipo] = useState<"INGRESO" | "RETIRO">("INGRESO");

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  if (error || !resumen) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center justify-center gap-2">
          <Wallet className="w-5 h-5" />
          <span className="font-medium">Error al cargar el fondo. Verifica que esté habilitado y tengas permisos.</span>
        </div>
      </div>
    );
  }

  const isInitialized = resumen.versionSaldo !== null;

  const handleExport = async (tipo: "movimientos" | "arqueos") => {
    try {
      await exportarFondoCSV(tipo, queryClient);
      toast({ title: "Exportación exitosa", description: `El archivo de ${tipo} se ha descargado.` });
    } catch (err) {
      toast({ 
        title: "Error al exportar", 
        description: err instanceof Error ? err.message : "No se pudo generar la exportación.", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">{resumen.fondo.nombre}</h1>
          <p className="text-muted-foreground mt-1">Ubicación: {resumen.fondo.ubicacion.nombre}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => handleExport("movimientos")}>
            <Download className="w-4 h-4 mr-2" /> Movimientos CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("arqueos")}>
            <Download className="w-4 h-4 mr-2" /> Arqueos CSV
          </Button>
        </div>
      </div>

      {!isInitialized ? (
        <Card className="border-sidebar-primary/20 bg-sidebar-primary/5">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-sidebar-primary/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-sidebar-primary" />
            </div>
            <h2 className="text-xl font-semibold">Fondo no inicializado</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Para comenzar a operar el fondo, es necesario registrar el saldo inicial exacto actual reconociendo el dinero físico existente.
            </p>
            <Button onClick={() => { setMovimientoTipo("INGRESO"); setNuevoMovimientoOpen(true); }} className="mt-4">
              Registrar Saldo Inicial
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1 cursor-pointer hover:border-sidebar-primary/50 transition-colors" onClick={() => setLocation("/fondo/movimientos")}>
              <CardHeader className="pb-2">
                <CardDescription>Saldo Actual</CardDescription>
                <CardTitle className="text-4xl font-bold tracking-tight text-sidebar-primary">
                  {formatFondoCurrency(resumen.saldo)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <FileText className="w-4 h-4 mr-1" />
                  <span>{resumen.totalMovimientos} movimientos registrados</span>
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-full min-h-[120px] flex flex-col items-center justify-center gap-3 hover:bg-sidebar-primary/5 hover:text-sidebar-primary hover:border-sidebar-primary/30"
                onClick={() => { setMovimientoTipo("INGRESO"); setNuevoMovimientoOpen(true); }}
                data-testid="btn-nuevo-ingreso"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <span className="font-semibold text-lg">Registrar Ingreso</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-full min-h-[120px] flex flex-col items-center justify-center gap-3 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
                onClick={() => { setMovimientoTipo("RETIRO"); setNuevoMovimientoOpen(true); }}
                data-testid="btn-nuevo-retiro"
              >
                <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <span className="font-semibold text-lg">Registrar Retiro</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Último Arqueo</CardTitle>
                  <CardDescription>Conteo físico del fondo</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setLocation("/fondo/arqueos")}>
                  <History className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {resumen.ultimoArqueo ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b pb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Efectivo Contado</p>
                        <p className="text-2xl font-bold">{formatFondoCurrency(resumen.ultimoArqueo.efectivoContado)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Diferencia</p>
                        <p className={`text-lg font-semibold ${Number(resumen.ultimoArqueo.diferencia) < 0 ? "text-destructive" : Number(resumen.ultimoArqueo.diferencia) > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {formatFondoCurrency(resumen.ultimoArqueo.diferencia)}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground flex justify-between">
                      <span>{format(new Date(resumen.ultimoArqueo.fecha), "dd MMM yyyy HH:mm", { locale: es })}</span>
                      <span>Por {resumen.ultimoArqueo.autor.nombre}</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-muted-foreground">
                    <Scale className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>No hay arqueos registrados</p>
                  </div>
                )}
                <Button className="w-full mt-4" variant="secondary" onClick={() => setNuevoArqueoOpen(true)}>
                  <Scale className="w-4 h-4 mr-2" /> Realizar Arqueo
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Actividad Reciente</CardTitle>
                  <CardDescription>Últimos movimientos</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setLocation("/fondo/movimientos")}>
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                 <div className="py-2 flex items-center justify-center">
                    <Button variant="outline" className="w-full" onClick={() => setLocation("/fondo/movimientos")}>
                      Ver Historial Completo
                    </Button>
                 </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {nuevoMovimientoOpen && (
        <NuevoMovimientoDialog 
          open={nuevoMovimientoOpen} 
          onOpenChange={setNuevoMovimientoOpen} 
          tipo={movimientoTipo} 
          isInitial={!isInitialized}
        />
      )}
      
      {nuevoArqueoOpen && resumen && (
        <NuevoArqueoDialog 
          open={nuevoArqueoOpen} 
          onOpenChange={setNuevoArqueoOpen} 
          currentBalance={resumen.saldo}
          versionSaldo={resumen.versionSaldo}
        />
      )}
    </div>
  );
}