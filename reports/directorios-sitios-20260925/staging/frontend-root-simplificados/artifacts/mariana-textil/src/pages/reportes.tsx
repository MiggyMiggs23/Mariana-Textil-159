import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useGetReportesCatalogos, useGetCurrentUser } from "@workspace/api-client-react";

import { ReportFilterBar, FilterState, DEFAULT_FILTERS } from "@/components/reportes/report-filter-bar";
import { VentasTab } from "@/components/reportes/tabs/ventas-tab";
import { QueComprarTab } from "@/components/reportes/tabs/que-comprar-tab";
import { UtilidadTab } from "@/components/reportes/tabs/utilidad-tab";
import { ClientesTab } from "@/components/reportes/tabs/clientes-tab";
import { ControlOperativoTab } from "@/components/reportes/tabs/control-operativo-tab";
import { readCombinedFilterCriteria, writeCombinedFilterCriteria, sanitizeCombinedFilterCriteria } from "@/components/shared/combined-filter-url";
import { useLocationScope } from "@/lib/location-scope";
import { useCreditSiteScope } from "@/components/credit-site-scope";
import { toast } from "sonner";
import {
  applyReportScope,
  buildReportExportParams,
  buildComparisonScopeParams,
  resolveReportRange,
  resolveReportTab,
  resolveReportViewMode,
  type ReportViewMode,
} from "@/components/reportes/report-scope";
import {
  DEFAULT_CASH_CONTROLS,
  type CashControls,
} from "@/components/reportes/cash-controls";
import type { ReportComparisonFrame } from "@/components/reportes/report-source-frame";

const TABS = [
  { id: "ventas", label: "Ventas" },
  { id: "que-comprar", label: "Qué comprar" },
  { id: "utilidad", label: "Utilidad y márgenes" },
  { id: "clientes", label: "Clientes y crédito" },
  { id: "control-operativo", label: "Control operativo" },
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
  const { selectedLocationId } = useLocationScope();
  const queryClient = useQueryClient();
  const queryParams = new URLSearchParams(searchString);

  const allowedTabs = TABS.filter(tab => {
    if (!isAdmin) {
      if (["utilidad", "clientes", "control-operativo"].includes(tab.id)) {
        return false;
      }
    }
    return true;
  });

  // Extract tab from URL or default to "ventas". Legacy report routes are
  // canonicalized below rather than rendered as dead report branches.
  const requestedQueryTab = queryParams.get("tab");
  const pathParts = location.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  const routeCandidate = requestedQueryTab ?? (lastPart === "reportes" ? null : lastPart);
  const tabResolution = resolveReportTab(routeCandidate);
  const activeTab = allowedTabs.some((tab) => tab.id === tabResolution.tab)
    ? tabResolution.tab
    : allowedTabs[0]?.id || "ventas";
  const credit = useCreditSiteScope(activeTab === "clientes");

  // Operational reports use the header; only the credit tab uses its own site.
  // PROPIA never widens through either selector or a URL mode.
  const isGlobalMode = selectedLocationId === null;
  const reportSiteId = activeTab === "clientes" ? credit.selectedSiteId : selectedLocationId;
  const canCompare = resolveReportViewMode(
    "comparar",
    reportSiteId,
    user?.alcanceConsulta,
    user?.rol,
  ) === "comparar";
  const requestedMode: ReportViewMode = queryParams.get("modo") === "comparar"
    ? "comparar"
    : "normal";
  const viewMode: ReportViewMode = resolveReportViewMode(
    requestedMode,
    reportSiteId,
    user?.alcanceConsulta,
    user?.rol,
  );
  const effectiveViewMode = viewMode;

  // Parse initial state from URL search string
  const [filters, setFilters] = useState<FilterState>(() => {
    if (!searchString) return DEFAULT_FILTERS;

    const params = new URLSearchParams(searchString);
    const parseArray = (key: string) => params.getAll(key).flatMap(v => v.split(',')).filter(Boolean);
    const parseNumArray = (key: string) => parseArray(key).map(Number).filter(n => Number.isInteger(n) && n > 0);
    const combined = readCombinedFilterCriteria(params);

    const requestedPeriod = params.get("periodo");
    const periodo = ["diario", "semanal", "mensual", "trimestral", "semestral", "anual", "personalizado"].includes(requestedPeriod ?? "")
      ? requestedPeriod!
      : DEFAULT_FILTERS.periodo;
    const parsed = {
      periodo,
      modalidad: (["ROLLOS", "METRAJE"].includes(params.get("modalidad") || "")
        ? params.get("modalidad")
        : "TODO") as FilterState["modalidad"],
      desde: periodo === "personalizado" ? combined.desde : undefined,
      hasta: periodo === "personalizado" ? combined.hasta : undefined,
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

  // Redirect to default tab if base route hit.
  useEffect(() => {
    if ((location === "/reportes" || location === "/reportes/") && !requestedQueryTab) {
      setLocation(`/reportes/ventas${searchString ? '?' + searchString : ''}`);
    }
  }, [location, searchString, setLocation, requestedQueryTab]);

  // Remove legacy route/site parameters while preserving report filters. The
  // old Comparativo route enters compare mode; all other old sections map to
  // their composed destination.
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const waitingForScope = user === undefined && tabResolution.forcedMode === "comparar";
    const shouldNormalizeMode =
      requestedMode === "comparar" && user !== undefined && !canCompare;
    const shouldCanonicalize =
      !waitingForScope &&
      (tabResolution.legacy ||
        params.has("ubicacionIds") ||
        params.has("ubicacionId") ||
        shouldNormalizeMode);
    if (!shouldCanonicalize) return;
    params.delete("ubicacionIds");
    params.delete("ubicacionId");
    params.delete("tab");
    const canonicalMode = canCompare &&
      (tabResolution.forcedMode === "comparar" || requestedMode === "comparar")
      ? "comparar"
      : null;
    if (canonicalMode) params.set("modo", canonicalMode);
    else params.delete("modo");
    const nextSearch = params.toString();
    setLocation(`/reportes/${activeTab}${nextSearch ? `?${nextSearch}` : ""}`);
  }, [
    activeTab,
    canCompare,
    requestedMode,
    requestedQueryTab,
    searchString,
    setLocation,
    tabResolution.forcedMode,
    tabResolution.legacy,
    user,
  ]);

  // Sync state to URL when filters change
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    const params = new URLSearchParams();
    if (viewMode === "comparar") params.set("modo", "comparar");

    if (newFilters.periodo !== "mensual") params.set("periodo", newFilters.periodo);
    if (newFilters.modalidad !== "TODO") params.set("modalidad", newFilters.modalidad);
    writeCombinedFilterCriteria(params, {
      proveedorIds: newFilters.proveedorIds,
      ubicacionIds: [],
      telas: newFilters.telas,
      colores: newFilters.colores,
      desde: newFilters.desde,
      hasta: newFilters.hasta,
    });
    if (newFilters.productoIds.length) params.set("productoIds", newFilters.productoIds.join(","));
    if (newFilters.unidades.length) params.set("unidades", newFilters.unidades.join(","));
    if (newFilters.usuarioIds.length) params.set("usuarioIds", newFilters.usuarioIds.join(","));
    if (newFilters.clienteIds.length) params.set("clienteIds", newFilters.clienteIds.join(","));
    if (newFilters.formasPago.length) params.set("formasPago", newFilters.formasPago.join(","));
    if (newFilters.facturado !== undefined) params.set("facturado", String(newFilters.facturado));

    const newSearchString = params.toString();
    setLocation(`/reportes/${activeTab}${newSearchString ? '?' + newSearchString : ''}`);
  };

  const dateRange = resolveReportRange(filters);
  const isDateRangeValid = hasValidDateRange(filters) && dateRange !== undefined;

  // Catalogos
  const { data: catalogos } = useGetReportesCatalogos();

  useEffect(() => {
    if (!catalogos) return;
    const sanitized = sanitizeCombinedFilterCriteria({
      proveedorIds: filters.proveedorIds,
      ubicacionIds: [],
      telas: filters.telas,
      colores: filters.colores,
      desde: filters.desde,
      hasta: filters.hasta,
    }, {
      proveedorIds: catalogos.suppliers.map((item) => item.id),
      ubicacionIds: [],
      telas: catalogos.fabrics,
      colores: catalogos.colors,
    });
    const next = {
      ...filters,
      proveedorIds: sanitized.proveedorIds,
      telas: sanitized.telas,
      colores: sanitized.colores,
      productoIds: filters.productoIds.filter((id) => catalogos.products.some((item) => item.id === id)),
      unidades: filters.unidades.filter((value) => catalogos.units.includes(value)),
      usuarioIds: filters.usuarioIds.filter((id) => catalogos.users.some((item) => item.id === id)),
      clienteIds: filters.clienteIds.filter((id) => catalogos.clients.some((item) => item.id === id)),
      formasPago: filters.formasPago.filter((value) => catalogos.paymentMethods.includes(value)),
    };
    if (JSON.stringify(next) !== JSON.stringify(filters)) {
      toast.info("Se ignoraron filtros que ya no existen", {
        description: "La dirección se actualizó con los filtros válidos.",
      });
      handleFilterChange(next);
    }
  }, [catalogos]);

  // Clean params for the API call (removing empty arrays/undefined), then
  // apply the header scope as the sole source of site and date range.
  const rawApiParams = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) =>
      v !== undefined && (!Array.isArray(v) || v.length > 0)
    )
  );
  const apiParams = applyReportScope(rawApiParams, {
    selectedLocationId,
    dateRange,
  });
  const creditApiParams = applyReportScope(rawApiParams, {
    selectedLocationId: credit.selectedSiteId,
    dateRange,
  });

  const [cashControls, setCashControls] = useState<CashControls>(DEFAULT_CASH_CONTROLS);
  const comparisonLocations = catalogos?.comparisonLocations ?? [];
  const comparisonSiteParams = effectiveViewMode === "comparar"
    ? buildComparisonScopeParams(
        rawApiParams,
        comparisonLocations.map((site) => site.id),
        dateRange,
      )
    : [];
  const comparisonFrames: ReportComparisonFrame[] =
    effectiveViewMode === "comparar"
      ? comparisonLocations.map((site, index) => ({
          siteId: site.id,
          siteLabel: site.label,
          apiParams: comparisonSiteParams[index],
        }))
      : [];
  const creditComparisonFrames = comparisonFrames.filter((frame) =>
    credit.stores.some((site) => site.id === frame.siteId));

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      predicate: ({ queryKey }) => {
        const root = queryKey[0];
        if (typeof root !== "string") return false;
        return (
          root === "reportes" ||
          root.startsWith("/api/reportes/") ||
          root.startsWith("/api/admin/comparacion-tiendas") ||
          root.startsWith("/api/admin/diferencias")
        );
      },
    });
  };

  const handleModeChange = (nextMode: string) => {
    if (nextMode !== "normal" && nextMode !== "comparar") return;
    if (nextMode === "comparar" && !canCompare) return;
    const params = new URLSearchParams(searchString);
    params.delete("ubicacionIds");
    params.delete("ubicacionId");
    params.delete("tab");
    if (nextMode === "comparar") params.set("modo", "comparar");
    else params.delete("modo");
    const nextSearch = params.toString();
    setLocation(`/reportes/${activeTab}${nextSearch ? `?${nextSearch}` : ""}`);
  };

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchString);
    params.delete("ubicacionIds");
    params.delete("ubicacionId");
    const nextSearch = params.toString();
    setLocation(`/reportes/${value}${nextSearch ? `?${nextSearch}` : ""}`);
  };

  const handleDownload = async (format: "xlsx" | "pdf") => {
    if (!isDateRangeValid || (activeTab === "clientes" && (!credit.ready || (effectiveViewMode === "comparar" && (credit.loadingStores || creditComparisonFrames.length === 0))))) return;
    const params = new URLSearchParams(
      buildReportExportParams(
        activeTab === "clientes" && effectiveViewMode === "comparar"
          ? { ...creditApiParams, ubicacionIds: creditComparisonFrames.map((frame) => frame.siteId) }
          : activeTab === "clientes" ? creditApiParams : apiParams,
        effectiveViewMode, cashControls,
      ),
    );
    setDownloadError(null);
    try {
      const response = await fetch(`/api/reportes/vistas/${encodeURIComponent(activeTab)}/export.${format}?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`La exportación respondió ${response.status}.`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
       anchor.download = `${activeTab}-${effectiveViewMode}.${format}`;
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-sidebar">Reportes y Decisiones</h1>
              <p className="mt-1 text-muted-foreground">
                Análisis consolidados para seguimiento operativo y financiero.
              </p>
            </div>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={handleModeChange}
               disabled={!canCompare}
              aria-label="Modo de vista del reporte"
              className="border rounded-lg p-1 bg-card self-start"
            >
              <ToggleGroupItem value="normal" aria-label="Vista normal" className="px-4">
                Normal
              </ToggleGroupItem>
              <ToggleGroupItem value="comparar" aria-label="Comparar sitios" className="px-4">
                Comparar
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
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

          <div className="space-y-6 animate-in fade-in">
              <ReportFilterBar
                catalogos={catalogos}
                filters={filters}
                onChange={handleFilterChange}
                onRefresh={handleRefresh}
                onDownloadExcel={() => handleDownload("xlsx")}
                onDownloadPdf={() => handleDownload("pdf")}
                 actionsDisabled={!isDateRangeValid || (activeTab === "clientes" && (!credit.ready || (effectiveViewMode === "comparar" && (credit.loadingStores || creditComparisonFrames.length === 0))))}
              />
              {activeTab === "clientes" && credit.selector}
              {activeTab === "clientes" && credit.error && <p role="alert" className="text-sm text-destructive" data-testid="credit-report-scope-error">{credit.error}</p>}

              {downloadError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
                  {downloadError}
                </div>
              )}

               {activeTab === "clientes" && (!credit.ready || (effectiveViewMode === "comparar" && (credit.loadingStores || creditComparisonFrames.length === 0))) ? (
                 <p className="rounded-lg border p-4 text-sm" role="status">{credit.error ?? "Verificando las tiendas autorizadas para el reporte de crédito…"}</p>
               ) : !isDateRangeValid ? (
                <div className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground" data-testid="report-date-range-prompt">
                  Selecciona un rango entre 1900 y 2999, de hasta 100 años, para generar el reporte.
                </div>
              ) : activeTab === "ventas" ? (
                <VentasTab 
                  apiParams={apiParams} 
                  isDateRangeValid={isDateRangeValid} 
                  isGlobal={isGlobalMode} 
                  isAdmin={isAdmin}
                  comparisonMode={viewMode === "comparar"}
                  comparisonFrames={comparisonFrames}
                />
              ) : activeTab === "que-comprar" ? (
                <QueComprarTab 
                  apiParams={apiParams} 
                  isDateRangeValid={isDateRangeValid} 
                  isAdmin={isAdmin}
                  comparisonMode={viewMode === "comparar"}
                  comparisonFrames={comparisonFrames}
                />
              ) : activeTab === "utilidad" ? (
                <UtilidadTab 
                  apiParams={apiParams} 
                  isDateRangeValid={isDateRangeValid}
                  comparisonMode={viewMode === "comparar"}
                  comparisonFrames={comparisonFrames}
                />
              ) : activeTab === "clientes" ? (
                <ClientesTab 
                   apiParams={creditApiParams}
                  isDateRangeValid={isDateRangeValid}
                   comparisonMode={effectiveViewMode === "comparar"}
                   comparisonFrames={creditComparisonFrames}
                />
              ) : activeTab === "control-operativo" ? (
                <ControlOperativoTab 
                  apiParams={apiParams} 
                  isDateRangeValid={isDateRangeValid}
                  selectedLocationId={selectedLocationId}
                  comparisonMode={viewMode === "comparar"}
                  comparisonFrames={comparisonFrames}
                  cashControls={cashControls}
                  onCashControlsChange={setCashControls}
                />
              ) : null}
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}