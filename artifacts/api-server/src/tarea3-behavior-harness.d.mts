export function sourceModule(path: string, dependencies?: Record<string, unknown>): any;
export function paymentContracts(): any;
export function captureGuard(): any;
export function clientRoutes(balance?: number): {
  calls: unknown[];
  detail: unknown;
  get(path: string, params: Record<string, string>): Promise<any>;
};
export function posOperations(): {
  ticket(overrides?: Record<string, unknown>): any;
  load(ticket: any, options?: {
    flow?: "charge";
    existingCharge?: string;
    creditLimit?: string;
  }): { pos: any; tx: any; calls: unknown[] };
  authorizeInput(ticketId: number, aplicarSaldoAFavor?: string): any;
};
export function cajaActionsFor(ticket: {
  documentoTipo: string;
  cobrado?: boolean;
  autorizacionEstado?: string;
}): string[];