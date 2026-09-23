import { useGetCurrentUser, useListViajes, getGetCurrentUserQueryKey, getListViajesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@workspace/number-format";
import { Plus, Truck } from "lucide-react";
import { hasPermission, Modules } from "@/lib/permisos";

/** Historical dispatch list; creation is intentionally a separate operational flow. */
export default function Viajes() {
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const { data, isLoading } = useListViajes(undefined, { query: { queryKey: getListViajesQueryKey(undefined) } });
  const canCreate = hasPermission(user, Modules.VIAJES, "crear");
  return <AppLayout><div className="mx-auto max-w-6xl space-y-6 pb-12">
    <div className="flex items-center justify-between gap-4"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><Truck className="text-primary" />Viajes</h1><p className="mt-1 text-muted-foreground">Historial de hojas de despacho.</p></div>
      {canCreate && <Link href="/viajes/nuevo"><Button><Plus className="mr-2 h-4 w-4" />Nuevo viaje</Button></Link>}</div>
    <Card><CardHeader><CardTitle>Viajes registrados</CardTitle></CardHeader><CardContent className="p-0">
      {isLoading ? <p className="p-6 text-muted-foreground">Cargando viajes…</p> : !data?.length ? <p className="p-6 text-muted-foreground">No hay viajes registrados.</p> :
        <div className="divide-y">{data.map((viaje) => <div key={viaje.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40">
          <div><Link href={`/viajes/${viaje.id}`} className="font-bold text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid={`link-viaje-${viaje.id}`}>{viaje.folioFormateado}</Link><p className="text-sm text-muted-foreground">{viaje.nombreOrigen} · {new Date(viaje.salidaAt).toLocaleString("es-MX")}</p></div>
          <div className="text-right text-sm"><p className="flex items-center justify-end gap-1"><Truck className="h-4 w-4" />{viaje.camioneta}</p><p className="text-muted-foreground">{viaje.chofer} · {formatNumber(viaje.documentos, { kind: "count" })} documentos</p></div>
        </div>)}</div>}
    </CardContent></Card>
  </div></AppLayout>;
}