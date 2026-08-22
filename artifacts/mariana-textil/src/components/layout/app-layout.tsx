import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCurrentUser,
  useLogout,
  Role,
  getGetCurrentUserQueryKey,
  useListLocations,
  getListLocationsQueryKey
} from "@workspace/api-client-react";
import { hasPermission, Modules, Module } from "@/lib/permisos";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  MapPin, 
  Users, 
  Wallet, 
  PackageSearch, 
  Boxes,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Activity,
  Package,
  UserSquare2,
  Truck,
  Ship,
  Banknote,
  Receipt,
  FileBarChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useLocationScope } from "@/lib/location-scope";

type NavItem = {
  name: string;
  path: string;
  icon: any;
  module: Module;
  isClickable: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "INICIO",
    items: [
      { name: "Dashboard", path: "/", icon: LayoutDashboard, module: Modules.DASHBOARD, isClickable: true },
    ]
  },
  {
    title: "OPERACIÓN",
    items: [
      { name: "Ventas / POS", path: "/ventas", icon: ShoppingCart, module: Modules.VENTAS_POS, isClickable: false },
      { name: "Entradas", path: "/entradas", icon: ArrowDownToLine, module: Modules.ENTRADAS, isClickable: false },
      { name: "Salidas", path: "/salidas", icon: ArrowUpFromLine, module: Modules.SALIDAS, isClickable: false },
      { name: "Transferencias", path: "/transferencias", icon: ArrowRightLeft, module: Modules.TRANSFERENCIAS, isClickable: false },
      { name: "Movimientos", path: "/movimientos", icon: Activity, module: Modules.MOVIMIENTOS, isClickable: false },
    ]
  },
  {
    title: "INVENTARIO",
    items: [
      { name: "Inventario", path: "/inventario", icon: Boxes, module: Modules.INVENTARIO, isClickable: false },
      { name: "Productos", path: "/productos", icon: Package, module: Modules.PRODUCTOS, isClickable: true },
    ]
  },
  {
    title: "ADMINISTRACIÓN",
    items: [
      { name: "Clientes", path: "/clientes", icon: UserSquare2, module: Modules.CLIENTES, isClickable: false },
      { name: "Proveedores", path: "/proveedores", icon: Truck, module: Modules.PROVEEDORES, isClickable: true },
      { name: "Ubicaciones", path: "/ubicaciones", icon: MapPin, module: Modules.UBICACIONES, isClickable: true },
      { name: "Usuarios", path: "/usuarios", icon: Users, module: Modules.USUARIOS, isClickable: true },
      { name: "Próx. Contenedores", path: "/contenedores", icon: Ship, module: Modules.CONTENEDORES, isClickable: false },
    ]
  },
  {
    title: "CAJA OPERATIVA",
    items: [
      { name: "Resumen de Caja", path: "/caja/resumen", icon: Wallet, module: Modules.CAJA_RESUMEN, isClickable: false },
      { name: "Cortes", path: "/caja/cortes", icon: Receipt, module: Modules.CAJA_CORTES, isClickable: false },
      { name: "Cobros y Pagos", path: "/caja/cobros-pagos", icon: Banknote, module: Modules.CAJA_COBROS, isClickable: false },
    ]
  },
  {
    title: "REPORTES",
    items: [
      { name: "Reportes", path: "/reportes", icon: FileBarChart, module: Modules.REPORTES, isClickable: false },
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
  
  const { selectedLocationId, setSelectedLocationId } = useLocationScope();
  const { data: locations } = useListLocations({
    query: {
      enabled: user?.rol === Role.ADMIN,
      queryKey: getListLocationsQueryKey()
    }
  });

  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const renderLocationControl = (compact = false) =>
    user.rol === Role.ADMIN ? (
      <div className={cn("space-y-1", compact ? "w-full" : "w-64")}>
        {!compact && (
          <span className="text-xs font-medium text-muted-foreground">
            Ubicación
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
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
          compact
            ? "w-full border-white/20 bg-white/10 text-white"
            : "border-border bg-muted/40 text-foreground",
        )}
      >
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {user.ubicacion?.nombre ?? "Sin ubicación"}
        </span>
      </div>
    );

  const renderNavContent = (onItemClick?: () => void) => (
    <div className="py-4 flex flex-col gap-6">
      {NAV_GROUPS.map((group) => {
        const allowedItems = group.items.filter(item => hasPermission(user.rol as Role, item.module));
        
        if (allowedItems.length === 0) return null;

        return (
          <div key={group.title} className="px-3 space-y-1">
            <h4 className="px-3 text-xs font-semibold text-sidebar-foreground/50 tracking-wider mb-2">
              {group.title}
            </h4>
            {allowedItems.map((item) => {
              const isActive = location === item.path;
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
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" 
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 font-medium"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70")} />
                  <span className="text-sm">{item.name}</span>
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
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-[100dvh] sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border flex-shrink-0">
          <span className="font-bold text-xl tracking-tight text-white">Mariana Textil</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          {renderNavContent()}
        </nav>

        <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/10 flex-shrink-0">
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm text-white truncate">{user.nombre}</span>
              <span className="text-xs text-sidebar-foreground/70 font-mono tracking-tight">{user.rol}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground hover:text-white hover:bg-sidebar-accent/50 h-8 text-sm"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Mobile Header & Menu */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-40 border-b border-sidebar-border bg-sidebar text-white shadow-sm">
          <div className="h-16 flex items-center justify-between px-4">
            <span className="font-bold text-lg">Mariana Textil</span>
            <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-6 h-6" />
            </Button>
          </div>
          <div className="border-t border-white/10 px-4 pb-3 pt-2">
            {renderLocationControl(true)}
          </div>
        </header>

        <header className="hidden md:flex h-16 shrink-0 items-center justify-end gap-5 border-b bg-card px-8">
          {renderLocationControl()}
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar text-sm font-bold text-white">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{user.nombre}</p>
              <p className="text-xs text-muted-foreground">{user.rol}</p>
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-[280px] bg-sidebar text-sidebar-foreground h-full flex flex-col animate-in slide-in-from-left duration-200">
              <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border flex-shrink-0">
                <span className="font-bold text-xl text-white">Menú</span>
                <Button variant="ghost" size="icon" className="text-white hover:bg-sidebar-accent" onClick={() => setMobileMenuOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <nav className="flex-1 overflow-y-auto">
                {renderNavContent(() => setMobileMenuOpen(false))}
              </nav>

              <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/10 flex-shrink-0">
                <div className="mb-4 space-y-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm text-white truncate">{user.nombre}</span>
                    <span className="text-xs text-sidebar-foreground/70 font-mono">{user.rol}</span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sidebar-foreground hover:text-white hover:bg-sidebar-accent h-8 text-sm"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
