/** A folio result belongs to the site that produced it. Direct QR/ID lookups
 * have no folio site and remain intentionally independent of this selector. */
export function visibleCreditTicketId(
  ticketId: number | null,
  folioSiteId: number | null | undefined,
  selectedSiteId: number | null,
): number | null {
  return folioSiteId !== undefined && folioSiteId !== selectedSiteId ? null : ticketId;
}