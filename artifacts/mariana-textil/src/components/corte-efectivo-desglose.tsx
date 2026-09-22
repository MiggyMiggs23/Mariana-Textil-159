import { Link } from "wouter";
import { E12_ENABLED } from "@/lib/e12-feature-flags";
import type {
  EfectivoDesglose,
  EfectivoDesgloseDocumentosItem,
} from "@workspace/api-client-react";
import { formatNumber } from "@workspace/number-format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const originLabels: Record<EfectivoDesgloseDocumentosItem["origen"], string> = {
  FONDO_INICIAL: "Fondo inicial",
  TICKET: "Ticket",
  ABONO: "Abono de crédito",
  COBRO_RETENIDO: "Cobro retenido",
  SALIDA: "Salida física",
  RETORNO_PROVEEDOR: "Retorno de Proveedor",
};

function isKnownInternalDocumentHref(href: string | null): href is string {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return false;
  const pathname = href.split(/[?#]/, 1)[0];
  return /^\/tickets\/\d+$/.test(pathname) || /^\/clientes\/\d+$/.test(pathname) || (E12_ENABLED && /^\/proveedores\/\d+$/.test(pathname));
}

function formatEvidenceDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function MoneyRow({ label, value, subtract = false, strong = false }: {
  label: string;
  value: string;
  subtract?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? "border-t pt-2 font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">
        {subtract ? "− " : ""}{formatNumber(value, { kind: "money" })}
      </span>
    </div>
  );
}

export function CorteEfectivoDesglose({ desglose }: { desglose?: EfectivoDesglose }) {
  if (!desglose) {
    return (
      <section className="rounded-lg border p-4" data-testid="corte-efectivo-desglose-no-disponible">
        <h3 className="font-bold">Trazabilidad del efectivo</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Este corte conserva sus importes originales. El desglose documental no está disponible en esta respuesta.
        </p>
      </section>
    );
  }

  const isLegacy = desglose.version === "LEGACY";

  return (
    <section
      className="overflow-hidden rounded-lg border"
      data-testid="corte-efectivo-desglose"
      data-version={desglose.version}
    >
      <div className="border-b bg-muted/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Trazabilidad del efectivo esperado</h3>
          <span className="rounded border bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
            {isLegacy ? "Cálculo histórico conservado" : "Fórmula E2"}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isLegacy
            ? "Lectura LEGACY: se conserva la fórmula anterior del corte cerrado, sin incorporarle los nuevos sumandos de E2."
            : `Fondo inicial + tickets en efectivo + abonos físicos + cobros retenidos${E12_ENABLED && desglose.retornosProveedor !== undefined ? " + retornos de proveedor" : ""} − salidas físicas.`}
        </p>
      </div>

      <div className="grid gap-5 p-4 md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)]">
        <div className="space-y-2 text-sm">
          {isLegacy ? (
            <>
              <MoneyRow label="Fondo inicial registrado" value={desglose.fondoInicial} />
              <MoneyRow label="Efectivo esperado conservado" value={desglose.efectivoEsperado} strong />
              <p className="text-xs text-muted-foreground">
                Los componentes exclusivos de E2 no se presentan como ceros calculados para este corte histórico.
              </p>
            </>
          ) : (
            <>
              <MoneyRow label="Fondo inicial" value={desglose.fondoInicial} />
              <MoneyRow label="Cobros físicos de tickets" value={desglose.cobrosTickets} />
              {E12_ENABLED && desglose.retornosProveedor !== undefined && (
                <MoneyRow label="Retornos de proveedor" value={desglose.retornosProveedor} />
              )}
              <MoneyRow label="Abonos físicos de crédito" value={desglose.abonosFisicos} />
              <MoneyRow label="Cobros físicos retenidos" value={desglose.cobrosRetenidos} />
              <MoneyRow label="Salidas físicas" value={desglose.salidasFisicas} subtract />
              <MoneyRow label="Efectivo esperado" value={desglose.efectivoEsperado} strong />
            </>
          )}
        </div>

        <div className="min-w-0">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Documentos que componen el cálculo
          </h4>
          {desglose.documentos.length === 0 ? (
            <p className="rounded border border-dashed p-3 text-xs text-muted-foreground">
              El cálculo no tiene documentos asociados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Origen</TableHead>
                    <TableHead>Documento y evidencia</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {desglose.documentos.map((documento) => {
                    const label = documento.folio || `ID ${documento.id}`;
                    return (
                      <TableRow key={`${documento.origen}-${documento.id}`}>
                        <TableCell>{originLabels[documento.origen]}</TableCell>
                        <TableCell>
                          <div className="break-all font-mono">
                            {isKnownInternalDocumentHref(documento.href) ? (
                              <Link href={documento.href} className="font-semibold text-primary hover:underline">
                                {label}
                              </Link>
                            ) : label}
                          </div>
                          {documento.evidencia && (
                            <dl className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                              {documento.evidencia.referencia && (
                                <div><dt className="inline font-semibold">Referencia: </dt><dd className="inline">{documento.evidencia.referencia}</dd></div>
                              )}
                              {documento.evidencia.motivo && (
                                <div><dt className="inline font-semibold">Motivo: </dt><dd className="inline whitespace-pre-wrap">{documento.evidencia.motivo}</dd></div>
                              )}
                              {documento.evidencia.fecha && (
                                <div><dt className="inline font-semibold">Fecha: </dt><dd className="inline">{formatEvidenceDate(documento.evidencia.fecha)}</dd></div>
                              )}
                               {documento.evidencia.usuarioNombre && (
                                 <div><dt className="inline font-semibold">Registró: </dt><dd className="inline">{documento.evidencia.usuarioNombre}</dd></div>
                               )}
                               {E12_ENABLED && documento.evidencia.naturalezaRetornoE12 && (
                                 <div><dt className="inline font-semibold">Naturaleza: </dt><dd className="inline">{documento.evidencia.naturalezaRetornoE12 === "CORRECCION_CAPTURA" ? "Corrección de captura (no declara devolución física)" : "Recuperación física de efectivo"}</dd></div>
                               )}
                               {documento.evidencia.proveedorNombre && (
                                 <div><dt className="inline font-semibold">Proveedor: </dt><dd className="inline">{documento.evidencia.proveedorNombre}</dd></div>
                               )}
                            </dl>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {documento.origen === "SALIDA" ? "− " : ""}
                          {formatNumber(documento.importe, { kind: "money" })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}