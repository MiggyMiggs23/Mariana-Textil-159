import { useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { useE3GetRecibo, useE3RegistrarImpresion } from "@/hooks/use-e3";
import { getApiErrorMessage } from "@/lib/api-error";
import { E3_ENABLED } from "@/lib/e3-feature-flags";
import { useGetCurrentUser, type E3Receipt } from "@workspace/api-client-react";
import { formatNumber } from "@workspace/number-format";

const money = (cents: number) => formatNumber(cents / 100, { kind: "money" });
const date = (value: string | Date) => new Date(value).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
type Allocation = E3Receipt["asignaciones"][number];

// No estimated "rows per page": measure these actual fonts/rows/header/footer at
// 200 × 138 mm (A5 landscape minus 5 mm on every edge) after document.fonts.ready.
export function ReceiptPages({ recibo, printedAt, onReady }: {
  recibo: E3Receipt; printedAt: string; onReady: (ready: boolean) => void;
}) {
  const probe = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Allocation[][]>([]);
  const [problem, setProblem] = useState("");
  useLayoutEffect(() => {
    let alive = true;
    onReady(false);
    const measure = () => {
      if (!alive || !probe.current) return;
      const root = probe.current;
      const height = (selector: string) => root.querySelector(selector)!.getBoundingClientRect().height;
      const available = height(".e3-inner") - height(".e3-heading") - height("thead") - height(".e3-footer") - 8;
      const rows = Array.from(root.querySelectorAll("tbody tr"));
      const chunks: Allocation[][] = [[]];
      let used = 0;
      for (let i = 0; i < rows.length; i++) {
        const rowHeight = rows[i].getBoundingClientRect().height;
        if (rowHeight > available || available <= 0) {
          setProblem("Los datos no caben completos en A5. No se permite imprimir ni recortar evidencia.");
          setPages([]);
          return;
        }
        if (used + rowHeight > available) { chunks.push([]); used = 0; }
        if (recibo.asignaciones[i]) chunks[chunks.length - 1].push(recibo.asignaciones[i]);
        used += rowHeight;
      }
      setPages(chunks);
      setProblem("");
      onReady(true);
    };
    void document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => { alive = false; window.removeEventListener("resize", measure); };
  }, [recibo, onReady]);

  const body = (rows: Allocation[], copy: string, page: string) => (
    <div className="e3-inner">
      <header className="e3-heading">
        <div className="e3-line"><strong>Mariana Textil · {recibo.origen === "RECAPTURA" ? "Constancia histórica — SIN DINERO NUEVO" : "Recibo de abono"}</strong><span>{copy} · {page}</span></div>
        <div className="e3-line"><strong>{recibo.folio}</strong><strong>{money(recibo.importeCentavos)}</strong></div>
        <p>Cliente: {recibo.clienteNombre}</p>
        {recibo.clienteTelefono && <p>Teléfono: {recibo.clienteTelefono}</p>}
        {recibo.clienteRfc && <p>RFC: {recibo.clienteRfc}</p>}
        <p>Sitio receptor: {recibo.sitioNombre} · Recibió / registró: {recibo.actorNombre}</p>
        <p>Recepción: {date(recibo.recibidoEn)} · Registro: {date(recibo.registradoEn)}</p>
        <p>Medio: {recibo.formaPago === "EFECTIVO" ? "Efectivo" : "Transferencia"} · Cuenta: {recibo.cuentaDestino.replaceAll("_", " ")}</p>
        {recibo.motivo && <p>Motivo: {recibo.motivo}</p>}
      </header>
      <table>
        <thead><tr><th>Nota</th><th>Saldo anterior</th><th>Aplicado</th><th>Saldo posterior</th></tr></thead>
        <tbody>{rows.length ? rows.map(row => (
          <tr key={row.movimientoVentaId}><td>{row.ticketId && row.folio ? <Link href={`/tickets/${row.ticketId}`}>{row.folio}</Link> : row.folio ?? `Movimiento ${row.movimientoVentaId}`}</td><td>{money(row.saldoAntesCentavos)}</td><td>{money(row.aplicadoCentavos)}</td><td>{money(row.saldoDespuesCentavos)}</td></tr>
        )) : <tr><td colSpan={4}>Anticipo sin aplicación a notas. Saldo a favor registrado: {money(recibo.saldoAFavorCentavos)}.</td></tr>}</tbody>
      </table>
      <footer className="e3-footer">
        <p>Remanente del abono: <strong>{money(recibo.remanenteCentavos)}</strong> · Saldo a favor total: <strong>{money(recibo.saldoAFavorCentavos)}</strong> · Deuda total posterior: <strong>{money(recibo.deudaCentavos)}</strong></p>
        <div className="e3-signatures"><span>Firma de quien entrega</span><span>Firma de quien recibe</span></div>
        <p>REIMPRESIÓN / copia de evidencia emitida · {date(printedAt)} · Movimiento {recibo.movimientoId}</p>
      </footer>
    </div>
  );
  return <>
    <style>{`
      .e3-sheet { width:210mm; height:148mm; padding:5mm; box-sizing:border-box; background:white; color:black; font:10px/1.25 Arial,sans-serif; overflow:hidden; }
      .e3-inner { height:138mm; display:flex; flex-direction:column; }
      .e3-sheet p { margin:1mm 0; overflow-wrap:anywhere; }
      .e3-heading,.e3-footer { flex-shrink:0; }
      .e3-line { display:flex; justify-content:space-between; gap:3mm; }
      .e3-sheet table { width:100%; border-collapse:collapse; table-layout:fixed; }
      .e3-sheet th,.e3-sheet td { padding:1mm; border-bottom:1px solid #aaa; text-align:right; overflow-wrap:anywhere; }
      .e3-sheet th:first-child,.e3-sheet td:first-child { text-align:left; }
      .e3-footer { margin-top:auto; padding-top:2mm; break-inside:avoid; }
      .e3-signatures { display:flex; justify-content:space-around; padding-top:7mm; margin:2mm 0; }
      .e3-signatures span { border-top:1px solid black; width:70mm; text-align:center; padding-top:1mm; }
      .e3-probe { position:fixed; left:-20000px; top:0; visibility:hidden; }
      @media print {
        @page { size:A5 landscape; margin:0; }
        body * { visibility:hidden; }
        /* Chromium can suppress painting beneath hidden display:contents
           ancestors even when the receipt itself computes visibility:visible.
           Remove their layout boxes AND restore their visibility. */
        body > *:not(#root) { display:none !important; }
        #root, #root *:has(#e3-pages) { display:contents !important; visibility:visible; }
        #root *:not(:has(#e3-pages)):not(#e3-pages):not(#e3-pages *) { display:none !important; }
        #e3-pages,#e3-pages * { visibility:visible; }
        #e3-pages { position:static; display:block !important; margin:0; padding:0; }
        .e3-sheet { break-after:page; page-break-after:always; margin:0; }
        .e3-sheet:last-child { break-after:auto; page-break-after:auto; }
        .e3-probe,.e3-no-print { display:none !important; }
      }
    `}</style>
    <div ref={probe} className="e3-sheet e3-probe" aria-hidden="true">{body(recibo.asignaciones, "Copia Cliente", "Página 999 / 999")}</div>
    {problem && <p role="alert">{problem}</p>}
    <div id="e3-pages" data-ready={pages.length > 0}>{["Copia Cliente", "Copia Tienda"].flatMap(copy =>
      pages.map((rows, index) => <section className="e3-sheet print-page" key={`${copy}-${index}`} data-copy={copy}>{body(rows, copy, `Página ${index + 1} / ${pages.length}`)}</section>)
    )}</div>
  </>;
}

export default function ReciboE3() {
  const { folio } = useParams();
  const { data: user } = useGetCurrentUser();
  const allowed = E3_ENABLED && user?.rol === "ADMIN";
  const { data: recibo, isLoading, error } = useE3GetRecibo(folio ?? "", allowed);
  const audit = useE3RegistrarImpresion();
  const [ready, setReady] = useState(false);
  const [printError, setPrintError] = useState("");
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString());
  const printing = useRef(false);
  const handlePrint = async () => {
    if (!allowed || !recibo || !ready || printing.current) return;
    printing.current = true;
    setPrintError("");
    try {
      await audit.mutateAsync({ folio: recibo.folio, motivo: "Solicitud de reimpresión desde otro equipo; no acredita impresión física" });
      setPrintedAt(new Date().toISOString());
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } catch (err) {
      setPrintError(getApiErrorMessage(err, "No se registró la solicitud. No se abrió la impresión; reintenta."));
    } finally { printing.current = false; }
  };
  return <AppLayout>
    {!allowed ? <p>E3 cerrado o acceso exclusivo de ADMIN.</p> :
      isLoading ? <p>Cargando evidencia…</p> :
      error || !recibo ? <p role="alert">{getApiErrorMessage(error, "No hay evidencia íntegra del recibo. No se reconstruirá con saldos actuales.")}</p> :
      <>
        <div className="e3-no-print"><h1>Recibo {recibo.folio}</h1><p>Dos copias A5. La solicitud se audita; cancelar la impresora no vuelve a cobrar.</p>
          <p><Link className="font-semibold text-primary underline" href={`/clientes/${recibo.clienteId}/movimientos/${recibo.movimientoId}`}>Ver detalle del movimiento #{recibo.movimientoId}</Link></p>
          <Button disabled={!ready || audit.isPending} onClick={handlePrint} data-testid="button-print-receipt">Solicitar impresión / reimpresión</Button>
          {printError && <p role="alert">{printError}</p>}
        </div>
        <ReceiptPages recibo={recibo} printedAt={printedAt} onReady={setReady} />
      </>}
  </AppLayout>;
}