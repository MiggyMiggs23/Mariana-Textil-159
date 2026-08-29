import { Link, useRoute } from "wouter";
import { useGetViaje } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { formatNumber, formatUnit } from "@workspace/number-format";

export default function ViajeDetail() {
  const [, params] = useRoute("/viajes/:id");
  const id = Number(params?.id);
  const { data: rawViaje } = useGetViaje(id);
  const viaje: any = rawViaje;

  if (!viaje) return <AppLayout><p>Cargando viaje…</p></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex justify-between">
          <Link href="/viajes"><Button variant="ghost"><ArrowLeft />Volver</Button></Link>
          <Link href={`/viajes/${id}/documento`}><Button><Printer />Imprimir hoja</Button></Link>
        </div>
        <section>
          <h1 className="text-3xl font-bold">Viaje {viaje.folioFormateado}</h1>
          <p>{viaje.nombreOrigen} · {new Date(viaje.salidaAt).toLocaleString("es-MX")} · {viaje.camioneta} · {viaje.chofer}</p>
        </section>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border p-3">{viaje.documentos} documentos</div>
          <div className="rounded border p-3">{formatNumber(viaje.totalRollos, { kind: "count" })} rollos</div>
          <div className="rounded border p-3">{formatNumber(viaje.totalMetros, { kind: "quantity" })} {formatUnit("METRO")} · {formatNumber(viaje.totalKilos, { kind: "quantity" })} {formatUnit("KILO")}</div>
          {Number(viaje.totalBolsas) > 0 && (
            <div className="rounded border p-3">{formatNumber(viaje.totalBolsas, { kind: "quantity" })} {formatUnit("BOLSA")}</div>
          )}
        </div>
        <p><b>Destinos:</b> {viaje.destinos.join(", ")}</p>
        <section className="rounded border p-4">
          <h2 className="font-bold">Documentos</h2>
          {viaje.tickets.map((x: any) => <Link className="block py-2 underline" href={`/tickets/${x.id}`} key={`t${x.id}`}>Nota #{x.folio} · {x.destinatario || x.cliente}</Link>)}
          {viaje.salidas.map((x: any) => <Link className="block py-2 underline" href={`/salidas/${x.id}`} key={`s${x.id}`}>Salida #{x.folio} · {x.destino}</Link>)}
        </section>
        <section className="rounded border p-4">
          <h2 className="font-bold">Control por rollo</h2>
          {viaje.rollos.map((rollo: any, index: number) => <p key={`${rollo.documento}${index}`} className="font-mono">{rollo.serie} · {rollo.tela} {rollo.color} · {formatNumber(rollo.cantidad, { kind: "quantity" })} {formatUnit(rollo.unidad)}</p>)}
        </section>
      </div>
    </AppLayout>
  );
}