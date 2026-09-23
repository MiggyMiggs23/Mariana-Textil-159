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
import { useLocationScope } from "@/lib/location-scope";
import { Button } from "@/components/ui/button";

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
function Movements({ rows, scope }: { rows: E7Movimiento[]; scope: CarteraAlcance }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm" data-testid="e7-movements"><thead><tr>{["Fecha", "Concepto", "Sitio", "Cuenta de origen comprobada", "Folio", "Importe", "Saldo pendiente de nota"].map(t => <th className="p-2 text-left" key={t}>{t}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id}>{[r.fecha, r.tipo, site(r.ubicacionId, scope), r.cuentaDestino ?? "Sin cuenta determinada", r.folio ?? "Sin folio", money(r.importe), r.saldoPendiente == null ? "No corresponde" : money(r.saldoPendiente)].map((t, i) => <td className="p-2 border-t" key={i}>{t}</td>)}</tr>)}</tbody></table>{!rows.length && <p>Sin movimientos en el alcance consultado.</p>}</div>;
}
function Retained({ rows, total, scope, generated }: { rows: E7Retenido[]; total: string; scope: CarteraAlcance; generated: string }) {
  return <section data-testid="e7-retained" className="space-y-2"><h3 className="font-semibold">Dinero retenido pendiente de aplicación: {money(total)}</h3><p>Stock del alcance al {generated}; no limitado al periodo de recepción seleccionado. No es deuda ni favor.</p><ul>{rows.map(r => <li key={r.cobroId} className={r.antiguedadDias >= 3 ? "border-l-4 border-amber-500 pl-2" : ""}>Recepción {r.fechaRecepcion} · {site(r.ubicacionId, scope)} · {money(r.importePendiente)} · {r.antiguedadDias} días{r.antiguedadDias >= 3 ? " · Desde 3 días: requiere atención ADMIN" : ""}</li>)}</ul>{!rows.length && <p>Sin dinero retenido en el alcance.</p>}</section>;
}
function Attribution({ desde, hasta, identity }: { desde: string; hasta: string; identity: string }) {
  const { selectedLocationId } = useLocationScope();
  const start = Date.parse(`${desde}T00:00:00Z`), end = Date.parse(`${hasta}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)
    || !Number.isFinite(start) || !Number.isFinite(end)
    || new Date(start).toISOString().slice(0, 10) !== desde || new Date(end).toISOString().slice(0, 10) !== hasta
    || end < start || (end - start) / 86400000 + 1 > 366)
    return <p role="alert" data-testid="e7-range-error">E7 requiere fechas válidas ordenadas y un rango inclusivo máximo de 366 días. Corrige el selector; no se trunca el periodo.</p>;
  const params: GetE7AtribucionParams = { desde, hasta, ...(selectedLocationId ? { ubicacionId: String(selectedLocationId) } : {}) };
  return <AttributionScope key={JSON.stringify(params)} params={params} identity={identity} />;
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
  return <section data-testid="e7-attribution" className="space-y-4 rounded border p-4"><h2 className="text-xl font-semibold">Atribución de cobranza y aplicaciones</h2><Scope scope={d.alcance} generated={d.generadoEn} /><p>Periodo inclusivo CDMX: {params.desde} — {params.hasta}</p>
    <div className="grid gap-3 md:grid-cols-3">{d.alcance.tipo === "GLOBAL" ? <><p data-testid="e7-collection">Cobranza del periodo: {money(d.cobranzaTotal)}</p><p>Recepciones físicas comprobadas: {money(d.recepcionesFisicas)}</p></> : <p>No se atribuye recepción física ni cobranza global a esta selección de sitios.</p>}<p data-testid="e7-applications">Aplicaciones comprobables a notas: {money(d.aplicacionesNotas)}</p></div>
    <Legends extra={d.leyendas} /><p>El registro histórico y las correcciones no acreditan nuevo ingreso físico. No se suman aplicaciones a cobranza.</p>
    <div className="flex gap-3"><Button disabled={busy} onClick={() => void download("pdf")} data-testid="e7-export-pdf">Descargar PDF E7</Button><Button disabled={busy} onClick={() => void download("xlsx")} data-testid="e7-export-xlsx">Descargar XLSX E7</Button><Button variant="outline" onClick={() => void q.refetch()}>Actualizar E7</Button></div>{error && <p role="alert">{error}</p>}
    <h3 className="font-semibold">Puente por fuente, cuenta y sitio</h3><ul data-testid="e7-bridge">{d.puente.map((r, i) => <li key={i}>{r.tipo} · {r.cuentaDestino ?? "Sin cuenta determinada"} · {site(r.ubicacionId, d.alcance)} · {money(r.total)}</li>)}</ul>{!d.puente.length && <p>Sin filas en el puente del periodo.</p>}
    <Movements rows={d.movimientos} scope={d.alcance} /><Retained rows={d.retenidos} total={d.totalRetenido} scope={d.alcance} generated={d.generadoEn} />
  </section>;
}
function ClientExport({ clienteId, identity }: { clienteId: number; identity: string }) {
  const { selectedLocationId } = useLocationScope();
  return <ClientExportScope key={`${clienteId}:${selectedLocationId}`} clienteId={clienteId} identity={identity} siteId={selectedLocationId} />;
}
function ClientExportScope({ clienteId, identity, siteId }: { clienteId: number; identity: string; siteId: number | null }) {
  const params = siteId ? { ubicacionId: String(siteId) } : {};
  const q = useGetE7ClienteExportacion(clienteId, params, { query: { queryKey: ["/api/e7/clientes/exportacion", clienteId, params, identity], retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: "always" } });
  if (q.error) return <p role="alert">{message(q.error)} <Button onClick={() => void q.refetch()}>Reintentar exportación</Button></p>;
  if (!q.data || !q.isFetchedAfterMount) return <p role="status">Consultando vista previa de exportación E7…</p>;
  const d = q.data;
  if (d.clienteId !== clienteId) return <p role="alert">Respuesta ajena al cliente solicitado; exportación bloqueada.</p>;
  const suffix = siteId ? `?ubicacionId=${siteId}` : "";
  return <section data-testid="e7-client-export" className="space-y-4 rounded border p-4"><h2 className="font-semibold text-xl">Estado de cuenta financiero</h2><p>El resumen de crédito es global; los movimientos corresponden únicamente al alcance autorizado.</p><Scope scope={d.alcance} generated={d.generadoEn} /><Legends extra={d.leyendas} />
    <div data-testid="e7-global-four" className="grid gap-3 md:grid-cols-4"><p>Deuda actual: {money(d.resumenGlobal.deudaActual)}</p><p>Saldo a favor: {money(d.resumenGlobal.saldoAFavor)}</p><p>Límite de crédito global: {money(d.resumenGlobal.limiteCredito)}</p><p>Crédito disponible: {money(d.resumenGlobal.creditoDisponible)}</p></div>
    <nav className="flex gap-4" aria-label="Archivos de estado de cuenta E7">{[["estado-cuenta.pdf", "PDF"], ["estado-cuenta.xlsx", "XLSX"], ["estado-cuenta/imprimir", "Imprimir"]].map(([path, label]) => <a className="underline" key={path} href={`/api/clientes/${clienteId}/${path}${suffix}`} target="_blank" rel="noreferrer" data-testid={`e7-client-export-${label.toLowerCase()}`}>{label}</a>)}</nav>
    <Movements rows={d.movimientos} scope={d.alcance} /><Retained rows={d.retenidos} total={d.totalRetenido} scope={d.alcance} generated={d.generadoEn} />
  </section>;
}