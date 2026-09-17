/** Typed callers for documented client endpoints that are newer than generated API hooks. */
import type { ClienteCarteraItem, ClientesCartera, CurrentUser } from "@workspace/api-client-react";
export type Period = { desde?: string; hasta?: string };
export type AccountMovement = { movimientoId: number; ticketId?: number | null; tipo?: string; importe?: string; fecha?: string; fechaEfectiva?: string; notas?: string | null; saldoCorrido?: string; nombreUsuario?: string | null; formaPago?: string | null; desgloseIva?: { subtotal: string; iva: string } | null; referencia?: string | null; ticketFolio?: string | null };
export type Account = { clienteId: number; movimientos: AccountMovement[]; saldoActual: string };
export type Purchase = { id: number; folio?: string; fecha?: string; subtotal?: string; iva?: string; total?: string; metros?: string; kilos?: string; bolsas?: string; rollosMetros?: string; rollosKilos?: string; rollosBolsas?: string; metrajeMetros?: string; metrajeBolsas?: string; margen?: string | null; lineasSinCosto?: number };
export type Purchases = { clienteId: number; periodo?: { desde: string | null; hasta: string | null }; compras: Purchase[]; total: number };
export type Stats = { clienteId: number; periodo?: { desde: string | null; hasta: string | null }; totalCompras?: string; comprasCount?: number; metros?: string; kilos?: string; bolsas?: string; rollosMetros?: string; rollosKilos?: string; rollosBolsas?: string; metrajeMetros?: string; metrajeBolsas?: string; costo?: string | null; margen?: string | null; utilidadAcumulada?: string; lineasExcluidasSinCosto?: number; lineasSinCosto?: number };
export type ClientAnalytics = { clienteId: number; periodo: { desde: string | null; hasta: string | null }; productos: Array<{ id: number; sku: string; tela: string; color: string; unidad: string; cantidad: string; ventas: string; margen: string }>; telasColores: Array<{ tela: string; color: string; ventas: string; tickets: number }>; tendencia: Array<{ mes: string; tickets: number; ventas: string }>; mezclaPagos: Array<{ forma: string | null; importe: string; movimientos: number }>; actividad: { ultimaCompra: string | null; tickets: number; ticketPromedio: string | null; ticketMaximo: string | null } };
export type GlobalAnalytics = { periodo: { desde: string | null; hasta: string | null }; ventas: string; tickets: number; costo: string | null; margen: string | null; lineasSinCosto: number; metros: string; kilos: string; bolsas: string; rollosMetros: string; rollosKilos: string; rollosBolsas: string; metrajeMetros: string; metrajeBolsas: string; topVentas: Array<{ id: number; nombre: string; ventas: string; margen: string | null }>; topMargen: Array<{ id: number; nombre: string; ventas: string; margen: string | null }>; pareto: Array<{ id: number; nombre: string; ventas: string; acumulado: string }>; publicoVsRegistrado: Array<{ segmento: string; ventas: string; tickets: number }>; mensual: Array<{ mes: string; ventas: string; margen: string | null }> };
export type PortfolioItem = ClienteCarteraItem;
export type CarteraScope = { ubicacionId?: number; ubicacionIds?: number[] };
export type CarteraScopeQuery = { ubicacionId?: number; ubicacionIds?: string };
export type CarteraResponse = ClientesCartera;
export type CarteraAuthIdentity = Pick<CurrentUser, "id" | "rol" | "alcanceConsulta" | "ubicacion">;
export type CarteraEffectiveScope =
  | { kind: "UNRESTRICTED" }
  | { kind: "ASSIGNED"; assignedId: number }
  | { kind: "INVALID"; reason: string };

function query(period: Period) {
  const params = new URLSearchParams();
  if (period.desde) params.set("desde", period.desde);
  if (period.hasta) params.set("hasta", period.hasta);
  const result = params.toString();
  return result ? `?${result}` : "";
}
export function carteraScopeQuery(scope: CarteraScope): CarteraScopeQuery {
  const ids = scope.ubicacionIds?.slice().sort((a, b) => a - b);
  if (ids && ids.length > 1) {
    return { ubicacionIds: ids.join(",") };
  }
  if (scope.ubicacionId || ids?.length === 1) {
    return { ubicacionId: scope.ubicacionId ?? ids![0] };
  }
  return {};
}
export function carteraScopeKey(scope: CarteraScope): string {
  const params = carteraScopeQuery(scope);
  return params.ubicacionIds ? `sitios:${params.ubicacionIds}` : params.ubicacionId ? `sitio:${params.ubicacionId}` : "global";
}
export function carteraAuthPartition(user: CarteraAuthIdentity | null | undefined): string {
  if (!user) return "auth:loading";
  return [
    "auth",
    user.id,
    user.rol,
    user.alcanceConsulta,
    user.ubicacion?.id ?? "sin-sitio",
  ].join(":");
}
export function carteraEffectiveScope(user: CarteraAuthIdentity | null | undefined): CarteraEffectiveScope {
  if (!user) return { kind: "INVALID", reason: "No se pudo confirmar la identidad actual para mostrar la cartera." };
  if (user.rol === "ADMIN" || user.rol === "SUPERVISOR" || user.alcanceConsulta === "TODAS" && user.rol !== "CAJA") {
    return { kind: "UNRESTRICTED" };
  }
  const assignedId = user.ubicacion?.id;
  if (typeof assignedId === "number" && Number.isSafeInteger(assignedId) && assignedId > 0) return { kind: "ASSIGNED", assignedId };
  return { kind: "INVALID", reason: "Tu usuario no tiene un sitio asignado para consultar cartera." };
}
function sameIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
export function carteraScopeContractError(
  response: unknown,
  user: CarteraAuthIdentity | null | undefined,
  requestedScope: CarteraScope,
): string | null {
  if (!user) return "No se pudo confirmar la identidad actual para mostrar la cartera.";
  const effectiveScope = carteraEffectiveScope(user);
  if (effectiveScope.kind === "INVALID") return effectiveScope.reason;
  if (!response || typeof response !== "object") return "El servidor no devolvió una cartera válida.";
  const data = response as Partial<CarteraResponse>;
  const alcance = data.alcance;
  if (!alcance || typeof alcance !== "object") return "El servidor devolvió una cartera sin metadatos de alcance.";
  if (
    (alcance.tipo !== "GLOBAL" && alcance.tipo !== "SITIOS") ||
    !Array.isArray(alcance.ubicaciones) ||
    typeof alcance.generadoEn !== "string" ||
    !Number.isFinite(Date.parse(alcance.generadoEn)) ||
    typeof alcance.saldoAFavorDisponible !== "boolean"
  ) {
    return "El servidor devolvió metadatos de alcance inválidos; no se mostrarán cifras.";
  }
  const actualIds = alcance.ubicaciones.map((location) => location?.id).sort((a, b) => a - b);
  if (
    actualIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    alcance.ubicaciones.some((location) => typeof location?.nombre !== "string" || !location.nombre.trim())
  ) {
    return "El servidor devolvió ubicaciones inválidas; no se mostrarán cifras.";
  }
  const query = carteraScopeQuery(requestedScope);
  const requestedIds = query.ubicacionIds
    ? query.ubicacionIds.split(",").map(Number)
    : query.ubicacionId
      ? [query.ubicacionId]
      : [];
  const expectedIds = effectiveScope.kind === "UNRESTRICTED"
    ? requestedIds
    : [effectiveScope.assignedId];
  expectedIds.sort((a, b) => a - b);
  const expectedType = expectedIds.length > 0 ? "SITIOS" : "GLOBAL";
  if (alcance.tipo !== expectedType || !sameIds(actualIds, expectedIds)) {
    const returned = alcance.tipo === "GLOBAL" ? "Global" : `Sitios: ${actualIds.join(", ") || "ninguno"}`;
    const expected = expectedType === "GLOBAL" ? "Global" : `Sitios: ${expectedIds.join(", ")}`;
    return `El servidor devolvió un alcance incompatible (${returned}); se esperaba ${expected}. No se mostrarán cifras.`;
  }
  if (!Array.isArray(data.clientes) || !data.resumen || typeof data.resumen !== "object") {
    return "El servidor devolvió una cartera incompleta; no se mostrarán cifras.";
  }
  return null;
}
export function carteraScopePath(path: string, scope: CarteraScope): string {
  const params = new URLSearchParams();
  const query = carteraScopeQuery(scope);
  if (query.ubicacionId) params.set("ubicacionId", String(query.ubicacionId));
  if (query.ubicacionIds) params.set("ubicacionIds", query.ubicacionIds);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
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
export const getPortfolio = () => api<CarteraResponse>("/clientes/cartera");
export const getPortfolioForScope = (scope: CarteraScope) => api<CarteraResponse>(carteraScopePath("/clientes/cartera", scope));
export const updateCreditTerms = (id: number, data: { limiteCredito: number; diasCredito: number }) => api<{ clienteId: number; limiteCredito: string; diasCredito: number }>(`/clientes/${id}/credito`, { method: "PATCH", body: JSON.stringify(data) });
export const createAdjustment = (id: number, data: { importe: number; motivo: string }) => api<{ id: number }>(`/clientes/${id}/ajustes`, { method: "POST", body: JSON.stringify(data) });
export const downloadClientFile = async (path: string, name: string) => {
  const response = await fetch(`/api${path}`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudo descargar el archivo.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};