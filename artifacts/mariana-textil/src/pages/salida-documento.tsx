import { useParams, Link } from "wouter";
import { useGetDocumentoSalida, getGetDocumentoSalidaQueryKey } from "@workspace/api-client-react";
import { BrandLogo } from "@/components/brand-logo";
import { format } from "date-fns";
import { Loader2, Printer, User, Calendar, Truck, Clock, Hash, MapPin, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@workspace/number-format";
import { QRCodeSVG } from "qrcode.react";

export default function SalidaDocumento() {
  const { id } = useParams();
  const { data: salida, isLoading, error } = useGetDocumentoSalida(Number(id), {
    query: { enabled: !!id, queryKey: getGetDocumentoSalidaQueryKey(Number(id)), retry: false }
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !salida) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-4 bg-white text-center">
        <AlertCircle className="h-10 w-10 text-amber-600" />
        <div>
          <h1 className="text-lg font-bold text-slate-900">Documento no disponible</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            La salida debe estar enviada o recibida antes de poder imprimirse.
          </p>
        </div>
        <Link href={`/salidas/${id}`}>
          <Button variant="outline">Volver al detalle</Button>
        </Link>
      </div>
    );
  }

  const dateObj = new Date(salida.createdAt);
  const receptionPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/salidas?tab=recepcion&folio=${salida.folio}`;
  const receptionUrl = new URL(receptionPath, window.location.origin).toString();

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
            className={`document-page bg-white shadow-xl print:shadow-none w-[11in] h-[8.5in] relative box-border flex flex-col overflow-hidden shrink-0 ${pageIndex < totalPages - 1 ? 'page-break' : ''}`}
          >
            {salida.estado === 'CANCELADA' && (
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-10">
                <span className="text-9xl font-black text-red-600 rotate-[-30deg] tracking-widest border-8 border-red-600 p-8 rounded-3xl">
                  CANCELADA
                </span>
              </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <div className="flex items-center gap-4">
                <div className="w-2 h-16 bg-[#1e3a8a] mr-2"></div>
                <h1 className="text-4xl font-black text-[#1e3a8a] tracking-tighter uppercase">HOJA DE SALIDA</h1>
                <div className="ml-4 text-[#1e3a8a] font-bold text-xl leading-tight border-l-2 pl-4 border-gray-300">
                  MARIANA<br/>TEXTIL
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <QRCodeSVG
                    value={receptionUrl}
                    size={112}
                    level="M"
                    includeMargin
                    aria-label={`QR para recibir salida ${salida.folio}`}
                  />
                  <span className="text-[9px] font-bold uppercase">Escanear para recibir</span>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 font-medium">MARIANA TEXTIL S.A. DE C.V.</div>
                  <div className="text-sm font-semibold mt-1">Página {formatNumber(pageIndex + 1, { kind: "count" })} de {formatNumber(totalPages, { kind: "count" })}</div>
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
                  <span className="font-medium text-sm text-black">{salida.nombreArmadoPor || "N/A"}</span>
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
            <div className="px-8 mt-2 flex-1 relative z-10">
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-[#1e3a8a] text-white">
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider w-10 text-center">#</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider w-40">Serie</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider">Producto</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider w-32">Color</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider w-28">SKU</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-right w-24">Cantidad</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-left w-20">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRollos.map((rollo, index) => {
                    const line = salida.lineas.find(l => l.id === rollo.lineaId);
                    const globalIndex = pageIndex * rollosPerPage + index + 1;
                    return (
                      <tr key={index} className="border-b border-gray-200 even:bg-gray-50">
                        <td className="py-1 px-3 text-center text-gray-500 text-xs">{formatNumber(globalIndex, { kind: "count" })}</td>
                        <td className="py-1 px-3 font-mono font-bold text-sm text-black">{rollo.serie}</td>
                        <td className="py-1 px-3 text-sm text-gray-800 truncate max-w-[250px]">
                          {line?.telaProducto}
                        </td>
                        <td className="py-1 px-3 text-sm text-gray-800 truncate max-w-[150px]">
                          {line?.colorProducto}
                        </td>
                        <td className="py-1 px-3 font-mono text-xs text-gray-700">{line?.skuProducto}</td>
                        <td className="py-1 px-3 text-right text-sm font-medium">{formatNumber(rollo.cantidadEnviada, { kind: "quantity" })}</td>
                        <td className="py-1 px-3 text-xs font-bold text-gray-500 tracking-wider">{line?.unidadProducto}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, rollosPerPage - pageRollos.length) }).map((_, i) => (
                    <tr key={`pad-${i}`} className="border-b border-gray-100 h-[29px]">
                      <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {pageIndex === totalPages - 1 && (
              <div className="px-8 mt-auto pb-4 relative z-10">
                <div className="flex justify-between items-start gap-8">
                  {/* Observaciones */}
                  <div className="w-[35%] bg-gray-50 border border-gray-200 rounded-md p-3 h-24">
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Observaciones / Notas</div>
                    <div className="text-xs text-black italic leading-tight">
                      {salida.notaEnvio || salida.observaciones || "Sin observaciones."}
                      {salida.estado === 'CANCELADA' && (
                        <div className="mt-2 text-red-600 font-bold">
                          MOTIVO CANCELACIÓN: {salida.motivoCancelacion}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="w-[20%]">
                    <table className="w-full text-sm border-collapse border border-gray-200 bg-white">
                      <tbody>
                        <tr>
                          <td className="py-1 px-2 border border-gray-200 font-bold text-gray-600 text-xs uppercase bg-gray-50">Total Rollos</td>
                           <td className="py-1 px-2 border border-gray-200 font-bold text-right">{formatNumber(salida.totalRollos ?? salida.rollos.length, { kind: "count" })}</td>
                        </tr>
                        {Number(salida.totalMetros) > 0 && (
                          <tr>
                            <td className="py-1 px-2 border border-gray-200 font-bold text-gray-600 text-xs uppercase bg-gray-50">Total Metros</td>
                             <td className="py-1 px-2 border border-gray-200 font-bold text-right">{formatNumber(salida.totalMetros, { kind: "quantity" })}</td>
                          </tr>
                        )}
                        {Number(salida.totalKilos) > 0 && (
                          <tr>
                            <td className="py-1 px-2 border border-gray-200 font-bold text-gray-600 text-xs uppercase bg-gray-50">Total Kilos</td>
                             <td className="py-1 px-2 border border-gray-200 font-bold text-right">{formatNumber(salida.totalKilos, { kind: "quantity" })}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures */}
                  <div className="flex-1 grid grid-cols-3 gap-5 mt-10">
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-0"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">ENTREGA</div>
                      <div className="text-[8px] text-gray-500">Nombre y Firma</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-0"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">TRANSPORTA</div>
                      <div className="text-[8px] text-gray-500">Nombre y Firma</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-0"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">RECIBE</div>
                      <div className="text-[8px] text-gray-500">Nombre y Firma</div>
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
