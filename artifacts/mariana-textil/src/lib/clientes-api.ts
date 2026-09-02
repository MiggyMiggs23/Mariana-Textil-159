/** Typed callers for documented client endpoints that are newer than generated API hooks. */
export type Period = { desde?: string; hasta?: string };
export type AccountMovement = { id?: number; tipo?: string; importe?: string; fecha?: string; fechaEfectiva?: string; notas?: string | null; saldoCorrido?: string; nombreUsuario?: string | null; formaPago?: string | null; desgloseIva?: { subtotal: string; iva: string } | null; referencia?: string | null; ticketFolio?: string | null };
export type Account = { clienteId: number; movimientos: AccountMovement[]; saldoActual: string };
export type Purchase = { id?: number; folio?: string; fecha?: string; subtotal?: string; iva?: string; total?: string; metros?: string; kilos?: string; bolsas?: string; rollosMetros?: string; rollosKilos?: string; rollosBolsas?: string; metrajeMetros?: string; metrajeBolsas?: string; margen?: string | null; lineasSinCosto?: number };
export type Purchases = { clienteId: number; periodo?: { desde: string | null; hasta: string | null }; compras: Purchase[]; total: number };
export type Stats = { clienteId: number; periodo?: { desde: string | null; hasta: string | null }; totalCompras?: string; comprasCount?: number; metros?: string; kilos?: string; bolsas?: string; rollosMetros?: string; rollosKilos?: string; rollosBolsas?: string; metrajeMetros?: string; metrajeBolsas?: string; costo?: string | null; margen?: string | null; utilidadAcumulada?: string; lineasExcluidasSinCosto?: number; lineasSinCosto?: number };
export type ClientAnalytics = { clienteId: number; periodo: { desde: string | null; hasta: string | null }; productos: Array<{ id: number; sku: string; tela: string; color: string; unidad: string; cantidad: string; ventas: string; margen: string }>; telasColores: Array<{ tela: string; color: string; ventas: string; tickets: number }>; tendencia: Array<{ mes: string; tickets: number; ventas: string }>; mezclaPagos: Array<{ forma: string | null; importe: string; movimientos: number }>; actividad: { ultimaCompra: string | null; tickets: number; ticketPromedio: string | null; ticketMaximo: string | null } };
export type GlobalAnalytics = { periodo: { desde: string | null; hasta: string | null }; ventas: string; tickets: number; costo: string | null; margen: string | null; lineasSinCosto: number; metros: string; kilos: string; bolsas: string; rollosMetros: string; rollosKilos: string; rollosBolsas: string; metrajeMetros: string; metrajeBolsas: string; topVentas: Array<{ id: number; nombre: string; ventas: string; margen: string | null }>; topMargen: Array<{ id: number; nombre: string; ventas: string; margen: string | null }>; pareto: Array<{ id: number; nombre: string; ventas: string; acumulado: string }>; publicoVsRegistrado: Array<{ segmento: string; ventas: string; tickets: number }>; mensual: Array<{ mes: string; ventas: string; margen: string | null }> };
export type PortfolioItem = { id: number; nombre: string; saldoActual: string; porVencer: string; "1_30": string; "31_60": string; "61_90": string; mas90: string; antiguedad: string; diasVencido: number };

function query(period: Period) {
  const params = new URLSearchParams();
  if (period.desde) params.set("desde", period.desde);
  if (period.hasta) params.set("hasta", period.hasta);
  const result = params.toString();
  return result ? `?${result}` : "";
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: "include", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw Object.assign(new Error(body?.error ?? `Error HTTP ${response.status}`), { data: body, status: response.status });
  }
  return response.json() as Promise<T>;
}
export const getPurchases = (id: number, period: Period) => api<Purchases>(`/clientes/${id}/compras${query(period)}`);
export const getStats = (id: number, period: Period) => api<Stats>(`/clientes/${id}/estadisticas${query(period)}`);
export const getAccount = (id: number) => api<Account>(`/clientes/${id}/estado-cuenta`);
export const getClientAnalytics = (id: number, period: Period) => api<ClientAnalytics>(`/clientes/${id}/analitica${query(period)}`);
export const getGlobalAnalytics = (period: Period) => api<GlobalAnalytics>(`/clientes/analitica${query(period)}`);
export const getPortfolio = () => api<{ clientes: PortfolioItem[] }>("/clientes/cartera");
export const updateCreditTerms = (id: number, data: { limiteCredito: number; diasCredito: number }) => api<{ clienteId: number; limiteCredito: string; diasCredito: number }>(`/clientes/${id}/credito`, { method: "PATCH", body: JSON.stringify(data) });
export const createAdjustment = (id: number, data: { importe: number; motivo: string }) => api<{ id: number }>(`/clientes/${id}/ajustes`, { method: "POST", body: JSON.stringify(data) });
export const downloadClientFile = async (path: string, name: string) => {
  const response = await fetch(`/api${path}`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudo descargar el archivo.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};