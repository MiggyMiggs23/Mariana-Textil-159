import { useGetDashboard, useGetCurrentUser, Role } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Warehouse } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Dashboard() {
  const { data: user } = useGetCurrentUser();
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="h-32 bg-muted rounded-xl"></div>
            <div className="h-32 bg-muted rounded-xl"></div>
            <div className="h-32 bg-muted rounded-xl"></div>
          </div>
          <div className="h-64 bg-muted rounded-xl"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !dashboard) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-destructive">
          No se pudo cargar el dashboard.
        </div>
      </AppLayout>
    );
  }

  const isAdmin = user?.rol === Role.ADMIN;
  
  // Filtrar si no es admin
  const inventario = isAdmin 
    ? dashboard.inventarioPorUbicacion 
    : dashboard.inventarioPorUbicacion.filter(i => i.ubicacionId === user?.ubicacion?.id);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">
            {isAdmin ? "Vista Global" : `Dashboard - ${user?.ubicacion?.nombre || 'General'}`}
          </h1>
          <p className="text-muted-foreground mt-2">
            Resumen de la operación al momento.
          </p>
        </div>

        {isAdmin && (
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tiendas Activas</CardTitle>
                <Building2 className="h-5 w-5 text-sidebar-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.tiendasActivas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bodegas Activas</CardTitle>
                <Warehouse className="h-5 w-5 text-sidebar-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.bodegasActivas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios Activos</CardTitle>
                <Users className="h-5 w-5 text-sidebar-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dashboard.usuariosActivos}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Inventario por Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {inventario.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No hay información de inventario disponible.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Ubicación</TableHead>
                    <TableHead className="text-right">Metros (m)</TableHead>
                    <TableHead className="text-right">Kilos (kg)</TableHead>
                    <TableHead className="text-right">Rollos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventario.map((item) => (
                    <TableRow key={item.ubicacionId}>
                      <TableCell className="font-medium">{item.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.metros}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.kilos}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.rollos}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
