import { useParams, Link } from "wouter";
import { useGetSalida, getGetSalidaQueryKey } from "@workspace/api-client-react";
import { BrandLogo } from "@/components/brand-logo";
import { format } from "date-fns";
import { Loader2, Printer, User, Calendar, Truck, Clock, Hash, MapPin, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SalidaDocumento() {
  const { id } = useParams();
  const { data: salida, isLoading } = useGetSalida(Number(id), {
    query: { enabled: !!id, queryKey: getGetSalidaQueryKey(Number(id)) }
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!salida) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-white">
        <p className="text-muted-foreground">Documento no encontrado</p>
      </div>
    );
  }

  const isAvailable = salida.estado !== "CANCELADA" && salida.estado !== "RECHAZADA";

  if (!isAvailable) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 text-center bg-white">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <p className="text-lg font-medium text-slate-900">Documento no disponible</p>
        <p className="text-sm text-slate-500">El estado actual de la salida no permite imprimir este documento.</p>
        <Link href={`/salidas/${salida.id}`} className="mt-4 text-blue-600 hover:underline">Volver a Salida</Link>
      </div>
    );
  }

  const dateObj = new Date(salida.createdAt);

  // Pagination logic: max 12 rolls per page for better landscape fit
  const rollosPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(salida.rollos.length / rollosPerPage));
  const pages = Array.from({ length: totalPages }).map((_, i) => salida.rollos.slice(i * rollosPerPage, (i + 1) * rollosPerPage));

  return (
    <div className="min-h-[100dvh] bg-muted/20 flex flex-col">
      <div className="no-print p-4 border-b bg-background sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/salidas/${salida.id}`}>
            <Button variant="ghost" size="icon" data-testid="doc-back-button" aria-label="Volver al detalle">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="font-bold">Vista previa de impresión (SALIDA)</h1>
        </div>
        <Button onClick={() => window.print()} data-testid="doc-print-button">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-8 flex flex-col items-center gap-8 print:p-0 print:block">
        <style>{`@media print {
          .page-break { page-break-after: always; }
          @page { size: letter landscape; margin: 10mm; }
        }`}</style>

        {pages.map((pageRollos, pageIndex) => (
          <div
            key={pageIndex}
            data-testid={`document-page-${pageIndex + 1}`}
            className={`document-page bg-white shadow-xl print:shadow-none w-[11in] h-[8.5in] relative box-border flex flex-col overflow-hidden ${pageIndex < totalPages - 1 ? 'page-break' : ''}`}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <div className="flex items-center gap-4">
                <div className="w-2 h-16 bg-[#1e3a8a] mr-2"></div>
                <h1 className="text-5xl font-black text-[#1e3a8a] tracking-tighter uppercase">SALIDA</h1>
                <div className="ml-4 text-[#1e3a8a] font-bold text-xl leading-tight border-l-2 pl-4 border-gray-300">
                  MARIANA<br/>TEXTIL
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-gray-500 font-medium">MARIANA TEXTIL S.A. DE C.V.</div>
                  <div className="text-sm font-semibold mt-1">Página {pageIndex + 1} de {totalPages}</div>
                </div>
                <div className="w-px h-12 bg-gray-300"></div>
                <BrandLogo variant="mark" className="w-12 h-12" />
              </div>
            </div>

            {/* Form Data */}
            <div className="px-8 py-4">
              <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Solicitante</span>
                  <span className="font-medium text-sm text-black">{salida.nombreSolicitadoPor || "N/A"}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Origen</span>
                  <span className="font-medium text-sm text-black">{salida.nombreOrigen}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Fecha</span>
                  <span className="font-medium text-sm text-black">{dateObj ? format(dateObj, "dd/MM/yyyy") : "N/A"}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Destino</span>
                  <span className="font-medium text-sm text-black">{salida.nombreDestino}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <Clock className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Hora</span>
                  <span className="font-medium text-sm text-black">{dateObj ? format(dateObj, "HH:mm") + " hrs" : "N/A"}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <Hash className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">No. Folio</span>
                  <span data-testid="doc-folio" className="font-bold text-sm text-red-600">{salida.folio.toString().padStart(6, '0')}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1 col-span-2">
                  <Truck className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-[136px] shrink-0 text-xs uppercase text-gray-500 tracking-wider">Transportista</span>
                  <span data-testid="doc-transportista" className="font-medium text-sm text-black">{salida.transportista || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="px-8 mt-2 flex-1">
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-[#1e3a8a] text-white">
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider w-10 text-center">#</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider w-48">Serie Rollo</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider">Producto</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-right w-24">Cantidad</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-left w-20">U.M.</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRollos.map((rollo, index) => {
                    const line = salida.lineas.find(l => l.id === rollo.lineaId);
                    const globalIndex = pageIndex * rollosPerPage + index + 1;
                    return (
                      <tr key={index} className="border-b border-gray-200 even:bg-gray-50">
                        <td className="py-1 px-3 text-center text-gray-500 text-xs">{globalIndex}</td>
                        <td className="py-1 px-3 font-mono font-bold text-sm text-black">{rollo.serie}</td>
                        <td className="py-1 px-3 text-sm text-gray-800 truncate max-w-[400px]">
                          {line?.skuProducto} - {line?.telaProducto} {line?.colorProducto}
                        </td>
                        <td className="py-1 px-3 text-right text-sm font-medium">{rollo.cantidadEnviada}</td>
                        <td className="py-1 px-3 text-xs font-bold text-gray-500 tracking-wider">{line?.unidadProducto}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, rollosPerPage - pageRollos.length) }).map((_, i) => (
                    <tr key={`pad-${i}`} className="border-b border-gray-100 h-[29px]">
                      <td></td><td></td><td></td><td></td><td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {pageIndex === totalPages - 1 && (
              <div className="px-8 mt-auto pb-4">
                <div className="flex justify-between items-end gap-8">
                  {/* Observaciones */}
                  <div className="w-[40%] bg-gray-50 border border-gray-200 rounded-md p-3 h-24">
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Observaciones / Notas</div>
                    <div className="text-xs text-black italic leading-tight">
                      {salida.observaciones || salida.notaSolicitud || "Sin observaciones."}
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="flex-1 grid grid-cols-2 gap-8">
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-12"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">Entregó (Chofer / Transp.)</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-12"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">Despachó (Almacén Origen)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={`h-4 bg-[#1e3a8a] w-full shrink-0 ${pageIndex < totalPages - 1 ? 'mt-auto' : ''}`}></div>
          </div>
        ))}
      </div>
    </div>
  );
}
