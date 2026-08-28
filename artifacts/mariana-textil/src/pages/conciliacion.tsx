import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { ProductCombobox } from "@/components/product-combobox";
import {
  useGetConciliacion,
  useRecalcularExistencias,
  getGetConciliacionQueryKey,
  useListProductos,
  useListLocations
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, CheckCircle2, RefreshCw, Filter, AlertTriangle } from "lucide-react";
import { formatNumber } from "@workspace/number-format";

function quantityDifference(
  movimientos: string | number,
  cache: string | number,
) {
  return (
    Math.round((Number(movimientos) - Number(cache)) * 1_000) / 1_000
  );
}

export default function Conciliacion() {
  const queryClient = useQueryClient();
  const [productoId, setProductoId] = useState<string>("all");
  const [ubicacionId, setUbicacionId] = useState<string>("all");

  const { data: productos } = useListProductos();
  const { data: ubicaciones } = useListLocations();

  const { data: conciliaciones, isLoading } = useGetConciliacion({
    productoId: productoId !== "all" ? Number(productoId) : undefined,
    ubicacionId: ubicacionId !== "all" ? Number(ubicacionId) : undefined
  });

  const recalcular = useRecalcularExistencias();
  const combinacionesVerificadas = conciliaciones?.length ?? 0;
  const discrepancias =
    conciliaciones?.filter((row) => row.discrepancia) ?? [];

  const handleRecalcular = (pId: number, uId: number) => {
    recalcular.mutate({
      data: {
        productoId: pId,
        ubicacionId: uId
      }
    }, {
      onSuccess: () => {
        toast.success("Existencias recalculadas correctamente");
        queryClient.invalidateQueries({ queryKey: getGetConciliacionQueryKey() });
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Error al recalcular";
        toast.error("Error", { description: msg });
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Conciliación de Kardex</h1>
          <p className="text-muted-foreground mt-1">
            Verifica la integridad de las existencias contra el kardex de movimientos. La consulta global incluye sitios inactivos con historial o existencias.
          </p>
        </div>

        <Card className="bg-muted/10">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" /> Producto
              </label>
              <ProductCombobox
                products={productos ?? []}
                value={productoId === "all" ? "" : productoId}
                onValueChange={(next) => setProductoId(next || "all")}
                placeholder="Todos los productos; escribe para filtrar..."
                testId="input-conciliacion-producto"
                activeOnly={false}
              />
            </div>

            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" /> Sitio
              </label>
              <Select value={ubicacionId} onValueChange={setUbicacionId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Todos los sitios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los sitios</SelectItem>
                  {ubicaciones?.filter(u => u.activa).map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="h-64 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 opacity-50" />
              <p>Analizando integridad de datos...</p>
            </CardContent>
          </Card>
        ) : discrepancias.length === 0 ? (
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                Sin discrepancias
              </h2>
              <p className="text-emerald-800 dark:text-emerald-300 max-w-md mx-auto font-medium">
                Sin discrepancias. Las existencias coinciden con el kardex.
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                {formatNumber(combinacionesVerificadas, { kind: "count" })} combinaciones de producto y sitio verificadas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/50">
            <CardHeader className="bg-destructive/5 border-b">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-6 h-6" />
                Discrepancias Encontradas
              </CardTitle>
              <CardDescription>
                {formatNumber(discrepancias.length, { kind: "count" })} discrepancias en{" "}
                {formatNumber(combinacionesVerificadas, { kind: "count" })} combinaciones de producto y sitio verificadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto ID</TableHead>
                    <TableHead>Sitio</TableHead>
                    <TableHead className="text-right">Movimientos (Real)</TableHead>
                    <TableHead className="text-right">Caché (Actual)</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-right">Rollos (Mov/Caché)</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discrepancias.map((row) => {
                    const cantMov = Number(row.cantidadMovimientos);
                    const cantCach = Number(row.cantidadCache);
                    const diferencia = quantityDifference(cantMov, cantCach);
                    const cantDiff = diferencia !== 0;
                    const rollDiff = row.rollosMovimientos !== row.rollosCache;

                    return (
                      <TableRow key={`${row.productoId}:${row.ubicacionId}`} className="bg-destructive/5">
                        <TableCell className="font-mono font-medium">{row.productoId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{row.ubicacionNombre}</span>
                            {!row.ubicacionActiva && (
                              <Badge variant="secondary">Inactiva</Badge>
                            )}
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            ID {row.ubicacionId}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${cantDiff ? 'font-bold' : ''}`}>
                           {formatNumber(cantMov, { kind: "quantity" })}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${cantDiff ? 'text-destructive font-bold' : ''}`}>
                           {formatNumber(cantCach, { kind: "quantity" })}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${cantDiff ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                          {formatNumber(diferencia, { kind: "quantity" })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                           <span className={rollDiff ? '' : 'text-muted-foreground'}>{formatNumber(row.rollosMovimientos, { kind: "count" })}</span>
                          <span className="text-muted-foreground mx-1">/</span>
                           <span className={rollDiff ? 'text-destructive font-bold' : 'text-muted-foreground'}>{formatNumber(row.rollosCache, { kind: "count" })}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-primary"
                            onClick={() => handleRecalcular(row.productoId, row.ubicacionId)}
                            disabled={recalcular.isPending}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${recalcular.isPending ? 'animate-spin' : ''}`} />
                            Recalcular
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
