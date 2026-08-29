import { useParams } from "wouter";
import { useGetEntrada, getGetEntradaQueryKey } from "@workspace/api-client-react";
import { BrandLogo } from "@/components/brand-logo";
import { format } from "date-fns";
import { Loader2, Printer, User, Calendar, Truck, Clock, Hash, FileDigit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { QRCodeSVG } from "qrcode.react";

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
  const totalQty = entrada.lineas.reduce((sum, line) => sum + parseFloat(line.cantidadTotal), 0);
  const documentPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/entradas/${entrada.id}/documento`;
  const documentUrl = new URL(documentPath, window.location.origin).toString();

  const rowsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(entrada.lineas.length / rowsPerPage));
  const pages = Array.from({ length: totalPages }).map((_, i) => entrada.lineas.slice(i * rowsPerPage, (i + 1) * rowsPerPage));

  return (
    <div className="min-h-[100dvh] bg-muted/20 flex flex-col">
      <div className="no-print sticky top-0 z-10 flex flex-col gap-3 border-b bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold">Vista previa de impresión</h1>
        <Button className="w-full sm:w-auto" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir / Guardar PDF
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-8 flex flex-col items-center gap-8 print:p-0 print:block">
        {pages.map((pageLineas, pageIndex) => (
          <div key={pageIndex} className="document-page entrada-page-print bg-white shadow-xl print:shadow-none w-[216mm] h-[279mm] relative box-border flex flex-col overflow-hidden shrink-0">

            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-2 h-16 bg-[#1e3a8a] mr-2"></div>
                <h1 className="text-5xl font-black text-[#1e3a8a] tracking-tighter">ENTRADA</h1>
                <div className="ml-4 text-[#1e3a8a] font-bold text-xl leading-tight border-l-2 pl-4 border-gray-300">
                  MARIANA<br/>TEXTIL
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <QRCodeSVG
                    value={documentUrl}
                    size={64}
                    level="M"
                    includeMargin
                    aria-label={`QR para ver entrada ${entrada.folioFormateado}`}
                  />
                  <span className="text-[8px] font-bold uppercase">ESCANEAR PARA VER</span>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 font-medium">MARIANA TEXTIL S.A. DE C.V.</div>
                  <div className="text-sm font-semibold mt-1">Página {pageIndex + 1} de {totalPages}</div>
                </div>
                <div className="w-px h-12 bg-gray-300"></div>
                <BrandLogo variant="mark" className="w-12 h-12" />
              </div>
            </div>

            {/* Form Data */}
            <div className="px-8 py-4 shrink-0">
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
                  <FileDigit className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="font-bold w-32 text-xs uppercase text-gray-500 tracking-wider">Número de Prov.</span>
                  <span className="font-medium text-sm text-black">{entrada.proveedorId || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="px-8 mt-2 flex-1 relative z-10 flex flex-col">
              <table className="w-full text-left border-collapse border border-gray-200">
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
                      <tr key={index} className="border-b border-gray-200 even:bg-gray-50">
                        <td className="py-1 px-3 text-center text-gray-500 text-xs">{formatNumber(globalIndex, { kind: "count" })}</td>
                        <td className="py-1 px-3 font-bold text-xs text-black truncate max-w-[250px]">{linea.skuProducto} - {linea.telaProducto} {linea.colorProducto}</td>
                        <td className="py-1 px-3 text-center font-bold text-xs">{formatNumber(linea.rollosCount, { kind: "count" })}</td>
                        <td className="py-1 px-3 text-right text-xs font-medium">{formatNumber(linea.cantidadTotal, { kind: "quantity" })} {formatUnit(linea.unidadProducto)}</td>
                        <td className="py-1 px-3 font-mono text-[10px] text-gray-600">{linea.skuProducto}</td>
                        <td className="py-1 px-3 text-xs text-gray-800">{entrada.nombreUbicacion}</td>
                      </tr>
                    );
                  })}
                  {/* Padding rows to ensure exact filling */}
                  {Array.from({ length: Math.max(0, rowsPerPage - pageLineas.length) }).map((_, i) => (
                    <tr key={`pad-${i}`} className="border-b border-gray-100 h-[28px]">
                      <td></td><td></td><td></td><td></td><td></td><td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {pageIndex === totalPages - 1 && (
              <div className="px-8 mt-auto pb-4 shrink-0 relative z-10">
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

            <div className={`h-4 bg-[#1e3a8a] w-full shrink-0 ${pageIndex < totalPages - 1 ? 'mt-auto' : ''}`}></div>

          </div>
        ))}
      </div>
    </div>
  );
}