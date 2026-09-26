import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2, Scale, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFondoCurrency } from "@/lib/fondo-utils";
import { useGetFondoArqueos } from "@/hooks/fondo";

export default function FondoArqueos() {
  const [, setLocation] = useLocation();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const queryParams = {
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
  };

  const { data, isLoading, error } = useGetFondoArqueos(queryParams);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fondo")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sidebar">Historial de Arqueos</h1>
          <p className="text-muted-foreground">Conteos físicos del fondo</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-card p-4 rounded-lg border shadow-sm">
        <div className="space-y-1">
          <label className="text-sm font-medium">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">Error al cargar arqueos</div>
        ) : data?.items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No se encontraron arqueos para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead className="text-right">Sistema</TableHead>
                  <TableHead className="text-right">Físico</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((arq) => (
                  <TableRow 
                    key={arq.id} 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => setLocation(`/fondo/arqueos/${arq.id}`)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(arq.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>{arq.autor.nombre}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatFondoCurrency(arq.saldoSistema)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFondoCurrency(arq.efectivoContado)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${
                      Number(arq.diferencia) < 0 ? "text-destructive" : 
                      Number(arq.diferencia) > 0 ? "text-emerald-600" : "text-muted-foreground"
                    }`}>
                      {Number(arq.diferencia) > 0 ? "+" : ""}
                      {formatFondoCurrency(arq.diferencia)}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}