import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useCreateContenedor,
  useGetCatalogosContenedores,
  getGetCatalogosContenedoresQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  getListContenedoresQueryKey,
  getGetResumenContenedoresQueryKey,
  getListContenedoresDisponiblesEntradaQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ProductCombobox } from "@/components/product-combobox";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Ship, Info } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatNumber } from "@workspace/number-format";

interface LineaForm {
  productoId: string;
  cantidadEsperada: string;
  rollosEsperados: string;
  nota: string;
}

export default function ContenedorNuevo() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  
  const { data: catalogos } = useGetCatalogosContenedores({
    query: { queryKey: getGetCatalogosContenedoresQueryKey() }
  });

  const createContenedor = useCreateContenedor();

  // Header State
  const [proveedorId, setProveedorId] = useState<string>("");
  const [sitioDestinoId, setSitioDestinoId] = useState<string>("");
  const [fechaEstimadaLlegada, setFechaEstimadaLlegada] = useState<string>("");
  const [fechaPedido, setFechaPedido] = useState<string>("");
  const [referencia, setReferencia] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  // Lines State
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  
  // Current Line Input State
  const [curProductoId, setCurProductoId] = useState<string>("");
  const [curCantidad, setCurCantidad] = useState<string>("");
  const [curRollos, setCurRollos] = useState<string>("");
  const [curNota, setCurNota] = useState<string>("");

  const addLine = () => {
    if (!curProductoId) {
      toast.error("Selecciona un producto");
      return;
    }
    const cant = parseFloat(curCantidad);
    if (isNaN(cant) || cant <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }
    const rollos = curRollos ? parseInt(curRollos, 10) : null;
    if (curRollos && (isNaN(rollos!) || rollos! < 0)) {
      toast.error("Los rollos esperados deben ser un número positivo");
      return;
    }

    // Check duplicates
    if (lineas.some(l => l.productoId === curProductoId)) {
      toast.error("Este producto ya está en la lista de contenedor");
      return;
    }

    setLineas([...lineas, {
      productoId: curProductoId,
      cantidadEsperada: cant.toString(),
      rollosEsperados: rollos !== null ? rollos.toString() : "",
      nota: curNota
    }]);

    setCurProductoId("");
    setCurCantidad("");
    setCurRollos("");
    setCurNota("");
  };

  const removeLine = (index: number) => {
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!proveedorId) { toast.error("Selecciona un proveedor"); return; }
    if (!sitioDestinoId) { toast.error("Selecciona un sitio destino"); return; }
    if (!fechaEstimadaLlegada) { toast.error("Indica la fecha estimada de llegada"); return; }
    if (lineas.length === 0) { toast.error("Agrega al menos un producto al contenedor"); return; }
    const productIds = new Set();
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.productoId) { toast.error(`Selecciona un producto en la línea ${i + 1}`); return; }
      if (!l.cantidadEsperada || parseFloat(l.cantidadEsperada) <= 0) { toast.error(`La cantidad debe ser mayor a cero en la línea ${i + 1}`); return; }
      if (productIds.has(l.productoId)) { toast.error(`El producto está duplicado en la lista (Línea ${i + 1})`); return; }
      productIds.add(l.productoId);
    }


    createContenedor.mutate({
      data: {
        proveedorId: Number(proveedorId),
        sitioDestinoId: Number(sitioDestinoId),
        fechaEstimadaLlegada,
        fechaPedido: fechaPedido || null,
        referencia: referencia || null,
        notas: notas || null,
        lineas: lineas.map(l => ({
          productoId: Number(l.productoId),
          cantidadEsperada: l.cantidadEsperada,
          rollosEsperados: l.rollosEsperados ? Number(l.rollosEsperados) : null,
          nota: l.nota || null
        }))
      }
    }, {
      onSuccess: (data) => {
        toast.success("Contenedor programado correctamente");
        queryClient.invalidateQueries({ queryKey: getListContenedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetResumenContenedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContenedoresDisponiblesEntradaQueryKey() });
        setLocation(`/contenedores/${data.id}`);
      },
      onError: () => {
        toast.error("Error al guardar el contenedor. Verifica los datos.");
      }
    });
  };

  
  const isFormValid = proveedorId && sitioDestinoId && fechaEstimadaLlegada && lineas.length > 0;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0 hidden md:flex">
              <Link href="/contenedores"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-sidebar">Programar Contenedor</h1>
              <p className="text-muted-foreground mt-1">Registra un nuevo embarque esperado en tránsito.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="hidden sm:flex">
              <Link href="/contenedores">Cancelar</Link>
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!isFormValid || createContenedor.isPending}
              className="bg-sidebar hover:bg-sidebar/90"
            >
              <Save className="w-4 h-4 mr-2" />
              Programar Embarque
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Ship className="w-5 h-5 opacity-70" />
                  Información del Embarque
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Proveedor <span className="text-destructive">*</span></Label>
                    <Select value={proveedorId} onValueChange={setProveedorId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecciona proveedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogos?.proveedores.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sitio Destino <span className="text-destructive">*</span></Label>
                    <Select value={sitioDestinoId} onValueChange={setSitioDestinoId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecciona sitio..." />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogos?.sitios.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Estimada de Llegada <span className="text-destructive">*</span></Label>
                    <Input type="date" value={fechaEstimadaLlegada} onChange={e => setFechaEstimadaLlegada(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Pedido</Label>
                    <Input type="date" value={fechaPedido} onChange={e => setFechaPedido(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Referencia / BL / Tracking</Label>
                    <Input placeholder="Ej. BL-489201" value={referencia} onChange={e => setReferencia(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                <CardTitle className="text-lg">Productos Esperados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 border-b bg-sidebar/5 flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Define los productos y cantidades a recibir.</p>
                  <Button onClick={() => setLineas([...lineas, { productoId: "", cantidadEsperada: "", rollosEsperados: "", nota: "" }])} className="bg-sidebar hover:bg-sidebar/90" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Producto
                  </Button>
                </div>
                <div className="overflow-x-auto custom-scrollbar min-h-[150px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold w-[40%]">Producto</TableHead>
                        <TableHead className="font-semibold w-[20%]">Cantidad</TableHead>
                        <TableHead className="font-semibold w-[15%]">Rollos</TableHead>
                        <TableHead className="font-semibold w-[25%]">Nota</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground h-32">
                            No hay productos agregados.
                          </TableCell>
                        </TableRow>
                      ) : lineas.map((linea, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="align-top pt-3">
                            <ProductCombobox 
                              products={(catalogos?.productos as any) || []}
                              value={linea.productoId}
                              onValueChange={v => {
                                const newLineas = [...lineas];
                                newLineas[idx].productoId = v;
                                setLineas(newLineas);
                              }}
                              placeholder="Producto..."
                            />
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <Input 
                              type="number" min="0.1" step="0.1" 
                              value={linea.cantidadEsperada} 
                              onChange={e => {
                                const newLineas = [...lineas];
                                newLineas[idx].cantidadEsperada = e.target.value;
                                setLineas(newLineas);
                              }} 
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <Input 
                              type="number" min="1" step="1" 
                              value={linea.rollosEsperados} 
                              onChange={e => {
                                const newLineas = [...lineas];
                                newLineas[idx].rollosEsperados = e.target.value;
                                setLineas(newLineas);
                              }} 
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell className="align-top pt-3">
                            <Input 
                              placeholder="Nota..." 
                              value={linea.nota || ""} 
                              onChange={e => {
                                const newLineas = [...lineas];
                                newLineas[idx].nota = e.target.value;
                                setLineas(newLineas);
                              }} 
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell className="align-top pt-3 text-right">
                            <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 w-9">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                <CardTitle className="text-lg">Notas del Embarque</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Textarea 
                  placeholder="Instrucciones de descarga, comentarios del proveedor..." 
                  className="min-h-[120px] resize-none"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                />
              </CardContent>
            </Card>

            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 flex gap-3 text-sm text-blue-800 dark:text-blue-300">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                Los contenedores programados aparecerán como "En Tránsito". Cuando la mercancía llegue, podrás seleccionarlo desde el módulo de <strong>Entradas</strong> para ingresar el inventario real y conciliar diferencias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}