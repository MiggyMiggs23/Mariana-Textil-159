import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetRollo, getGetRolloQueryKey } from "@workspace/api-client-react";
import { LabelPrint } from "@/components/label-print";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

export default function RolloEtiqueta() {
  const { id } = useParams();
  const { data: rollo, isLoading } = useGetRollo(Number(id), {
    query: { enabled: !!id, queryKey: getGetRolloQueryKey(Number(id)) }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!rollo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Rollo no encontrado</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-[100dvh] bg-muted/20 printing-labels flex flex-col">
      <div className="no-print p-4 border-b bg-background sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/inventario/rollos/${rollo.id}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-bold">Etiqueta - Rollo {rollo.serie}</h1>
            <p className="text-xs text-muted-foreground">Asegúrate de que la impresora esté configurada para 100x60mm</p>
          </div>
        </div>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-8 flex justify-center items-start print:p-0 print:block">
        <div className="print-only-container shadow-xl print:shadow-none bg-white">
          <LabelPrint 
            data={{
              sku: rollo.skuProducto || "S/N",
              serie: rollo.serie,
              tela: rollo.telaProducto || "Desconocida",
              color: rollo.colorProducto || "N/A",
              cantidad: rollo.cantidadActual,
              unidad: rollo.unidadProducto || "M"
            }} 
          />
        </div>
      </div>
    </div>
  );
}
