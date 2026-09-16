export const TICKET_DOCUMENT_TYPES = [
  "TICKET",
  "NOTA",
  "TICKET_BOLSA_NORMAL",
  "TICKET_PIEZA_NORMAL",
  "TICKET_BOLSA_METREADO",
] as const;

/** Ticket-backed movement types whose document ID is safe for navigation. */
export const TICKET_NAVIGATION_DOCUMENT_TYPES = [
  ...TICKET_DOCUMENT_TYPES,
  "TICKET_METRO_METREADO",
] as const;

export function isTicketDocumentType(tipo: string | null): boolean {
  return tipo != null && (TICKET_DOCUMENT_TYPES as readonly string[]).includes(tipo);
}

export function isTicketNavigationDocumentType(tipo: string | null): boolean {
  return (
    tipo != null &&
    (TICKET_NAVIGATION_DOCUMENT_TYPES as readonly string[]).includes(tipo)
  );
}

export type DocumentReference = {
  tipo: string | null;
  id: string | null;
};

/**
 * The credit movement route is nested under its owning client.  The owner is
 * deliberately kept as an ID-only lookup result: document resolution must not
 * turn an inventory history read into a client catalog read.
 */
export type CreditMovementOwner = {
  clienteId: number;
};

export type MovementDocumentSource = {
  tipo: string;
  documentoTipo: string | null;
  documentoId: string | null;
  movimientoOrigenId: number | null;
  rolloId?: number | null;
  /** Stable rollo → entrada FK used for historical RECEPCION rows. */
  recepcionId?: number | null;
};

export type OriginalMovementReference = DocumentReference & {
  rolloId?: number | null;
};

/**
 * Selects the document reference without interpreting human folios as IDs.
 * RECEPCION references use rollos.recepcionId because old rows may contain an
 * entry folio in documentoId; a missing relationship is intentionally unsafe.
 * Cancellation rows inherit only their original movement reference when both
 * movements identify the same rollo.
 */
export function resolveMovementReference(
  source: MovementDocumentSource,
  originalReference?: OriginalMovementReference | null,
): DocumentReference {
  const safeOriginal =
    originalReference?.tipo &&
    originalReference.id &&
    source.rolloId != null &&
    originalReference.rolloId != null &&
    source.rolloId === originalReference.rolloId
      ? originalReference
      : null;
  const reference = source.tipo === "CANCELACION"
    ? safeOriginal?.tipo && safeOriginal.id
      ? { tipo: safeOriginal.tipo, id: safeOriginal.id }
      : { tipo: null, id: null }
    : { tipo: source.documentoTipo, id: source.documentoId };

  if (reference.tipo !== "ENTRADA") return reference;
  return source.recepcionId == null
    ? { tipo: "ENTRADA", id: null }
    : { tipo: "ENTRADA", id: String(source.recepcionId) };
}

export function resolveDocument(
  reference: DocumentReference,
  entradaMap: Map<number, { id: number; label: string }>,
  ticketMap: Map<number, number>,
  salidaMap: Map<number, string>,
  creditMovementMap: Map<number, CreditMovementOwner> = new Map(),
): { label: string | null; route: string | null } {
  if (!reference.tipo || !reference.id) return { label: null, route: null };
  if (reference.tipo === "ENTRADA") {
    const entry = entradaMap.get(Number(reference.id));
    return entry == null
      ? { label: null, route: null }
      : {
          label: `Entrada ${entry.label}`,
          route: `/entradas/${entry.id}/documento`,
        };
  }
  if (isTicketNavigationDocumentType(reference.tipo)) {
    const ticketId = Number(reference.id);
    const folio = ticketMap.get(ticketId);
    if (folio == null) return { label: null, route: null };
    return {
      label: `${reference.tipo === "NOTA" ? "Nota" : "Ticket"} ${folio}`,
      route: `/tickets/${ticketId}`,
    };
  }
  if (reference.tipo === "SALIDA") {
    const salidaId = Number(reference.id);
    const folio = salidaMap.get(salidaId);
    if (folio == null) return { label: null, route: null };
    return {
      label: `Salida ${folio}`,
      route: `/salidas/${salidaId}`,
    };
  }
  if (reference.tipo === "RECEPCION_SALIDA") {
    const salidaId = Number(reference.id);
    const folio = salidaMap.get(salidaId);
    if (folio == null) return { label: null, route: null };
    return {
      label: `Recepción de salida ${folio}`,
      route: `/salidas/${salidaId}`,
    };
  }
  if (reference.tipo === "MOVIMIENTO_CREDITO") {
    const movementId = Number(reference.id);
    const owner = creditMovementMap.get(movementId);
    if (
      owner == null ||
      !Number.isSafeInteger(owner.clienteId) ||
      owner.clienteId <= 0
    ) {
      return { label: null, route: null };
    }
    return {
      label: `Movimiento de crédito ${movementId}`,
      route: `/clientes/${owner.clienteId}/movimientos/${movementId}`,
    };
  }
  return { label: null, route: null };
}

/**
 * Named export for consumers that need the shared Kardex document resolver.
 * Keep resolveDocument as the compatibility name used by existing Kardex
 * callers and tests.
 */
export const resolveKardexDocument = resolveDocument;