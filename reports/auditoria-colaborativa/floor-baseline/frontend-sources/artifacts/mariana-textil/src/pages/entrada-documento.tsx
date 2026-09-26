import { useParams } from "wouter";
import { useGetEntrada, getGetEntradaQueryKey } from "@workspace/api-client-react";
import { PrintableDocumentHeader } from "@/components/printable-document-header";
import { DOCUMENT_QR_SIZE } from "@/components/document-qr-code";
import { format } from "date-fns";
import { Loader2, Printer, User, Calendar, Truck, Clock, Hash, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { absoluteAppUrl, printWhenReady } from "@/lib/print";

export default function EntradaDocumento() {
  const { id } = useParams();
  const { data: entrada, isLoading } = useGetEntrada(Number(id), {
    query: { enabled: !!id, queryKey: getGetEntradaQueryKey(Number(id)) }
  });

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

  const createdAt = new Date(entrada.createdAt);
  const documentUrl = absoluteAppUrl(`/entradas/${entrada.id}/documento`);

  /*
   * Under the fixture's existing long-label wrapping, the long SKU/Sitio labels
   * wrap into multiple lines (up to three in a measured cell), making each
   * populated bordered global row 54 px tall. That is fixture-specific rather
   * than a universal maximum for shorter site labels. The tela/color cell below
   * deliberately keeps both complete labels on separate lines, so it must not
   * use truncation to meet this measured invariant. At 96 CSS px/in the 5.25
   * mm inset leaves a 774.828125 × 1012.9375 px frame. The full 10-row table
   * occupies 590 px (y=329.828125 to 919.828125), followed by the 96 px footer
   * and 16 px bottom strip; all fit before frame y=1032.765625. An eleventh 54 px row exceeds
   * that full-footer reserve. PDF probes 1/10/11/12 preserve all content, including dedicated
   * series sheets, with ink at least 5.2917 mm from every physical PDF edge.
   */
  const rowsPerPage = 10;
  const globalPageCount = Math.max(1, Math.ceil(entrada.lineas.length / rowsPerPage));
  const globalPages = Array.from({ length: globalPageCount }).map((_, i) =>
    entrada.lineas.slice(i * rowsPerPage, (i + 1) * rowsPerPage),
  );

  const rollosByProducto = new Map<number, typeof entrada.rollos>();
  for (const rollo of entrada.rollos) {
    const productRollos = rollosByProducto.get(rollo.productoId) ?? [];
    productRollos.push(rollo);
    rollosByProducto.set(rollo.productoId, productRollos);
  }
  const seriesPerRow = 4;
  const seriesRows = entrada.lineas.flatMap((linea) => {
    const productRollos = rollosByProducto.get(linea.productoId) ?? [];
    return Array.from({ length: Math.ceil(productRollos.length / seriesPerRow) }).map((_, chunkIndex) => ({
      productoId: linea.productoId,
      producto: `${linea.telaProducto} ${linea.colorProducto}`,
      sku: linea.skuProducto,
      isFirstChunk: chunkIndex === 0,
      series: productRollos.slice(chunkIndex * seriesPerRow, (chunkIndex + 1) * seriesPerRow),
    }));
  });

  // Laser PDF validation: 22 compact series rows fit on one standalone sheet.
  // With the 5.25 mm inset, its frame is 1012.9375 CSS px high at 96 px/in.
  // The 40/41-row PDFs contain 22 + 18/19 complete rows on their series sheets,
  // with all serials present and ink clearance >=5.2917 mm on every edge.
  const seriesRowsPerPage = 22;
  // Cada fila global medida libera 54 px. La sección incrustada necesita 68 px
  // fijos (separación, título y cabecera) más 24 px por fila.
  const measuredGlobalRowHeightPx = 54;
  const measuredSeriesRowHeightPx = 24;
  const embeddedSeriesOverheadPx = 68;
  const lastGlobalLineCount = globalPages.at(-1)?.length ?? 0;
  // The full-footer raster probe validates only one embedded series row;
  // larger lists stay on dedicated series sheets instead of crowding footer
  // ink into the lower safe band.
  const embeddedSeriesRowsCapacity = Math.min(
    1,
    Math.max(
      0,
      Math.floor(
        ((rowsPerPage - lastGlobalLineCount) * measuredGlobalRowHeightPx -
          embeddedSeriesOverheadPx) /
          measuredSeriesRowHeightPx,
      ),
    ),
  );
  const embedsAllSeries =
    seriesRows.length > 0 && seriesRows.length <= embeddedSeriesRowsCapacity;
  const standaloneSeriesRows = embedsAllSeries ? [] : seriesRows;
  const seriesPageCount = Math.ceil(standaloneSeriesRows.length / seriesRowsPerPage);
  const seriesPages = Array.from({ length: seriesPageCount }).map((_, i) =>
    standaloneSeriesRows.slice(i * seriesRowsPerPage, (i + 1) * seriesRowsPerPage),
  );
  const totalPages = globalPages.length + seriesPages.length;

  const renderGlobalHeader = (pageNumber: number) => (
    <PrintableDocumentHeader
      className="document-header shrink-0 p-6"
      qrUrl={documentUrl}
      qrLabel={`QR para ver entrada ${entrada.folioFormateado}`}
      logoSize={DOCUMENT_QR_SIZE}
    >
      <div className="flex items-center gap-4">
        <div className="w-2 h-16 bg-[#1e3a8a] mr-2"></div>
        <div>
          <h1 className="text-5xl font-black text-[#1e3a8a] tracking-tighter">ENTRADA</h1>
          <div className="text-sm font-semibold mt-1">Página {pageNumber} de {totalPages}</div>
        </div>
      </div>
    </PrintableDocumentHeader>
  );

  const renderSeriesHeader = (pageNumber: number) => (
    <div className="series-page-header h-10 shrink-0 border-b border-[#1e3a8a] px-8 flex items-center justify-between gap-6 text-xs text-black">
      <div className="min-w-0">
        <span className="font-semibold uppercase text-gray-600">Folio </span>
        <span className="font-black text-red-600">{entrada.folioFormateado}</span>
      </div>
      <div className="font-black uppercase tracking-wider text-[#1e3a8a]">Listado de series</div>
      <div className="whitespace-nowrap font-semibold">Página {pageNumber} de {totalPages}</div>
    </div>
  );

  return (
    <div className="entrada-document-shell min-h-[100dvh] bg-muted/20 flex flex-col">
      <div className="no-print sticky top-0 z-10 flex flex-col gap-3 border-b bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold">Vista previa de impresión</h1>
        <Button className="w-full sm:w-auto" onClick={() => void printWhenReady("print-entrada")}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="entrada-print-root flex-1 overflow-auto p-8 flex flex-col items-center gap-8 print:overflow-visible print:p-0 print:block">
        {globalPages.map((pageLineas, pageIndex) => {
          const isLastGlobalPage = pageIndex === globalPages.length - 1;
          const embeddedRows = isLastGlobalPage && embedsAllSeries ? seriesRows : [];
          return (
          <div
            key={`global-${pageIndex}`}
            data-page-kind="global"
            className="document-page entrada-page-print w-[216mm] h-[279mm] p-[5.25mm] relative box-border flex flex-col overflow-visible shrink-0"
          >
            <div className="document-page-frame relative min-h-0 min-w-0 flex-1 border border-gray-200 bg-white shadow-xl print:shadow-none flex flex-col overflow-visible">

            {/* Header */}
            {renderGlobalHeader(pageIndex + 1)}

            {/* Form Data */}
            <div className="document-metadata px-8 py-4 shrink-0">
              <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Usuario</span>
                  <span className="font-medium text-sm text-black">{entrada.nombreUsuario}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <Clock className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Hora</span>
                  <span className="font-medium text-sm text-black">{format(createdAt, "HH:mm")} hrs</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Fecha</span>
                  <span className="font-medium text-sm text-black">{format(createdAt, "dd/MM/yyyy")}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <Hash className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">No. Folio</span>
                  <span className="font-bold text-sm text-red-600">{entrada.folioFormateado}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <Truck className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Proveedor</span>
                  <span className="font-medium text-sm text-black">{entrada.nombreProveedor || "N/A"}</span>
                </div>
                <div className="flex items-center border-b border-gray-300 pb-1">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Sitio</span>
                  <span className="font-medium text-sm text-black">{entrada.nombreUbicacion || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className={`document-table px-8 mt-2 relative z-10 flex flex-col ${embeddedRows.length > 0 ? "shrink-0" : "flex-1"}`}>
              <table className="document-product-grid w-full text-left border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-[#1e3a8a] text-white">
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider w-10 text-center">#</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider">Producto</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-center">Cantidad de Rollos</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider text-right">Cantidad / unidad</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider">SKU</th>
                    <th className="py-2 px-3 text-xs font-bold uppercase tracking-wider">Sitio</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLineas.map((linea, index) => {
                    const globalIndex = pageIndex * rowsPerPage + index + 1;
                    return (
                      <tr key={index} className="h-[25px] border-b border-gray-200 even:bg-gray-50">
                        <td className="py-1 px-3 text-center text-gray-500 text-xs">{formatNumber(globalIndex, { kind: "count" })}</td>
                        <td className="document-product-name py-1 px-3 text-xs text-black max-w-[250px]">
                          <span className="block break-words leading-tight font-bold">{linea.telaProducto}</span>
                          <span className="block break-words leading-tight font-medium text-gray-700">{linea.colorProducto}</span>
                        </td>
                        <td className="py-1 px-3 text-center font-bold text-xs">{formatNumber(linea.rollosCount, { kind: "count" })}</td>
                        <td className="py-1 px-3 text-right text-xs font-medium">{formatNumber(linea.cantidadTotal, { kind: "quantity" })} {formatUnit(linea.unidadProducto)}</td>
                        <td className="py-1 px-3 font-mono text-[10px] text-gray-600">{linea.skuProducto}</td>
                        <td className="py-1 px-3 text-xs text-gray-800">{entrada.nombreUbicacion}</td>
                      </tr>
                    );
                  })}
                  {/* Padding rows to ensure exact filling */}
                  {Array.from({ length: embeddedRows.length > 0 ? 0 : Math.max(0, rowsPerPage - pageLineas.length) }).map((_, i) => (
                    <tr key={`pad-${i}`} className="h-[25px] border-b border-gray-100">
                      <td></td><td></td><td></td><td></td><td></td><td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {embeddedRows.length > 0 && (
              <div className="embedded-series px-8 mt-2 shrink-0 relative z-10">
                <div className="h-7 flex items-center border-b border-[#1e3a8a] text-xs font-black uppercase tracking-wider text-[#1e3a8a]">
                  Listado de series
                </div>
                <table className="w-full table-fixed text-left border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                      <th className="w-[240px] py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider">Producto</th>
                      <th className="w-[92px] py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider">SKU</th>
                      {Array.from({ length: seriesPerRow }).map((_, index) => (
                        <th key={index} className="py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider">
                          Serie {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {embeddedRows.map((row, rowIndex) => (
                      <tr
                        key={`embedded-${row.productoId}-${rowIndex}`}
                        data-product-id={row.productoId}
                        className={`h-6 border-b border-gray-200 even:bg-gray-50 ${row.isFirstChunk ? "border-t-2 border-t-gray-400" : ""}`}
                      >
                        <td className="py-0.5 px-2 text-[11px] leading-none font-bold text-black truncate">{row.producto}</td>
                        <td className="py-0.5 px-2 text-[11px] leading-none font-mono text-gray-700 truncate">{row.sku}</td>
                        {Array.from({ length: seriesPerRow }).map((_, seriesIndex) => (
                          <td key={seriesIndex} className="py-0.5 px-2 text-[11px] leading-none font-mono font-bold text-black">
                            {row.series[seriesIndex]?.serie ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            {isLastGlobalPage && (
              <div className="document-footer px-8 mt-auto pb-4 shrink-0 relative z-10">
                <div className="flex justify-between items-end gap-8">
                  {/* Observaciones */}
                  <div className="w-[30%] bg-gray-50 border border-gray-200 rounded-md p-3 h-20">
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Observaciones</div>
                    <div className="text-[10px] text-black italic leading-tight">
                      {entrada.observaciones || "Sin observaciones."}
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="flex-1 grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-12"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">Recibido por</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-12"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">Revisado por</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-black w-full mb-1 h-12"></div>
                      <div className="text-[10px] font-bold uppercase text-gray-700 tracking-wider">Autorizado por</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="h-4 bg-[#1e3a8a] w-full shrink-0 mt-auto"></div>

            </div>
          </div>
          );
        })}
        {seriesPages.map((pageRows, seriesPageIndex) => {
          const pageNumber = globalPages.length + seriesPageIndex + 1;
          return (
            <div
              key={`series-${seriesPageIndex}`}
              data-page-kind="series"
               className="document-page entrada-page-print w-[216mm] h-[279mm] p-[5.25mm] relative box-border flex flex-col overflow-visible shrink-0"
            >
              <div className="document-page-frame relative min-h-0 min-w-0 flex-1 border border-gray-200 bg-white shadow-xl print:shadow-none flex flex-col overflow-visible">
              {renderSeriesHeader(pageNumber)}

               <div className="series-table min-h-0 overflow-visible px-8 py-2 flex-1 relative z-10">
                <table className="w-full table-fixed text-left border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                      <th className="w-[240px] py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider">Producto</th>
                      <th className="w-[92px] py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider">SKU</th>
                      {Array.from({ length: seriesPerRow }).map((_, index) => (
                        <th key={index} className="py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider">
                          Serie {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, rowIndex) => (
                      <tr
                        key={`${row.productoId}-${seriesPageIndex}-${rowIndex}`}
                        data-product-id={row.productoId}
                        className={`h-6 border-b border-gray-200 even:bg-gray-50 ${row.isFirstChunk ? "border-t-2 border-t-gray-400" : ""}`}
                      >
                        <td className="py-0.5 px-2 text-[11px] leading-none font-bold text-black truncate">{row.producto}</td>
                        <td className="py-0.5 px-2 text-[11px] leading-none font-mono text-gray-700 truncate">{row.sku}</td>
                        {Array.from({ length: seriesPerRow }).map((_, seriesIndex) => (
                          <td key={seriesIndex} className="py-0.5 px-2 text-[11px] leading-none font-mono font-bold text-black">
                            {row.series[seriesIndex]?.serie ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}