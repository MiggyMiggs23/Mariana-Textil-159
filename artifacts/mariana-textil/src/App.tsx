import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { useGetCurrentUser, getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { Loader2 } from 'lucide-react';

import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Ubicaciones from '@/pages/ubicaciones';
import Usuarios from '@/pages/usuarios';
import Productos from '@/pages/productos';
import ProductoDetail from '@/pages/producto-detail';
import Proveedores from '@/pages/proveedores';
import ProveedorDetail from '@/pages/proveedor-detail';
import Clientes from '@/pages/clientes';
import ClienteDetail from '@/pages/cliente-detail';
import Entradas from '@/pages/entradas';
import EntradasPendientesCosto from '@/pages/entradas-pendientes-costo';
import EntradaDocumento from '@/pages/entrada-documento';
import EntradaEtiquetas from '@/pages/entrada-etiquetas';
import Salidas from '@/pages/salidas';
import SalidaNueva from '@/pages/salida-nueva';
import SalidaDetail from '@/pages/salida-detail';
import SalidaDocumento from '@/pages/salida-documento';
import Movimientos from '@/pages/movimientos';
import Etiquetas from '@/pages/etiquetas';
import Inventario from '@/pages/inventario';
import RolloDetail from '@/pages/rollo-detail';
import RolloEtiqueta from '@/pages/rollo-etiqueta';
import Pos from '@/pages/pos';
import Cobros from '@/pages/cobros';
import TicketDetail from '@/pages/ticket-detail';
import Ajustes from '@/pages/ajustes';
import Conciliacion from '@/pages/conciliacion';
import Permisos from '@/pages/permisos';
import Auditoria from '@/pages/auditoria/index';
import Alertas from '@/pages/alertas';
import CajaTiempoReal from '@/pages/caja/tiempo-real';
import CajaCortes from '@/pages/caja/cortes';
import CajaCuentasDestino from '@/pages/caja/cuentas-destino';
import Notificaciones from '@/pages/notificaciones';
import Reportes from '@/pages/reportes';
import Contenedores from '@/pages/contenedores/index';
import ContenedorNuevo from '@/pages/contenedores/nuevo';
import ContenedorDetail from '@/pages/contenedores/detail';
import PreciosList from '@/pages/precios/index';
import PrecioDetail from '@/pages/precios/detail';
import { LocationScopeProvider } from '@/lib/location-scope';
import { Modules, hasPermission } from '@/lib/permisos';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-sidebar">404</h1>
        <p className="text-muted-foreground">La página que buscas no existe o no tienes permisos.</p>
        <button 
          onClick={() => setLocation('/')}
          className="text-primary hover:underline font-medium"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component, allowedModule, allowedAction = "ver", adminOnly }: { component: React.ComponentType, allowedModule?: string, allowedAction?: "ver" | "crear" | "editar" | "autorizar", adminOnly?: boolean }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() }
  });

  useEffect(() => {
    if (error) {
      const returnTo = location.startsWith("/") ? location : "/";
      setLocation(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [error, location, setLocation]);

  useEffect(() => {
    if (user && location === "/") {
      if (user.rol === "TERMINAL") {
        setLocation("/pos");
      } else if (user.rol === "CAJA") {
        setLocation("/cobros");
      } else if (user.rol === "ADMIN") {
        setLocation("/caja/tiempo-real");
      } else if (hasPermission(user, Modules.DASHBOARD, 'ver')) {
        setLocation("/inventario/vista-global");
      } else if (hasPermission(user, Modules.POS, 'ver')) {
        setLocation("/pos");
      } else if (hasPermission(user, Modules.COBROS_PAGOS, 'ver')) {
        setLocation("/cobros");
      }
    }
  }, [user, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (adminOnly && user.rol !== "ADMIN") {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-destructive">Sin acceso</h1>
          <p className="text-muted-foreground">Esta sección es exclusiva para administradores.</p>
          <button
            onClick={() => setLocation('/')}
            className="text-primary hover:underline font-medium"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (allowedModule && !hasPermission(user, allowedModule, allowedAction)) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-destructive">Sin acceso</h1>
          <p className="text-muted-foreground">No tienes permisos para ver este módulo ({allowedModule}).</p>
          <button
            onClick={() => setLocation('/')}
            className="text-primary hover:underline font-medium"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return <Component />;
}

function PosWithLayout() {
  return (
    <AppLayout>
      <Pos />
    </AppLayout>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} allowedModule={Modules.DASHBOARD} />} />
        <Route path="/inventario/vista-global" component={() => <ProtectedRoute component={Dashboard} allowedModule={Modules.DASHBOARD} />} />
        <Route path="/ubicaciones" component={() => <ProtectedRoute component={Ubicaciones} allowedModule={Modules.UBICACIONES} />} />
        <Route path="/usuarios" component={() => <ProtectedRoute component={Usuarios} allowedModule={Modules.USUARIOS} />} />
        <Route path="/permisos" component={() => <ProtectedRoute component={Permisos} allowedModule={Modules.PERMISOS} />} />

        <Route path="/entradas" component={() => <ProtectedRoute component={Entradas} allowedModule={Modules.ENTRADAS} />} />
        <Route path="/entradas/pendientes-costo" component={() => <ProtectedRoute component={EntradasPendientesCosto} allowedModule={Modules.ENTRADAS} />} />
        <Route path="/entradas/:id/documento" component={() => <ProtectedRoute component={EntradaDocumento} allowedModule={Modules.ENTRADAS} />} />
        <Route path="/entradas/:id/etiquetas" component={() => <ProtectedRoute component={EntradaEtiquetas} allowedModule={Modules.ENTRADAS} />} />

        <Route path="/salidas" component={() => <ProtectedRoute component={Salidas} />} />
        <Route path="/salidas/nueva" component={() => <ProtectedRoute component={SalidaNueva} allowedModule={Modules.SALIDAS} allowedAction="crear" />} />
        <Route path="/salidas/:id/documento/salida" component={() => <ProtectedRoute component={SalidaDocumento} allowedModule={Modules.SALIDAS} />} />
        <Route path="/salidas/:id" component={() => <ProtectedRoute component={SalidaDetail} allowedModule={Modules.SALIDAS} />} />

        <Route path="/movimientos" component={() => <ProtectedRoute component={Movimientos} allowedModule={Modules.MOVIMIENTOS} />} />
        <Route path="/etiquetas" component={() => <ProtectedRoute component={Etiquetas} allowedModule={Modules.ETIQUETAS} />} />

        <Route path="/inventario" component={() => <ProtectedRoute component={Inventario} allowedModule={Modules.INVENTARIO} />} />
        <Route path="/inventario/rollos/:id" component={() => <ProtectedRoute component={RolloDetail} allowedModule={Modules.INVENTARIO} />} />
        <Route path="/inventario/rollos/:id/etiqueta" component={() => <ProtectedRoute component={RolloEtiqueta} allowedModule={Modules.ETIQUETAS} />} />
        <Route path="/inventario/ajustes" component={() => <ProtectedRoute component={Ajustes} allowedModule={Modules.AJUSTES} />} />
        
        <Route path="/productos" component={() => <ProtectedRoute component={Productos} allowedModule={Modules.PRODUCTOS} />} />
        <Route path="/productos/:id" component={() => <ProtectedRoute component={ProductoDetail} allowedModule={Modules.PRODUCTOS} />} />
        
        <Route path="/precios" component={() => <ProtectedRoute component={PreciosList} adminOnly />} />
        <Route path="/precios/:id" component={() => <ProtectedRoute component={PrecioDetail} adminOnly />} />
        <Route path="/pos" component={() => <ProtectedRoute component={PosWithLayout} allowedModule={Modules.POS} />} />
        <Route path="/cobros" component={() => <ProtectedRoute component={Cobros} allowedModule={Modules.COBROS_PAGOS} />} />

        <Route path="/caja/tiempo-real" component={() => <ProtectedRoute component={CajaTiempoReal} allowedModule={Modules.COBROS_PAGOS} adminOnly />} />
        <Route path="/caja/cortes" component={() => <ProtectedRoute component={CajaCortes} allowedModule={Modules.COBROS_PAGOS} />} />
        <Route path="/caja/diferencias" component={() => <ProtectedRoute component={Reportes} allowedModule={Modules.REPORTES} />} />
        <Route path="/caja/cuentas-destino" component={() => <ProtectedRoute component={CajaCuentasDestino} allowedModule={Modules.COBROS_PAGOS} adminOnly />} />
        <Route path="/caja/comparativo" component={() => <ProtectedRoute component={Reportes} allowedModule={Modules.REPORTES} />} />
        <Route path="/alertas" component={() => <ProtectedRoute component={Alertas} adminOnly />} />
        <Route path="/notificaciones" component={() => <ProtectedRoute component={Notificaciones} adminOnly />} />
        <Route path="/reportes" component={() => <ProtectedRoute component={Reportes} allowedModule={Modules.REPORTES} />} />
        <Route path="/reportes/:tab" component={() => <ProtectedRoute component={Reportes} allowedModule={Modules.REPORTES} />} />

        <Route path="/tickets/:id" component={() => <ProtectedRoute component={TicketDetail} allowedModule={Modules.COBROS_PAGOS} />} />
        
        <Route path="/proveedores" component={() => <ProtectedRoute component={Proveedores} allowedModule={Modules.PROVEEDORES} />} />
        <Route path="/proveedores/:id" component={() => <ProtectedRoute component={ProveedorDetail} allowedModule={Modules.PROVEEDORES} />} />
        <Route path="/clientes" component={() => <ProtectedRoute component={Clientes} allowedModule={Modules.CLIENTES} />} />
        <Route path="/clientes/:id" component={() => <ProtectedRoute component={ClienteDetail} allowedModule={Modules.CLIENTES} />} />
        
        <Route path="/administracion/conciliacion" component={() => <ProtectedRoute component={Conciliacion} allowedModule={Modules.CONCILIACION} />} />
        <Route path="/auditoria" component={() => <ProtectedRoute component={Auditoria} allowedModule={Modules.AUDITORIA} adminOnly />} />
        
        <Route path="/contenedores" component={() => <ProtectedRoute component={Contenedores} allowedModule={Modules.CONTENEDORES} />} />
        <Route path="/contenedores/nuevo" component={() => <ProtectedRoute component={ContenedorNuevo} allowedModule={Modules.CONTENEDORES} allowedAction="crear" />} />
        <Route path="/contenedores/:id" component={() => <ProtectedRoute component={ContenedorDetail} allowedModule={Modules.CONTENEDORES} />} />

        <Route component={() => <ProtectedRoute component={NotFound} />} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <LocationScopeProvider>
            <Router />
          </LocationScopeProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
