import type { CurrentUser } from "@workspace/api-client-react";
import { hasPermission, Modules } from "./permisos";

export function getHomeRoute(user: CurrentUser): string {
  if (user.rol === "TERMINAL") return "/pos";
  if (user.rol === "CAJA") return "/cobros";
  if (user.rol === "ADMIN") return "/caja/tiempo-real";
  if (hasPermission(user, Modules.DASHBOARD, "ver")) {
    return "/inventario/vista-global";
  }
  if (hasPermission(user, Modules.POS, "ver")) return "/pos";
  if (hasPermission(user, Modules.COBROS_PAGOS, "ver")) return "/cobros";
  return "/";
}