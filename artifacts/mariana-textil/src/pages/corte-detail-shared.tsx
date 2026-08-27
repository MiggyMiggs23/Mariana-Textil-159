import { CorteCaja, exportAdminCorteXlsx, exportAdminCortePdf } from "@workspace/api-client-react";
import { formatAccountDestination, formatNumber } from "@workspace/number-format";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Download, FileText, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CorteDetail({ corte }: { corte: CorteCaja }) {
  const { toast } = useToast();
  const isDescuadre = Number(corte.diferencia) !== 0 && corte.sesion.estado === "CERRADA";
  const dif = Number(corte.diferencia);
  const ticketsCobrados = corte.facturacion.reduce((acc, f) => acc + f.ticketsCount, 0);

  const handleExportXlsx = async () => {
    try {
      const blob = await exportAdminCorteXlsx(corte.sesion.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `corte-${corte.sesion.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      const blob = await exportAdminCortePdf(corte.sesion.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `corte-${corte.sesion.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Error", description: getApiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 text-sm pb-8">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportXlsx}>
          <Download className="w-4 h-4 mr-2" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <Printer className="w-4 h-4 mr-2" /> Reimprimir / PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
        <div>
          <p className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Turno</p>
          <p className="font-semibold text-base mt-1">{corte.sesion.nombreUbicacion}</p>
          <p className="text-muted-foreground">Cajero: {corte.sesion.nombreUsuario}</p>
          <p className="text-muted-foreground text-xs mt-1">
            {corte.sesion.estado} {corte.sesion.estado === 'CERRADA' && <span className={isDescuadre ? (dif < 0 ? "text-destructive font-bold" : "text-amber-600 font-bold") : "text-green-600 font-bold"}>
              ({dif > 0 ? "+" : ""}{formatNumber(corte.diferencia || "0", { kind: "money" })})
            </span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Fechas</p>
          <p className="font-medium mt-1">Apertura: {format(new Date(corte.sesion.abiertaAt), "PP p", { locale: es })}</p>
          <p className="text-muted-foreground">
            Cierre: {corte.sesion.cerradaAt ? format(new Date(corte.sesion.cerradaAt), "PP p", { locale: es }) : "Pendiente"}
          </p>
        </div>
      </div>

      {corte.lineasExcluidasMargen !== undefined && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs uppercase font-bold tracking-wider text-primary mb-2">Rentabilidad del Turno</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p className="font-mono font-medium">{formatNumber(corte.facturacion.reduce((acc, f) => acc + Number(f.subtotal), 0), { kind: "money" })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costo de Mercancía</p>
              <p className="font-mono font-medium text-destructive">{corte.costo == null ? "Pendiente" : formatNumber(corte.costo, { kind: "money" })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margen Operativo</p>
              <p className="font-mono font-bold text-sidebar">
                {corte.margen == null ? "Pendiente" : formatNumber(corte.margen, { kind: "money" })}
                <span className="text-xs font-normal ml-2 bg-sidebar/10 px-1.5 py-0.5 rounded text-sidebar">
                  {corte.margenPorcentaje == null ? "Pendiente" : formatNumber(corte.margenPorcentaje, { kind: "percentage", percentageInput: "percent" })}
                </span>
              </p>
            </div>
          </div>
          {Number(corte.lineasExcluidasMargen) > 0 && (
            <p className="text-xs text-amber-700 mt-2">
               * Costo y margen pendientes por {corte.lineasExcluidasMargen} línea(s) sin costo congelado.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold border-b pb-2 mb-3">Formas de Pago</h3>
          <Table className="text-xs">
            <TableHeader><TableRow><TableHead>Forma</TableHead><TableHead className="text-right">Tickets</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
            <TableBody>
              {corte.formasPago.map(fp => (
                <TableRow key={fp.formaPago}>
                  <TableCell className="font-medium">{fp.formaPago}</TableCell>
                  <TableCell className="text-right">{fp.ticketsCount}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(fp.importe, { kind: "money" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <h3 className="font-bold border-b pb-2 mb-3">Cuentas Destino</h3>
          <Table className="text-xs">
            <TableHeader><TableRow><TableHead>Cuenta / Forma</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
            <TableBody>
              {corte.cuentasDestino.map((cd, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-medium">{formatAccountDestination(cd.cuentaDestino)}</div>
                    <div className="text-[10px] text-muted-foreground">{cd.formaPago}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(cd.importe, { kind: "money" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div>
          <h3 className="font-bold border-b pb-2 mb-3">Facturación y Medios de Pago</h3>
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Tck</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right text-sidebar font-bold border-r">Total</TableHead>
                <TableHead className="text-right">Efectivo</TableHead>
                <TableHead className="text-right">Transf.</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corte.facturacion.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{f.facturado ? "Facturado" : "Público General"}</TableCell>
                  <TableCell className="text-right">{f.ticketsCount}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatNumber(f.subtotal, { kind: "money" })}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatNumber(f.iva, { kind: "money" })}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-sidebar border-r">{formatNumber(f.importe, { kind: "money" })}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(f.efectivo, { kind: "money" })}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(f.transferencia, { kind: "money" })}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(f.credito, { kind: "money" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold border-b pb-2 mb-3">Tipo de Venta</h3>
          <Table className="text-xs">
            <TableHeader><TableRow><TableHead>Modalidad</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
            <TableBody>
              {corte.metreado.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{m.tipo === "METREADO" ? "METRAJE" : "ROLLOS"}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(m.cantidad, { kind: "quantity" })} {m.unidad}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(m.importe, { kind: "money" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {corte.productos.length > 0 && (
        <div>
          <h3 className="font-bold border-b pb-2 mb-3">Productos Top</h3>
          <Table className="text-xs">
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Tela / Color</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
            <TableBody>
              {corte.productos.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{p.sku}</TableCell>
                  <TableCell>{p.tipo === "METREADO" ? "METRAJE" : "ROLLO"} · {p.tela} - {p.color}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(p.cantidad, { kind: "quantity" })} {p.unidad}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(p.importe, { kind: "money" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {corte.pendientes.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-lg">
          <h3 className="font-bold text-amber-800 mb-2 border-b border-amber-200 pb-2">Tickets Pendientes de Cobro ({corte.pendientes.length})</h3>
          <div className="space-y-2">
            {corte.pendientes.map(p => (
              <div key={p.ticketId} className="flex justify-between items-center text-xs">
                <span><span className="font-mono text-amber-700">F-{p.folio}</span> · {p.nombreCliente || "Sin Cliente"}</span>
                <span className="font-mono font-bold">{formatNumber(p.total, { kind: "money" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {corte.cancelaciones && corte.cancelaciones.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-lg">
          <h3 className="font-bold text-destructive mb-2 border-b border-destructive/20 pb-2">Cancelaciones ({corte.cancelaciones.length})</h3>
          <div className="space-y-3">
            {corte.cancelaciones.map(c => (
              <div key={c.ticketId} className="flex justify-between items-start text-xs border-b border-destructive/10 pb-2 last:border-0 last:pb-0">
                <div>
                  <div className="font-mono text-destructive font-bold">F-{c.folio}</div>
                  <div className="text-muted-foreground mt-0.5"><span className="font-semibold">Motivo:</span> {c.motivo}</div>
                  <div className="text-muted-foreground"><span className="font-semibold">Autor:</span> {c.autor}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold">{formatNumber(c.importe, { kind: "money" })}</div>
                  <div className="text-muted-foreground text-[10px] mt-0.5">{format(new Date(c.canceladoAt), "HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {corte.ticketsCobradosDetalle && corte.ticketsCobradosDetalle.length > 0 && (
        <div>
          <h3 className="font-bold border-b pb-2 mb-3">Tickets Cobrados ({corte.ticketsCobradosDetalle.length})</h3>
          <Table className="text-xs">
            <TableHeader><TableRow><TableHead>Folio</TableHead><TableHead>Hora</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
            <TableBody>
              {corte.ticketsCobradosDetalle.map(t => (
                <TableRow key={t.ticketId}>
                  <TableCell className="font-mono font-medium">F-{t.folio}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(t.cobradoAt), "HH:mm:ss")}</TableCell>
                  <TableCell className="text-right font-mono text-sidebar font-semibold">{formatNumber(t.importe, { kind: "money" })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {corte.sesion.estado === "CERRADA" && (
        <div className="border rounded-lg overflow-hidden mt-6">
          <div className="bg-muted/50 p-3 border-b font-semibold text-sidebar">Arqueo de Efectivo Final</div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Fondo Inicializado</span>
              <span className="font-mono">{formatNumber(corte.fondoInicial, { kind: "money" })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Ingresos Efectivo Registrados</span>
              <span className="font-mono">{formatNumber(Number(corte.efectivoEsperado) - Number(corte.fondoInicial), { kind: "money" })}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t font-semibold">
              <span>Efectivo Esperado (Sistema)</span>
              <span className="font-mono">{formatNumber(corte.efectivoEsperado, { kind: "money" })}</span>
            </div>
            <div className="flex justify-between items-center pt-2 pb-2">
              <span className="font-bold text-sidebar">Efectivo Contado (Cajero)</span>
              <span className="font-mono font-bold text-sidebar">{formatNumber(corte.efectivoContado || "0", { kind: "money" })}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-md mt-2 font-bold ${isDescuadre ? (dif < 0 ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-800") : "bg-green-100 text-green-800"}`}>
              <span>Diferencia de Arqueo</span>
              <span className="font-mono">{dif > 0 ? "+" : ""}{formatNumber(corte.diferencia || "0", { kind: "money" })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
