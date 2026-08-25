export type CreditSalePortion = {
  ticketId: number | null;
  amount: number;
  linkedReversal: number;
};

/** Reference implementation used to verify the SQL FIFO allocation contract. */
export function allocateCreditFifo(
  sales: CreditSalePortion[],
  fifoNegativeAmount: number,
): Array<{ ticketId: number | null; outstanding: number }> {
  let available = Math.max(0, fifoNegativeAmount);
  return sales.flatMap((sale) => {
    const net = Math.max(0, sale.amount - sale.linkedReversal);
    const applied = Math.min(net, available);
    available -= applied;
    const outstanding = net - applied;
    return outstanding > 0 ? [{ ticketId: sale.ticketId, outstanding }] : [];
  });
}