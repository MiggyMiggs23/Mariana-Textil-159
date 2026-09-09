import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useLocationScope } from "@/lib/location-scope";
import {
  useListEquipos,
  getListEquiposQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  useListEquiposLocations,
  getListEquiposLocationsQueryKey,
  Equipo,
  UbicacionInventario,
} from "@workspace/api-client-react";
import { hasPermission, Modules } from "@/lib/permisos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutDashboard, Monitor, Printer, Smartphone, ScanLine, Tag, MapPin, CheckCircle2, Edit, ArrowLeft } from "lucide-react";
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

const spanishCollator = new Intl.Collator("es", {
  sensitivity: "base",
  numeric: true,
});

const tipoOrder: Record<string, number> = {
  COMPUTADORA_POS: 1,
  IMPRESORA_ETIQUETAS: 2,
  IMPRESORA_TICKETS: 3,
  PISTOLA_ESCANER: 4,
  SMARTPHONE_ESCANER: 5,
};

type SiteGroup = {
  ubicacionId: number;
  ubicacionNombre: string;
  equipos: Equipo[];
  activeCount: number;
  totalCount: number;
};

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

  const isGlobal = selectedLocationId === null;
  const {
    data: operationalLocations,
    isLoading: isLoadingLocations,
  } = useListEquiposLocations({
    query: {
      enabled: user !== undefined,
      queryKey: getListEquiposLocationsQueryKey(),
    },
  });

  const [editingEquipo, setEditingEquipo] = useState<Equipo | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [activeEquipo, setActiveEquipo] = useState<Equipo | null>(null);
  const [activeDrilldownSiteId, setActiveDrilldownSiteId] = useState<number | null>(null);

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

  const formLocations = useMemo<UbicacionInventario[]>(() => {
    if (operationalLocations) {
      return operationalLocations ?? [];
    }
    if (!user?.ubicacion) return [];
    return [
      {
        id: user.ubicacion.id,
        nombre: user.ubicacion.nombre,
        tipo: user.ubicacion.tipo,
        activa: user.ubicacion.activa,
      },
    ];
  }, [operationalLocations, user]);

  const siteGroups = useMemo<SiteGroup[]>(() => {
    const groups = new Map<number, SiteGroup>();
    const seedLocations = isGlobal
      ? operationalLocations ?? []
      : formLocations.filter((location) => location.id === selectedLocationId);

    for (const location of seedLocations) {
      groups.set(location.id, {
        ubicacionId: location.id,
        ubicacionNombre: location.nombre,
        equipos: [],
        activeCount: 0,
        totalCount: 0,
      });
    }

    for (const equipo of equipos ?? []) {
      if (!groups.has(equipo.ubicacionId)) {
        groups.set(equipo.ubicacionId, {
          ubicacionId: equipo.ubicacionId,
          ubicacionNombre: equipo.ubicacionNombre,
          equipos: [],
          activeCount: 0,
          totalCount: 0,
        });
      }
      const group = groups.get(equipo.ubicacionId)!;
      group.equipos.push(equipo);
      group.totalCount += 1;
      if (equipo.activo) group.activeCount += 1;
    }

    for (const group of groups.values()) {
      group.equipos.sort((a, b) => {
        const typeDifference = (tipoOrder[a.tipo] ?? 99) - (tipoOrder[b.tipo] ?? 99);
        return typeDifference || spanishCollator.compare(a.identificador, b.identificador);
      });
    }

    return Array.from(groups.values()).sort((a, b) =>
      spanishCollator.compare(a.ubicacionNombre, b.ubicacionNombre),
    );
  }, [
    equipos,
    formLocations,
    isGlobal,
    operationalLocations,
    selectedLocationId,
  ]);

  const activeDrilldownGroup =
    isGlobal && activeDrilldownSiteId !== null
      ? siteGroups.find((group) => group.ubicacionId === activeDrilldownSiteId) ?? null
      : null;

  const openActiveDrilldown = (siteId: number) => {
    setActiveDrilldownSiteId(siteId);
    window.requestAnimationFrame(() => {
      document
        .getElementById("active-equipment-drilldown")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const renderEquipoCard = (equipo: Equipo) => {
    const missingItems = equipo.checklist.filter((item) => !item.checked);
    return (
      <Card
        key={equipo.id}
        className="flex flex-col"
        data-testid={`card-equipo-${equipo.id}`}
      >
        <CardHeader className="border-b bg-muted/10 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle
                className="line-clamp-1 text-lg"
                title={equipo.identificador}
              >
                {equipo.identificador}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-1">
                {getTipoIcon(equipo.tipo)}
                {equipo.tipoLabel}
              </CardDescription>
            </div>
            {equipo.activo ? (
              <Badge
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid={`status-equipo-activo-${equipo.id}`}
              >
                Activo
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-muted text-muted-foreground"
                data-testid={`status-equipo-incompleto-${equipo.id}`}
              >
                {equipo.faltantes} faltantes
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 py-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                Marca
              </span>
              <span className="font-medium">{equipo.marca}</span>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                Modelo
              </span>
              <span className="font-medium">{equipo.modelo}</span>
            </div>
          </div>
          {equipo.numeroSerie && (
            <div>
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                Serie
              </span>
              <span className="block truncate rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {equipo.numeroSerie}
              </span>
            </div>
          )}
          {equipo.notas && (
            <div>
              <span className="block text-xs uppercase tracking-wider text-muted-foreground">
                Notas
              </span>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {equipo.notas}
              </p>
            </div>
          )}
          {missingItems.length > 0 && (
            <div
              className="rounded-md border bg-muted/20 p-3"
              data-testid={`missing-checklist-equipo-${equipo.id}`}
            >
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Falta comprobar
              </p>
              <ul className="space-y-1 text-xs text-foreground/80">
                {missingItems.map((item) => (
                  <li key={item.key} className="flex gap-2">
                    <span aria-hidden="true">—</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/5 p-3">
          <Button
            variant={equipo.activo ? "outline" : "default"}
            size="sm"
            className="flex-1 font-medium"
            onClick={() => handleChecklist(equipo)}
            data-testid={`button-checklist-equipo-${equipo.id}`}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Checklist
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => handleEdit(equipo)}
              aria-label={`Editar ${equipo.identificador}`}
              data-testid={`button-edit-equipo-${equipo.id}`}
            >
              <Edit className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  const isLoading =
    isLoadingEquipos ||
    (isGlobal && isLoadingLocations);

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

        {isGlobal && siteGroups.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {siteGroups.map(group => (
              <button
                key={group.ubicacionId}
                type="button"
                onClick={() => openActiveDrilldown(group.ubicacionId)}
                className="block text-left"
                data-testid={`button-active-summary-site-${group.ubicacionId}`}
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
                      <span className="text-sm text-muted-foreground">
                        de {group.totalCount} activos
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
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
        ) : activeDrilldownGroup ? (
          <section
            id="active-equipment-drilldown"
            className="scroll-mt-24 space-y-4"
            data-testid={`active-equipment-list-site-${activeDrilldownGroup.ubicacionId}`}
          >
            <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Equipos activos
                </p>
                <h2 className="text-xl font-bold">
                  {activeDrilldownGroup.ubicacionNombre}
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveDrilldownSiteId(null)}
                data-testid="button-show-all-equipment-sites"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a todos los sitios
              </Button>
            </div>
            {activeDrilldownGroup.activeCount === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Este sitio todavía no tiene equipos con el checklist completo.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeDrilldownGroup.equipos
                  .filter((equipo) => equipo.activo)
                  .map(renderEquipoCard)}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-8">
            {siteGroups.map(group => (
              <section
                key={group.ubicacionId}
                id={`site-${group.ubicacionId}`}
                className="space-y-4 scroll-mt-24"
                data-testid={`equipment-group-site-${group.ubicacionId}`}
              >
                <div className="flex items-center justify-between gap-3 border-b pb-2">
                  <h2 className="text-xl font-bold border-b pb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    {group.ubicacionNombre}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {group.activeCount} de {group.totalCount} activos
                  </span>
                </div>
                {group.equipos.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Sin equipos registrados en este sitio.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.equipos.map(renderEquipoCard)}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {formOpen && formLocations.length > 0 && (
        <EquipoFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          equipo={editingEquipo}
          locations={formLocations}
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