import type * as api from "@workspace/api-client-react";
export type { ErrorType, BodyType } from "../../../../lib/api-client-react/src/custom-fetch";
export { setBaseUrl, setAuthTokenGetter } from "../../../../lib/api-client-react/src/custom-fetch";
export type { AuthTokenGetter, CustomFetchOptions } from "../../../../lib/api-client-react/src/custom-fetch";
import type { AlertasEtiquetas } from "../lib/etiquetas-api";

// Test transport only. Generated hooks, QueryClient, components and authorization
// remain real. No socket, fetch, productive function replacement or DB fallback.
export let E11_ENABLED = true;
export let E11_UI_ENABLED = true;
export let E11_PROFILE_ASSIGNMENT_ENABLED = true;
export let E11_RECONCILIATION_ENABLED = true;
export let E11_E5_PREPARATION_ENABLED = true;
export let E5_ENABLED = true;
export function gates(on: boolean) {
  E11_ENABLED = E11_UI_ENABLED = E11_PROFILE_ASSIGNMENT_ENABLED =
    E11_RECONCILIATION_ENABLED = E11_E5_PREPARATION_ENABLED = on;
}
export const ID = "11111111-1111-4111-8111-111111111111";
export const OTHER = "22222222-2222-4222-8222-222222222222";
export const instant = "2026-01-15T18:00:00.000Z";
export function user(role: api.CurrentUser["rol"] = "CONTADOR"): api.CurrentUser {
  return { id: 7, nombre: "Actor de prueba E11", usuario: "e11-test", rol: role,
    ubicacion: null, alcanceConsulta: "TODAS", permisos: [] };
}
export function identity(profile: "A" | "F" | null = "F"): api.E11Identidad {
  return { usuarioId: 7, rolBase: profile ? "CONTADOR" : "ADMIN", perfil: profile,
    perfilVersion: 3, permisosVersion: "permissions-v3",
    capacidades: profile === "F" ? ["FISCAL_LEER", "FISCAL_CONCILIAR"] : profile === "A"
      ? ["FINANZAS_LIMITADAS_LEER", "E5_PREPARAR"] : ["PERFILES_ADMINISTRAR"] };
}
export const available: api.E11Disponibilidad = { enabled: true, perfiles: true, conciliacion: true, preparacionE5: true };
export const customer: api.E11FinanzasCliente = { clienteId: 21, nombre: "Cliente autorizado E11", contacto: "cliente@example.invalid", limiteCredito: "900.00", saldo: "120.00" };
export const sale: api.E11FiscalVenta = { facturaId: 41, ventaId: 41, folioFactura: "FACTURADO-41", cliente: { clienteId: 21, nombre: customer.nombre },
  fechaFacturacion: instant, totalFacturado: "120.00", moneda: "MXN", estado: "VIGENTE" };
export const note: api.E11FinanzasNota = { notaId: 51, movimientoVentaId: 61, folio: "NO-FACTURADA-51", clienteId: 21, fecha: instant, facturada: false, total: "120.00", saldo: "120.00" };
export const period: api.E11Periodo = { tipo: "SEMANA", inicio: "2026-01-05", finExclusivo: "2026-01-12", zona: "America/Mexico_City", obligatorio: true, estado: "PENDIENTE", ultimaConciliacionId: null };
export const snapshot: api.E11Conciliacion = { id: ID, uuid: OTHER, periodo: period, revision: 1, anteriorId: null, fuenteRevision: "source-v1", vigente: true,
  congeladoEn: instant, actorId: 7, totalFacturado: "120.00", cantidadVentas: 1, evidenciaHash: "a".repeat(64), decisiones: [] };
export const preparation: api.E11Preparacion = { cobroId: ID, clienteId: 21, revision: 1, fuenteRevision: "source-v1", retenido: "120.00", notas: [note], propuestaId: null };
export const event: api.E11PerfilEvento = { id: ID, uuid: OTHER, usuarioId: 9, actorId: 7, anterior: "F", posterior: "A", revision: 4, motivo: "Asignación explícita", creadoEn: instant };
export const fiscalClients: api.E11FiscalClientes = { items: [sale.cliente], nextCursor: null, fuenteRevision: "source-v1" };
export const sales: api.E11FiscalVentas = { items: [sale], nextCursor: null, fuenteRevision: "source-v1", totalFacturado: "120.00" };
export const financialClients: api.E11FinanzasClientes = { items: [customer], nextCursor: null, fuenteRevision: "source-v1" };
export const notes: api.E11FinanzasNotas = { items: [note], nextCursor: null, fuenteRevision: "source-v1" };
export const account: api.E11EstadoCuenta = { cliente: customer, items: [{ id: 71, tipo: "ABONO", fechaEfectiva: "2026-01-15", importe: "-10.00", notaId: 51 }], nextCursor: null, fuenteRevision: "source-v1" };
export const history: api.E11PerfilHistorial = { items: [event], nextCursor: null };
export const periods: api.E11Periodos = { items: [period], nextCursor: null };
export const preparations: api.E11Preparaciones = { items: [preparation], nextCursor: null };
// Final generated recovery contract. Original owner differs from current ADMIN.
// These are DTOs, not a guessed local-storage format or replacement recovery UI.
export const recoveryActorId = 9;
export const recoveryIdentity: api.E11Identidad = {
  ...identity(null), permisosVersion: "b".repeat(64), capacidades: ["FISCAL_LEER"],
};
export const recoveryAvailability: api.E11Disponibilidad = {
  enabled: true, perfiles: false, conciliacion: false, preparacionE5: false,
};
export const recoveryPending: api.E11OperacionRecuperacion = {
  actorId: recoveryActorId, accion: "PREPARACION", uuidOriginal: ID, estado: "PENDIENTE",
  revision: "c".repeat(64), resolucionId: null, resueltoEn: null,
};
export const recoveryCommitted: api.E11OperacionRecuperacion = {
  ...recoveryPending, estado: "CONFIRMADA",
};
export const recoveryConfirmed: api.E11OperacionRecuperacion = {
  ...recoveryCommitted, revision: "d".repeat(64), resolucionId: OTHER, resueltoEn: instant,
};
export const recoveryTombstone: api.E11OperacionRecuperacion = {
  ...recoveryConfirmed, estado: "CERRADA_SIN_EFECTO",
};
export const resolution: api.ResolveE11OperacionBody = {
  uuid: OTHER, revisionEsperada: recoveryPending.revision,
  identidadVersion: recoveryIdentity.permisosVersion, motivo: "Resolver la intención original con evidencia autoritativa",
};
export const recoveryPath = `/api/e11/operaciones/${recoveryActorId}/PREPARACION/${ID}`;
export function recoveryRoutes() {
  E11_PROFILE_ASSIGNMENT_ENABLED = E11_RECONCILIATION_ENABLED = E11_E5_PREPARATION_ENABLED = false;
  respond("/api/auth/me", user("ADMIN"));
  respond("/api/e11/identidad", recoveryIdentity);
  respond("/api/e11/disponibilidad", recoveryAvailability);
  respond(recoveryPath, recoveryPending);
  // Resolution POST is deliberately NOT preconfigured: every scenario must
  // explicitly choose terminal, uncertain, rejected, or held transport behavior.
}
export const storedNotice: api.NotificacionSistema = {
  id: 81, tipo: "E11_NO_CUADRA", titulo: "Discrepancia documental", mensaje: "Revisión ADMIN del snapshot",
  entidad: "e11_conciliaciones", entidadId: ID, leidaAt: null, createdAt: instant,
};
export const notificationPanel: api.NotificacionesPanel = {
  notificaciones: [], sistema: [storedNotice], porVencer: [], vencidas: [], clientesConMultiplesVencidas: [],
};
export const notificationFeed: api.NotificationFeed = { events: [], generatedAt: instant, sessionKey: "offline-e11-session" };
export const users: api.User[] = [
  { id: 9, nombre: "Contador destinatario", usuario: "contador-e11", rol: "CONTADOR", ubicacion: null, alcanceConsulta: "TODAS", activo: true, ultimoAcceso: null },
  { id: 11, nombre: "Caja sin perfil", usuario: "caja-e11", rol: "CAJA", ubicacion: null, alcanceConsulta: "PROPIA", activo: true, ultimoAcceso: null },
];
// Actual App/Layout sister readers; deliberately finite typed allowlist.
// No mutation, endpoint wildcard, default success, synthetic productive module or network.
export function appSiblings() {
  respond("/api/users", users);
  respond("/api/e11/usuarios/11/perfil", { ...identity(null), usuarioId: 11, rolBase: "CAJA", capacidades: [] } satisfies api.E11Identidad);
  respond("/api/e11/usuarios/11/perfil/historial", { items: [], nextCursor: null } satisfies api.E11PerfilHistorial);
  respond("/api/locations", [] satisfies api.Location[]);
  respond("/api/inventario/ubicaciones", [] satisfies Awaited<ReturnType<typeof api.getUbicacionesInventario>>);
  respond("/api/inventario/ajustes/pendientes", [] satisfies api.MovimientoRow[]);
  respond("/api/inventario/entradas/pendientes-costo/count", { count: 0 } satisfies api.CountEntradasPendientesCosto200);
  respond("/api/etiquetas/alertas/count", { count: 0 } satisfies AlertasEtiquetas);
  respond("/api/notificaciones", notificationPanel);
  respond("/api/notificaciones/feed", notificationFeed);
  respond("/api/productos", [] satisfies Awaited<ReturnType<typeof api.listProductos>>);
  respond("/api/inventario/conciliacion", [] satisfies api.ConciliacionRow[]);
}
type Request = { method: string; path: string; params: URLSearchParams; body: unknown };
type Handler = (request: Request) => unknown | Promise<unknown>;
export const requests: Request[] = [];
export const routes = new Map<string, Handler>();
export function respond(path: string, value: unknown, method = "GET") { routes.set(`${method} ${path}`, () => structuredClone(value)); }
export function error(code: api.E11OrdinaryError["code"], status = 409) {
  return Object.assign(new Error(code), { status, data: { code, message: `Conflicto ${code}`, requestId: ID } satisfies api.E11OrdinaryError });
}
export function outcomeError(code: api.E11OutcomeError["code"], uuid: string) {
  const data: api.E11OutcomeError = { code, uuid, message: `Resultado de operación ${code}`, requestId: ID };
  return Object.assign(new Error(data.message), { status: code === "RESULTADO_INCIERTO" ? 503 : 409, data });
}
export async function customFetch<T>(input: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(input, "https://offline.invalid");
  const request = { method: options.method ?? "GET", path: url.pathname, params: url.searchParams,
    body: options.body ? JSON.parse(String(options.body)) : undefined };
  requests.push(request);
  const handler = routes.get(`${request.method} ${request.path}`);
  if (!handler) {
    // Query/mutation error boundaries may consume the thrown error. Preserve an
    // explicit infrastructure signal so a missing fixture can NEVER count RED.
    const message = `E11_UNCONFIGURED_TRANSPORT ${request.method} ${request.path}`;
    console.error(message);
    throw Error(message);
  }
  return await handler(request) as T;
}
export function reset(profile: "A" | "F" | null = "F") {
  gates(true); E5_ENABLED = true; requests.length = 0; routes.clear();
  respond("/api/auth/me", user(profile ? "CONTADOR" : "ADMIN"));
  respond("/api/e11/disponibilidad", available);
  respond("/api/e11/identidad", identity(profile));
  respond("/api/e11/usuarios/9/perfil", { ...identity("F"), usuarioId: 9 });
  respond("/api/e11/usuarios/9/perfil/historial", history);
  respond("/api/e11/fiscal/clientes", fiscalClients);
  respond("/api/e11/fiscal/ventas", sales);
  respond("/api/e11/fiscal/facturas/41", sale);
  respond("/api/e11/finanzas/clientes", financialClients);
  respond("/api/e11/finanzas/clientes/21/notas", notes);
  respond("/api/e11/finanzas/clientes/21/estado-cuenta", account);
  respond("/api/e11/conciliaciones", periods);
  respond(`/api/e11/conciliaciones/${ID}`, snapshot);
  respond(`/api/e11/conciliaciones/${ID}/ventas`, sales);
  respond("/api/e11/a/preparaciones", preparations);
  respond(`/api/e11/a/preparaciones/${ID}`, preparation);
}