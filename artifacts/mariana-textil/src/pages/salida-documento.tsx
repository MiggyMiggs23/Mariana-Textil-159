import { useParams, Link } from "wouter";
import { useGetDocumentoSalida, getGetDocumentoSalidaQueryKey } from "@workspace/api-client-react";
import { PrintableDocumentHeader } from "@/components/printable-document-header";
import { DOCUMENT_QR_SIZE } from "@/components/document-qr-code";
import { format } from "date-fns";
import { Loader2, Printer, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { absoluteAppUrl, printWhenReady } from "@/lib/print";

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
  const qrUrl = absoluteAppUrl(`/salidas?tab=recepcion&id=${salida.id}`);

  // Medición Chromium a 96 dpi: caja útil 104.5 mm = 395 px.
  // 114 header + 40 datos + 30 cabecera + (5 × 20.5) rollos + 84 pie = 370.5 px.
  const rollosPerPage = 5;
  const totalPages = Math.max(1, Math.ceil((salida.rollos?.length || 0) / rollosPerPage));
  const pages = Array.from({ length: totalPages }).map((_, i) => (salida.rollos || []).slice(i * rollosPerPage, (i + 1) * rollosPerPage));

  return (
    <div className="salida-document-shell min-h-[100dvh] bg-muted/20 flex flex-col">
      <div className="no-print p-4 border-b bg-background sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/salidas/${salida.id}`}>
            <Button variant="ghost" size="icon" data-testid="doc-back-button" aria-label="Volver al detalle">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="font-bold">Vista previa de impresión (SALIDA - A6)</h1>
        </div>
        <Button onClick={() => void printWhenReady("print-salida")} data-testid="doc-print-button">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="salida-print-root flex-1 overflow-auto p-8 flex flex-col items-center gap-8 print:p-0 print:block">
        {pages.map((pageRollos, pageIndex) => (
          <div
            key={pageIndex}
            data-testid={`document-page-${pageIndex + 1}`}
            className={`document-page salida-page-print bg-white shadow-xl print:shadow-none w-[148mm] h-[105mm] relative box-border flex flex-col overflow-hidden shrink-0 ${pageIndex < totalPages - 1 ? 'page-break' : ''}`}
          >
            {salida.estado === 'CANCELADA' && (
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-10">
                <span className="text-6xl font-black text-red-600 rotate-[-30deg] tracking-widest border-4 border-red-600 p-4 rounded-xl">
                  CANCELADA
                </span>
              </div>
            )}

            {/* Header */}
            <PrintableDocumentHeader
              className="document-header relative z-10 shrink-0 bg-white px-2"
              qrUrl={qrUrl}
              qrLabel={`QR para abrir salida ${salida.folioFormateado}`}
              logoSize={DOCUMENT_QR_SIZE}
            >
              <h1 className="text-[22px] font-black text-black tracking-tighter leading-none">Salida</h1>
              <div className="mt-0.5 text-[10px] font-bold uppercase text-gray-700">Mariana Textil</div>
              <div className="mt-1 text-sm font-black leading-tight text-red-600" data-testid="doc-folio">{salida.folioFormateado}</div>
              <div className="text-[10px] font-bold text-gray-600">Pág {pageIndex + 1}/{totalPages}</div>
            </PrintableDocumentHeader>

            {/* Form Data */}
            <div className="document-metadata px-2 py-1.5 border-b border-black bg-gray-50 shrink-0 grid grid-cols-6 gap-x-2 gap-y-1 relative z-10">
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-600 shrink-0">Generó:</span>
                  <span className="text-[10px] truncate font-medium text-black">{salida.nombreArmadoPor || "N/A"}</span>
                </div>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-600 shrink-0">Entregó:</span>
                  <span className="text-[10px] truncate font-medium text-black" data-testid="doc-transportista">{salida.viaje ? `${salida.viaje.nombreCamioneta} · ${salida.viaje.nombreChofer}` : salida.transportista || "N/A"}</span>
                </div>
                <div className="col-span-2 flex items-center gap-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-600 shrink-0">Origen:</span>
                  <span className="text-[10px] truncate font-medium text-black">{salida.nombreOrigen}</span>
                </div>
                <div className="col-span-2 flex items-center gap-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-600 shrink-0">Destino:</span>
                  <span className="text-[10px] truncate font-medium text-black">{salida.nombreDestino}</span>
                </div>
                <div className="col-span-2 flex items-center gap-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-gray-600 shrink-0">Fecha:</span>
                  <span className="text-[10px] truncate font-medium text-black">{dateObj ? format(dateObj, "dd/MM/yyyy HH:mm") : "N/A"}</span>
                </div>
            </div>

            {/* Table */}
            <div className="document-table flex-1 w-full relative z-10 bg-white">
              <table className="w-full table-fixed text-left border-collapse border-b border-black">
                <thead>
                  <tr className="bg-gray-100 text-black border-b-2 border-black">
                    <th className="py-0.5 px-1 text-[10px] font-bold uppercase w-6 text-center border-r border-gray-300">#</th>
                    {/* Catálogo aprobado (154): 106 px útiles cubren 141 nombres; p90=103.65 px y 13 extremos conservan elipsis. */}
                    <th className="py-0.5 px-1 text-[10px] font-bold uppercase w-[112px] border-r border-gray-300">Producto</th>
                    <th className="py-0.5 px-1 text-[10px] font-bold uppercase w-[84px] border-r border-gray-300">Color</th>
                    <th className="py-0.5 px-1 text-[10px] font-bold uppercase w-14 text-center border-r border-gray-300 leading-tight">No. de<br/>Rollos</th>
                    <th className="py-0.5 px-1 text-[10px] font-bold uppercase w-[84px] text-right border-r border-gray-300 leading-tight">Cant. de<br/>Unidad</th>
                    <th className="py-0.5 px-1 text-[10px] font-bold uppercase w-[74px] border-r border-gray-300">SKU</th>
                    <th className="py-0.5 px-1 text-[10px] font-bold uppercase w-[107px] leading-tight">No. de<br/>Serie</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRollos.map((rollo, index) => {
                    const line = salida.lineas.find(l => l.id === rollo.lineaId);
                    const globalIndex = pageIndex * rollosPerPage + index + 1;
                    return (
                      <tr key={index} className="border-b border-gray-200 h-[17px] even:bg-gray-50/50">
                        <td className="py-0.5 px-1 text-center text-gray-600 text-[10px] border-r border-gray-200 font-medium">{globalIndex}</td>
                        <td className="py-0.5 px-1 text-[10px] text-gray-900 truncate border-r border-gray-200">
                          {line?.telaProducto}
                        </td>
                        <td className="py-0.5 px-1 text-[10px] text-gray-900 truncate border-r border-gray-200">
                          {line?.colorProducto}
                        </td>
                        <td className="py-0.5 px-1 text-[10px] text-gray-900 text-center border-r border-gray-200">1</td>
                        <td className="py-0.5 px-1 text-right text-[10px] font-medium text-black border-r border-gray-200">{formatNumber(rollo.cantidadEnviada, { kind: "quantity" })} {formatUnit(line?.unidadProducto)}</td>
                        <td className="py-0.5 px-1 text-[10px] text-gray-700 border-r border-gray-200">{line?.skuProducto}</td>
                        <td className="py-0.5 px-1 font-mono font-bold text-[10px] text-black border-r border-gray-200">{rollo.serie}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, rollosPerPage - pageRollos.length) }).map((_, i) => (
                    <tr key={`pad-${i}`} className="border-b border-gray-200 h-[17px] even:bg-gray-50/50">
                      <td className="border-r border-gray-200"></td>
                      <td className="border-r border-gray-200"></td>
                      <td className="border-r border-gray-200"></td>
                      <td className="border-r border-gray-200"></td>
                      <td className="border-r border-gray-200"></td>
                      <td className="border-r border-gray-200"></td>
                      <td className="border-r border-gray-200"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="document-footer px-2 pb-1.5 mt-auto shrink-0 flex gap-3 w-full relative z-10 bg-white">
                <div className="w-[55%] flex flex-col gap-1.5 justify-end">
                  <div className="border border-gray-300 rounded p-1 h-8 overflow-hidden bg-gray-50/50">
                    <div className="text-[10px] font-bold uppercase leading-none text-gray-600">Observaciones</div>
                    <div className="text-[10px] leading-tight mt-0.5 truncate text-gray-900 font-medium">
                      {salida.notaEnvio || salida.observaciones || "Sin observaciones."}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 h-10 items-end">
                    <div className="border-t border-black pt-0.5 text-center text-[10px] font-bold text-gray-700 leading-none">Revisó</div>
                    <div className="border-t border-black pt-0.5 text-center text-[10px] font-bold text-gray-700 leading-none">Entregó</div>
                    <div className="border-t border-black pt-0.5 text-center text-[10px] font-bold text-gray-700 leading-none">Recibió</div>
                  </div>
                </div>
                <div className="flex-1 flex justify-end items-end">
                  <table className="w-[90%] text-[10px] border-collapse border border-gray-300">
                    <tbody>
                      <tr>
                        <td className="py-0.5 px-1 border border-gray-300 font-bold bg-gray-100 text-gray-700 w-1/2">Total Rollos</td>
                        <td className="py-0.5 px-1 border border-gray-300 text-right font-black text-black w-1/2">{formatNumber(salida.totalRollos ?? (salida.rollos?.length || 0), { kind: "count" })}</td>
                      </tr>
                      {Number(salida.totalMetros) > 0 && (
                      <tr>
                        <td className="py-0.5 px-1 border border-gray-300 font-bold bg-gray-100 text-gray-700">Total {formatUnit("METRO")}</td>
                        <td className="py-0.5 px-1 border border-gray-300 text-right font-black text-black">{formatNumber(salida.totalMetros, { kind: "quantity" })}</td>
                      </tr>
                      )}
                      {Number(salida.totalKilos) > 0 && (
                      <tr>
                        <td className="py-0.5 px-1 border border-gray-300 font-bold bg-gray-100 text-gray-700">Total {formatUnit("KILO")}</td>
                        <td className="py-0.5 px-1 border border-gray-300 text-right font-black text-black">{formatNumber(salida.totalKilos, { kind: "quantity" })}</td>
                      </tr>
                      )}
                      {Number(salida.totalBolsas) > 0 && (
                      <tr>
                        <td className="py-0.5 px-1 border border-gray-300 font-bold bg-gray-100 text-gray-700">Total {formatUnit("BOLSA")}</td>
                        <td className="py-0.5 px-1 border border-gray-300 text-right font-black text-black">{formatNumber(salida.totalBolsas, { kind: "quantity" })}</td>
                      </tr>
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
