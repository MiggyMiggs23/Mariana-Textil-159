import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser,
  useLogout,
  Role,
  getGetCurrentUserQueryKey,
  useGetUbicacionesInventario,
  getGetUbicacionesInventarioQueryKey,
  useListAjustesPendientes,
  getListAjustesPendientesQueryKey,
  useObtenerSesionCajaActual,
  getObtenerSesionCajaActualQueryKey,
  useCountEntradasPendientesCosto,
  getCountEntradasPendientesCostoQueryKey
} from "@workspace/api-client-react";
import { hasPermission, Modules, Module } from "@/lib/permisos";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  MapPin, 
  Users, 
  Boxes,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Package,
  UserSquare2,
  Truck,
  Ship,
  Banknote,
  FileBarChart,
  Shield,
  AlertCircle,
  Wallet,
  BarChart3,
  Bell,
  Tags
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { useLocationScope } from "@/lib/location-scope";
import { useCountNotificacionesNoLeidas, getCountNotificacionesNoLeidasQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { etiquetasApi } from "@/lib/etiquetas-api";

type NavItem = {
  name: string;
  path: string;
  icon: any;
  module: Module;
  isClickable: boolean;
  adminOnly?: boolean;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { name: "Dashboard", path: "/", icon: LayoutDashboard, module: Modules.DASHBOARD, isClickable: true },
    ]
  },
  {
    title: "INVENTARIO",
    items: [
      { name: "Productos", path: "/productos", icon: Package, module: Modules.PRODUCTOS, isClickable: true },
      { name: "Inventario", path: "/inventario", icon: Boxes, module: Modules.INVENTARIO, isClickable: true },
      { name: "Ajustes", path: "/inventario/ajustes", icon: FileBarChart, module: Modules.AJUSTES, isClickable: true },
    ]
  },
  {
    title: "OPERACIÓN",
    items: [
      { name: "Ventas / POS", path: "/pos", icon: ShoppingCart, module: Modules.POS, isClickable: true },
      { name: "Entradas", path: "/entradas", icon: ArrowDownToLine, module: Modules.ENTRADAS, isClickable: true },
      { name: "Salidas", path: "/salidas", icon: ArrowUpFromLine, module: Modules.SALIDAS, isClickable: true },
      { name: "Movimientos", path: "/movimientos", icon: Activity, module: Modules.MOVIMIENTOS, isClickable: true },
      { name: "Etiquetas", path: "/etiquetas", icon: Tags, module: Modules.ETIQUETAS, isClickable: true },
    ]
  },
  {
    title: "ADMINISTRACIÓN",
    items: [
      { name: "Cobros (POS)", path: "/cobros", icon: Banknote, module: Modules.COBROS_PAGOS, isClickable: true },
      { name: "Tiempo Real", path: "/caja/tiempo-real", icon: Activity, module: Modules.COBROS_PAGOS, isClickable: true, adminOnly: true },
      { name: "Cortes", path: "/caja/cortes", icon: FileBarChart, module: Modules.COBROS_PAGOS, isClickable: true, adminOnly: true },
      { name: "Diferencias", path: "/caja/diferencias", icon: AlertCircle, module: Modules.COBROS_PAGOS, isClickable: true, adminOnly: true },
      { name: "Cuentas Destino", path: "/caja/cuentas-destino", icon: Wallet, module: Modules.COBROS_PAGOS, isClickable: true, adminOnly: true },
      { name: "Comparativo", path: "/caja/comparativo", icon: BarChart3, module: Modules.COBROS_PAGOS, isClickable: true, adminOnly: true },
      { name: "Notificaciones", path: "/notificaciones", icon: Bell, module: Modules.COBROS_PAGOS, isClickable: true, adminOnly: true },
      { name: "Clientes", path: "/clientes", icon: UserSquare2, module: Modules.CLIENTES, isClickable: true },
      { name: "Proveedores", path: "/proveedores", icon: Truck, module: Modules.PROVEEDORES, isClickable: true },
      { name: "Próximos Contenedores", path: "/contenedores", icon: Ship, module: Modules.CONTENEDORES, isClickable: false },
      { name: "Conciliación", path: "/administracion/conciliacion", icon: Activity, module: Modules.CONCILIACION, isClickable: true },
    ]
  },
  {
    items: [
      { name: "Reportes", path: "/reportes", icon: FileBarChart, module: Modules.REPORTES, isClickable: false },
    ]
  },
  {
    title: "CONFIGURACIÓN",
    items: [
      { name: "Sitios", path: "/ubicaciones", icon: MapPin, module: Modules.UBICACIONES, isClickable: true },
      { name: "Usuarios", path: "/usuarios", icon: Users, module: Modules.USUARIOS, isClickable: true },
      { name: "Permisos", path: "/permisos", icon: Shield, module: Modules.PERMISOS, isClickable: true },
    ]
  }
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, error, isLoading } = useGetCurrentUser({
    query: {
      retry: false,
      queryKey: getGetCurrentUserQueryKey()
    }
  });
  
  const { data: ajustesPendientes } = useListAjustesPendientes({
    query: {
      enabled: hasPermission(user, Modules.AJUSTES, "autorizar"),
      queryKey: getListAjustesPendientesQueryKey()
    }
  });

  const { data: countPendientesData } = useCountEntradasPendientesCosto({
    query: {
      enabled: user?.rol === Role.ADMIN,
      queryKey: getCountEntradasPendientesCostoQueryKey()
    }
  });
  const { data: notificationsCount } = useCountNotificacionesNoLeidas({
    query: {
      enabled: user?.rol === Role.ADMIN,
      queryKey: getCountNotificacionesNoLeidasQueryKey(),
      refetchInterval: 30_000,
    },
  });
  const { data: etiquetasAlerts } = useQuery({
    queryKey: ["etiquetas", "alertas"],
    queryFn: etiquetasApi.alertas,
    enabled: user?.rol === Role.ADMIN,
    retry: false,
    refetchInterval: 60_000,
  });

  const { selectedLocationId, setSelectedLocationId } = useLocationScope();
  const { data: locations } = useGetUbicacionesInventario({
    query: {
      enabled: user?.alcanceConsulta === "TODAS",
      queryKey: getGetUbicacionesInventarioQueryKey()
    }
  });

  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const isCaja = user?.rol === Role.CAJA;
  const isTerminal = user?.rol === Role.TERMINAL;
  const assignedLocationId = user?.ubicacion?.id;
  const { data: sesionCajaData } = useObtenerSesionCajaActual(
    { ubicacionId: assignedLocationId ?? 0 },
    {
      query: {
        enabled: isCaja && !!assignedLocationId,
        queryKey: getObtenerSesionCajaActualQueryKey({ ubicacionId: assignedLocationId ?? 0 }),
      },
    },
  );

  useEffect(() => {
    if (error) {
      setLocation("/login");
    }
  }, [error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userBlockLocation =
    user.rol === Role.ADMIN
      ? "Global"
      : user.ubicacion?.nombre ?? "Sin sitio asignado";

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const renderLocationControl = (compact = false) => {
    const isTodas = user.alcanceConsulta === "TODAS" && !isCaja;

    return isTodas ? (
      <div className={cn("space-y-1", compact ? "w-full" : "w-64")}>
        {!compact && (
          <span className="text-xs font-medium text-muted-foreground">
            Sitio
          </span>
        )}
        <Select
          value={
            selectedLocationId === null
              ? "global"
              : String(selectedLocationId)
          }
          onValueChange={(value) =>
            setSelectedLocationId(
              value === "global" ? null : Number(value),
            )
          }
        >
          <SelectTrigger
            className={cn(
              "bg-background text-foreground",
              compact ? "h-9 border-white/20 bg-white/10 text-white" : "h-9",
            )}
          >
            <SelectValue placeholder="Vista Global" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Vista Global</SelectItem>
            {locations?.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {item.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : (
      <div className={cn("space-y-1", compact ? "w-full" : "w-64")}>
        {!compact && (
          <span className="text-xs font-medium text-muted-foreground">
            Sitio (Sólo lectura)
          </span>
        )}
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
            compact
              ? "border-white/20 bg-white/10 text-white h-9"
              : "border-border bg-muted/40 text-foreground h-9",
          )}
        >
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {user.ubicacion?.nombre ?? "Sin sitio asignado"}
          </span>
        </div>
      </div>
    );
  };

  const navGroups = isCaja
    ? [{
        items: [
          { name: "Caja", path: "/cobros", icon: Banknote, module: Modules.COBROS_PAGOS, isClickable: true },
          { name: "Inventario", path: "/inventario", icon: Boxes, module: Modules.INVENTARIO, isClickable: true },
          { name: "Salidas recibidas", path: "/salidas", icon: ArrowDownToLine, module: Modules.SALIDAS, isClickable: true },
        ],
      }]
    : NAV_GROUPS;

  const renderNavContent = (onItemClick?: () => void) => (
    <div className="py-4 flex flex-col gap-6">
      {navGroups.map((group) => {
        const allowedItems = group.items.filter(item =>
          hasPermission(user, item.module, 'ver') &&
          (!item.adminOnly || user.rol === Role.ADMIN)
        );
        
        if (allowedItems.length === 0) return null;

        return (
          <div key={group.title ?? group.items[0].path} className="px-3 space-y-1">
            {group.title && (
              <h4 className="px-3 text-xs font-semibold text-sidebar-foreground/50 tracking-wider mb-2">
                {group.title}
              </h4>
            )}
            {allowedItems.map((item) => {
              const isActive =
                location === item.path ||
                (item.path !== "/" && location.startsWith(`${item.path}/`));
              if (!item.isClickable) {
                return (
                  <div key={item.path} className="flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground/50 cursor-not-allowed group relative">
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="ml-auto text-[9px] uppercase font-bold bg-sidebar-accent/50 text-sidebar-foreground/70 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      Próx
                    </span>
                  </div>
                );
              }

              return (
                <Link 
                  key={item.path}
                  href={item.path}
                  onClick={onItemClick}
                  data-testid={`nav-item-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" 
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 font-medium"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70")} />
                  <span className="text-sm">{item.name}</span>
                  {item.path === "/etiquetas" && etiquetasAlerts?.count ? (
                    <span data-testid="badge-etiquetas-alertas" title="Rollos con 3 o más reimpresiones" className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                      {etiquetasAlerts.count}
                    </span>
                  ) : item.path === "/entradas" && countPendientesData?.count ? (
                    <span data-testid={`badge-entradas-pendientes`} className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1 bg-destructive text-white text-[10px] font-bold rounded-full">
                      {countPendientesData.count}
                    </span>
                  ) : item.path === "/inventario/ajustes" && ajustesPendientes && ajustesPendientes.length > 0 ? (
                    <span data-testid={`badge-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="ml-auto flex items-center justify-center w-5 h-5 bg-destructive text-white text-[10px] font-bold rounded-full">
                      {ajustesPendientes.length}
                    </span>
                  ) : item.path === "/notificaciones" && user.rol === Role.ADMIN && notificationsCount?.count ? (
                    <span data-testid="badge-notificaciones" className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1 bg-destructive text-white text-[10px] font-bold rounded-full">
                      {notificationsCount.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex bg-background">
      {/* Sidebar for Desktop */}
      {!isTerminal && <aside className="no-print hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-[100dvh] sticky top-0">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border flex-shrink-0">
          <BrandLogo variant="mark" className="h-10 w-10 drop-shadow-sm" />
          <span className="font-bold text-lg tracking-tight text-white">Mariana Textil</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          {renderNavContent()}
        </nav>

      </aside>}

      {/* Mobile Header & Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print md:hidden sticky top-0 z-40 border-b border-sidebar-border bg-sidebar text-white shadow-sm">
          <div className="h-16 flex items-center justify-between px-4">
            <div className="flex items-center gap-2.5">
              <BrandLogo variant="mark" className="h-9 w-9" />
              <span className="font-bold text-lg">Mariana Textil</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent" onClick={() => setLogoutDialogOpen(true)}>
                <LogOut className="w-5 h-5" />
                <span className="sr-only">Cerrar sesión</span>
              </Button>
              {!isTerminal && <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent" onClick={() => setMobileMenuOpen(true)}>
                <Menu className="w-6 h-6" />
              </Button>}
            </div>
          </div>
          <div className="border-t border-white/10 px-4 pb-3 pt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.nombre}</p>
              <p className="text-xs text-white/70">{user.rol} · {userBlockLocation}</p>
            </div>
            {renderLocationControl(true)}
          </div>
        </header>

        <header className="no-print hidden md:flex h-16 shrink-0 items-center justify-end gap-5 border-b bg-card px-8">
          {renderLocationControl()}
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar text-sm font-bold text-white">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{user.nombre}</p>
              <p className="text-xs text-muted-foreground">{user.rol}</p>
              <p className="text-xs text-muted-foreground">{userBlockLocation}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLogoutDialogOpen(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </header>

        {mobileMenuOpen && (
          <div className="no-print fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-[280px] bg-sidebar text-sidebar-foreground h-full flex flex-col animate-in slide-in-from-left duration-200">
              <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <BrandLogo variant="mark" className="h-9 w-9" />
                  <span className="font-bold text-lg text-white">Mariana Textil</span>
                </div>
                <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent" onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <nav className="flex-1 overflow-y-auto">
                {renderNavContent(() => setMobileMenuOpen(false))}
              </nav>

            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Se cerrará tu sesión y regresarás a la pantalla de acceso.
            </DialogDescription>
          </DialogHeader>
          {isCaja && sesionCajaData?.sesion && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Tienes una sesión de caja abierta. Si cierras sesión, la caja seguirá abierta y podrás retomarla al volver a entrar.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)} disabled={logout.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleLogout} disabled={logout.isPending}>
              Cerrar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
