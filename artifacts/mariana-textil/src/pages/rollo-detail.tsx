import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetRollo, getGetRolloQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Box, Calendar, DollarSign, MapPin, Hash, User, Activity, Printer } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

export default function RolloDetail() {
  const { id } = useParams();
  const { data: rollo, isLoading } = useGetRollo(Number(id), {
    query: { enabled: !!id, queryKey: getGetRolloQueryKey(Number(id)) }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="h-64 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (!rollo) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-12 text-center text-muted-foreground flex flex-col items-center">
          <Box className="w-12 h-12 mb-4 opacity-20" />
          <h2 className="text-xl font-bold mb-2">Rollo no encontrado</h2>
          <Link href="/inventario" className="text-primary hover:underline">Volver a inventario</Link>
        </div>
      </AppLayout>
    );
  }

  const cantidadActual = parseFloat(rollo.cantidadActual);
  const cantidadInicial = parseFloat(rollo.cantidadInicial);
  const isDeducted = cantidadActual < cantidadInicial;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/inventario" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a inventario
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-t-4 border-t-primary">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl font-bold text-sidebar flex items-center gap-2 mb-2">
                    {rollo.telaProducto} <span className="text-muted-foreground font-normal">/</span> {rollo.colorProducto}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-mono bg-muted/50 px-2 py-0.5 rounded border">SKU: {rollo.skuProducto}</span>
                    <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {rollo.nombreUbicacion}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-sm bg-background">
                  {rollo.estado}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-y">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Cantidad Actual</div>
                  <div className="text-3xl font-bold tracking-tight text-foreground">
                    {cantidadActual.toFixed(2)} <span className="text-base font-normal text-muted-foreground">{rollo.unidadProducto}</span>
                  </div>
                  {isDeducted && (
                    <div className="text-xs text-muted-foreground mt-1">
                      De {cantidadInicial.toFixed(2)} originales
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Costo Total</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-500">
                    ${parseFloat(rollo.costoTotal).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${parseFloat(rollo.costoUnitario).toFixed(2)} / {rollo.unidadProducto}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Fecha de Ingreso</div>
                  <div className="text-sm font-medium">
                    {format(new Date(rollo.createdAt), "dd MMM yyyy", { locale: es })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Notas</div>
                  <div className="text-sm font-medium italic">
                    {rollo.notas || "Sin notas"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="flex flex-col items-center bg-white p-6 shadow-sm">
              <div className="bg-white border rounded-xl overflow-hidden p-2 shadow-sm mb-4">
                <QRCodeSVG 
                  value={`${rollo.skuProducto}-${rollo.serie}`} 
                  size={140} 
                  level="Q" 
                  includeMargin={true} 
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              <div className="font-mono text-xl tracking-widest font-bold text-black mb-4">
                {rollo.serie}
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link href={`/inventario/rollos/${rollo.id}/etiqueta`}>
                  <Printer className="w-4 h-4 mr-2" />
                  Reimprimir Etiqueta
                </Link>
              </Button>
            </Card>
            
            <Card className="bg-muted/10 border-dashed">
              <CardContent className="p-6 text-center space-y-2">
                <Box className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-foreground">Estado Operativo</h3>
                <p className="text-sm text-muted-foreground">
                  El rollo está marcado como <strong>{rollo.estado}</strong> y {isDeducted ? "ha tenido salidas parciales" : "está intacto"}.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Historial de Movimientos
            </CardTitle>
            <CardDescription>
              Trazabilidad completa desde el alta hasta el estado actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rollo.historial.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No hay movimientos registrados.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Saldo Posterior</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rollo.historial.map((mov) => {
                    const isPositive = ['ALTA', 'RECEPCION', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_POSITIVO'].includes(mov.tipo);
                    const isNegative = ['VENTA', 'TRANSFERENCIA_SALIDA', 'SALIDA_MOSTRADOR', 'AJUSTE_NEGATIVO', 'CANCELACION'].includes(mov.tipo);
                    return (
                      <TableRow key={mov.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {format(new Date(mov.createdAt), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"} className="text-[10px]">
                            {mov.tipo.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{mov.nombreUbicacion}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {isPositive ? '+' : isNegative ? '-' : ''}{parseFloat(mov.cantidad).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {parseFloat(mov.saldoPosterior).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={mov.justificacion || mov.documentoId || ''}>
                          {mov.documentoTipo && `${mov.documentoTipo} ${mov.documentoId || ''} `}
                          {mov.justificacion}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
