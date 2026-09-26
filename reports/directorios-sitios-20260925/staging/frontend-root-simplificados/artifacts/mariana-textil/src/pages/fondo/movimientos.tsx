import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2, Search, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFondoCurrency } from "@/lib/fondo-utils";
import { useGetFondoMovimientos, type NaturalezaFondo, type CategoriaFondo } from "@/hooks/fondo";
import { Badge } from "@/components/ui/badge";

export default function FondoMovimientos() {
  const [, setLocation] = useLocation();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [naturaleza, setNaturaleza] = useState<string>("all");
  const [categoria, setCategoria] = useState<string>("all");

  const queryParams = {
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
    ...(naturaleza !== "all" ? { naturaleza: naturaleza as NaturalezaFondo } : {}),
    ...(categoria !== "all" ? { categoria: categoria as CategoriaFondo } : {}),
  };

  const { data, isLoading, error } = useGetFondoMovimientos(queryParams);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fondo")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sidebar">Historial de Movimientos</h1>
          {data && <p className="text-muted-foreground">Saldo actual: {formatFondoCurrency(data.saldo)}</p>}
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
        <div className="space-y-1 w-[180px]">
          <label className="text-sm font-medium">Naturaleza</label>
          <Select value={naturaleza} onValueChange={setNaturaleza}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="INGRESO">Ingresos</SelectItem>
              <SelectItem value="RETIRO">Retiros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-[180px]">
          <label className="text-sm font-medium">Categoría</label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="SALDO_INICIAL">Saldo Inicial</SelectItem>
              <SelectItem value="CAPITAL">Capital</SelectItem>
              <SelectItem value="OTRO_INGRESO">Otro Ingreso</SelectItem>
              <SelectItem value="RETIRO">Retiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">Error al cargar movimientos</div>
        ) : data?.items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>No se encontraron movimientos para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Autor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((mov) => (
                  <TableRow 
                    key={mov.id} 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => setLocation(`/fondo/movimientos/${mov.id}`)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {mov.ordinal}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(mov.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {mov.naturaleza === "INGRESO" ? (
                          <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-rose-600" />
                        )}
                        <span className={mov.naturaleza === "INGRESO" ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}>
                          {mov.naturaleza}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={mov.esInverso ? "border-destructive text-destructive" : ""}>
                        {mov.categoria.replace("_", " ")}
                        {mov.esInverso && " (INVERSO)"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" title={mov.motivo}>
                      {mov.motivo}
                    </TableCell>
                    <TableCell className={`text-right font-medium whitespace-nowrap ${mov.naturaleza === "INGRESO" ? "text-emerald-700" : ""}`}>
                      {mov.naturaleza === "INGRESO" ? "+" : "-"}{formatFondoCurrency(mov.importe)}
                    </TableCell>
                    <TableCell>{mov.autor.nombre}</TableCell>
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