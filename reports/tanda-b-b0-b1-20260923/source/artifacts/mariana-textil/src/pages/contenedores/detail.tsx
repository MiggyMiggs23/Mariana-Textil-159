import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useGetContenedor,
  getGetContenedorQueryKey,
  useUpdateContenedor,
  useCancelContenedor,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  EstadoContenedor,
  ContenedorLinea,
  getListContenedoresQueryKey,
  getGetResumenContenedoresQueryKey,
  getListContenedoresDisponiblesEntradaQueryKey,
  useGetCatalogosContenedores,
  getGetCatalogosContenedoresQueryKey
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCombobox } from "@/components/product-combobox";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { Ship, ArrowLeft, ArrowDownToLine, Calendar, MapPin, Truck, AlertTriangle, AlertCircle, Edit2, Ban, CheckCircle2, Save, X, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface LineaForm {
  productoId: string;
  cantidadEsperada: string;
  rollosEsperados: string;
  nota: string;
}

export default function ContenedorDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });

  const { data: catalogos } = useGetCatalogosContenedores({
    query: { queryKey: getGetCatalogosContenedoresQueryKey() }
  });

  const { data: contenedor, isLoading } = useGetContenedor(Number(id), {
    query: {
      queryKey: getGetContenedorQueryKey(Number(id)),
      enabled: !!id
    }
  });

  const updateContenedor = useUpdateContenedor();
  const cancelContenedor = useCancelContenedor();

  const [isEditing, setIsEditing] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Edit state
  const [editProveedorId, setEditProveedorId] = useState<string>("");
  const [editSitioDestinoId, setEditSitioDestinoId] = useState<string>("");
  const [editFecha, setEditFecha] = useState("");
  const [editFechaPedido, setEditFechaPedido] = useState("");
  const [editRef, setEditRef] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [editLineas, setEditLineas] = useState<LineaForm[]>([]);

  const removeLine = (index: number) => {
    setEditLineas(editLineas.filter((_, i) => i !== index));
  };

  const handleOpenEdit = () => {
    if (contenedor) {
      setEditProveedorId(contenedor.proveedorId.toString());
      setEditSitioDestinoId(contenedor.sitioDestinoId.toString());
      setEditFecha(contenedor.fechaEstimadaLlegada);
      setEditFechaPedido(contenedor.fechaPedido || "");
      setEditRef(contenedor.referencia || "");
      setEditNotas(contenedor.notas || "");
      setEditLineas(contenedor.lineas.map(l => ({
        productoId: l.productoId.toString(),
        cantidadEsperada: l.cantidadEsperada,
        rollosEsperados: l.rollosEsperados !== null ? l.rollosEsperados.toString() : "",
        nota: l.nota || ""
      })));
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (!contenedor) return;
    if (!editProveedorId) { toast.error("Selecciona un proveedor"); return; }
    if (!editSitioDestinoId) { toast.error("Selecciona un sitio destino"); return; }
    if (!editFecha) { toast.error("La fecha estimada es obligatoria"); return; }

    if (editLineas.length === 0) { toast.error("Agrega al menos un producto al contenedor"); return; }
    const productIds = new Set();
    for (let i = 0; i < editLineas.length; i++) {
      const l = editLineas[i];
      if (!l.productoId) { toast.error(`Selecciona un producto en la línea ${i + 1}`); return; }
      if (!l.cantidadEsperada || parseFloat(l.cantidadEsperada) <= 0) { toast.error(`La cantidad debe ser mayor a cero en la línea ${i + 1}`); return; }
      if (productIds.has(l.productoId)) { toast.error(`El producto está duplicado en la lista (Línea ${i + 1})`); return; }
      productIds.add(l.productoId);
    }

    const payload = {
      proveedorId: Number(editProveedorId),
      sitioDestinoId: Number(editSitioDestinoId),
      fechaEstimadaLlegada: editFecha,
      fechaPedido: editFechaPedido || null,
      referencia: editRef || null,
      notas: editNotas || null,
      lineas: editLineas.map(l => ({
        productoId: Number(l.productoId),
        cantidadEsperada: l.cantidadEsperada,
        rollosEsperados: l.rollosEsperados ? Number(l.rollosEsperados) : null,
        nota: l.nota || null
      }))
    };

    updateContenedor.mutate({
      id: contenedor.id,
      data: payload
    }, {
      onSuccess: () => {
        toast.success("Contenedor actualizado");
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getGetContenedorQueryKey(contenedor.id) });
        queryClient.invalidateQueries({ queryKey: getListContenedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetResumenContenedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContenedoresDisponiblesEntradaQueryKey() });
      },
      onError: () => toast.error("Error al actualizar el contenedor")
    });
  };

  const handleCancel = () => {
    if (cancelReason.length < 10) {
      toast.error("El motivo de cancelación debe tener al menos 10 caracteres");
      return;
    }
    cancelContenedor.mutate({
      id: Number(id),
      data: { motivo: cancelReason }
    }, {
      onSuccess: () => {
        toast.success("Contenedor cancelado");
        setIsCancelModalOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetContenedorQueryKey(Number(id)) });
        queryClient.invalidateQueries({ queryKey: getListContenedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetResumenContenedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListContenedoresDisponiblesEntradaQueryKey() });
      },
      onError: () => toast.error("Error al cancelar el contenedor")
    });
  };

  if (isLoading) {
    return <AppLayout><div className="flex h-[50vh] items-center justify-center"><div className="animate-pulse flex items-center gap-2"><Ship className="w-6 h-6 text-sidebar opacity-50" /></div></div></AppLayout>;
  }

  if (!contenedor) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Contenedor no encontrado</div></AppLayout>;
  }

  const isEnTransito = contenedor.estado === EstadoContenedor.EN_TRANSITO;
  const isRecibido = contenedor.estado === EstadoContenedor.RECIBIDO;
  const isCancelado = contenedor.estado === EstadoContenedor.CANCELADO;

  const isAdmin = user?.rol === "ADMIN";
  const canEdit = isEnTransito && (user?.permisos?.find(p => p.modulo === "contenedores")?.puedeEditar || isAdmin);
  const canCancel = isEnTransito && (user?.permisos?.find(p => p.modulo === "contenedores")?.puedeAutorizar || isAdmin);

  if (isEditing) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} className="shrink-0 hidden md:flex">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-sidebar">Editar Contenedor #{contenedor.folio.toString().padStart(5, '0')}</h1>
                <p className="text-muted-foreground mt-1">Modifica los detalles operativos del embarque en tránsito.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} className="hidden sm:flex">
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateContenedor.isPending}
                className="bg-sidebar hover:bg-sidebar/90"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
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
                      <Select value={editProveedorId} onValueChange={setEditProveedorId}>
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
                      <Select value={editSitioDestinoId} onValueChange={setEditSitioDestinoId}>
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
                      <Input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha de Pedido</Label>
                      <Input type="date" value={editFechaPedido} onChange={e => setEditFechaPedido(e.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Referencia / BL / Tracking</Label>
                      <Input placeholder="Ej. BL-489201" value={editRef} onChange={e => setEditRef(e.target.value)} />
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
                    <Button onClick={() => setEditLineas([...editLineas, { productoId: "", cantidadEsperada: "", rollosEsperados: "", nota: "" }])} className="bg-sidebar hover:bg-sidebar/90" size="sm">
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
                        {editLineas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground h-32">
                              No hay productos agregados.
                            </TableCell>
                          </TableRow>
                        ) : editLineas.map((linea, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="align-top pt-3">
                              <ProductCombobox
                                products={(catalogos?.productos as any) || []}
                                value={linea.productoId}
                                onValueChange={v => {
                                  const newLineas = [...editLineas];
                                  newLineas[idx].productoId = v;
                                  setEditLineas(newLineas);
                                }}
                                placeholder="Producto..."
                              />
                            </TableCell>
                            <TableCell className="align-top pt-3">
                              <Input
                                type="number" min="0.1" step="0.1"
                                value={linea.cantidadEsperada}
                                onChange={e => {
                                  const newLineas = [...editLineas];
                                  newLineas[idx].cantidadEsperada = e.target.value;
                                  setEditLineas(newLineas);
                                }}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell className="align-top pt-3">
                              <Input
                                type="number" min="1" step="1"
                                value={linea.rollosEsperados}
                                onChange={e => {
                                  const newLineas = [...editLineas];
                                  newLineas[idx].rollosEsperados = e.target.value;
                                  setEditLineas(newLineas);
                                }}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell className="align-top pt-3">
                              <Input
                                placeholder="Nota..."
                                value={linea.nota || ""}
                                onChange={e => {
                                  const newLineas = [...editLineas];
                                  newLineas[idx].nota = e.target.value;
                                  setEditLineas(newLineas);
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
                    value={editNotas}
                    onChange={e => setEditNotas(e.target.value)}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header Options */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0 hidden md:flex">
              <Link href="/contenedores"><ArrowLeft className="w-5 h-5" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-sidebar">
                  Contenedor #{contenedor.folio.toString().padStart(5, '0')}
                </h1>
                <span className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                  isEnTransito && "bg-blue-100 text-blue-700 ring-1 ring-blue-600/20",
                  isRecibido && "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20",
                  isCancelado && "bg-gray-100 text-gray-700 ring-1 ring-gray-600/20"
                )}>
                  {contenedor.estado.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" onClick={handleOpenEdit}>
                <Edit2 className="w-4 h-4 mr-2" /> Editar
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setIsCancelModalOpen(true)}>
                <Ban className="w-4 h-4 mr-2" /> Cancelar
              </Button>
            )}
            {isEnTransito && (
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link href="/entradas">
                  <ArrowDownToLine className="w-4 h-4 mr-2" /> Ingresar Mercancía
                </Link>
              </Button>
            )}
            {isRecibido && contenedor.entradaId && (
              <Button asChild variant="outline">
                <Link href={`/entradas/${contenedor.entradaId}/documento`}>
                  <ArrowDownToLine className="w-4 h-4 mr-2 opacity-50" /> Ver Entrada
                </Link>
              </Button>
            )}
          </div>
        </div>

        {isCancelado && contenedor.motivoCancelacion && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex gap-3 text-sm text-destructive">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold mb-1">Contenedor Cancelado</p>
              <p>{contenedor.motivoCancelacion}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* Detalles */}
            <Card className="shadow-sm border-border/50">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ship className="w-5 h-5 opacity-70" /> Resumen Operativo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Truck className="w-4 h-4" /> Proveedor</p>
                    <p className="font-semibold text-foreground">{contenedor.proveedor}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Destino</p>
                    <p className="font-semibold text-foreground">{contenedor.sitioDestino}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Llegada Est.</p>
                    <p className="font-semibold text-foreground">{format(parseISO(contenedor.fechaEstimadaLlegada), "d MMM yyyy", { locale: es })}</p>
                  </div>
                  {isRecibido && contenedor.fechaRealLlegada && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Llegada Real</p>
                      <p className="font-semibold text-foreground">{format(parseISO(contenedor.fechaRealLlegada), "d MMM yyyy", { locale: es })}</p>
                    </div>
                  )}
                  {contenedor.referencia && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Referencia</p>
                      <p className="font-semibold text-foreground">{contenedor.referencia}</p>
                    </div>
                  )}
                  {contenedor.fechaPedido && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Pedido</p>
                      <p className="font-semibold text-foreground">{format(parseISO(contenedor.fechaPedido), "d MMM yyyy", { locale: es })}</p>
                    </div>
                  )}
                </div>

                {isRecibido && contenedor.diasTransito !== null && (
                  <div className="mt-6 p-4 bg-muted/40 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-sidebar">Desempeño de Tránsito</p>
                      <p className="text-xs text-muted-foreground">Tiempo real desde pedido hasta recepción.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-sidebar tracking-tight">{contenedor.diasTransito} <span className="text-sm font-medium text-muted-foreground">días</span></p>
                      {contenedor.diferenciaFechaEstimada !== null && (
                        <p className={cn(
                          "text-xs font-bold",
                          contenedor.diferenciaFechaEstimada < 0 ? "text-emerald-600" : contenedor.diferenciaFechaEstimada > 0 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {contenedor.diferenciaFechaEstimada < 0 ? `Llegó ${Math.abs(contenedor.diferenciaFechaEstimada)} días antes` :
                           contenedor.diferenciaFechaEstimada > 0 ? `Se retrasó ${contenedor.diferenciaFechaEstimada} días` :
                           "Llegada a tiempo"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lineas */}
            <Card className="shadow-sm border-border/50 overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                <CardTitle className="text-lg">Desglose de Mercancía</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Producto</TableHead>
                      <TableHead className="text-right font-semibold border-l border-border/30 bg-muted/20">Esperado</TableHead>
                      <TableHead className="text-right font-semibold bg-muted/20">Rollos</TableHead>
                      {isRecibido && (
                        <>
                          <TableHead className="text-right font-semibold border-l border-border/30 bg-emerald-50/30 dark:bg-emerald-950/10">Recibido</TableHead>
                          <TableHead className="text-right font-semibold bg-emerald-50/30 dark:bg-emerald-950/10">Rollos</TableHead>
                          <TableHead className="text-right font-semibold border-l border-border/30">Diferencia</TableHead>
                        </>
                      )}
                      {isAdmin && <TableHead className="text-right font-semibold border-l border-border/30">Costo Ref.</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contenedor.lineas.map((linea, idx) => {
                      const diff = parseFloat(linea.diferencia);
                      const isShort = diff < 0;
                      const isOver = diff > 0;
                      const isUnexpected = linea.id === null || Number(linea.cantidadEsperada) === 0;

                      return (
                        <TableRow key={linea.id || `unexpected-${idx}`} className="hover:bg-muted/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-sidebar">{linea.sku}</div>
                              {isUnexpected && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">No Esperado</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">{linea.tela} - {linea.color}</div>
                            {linea.nota && <div className="text-[10px] text-amber-600 mt-1">{linea.nota}</div>}
                          </TableCell>

                          <TableCell className="text-right border-l border-border/30 font-medium">
                            {formatNumber(Number(linea.cantidadEsperada), { kind: "count" })} <span className="text-xs text-muted-foreground">{formatUnit(linea.unidad)}</span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {linea.rollosEsperados !== null && linea.rollosEsperados !== undefined ? formatNumber(linea.rollosEsperados, { kind: "count" }) : "-"}
                          </TableCell>

                          {isRecibido && (
                            <>
                              <TableCell className="text-right border-l border-border/30 font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatNumber(Number(linea.cantidadRecibida), { kind: "count" })} <span className="text-xs font-normal opacity-70">{formatUnit(linea.unidad)}</span>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatNumber(linea.rollosRecibidos, { kind: "count" })}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right border-l border-border/30 font-bold",
                                isShort ? "text-destructive" : isOver ? "text-amber-600" : "text-muted-foreground"
                              )}>
                                {diff === 0 ? "Exacto" : `${diff > 0 ? '+' : ''}${formatNumber(diff, { kind: "count" })}`}
                              </TableCell>
                            </>
                          )}

                          {isAdmin && (
                            <TableCell className="text-right border-l border-border/30">
                              {linea.costoTotal ? (
                                <div>
                                  <div className="font-mono text-emerald-600 font-medium">{formatNumber(Number(linea.costoTotal), { kind: "money" })}</div>
                                  {linea.costoUnitarioReal && (
                                    <div className="text-[10px] text-muted-foreground">
                                      {formatNumber(Number(linea.costoUnitarioReal), { kind: "money" })}/u
                                    </div>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground opacity-50">-</span>}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

          </div>

          <div className="space-y-6">

            <Card className="shadow-sm border-border/50">
              <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
                <CardTitle className="text-lg text-sidebar">Totales</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">

                  <div className="p-4 flex items-center justify-between bg-sidebar/5">
                    <span className="font-semibold text-sidebar">Líneas</span>
                    <span className="font-bold">{formatNumber(contenedor.totalesEsperados.lineas, { kind: "count" })}</span>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-medium text-muted-foreground text-sm">Metros</span>
                      <div className="text-right">
                        {isRecibido && <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Recibido</div>}
                        <div className={cn("text-xl font-bold", isRecibido ? "text-emerald-600" : "text-sidebar")}>
                          {formatNumber(Number(isRecibido ? contenedor.totalesRecibidos.metros : contenedor.totalesEsperados.metros), { kind: "count" })}
                        </div>
                      </div>
                    </div>
                    {isRecibido && (
                      <div className="flex justify-between text-xs pt-2 border-t border-border/40 text-muted-foreground mt-2">
                        <span>Esperado: {formatNumber(Number(contenedor.totalesEsperados.metros), { kind: "count" })}</span>
                        <span className={cn(
                          "font-bold",
                          Number(contenedor.totalesRecibidos.metros) < Number(contenedor.totalesEsperados.metros) ? "text-destructive" :
                          Number(contenedor.totalesRecibidos.metros) > Number(contenedor.totalesEsperados.metros) ? "text-amber-600" : ""
                        )}>
                          Δ {formatNumber(Number(contenedor.totalesRecibidos.metros) - Number(contenedor.totalesEsperados.metros), { kind: "count" })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-medium text-muted-foreground text-sm">Kilos</span>
                      <div className="text-right">
                        {isRecibido && <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Recibido</div>}
                        <div className={cn("text-xl font-bold", isRecibido ? "text-emerald-600" : "text-sidebar")}>
                          {formatNumber(Number(isRecibido ? contenedor.totalesRecibidos.kilos : contenedor.totalesEsperados.kilos), { kind: "count" })}
                        </div>
                      </div>
                    </div>
                    {isRecibido && (
                      <div className="flex justify-between text-xs pt-2 border-t border-border/40 text-muted-foreground mt-2">
                        <span>Esperado: {formatNumber(Number(contenedor.totalesEsperados.kilos), { kind: "count" })}</span>
                        <span className={cn(
                          "font-bold",
                          Number(contenedor.totalesRecibidos.kilos) < Number(contenedor.totalesEsperados.kilos) ? "text-destructive" :
                          Number(contenedor.totalesRecibidos.kilos) > Number(contenedor.totalesEsperados.kilos) ? "text-amber-600" : ""
                        )}>
                          Δ {formatNumber(Number(contenedor.totalesRecibidos.kilos) - Number(contenedor.totalesEsperados.kilos), { kind: "count" })}
                        </span>
                      </div>
                    )}
                  </div>

                  {isAdmin && contenedor.costoTotal && (
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col items-end">
                      <span className="font-medium text-emerald-800/60 dark:text-emerald-300/60 text-sm mb-1">Costo Total</span>
                      <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatNumber(Number(contenedor.costoTotal), { kind: "money" })}
                      </span>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>

            {contenedor.notas && (
              <Card className="shadow-sm border-border/50">
                <CardHeader className="bg-muted/20 border-b border-border/50 pb-3">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Notas</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-sm whitespace-pre-wrap">{contenedor.notas}</p>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>

      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Cancelar Contenedor</DialogTitle>
            <DialogDescription>
              Esta acción es irreversible y anulará el tránsito de la mercancía esperada. No eliminará el registro histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo de cancelación <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Indica la razón detallada..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="resize-none h-24"
              />
              <p className="text-xs text-muted-foreground">Mínimo 10 caracteres.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Mantener</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelReason.length < 10 || cancelContenedor.isPending}>
              Confirmar Cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
