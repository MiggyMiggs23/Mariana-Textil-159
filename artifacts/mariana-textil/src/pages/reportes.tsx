import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaComparativo from "@/pages/caja/comparativo";
import CajaDiferencias from "@/pages/caja/diferencias";

import { useGetReportesCatalogos, useGetReporteSeccion, getGetReporteSeccionQueryKey, useGetCurrentUser } from "@workspace/api-client-react";

import { ReportFilterBar, FilterState, DEFAULT_FILTERS } from "@/components/reportes/report-filter-bar";
import { ReportKpis } from "@/components/reportes/report-kpis";
import { ReportWarnings } from "@/components/reportes/report-warnings";
import { ReportCharts } from "@/components/reportes/report-charts";
import { ReportTable } from "@/components/reportes/report-table";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readCombinedFilterCriteria, sanitizeCombinedFilterCriteria, writeCombinedFilterCriteria } from "@/components/shared/combined-filter-url";

const TABS = [
  { id: "ventas", label: "Ventas" },
  { id: "utilidad", label: "Utilidad y Márgenes" },
  { id: "inventario", label: "Inventario y Rotación" },
  { id: "mapas-calor", label: "Mapas de Calor" },
  { id: "color", label: "Análisis de Color" },
  { id: "compras", label: "Compras" },
  { id: "clientes", label: "Clientes y Crédito" },
  { id: "pagos-dirigidos", label: "Pagos Dirigidos" },
  { id: "comparativo", label: "Comparativo entre Sitios" },
  { id: "diferencias", label: "Diferencias de Caja" },
];

const REPORT_MIN_DATE = "1900-01-01";
const REPORT_MAX_DATE = "2999-12-31";
const MAX_CUSTOM_RANGE_MS = 100 * 366 * 24 * 60 * 60 * 1000;

function hasValidDateRange(filters: FilterState): boolean {
  if (filters.periodo !== "personalizado") return true;
  if (!filters.desde || !filters.hasta) return false;
  if (filters.desde < REPORT_MIN_DATE || filters.hasta > REPORT_MAX_DATE || filters.desde > filters.hasta) return false;
  const from = Date.parse(`${filters.desde}T00:00:00Z`);
  const to = Date.parse(`${filters.hasta}T00:00:00Z`);
  return Number.isFinite(from) && Number.isFinite(to) && to - from <= MAX_CUSTOM_RANGE_MS;
}

export default function Reportes() {
  const { data: user } = useGetCurrentUser();
  const isAdmin = user?.rol === "ADMIN";
  const [location, setLocation] = useLocation();
  const searchString = useSearch();

  const allowedTabs = TABS.filter(tab => {
    if (!isAdmin) {
      if (["utilidad", "compras", "clientes", "pagos-dirigidos", "comparativo", "diferencias"].includes(tab.id)) {
        return false;
      }
    }
    return true;
  });

  // Extract tab from URL or default to "ventas"
  let activeTab = "ventas";
  const requestedQueryTab = new URLSearchParams(searchString).get("tab");
  const pathParts = location.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  if (allowedTabs.some(t => t.id === requestedQueryTab)) {
    activeTab = requestedQueryTab!;
  } else if (allowedTabs.some(t => t.id === lastPart)) {
    activeTab = lastPart;
  } else if (!allowedTabs.some(t => t.id === activeTab)) {
    activeTab = allowedTabs[0]?.id || "inventario";
  }

  // Parse initial state from URL search string
  const [filters, setFilters] = useState<FilterState>(() => {
    if (!searchString) return DEFAULT_FILTERS;

    const params = new URLSearchParams(searchString);
    const parseArray = (key: string) => params.getAll(key).flatMap(v => v.split(',')).filter(Boolean);
    const parseNumArray = (key: string) => parseArray(key).map(Number).filter(n => Number.isInteger(n) && n > 0);
    const combined = readCombinedFilterCriteria(params);

    const requestedPeriod = params.get("periodo");
    const parsed = {
      periodo: ["diario", "semanal", "mensual", "trimestral", "semestral", "anual", "personalizado"].includes(requestedPeriod ?? "")
        ? requestedPeriod!
        : DEFAULT_FILTERS.periodo,
      modalidad: (["ROLLOS", "METRAJE"].includes(params.get("modalidad") || "")
        ? params.get("modalidad")
        : "TODO") as FilterState["modalidad"],
      desde: combined.desde,
      hasta: combined.hasta,
      ubicacionIds: combined.ubicacionIds,
      productoIds: parseNumArray("productoIds"),
      telas: combined.telas,
      colores: combined.colores,
      unidades: parseArray("unidades"),
      usuarioIds: parseNumArray("usuarioIds"),
      clienteIds: parseNumArray("clienteIds"),
      proveedorIds: combined.proveedorIds,
      formasPago: parseArray("formasPago"),
      facturado: params.get("facturado") === "true" ? true : params.get("facturado") === "false" ? false : undefined,
    };
    return parsed;
  });
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Redirect to default tab if base route hit
  useEffect(() => {
    if ((location === "/reportes" || location === "/reportes/") && !requestedQueryTab) {
      setLocation(`/reportes/ventas${searchString ? '?' + searchString : ''}`);
    }
  }, [location, searchString, setLocation, requestedQueryTab]);

  // Sync state to URL when filters change
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    const params = new URLSearchParams();

    if (newFilters.periodo !== "mensual") params.set("periodo", newFilters.periodo);
    if (newFilters.modalidad !== "TODO") params.set("modalidad", newFilters.modalidad);
    writeCombinedFilterCriteria(params, newFilters);
    if (newFilters.productoIds.length) params.set("productoIds", newFilters.productoIds.join(","));
    if (newFilters.unidades.length) params.set("unidades", newFilters.unidades.join(","));
    if (newFilters.usuarioIds.length) params.set("usuarioIds", newFilters.usuarioIds.join(","));
    if (newFilters.clienteIds.length) params.set("clienteIds", newFilters.clienteIds.join(","));
    if (newFilters.formasPago.length) params.set("formasPago", newFilters.formasPago.join(","));
    if (newFilters.facturado !== undefined) params.set("facturado", String(newFilters.facturado));

    const newSearchString = params.toString();
    setLocation(`/reportes/${activeTab}${newSearchString ? '?' + newSearchString : ''}`);
  };

  const isCajaTab = activeTab === "comparativo" || activeTab === "diferencias";
  const isDateRangeValid = hasValidDateRange(filters);

  // Catalogos
  const { data: catalogos } = useGetReportesCatalogos();

  useEffect(() => {
    if (!catalogos) return;
    const sanitized = sanitizeCombinedFilterCriteria(filters, {
      proveedorIds: catalogos.suppliers.map((item) => item.id),
      ubicacionIds: catalogos.sites.map((item) => item.id),
      telas: catalogos.fabrics,
      colores: catalogos.colors,
    });
    const next = {
      ...filters,
      ...sanitized,
      productoIds: filters.productoIds.filter((id) => catalogos.products.some((item) => item.id === id)),
      unidades: filters.unidades.filter((value) => catalogos.units.includes(value)),
      usuarioIds: filters.usuarioIds.filter((id) => catalogos.users.some((item) => item.id === id)),
      clienteIds: filters.clienteIds.filter((id) => catalogos.clients.some((item) => item.id === id)),
      formasPago: filters.formasPago.filter((value) => catalogos.paymentMethods.includes(value)),
    };
    if (JSON.stringify(next) !== JSON.stringify(filters)) {
      handleFilterChange(next);
    }
  }, [catalogos]);

  // Clean params for the API call (removing empty arrays/undefined)
  const apiParams = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) =>
      v !== undefined && (!Array.isArray(v) || v.length > 0)
    )
  );

  // Data hook
  type SectionType = Parameters<typeof useGetReporteSeccion>[0];
  const isValidSection = !isCajaTab && activeTab as any;

  const { data: reportData, isLoading, isError, refetch } = useGetReporteSeccion(isValidSection as SectionType, apiParams as any, {
    query: {
      enabled: !isCajaTab && isDateRangeValid,
      queryKey: getGetReporteSeccionQueryKey(isValidSection as SectionType, apiParams as any)
    }
  });

  const handleTabChange = (value: string) => {
    setLocation(`/reportes/${value}${searchString ? '?' + searchString : ''}`);
  };

  const handleDownload = async (format: "xlsx" | "pdf") => {
    if (!isDateRangeValid) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(apiParams)) {
      params.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    setDownloadError(null);
    try {
      const response = await fetch(`/api/reportes/${activeTab}/export.${format}?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`La exportación respondió ${response.status}.`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activeTab}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("No se pudo descargar el reporte. Intenta de nuevo.");
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">Reportes y Decisiones</h1>
          <p className="mt-1 text-muted-foreground">
            Análisis consolidados para seguimiento operativo y financiero.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <div className="relative z-20 overflow-x-auto pb-2 custom-scrollbar">
            <TabsList className="h-10 inline-flex w-auto justify-start min-w-max">
              {allowedTabs.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  data-testid={`tab-${tab.id}`}
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {activeTab === "comparativo" ? (
            <div className="animate-in fade-in">
              <CajaComparativo embedded />
            </div>
          ) : activeTab === "diferencias" ? (
            <div className="animate-in fade-in">
              <CajaDiferencias embedded />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in">
              <ReportFilterBar
                catalogos={catalogos}
                filters={filters}
                onChange={handleFilterChange}
                onRefresh={refetch}
                onDownloadExcel={() => handleDownload("xlsx")}
                onDownloadPdf={() => handleDownload("pdf")}
                actionsDisabled={!isDateRangeValid}
              />

              {downloadError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
                  {downloadError}
                </div>
              )}

              {!isDateRangeValid ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="report-date-range-prompt">
                  Selecciona un rango entre 1900 y 2999, de hasta 100 años, para generar el reporte.
                </div>
              ) : isLoading ? (
                <div className="h-[400px] flex items-center justify-center bg-card rounded-lg border shadow-sm" data-testid="report-loading">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                    <p className="text-sm text-muted-foreground">Analizando datos...</p>
                  </div>
                </div>
              ) : isError ? (
                <div className="p-10 text-center text-destructive bg-destructive/5 rounded-xl border border-destructive/20" data-testid="report-error">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-80" />
                  <p className="font-semibold">No se pudo cargar el reporte</p>
                  <Button variant="outline" className="mt-4" onClick={() => refetch()} data-testid="report-retry">
                    <RefreshCw className="w-4 h-4 mr-2" /> Intentar de nuevo
                  </Button>
                </div>
              ) : reportData ? (
                <div className="space-y-6" data-testid={`report-content-${activeTab}`}>
                  <ReportWarnings warnings={reportData.warnings || []} />

                  <ReportKpis
                    kpis={reportData.kpis || []}
                    hasEconomicAccess={reportData.hasEconomicAccess}
                  />

                  <ReportCharts charts={reportData.charts || []} section={activeTab} />

                  <div className="grid grid-cols-1 gap-6">
                    {(reportData.tables || []).map((table: any) => (
                      <ReportTable
                        key={table.id}
                        block={table}
                        hasEconomicAccess={reportData.hasEconomicAccess}
                        section={activeTab}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}