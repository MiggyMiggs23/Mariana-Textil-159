import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { ProductCombobox } from "@/components/product-combobox";
import { 
  useListProductos, 
  useListLocations, 
  useListProveedores, 
  useCrearEntrada,
  useGetCurrentUser,
  getListProductosQueryKey,
  getListLocationsQueryKey,
  getListProveedoresQueryKey,
  getGetCurrentUserQueryKey,
  getListEntradasQueryKey,
  getGetDashboardQueryKey,
  getListRollosQueryKey,
  getGetExistenciasQueryKey,
  useGetFechaServidor,
  getGetFechaServidorQueryKey,
  Role,
  EntradaDetail
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowDownToLine, CheckCircle2, Box, X, Calculator, Printer, FileText, ChevronDown, ChevronRight, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api-error";

type DraftLinea = {
  id: string;
  productoId: string;
  productoName: string;
  productoSKU: string;
  productoUnidad: string;
  costoUnitario: string;
  declaredCount: number;
  cantidades: string[];
};

const isValidUnitCost = (value: string): boolean => {
  const parsed = Number(value);
  return (
    value.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed > 0 &&
    Number(parsed.toFixed(2)) > 0
  );
};

export default function Entradas() {
  const queryClient = useQueryClient();

  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const {
    data: productos,
    isError: productosFailed,
  } = useListProductos({ query: { queryKey: getListProductosQueryKey() } });
  const {
    data: ubicaciones,
    isError: ubicacionesFailed,
  } = useListLocations({
    query: { 
      enabled: user?.rol === Role.ADMIN,
      queryKey: getListLocationsQueryKey() 
    } 
  });
  const {
    data: proveedores,
    isError: proveedoresFailed,
  } = useListProveedores({ query: { queryKey: getListProveedoresQueryKey() } });
  const {
    data: serverTime,
    isError: serverTimeFailed,
  } = useGetFechaServidor({
    query: {
      queryKey: getGetFechaServidorQueryKey(),
      refetchInterval: 60_000,
    },
  });
  
  const crearEntrada = useCrearEntrada();

  // General data (draft wide)
  const [uuidCliente, setUuidCliente] = useState(() => crypto.randomUUID());
  
  // Detalle del artículo state (form state)
  const [productoId, setProductoId] = useState<string>("");
  const [costoUnitario, setCostoUnitario] = useState<string>("");
  const [declaredCount, setDeclaredCount] = useState<string>("");
  const [ubicacionId, setUbicacionId] = useState<string>("");
  const [proveedorId, setProveedorId] = useState<string>("none");
  const [observaciones, setObservaciones] = useState<string>("");

  const [lineas, setLineas] = useState<DraftLinea[]>([]);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  
  // Printing preferences
  const [autoPrintDoc, setAutoPrintDoc] = useState(true);
  const [autoPrintLabels, setAutoPrintLabels] = useState(true);

  // Modals state
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  
  // Capture state
  const [capDraftId, setCapDraftId] = useState("");
  const [capCantidades, setCapCantidades] = useState<string[]>([]);
  const [capCurrentQty, setCapCurrentQty] = useState("");
  const [editingQtyIndex, setEditingQtyIndex] = useState<number | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState("");
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [uniformQty, setUniformQty] = useState("");
  const [uniformBaseline, setUniformBaseline] = useState<string | null>(null);
  
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [resultado, setResult] = useState<EntradaDetail | null>(null);

  const selectedProduct = productos?.find(p => p.id.toString() === productoId);
  const serverDateLabel = serverTime
    ? new Intl.DateTimeFormat("es-MX", {
        dateStyle: "long",
        timeStyle: "medium",
        timeZone: serverTime.zonaHoraria,
      }).format(new Date(serverTime.fecha))
    : "Consultando hora del servidor…";

  // Set default location for non-admin
  useEffect(() => {
    if (user && user.rol !== Role.ADMIN && user.ubicacion) {
      setUbicacionId(user.ubicacion.id.toString());
    }
  }, [user]);

  // Focus input when capture modal opens
  useEffect(() => {
    if (isCaptureModalOpen) {
      setTimeout(() => qtyInputRef.current?.focus(), 100);
    }
  }, [isCaptureModalOpen]);

  const handleStartCapture = () => {
    if (!productoId || !declaredCount || Number(declaredCount) <= 0 || !ubicacionId) {
      toast.error("Por favor completa todos los campos obligatorios (*)");
      return;
    }
    if (!isValidUnitCost(costoUnitario)) {
      toast.error("El costo unitario debe ser mayor a cero.");
      return;
    }
    
    setCapDraftId(crypto.randomUUID());
    setCapCantidades([]);
    setCapCurrentQty("");
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setIsEditingLine(false);
    setUniformQty("");
    setUniformBaseline(null);
    setIsCaptureModalOpen(true);
  };

  const handleEditLine = (linea: DraftLinea) => {
    setProductoId(linea.productoId);
    setCostoUnitario(linea.costoUnitario);
    setDeclaredCount(linea.declaredCount.toString());
    setCapDraftId(linea.id);
    setCapCantidades([...linea.cantidades]);
    setCapCurrentQty("");
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setIsEditingLine(true);
    setUniformQty("");
    setUniformBaseline(null);
    setIsCaptureModalOpen(true);
  };

  const handleApplyUniformQty = () => {
    const parsed = Number(uniformQty);
    const declared = Number(declaredCount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("La cantidad uniforme debe ser mayor que cero");
      return;
    }
    if (!Number.isInteger(declared) || declared <= 0) {
      toast.error("Indica primero una cantidad válida de rollos");
      return;
    }
    if (
      capCantidades.length > 0 &&
      !window.confirm(
        "Ya hay rollos capturados. Aplicar el valor uniforme sobrescribirá esas cantidades. ¿Deseas continuar?",
      )
    ) {
      return;
    }

    setCapCantidades(Array.from({ length: declared }, () => uniformQty));
    setUniformBaseline(uniformQty);
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    toast.success(`Se aplicó ${uniformQty} a ${declared} rollos`);
  };

  const handleAddQty = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = parseFloat(capCurrentQty);
    if (!isNaN(val) && val > 0) {
      setCapCantidades([...capCantidades, capCurrentQty]);
      setCapCurrentQty("");
      qtyInputRef.current?.focus();
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'DEL') {
      setCapCurrentQty(prev => prev.slice(0, -1));
    } else if (val === 'ENTER') {
      handleAddQty();
    } else {
      setCapCurrentQty(prev => prev + val);
    }
    qtyInputRef.current?.focus();
  };

  const handleRemoveCapturedQty = (idx: number) => {
    setCapCantidades(prev => prev.filter((_, i) => i !== idx));
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    qtyInputRef.current?.focus();
  };

  const handleStartEditCapturedQty = (idx: number) => {
    setEditingQtyIndex(idx);
    setEditingQtyValue(capCantidades[idx] ?? "");
  };

  const handleSaveCapturedQty = () => {
    if (editingQtyIndex === null) return;
    const parsed = Number(editingQtyValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("La cantidad debe ser mayor que cero");
      return;
    }
    setCapCantidades(prev =>
      prev.map((qty, idx) => idx === editingQtyIndex ? editingQtyValue : qty),
    );
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    qtyInputRef.current?.focus();
  };

  const attemptCancelCapture = () => {
    if (capCantidades.length > 0 && !isEditingLine) {
      setIsConfirmCancelOpen(true);
    } else {
      setIsCaptureModalOpen(false);
    }
  };

  const handleConfirmCapture = (forceReduce = false) => {
    const declared = Number(declaredCount);
    if (!isValidUnitCost(costoUnitario)) {
      toast.error("El costo unitario debe ser mayor a cero.");
      return;
    }
    if (!forceReduce && capCantidades.length < declared) {
      toast.error(`Faltan capturar ${declared - capCantidades.length} rollos`);
      return;
    }
    if (capCantidades.length > declared) {
      toast.error(`Has capturado más rollos de los declarados (${declared})`);
      return;
    }

    if (!selectedProduct) {
      toast.error("No se pudo identificar el producto seleccionado");
      return;
    }

    const newLineData: DraftLinea = {
      id: capDraftId,
      productoId: productoId,
      productoName: `${selectedProduct.tela} - ${selectedProduct.color}`,
      productoSKU: selectedProduct.sku,
      productoUnidad: selectedProduct.unidad,
      costoUnitario: costoUnitario,
      declaredCount: forceReduce ? capCantidades.length : declared,
      cantidades: capCantidades
    };

    if (isEditingLine) {
      setLineas(prev => prev.map(l => l.id === capDraftId ? newLineData : l));
      toast.success("Línea actualizada");
    } else {
      setLineas(prev => [...prev, newLineData]);
      toast.success("Línea agregada a la lista");
      // Reset only line specific fields, keep location/provider/date/notes
      setProductoId("");
      setCostoUnitario("");
      setDeclaredCount("");
    }
    
    setIsCaptureModalOpen(false);
  };

  const handleRemoveLinea = (id: string) => {
    if (window.confirm("¿Seguro que deseas eliminar esta línea de la entrada?")) {
      setLineas(prev => prev.filter(l => l.id !== id));
      setSelectedLines(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleSelectLine = (id: string) => {
    setSelectedLines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLines.size === lineas.length) {
      setSelectedLines(new Set());
    } else {
      setSelectedLines(new Set(lineas.map(l => l.id)));
    }
  };

  const toggleExpandLine = (id: string) => {
    setExpandedLines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const discardWholeDraft = () => {
    if (lineas.length === 0 || window.confirm("¿Seguro que deseas cancelar toda la entrada? Se perderá todo lo capturado.")) {
      setLineas([]);
      setProductoId("");
      setCostoUnitario("");
      setDeclaredCount("");
      setUuidCliente(crypto.randomUUID());
    }
  };

  const totalRollos = lineas.reduce((acc, l) => acc + l.cantidades.length, 0);
  const totalQtyGeneral = lineas.reduce((acc, l) => acc + l.cantidades.reduce((a, b) => a + parseFloat(b), 0), 0);
  const totalCostoGeneral = lineas.reduce((acc, l) => {
    const qtySum = l.cantidades.reduce((qAcc, q) => qAcc + parseFloat(q), 0);
    return acc + (qtySum * parseFloat(l.costoUnitario));
  }, 0);

  const isFormValid = ubicacionId && lineas.length > 0;

  const handleSubmit = () => {
    if (!isFormValid) {
      toast.error("La entrada está incompleta", {
        description: "Selecciona una ubicación y agrega al menos una línea.",
      });
      return;
    }
    if (lineas.some((linea) => !isValidUnitCost(linea.costoUnitario))) {
      toast.error("El costo unitario debe ser mayor a cero.");
      return;
    }

    crearEntrada.mutate({
      data: {
        ubicacionId: Number(ubicacionId),
        proveedorId: proveedorId === "none" ? undefined : Number(proveedorId),
        observaciones: observaciones || null,
        uuidCliente,
        lineas: lineas.map(l => ({
          productoId: Number(l.productoId),
          costoUnitario: l.costoUnitario,
          cantidades: l.cantidades
        }))
      }
    }, {
      onSuccess: (data) => {
        toast.success("Entrada registrada correctamente");
        setResult(data);
        
        queryClient.invalidateQueries({ queryKey: getListEntradasQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetExistenciasQueryKey() });
        
        const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
        if (autoPrintDoc) {
          window.open(`${baseUrl}/entradas/${data.id}/documento`, '_blank');
        }
        if (autoPrintLabels) {
          window.open(`${baseUrl}/entradas/${data.id}/etiquetas`, '_blank');
        }
      },
      onError: (err: unknown) => {
        const msg = getApiErrorMessage(err, "Error al procesar la entrada");
        toast.error("Error", { description: msg });
      }
    });
  };

  if (resultado) {
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
            <CardHeader className="text-center pb-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">Entrada Completada</CardTitle>
              <CardDescription>Folio #{resultado.folio.toString().padStart(6, '0')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-md border p-6 flex justify-around items-center text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Total Rollos</div>
                  <div className="text-2xl font-bold">{resultado.totalRollos}</div>
                </div>
                <div className="w-px h-12 bg-border"></div>
                <div>
                  <div className="text-sm text-muted-foreground">Costo Total</div>
                  <div className="text-2xl font-bold text-emerald-600">${parseFloat(resultado.totalCosto).toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-center gap-4 pt-4">
              <Button variant="outline" onClick={() => window.open(`${baseUrl}/entradas/${resultado.id}/documento`, '_blank')}>
                <FileText className="w-4 h-4 mr-2" /> Documento
              </Button>
              <Button variant="outline" onClick={() => window.open(`${baseUrl}/entradas/${resultado.id}/etiquetas`, '_blank')}>
                <Printer className="w-4 h-4 mr-2" /> Etiquetas
              </Button>
              <Button onClick={() => {
                setResult(null);
                setLineas([]);
                setProductoId("");
                setCostoUnitario("");
                setDeclaredCount("");
                setUuidCliente(crypto.randomUUID());
              }}>Nueva Entrada</Button>
            </CardFooter>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-32">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">ENTRADA</h1>
          <p className="text-muted-foreground mt-1">Registra la mercancía que llega a una ubicación. Cada rollo se da de alta con su cantidad propia y su número de serie.</p>
        </div>

        {(productosFailed ||
          proveedoresFailed ||
          serverTimeFailed ||
          (user?.rol === Role.ADMIN && ubicacionesFailed)) && (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            role="alert"
          >
            <p className="font-semibold">No se pudieron cargar todos los datos de la entrada.</p>
            <p className="mt-1">
              Recarga la página antes de continuar; los catálogos incompletos no se mostrarán como listas vacías.
            </p>
          </div>
        )}

        <Card className="border-t-4 border-t-primary shadow-sm">
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg">Detalle del artículo</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                
                <div className="space-y-2">
                  <Label>Producto <span className="text-destructive">*</span></Label>
                  <ProductCombobox
                    products={productos ?? []}
                    value={productoId}
                    onValueChange={setProductoId}
                    placeholder="Escribe tela, color o SKU..."
                    testId="input-entrada-producto"
                  />
                  <p className="text-xs text-muted-foreground">
                    Busca al instante; usa ↑ ↓ y Enter para seleccionar.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={selectedProduct?.sku || ""} readOnly className="bg-muted text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <Label>Cantidad de rollos <span className="text-destructive">*</span></Label>
                  <Input 
                    type="number" 
                    min="1"
                    value={declaredCount} 
                    onChange={e => setDeclaredCount(e.target.value)} 
                    data-testid="input-declared"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Costo por {selectedProduct?.unidad?.toLowerCase() ?? "metro o kilo"} <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input 
                      type="number" 
                      min="0.01"
                      step="0.01" 
                      className="pl-7" 
                      value={costoUnitario} 
                      onChange={e => setCostoUnitario(e.target.value)}
                      data-testid="input-costo-unitario"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Fecha y hora de entrada</Label>
                  <Input
                    value={serverDateLabel}
                    readOnly
                    className="bg-muted text-muted-foreground"
                    data-testid="input-fecha-servidor"
                  />
                  <p className="text-xs text-muted-foreground">
                    Fijada por el servidor · America/Mexico_City
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Ubicación <span className="text-destructive">*</span></Label>
                  {user?.rol === Role.ADMIN ? (
                    <Select value={ubicacionId} onValueChange={setUbicacionId}>
                      <SelectTrigger data-testid="select-entrada-ubicacion">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ubicaciones?.filter(u => u.activa).map(u => (
                          <SelectItem key={u.id} value={u.id.toString()}>{u.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={user?.ubicacion?.nombre || ""} readOnly className="bg-muted text-muted-foreground" />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={proveedorId} onValueChange={setProveedorId}>
                    <SelectTrigger data-testid="select-entrada-proveedor">
                      <SelectValue placeholder="Sin proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {proveedores?.items.filter(p => p.activo).map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Notas</Label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Referencia de factura, pedimento, etc."
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                  />
                </div>
              </div>

              {/* Readonly preview container */}
              <div className="bg-muted/30 border rounded-md flex flex-col h-[400px]">
                <div className="p-3 border-b bg-muted/50 font-semibold text-sm">
                  Cantidad por rollo (Previsualización)
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
                  {declaredCount && Number(declaredCount) > 0 ? (
                     Array.from({ length: Number(declaredCount) }).map((_, i) => (
                       <div key={i} className="flex justify-between items-center p-2 text-sm border rounded bg-background shadow-sm opacity-50">
                         <span className="font-mono text-xs w-6">{i+1}.</span>
                         <span>Pendiente</span>
                         <span className="text-xs text-muted-foreground italic">Serie por asignar</span>
                       </div>
                     ))
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                      Ingresa la cantidad de rollos para ver la previsualización.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-4 flex justify-end">
            <Button onClick={handleStartCapture} data-testid="btn-add-line">
              <Plus className="w-4 h-4 mr-2" /> Agregar a la lista
            </Button>
          </CardFooter>
        </Card>

        {/* Master Table */}
        <div className="border rounded-md shadow-sm overflow-hidden bg-white">
          <div className="p-4 bg-white flex justify-between items-center border-b">
            <h2 className="font-bold text-lg">Lista de Entrada</h2>
            <Button variant="outline" size="sm" onClick={() => setMostrarFiltros(!mostrarFiltros)}>
              Mostrar filtros
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1e3a8a] hover:bg-[#1e3a8a]">
                  <TableHead className="w-12 text-white">
                    <Checkbox 
                      checked={lineas.length > 0 && selectedLines.size === lineas.length} 
                      onCheckedChange={toggleSelectAll} 
                      className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#1e3a8a]"
                    />
                  </TableHead>
                  <TableHead className="text-white">Producto</TableHead>
                  <TableHead className="text-white">SKU</TableHead>
                  <TableHead className="text-white">Ubicación</TableHead>
                  <TableHead className="text-right text-white">Rollos</TableHead>
                  <TableHead className="text-white">Unidad</TableHead>
                  <TableHead className="text-right text-white">Cantidad total</TableHead>
                  <TableHead className="text-right text-white">Costo por metro / kilo</TableHead>
                  <TableHead className="text-right text-white">Costo total</TableHead>
                  <TableHead className="text-center text-white">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      Aún no has agregado productos a esta entrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  lineas.map((linea) => {
                    const isExpanded = expandedLines.has(linea.id);
                    const qtySum = linea.cantidades.reduce((a, b) => a + parseFloat(b), 0);
                    const costSum = qtySum * parseFloat(linea.costoUnitario);
                    const isSelected = selectedLines.has(linea.id);
                    const ubiName = ubicaciones?.find(u => u.id.toString() === ubicacionId)?.nombre || user?.ubicacion?.nombre || "";

                    return (
                      <React.Fragment key={linea.id}>
                        <TableRow className={isSelected ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Checkbox 
                              checked={isSelected} 
                              onCheckedChange={() => toggleSelectLine(linea.id)} 
                            />
                          </TableCell>
                          <TableCell className="font-bold">{linea.productoName}</TableCell>
                          <TableCell className="font-mono text-xs">{linea.productoSKU}</TableCell>
                          <TableCell>{ubiName}</TableCell>
                          <TableCell className="text-right font-bold">{linea.cantidades.length}</TableCell>
                          <TableCell>{linea.productoUnidad}</TableCell>
                          <TableCell className="text-right font-medium">{qtySum.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            ${parseFloat(linea.costoUnitario).toFixed(2)} / {linea.productoUnidad.toLowerCase()}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">${costSum.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditLine(linea)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveLinea(linea.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpandLine(linea.id)}>
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={10} className="p-0 border-b">
                              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm bg-muted/10 inset-shadow-sm">
                                {linea.cantidades.map((q, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-white p-2 border rounded shadow-sm">
                                    <span className="font-mono text-xs font-bold text-muted-foreground w-6">{idx+1}.</span>
                                    <span className="font-bold">{q} {linea.productoUnidad}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">Serie por asignar</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
                
                {lineas.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell colSpan={4} className="text-right text-lg">TOTAL GENERAL:</TableCell>
                    <TableCell className="text-right text-lg">{totalRollos}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-lg">{totalQtyGeneral.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-lg text-emerald-700">${totalCostoGeneral.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Fixed Footer Bar */}
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-30 md:pl-64 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center space-x-2">
              <Checkbox id="printDoc" checked={autoPrintDoc} onCheckedChange={(c) => setAutoPrintDoc(c as boolean)} />
              <label htmlFor="printDoc" className="font-medium cursor-pointer">Imprimir Documento</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="printLabels" checked={autoPrintLabels} onCheckedChange={(c) => setAutoPrintLabels(c as boolean)} />
              <label htmlFor="printLabels" className="font-medium cursor-pointer">Imprimir Etiquetas</label>
            </div>
          </div>
          <div className="flex w-full sm:w-auto gap-3">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={discardWholeDraft}>
              Cancelar
            </Button>
            <Button 
              className="flex-1 sm:flex-none bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white shadow-md" 
              disabled={!isFormValid || crearEntrada.isPending}
              onClick={handleSubmit}
              data-testid="btn-save-entrada"
            >
              {crearEntrada.isPending ? "Guardando..." : "Guardar entrada"}
            </Button>
          </div>
        </div>
      </div>

      {/* CAPTURE MODAL */}
      <Dialog open={isCaptureModalOpen} onOpenChange={(open) => {
        if (!open) attemptCancelCapture();
      }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col h-[94vh] sm:h-[760px] shadow-2xl" onInteractOutside={(e) => {
          e.preventDefault();
          attemptCancelCapture();
        }}>
          <DialogHeader className="p-5 border-b bg-muted/20 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-bold uppercase">{selectedProduct?.tela} - {selectedProduct?.color}</DialogTitle>
                <DialogDescription className="mt-1 font-mono text-sm text-foreground/80">{selectedProduct?.sku}</DialogDescription>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="font-semibold text-foreground/70">UBICACIÓN:</span> 
                  {ubicaciones?.find(u => u.id.toString() === ubicacionId)?.nombre || user?.ubicacion?.nombre}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-primary tracking-tighter">
                  Rollo {Math.min(capCantidades.length + 1, Math.max(1, Number(declaredCount) || 1))} de {declaredCount}
                </div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">
                  {capCantidades.length} capturados
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {/* Input area */}
            <div className="p-5 shrink-0 shadow-sm z-10 bg-background border-b space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="mb-3">
                  <div className="font-bold text-sm">
                    Todos los rollos con el mismo {selectedProduct?.unidad === "KILO" ? "peso" : "metraje"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Llena los {declaredCount || "—"} rollos de una vez y después corrige únicamente las excepciones.
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={uniformQty}
                      onChange={(event) => setUniformQty(event.target.value)}
                      placeholder="0.00"
                      className="bg-background pr-14 text-lg font-bold"
                      data-testid="input-uniform-qty"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      {selectedProduct?.unidad === "METRO" ? "M" : "KG"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleApplyUniformQty}
                    disabled={!uniformQty}
                    data-testid="button-apply-uniform"
                  >
                    Aplicar a todos
                  </Button>
                </div>
              </div>

              <form onSubmit={handleAddQty} className="flex gap-3">
                <div className="relative flex-1">
                  <Input 
                    ref={qtyInputRef}
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={capCurrentQty}
                    onChange={e => setCapCurrentQty(e.target.value)}
                    className="text-4xl h-20 font-black text-center pr-16"
                    data-testid="input-capture-qty"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xl">
                    {selectedProduct?.unidad === 'METRO' ? 'M' : 'KG'}
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="h-20 px-8 bg-primary hover:bg-primary/90" 
                  disabled={!capCurrentQty || capCantidades.length >= Number(declaredCount)}
                  data-testid="button-add-captured-roll"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Siguiente rollo
                </Button>
              </form>
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/5 custom-scrollbar">
              {capCantidades.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground flex-col">
                  <Calculator className="w-16 h-16 opacity-10 mb-4" />
                  <p className="text-lg font-medium">Ingresa la cantidad del primer rollo</p>
                </div>
              ) : (
                capCantidades.map((qty, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm group transition-colors ${
                      uniformBaseline != null && Number(qty) !== Number(uniformBaseline)
                        ? "border-amber-400 bg-amber-50/60"
                        : "hover:border-primary/50"
                    }`}
                    data-testid={`row-captured-roll-${idx}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center text-xs font-mono font-bold text-muted-foreground border">
                        {idx+1}
                      </span>
                      {editingQtyIndex === idx ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editingQtyValue}
                            onChange={(event) => setEditingQtyValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleSaveCapturedQty();
                              }
                            }}
                            className="h-10 w-32 text-lg font-bold"
                            autoFocus
                            data-testid={`input-edit-roll-${idx}`}
                          />
                          <span className="text-sm font-bold text-muted-foreground">
                            {selectedProduct?.unidad === "METRO" ? "M" : "KG"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xl font-black tabular-nums">
                          {qty} <span className="text-sm font-bold text-muted-foreground">{selectedProduct?.unidad === 'METRO' ? 'M' : 'KG'}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {uniformBaseline != null && (
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-black uppercase ${
                            Number(qty) === Number(uniformBaseline)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {Number(qty) === Number(uniformBaseline) ? "Uniforme" : "Ajustado"}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded">Serie por asignar #{idx+1}</span>
                      <div className="flex gap-1">
                        {editingQtyIndex === idx ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={handleSaveCapturedQty}
                              data-testid={`btn-save-roll-${idx}`}
                            >
                              Guardar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                setEditingQtyIndex(null);
                                setEditingQtyValue("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary opacity-60 group-hover:opacity-100 hover:bg-primary/10 transition-opacity"
                            onClick={() => handleStartEditCapturedQty(idx)}
                            aria-label={`Editar cantidad del rollo ${idx + 1}`}
                            data-testid={`btn-edit-roll-${idx}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive opacity-50 group-hover:opacity-100 hover:bg-destructive/10 transition-opacity"
                          onClick={() => handleRemoveCapturedQty(idx)}
                          aria-label={`Eliminar rollo ${idx + 1}`}
                          data-testid={`btn-delete-roll-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Live Totals Row */}
            <div className="p-3 bg-primary/5 border-t shrink-0 flex justify-between items-center">
              <div className="text-sm font-bold text-primary">Subtotales al momento:</div>
              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm font-bold">
                {uniformBaseline != null && (
                  <>
                    <div className="text-emerald-700">
                      Uniformes: {capCantidades.filter((qty) => Number(qty) === Number(uniformBaseline)).length}
                    </div>
                    <div className="text-amber-700">
                      Ajustados: {capCantidades.filter((qty) => Number(qty) !== Number(uniformBaseline)).length}
                    </div>
                  </>
                )}
                <div>Qty: {capCantidades.reduce((a, b) => a + parseFloat(b), 0).toFixed(2)}</div>
                <div>$: {(capCantidades.reduce((a, b) => a + parseFloat(b), 0) * parseFloat(costoUnitario || "0")).toFixed(2)}</div>
              </div>
            </div>

            {/* Mobile Keypad */}
            <div className="sm:hidden grid grid-cols-3 gap-[1px] bg-border shrink-0">
              {['1','2','3','4','5','6','7','8','9','.','0','DEL'].map(k => (
                <Button 
                  key={k} 
                  variant="ghost"
                  className={`h-16 text-2xl font-black rounded-none bg-background hover:bg-muted ${k === 'DEL' ? 'text-destructive' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleKeypadPress(k);
                  }}
                  disabled={capCantidades.length >= Number(declaredCount) && k !== 'DEL'}
                >
                  {k}
                </Button>
              ))}
              <Button 
                className="col-span-3 h-16 text-xl font-black rounded-none bg-primary hover:bg-primary/90 text-white"
                onClick={handleAddQty}
                disabled={!capCurrentQty || capCantidades.length >= Number(declaredCount)}
              >
                SIGUIENTE ROLLO (ENTER)
              </Button>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-background shrink-0 flex-row justify-between gap-4">
            <Button variant="outline" onClick={attemptCancelCapture} className="w-1/3">
              Descartar
            </Button>
            {capCantidades.length > 0 && capCantidades.length < Number(declaredCount) ? (
              <Button variant="secondary" className="w-2/3" onClick={() => handleConfirmCapture(true)}>
                Terminar Incompleto ({capCantidades.length})
              </Button>
            ) : (
              <Button
                className="w-2/3 bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]/90 font-bold"
                onClick={() => handleConfirmCapture(false)}
                disabled={capCantidades.length !== Number(declaredCount)}
                data-testid="button-confirm-line"
              >
                {isEditingLine ? "Guardar Cambios" : "Confirmar Línea"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM CANCEL CAPTURE MODAL */}
      <Dialog open={isConfirmCancelOpen} onOpenChange={setIsConfirmCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Cancelar captura?</DialogTitle>
            <DialogDescription>
              Tienes rollos capturados que no se han guardado. Si cierras ahora, perderás el progreso de esta línea.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsConfirmCancelOpen(false)}>
              Continuar capturando
            </Button>
            <Button variant="destructive" onClick={() => {
              setIsConfirmCancelOpen(false);
              setIsCaptureModalOpen(false);
            }}>
              Sí, descartar línea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}