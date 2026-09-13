import { useRoute, Link } from "wouter";
import { AppBackLink } from "@/lib/internal-navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetSalida,
  getGetSalidaQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  Role,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Clock,
  Printer,
  XSquare,
  Package,
  AlertCircle,
  Loader2,
  User,
  Truck,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-error";
import { hasPermission, Modules } from "@/lib/permisos";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { SalidaEstadoBadge } from "@/components/salida-estado-badge";
import { SalidaCancelDialog } from "@/components/salida-cancel-dialog";

export default function SalidaDetail() {
  const [, params] = useRoute("/salidas/:id");
  const id = Number(params?.id);

  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data: salida, isLoading, error } = useGetSalida(id, {
    query: {
      enabled: !isNaN(id),
      queryKey: getGetSalidaQueryKey(id),
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Cargando detalle...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !salida) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-red-500">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p className="font-medium">Error al cargar la salida</p>
          <p className="text-sm mt-1">{getApiErrorMessage(error)}</p>
          <AppBackLink fallbackHref="/salidas" className="mt-4 text-blue-600 hover:underline">Volver a Salidas</AppBackLink>
        </div>
      </AppLayout>
    );
  }

  const isAdmin = user?.rol === Role.ADMIN;
  const isCaja = user?.rol === Role.CAJA;
  const canAuthorize = hasPermission(user, Modules.SALIDAS, 'autorizar');

  const atOrigin = isAdmin || user?.ubicacion?.id === salida.origenId;
  const atDestination = isAdmin || user?.ubicacion?.id === salida.destinoId;

  const productSummary = (salida.lineas && salida.lineas.length > 0)
    ? salida.lineas.map(l => ({
        sku: l.skuProducto,
        tela: l.telaProducto,
        color: l.colorProducto,
        unidad: l.unidadProducto,
        rollos: l.rollosEnviados || l.rollosSolicitados || 0,
        cantidad: Number(l.cantidadEnviada) > 0 ? Number(l.cantidadEnviada) : Number(l.cantidadSolicitada)
      }))
    : Array.from(salida.rollos.reduce((acc, roll) => {
        const key = roll.productoId ?? 0;
        if (!acc.has(key)) {
          acc.set(key, {
            sku: roll.sku ?? "N/A",
            tela: roll.tela ?? "N/A",
            color: roll.color ?? "N/A",
            unidad: roll.unidad ?? "N/A",
            rollos: 0,
            cantidad: 0
          });
        }
        const current = acc.get(key)!;
        current.rollos += 1;
        current.cantidad += Number(roll.cantidadEnviada ?? 0);
        return acc;
      }, new Map<number, { sku: string, tela: string, color: string, unidad: string, rollos: number, cantidad: number }>()).values());

  const canCancel = !isCaja && salida.modalidad === "VENTA_CLIENTE"
    ? salida.estado !== "ENTREGADA" && salida.estado !== "CANCELADA" && (isAdmin || (canAuthorize && atOrigin))
    : salida.estado === 'ARMANDO' && (isAdmin || (canAuthorize && (atOrigin || atDestination)));
  const canPrint = salida.estado === 'EN_TRANSITO' || salida.estado === 'RECIBIDA' || salida.estado === 'ENTREGADA';

  return (
    <AppLayout>
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <AppBackLink fallbackHref="/salidas" data-testid="btn-back" aria-label="Volver" className="shrink-0 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </AppBackLink>
          </Button>
          <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 data-testid="salida-folio" className={`text-3xl font-bold tracking-tight ${salida.estado === 'CANCELADA' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
              Folio {salida.folioFormateado}
            </h1>
             <span data-testid={`status-${salida.estado.toLowerCase()}`}><SalidaEstadoBadge estado={salida.estado} modalidad={salida.modalidad} documentoVenta={salida.documentoVenta} autorizada={salida.autorizada} /></span>
            {salida.modalidad === "VENTA_CLIENTE" && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Venta a cliente</Badge>}
          </div>
           {salida.modalidad === "VENTA_CLIENTE" && (
             <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 p-3 text-sm">
               <strong>Cliente:</strong> {salida.nombreCliente || `Cliente #${salida.clienteId}`}
               <span className="mx-2">·</span>
               <strong>Mercancía:</strong> permanece en el origen para recolección del cliente.
               {salida.documentoVenta && (
                 <div className="mt-2">
                   Documento de venta: <Link className="text-primary underline" href={salida.documentoVenta.href.startsWith("/api") ? `/tickets/${salida.documentoVenta.id}` : salida.documentoVenta.href}>Folio {salida.documentoVenta.folio}</Link>
                   <span className="ml-2">{salida.autorizada ? "AUTORIZADA" : "Pendiente de autorización"}</span>
                 </div>
               )}
             </div>
           )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(salida.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {salida.nombreArmadoPor}
            </span>
          </div>
        </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          {canPrint && (
            <Link href={`/salidas/${salida.id}/documento/salida`} className="w-full sm:w-auto">
              <Button data-testid="btn-print-salida" variant="outline" className="w-full gap-2 bg-white sm:w-auto">
                <Printer className="w-4 h-4" /> Imprimir Documento
              </Button>
            </Link>
          )}
          {salida.estado === 'ARMANDO' && (
            <div className="w-full sm:w-auto">
              <Button
                data-testid="btn-print-salida-disabled"
                variant="outline"
                disabled
                className="w-full gap-2 sm:w-auto"
              >
                <Printer className="w-4 h-4" /> Imprimir Documento
              </Button>
              <p data-testid="print-salida-help" className="mt-1 max-w-xs text-xs text-slate-500">
                La hoja de traslado estará disponible cuando la mercancía esté en tránsito.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Rollos Incluidos ({formatNumber(salida.rollos.length, { kind: "count" })})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-100 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">Serie</th>
                      <th className="px-4 py-3 text-left font-medium">Producto</th>
                      <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salida.rollos.map((rollo, index) => {
                      const linea = salida.lineas.find(l => l.id === rollo.lineaId);
                      return (
                        <tr key={rollo.id} className={`hover:bg-slate-50/50 ${salida.estado === 'CANCELADA' ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3 text-slate-500 w-10">{formatNumber(index + 1, { kind: "count" })}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{rollo.serie}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800 truncate max-w-[200px]">{linea?.skuProducto}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{linea?.telaProducto} {linea?.colorProducto}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium text-slate-900">{formatNumber(rollo.cantidadEnviada, { kind: "quantity" })}</span>
                            <span className="text-[10px] ml-1 text-slate-400 font-bold tracking-wider">{formatUnit(linea?.unidadProducto)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50">
              <CardTitle className="text-base font-semibold">Resumen por Producto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar border-b border-slate-100">
                {productSummary.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">Sin productos</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {productSummary.map((item, i) => (
                      <div key={i} className="p-3 bg-white">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-sm text-slate-800 line-clamp-1" title={item.tela}>{item.tela}</span>
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0">{formatNumber(item.rollos, { kind: "count" })} rollos</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">{item.color} • {item.sku}</span>
                          <span className="text-sm font-bold text-primary">{formatNumber(item.cantidad, { kind: "quantity" })} <span className="text-[10px] font-bold text-slate-400">{formatUnit(item.unidad)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardContent className="pt-4 pb-5 space-y-4 bg-slate-50/50">
              <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Rollos</span>
                <span className="text-2xl font-black text-slate-900">{formatNumber(salida.totalRollos ?? salida.rollos.length, { kind: "count" })}</span>
              </div>
              {salida.totalMetros && Number(salida.totalMetros) > 0 && (
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Metros</span>
                  <span className="text-lg font-bold text-slate-700">{formatNumber(salida.totalMetros, { kind: "quantity" })}</span>
                </div>
              )}
              {salida.totalKilos && Number(salida.totalKilos) > 0 && (
                <div className="flex justify-between items-end pb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kilos</span>
                  <span className="text-lg font-bold text-slate-700">{formatNumber(salida.totalKilos, { kind: "quantity" })}</span>
                </div>
              )}
              {salida.totalBolsas && Number(salida.totalBolsas) > 0 && (
                <div className="flex justify-between items-end pb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{formatUnit("BOLSA")}</span>
                  <span className="text-lg font-bold text-slate-700">{formatNumber(salida.totalBolsas, { kind: "quantity" })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50">
              <CardTitle className="text-base font-semibold">Detalles del Envío</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  OR
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 tracking-wider">ORIGEN</p>
                  <p className="font-bold text-slate-900">{salida.nombreOrigen}</p>
                </div>
              </div>
              <div className="pl-5 border-l-2 border-slate-200 h-4 my-1 mx-2.5"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  DE
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 tracking-wider">DESTINO</p>
                   <p className="font-bold text-slate-900">{salida.modalidad === "VENTA_CLIENTE" ? "Sin destino: cliente recoge en origen" : salida.nombreDestino}</p>
                </div>
              </div>

              {(salida.transportista || salida.viaje || salida.observaciones || salida.notaEnvio) && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  {salida.viaje ? (
                    <div className="flex items-start gap-2 text-sm">
                      <Truck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div><span className="font-semibold block text-slate-700">Viaje:</span>
                        <Link className="text-primary underline" href={`/viajes/${salida.viaje.id}`}>#{salida.viaje.folio} · {salida.viaje.nombreCamioneta} ({salida.viaje.placasCamioneta}) · {salida.viaje.nombreChofer}</Link>
                      </div>
                    </div>
                  ) : salida.transportista && (
                    <div className="flex items-start gap-2 text-sm">
                      <Truck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-slate-700">Transportista:</span>
                        <span className="text-slate-600">{salida.transportista}</span>
                      </div>
                    </div>
                  )}
                  {(salida.observaciones || salida.notaEnvio) && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block text-slate-700">Observaciones:</span>
                        <span className="text-slate-600 italic">{salida.notaEnvio || salida.observaciones}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {canCancel && (
            <Card className="shadow-sm border-red-200 bg-red-50/50">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm text-red-600 font-medium">
                  Si hubo un error y esta salida no debe proceder, puedes cancelarla.
                </p>
                <SalidaCancelDialog
                  salida={salida}
                  user={user}
                  canCancel={canCancel}
                  renderTrigger={({ onClick }) => (
                    <Button
                      data-testid="btn-action-cancel"
                      onClick={onClick}
                      variant="outline"
                      className="w-full justify-start border-red-200 bg-white text-red-600 hover:bg-red-50"
                    >
                      <XSquare className="mr-2 h-4 w-4" /> Cancelar Salida
                    </Button>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {salida.estado === 'CANCELADA' && (
            <Card className="shadow-sm border-red-200 bg-red-50/50">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 text-sm">Salida Cancelada</h4>
                    <p className="text-sm text-red-600 mt-1">{salida.motivoCancelacion || "Sin motivo registrado"}</p>
                    {salida.nombreCanceladoPor && (
                      <p className="text-xs text-red-500 mt-2 font-medium">Por: {salida.nombreCanceladoPor}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
    </AppLayout>
  );
}
