/**
 * Canonical financial inclusion rule. Operational inventory remains tied to
 * VENDIDO, but sales, cost, margin and profit exist only after Caja processes
 * the document: charged cash Ticket or explicitly authorized credit Note.
 */
export function accountedDocumentPredicate(alias = "t"): string {
  return `(${alias}.estado='VENDIDO' AND ((${alias}.documento_tipo='TICKET' AND ${alias}.cobrado=true) OR (${alias}.documento_tipo='NOTA' AND ${alias}.autorizacion_estado='AUTORIZADA')))`;
}

export function pendingTicketPredicate(alias = "t"): string {
  return `(${alias}.estado='VENDIDO' AND ${alias}.documento_tipo='TICKET' AND ${alias}.cobrado=false)`;
}

/** Caja processing instant used by every financial date range and grouping. */
export function accountedDocumentAt(alias = "t"): string {
  return `CASE WHEN ${alias}.documento_tipo='TICKET' THEN ${alias}.cobrado_at ELSE ${alias}.autorizado_at END`;
}