import type { CurrentUser } from "@workspace/api-client-react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  BarChart3,
  Boxes,
  FileBarChart,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Shield,
  ShieldAlert,
  Ship,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  UserSquare2,
  Wallet,
  ClipboardCheck,
  type LucideIcon,
  Scale,
} from "lucide-react";
import { e7On } from "@/lib/e7-feature-flags";
import { hasPermission, Modules, type Module } from "@/lib/permisos";

export type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  module: Module;
  anyModules?: Module[];
  allowedRoles?: CurrentUser["rol"][];
  hiddenForRoles?: CurrentUser["rol"][];
  isClickable: boolean;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
  hiddenForRoles?: CurrentUser["rol"][];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        name: "Tiempo Real",
        path: "/caja/tiempo-real",
        icon: Activity,
        module: Modules.RESUMEN_CAJA,
        isClickable: true,
      },
    ],
  },
  {
    title: "INVENTARIO",
    items: [
      { name: "Productos", path: "/productos", icon: Package, module: Modules.PRODUCTOS, isClickable: true },
      { name: "Inventario", path: "/inventario", icon: Boxes, module: Modules.INVENTARIO, isClickable: true },
      { name: "Vista Global", path: "/inventario/vista-global", icon: LayoutDashboard, module: Modules.DASHBOARD, isClickable: true },
      { name: "Ajustes", path: "/inventario/ajustes", icon: FileBarChart, module: Modules.AJUSTES, isClickable: true },
      { name: "Auditorías", path: "/inventario/auditorias", icon: ClipboardCheck, module: Modules.AUDITORIA_INVENTARIO, isClickable: true },
      { name: "Etiquetas", path: "/etiquetas", icon: Tags, module: Modules.ETIQUETAS, isClickable: true },
      { name: "Precios", path: "/precios", icon: Banknote, module: Modules.PRECIOS, isClickable: true },
      { name: "Stock mínimo", path: "/inventario/stock-minimos", icon: ShieldAlert, module: Modules.INVENTARIO, isClickable: true },
    ],
  },
  {
    title: "OPERACIÓN",
    items: [
      { name: "Movimientos", path: "/movimientos", icon: Activity, module: Modules.MOVIMIENTOS, isClickable: true },
      { name: "POS", path: "/pos", icon: ShoppingCart, module: Modules.POS, isClickable: true },
      { name: "Entradas", path: "/entradas", icon: ArrowDownToLine, module: Modules.ENTRADAS, isClickable: true },
      { name: "Salidas", path: "/salidas", icon: ArrowUpFromLine, module: Modules.SALIDAS, isClickable: true },
      { name: "Recibos de abonos", path: "/recibos-abonos", icon: FileBarChart, module: Modules.RECIBOS_ABONOS, isClickable: true },
      { name: "Viajes", path: "/viajes", icon: Truck, module: Modules.VIAJES, isClickable: true },
    ],
  },
  {
    title: "CAJA",
    items: [
      { name: "Cuentas", path: "/caja/cuentas-destino", icon: Wallet, module: Modules.COBROS_PAGOS, allowedRoles: ["ADMIN", "CONTADOR", "SISTEMAS"], isClickable: true },
      { name: "Cobros", path: "/cobros", icon: Banknote, module: Modules.COBROS_PAGOS, isClickable: true },
      { name: "Cortes", path: "/caja/cortes", icon: FileBarChart, module: Modules.CORTES, isClickable: true },
      ...(e7On() ? [{ name: "Atribución E7", path: "/caja/atribucion-e7", icon: Scale, module: Modules.COBROS_PAGOS, allowedRoles: ["ADMIN", "SISTEMAS"] as NavItem["allowedRoles"], isClickable: true }] : []),
      { name: "Alertas", path: "/alertas", icon: AlertTriangle, module: Modules.COBROS_PAGOS, allowedRoles: ["ADMIN"], isClickable: true },
    ],
  },
  {
    title: "FONDO MARIANA",
    hiddenForRoles: import.meta.env?.VITE_FONDO_E10_ENABLED === "true" ? undefined : ["ADMIN", "TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "SISTEMAS", "CONTADOR"],
    items: [
      { name: "Resumen de Fondo", path: "/fondo", icon: Wallet, module: Modules.COBROS_PAGOS, allowedRoles: ["ADMIN"], isClickable: true },
    ],
  },
  {
    title: "DIRECTORIO",
    items: [
      { name: "Clientes", path: "/clientes", icon: UserSquare2, module: Modules.CLIENTES, isClickable: true },
      { name: "Proveedores", path: "/proveedores", icon: Truck, module: Modules.PROVEEDORES, isClickable: true },
      { name: "Reportes", path: "/reportes", icon: BarChart3, module: Modules.REPORTES, isClickable: true },
      { name: "Próximos Contenedores", path: "/contenedores", icon: Ship, module: Modules.CONTENEDORES, isClickable: true },
    ],
  },
  {
    title: "CONFIGURACIÓN",
    items: [
      // Keep the former group restriction only on its original entries.
      { name: "Sitios", path: "/ubicaciones", icon: MapPin, module: Modules.UBICACIONES, hiddenForRoles: ["CONTADOR"], isClickable: true },
      { name: "Usuarios", path: "/usuarios", icon: Users, module: Modules.USUARIOS, hiddenForRoles: ["CONTADOR"], isClickable: true },
      { name: "Permisos", path: "/permisos", icon: Shield, module: Modules.PERMISOS, hiddenForRoles: ["CONTADOR"], isClickable: true },
      { name: "Camionetas", path: "/directorio/camionetas", icon: Truck, module: Modules.CAMIONETAS, isClickable: true },
      { name: "Choferes", path: "/directorio/choferes", icon: UserSquare2, module: Modules.CHOFERES, isClickable: true },
      { name: "Equipos", path: "/equipos", icon: LayoutDashboard, module: Modules.EQUIPOS, isClickable: true },
      { name: "Conciliación de Kardex", path: "/administracion/conciliacion", icon: Settings, module: Modules.CONCILIACION, hiddenForRoles: ["CONTADOR"], isClickable: true },
      { name: "Bitácora", path: "/auditoria", icon: Activity, module: Modules.AUDITORIA, hiddenForRoles: ["CONTADOR"], isClickable: true },
    ],
  },
];

type DisplayNavItem = Pick<NavItem, "name" | "path" | "icon" | "isClickable"> & { testId?: string };
type DisplayNavGroup = Omit<NavGroup, "items"> & { items: DisplayNavItem[] };

/** Compose already-authorized links only; E11 retains its own independent gates. */
export function withConfigurationLinks(
  groups: NavGroup[],
  authorizedLinks: { name: string; path: string }[],
): DisplayNavGroup[] {
  if (!authorizedLinks.length) return groups;
  const additional = authorizedLinks.map(item => ({
    ...item,
    icon: Settings,
    isClickable: true,
    testId: `nav-item-${item.path.replace(/[^a-z0-9]+/g, "-")}`,
  }));
  const configuration = groups.find(group => group.title === "CONFIGURACIÓN");
  if (!configuration) return [...groups, { title: "CONFIGURACIÓN", items: additional }];
  return groups.map(group => {
    if (group !== configuration) return group;
    const auditIndex = group.items.findIndex(item => item.path === "/auditoria");
    const index = auditIndex < 0 ? group.items.length : auditIndex;
    return { ...group, items: [...group.items.slice(0, index), ...additional, ...group.items.slice(index)] };
  });
}

export function getVisibleNavGroups(user: CurrentUser): NavGroup[] {
  return NAV_GROUPS.flatMap((group) => {
    if (group.hiddenForRoles?.includes(user.rol)) return [];

    const items = group.items.filter((item) =>
      !item.hiddenForRoles?.includes(user.rol) && (item.allowedRoles
        ? item.allowedRoles.includes(user.rol)
        : (item.anyModules
        ? item.anyModules.some(
            (module) =>
              hasPermission(user, module, "ver") ||
              hasPermission(user, module, "crear"),
          )
        : hasPermission(user, item.module, "ver"))),
    );

    return items.length > 0 ? [{ ...group, items }] : [];
  });
}