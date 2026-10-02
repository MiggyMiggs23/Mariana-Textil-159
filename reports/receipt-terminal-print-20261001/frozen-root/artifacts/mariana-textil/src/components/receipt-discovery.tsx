import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch, useGetCurrentUser, type E3Receipt, type E5Documento } from "@workspace/api-client-react";
import { hasPermission } from "@/lib/permisos";
import { E3_ENABLED } from "@/lib/e3-feature-flags";
import { E5_ENABLED } from "@/lib/e5-feature-flags";
import { Input } from "@/components/ui/input";

/** A documentary search, deliberately independent of customers, credit and cash APIs. */
export function ReceiptDiscovery() {
  const user = useGetCurrentUser();
  const [buscar, setBuscar] = useState("");
  const allowed = hasPermission(user.data, "recibos_abonos");
  const scope = `${user.data?.id}:${user.data?.ubicacion?.id}:${allowed}`;
  const receipts = useQuery({
    queryKey: ["receipt-discovery", scope, buscar], enabled: allowed,
    queryFn: async () => {
      const query = `?buscar=${encodeURIComponent(buscar.trim())}`;
      const [e3, e5] = await Promise.all([
        E3_ENABLED ? customFetch<E3Receipt[]>(`/api/caja/recibos-e3${query}`) : [],
        E5_ENABLED ? customFetch<E5Documento[]>(`/api/e5/recibos${query}`) : [],
      ]);
      return [
        ...e3.map(r => ({ folio: r.folio, cliente: r.clienteNombre, fecha: String(r.recibidoEn), href: `/recibos-e3/${r.folio}` })),
        ...e5.map(r => ({ folio: r.folio, cliente: r.clienteNombre, fecha: String(r.fechaRecepcion), href: `/cobros/pendientes/${r.cobroId}/documentos/${r.id}` })),
      ].sort((a, b) => b.fecha.localeCompare(a.fecha));
    },
  });
  if (!allowed) return null;
  return <section aria-label="Consultar e imprimir recibos" className="rounded-lg border p-4 my-4 space-y-3">
    <h2 className="font-semibold">Consultar / imprimir recibos de abonos</h2>
    <p className="text-sm text-muted-foreground">{user.data?.rol === "ADMIN" ? "Evidencia documental disponible." : "Evidencia recibida en Caja de tu sitio asignado."} Consultar o reimprimir no autoriza ni aplica dinero.</p>
    <Input aria-label="Buscar recibos por folio o cliente" placeholder="Buscar por folio o cliente" value={buscar} onChange={e => setBuscar(e.target.value)} />
    {receipts.isError ? <div role="alert">No fue posible consultar recibos. <button onClick={() => void receipts.refetch()}>Reintentar</button></div>
      : receipts.isPending ? <p>Cargando recibos…</p>
        : !receipts.data?.length ? <p>No hay recibos con evidencia disponible para esta búsqueda.</p>
          : <ul className="max-h-72 overflow-auto space-y-2">{receipts.data.map(r => <li key={r.href}>
            <Link className="text-primary underline" href={r.href}>{r.folio} · {r.cliente} · {new Date(r.fecha).toLocaleString("es-MX")}</Link>
          </li>)}</ul>}
  </section>;
}