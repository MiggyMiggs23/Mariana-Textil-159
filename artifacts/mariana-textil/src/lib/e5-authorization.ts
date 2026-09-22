import type { CurrentUser, E5Capacidades, E5Contexto, E5Cobro } from "@workspace/api-client-react";
import { hasPermission, Modules } from "@/lib/permisos";

export const E5_READ_MODULES = [Modules.CAJA_ABONOS, Modules.CLIENTES_FINANZAS];
export function e5AuthorizationContext(user: CurrentUser): string {
  return encodeURIComponent(JSON.stringify({
    role: user.rol, site: user.ubicacion?.id ?? null, alcance: user.alcanceConsulta,
    permisos: (user.permisos ?? []).filter(p => E5_READ_MODULES.includes(p.modulo as typeof E5_READ_MODULES[number]))
      .map(p => [p.modulo, p.puedeVer, p.puedeCrear, p.puedeEditar, p.puedeAutorizar])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  }));
}
export function e5CanReceive(user: CurrentUser, entrada: "CAJA" | "CLIENTE") {
  return ["ADMIN", "SUPERVISOR", "CAJA", "TERMINAL"].includes(user.rol)
    && hasPermission(user, entrada === "CAJA" ? Modules.CAJA_ABONOS : Modules.CLIENTES_FINANZAS, "crear");
}
export function e5CanRead(user: CurrentUser, caps?: E5Capacidades) {
  if (["SISTEMAS", "BODEGA"].includes(user.rol)) return false;
  if (user.rol === "CONTADOR") return !!caps?.preparacionADisponible && caps.puedePreparar;
  return E5_READ_MODULES.some(module => hasPermission(user, module, "ver"));
}
export function e5CanPrepare(user: CurrentUser, caps: E5Capacidades) {
  return caps.puedePreparar && (user.rol === "ADMIN" || (user.rol === "CONTADOR" && caps.preparacionADisponible));
}
export function assertE5Context(context: E5Contexto, client: number, site: number) {
  if (context.clienteId !== client || context.ubicacionId !== site) throw new Error("Contexto ajeno al cliente/sitio solicitado. Operación detenida.");
}
export function assertE5Detail(cobro: E5Cobro, id: string, site: number, client?: number) {
  if (cobro.id !== id || cobro.ubicacionId !== site || (client !== undefined && cobro.clienteId !== client))
    throw new Error("Recepción ajena al ID/cliente/sitio solicitado. No se mostrará ni usará esa respuesta.");
}