import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser, getGetCurrentUserQueryKey, getCurrentUser,
  useGetE7Disponibilidad, useGetE7Atribucion, useGetE7ClienteExportacion,
  exportE7AtribucionPdf, exportE7AtribucionXlsx,
  type E7Movimiento, type E7Retenido, type CarteraAlcance, type GetE7AtribucionParams,
} from "@workspace/api-client-react";
import { e7ClientFinancialOn, e7On } from "@/lib/e7-feature-flags";
import { hasPermission, Modules } from "@/lib/permisos";
import { useCreditSiteScope } from "@/components/credit-site-scope";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, FileText, MapPin, Wallet } from "lucide-react";

const legends = [
  "El resumen global de crédito considera todos los sitios.",
  "El detalle corresponde solo a los sitios autorizados y no representa la deuda total del cliente.",
  "Las aplicaciones a notas no son nuevos ingresos.",
  "El dinero retenido pendiente de aplicación no es saldo a favor ni reduce la deuda.",
];
const message = (e: unknown) => e instanceof Error ? e.message : "No se pudo consultar E7. No se sustituye por cero ni por otra fuente.";
const money = (value: string | null | undefined) => value == null ? "No corresponde a este alcance" : `$${value}`;
const site = (id: number | null, scope: CarteraAlcance) => id === null ? "Sin sitio determinado" : scope.ubicaciones.find(s => s.id === id)?.nombre ?? `Sitio ${id}`;
type Surface = "cuentas" | "tiempo-real" | "exportacion";

/** Gate before hooks: OFF never mounts E7/auth readers from these components. */
export function E7Attribution({ desde, hasta, surface }: { desde: string; hasta: string; surface: "cuentas" | "tiempo-real" }) {
  if (!e7On()) return null;
  return <Boundary surface={surface}>{identity => <Attribution desde={desde} hasta={hasta} identity={identity} />}</Boundary>;
}
export function E7ClientExport({ clienteId }: { clienteId: number }) {
  if (!e7ClientFinancialOn()) return null;
  return <Boundary surface="exportacion">{identity => <ClientExport clienteId={clienteId} identity={identity} />}</Boundary>;
}
function Boundary({ surface, children }: { surface: Surface; children: (identity: string) => ReactNode }) {
  const client = useQueryClient();
  const user = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), staleTime: 0, retry: false, refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: 15000 } });
  const identity = JSON.stringify(user.data);
  useLayoutEffect(() => () => {
    const predicate = (q: { queryKey: readonly unknown[] }) => String(q.queryKey[0]).startsWith("/api/e7/") && q.queryKey.includes(identity);
    void client.cancelQueries({ predicate }); client.removeQueries({ predicate });
  }, [identity, user.error, client]);
  if (user.error) return <p role="alert">{message(user.error)}</p>;
  if (!user.data || !user.isFetchedAfterMount) return <p role="status">Verificando autorización E7…</p>;
  const allowed = user.data.rol !== "CONTADOR" && (surface === "exportacion"
    ? hasPermission(user.data, Modules.CLIENTES_FINANZAS, "ver")
    : surface === "tiempo-real" ? user.data.rol === "ADMIN" : ["ADMIN", "SISTEMAS"].includes(user.data.rol));
  if (!allowed) return <p role="alert">Consulta E7 no autorizada. CONTADOR utiliza exclusivamente E11.</p>;
  return <Available key={`${surface}:${identity}`} identity={identity} surface={surface}>{children(identity)}</Available>;
}
function Available({ identity, surface, children }: { identity: string; surface: Surface; children: ReactNode }) {
  const q = useGetE7Disponibilidad({ query: { queryKey: ["/api/e7/disponibilidad", identity], staleTime: 0, retry: false, refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: 15000 } });
  if (q.error) return <p role="alert">{message(q.error)}</p>;
  if (!q.data || !q.isFetchedAfterMount) return <p role="status">Comprobando disponibilidad E7…</p>;
  const enabled = surface === "exportacion"
    ? (q.data.clienteFinanzas ?? q.data.enabled)
    : (q.data.atribucion ?? q.data.enabled);
  if (!enabled) return <p role="alert">Esta lectura E7 está cerrada. No se usa una fuente alternativa.</p>;
  return <>{children}</>;
}
function Legends({ extra = [] }: { extra?: string[] }) {
  return <div className="space-y-1 text-sm text-muted-foreground" data-testid="e7-legends">{[...new Set([...legends, ...extra])].map(t => <p key={t}>{t}</p>)}</div>;
}
function Scope({ scope, generated }: { scope: CarteraAlcance; generated: string }) {
  return <p>Alcance: {scope.tipo === "GLOBAL" ? "Global · Sin sitio determinado incluido" : scope.ubicaciones.map(s => s.nombre).join(", ") || "Sin sitios autorizados"} · Generado: {generated}</p>;
}
export function e7ClientMovementHref(clienteId: number | undefined, href: string | null | undefined): string | null {
  const match = href?.match(/^\/clientes\/([1-9]\d*)\/movimientos\/([1-9]\d*)$/);
  return clienteId && match && Number(match[1]) === clienteId ? href! : null;
}
export function e7DocumentHref(href: string | null | undefined): string | null {
  return href && /^\/tickets\/[1-9]\d*$/.test(href) ? href : null;
}
function Movements({ rows, scope, clienteId, testId = "e7-movements" }: { rows: E7Movimiento[]; scope: CarteraAlcance; clienteId?: number; testId?: string }) {
  // Primary plus underline identifies navigable folios and figures; it is never a financial state.
  return <div className="overflow-x-auto"><table className="w-full text-sm" data-testid={testId}><thead><tr>{["Fecha", "Concepto", "Sitio", "Cuenta de origen comprobada", "Folio", "Importe", "Saldo pendiente de nota"].map(t => <th className="p-2 text-left" key={t}>{t}</th>)}</tr></thead><tbody>{rows.map(r => {
    const detailHref = clienteId ? e7ClientMovementHref(clienteId, r.detailHref) : e7DocumentHref(r.detailHref);
    const documentHref = e7DocumentHref(r.documentHref);
    return <tr key={r.id}><td className="p-2 border-t">{String(r.fecha)}</td><td className="p-2 border-t">{r.tipo}</td><td className="p-2 border-t">{site(r.ubicacionId, scope)}</td><td className="p-2 border-t">{r.cuentaDestino ?? "Sin cuenta determinada"}</td><td className="p-2 border-t">{documentHref && r.folio ? <Link className="font-semibold text-primary underline" href={documentHref}>{r.folio}</Link> : r.folio ?? "Sin folio"}</td><td className="p-2 border-t">{detailHref ? <Link className="font-semibold text-primary underline" href={detailHref} aria-label={`Abrir detalle del movimiento ${r.id}`}>{money(r.importe)}</Link> : money(r.importe)}</td><td className="p-2 border-t">{r.saldoPendiente == null ? "No corresponde" : money(r.saldoPendiente)}</td></tr>;
  })}</tbody></table>{!rows.length && <p>Sin movimientos en el alcance consultado.</p>}</div>;
}
function Retained({ rows, total, scope, generated }: { rows: E7Retenido[]; total: string; scope: CarteraAlcance; generated: string }) {
  // Primary plus underline marks the expandable total; amber marks retained money aged 3+ days that requires ADMIN attention.
  return <details data-testid="e7-retained" className="space-y-2 rounded-lg border border-dashed bg-card p-4 text-sm"><summary className="cursor-pointer font-semibold">Dinero retenido pendiente de aplicación: <span className="text-primary underline">{money(total)}</span></summary><p className="text-muted-foreground">Stock del alcance al {generated}; no limitado al periodo de recepción seleccionado. No es deuda ni favor.</p><ul>{rows.map(r => <li key={r.cobroId} className={r.antiguedadDias >= 3 ? "border-l-4 border-amber-500 pl-2" : ""}>Recepción {r.fechaRecepcion} · {site(r.ubicacionId, scope)} · {money(r.importePendiente)} · {r.antiguedadDias} días{r.antiguedadDias >= 3 ? " · Desde 3 días: requiere atención ADMIN" : ""}</li>)}</ul>{!rows.length && <p>Sin dinero retenido en el alcance.</p>}</details>;
}
function Attribution({ desde, hasta, identity }: { desde: string; hasta: string; identity: string }) {
  const credit = useCreditSiteScope(true);
  const start = Date.parse(`${desde}T00:00:00Z`), end = Date.parse(`${hasta}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)
    || !Number.isFinite(start) || !Number.isFinite(end)
    || new Date(start).toISOString().slice(0, 10) !== desde || new Date(end).toISOString().slice(0, 10) !== hasta
    || end < start || (end - start) / 86400000 + 1 > 366)
    return <p role="alert" data-testid="e7-range-error">E7 requiere fechas válidas ordenadas y un rango inclusivo máximo de 366 días. Corrige el selector; no se trunca el periodo.</p>;
  const params: GetE7AtribucionParams = { desde, hasta, ...(credit.selectedSiteId ? { ubicacionId: String(credit.selectedSiteId) } : {}) };
  return <div className="space-y-3">{credit.selector}
    {credit.error ? <p role="alert" className="text-sm text-destructive">{credit.error}</p> :
      <AttributionScope key={JSON.stringify(params)} params={params} identity={identity} />}
  </div>;
}
function AttributionScope({ params, identity }: { params: GetE7AtribucionParams; identity: string }) {
  const q = useGetE7Atribucion(params, { query: { queryKey: ["/api/e7/atribucion", params, identity], retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always" } });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const alive = useRef(true), lock = useRef(false);
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const download = async (kind: "pdf" | "xlsx") => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (JSON.stringify(await getCurrentUser()) !== identity || !alive.current) throw new Error("Identidad modificada. Consulta nuevamente antes de exportar.");
      const blob = await (kind === "pdf" ? exportE7AtribucionPdf(params) : exportE7AtribucionXlsx(params));
      if (JSON.stringify(await getCurrentUser()) !== identity || !alive.current) throw new Error("Identidad revocada; archivo descartado.");
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `atribucion-${params.desde}-${params.hasta}.${kind}`; link.click(); URL.revokeObjectURL(url);
    } catch (e) { if (alive.current) setError(message(e)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  if (q.error) return <section data-testid="e7-attribution"><p role="alert">{message(q.error)}</p><Button onClick={() => void q.refetch()}>Reintentar E7</Button></section>;
  if (!q.data || !q.isFetchedAfterMount) return <p role="status">Consultando atribución E7…</p>;
  const d = q.data;
  const collectionTypes = ["VENTA_CONTADO", "RECEPCION", "RECEPCION_RETENIDA", "DEVOLUCION", "DEVOLUCION_RETENIDA"];
  const physicalTypes = ["VENTA_CONTADO", "RECEPCION"];
  const applicationTypes = ["APLICACION", "REVERSO_APLICACION"];
  // Primary plus underline marks drill-down figures throughout this reader, never category or status.
  return <section data-testid="e7-attribution" className="e7-attribution space-y-6">
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border bg-sidebar/5 px-2 py-1 font-medium" data-testid="e7-scope"><Scope scope={d.alcance} generated={d.generadoEn} /></span>
        <span className="rounded border bg-sidebar/5 px-2 py-1 font-medium" data-testid="e7-period">Periodo inclusivo CDMX: {params.desde} — {params.hasta}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void download("pdf")} data-testid="e7-export-pdf">Descargar PDF E7</Button>
        <Button size="sm" disabled={busy} onClick={() => void download("xlsx")} data-testid="e7-export-xlsx">Descargar XLSX E7</Button>
        <Button size="sm" variant="outline" onClick={() => void q.refetch()}>Actualizar E7</Button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 auto-rows-fr">
      {d.alcance.tipo === "GLOBAL" ? <>
        <FigureCard testId="e7-collection" icon={<Banknote className="h-6 w-6" />} label="Cobranza del periodo" value={money(d.cobranzaTotal)} sub="Incluye puente histórico y correcciones" />
        <FigureCard testId="e7-physical" icon={<Wallet className="h-6 w-6" />} label="Recepciones físicas comprobadas" value={money(d.recepcionesFisicas)} sub="Solo POS y recepción física explícita" />
      </> : <Card className="recon-top-card md:col-span-2 border-sidebar/10 shadow-sm" data-testid="e7-sites-notice"><div className="recon-icon-box blue"><MapPin className="h-6 w-6" /></div><div className="recon-top-card-content"><span className="recon-top-card-label">Selección por sitios</span><span className="recon-top-card-sub">No se atribuye recepción física ni cobranza global a esta selección de sitios.</span></div></Card>}
      <FigureCard testId="e7-applications" icon={<FileText className="h-6 w-6" />} label="Aplicaciones comprobables a notas" value={money(d.aplicacionesNotas)} sub="No son nuevos ingresos ni se suman a cobranza" />
    </div>
    <Retained rows={d.retenidos} total={d.totalRetenido} scope={d.alcance} generated={d.generadoEn} />
    <Card className="border-sidebar/10 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-base">Movimientos del periodo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground" data-testid="e7-movement-counts">
          {d.alcance.tipo === "GLOBAL" && <span className="rounded border px-2 py-1">Cobranza: {d.movimientos.filter(r => collectionTypes.includes(r.tipo)).length}</span>}
          {d.alcance.tipo === "GLOBAL" && <span className="rounded border px-2 py-1">Recepciones físicas: {d.movimientos.filter(r => physicalTypes.includes(r.tipo)).length}</span>}
          <span className="rounded border px-2 py-1">Aplicaciones: {d.movimientos.filter(r => applicationTypes.includes(r.tipo)).length}</span>
        </div>
        <Movements rows={d.movimientos} scope={d.alcance} />
      </CardContent>
    </Card>
    <Card className="border-sidebar/10 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-base">Puente por fuente, cuenta y sitio</CardTitle></CardHeader>
      <CardContent>
        <ul data-testid="e7-bridge" className="divide-y">{d.puente.map((r, i) => <li key={i} className="py-2"><details><summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm"><span>{r.tipo} · {r.cuentaDestino ?? "Sin cuenta determinada"} · {site(r.ubicacionId, d.alcance)}</span><span className="font-mono font-semibold text-primary underline">{money(r.total)}</span></summary><div className="pt-2"><Movements rows={d.movimientos.filter(m => m.tipo === r.tipo && m.cuentaDestino === r.cuentaDestino && m.ubicacionId === r.ubicacionId)} scope={d.alcance} testId="e7-bridge-movements" /></div></details></li>)}</ul>
        {!d.puente.length && <p className="text-sm text-muted-foreground">Sin filas en el puente del periodo.</p>}
      </CardContent>
    </Card>
    <details className="rounded-lg border bg-card p-4 text-sm"><summary className="cursor-pointer font-medium">Notas de lectura E7</summary><div className="pt-2"><Legends extra={[...d.leyendas, "El registro histórico y las correcciones no acreditan nuevo ingreso físico. No se suman aplicaciones a cobranza."]} /></div></details>
  </section>;
}
function FigureCard({ testId, icon, label, value, sub }: { testId: string; icon: ReactNode; label: string; value: string; sub: string }) {
  return <Card className="recon-top-card border-sidebar/10 shadow-sm h-full" data-testid={testId}>
    <div className="recon-icon-box blue">{icon}</div>
    <div className="recon-top-card-content min-w-0">
      <span className="recon-top-card-label">{label}</span>
      <span className="recon-top-card-value">{value}</span>
      <span className="recon-top-card-sub">{sub}</span>
    </div>
  </Card>;
}
function ClientExport({ clienteId, identity }: { clienteId: number; identity: string }) {
  const credit = useCreditSiteScope(true);
  return <div className="space-y-3">{credit.selector}
    {credit.error ? <p role="alert" className="text-sm text-destructive">{credit.error}</p> :
      <ClientExportScope key={`${clienteId}:${credit.selectedSiteId}`} clienteId={clienteId} identity={identity} siteId={credit.selectedSiteId} />}
  </div>;
}
function ClientExportScope({ clienteId, identity, siteId }: { clienteId: number; identity: string; siteId: number | null }) {
  const params = siteId ? { ubicacionId: String(siteId) } : {};
  const q = useGetE7ClienteExportacion(clienteId, params, { query: { queryKey: ["/api/e7/clientes/exportacion", clienteId, params, identity], retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always" } });
  if (q.error) return <p role="alert">{message(q.error)} <Button onClick={() => void q.refetch()}>Reintentar exportación</Button></p>;
  if (!q.data || !q.isFetchedAfterMount) return <p role="status">Consultando vista previa de exportación E7…</p>;
  const d = q.data;
  if (d.clienteId !== clienteId) return <p role="alert">Respuesta ajena al cliente solicitado; exportación bloqueada.</p>;
  const suffix = siteId ? `?ubicacionId=${siteId}` : "";
  // Primary plus underline marks expandable financial figures, never positive or negative value.
  return <section data-testid="e7-client-export" className="space-y-4 rounded border p-4"><h2 className="font-semibold text-xl">Estado de cuenta financiero</h2><p>El resumen de crédito es global; los movimientos corresponden únicamente al alcance autorizado.</p><Scope scope={d.alcance} generated={d.generadoEn} /><Legends extra={d.leyendas} />
    <div data-testid="e7-global-four" className="grid gap-3 md:grid-cols-4">{[["Deuda actual", d.resumenGlobal.deudaActual], ["Saldo a favor", d.resumenGlobal.saldoAFavor], ["Límite de crédito global", d.resumenGlobal.limiteCredito], ["Crédito disponible", d.resumenGlobal.creditoDisponible]].map(([label, value]) => <details key={label}><summary className="cursor-pointer">{label}: <span className="text-primary underline">{money(value)}</span></summary><p className="text-sm text-muted-foreground">Base global del crédito de este cliente; movimientos visibles limitados al alcance autorizado.</p><Movements rows={d.movimientos} scope={d.alcance} clienteId={clienteId} /></details>)}</div>
    <nav className="flex gap-4" aria-label="Archivos de estado de cuenta E7">{[["estado-cuenta.pdf", "PDF"], ["estado-cuenta.xlsx", "XLSX"], ["estado-cuenta/imprimir", "Imprimir"]].map(([path, label]) => <a className="underline" key={path} href={`/api/clientes/${clienteId}/${path}${suffix}`} target="_blank" rel="noreferrer" data-testid={`e7-client-export-${label.toLowerCase()}`}>{label}</a>)}</nav>
    <Movements rows={d.movimientos} scope={d.alcance} clienteId={clienteId} /><Retained rows={d.retenidos} total={d.totalRetenido} scope={d.alcance} generated={d.generadoEn} />
  </section>;
}