import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
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
import Entradas from '@/pages/entradas';
import Inventario from '@/pages/inventario';
import RolloDetail from '@/pages/rollo-detail';
import Ajustes from '@/pages/ajustes';
import Conciliacion from '@/pages/conciliacion';
import { LocationScopeProvider } from '@/lib/location-scope';

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

function ProtectedRoute({ component: Component, allowedRoles }: { component: React.ComponentType, allowedRoles?: import('@workspace/api-client-react').Role[] }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() }
  });

  useEffect(() => {
    if (error) {
      setLocation('/login');
    }
  }, [error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <NotFound />;
  }

  return <Component />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/ubicaciones" component={() => <ProtectedRoute component={Ubicaciones} allowedRoles={["ADMIN"]} />} />
        <Route path="/usuarios" component={() => <ProtectedRoute component={Usuarios} allowedRoles={["ADMIN"]} />} />
        
        <Route path="/entradas" component={() => <ProtectedRoute component={Entradas} allowedRoles={["ADMIN", "INVENTARIOS", "BODEGA"]} />} />
        <Route path="/inventario" component={() => <ProtectedRoute component={Inventario} />} />
        <Route path="/inventario/rollos/:id" component={() => <ProtectedRoute component={RolloDetail} />} />
        <Route path="/inventario/ajustes" component={() => <ProtectedRoute component={Ajustes} allowedRoles={["ADMIN", "INVENTARIOS"]} />} />
        
        <Route path="/productos" component={() => <ProtectedRoute component={Productos} />} />
        <Route path="/productos/:id" component={() => <ProtectedRoute component={ProductoDetail} />} />
        
        <Route path="/proveedores" component={() => <ProtectedRoute component={Proveedores} allowedRoles={["ADMIN", "INVENTARIOS", "BODEGA"]} />} />
        <Route path="/proveedores/:id" component={() => <ProtectedRoute component={ProveedorDetail} allowedRoles={["ADMIN", "INVENTARIOS", "BODEGA"]} />} />
        
        <Route path="/administracion/conciliacion" component={() => <ProtectedRoute component={Conciliacion} allowedRoles={["ADMIN"]} />} />
        
        <Route component={NotFound} />
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
