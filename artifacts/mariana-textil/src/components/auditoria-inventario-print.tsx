import type {
  AuditoriaInventarioParticipante,
  AuditoriaInventarioResultado,
} from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";
import { absoluteAppUrl } from "@/lib/print";
import { PrintableDocumentHeader } from "@/components/printable-document-header";

type AuditoriaInventarioPrintDetail = {
  id: number;
  folioFormateado: string;
  nombreUbicacion: string;
  estado: string;
  abiertaAt: string;
  cerradaAt?: string | null;
  totalSnapshot: number;
  totalEscaneados: number;
  cuadros: number;
  faltantes: number;
  sobrantes: number;
  malAcomodados: number;
  resultados: AuditoriaInventarioResultado[];
  participantes: AuditoriaInventarioParticipante[];
};

export type AuditoriaInventarioPrintProps = {
  detail: AuditoriaInventarioPrintDetail;
};

function duration(start: string, end?: string | null): string {
  if (!end) return "En curso";
  const seconds = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function AuditoriaInventarioPrint({
  detail,
}: AuditoriaInventarioPrintProps) {
  const grouped = {
    CUADRO: detail.resultados.filter((row) => row.clasificacion === "CUADRO"),
    FALTANTE: detail.resultados.filter(
      (row) => row.clasificacion === "FALTANTE",
    ),
    SOBRANTE: detail.resultados.filter(
      (row) => row.clasificacion === "SOBRANTE",
    ),
    MAL_ACOMODADO: detail.resultados.filter(
      (row) => row.clasificacion === "MAL_ACOMODADO",
    ),
  };

  return (
    <article
      className="audit-inventory-print print-only bg-white text-black"
      data-testid="document-audit-print"
    >
      <PrintableDocumentHeader
        className="gap-6 pb-3"
        qrUrl={absoluteAppUrl(
          `/inventario/auditorias?auditoriaId=${detail.id}`,
        )}
        qrLabel={`QR para abrir auditoría ${detail.folioFormateado}`}
        logoClassName="h-[100px] w-[100px]"
      >
        <div>
          <div className="text-sm font-bold uppercase tracking-widest">
            Mariana Textil · Auditoría de Inventario
          </div>
          <h1 className="mt-1 text-2xl font-bold">{detail.folioFormateado}</h1>
          <div>
            {detail.nombreUbicacion} · Estado: {detail.estado}
          </div>
          <div className="text-sm">
            Apertura: {new Date(detail.abiertaAt).toLocaleString("es-MX")} ·
            Cierre:{" "}
            {detail.cerradaAt
              ? new Date(detail.cerradaAt).toLocaleString("es-MX")
              : "En curso"}{" "}
            · Duración: {duration(detail.abiertaAt, detail.cerradaAt)}
          </div>
        </div>
      </PrintableDocumentHeader>
      <div className="my-3 grid grid-cols-6 gap-2 text-center text-sm">
        <div>
          Snapshot
          <br />
          <b>{detail.totalSnapshot}</b>
        </div>
        <div>
          Escaneados
          <br />
          <b>{detail.totalEscaneados}</b>
        </div>
        <div>
          Cuadro
          <br />
          <b>{detail.cuadros}</b>
        </div>
        <div>
          Faltante
          <br />
          <b>{detail.faltantes}</b>
        </div>
        <div>
          Sobrante
          <br />
          <b>{detail.sobrantes}</b>
        </div>
        <div>
          Mal Acomodado
          <br />
          <b>{detail.malAcomodados || 0}</b>
        </div>
      </div>
      {(
        ["CUADRO", "FALTANTE", "SOBRANTE", "MAL_ACOMODADO"] as const
      ).map((kind) => (
        <section key={kind} className="mb-4">
          <h2 className="border-b border-black font-bold">
            {kind.replace("_", " ")} ({grouped[kind].length})
          </h2>
          {grouped[kind].map((row) => (
            <div
              key={row.serie}
              className={`audit-inventory-row grid ${
                kind === "MAL_ACOMODADO"
                  ? "grid-cols-[100px_1fr_100px_120px_120px_100px]"
                  : "grid-cols-[100px_1fr_100px_130px_100px]"
              } border-b py-1 text-xs`}
              data-audit-row={row.serie}
            >
              <b>{row.serie}</b>
              <span>{row.producto ?? "Sin registro"}</span>
              <span>
                {formatNumber(row.cantidad, { kind: "quantity" })}{" "}
                {row.unidad ? formatUnit(row.unidad) : ""}
              </span>
              {kind === "MAL_ACOMODADO" ? (
                <>
                  <span>Esperado: {row.pisoEsperado ?? "Sin piso"}</span>
                  <span>Real: {row.pisoReal ?? "Desconocido"}</span>
                </>
              ) : (
                <span>{row.ubicacionActual ?? "Sin ubicación"}</span>
              )}
              <span>{row.estadoActual}</span>
            </div>
          ))}
        </section>
      ))}
      <section>
        <h2 className="font-bold">Participantes</h2>
        {detail.participantes.map((person) => (
          <div key={person.usuarioId} className="text-sm">
            {person.nombre}: {person.escaneos} escaneos
          </div>
        ))}
      </section>
      <footer className="audit-inventory-signatures mt-14 grid grid-cols-2 gap-16 text-center text-sm">
        <div className="border-t border-black pt-2">Responsable de conteo</div>
        <div className="border-t border-black pt-2">Autorización ADMIN</div>
      </footer>
    </article>
  );
}