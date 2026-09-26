import { ExternalLink } from "lucide-react";
import { Link } from "wouter";

export interface MovimientoDocumentoReference {
  /** Route resolved by the API for the actual document primary key. */
  documentoRuta?: string | null;
  /** Human-readable label resolved by the API (it may be unavailable). */
  documentoEtiqueta?: string | null;
  documentoTipo?: string | null;
  documentoId?: string | null;
}

interface MovimientoDocumentoLinkProps {
  movimiento: MovimientoDocumentoReference;
  className?: string;
  "data-testid"?: string;
}

const documentLinkClass =
  "inline-flex items-center gap-1.5 text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function documentLabel(movimiento: MovimientoDocumentoReference) {
  return movimiento.documentoEtiqueta || "Abrir documento";
}

function hasUnresolvedReference(movimiento: MovimientoDocumentoReference) {
  return Boolean(
    movimiento.documentoEtiqueta ||
      movimiento.documentoTipo ||
      movimiento.documentoId,
  );
}

export function MovimientoDocumentoLink({
  movimiento,
  className,
  "data-testid": dataTestId,
}: MovimientoDocumentoLinkProps) {
  if (!movimiento.documentoRuta) return null;

  const label = documentLabel(movimiento);
  return (
    <Link
      href={movimiento.documentoRuta}
      className={className ? `${documentLinkClass} ${className}` : documentLinkClass}
      aria-label={`Abrir ${label}`}
      data-testid={dataTestId}
    >
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export function MovimientoDocumentoFallback({
  movimiento,
  compact = false,
}: {
  movimiento: MovimientoDocumentoReference;
  compact?: boolean;
}) {
  if (hasUnresolvedReference(movimiento)) {
    const reference =
      movimiento.documentoEtiqueta ||
      [movimiento.documentoTipo, movimiento.documentoId].filter(Boolean).join(" ");
    return (
      <span className="text-muted-foreground italic">
        {reference} — Referencia no resuelta
      </span>
    );
  }

  return <span className="text-muted-foreground">{compact ? "Sin doc" : "Sin documento"}</span>;
}

export function MovimientoDocumento({
  movimiento,
  compact = false,
  className,
  "data-testid": dataTestId,
}: MovimientoDocumentoLinkProps & { compact?: boolean }) {
  return movimiento.documentoRuta ? (
    <MovimientoDocumentoLink
      movimiento={movimiento}
      className={className}
      data-testid={dataTestId}
    />
  ) : (
    <MovimientoDocumentoFallback movimiento={movimiento} compact={compact} />
  );
}