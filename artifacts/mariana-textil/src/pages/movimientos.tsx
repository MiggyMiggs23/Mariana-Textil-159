import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useListEntradas, 
  getListEntradasQueryKey,
  useListLocations,
  getListLocationsQueryKey,
  useListProveedores,
  Role,
  useGetCurrentUser
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Search, FileText, Printer, Box } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Movimientos() {
  const { data: user } = useGetCurrentUser();
  const { data: ubicaciones } = useListLocations({ 
    query: {
      enabled: user?.rol === Role.ADMIN,
      queryKey: getListLocationsQueryKey(),
    },
  });
  const { data: proveedores } = useListProveedores();

  const [folio, setFolio] = useState("");
  const [ubicacionId, setUbicacionId] = useState<string>("all");
  const [proveedorId, setProveedorId] = useState<string>("all");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const { data: result, isLoading } = useListEntradas({
    folio: folio ? Number(folio) : undefined,
    ubicacionId: ubicacionId !== "all" ? Number(ubicacionId) : undefined,
    proveedorId: proveedorId !== "all" ? Number(proveedorId) : undefined,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
    page: 1,
    pageSize: 100
  });

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Movimientos de Entrada</h1>
          <p className="text-muted-foreground mt-1">Historial inmutable de documentos de entrada.</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Folio</Label>
                <Input 
                  placeholder="Número de folio..." 
                  value={folio}
                  onChange={e => setFolio(e.target.value)}
                />
              </div>
              
              {user?.rol === Role.ADMIN && (
                <div className="space-y-2">
                  <Label>Ubicación</Label>
                  <Select value={ubicacionId} onValueChange={setUbicacionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {ubicaciones?.map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={proveedorId} onValueChange={setProveedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {proveedores?.items.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Desde</Label>
                <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground animate-pulse">Cargando...</div>
            ) : !result?.items || result.items.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                <Activity className="w-12 h-12 mb-3 opacity-20" />
                <p>No se encontraron documentos.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Rollos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-32 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold">
                        #{item.folio.toString().padStart(6, '0')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(item.fecha), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{item.nombreUbicacion}</TableCell>
                      <TableCell className="text-sm">{item.nombreProveedor || <span className="text-muted-foreground italic">N/A</span>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 font-bold">
                          {item.totalRollos} <Box className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                        ${parseFloat(item.totalCosto).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" asChild title="Documento PDF">
                            <a href={`/entradas/${item.id}/documento`} target="_blank" rel="noreferrer">
                              <FileText className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Etiquetas PDF">
                            <a href={`/entradas/${item.id}/etiquetas`} target="_blank" rel="noreferrer">
                              <Printer className="w-4 h-4" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}