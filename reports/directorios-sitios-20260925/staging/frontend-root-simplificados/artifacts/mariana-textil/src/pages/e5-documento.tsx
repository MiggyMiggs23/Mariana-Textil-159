import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import {
  useGetE5Cobro, useGetE5Documento, useRecordE5Impresion,
  useGetCurrentUser,
  getGetE5CobroQueryKey, getGetE5DocumentoQueryKey,
  type E5Documento, type E5ImpresionInput,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { E5Boundary, E5Problem, e5Date, e5Money } from "@/components/e5-pendientes";
import { e5Error } from "@/hooks/use-e5-actions";
import { waitForPrintableAssets } from "@/lib/print";
import { e5AuthorizationContext, e5CanRead, assertE5Detail } from "@/lib/e5-authorization";
import { useE11Session } from "@/lib/e11-session";

type Row = { key: number; folio: string; saldo: string; importe?: string };

/** Pagination measures the immutable snapshot at the actual A5 printable size. */
function SnapshotPages({ document: doc, onReady }: { document: E5Documento; onReady: (ready: boolean) => void }) {
  const probe = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Row[][]>([]);
  const [problem, setProblem] = useState("");
  const rows: Row[] = doc.notas.map(n => ({
    key: n.movimientoVentaId, folio: `${n.folio} · cargo ${n.movimientoVentaId}`, saldo: n.saldoPendiente,
    importe: doc.asignaciones.find(a => a.notaId === n.notaId && a.movimientoVentaId === n.movimientoVentaId)?.importe,
  }));
  const incomplete = doc.asignaciones.some(a => !doc.notas.some(n => n.notaId === a.notaId && n.movimientoVentaId === a.movimientoVentaId))
    || new Set(doc.notas.map(n => n.movimientoVentaId)).size !== doc.notas.length;
  useLayoutEffect(() => {
    let active = true;
    onReady(false);
    const measure = () => {
      if (!active || !probe.current) return;
      onReady(false);
      const root = probe.current;
      const height = (selector: string) => root.querySelector(selector)!.getBoundingClientRect().height;
      const available = height(".e5-doc-inner") - height(".e5-doc-heading") - height("thead") - height(".e5-doc-footer") - 12;
      const elements = Array.from(root.querySelectorAll("tbody tr"));
      if (incomplete || available <= 0 || elements.some(r => r.getBoundingClientRect().height > available)) {
        setProblem(incomplete ? "Evidencia incompleta: falta la nota de una asignación. No se reconstruirá con datos actuales." : "El contenido completo no cabe en A5. No se recortará evidencia; impresión bloqueada.");
        setPages([]);
        return;
      }
      const chunks: Row[][] = [[]];
      let used = 0;
      elements.forEach((element, index) => {
        const size = element.getBoundingClientRect().height;
        if (used + size > available) { chunks.push([]); used = 0; }
        if (rows[index]) chunks[chunks.length - 1].push(rows[index]);
        used += size;
      });
      setPages(chunks); setProblem(""); onReady(true);
    };
    void document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => { active = false; onReady(false); window.removeEventListener("resize", measure); };
  }, [doc, onReady, incomplete]);
  const body = (items: Row[], copy: string, pagination: string) => <div className="e5-doc-inner">
    <header className="e5-doc-heading">
      <div className="e5-doc-line"><strong>Mariana Textil · {doc.tipo === "RECIBO" ? "Recibo de recepción" : "Constancia de aplicación — SIN OTRO COBRO"}</strong><span>{copy} · {pagination}</span></div>
      <div className="e5-doc-line"><strong>{doc.folio}</strong><strong>{e5Money(doc.importeDocumento)}</strong></div>
      <p>Recibo vinculado: {doc.reciboFolio}</p>
      <p>Cliente: {doc.clienteNombre} · Sitio: {doc.ubicacionNombre}</p>
      <p>Recibió: {doc.receptor.nombre}{doc.autorizador ? ` · Autorizó: ${doc.autorizador.nombre}` : ""}</p>
      <p>Recepción: {e5Date(doc.fechaRecepcion)} · Emisión: {e5Date(doc.fechaEmision)}</p>
      {doc.fechaAplicacion && <p>Aplicación: {e5Date(doc.fechaAplicacion)}</p>}
      <p>Medio: {doc.formaPago} · Cuenta: {doc.cuentaDestino}</p>
      <p><strong>{doc.mensaje}</strong></p>
      <p>Evidencia: {doc.evidencia.descripcion}</p>
      {doc.evidencia.referencias.map((r, i) => <p key={i}>Referencia: {r}</p>)}
    </header>
    <table><thead><tr><th>Nota (snapshot)</th><th>Saldo en evidencia</th><th>Importe asignado</th></tr></thead>
      <tbody>{items.length ? items.map(row => <tr key={row.key}><td>{row.folio}</td><td>{e5Money(row.saldo)}</td><td>{row.importe === undefined ? "Sin aplicación en este documento" : e5Money(row.importe)}</td></tr>) : <tr><td colSpan={3}>Sin asignaciones a notas en este documento.</td></tr>}</tbody>
    </table>
    <footer className="e5-doc-footer">
      <p>Total recibido original: {e5Money(doc.importeRecibido)} · Pendiente al emitir: {e5Money(doc.pendienteEnEmision)}</p>
      {doc.importeFavorGenerado && <p>Favor autorizado generado en esta constancia: {e5Money(doc.importeFavorGenerado)}</p>}
      <p>Documento inmutable. No recalculado con saldos actuales. Reimprimir no recibe ni aplica dinero.</p>
      <div className="e5-doc-signatures"><span>Firma de quien entrega / cliente</span><span>Firma de quien recibe / autoriza</span></div>
    </footer>
  </div>;
  return <>
    <style>{`
      .e5-doc-sheet { width:210mm; height:148mm; padding:5mm; box-sizing:border-box; background:white; color:black; font:10px/1.25 Arial,sans-serif; }
      .e5-doc-inner { height:138mm; display:flex; flex-direction:column; }
      .e5-doc-sheet p { margin:1mm 0; overflow-wrap:anywhere; }
      .e5-doc-heading,.e5-doc-footer { flex-shrink:0; }
      .e5-doc-line { display:flex; justify-content:space-between; gap:3mm; }
      .e5-doc-sheet table { width:100%; table-layout:fixed; border-collapse:collapse; flex-shrink:0; }
      .e5-doc-sheet th,.e5-doc-sheet td { padding:1mm; text-align:right; border-bottom:1px solid #aaa; overflow-wrap:anywhere; }
      .e5-doc-sheet th:first-child,.e5-doc-sheet td:first-child { text-align:left; }
      .e5-doc-footer { margin-top:auto; padding-top:2mm; break-inside:avoid; }
      .e5-doc-signatures { display:flex; justify-content:space-around; padding-top:7mm; margin:2mm 0; }
      .e5-doc-signatures span { border-top:1px solid black; width:75mm; text-align:center; padding-top:1mm; }
      .e5-doc-probe { position:fixed; left:-20000px; top:0; visibility:hidden; }
      @media print {
        @page { size:A5 landscape; margin:0; }
        body:not(.e5-print) #e5-document-pages { display:none !important; }
        body.e5-print * { visibility:hidden; }
        body.e5-print #e5-document-pages,body.e5-print #e5-document-pages * { visibility:visible; }
        body.e5-print #e5-document-pages { position:absolute; left:0; top:0; margin:0; padding:0; }
        .e5-doc-sheet { break-after:page; page-break-after:always; margin:0; }
        .e5-doc-sheet:last-child { break-after:auto; page-break-after:auto; }
        .e5-doc-probe,.e5-doc-controls { display:none !important; }
      }
    `}</style>
    <div className="e5-doc-sheet e5-doc-probe" ref={probe} aria-hidden="true">{body(rows, "Copia Cliente", "Página 999 / 999")}</div>
    {problem && <E5Problem error={problem} />}
    <div id="e5-document-pages">{["Copia Cliente", "Copia Tienda"].flatMap(copy => pages.map((items, index) =>
      <section className="e5-doc-sheet" key={`${copy}:${index}`}>{body(items, copy, `Página ${index + 1} / ${pages.length}`)}</section>))}</div>
  </>;
}

export default function E5DocumentoPage() {
  const { id, documentoId } = useParams();
  return <AppLayout><E5Boundary>{scope =>
    scope.admin && scope.capabilities.puedeImprimir && id && documentoId
      ? <DocumentAccess key={`${scope.scope}:${id}:${documentoId}`} id={id} documentId={documentoId} site={scope.site} scope={scope.scope} />
      : <E5Problem error="Documentos completos e impresión exclusivos de ADMIN autorizado." />
  }</E5Boundary></AppLayout>;
}
function DocumentAccess({ id, documentId, site, scope }: { id: string; documentId: string; site: number; scope: string }) {
  const e11 = useE11Session();
  const user = useGetCurrentUser();
  const receipt = useGetE5Cobro(id, { query: { queryKey: [...getGetE5CobroQueryKey(id), scope], staleTime: 0, refetchOnMount: "always" } });
  if (receipt.error) return <E5Problem error={receipt.error} />;
  if (!receipt.data) return <p>Verificando acceso a documento…</p>;
  if (receipt.data.id !== id || receipt.data.ubicacionId !== site || !receipt.data.capacidades.puedeImprimir) return <E5Problem error="Documento fuera de la recepción, sitio o capacidad seleccionados." />;
  const known = receipt.data.reciboId === documentId || receipt.data.aplicaciones.some(a => a.constanciaId === documentId);
  if (!known) return <E5Problem error="El documento no pertenece a esta recepción." />;
  return <DocumentBody id={id} documentId={documentId} receiptId={receipt.data.reciboId} receiverId={receipt.data.receptor.id} scope={scope} verify={async () => {
    const actor = await user.refetch();
    const e11Identity = e11 ? await e11.check() : undefined;
    if (actor.error || !actor.data || actor.data.rol !== "ADMIN" || String(actor.data.id) !== scope.split(":")[0]
      || !e5CanRead(actor.data) || e5AuthorizationContext(actor.data, e11Identity) !== scope.split(":")[2]) throw new Error("Identidad/permisos ADMIN cambiaron. No se solicitó impresión.");
    const fresh = await receipt.refetch();
    if (fresh.error || !fresh.data || fresh.data.ubicacionId !== site || !fresh.data.capacidades.puedeImprimir) throw new Error("No se pudo confirmar acceso vigente a la impresión.");
    assertE5Detail(fresh.data, id, site, receipt.data?.clienteId);
  }} />;
}
function DocumentBody({ id, documentId, receiptId, receiverId, scope, verify }: { id: string; documentId: string; receiptId: string; receiverId: number; scope: string; verify: () => Promise<void> }) {
  const snapshot = useGetE5Documento(id, documentId, { query: { queryKey: [...getGetE5DocumentoQueryKey(id, documentId), scope], staleTime: 0, refetchOnMount: "always" } });
  const audit = useRecordE5Impresion();
  const [ready, setReady] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [storageProblem, setStorageProblem] = useState(false);
  const pending = useRef<E5ImpresionInput | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const storageKey = `e5-impresion:${scope}:${id}:${documentId}`;
  useEffect(() => {
    alive.current = true;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const input = JSON.parse(stored) as E5ImpresionInput;
        if (!input.claveOperacion || !input.motivo) throw new Error("Solicitud de impresión guardada inválida; solicita revisión.");
        pending.current = input; setMotivo(input.motivo); setRecovery(true);
      }
    } catch (err) { setStorageProblem(true); setError(e5Error(err)); }
    const cleanupPrint = () => document.body.classList.remove("e5-print");
    window.addEventListener("afterprint", cleanupPrint);
    return () => { alive.current = false; cleanupPrint(); window.removeEventListener("afterprint", cleanupPrint); };
  }, [storageKey]);
  const print = async () => {
    if (lock.current || !ready || !snapshot.data || !motivo.trim() || storageProblem) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await verify();
      await waitForPrintableAssets(document.getElementById("e5-document-pages")!);
      if (!alive.current) return;
      const input = pending.current ?? { claveOperacion: crypto.randomUUID(), motivo: motivo.trim() };
      sessionStorage.setItem(storageKey, JSON.stringify(input));
      pending.current = input; setRecovery(true);
      await audit.mutateAsync({ id, documentoId: documentId, data: input });
      sessionStorage.removeItem(storageKey);
      if (!alive.current) return;
      pending.current = null; setRecovery(false);
      document.body.classList.add("e5-print");
      window.print();
    } catch (err) { if (alive.current) setError(`${e5Error(err)} No se repite el cobro ni la aplicación. Reintenta esta solicitud de impresión.`); }
    finally {
      lock.current = false;
      document.body.classList.remove("e5-print");
      if (alive.current) setBusy(false);
    }
  };
  if (snapshot.error) return <><E5Problem error={snapshot.error} /><Button onClick={() => void snapshot.refetch()}>Recargar evidencia</Button></>;
  if (!snapshot.data) return <p>Cargando documento inmutable…</p>;
  if (snapshot.data.id !== documentId || snapshot.data.cobroId !== id || snapshot.data.reciboId !== receiptId
    || snapshot.data.receptor.id !== receiverId || snapshot.data.copias !== 2) return <E5Problem error="Documento inconsistente. No se reconstruirá ni imprimirá." />;
  return <div className="space-y-4">
    <div className="e5-doc-controls space-y-3">
      <Link className="underline" href={`/cobros/pendientes/${id}`}>Volver a recepción</Link>
      <h1 className="text-2xl font-bold">{snapshot.data.tipo} · {snapshot.data.folio}</h1>
      <p>Dos copias A5 horizontal. Solicitud auditada; no acredita impresión física. Cancelar o fallar la impresora no modifica dinero.</p>
      <label>Motivo de impresión / reimpresión<Input maxLength={500} disabled={busy || recovery} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
      {error && <E5Problem error={error} />}
      <Button disabled={!ready || busy || !motivo.trim() || storageProblem} onClick={() => void print()}>{recovery ? "Reintentar solicitud auditada" : "Solicitar impresión / reimpresión"}</Button>
    </div>
    <SnapshotPages document={snapshot.data} onReady={setReady} />
  </div>;
}