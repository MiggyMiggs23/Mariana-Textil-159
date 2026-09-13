export const TICKET_DOCUMENT_TYPES = [
  "TICKET",
  "NOTA",
  "TICKET_BOLSA_NORMAL",
  "TICKET_PIEZA_NORMAL",
  "TICKET_BOLSA_METREADO",
] as const;

export function isTicketDocumentType(tipo: string | null): boolean {
  return tipo != null && (TICKET_DOCUMENT_TYPES as readonly string[]).includes(tipo);
}

export type DocumentReference = {
  tipo: string | null;
  id: string | null;
};

export function resolveDocument(
  reference: DocumentReference,
  entradaMap: Map<number, { id: number; label: string }>,
  ticketMap: Map<number, number>,
  salidaMap: Map<number, string>,
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
  if (isTicketDocumentType(reference.tipo)) {
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
      route: `/salidas/${salidaId}/documento/recepcion`,
    };
  }
  return { label: null, route: null };
}