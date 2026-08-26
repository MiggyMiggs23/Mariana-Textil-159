import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetEntrada, getGetEntradaQueryKey, EntradaRollo } from "@workspace/api-client-react";
import { LabelPrint } from "@/components/label-print";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Loader2, CheckSquare } from "lucide-react";
import { formatNumber } from "@workspace/number-format";

export default function EntradaEtiquetas() {
  const { id } = useParams();
  const { data: entrada, isLoading } = useGetEntrada(Number(id), {
    query: { enabled: !!id, queryKey: getGetEntradaQueryKey(Number(id)) }
  });

  const [selectedRollos, setSelectedRollos] = useState<Set<number>>(new Set());
  const [printMode, setPrintMode] = useState<"thermal" | "sheet">("thermal");

  // Initialize selection once when data arrives
  useEffect(() => {
    if (entrada && selectedRollos.size === 0) {
      setSelectedRollos(new Set(entrada.rollos.map(r => r.id)));
    }
  }, [entrada, selectedRollos.size]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!entrada) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Documento no encontrado</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const toggleAll = () => {
    if (selectedRollos.size === entrada.rollos.length) {
      setSelectedRollos(new Set());
    } else {
      setSelectedRollos(new Set(entrada.rollos.map(r => r.id)));
    }
  };

  const toggleRollo = (rolloId: number) => {
    const next = new Set(selectedRollos);
    if (next.has(rolloId)) next.delete(rolloId);
    else next.add(rolloId);
    setSelectedRollos(next);
  };

  // Enhance rollos with product details from lines
  const rollosFullData = entrada.rollos.map(rollo => {
    const linea = entrada.lineas.find(l => l.productoId === rollo.productoId);
    return {
      ...rollo,
      sku: linea?.skuProducto || "S/N",
      tela: linea?.telaProducto || "Desconocida",
      color: linea?.colorProducto || "N/A",
      unidad: linea?.unidadProducto || "M"
    };
  });

  const rollosToPrint = rollosFullData.filter(r => selectedRollos.has(r.id));

  useEffect(() => {
    if (printMode === 'thermal') {
      document.body.classList.add('printing-labels');
    } else {
      document.body.classList.remove('printing-labels');
    }
    return () => {
      document.body.classList.remove('printing-labels');
    };
  }, [printMode]);

  return (
    <div className={`min-h-[100dvh] bg-muted/20 flex flex-col`}>
      <div className="no-print p-4 border-b bg-background sticky top-0 z-10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/entradas`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-bold">Etiquetas - Folio #{entrada.folioFormateado}</h1>
            <p className="text-xs text-muted-foreground">
              {formatNumber(selectedRollos.size, { kind: "count" })} de {formatNumber(entrada.totalRollos, { kind: "count" })} rollos seleccionados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm font-medium text-muted-foreground">Formato:</span>
            <Select value={printMode} onValueChange={(v: "thermal"|"sheet") => setPrintMode(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal">Térmica 100×70 mm</SelectItem>
                <SelectItem value="sheet">Plantilla Carta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={toggleAll}>
            <CheckSquare className="w-4 h-4 mr-2" />
            {selectedRollos.size === entrada.rollos.length ? "Deseleccionar" : "Seleccionar Todos"}
          </Button>
          <Button onClick={handlePrint} disabled={selectedRollos.size === 0}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Selección
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        {/* Selection grid for screen */}
        <div className="no-print grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
          {rollosFullData.map(rollo => (
            <div 
              key={rollo.id}
              className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${
                selectedRollos.has(rollo.id) ? "bg-primary/5 border-primary" : "bg-card hover:bg-muted/50"
              }`}
              onClick={() => toggleRollo(rollo.id)}
            >
              <Checkbox checked={selectedRollos.has(rollo.id)} className="pointer-events-none" />
              <div>
                <div className="font-bold text-sm">{rollo.serie}</div>
                <div className="text-xs text-muted-foreground truncate w-32">{rollo.tela} - {rollo.color}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Print area */}
        <div className={`print-only-container flex gap-[4mm] justify-center ${printMode === 'thermal' ? 'etiquetas-print flex-wrap print:block print:p-0' : 'etiquetas-sheet-print flex-wrap max-w-[8.5in] mx-auto print:max-w-none print:w-[8.5in] bg-white p-8 print:p-4 shadow-xl print:shadow-none print:m-0'}`}>
          {rollosToPrint.map(rollo => (
            <LabelPrint
              key={rollo.id}
              className={printMode === 'thermal' ? 'shadow-lg print:shadow-none' : 'sheet-label'}
              data={{
                sku: rollo.sku,
                serie: rollo.serie,
                tela: rollo.tela,
                color: rollo.color,
                cantidad: rollo.cantidadInicial,
                unidad: rollo.unidad
              }}
            />
          ))}
        </div>

        <div className="no-print text-center text-sm text-muted-foreground mt-12 bg-muted/50 py-4 rounded-md">
          <p className="font-bold">Etiquetas recomendadas: papel térmico adhesivo 100 × 70 mm</p>
          <p className="text-xs mt-1">Asegúrese de desactivar márgenes y encabezados en la configuración de impresión de su navegador.</p>
        </div>
        {printMode === "sheet" && <div className="print-only label-sheet-note">Etiquetas recomendadas: papel térmico adhesivo 100 × 70 mm</div>}
      </div>
    </div>
  );
}