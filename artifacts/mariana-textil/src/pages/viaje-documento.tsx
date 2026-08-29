import { useParams, Link } from "wouter";
import { useGetViaje } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { formatNumber, formatUnit } from "@workspace/number-format";

/** Carta/216x279mm printable dispatch control sheet. */
export default function ViajeDocumento() {
  const { id } = useParams();
  const { data: rawViaje } = useGetViaje(Number(id));
  const viaje: any = rawViaje;
  if (!viaje) return <p>Cargando documento…</p>;

  return (
    <div className="min-h-screen bg-muted p-6 print:p-0">
      <div className="no-print mb-4 flex justify-between">
        <Link href={`/viajes/${id}`}><Button variant="outline"><ArrowLeft />Volver</Button></Link>
        <Button onClick={() => { document.body.classList.add("print-viaje"); window.print(); }}><Printer />Imprimir</Button>
      </div>
      <article className="viaje-page viaje-page-print mx-auto min-h-[279mm] w-[216mm] bg-white p-[14mm] text-sm">
        <header className="border-b-2 border-slate-900 pb-4">
          <h1 className="text-3xl font-black">HOJA DE VIAJE</h1>
          <p className="text-lg font-bold">{viaje.folioFormateado}</p>
        </header>
        <div className="my-5 grid grid-cols-2 gap-3">
          <p><b>Origen:</b> {viaje.nombreOrigen}</p><p><b>Salida:</b> {new Date(viaje.salidaAt).toLocaleString("es-MX")}</p>
          <p><b>Camioneta:</b> {viaje.camioneta}</p><p><b>Chofer:</b> {viaje.chofer}</p>
          <p className="col-span-2"><b>Destinos:</b> {viaje.destinos.join(", ")}</p>
        </div>
        <h2 className="font-bold">Documentos</h2>
        <ul className="mb-4 list-disc pl-5">
          {viaje.tickets.map((ticket: any) => <li key={`t${ticket.id}`}>NOTA #{ticket.folio} · {ticket.destinatario || ticket.cliente}</li>)}
          {viaje.salidas.map((salida: any) => <li key={`s${salida.id}`}>SALIDA #{salida.folio} · {salida.destino}</li>)}
        </ul>
        <table className="w-full border-collapse border">
          <thead><tr className="bg-slate-100"><th>Serie</th><th>Documento</th><th>Producto</th><th>Cantidad</th></tr></thead>
          <tbody>{viaje.rollos.map((rollo: any, index: number) => <tr key={index} className="border"><td className="font-mono">{rollo.serie}</td><td>{rollo.documento} #{rollo.documentoId}</td><td>{rollo.tela} {rollo.color}</td><td>{formatNumber(rollo.cantidad, { kind: "quantity" })} {formatUnit(rollo.unidad)}</td></tr>)}</tbody>
        </table>
        <footer className="mt-5 border-t pt-3">
          <b>Totales:</b> {viaje.documentos} documentos · {formatNumber(viaje.totalRollos, { kind: "count" })} rollos · {formatNumber(viaje.totalMetros, { kind: "quantity" })} {formatUnit("METRO")} · {formatNumber(viaje.totalKilos, { kind: "quantity" })} {formatUnit("KILO")}
          {Number(viaje.totalBolsas) > 0 && <> · {formatNumber(viaje.totalBolsas, { kind: "quantity" })} {formatUnit("BOLSA")}</>}
        </footer>
      </article>
    </div>
  );
}