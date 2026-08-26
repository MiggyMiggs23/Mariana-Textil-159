import React, { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { ProductCombobox } from "@/components/product-combobox";
import {
  useGetCatalogosEntrada,
  getGetCatalogosEntradaQueryKey,
  useListLocations,
  useCrearEntrada,
  useGetCurrentUser,
  getListLocationsQueryKey,
  getGetCurrentUserQueryKey,
  getListEntradasQueryKey,
  getGetDashboardQueryKey,
  getListRollosQueryKey,
  getGetExistenciasQueryKey,
  useGetFechaServidor,
  getGetFechaServidorQueryKey,
  useListEntradasPendientesCosto,
  getListEntradasPendientesCostoQueryKey,
  useCountEntradasPendientesCosto,
  getCountEntradasPendientesCostoQueryKey,
  useListContenedoresDisponiblesEntrada,
  getListContenedoresDisponiblesEntradaQueryKey,
  getListContenedoresQueryKey,
  getGetResumenContenedoresQueryKey,
  getGetContenedorQueryKey,
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
import { Plus, Trash2, Save, ArrowDownToLine, CheckCircle2, Box, X, Calculator, Printer, FileText, ChevronDown, ChevronRight, Edit2, AlertTriangle, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  applyUniformToBlankRolls,
  createBlankRollQuantities,
  createUniformRollQuantities,
  getRollCaptureCounts,
  isAdjustedRoll,
  isValidDeclaredRollCount,
  resetRollToUniform,
  updateEditedRollIndexes,
  updateRollQuantity,
} from "@/lib/roll-capture-state";
import { Link } from "wouter";
import { formatNumber } from "@workspace/number-format";

type DraftLinea = {
  id: string;
  productoId: string;
  productoName: string;
  productoSKU: string;
  productoUnidad: string;
  costoUnitario?: string;
  declaredCount: number;
  cantidades: string[];
  uniformBaseline: string | null;
  adjustedIndexes: number[];
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
  const showCost = user?.rol === Role.ADMIN || user?.rol === Role.INVENTARIOS;

  const {
    data: catalogos,
    isError: catalogosFailed,
  } = useGetCatalogosEntrada({ query: { queryKey: getGetCatalogosEntradaQueryKey() } });

  const productos = catalogos?.productos;
  const proveedores = catalogos?.proveedores;

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
    data: serverTime,
    isError: serverTimeFailed,
  } = useGetFechaServidor({
    query: {
      queryKey: getGetFechaServidorQueryKey(),
      refetchInterval: 60_000,
    },
  });

  const [ubicacionId, setUbicacionId] = useState<string>("");
  const [proveedorId, setProveedorId] = useState<string>("none");
  const [contenedorId, setContenedorId] = useState<string>("none");
  const [autoDerivedProveedorId, setAutoDerivedProveedorId] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState<string>("");

  const { data: contenedoresDisponibles } = useListContenedoresDisponiblesEntrada(
    { ubicacionId: Number(ubicacionId) },
    {
      query: {
        enabled: !!ubicacionId,
        queryKey: getListContenedoresDisponiblesEntradaQueryKey({ ubicacionId: Number(ubicacionId) })
      }
    }
  );

  const crearEntrada = useCrearEntrada();

  // General data (draft wide)
  const [uuidCliente, setUuidCliente] = useState(() => crypto.randomUUID());

  // Detalle del artículo state (form state)
  const [productoId, setProductoId] = useState<string>("");
  const [costoUnitario, setCostoUnitario] = useState<string>("");
  const [declaredCount, setDeclaredCount] = useState<string>("");

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
  const [editingOriginalQty, setEditingOriginalQty] = useState("");
  const [editingOriginalWasAdjusted, setEditingOriginalWasAdjusted] = useState(false);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [uniformQty, setUniformQty] = useState("");
  const [uniformBaseline, setUniformBaseline] = useState<string | null>(null);
  const [editedQtyIndexes, setEditedQtyIndexes] = useState<Set<number>>(new Set());

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

  const handleUbicacionChange = (value: string) => {
    setUbicacionId(value);
    setContenedorId("none");
    if (proveedorId !== "none" && proveedorId === autoDerivedProveedorId) {
      setProveedorId("none");
    }
    setAutoDerivedProveedorId(null);
  };

  const handleProveedorChange = (value: string) => {
    setProveedorId(value);
    if (contenedorId !== "none" && contenedoresDisponibles) {
      const selectedCont = contenedoresDisponibles.find(c => c.id.toString() === contenedorId);
      if (selectedCont && selectedCont.proveedorId.toString() !== value) {
        setContenedorId("none");
        toast.info("El contenedor seleccionado se ha desvinculado porque no coincide con el nuevo proveedor.");
      }
    }
    setAutoDerivedProveedorId(null); // Manual change overrides auto-derivation
  };

  const handleContenedorChange = (value: string) => {
    setContenedorId(value);
    if (value !== "none") {
      const selectedCont = contenedoresDisponibles?.find(c => c.id.toString() === value);
      if (selectedCont) {
        const provIdStr = selectedCont.proveedorId.toString();
        setProveedorId(provIdStr);
        setAutoDerivedProveedorId(provIdStr);
      }
    } else {
      if (proveedorId === autoDerivedProveedorId) {
        setProveedorId("none");
      }
      setAutoDerivedProveedorId(null);
    }
  };

  const handleStartCapture = () => {
    if (!productoId || !declaredCount || !ubicacionId) {
      toast.error("Por favor completa todos los campos obligatorios (*)");
      return;
    }
    if (!isValidDeclaredRollCount(declaredCount)) {
      toast.error("La cantidad de rollos debe ser un número entero mayor a cero.");
      return;
    }
    if (showCost && !isValidUnitCost(costoUnitario)) {
      toast.error("El costo unitario debe ser mayor a cero.");
      return;
    }

    setCapDraftId(crypto.randomUUID());
    setCapCantidades(createBlankRollQuantities(Number(declaredCount)));
    setCapCurrentQty("");
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setEditingOriginalQty("");
    setEditingOriginalWasAdjusted(false);
    setIsEditingLine(false);
    setUniformQty("");
    setUniformBaseline(null);
    setEditedQtyIndexes(new Set());
    setIsCaptureModalOpen(true);
  };

  const handleEditLine = (linea: DraftLinea) => {
    setProductoId(linea.productoId);
    setCostoUnitario(linea.costoUnitario || "");
    setDeclaredCount(linea.declaredCount.toString());
    setCapDraftId(linea.id);
    setCapCantidades(Array.from({ length: linea.declaredCount }, (_, index) => linea.cantidades[index] ?? ""));
    setCapCurrentQty("");
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setEditingOriginalQty("");
    setEditingOriginalWasAdjusted(false);
    setIsEditingLine(true);
    setUniformQty(linea.uniformBaseline ?? "");
    setUniformBaseline(linea.uniformBaseline);
    setEditedQtyIndexes(new Set(linea.adjustedIndexes));
    setIsCaptureModalOpen(true);
  };

  const isRollAdjusted = (qty: string, index: number) => (
    isAdjustedRoll(qty, index, uniformBaseline, editedQtyIndexes)
  );
  const capturedRollCount = capCantidades.filter((qty) => qty.trim() !== "").length;
  const captureCounts = getRollCaptureCounts(capCantidades, uniformBaseline, editedQtyIndexes);
  const blankRollCount = captureCounts.blank;
  const adjustedRollCount = captureCounts.adjusted;
  const uniformRollCount = captureCounts.uniform;
  const nextBlankIndex = capCantidades.findIndex((qty) => qty.trim() === "");
  const nextRollNumber = nextBlankIndex === -1
    ? Math.max(1, Number(declaredCount) || 1)
    : nextBlankIndex + 1;

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
    const blankCount = capCantidades.filter((qty) => qty.trim() === "").length;
    if (blankCount === 0) {
      toast.info("No hay rollos en blanco por completar.");
      return;
    }

    setCapCantidades((previous) => applyUniformToBlankRolls(previous, uniformQty));
    setUniformBaseline((previous) => previous === null || blankCount > 0 ? uniformQty : previous);
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setEditingOriginalQty("");
    setEditingOriginalWasAdjusted(false);
    toast.success(`Se aplicó ${uniformQty} a ${blankCount} rollos sin capturar`);
  };

  const handleOverwriteUniformQty = () => {
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

    const adjustedCount = capCantidades.reduce(
      (count, qty, index) => count + (qty.trim() !== "" && isRollAdjusted(qty, index) ? 1 : 0),
      0,
    );
    const warning = adjustedCount > 0
      ? `Se reemplazarán los ${declared} rollos y se perderán ${adjustedCount} valores ajustados manualmente. ¿Deseas continuar?`
      : `Se reemplazarán los valores de los ${declared} rollos. ¿Deseas continuar?`;
    if (!window.confirm(warning)) return;

    setCapCantidades(createUniformRollQuantities(declared, uniformQty));
    setUniformBaseline(uniformQty);
    setEditedQtyIndexes(new Set());
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setEditingOriginalQty("");
    setEditingOriginalWasAdjusted(false);
    toast.success(`Se sobrescribieron los ${declared} rollos con ${uniformQty}`);
  };

  const handleAddQty = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = parseFloat(capCurrentQty);
    const nextBlankIndex = capCantidades.findIndex((qty) => qty.trim() === "");
    if (!isNaN(val) && val > 0 && nextBlankIndex !== -1) {
      setCapCantidades((previous) => previous.map((qty, index) => index === nextBlankIndex ? capCurrentQty : qty));
      setEditedQtyIndexes((previous) => {
        const next = new Set(previous);
        next.add(nextBlankIndex);
        return next;
      });
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
    setCapCantidades(prev => prev.map((qty, i) => i === idx ? "" : qty));
    setEditedQtyIndexes((previous) => {
      const next = new Set(previous);
      next.delete(idx);
      return next;
    });
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setEditingOriginalQty("");
    setEditingOriginalWasAdjusted(false);
    qtyInputRef.current?.focus();
  };

  const handleStartEditCapturedQty = (idx: number) => {
    setEditingQtyIndex(idx);
    setEditingQtyValue(capCantidades[idx] ?? "");
    setEditingOriginalQty(capCantidades[idx] ?? "");
    setEditingOriginalWasAdjusted(editedQtyIndexes.has(idx));
  };

  const handleChangeCapturedQty = (value: string) => {
    if (editingQtyIndex === null) return;
    setEditingQtyValue(value);
    setCapCantidades((previous) => updateRollQuantity(previous, editingQtyIndex, value));
    setEditedQtyIndexes((previous) => (
      updateEditedRollIndexes(previous, editingQtyIndex, value, uniformBaseline)
    ));
  };

  const handleSaveCapturedQty = () => {
    if (editingQtyIndex === null) return;
    const parsed = Number(editingQtyValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("La cantidad debe ser mayor que cero");
      return;
    }
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setEditingOriginalQty("");
    setEditingOriginalWasAdjusted(false);
    qtyInputRef.current?.focus();
  };

  const handleCancelCapturedQty = () => {
    if (editingQtyIndex === null) return;
    const cancelledIndex = editingQtyIndex;
    setCapCantidades((previous) => (
      updateRollQuantity(previous, cancelledIndex, editingOriginalQty)
    ));
    setEditedQtyIndexes((previous) => {
      const next = new Set(previous);
      if (editingOriginalWasAdjusted) {
        next.add(cancelledIndex);
      } else {
        next.delete(cancelledIndex);
      }
      return next;
    });
    setEditingQtyIndex(null);
    setEditingQtyValue("");
    setEditingOriginalQty("");
    setEditingOriginalWasAdjusted(false);
    qtyInputRef.current?.focus();
  };

  const handleResetToUniform = (idx: number) => {
    if (uniformBaseline === null) return;
    setCapCantidades((previous) => resetRollToUniform(previous, idx, uniformBaseline));
    setEditedQtyIndexes((previous) => {
      const next = new Set(previous);
      next.delete(idx);
      return next;
    });
  };

  const attemptCancelCapture = () => {
    if (capCantidades.some((qty) => qty.trim() !== "") && !isEditingLine) {
      setIsConfirmCancelOpen(true);
    } else {
      setIsCaptureModalOpen(false);
    }
  };

  const handleConfirmCapture = () => {
    const declared = Number(declaredCount);
    if (!isValidDeclaredRollCount(declared) || capCantidades.length !== declared) {
      toast.error("La cantidad declarada no coincide con los rollos de la captura.");
      return;
    }
    if (showCost && !isValidUnitCost(costoUnitario)) {
      toast.error("El costo unitario debe ser mayor a cero.");
      return;
    }
    const blankCount = capCantidades.filter((qty) => qty.trim() === "").length;
    if (blankCount > 0) {
      toast.error(`Faltan ${blankCount} rollos por capturar.`);
      return;
    }
    const invalidRollIndex = capCantidades.findIndex((qty) => {
      const parsed = Number(qty);
      return !Number.isFinite(parsed) || parsed <= 0;
    });
    if (invalidRollIndex !== -1) {
      toast.error(`El metraje del rollo ${invalidRollIndex + 1} debe ser mayor que cero.`);
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
      costoUnitario: showCost ? costoUnitario : undefined,
      declaredCount: declared,
      cantidades: capCantidades,
      uniformBaseline,
      adjustedIndexes: Array.from(editedQtyIndexes).sort((a, b) => a - b),
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
    const qtySum = l.cantidades.reduce((a, b) => a + parseFloat(b), 0);
    return acc + (qtySum * parseFloat(l.costoUnitario || "0"));
  }, 0);

  const isFormValid = ubicacionId && lineas.length > 0;

  const handleSubmit = () => {
    if (!isFormValid) {
      toast.error("La entrada está incompleta", {
        description: "Selecciona un sitio y agrega al menos una línea.",
      });
      return;
    }
    if (showCost && lineas.some((linea) => !isValidUnitCost(linea.costoUnitario || ""))) {
      toast.error("El costo unitario debe ser mayor a cero.");
      return;
    }

    if (contenedorId && contenedorId !== "none") {
      const isAvailable = contenedoresDisponibles?.some(c => c.id.toString() === contenedorId);
      if (!isAvailable) {
        setContenedorId("none");
        toast.error("El contenedor seleccionado ya no está disponible para esta ubicación.", {
          description: "Se ha desvinculado la entrada del contenedor. Revisa tu selección."
        });
        return;
      }
      const selectedCont = contenedoresDisponibles?.find(c => c.id.toString() === contenedorId);
      if (selectedCont && selectedCont.proveedorId.toString() !== proveedorId) {
        setContenedorId("none");
        toast.error("El proveedor seleccionado no coincide con el proveedor del contenedor", {
          description: "Se ha desvinculado el contenedor. Revisa tu selección."
        });
        return;
      }
    }

    crearEntrada.mutate({
      data: {
        ubicacionId: Number(ubicacionId),
        proveedorId: proveedorId === "none" ? undefined : Number(proveedorId),
        contenedorId: contenedorId === "none" ? undefined : Number(contenedorId),
        observaciones: observaciones || null,
        uuidCliente,
        lineas: lineas.map(l => ({
          productoId: Number(l.productoId),
          costoUnitario: showCost ? l.costoUnitario : undefined,
          cantidades: l.cantidades
        }))
      }
    }, {
      onSuccess: (data) => {
        if (!showCost) {
          toast.success("Entrada registrada. Los costos quedan pendientes de captura por administración.");
        } else {
          toast.success("Entrada registrada correctamente");
        }
        setResult(data);

        queryClient.invalidateQueries({ queryKey: getListEntradasQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCatalogosEntradaQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRollosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetExistenciasQueryKey() });
        if (ubicacionId) {
          queryClient.invalidateQueries({ queryKey: getListContenedoresDisponiblesEntradaQueryKey({ ubicacionId: Number(ubicacionId) }) });
        }
        queryClient.invalidateQueries({ queryKey: getListContenedoresQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetResumenContenedoresQueryKey() });
        if (contenedorId && contenedorId !== "none") {
          queryClient.invalidateQueries({ queryKey: getGetContenedorQueryKey(Number(contenedorId)) });
        }
        if (!showCost) {
          queryClient.invalidateQueries({ queryKey: getListEntradasPendientesCostoQueryKey({ page: 1, pageSize: 100 }) });
          queryClient.invalidateQueries({ queryKey: getCountEntradasPendientesCostoQueryKey() });
        }

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
              {!showCost && (
                <div className="mb-6 p-4 bg-amber-50/50 border border-amber-200 rounded-md text-amber-800 text-sm text-center">
                  Entrada registrada. Los costos quedan pendientes de captura por administración.
                </div>
              )}
              <div className="bg-background rounded-md border p-6 flex justify-around items-center text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Total Rollos</div>
                   <div className="text-2xl font-bold">{formatNumber(resultado.totalRollos, { kind: "count" })}</div>
                </div>
                {showCost && (
                  <>
                    <div className="w-px h-12 bg-border"></div>
                    <div>
                      <div className="text-sm text-muted-foreground">Costo Total</div>
                      <div className="text-2xl font-bold text-emerald-600">{formatNumber(resultado.totalCosto, { kind: "money" })}</div>
                    </div>
                  </>
                )}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">ENTRADA</h1>
            <p className="text-muted-foreground mt-1">Registra la mercancía que llega a un sitio. Cada rollo se da de alta con su cantidad propia y su número de serie.</p>
          </div>
          {user?.rol === Role.ADMIN && (
            <Button asChild variant="outline" className="hidden sm:flex border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100">
              <Link href="/entradas/pendientes-costo">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Costos Pendientes
              </Link>
            </Button>
          )}
        </div>

        {(catalogosFailed ||
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
                    products={(productos as any) ?? []}
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

                {showCost && (
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
                )}

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
                  <Label>Sitio <span className="text-destructive">*</span></Label>
                  {user?.rol === Role.ADMIN ? (
                    <Select value={ubicacionId} onValueChange={handleUbicacionChange}>
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
                  <Select value={proveedorId} onValueChange={handleProveedorChange}>
                    <SelectTrigger data-testid="select-entrada-proveedor">
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

                {ubicacionId && contenedoresDisponibles && contenedoresDisponibles.length > 0 && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Contenedor Asociado (Opcional)</Label>
                    <Select value={contenedorId} onValueChange={handleContenedorChange}>
                      <SelectTrigger className="bg-blue-50/50 border-blue-200">
                        <SelectValue placeholder="Selecciona un contenedor esperado..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguno</SelectItem>
                        {contenedoresDisponibles.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            Contenedor #{c.folio.toString().padStart(5, '0')} · {c.proveedor} {c.referencia ? `(${c.referencia})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                  <TableHead className="text-white">Sitio</TableHead>
                  <TableHead className="text-right text-white">Rollos</TableHead>
                  <TableHead className="text-white">Unidad</TableHead>
                  <TableHead className="text-right text-white">Cantidad total</TableHead>
                  {showCost && <TableHead className="text-right text-white">Costo por metro / kilo</TableHead>}
                  {showCost && <TableHead className="text-right text-white">Costo total</TableHead>}
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
                    const costSum = qtySum * parseFloat(linea.costoUnitario || "0");
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
                          <TableCell className="text-right font-bold">{formatNumber(linea.cantidades.length, { kind: "count" })}</TableCell>
                          <TableCell>{linea.productoUnidad}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(qtySum, { kind: "quantity" })}</TableCell>
                          {showCost && (
                            <TableCell className="text-right">
                              {formatNumber(linea.costoUnitario, { kind: "money" })} / {linea.productoUnidad.toLowerCase()}
                            </TableCell>
                          )}
                          {showCost && (
                            <TableCell className="text-right font-bold text-emerald-600">{formatNumber(costSum, { kind: "money" })}</TableCell>
                          )}
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
                    <TableCell className="text-right text-lg">{formatNumber(totalRollos, { kind: "count" })}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-lg">{formatNumber(totalQtyGeneral, { kind: "quantity" })}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-lg text-emerald-700">{formatNumber(totalCostoGeneral, { kind: "money" })}</TableCell>
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
                  <span className="font-semibold text-foreground/70">SITIO:</span>
                  {ubicaciones?.find(u => u.id.toString() === ubicacionId)?.nombre || user?.ubicacion?.nombre}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-primary tracking-tighter">
                  Rollo {nextRollNumber} de {declaredCount}
                </div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">
                  {capturedRollCount} capturados
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
                    onClick={handleApplyUniformQty}
                    disabled={!uniformQty}
                    data-testid="button-apply-uniform"
                  >
                    {blankRollCount === Number(declaredCount)
                      ? "Aplicar a todos"
                      : `Aplicar a los ${blankRollCount} rollos restantes`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOverwriteUniformQty}
                    disabled={!uniformQty}
                    data-testid="button-overwrite-uniform"
                  >
                    Sobrescribir todos
                  </Button>
                </div>
                {adjustedRollCount > 0 && (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Hay {adjustedRollCount} {adjustedRollCount === 1 ? "rollo ajustado" : "rollos ajustados"} que “Aplicar” conservará.
                  </p>
                )}
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
                  disabled={!capCurrentQty || blankRollCount === 0}
                  data-testid="button-add-captured-roll"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Siguiente rollo
                </Button>
              </form>
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/5 custom-scrollbar">
              {capturedRollCount === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground flex-col">
                  <Calculator className="w-16 h-16 opacity-10 mb-4" />
                  <p className="text-lg font-medium">Ingresa la cantidad del primer rollo</p>
                </div>
              ) : (
                capCantidades.map((qty, idx) => {
                  const isBlank = qty.trim() === "";
                  const isAdjusted = isRollAdjusted(qty, idx);
                  const isUniform = !isBlank && !isAdjusted && uniformBaseline !== null;

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col gap-3 rounded-lg border p-3 shadow-sm transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        isAdjusted
                          ? "border-amber-400 bg-amber-50/70 dark:bg-amber-950/20"
                          : isUniform
                            ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10"
                            : isBlank
                              ? "border-dashed bg-muted/20"
                              : "bg-white hover:border-primary/50 dark:bg-background"
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
                              onChange={(event) => handleChangeCapturedQty(event.target.value)}
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
                        ) : isBlank ? (
                          <span className="text-sm font-semibold text-muted-foreground">
                            Pendiente de captura
                          </span>
                        ) : (
                          <span className="text-2xl font-black tabular-nums">
                            {qty} <span className="text-sm font-bold text-muted-foreground">{selectedProduct?.unidad === 'METRO' ? 'M' : 'KG'}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-black uppercase ${
                            isAdjusted
                              ? "bg-amber-100 text-amber-800"
                              : isUniform
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                          data-testid={`badge-roll-state-${idx}`}
                        >
                          {isAdjusted ? "Ajustado" : isUniform ? "Uniforme" : "En blanco"}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted px-2 py-1 rounded">Serie por asignar #{idx+1}</span>
                        <div className="flex gap-1">
                          {isAdjusted && uniformBaseline !== null && editingQtyIndex !== idx && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-700 hover:bg-emerald-100"
                              onClick={() => handleResetToUniform(idx)}
                              aria-label={`Restaurar rollo ${idx + 1} al valor uniforme`}
                              title="Regresar al valor uniforme"
                              data-testid={`btn-reset-roll-${idx}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
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
                                onClick={handleCancelCapturedQty}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary opacity-60 hover:bg-primary/10 transition-opacity sm:opacity-70 sm:hover:opacity-100"
                              onClick={() => handleStartEditCapturedQty(idx)}
                              aria-label={`Editar cantidad del rollo ${idx + 1}`}
                              data-testid={`btn-edit-roll-${idx}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          {!isBlank && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive opacity-60 hover:bg-destructive/10 transition-opacity sm:hover:opacity-100"
                              onClick={() => handleRemoveCapturedQty(idx)}
                              aria-label={`Vaciar cantidad del rollo ${idx + 1}`}
                              data-testid={`btn-delete-roll-${idx}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Live Totals Row */}
            <div className="p-3 bg-primary/5 border-t shrink-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-primary">Estado de captura:</div>
                <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm font-bold">
                  <div className="text-emerald-700" data-testid="count-uniform-rolls">
                    Uniformes: {formatNumber(uniformRollCount, { kind: "count" })}
                  </div>
                  <div className="text-amber-700" data-testid="count-adjusted-rolls">
                    Ajustados: {formatNumber(adjustedRollCount, { kind: "count" })}
                  </div>
                  <div className="text-slate-600" data-testid="count-blank-rolls">
                    En blanco: {formatNumber(blankRollCount, { kind: "count" })}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-xs font-semibold text-muted-foreground">
                 <div>
                   Qty:{" "}
                   {formatNumber(
                     capCantidades.reduce((a, b) => a + (Number(b) || 0), 0),
                     { kind: "quantity" },
                   )}
                 </div>
                {showCost && (
                   <div>
                     {formatNumber(
                       capCantidades.reduce(
                         (a, b) => a + (Number(b) || 0),
                         0,
                       ) * parseFloat(costoUnitario || "0"),
                       { kind: "money" },
                     )}
                   </div>
                )}
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
                  disabled={blankRollCount === 0 && k !== 'DEL'}
                >
                  {k}
                </Button>
              ))}
              <Button
                className="col-span-3 h-16 text-xl font-black rounded-none bg-primary hover:bg-primary/90 text-white"
                onClick={handleAddQty}
                disabled={!capCurrentQty || blankRollCount === 0}
              >
                SIGUIENTE ROLLO (ENTER)
              </Button>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-background shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={attemptCancelCapture} className="w-full sm:w-1/3">
              Descartar
            </Button>
            <div className="w-full space-y-2 sm:w-2/3">
              {blankRollCount > 0 && (
                <p className="text-center text-sm font-semibold text-amber-700" data-testid="missing-rolls-message">
                  Faltan {blankRollCount} {blankRollCount === 1 ? "rollo" : "rollos"} por capturar.
                </p>
              )}
              <Button
                className="w-full bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]/90 font-bold"
                onClick={handleConfirmCapture}
                disabled={blankRollCount > 0}
                data-testid="button-confirm-line"
              >
                {isEditingLine ? "Guardar Cambios" : "Confirmar Línea"}
              </Button>
            </div>
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