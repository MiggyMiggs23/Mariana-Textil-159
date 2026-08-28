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
  Ship,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  UserSquare2,
  Wallet,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { hasPermission, Modules, type Module } from "@/lib/permisos";

export type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  module: Module;
  anyModules?: Module[];
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
    ],
  },
  {
    title: "OPERACIÓN",
    items: [
      { name: "Ventas / POS", path: "/pos", icon: ShoppingCart, module: Modules.POS, isClickable: true },
      { name: "Entradas", path: "/entradas", icon: ArrowDownToLine, module: Modules.ENTRADAS, isClickable: true },
      { name: "Salidas", path: "/salidas", icon: ArrowUpFromLine, module: Modules.SALIDAS, isClickable: true },
      { name: "Viajes", path: "/viajes", icon: Truck, module: Modules.VIAJES, isClickable: true },
      { name: "Movimientos", path: "/movimientos", icon: Activity, module: Modules.MOVIMIENTOS, isClickable: true },
    ],
  },
  {
    title: "CAJA",
    items: [
      { name: "Cuentas", path: "/caja/cuentas-destino", icon: Wallet, module: Modules.COBROS_PAGOS, isClickable: true },
      { name: "Cobros", path: "/cobros", icon: Banknote, module: Modules.COBROS_PAGOS, isClickable: true },
      { name: "Cortes", path: "/caja/cortes", icon: FileBarChart, module: Modules.CORTES, isClickable: true },
      { name: "Alertas", path: "/alertas", icon: AlertTriangle, module: Modules.COBROS_PAGOS, isClickable: true },
    ],
  },
  {
    title: "DIRECTORIO",
    items: [
      { name: "Clientes", path: "/clientes", icon: UserSquare2, module: Modules.CLIENTES, isClickable: true },
      { name: "Proveedores", path: "/proveedores", icon: Truck, module: Modules.PROVEEDORES, isClickable: true },
    ],
  },
  {
    items: [
      { name: "Reportes", path: "/reportes", icon: BarChart3, module: Modules.REPORTES, isClickable: true },
    ],
  },
  {
    items: [
      { name: "Próximos Contenedores", path: "/contenedores", icon: Ship, module: Modules.CONTENEDORES, isClickable: true },
    ],
  },
  {
    title: "CONFIGURACIÓN",
    hiddenForRoles: ["CONTADOR"],
    items: [
      { name: "Sitios", path: "/ubicaciones", icon: MapPin, module: Modules.UBICACIONES, isClickable: true },
      { name: "Camionetas", path: "/configuracion/camionetas", icon: Truck, module: Modules.CAMIONETAS, isClickable: true },
      { name: "Choferes", path: "/configuracion/choferes", icon: UserSquare2, module: Modules.CHOFERES, isClickable: true },
      { name: "Usuarios", path: "/usuarios", icon: Users, module: Modules.USUARIOS, isClickable: true },
      { name: "Permisos", path: "/permisos", icon: Shield, module: Modules.PERMISOS, isClickable: true },
      { name: "Conciliación de Kardex", path: "/administracion/conciliacion", icon: Settings, module: Modules.CONCILIACION, isClickable: true },
      { name: "Bitácora", path: "/auditoria", icon: Activity, module: Modules.AUDITORIA, isClickable: true },
    ],
  },
];

export function getVisibleNavGroups(user: CurrentUser): NavGroup[] {
  return NAV_GROUPS.flatMap((group) => {
    if (group.hiddenForRoles?.includes(user.rol)) return [];

    const items = group.items.filter((item) =>
      item.anyModules
        ? item.anyModules.some(
            (module) =>
              hasPermission(user, module, "ver") ||
              hasPermission(user, module, "crear"),
          )
        : hasPermission(user, item.module, "ver"),
    );

    return items.length > 0 ? [{ ...group, items }] : [];
  });
}