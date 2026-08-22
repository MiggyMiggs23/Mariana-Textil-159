import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { 
  useListProductos, 
  useListLocations, 
  useListProveedores, 
  useAltaLote,
  getListProductosQueryKey,
  getListLocationsQueryKey,
  getListProveedoresQueryKey,
  Role,
  AltaLoteResultRollosItem
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowDownToLine, CheckCircle2, Box, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Entradas() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: productos } = useListProductos();
  const { data: ubicaciones } = useListLocations();
  const { data: proveedores } = useListProveedores();
  const altaLote = useAltaLote();

  const [productoId, setProductoId] = useState<string>("");
  const [ubicacionId, setUbicacionId] = useState<string>("");
  const [proveedorId, setProveedorId] = useState<string>("none");
  const [costoUnitario, setCostoUnitario] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  const [cantidades, setCantidades] = useState<string[]>([]);
  const [currentQty, setCurrentQty] = useState<string>("");

  const [result, setResult] = useState<AltaLoteResultRollosItem[] | null>(null);

  const handleAddQty = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = parseFloat(currentQty);
    if (!isNaN(val) && val > 0) {
      setCantidades([...cantidades, currentQty]);
      setCurrentQty("");
    }
  };

  const handleRemoveLast = () => {
    setCantidades(prev => prev.slice(0, -1));
  };

  const handleRemoveIndex = (idx: number) => {
    setCantidades(prev => prev.filter((_, i) => i !== idx));
  };

  const isFormValid = productoId && ubicacionId && costoUnitario && cantidades.length > 0;

  const handleSubmit = () => {
    if (!isFormValid) return;
    altaLote.mutate({
      data: {
        productoId: Number(productoId),
        ubicacionId: Number(ubicacionId),
        proveedorId: proveedorId === "none" ? undefined : Number(proveedorId),
        costoUnitario,
        notas: notas || null,
        cantidades
      }
    }, {
      onSuccess: (data) => {
        toast.success("Lote ingresado correctamente");
        setResult(data.rollos);
        queryClient.invalidateQueries({ queryKey: getListProductosQueryKey() });
        // Don't invalidate locations/proveedores as they don't change
      },
      onError: (err: any) => {
        const msg = err?.data?.error || err?.message || "Error al procesar la entrada";
        toast.error("Error", { description: msg });
      }
    });
  };

  const resetForm = () => {
    setProductoId("");
    setUbicacionId("");
    setProveedorId("none");
    setCostoUnitario("");
    setNotas("");
    setCantidades([]);
    setResult(null);
  };

  const totalQty = cantidades.reduce((sum, q) => sum + parseFloat(q), 0);

  if (result) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
            <CardHeader className="text-center pb-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">Entrada Completada</CardTitle>
              <CardDescription>Se generaron {result.length} rollos exitosamente.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-md border p-4 max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {result.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground w-6">{i+1}.</span>
                        <div className="font-bold text-foreground tracking-tight">{r.serie}</div>
                      </div>
                      <div className="font-medium">{r.cantidadInicial}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center gap-4 pt-4">
              <Button variant="outline" onClick={resetForm}>Nueva Entrada</Button>
              <Button onClick={() => setLocation("/inventario")}>Ver Inventario</Button>
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Ingreso de Lote</h1>
          <p className="text-muted-foreground mt-2">Registra múltiples rollos en una sola operación.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5" /> Datos del Lote
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Producto</Label>
                  <Select value={productoId} onValueChange={setProductoId}>
                    <SelectTrigger data-testid="select-producto">
                      <SelectValue placeholder="Selecciona un producto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {productos?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.tela} - {p.color}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ubicación Destino</Label>
                  <Select value={ubicacionId} onValueChange={setUbicacionId}>
                    <SelectTrigger data-testid="select-ubicacion">
                      <SelectValue placeholder="Selecciona ubicación..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ubicaciones?.filter(u => u.activa).map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Proveedor (Opcional)</Label>
                  <Select value={proveedorId} onValueChange={setProveedorId}>
                    <SelectTrigger data-testid="select-proveedor">
                      <SelectValue placeholder="Sin proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {proveedores?.filter(p => p.activo).map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Costo Unitario</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input 
                      type="number" 
                      step="0.01" 
                      className="pl-7" 
                      value={costoUnitario} 
                      onChange={e => setCostoUnitario(e.target.value)} 
                      data-testid="input-costo"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas del lote (Opcional)</Label>
                <Input 
                  placeholder="Referencia de factura, pedimento, etc." 
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  data-testid="input-notas"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="border-b bg-muted/10 pb-4">
              <CardTitle className="flex justify-between items-center text-lg">
                <span className="flex items-center gap-2"><Box className="w-5 h-5" /> Rollos</span>
                <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-1 rounded-md">
                  {cantidades.length} items
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col">
              <div className="p-4 border-b bg-background">
                <form onSubmit={handleAddQty} className="flex gap-2">
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="Cantidad" 
                    value={currentQty}
                    onChange={e => setCurrentQty(e.target.value)}
                    className="font-medium"
                    data-testid="input-qty"
                    autoFocus
                  />
                  <Button type="submit" size="icon" disabled={!currentQty} data-testid="button-add-qty">
                    <Plus className="w-4 h-4" />
                  </Button>
                </form>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[300px] p-2 space-y-1 bg-muted/5 custom-scrollbar">
                {cantidades.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8">
                    <Box className="w-8 h-8 opacity-20 mb-2" />
                    <span className="text-sm">Agrega cantidades arriba</span>
                  </div>
                ) : (
                  cantidades.map((qty, idx) => (
                    <div key={idx} className="flex items-center justify-between group p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono w-4">{idx+1}.</span>
                        <span className="font-bold">{qty}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveIndex(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t bg-muted/10 mt-auto">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Total acumulado</span>
                  <span className="text-xl font-bold">{totalQty.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1" 
                    disabled={cantidades.length === 0}
                    onClick={handleRemoveLast}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deshacer
                  </Button>
                  <Button 
                    className="flex-1" 
                    disabled={!isFormValid || altaLote.isPending}
                    onClick={handleSubmit}
                    data-testid="button-submit-lote"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
