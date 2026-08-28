import { getListSolicitudesPagoDirigidoQueryKey, useListSolicitudesPagoDirigido } from "@workspace/api-client-react";
import { formatNumber } from "@workspace/number-format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DirectedPaymentHistory({ tipo, entidadId }: { tipo: "CLIENTE" | "PROVEEDOR"; entidadId: number }) {
  const params = { tipo, entidadId };
  const query = useListSolicitudesPagoDirigido(params, {
    query: { enabled: Number.isInteger(entidadId) && entidadId > 0, queryKey: getListSolicitudesPagoDirigidoQueryKey(params) },
  });
  return (
    <Card data-testid="directed-payment-history">
      <CardHeader><CardTitle>Solicitudes de pago dirigido</CardTitle></CardHeader>
      <CardContent>
        {query.isLoading ? <p className="text-sm text-muted-foreground">Cargando solicitudes…</p>
          : query.isError ? <p className="text-sm text-destructive">No se pudo cargar el historial.</p>
          : !query.data?.solicitudes.length ? <p className="text-sm text-muted-foreground">Sin solicitudes para esta entidad.</p>
          : <div className="space-y-3">{query.data.solicitudes.map((item) => (
            <div key={item.id} className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4">
              <div><span className="text-muted-foreground">Fecha</span><p>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(item.createdAt))}</p></div>
              <div><span className="text-muted-foreground">Documento</span><p className="font-medium">{item.documentoFolio}</p></div>
              <div><span className="text-muted-foreground">Importe</span><p className="font-semibold">{formatNumber(item.importe, { kind: "money" })}</p></div>
              <div><span className="text-muted-foreground">Estado</span><p><Badge variant={item.estado === "RECHAZADA" ? "destructive" : item.estado === "APROBADA" ? "default" : "secondary"}>{item.estado}</Badge></p></div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">Motivo</span><p>{item.motivo}</p></div>
              <div><span className="text-muted-foreground">Solicitante</span><p>{item.solicitanteNombre}</p></div>
              <div><span className="text-muted-foreground">Autorizador</span><p>{item.autorizadorNombre || "Pendiente"}</p></div>
            </div>
          ))}</div>}
      </CardContent>
    </Card>
  );
}