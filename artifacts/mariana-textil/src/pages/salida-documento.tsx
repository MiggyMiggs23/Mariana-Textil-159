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
  const isVentaCliente = salida.modalidad === "VENTA_CLIENTE";
  const qrUrl = isVentaCliente ? undefined : absoluteAppUrl(`/salidas?tab=recepcion&id=${salida.id}`);

  /*
   * This is a measured pagination contract, not a visual guess. The PDF
   * regression measures the rendered A5 page at 96 dpi after the shared
   * 5.25 mm page-box inset is applied (the 0.25 mm allowance protects the
   * 0.35 mm cell rules from raster rounding). With the 112 px logo/QR,
   * compact metadata, the measured product-row height, and the indivisible
   * observations/totals/signatures footer, ten rows fit in the 199.5 ×
   * 137.5 mm inner frame. The boundary scenario is eleven rows: it must
   * paginate as ten plus one, while one and ten remain one complete page.
   * Actual print-media measurements from the 96 dpi PDF harness are:
   * page 793.6875 × 559.359375 px, inner frame x/y 19.828125 px with
   * 754.03125 × 519.703125 px content, header 137.09375 px, metadata 37 px,
   * table 257.109375 px, footer 86.5 px, and ten body rows occupying
   * 225.609375 px (the first row is 24.140625 px for the one-row fixture,
   * otherwise 23.0625 px; remaining rows are 22.375–22.546875 px).
   * The emitted 594.96 × 420 pt PDFs rasterize at 794 × 560 px; every page
   * in the 1/10/11-row scenarios has measured ink bounds x/y 20 px and
   * width/height 754 × 520 px. Relative to the actual PDF media box, ink
   * clearance is 5.2917 mm left/top, 5.1012 mm right and 5.2917 mm bottom:
   * all exceed 5 mm (the raster canvas rounding is not counted as paper).
   * Re-measure this constant whenever any header, metadata, row, or footer
   * dimension changes.
   */
  const SALIDA_PRODUCT_ROWS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(salida.lineas.length / SALIDA_PRODUCT_ROWS_PER_PAGE));
  const pages = Array.from({ length: totalPages }).map((_, i) =>
    salida.lineas.slice(i * SALIDA_PRODUCT_ROWS_PER_PAGE, (i + 1) * SALIDA_PRODUCT_ROWS_PER_PAGE),
  );

  return (
    <div className="salida-document-shell min-h-[100dvh] bg-muted/20 flex flex-col">
      <div className="no-print p-4 border-b bg-background sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/salidas/${salida.id}`}>
            <Button variant="ghost" size="icon" data-testid="doc-back-button" aria-label="Volver al detalle">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="font-bold">Vista previa de impresión (SALIDA - A5 horizontal)</h1>
        </div>
        <Button onClick={() => void printWhenReady("print-salida")} data-testid="doc-print-button">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="salida-print-root flex-1 overflow-auto p-8 flex flex-col items-center gap-8 print:p-0 print:block">
        {pages.map((pageLineas, pageIndex) => (
          <div
            key={pageIndex}
            data-testid={`document-page-${pageIndex + 1}`}
            data-row-capacity={SALIDA_PRODUCT_ROWS_PER_PAGE}
            className={`document-page salida-page-print bg-transparent shadow-xl print:shadow-none w-[210mm] h-[148mm] p-[5.25mm] relative box-border flex flex-col shrink-0 ${pageIndex < totalPages - 1 ? "page-break" : ""}`}
          >
            <div className="salida-page-frame relative flex min-h-0 flex-1 flex-col border border-gray-300 bg-white">
              {salida.estado === "CANCELADA" && (
                <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-10">
                  <span className="rounded-xl border-4 border-red-600 p-4 text-6xl font-black tracking-widest text-red-600 rotate-[-30deg]">
                    CANCELADA
                  </span>
                </div>
              )}

              {/* Header */}
              <PrintableDocumentHeader
                className="document-header relative z-10 shrink-0 bg-white p-1"
                qrUrl={qrUrl}
                qrLabel={`QR para abrir salida ${salida.folioFormateado}`}
                logoSize={DOCUMENT_QR_SIZE}
                qrSize={DOCUMENT_QR_SIZE}
                qrWrapperClassName="salida-qr-white-pad bg-white p-[2mm]"
              >
                <div className="flex items-center gap-4">
                  <div className="mr-2 h-16 w-2 bg-[#1e3a8a]"></div>
                  <div>
                    <h1 className="text-5xl font-black leading-none tracking-tighter text-[#1e3a8a]">Salida</h1>
                    <div className="mt-1 text-sm font-bold uppercase text-gray-700">Mariana Textil</div>
                    <div className="mt-0.5 text-sm font-black leading-tight text-red-600" data-testid="doc-folio">{salida.folioFormateado}</div>
                    <div className="text-[10px] font-bold text-gray-600">Pág {pageIndex + 1}/{totalPages}</div>
                  </div>
                </div>
              </PrintableDocumentHeader>

              {/* Form Data */}
              <div className="document-metadata relative z-10 grid shrink-0 grid-cols-6 gap-x-2 gap-y-0.5 border-b border-black bg-gray-50 px-2 py-0.5">
                <div className="col-span-3 flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[10px] font-bold uppercase text-gray-600">Generó:</span>
                  <span className="break-words text-[10px] font-medium text-black">{salida.nombreArmadoPor || "N/A"}</span>
                </div>
                <div className="col-span-3 flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[10px] font-bold uppercase text-gray-600">Entregó:</span>
                  <span className="break-words text-[10px] font-medium text-black" data-testid="doc-transportista">{salida.viaje ? `${salida.viaje.nombreCamioneta} · ${salida.viaje.nombreChofer}` : salida.transportista || "N/A"}</span>
                </div>
                <div className="col-span-2 flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[10px] font-bold uppercase text-gray-600">Origen:</span>
                  <span className="break-words text-[10px] font-medium text-black" data-testid="doc-origin-name">{salida.nombreOrigen}</span>
                </div>
                <div className="col-span-2 flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[10px] font-bold uppercase text-gray-600">Destino:</span>
                  <span className="break-words text-[10px] font-medium text-black" data-testid="doc-destination-name">{isVentaCliente ? "Cliente recoge en origen" : salida.nombreDestino}</span>
                </div>
                <div className="col-span-2 flex min-w-0 items-center gap-1">
                  <span className="shrink-0 text-[10px] font-bold uppercase text-gray-600">Fecha:</span>
                  <span className="break-words text-[10px] font-medium text-black">{dateObj ? format(dateObj, "dd/MM/yyyy HH:mm") : "N/A"}</span>
                </div>
                {isVentaCliente && (
                  <div className="col-span-6 border-2 border-amber-600 bg-amber-50 px-2 py-0.5 text-center text-[10px] font-black uppercase text-amber-900">
                    MERCANCÍA PERMANECE EN EL ORIGEN · EL CLIENTE RECOGE EN ESTE SITIO
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="document-table relative z-10 flex min-h-0 w-full flex-1 bg-white">
                <table className="document-product-grid w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#1e3a8a] text-white">
                      <th className="w-6 border-r border-white px-1 py-0.5 text-center text-[10px] font-black uppercase">#</th>
                      <th className="w-[172px] border-r border-white px-1 py-0.5 text-[10px] font-black uppercase">Producto</th>
                      <th className="w-[100px] border-r border-white px-1 py-0.5 text-[10px] font-black uppercase">Color</th>
                      <th className="w-16 border-r border-white px-1 py-0.5 text-center text-[10px] font-black uppercase leading-tight">No. de<br/>Rollos</th>
                      <th className="w-[100px] border-r border-white px-1 py-0.5 text-right text-[10px] font-black uppercase leading-tight">Cant. de<br/>Unidad</th>
                      <th className="px-1 py-0.5 text-[10px] font-bold uppercase">SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageLineas.map((line, index) => {
                      const globalIndex = pageIndex * SALIDA_PRODUCT_ROWS_PER_PAGE + index + 1;
                      return (
                        <tr key={line.id} className="h-[19px] border-b border-gray-200 even:bg-gray-50/50">
                          <td className="border-r border-gray-200 px-1 py-0.5 text-center text-[10px] font-medium text-gray-600">{globalIndex}</td>
                          <td className="break-words border-r border-gray-200 px-1 py-0.5 text-[10px] text-gray-900">
                            {line.telaProducto}
                          </td>
                          <td className="break-words border-r border-gray-200 px-1 py-0.5 text-[10px] text-gray-900">
                            {line.colorProducto}
                          </td>
                          <td className="border-r border-gray-200 px-1 py-0.5 text-center text-[10px] text-gray-900">{formatNumber(line.rollosEnviados, { kind: "count" })}</td>
                          <td className="border-r border-gray-200 px-1 py-0.5 text-right text-[10px] font-medium text-black">{formatNumber(line.cantidadEnviada, { kind: "quantity" })} {formatUnit(line.unidadProducto)}</td>
                          <td className="break-words px-1 py-0.5 text-[10px] text-gray-700">{line.skuProducto}</td>
                        </tr>
                      );
                    })}
                    {Array.from({ length: Math.max(0, SALIDA_PRODUCT_ROWS_PER_PAGE - pageLineas.length) }).map((_, i) => (
                      <tr key={`pad-${i}`} className="h-[19px] border-b border-gray-200 even:bg-gray-50/50">
                        <td className="border-r border-gray-200"></td>
                        <td className="border-r border-gray-200"></td>
                        <td className="border-r border-gray-200"></td>
                        <td className="border-r border-gray-200"></td>
                        <td className="border-r border-gray-200"></td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="document-footer relative z-10 mt-auto flex w-full shrink-0 gap-3 bg-white px-2 pb-1.5">
                <div className="flex w-[55%] flex-col justify-end gap-1.5">
                  <div className="min-h-8 rounded border border-gray-300 bg-gray-50/50 p-1">
                    <div className="text-[10px] font-bold uppercase leading-none text-gray-600">Observaciones</div>
                    <div className="mt-0.5 break-words text-[10px] font-medium leading-tight text-gray-900">
                      {salida.notaEnvio || salida.observaciones || "Sin observaciones."}
                    </div>
                  </div>
                  <div className="grid h-10 grid-cols-3 items-end gap-2">
                    <div className="border-t border-black pt-0.5 text-center text-[10px] font-bold leading-none text-gray-700">Revisó</div>
                    <div className="border-t border-black pt-0.5 text-center text-[10px] font-bold leading-none text-gray-700">Entregó</div>
                    <div className="border-t border-black pt-0.5 text-center text-[10px] font-bold leading-none text-gray-700">Recibió</div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 items-end justify-end">
                  <table className="w-[90%] border-collapse border border-gray-300 text-[10px]">
                    <tbody>
                      <tr>
                        <td className="w-1/2 border border-gray-300 bg-gray-100 px-1 py-0.5 font-bold text-gray-700">Total Rollos</td>
                        <td className="w-1/2 border border-gray-300 px-1 py-0.5 text-right font-black text-black">{formatNumber(salida.totalRollos ?? (salida.rollos?.length || 0), { kind: "count" })}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 bg-gray-100 px-1 py-0.5 font-bold text-gray-700">Total {formatUnit("METRO")}</td>
                        <td className="border border-gray-300 px-1 py-0.5 text-right font-black text-black">{formatNumber(salida.totalMetros ?? 0, { kind: "quantity" })}</td>
                      </tr>
                      {Number(salida.totalKilos) > 0 && (
                        <tr>
                          <td className="border border-gray-300 bg-gray-100 px-1 py-0.5 font-bold text-gray-700">Total {formatUnit("KILO")}</td>
                          <td className="border border-gray-300 px-1 py-0.5 text-right font-black text-black">{formatNumber(salida.totalKilos, { kind: "quantity" })}</td>
                        </tr>
                      )}
                      {Number(salida.totalBolsas) > 0 && (
                        <tr>
                          <td className="border border-gray-300 bg-gray-100 px-1 py-0.5 font-bold text-gray-700">Total {formatUnit("BOLSA")}</td>
                          <td className="border border-gray-300 px-1 py-0.5 text-right font-black text-black">{formatNumber(salida.totalBolsas, { kind: "quantity" })}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}