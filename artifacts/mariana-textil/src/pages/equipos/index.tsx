import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useLocationScope } from "@/lib/location-scope";
import {
  useListEquipos,
  getListEquiposQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  useListLocations,
  getListLocationsQueryKey,
  Equipo,
  TipoEquipo
} from "@workspace/api-client-react";
import { hasPermission, Modules } from "@/lib/permisos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutDashboard, Monitor, Printer, Smartphone, ScanLine, Tag, MapPin, CheckCircle2, Edit } from "lucide-react";
import { EquipoFormDialog } from "./equipo-form-dialog";
import { EquipoChecklistDialog } from "./equipo-checklist-dialog";

function getTipoIcon(tipo: string) {
  switch (tipo) {
    case "COMPUTADORA_POS": return <Monitor className="w-4 h-4" />;
    case "IMPRESORA_TICKETS": return <Printer className="w-4 h-4" />;
    case "IMPRESORA_ETIQUETAS": return <Tag className="w-4 h-4" />;
    case "PISTOLA_ESCANER": return <ScanLine className="w-4 h-4" />;
    case "SMARTPHONE_ESCANER": return <Smartphone className="w-4 h-4" />;
    default: return <LayoutDashboard className="w-4 h-4" />;
  }
}

export default function Equipos() {
  const { selectedLocationId } = useLocationScope();
  const { data: user } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() }
  });

  const canCreate = hasPermission(user, Modules.EQUIPOS, "crear") || user?.rol === "ADMIN";
  const canEdit = hasPermission(user, Modules.EQUIPOS, "editar") || user?.rol === "ADMIN";

  const { data: equipos, isLoading: isLoadingEquipos } = useListEquipos(
    { ubicacionId: selectedLocationId ?? undefined },
    { query: { queryKey: getListEquiposQueryKey({ ubicacionId: selectedLocationId ?? undefined }) } }
  );

  const { data: locations } = useListLocations({
    query: { queryKey: getListLocationsQueryKey() }
  });

  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [activeEquipo, setActiveEquipo] = useState<Equipo | null>(null);

  const handleCreate = () => {
    setEditingEquipo(null);
    setFormOpen(true);
  };

  const handleEdit = (equipo: Equipo) => {
    setEditingEquipo(equipo);
    setFormOpen(true);
  };

  const handleChecklist = (equipo: Equipo) => {
    setActiveEquipo(equipo);
    setChecklistOpen(true);
  };

  const siteGroups = useMemo(() => {
    if (!equipos) return [];
    const groups: Record<number, { ubicacionNombre: string; equipos: Equipo[]; activeCount: number; totalCount: number }> = {};
    
    equipos.forEach(eq => {
      if (!groups[eq.ubicacionId]) {
        groups[eq.ubicacionId] = {
          ubicacionNombre: eq.ubicacionNombre,
          equipos: [],
          activeCount: 0,
          totalCount: 0
        };
      }
      groups[eq.ubicacionId].equipos.push(eq);
      groups[eq.ubicacionId].totalCount++;
      if (eq.activo) groups[eq.ubicacionId].activeCount++;
    });
    
    return Object.values(groups).sort((a, b) => a.ubicacionNombre.localeCompare(b.ubicacionNombre));
  }, [equipos]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Equipos</h1>
            <p className="text-muted-foreground mt-2">
              Gestión de hardware de sistema en sucursales y almacenes.
            </p>
          </div>
          {canCreate && (
            <Button onClick={handleCreate} className="w-full sm:w-auto" data-testid="button-create-equipo">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Equipo
            </Button>
          )}
        </div>

        {!selectedLocationId && siteGroups.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {siteGroups.map(group => (
              <div 
                key={group.ubicacionNombre} 
                onClick={() => document.getElementById(`site-${group.ubicacionNombre}`)?.scrollIntoView({ behavior: 'smooth' })}
                className="block"
                data-testid={`link-site-summary-${group.ubicacionNombre}`}
              >
                <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-muted/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {group.ubicacionNombre}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-primary">{group.activeCount}</span>
                      <span className="text-sm text-muted-foreground">/ {group.totalCount} activos</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}

        {isLoadingEquipos ? (
          <div className="p-8 text-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              Cargando equipos...
            </div>
          </div>
        ) : siteGroups.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No se encontraron equipos registrados para la ubicación actual.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {siteGroups.map(group => (
              <div key={group.ubicacionNombre} id={`site-${group.ubicacionNombre}`} className="space-y-4 scroll-mt-24">
                {!selectedLocationId && (
                  <h2 className="text-xl font-bold border-b pb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    {group.ubicacionNombre}
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.equipos.map(equipo => (
                    <Card key={equipo.id} className="flex flex-col">
                      <CardHeader className="pb-3 border-b bg-muted/10">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-lg line-clamp-1" title={equipo.identificador}>
                              {equipo.identificador}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1 mt-1">
                              {getTipoIcon(equipo.tipo)}
                              {equipo.tipoLabel}
                            </CardDescription>
                          </div>
                          {equipo.activo ? (
                            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                              {equipo.faltantes} faltantes
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="py-4 flex-1 space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground text-xs block uppercase tracking-wider">Marca</span>
                            <span className="font-medium">{equipo.marca}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs block uppercase tracking-wider">Modelo</span>
                            <span className="font-medium">{equipo.modelo}</span>
                          </div>
                        </div>
                        {equipo.numeroSerie && (
                          <div>
                            <span className="text-muted-foreground text-xs block uppercase tracking-wider">S/N</span>
                            <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded block truncate">{equipo.numeroSerie}</span>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="p-3 border-t bg-muted/5 flex items-center justify-between gap-2">
                        <Button 
                          variant={equipo.activo ? "outline" : "default"}
                          size="sm" 
                          className="flex-1 font-medium"
                          onClick={() => handleChecklist(equipo)}
                          data-testid={`btn-checklist-${equipo.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Checklist
                        </Button>
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="shrink-0"
                            onClick={() => handleEdit(equipo)}
                            data-testid={`btn-edit-${equipo.id}`}
                          >
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formOpen && locations && (
        <EquipoFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          equipo={editingEquipo}
          locations={locations}
          defaultLocationId={selectedLocationId}
        />
      )}

      {checklistOpen && activeEquipo && (
        <EquipoChecklistDialog
          open={checklistOpen}
          onClose={() => setChecklistOpen(false)}
          equipo={activeEquipo}
          canEdit={canEdit}
        />
      )}
    </AppLayout>
  );
}