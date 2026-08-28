import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useListContenedores,
  getListContenedoresQueryKey,
  useGetResumenContenedores,
  getGetResumenContenedoresQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  useGetCatalogosContenedores,
  getGetCatalogosContenedoresQueryKey,
  EstadoContenedor,
  exportContenedoresPdf,
  exportContenedoresXlsx,
  ContenedorListItem,
  ReporteTable,
  ReporteChart
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportTable } from "@/components/reportes/report-table";
import { ReportCharts } from "@/components/reportes/report-charts";
import { ProductCombobox } from "@/components/product-combobox";
import { formatNumber } from "@workspace/number-format";
import { Ship, Plus, Search, Calendar, MapPin, Loader2, ArrowRight, Download, FileText, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ListTab = EstadoContenedor | "TODOS";

export default function Contenedores() {
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const isAdmin = user?.rol === "ADMIN";
  const canCreate = user?.permisos?.find(p => p.modulo === "contenedores")?.puedeCrear || isAdmin;

  const [activeTab, setActiveTab] = useState<ListTab>(EstadoContenedor.EN_TRANSITO);
  const [search, setSearch] = useState("");
  const [filterProveedorId, setFilterProveedorId] = useState<string>("all");
  const [filterSitioId, setFilterSitioId] = useState<string>("all");
  const [filterProductoId, setFilterProductoId] = useState<string>("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [, setLocation] = useLocation();

  const { data: catalogos } = useGetCatalogosContenedores({
    query: { queryKey: getGetCatalogosContenedoresQueryKey() }
  });

  const { data: listResult, isLoading: isListLoading } = useListContenedores({
    estado: activeTab === "TODOS" ? undefined : activeTab,
    search: search.length >= 2 ? search : undefined,
    proveedorId: filterProveedorId !== "all" ? Number(filterProveedorId) : undefined,
    sitioDestinoId: filterSitioId !== "all" ? Number(filterSitioId) : undefined,
    productoId: filterProductoId ? Number(filterProductoId) : undefined,
    fechaDesde: filterFechaDesde || undefined,
    fechaHasta: filterFechaHasta || undefined,
    page,
    pageSize: 20
  }, {
    query: {
      queryKey: getListContenedoresQueryKey({
        estado: activeTab === "TODOS" ? undefined : activeTab,
        search: search.length >= 2 ? search : undefined,
        proveedorId: filterProveedorId !== "all" ? Number(filterProveedorId) : undefined,
        sitioDestinoId: filterSitioId !== "all" ? Number(filterSitioId) : undefined,
        productoId: filterProductoId ? Number(filterProductoId) : undefined,
        fechaDesde: filterFechaDesde || undefined,
        fechaHasta: filterFechaHasta || undefined,
        page,
        pageSize: 20
      })
    }
  });

  const resumenParams = useMemo(() => {
    return {
      year: selectedYear,
      quarter: selectedQuarter !== "all" ? Number(selectedQuarter) : undefined,
      semester: selectedSemester !== "all" ? Number(selectedSemester) : undefined
    };
  }, [selectedYear, selectedQuarter, selectedSemester]);

  const { data: resumen, isLoading: isResumenLoading } = useGetResumenContenedores(resumenParams, {
    query: { queryKey: getGetResumenContenedoresQueryKey(resumenParams) }
  });

  const { charts, tables } = useMemo(() => {
    if (!resumen) return { charts: [], tables: [] };

    const mesChart: ReporteChart = {
      id: "mes-chart",
      title: "Costo por Mes",
      type: "bar",
      categoryKey: "mes",
      series: [{ key: "costoActual", label: "Costo Actual", kind: "money" }, { key: "costoAnioAnterior", label: "Año Anterior", kind: "money" }],
      rows: resumen.porMes.map(m => ({
        mes: format(new Date(2024, m.mes - 1, 1), "MMM", { locale: es }),
        costoActual: Number(m.costoActual || 0),
        costoAnioAnterior: Number(m.costoAnioAnterior || 0)
      }))
    };

    const provTable: ReporteTable = {
      id: "prov-table",
      title: "Desempeño por Proveedor",
      columns: [
        { key: "proveedor", label: "Proveedor", kind: "text" },
        { key: "contenedores", label: "Contenedores", kind: "count" },
        { key: "rollos", label: "Rollos", kind: "count" },
        { key: "metros", label: "Metros", kind: "count" },
        { key: "kilos", label: "Kilos", kind: "count" },
        { key: "diasPromedioTransito", label: "Días Promedio", kind: "count" }
      ],
      rows: resumen.porProveedor.map(p => ({
        proveedor: p.proveedor,
        contenedores: p.contenedores,
        rollos: p.rollos,
        metros: Number(p.metros),
        kilos: Number(p.kilos),
        diasPromedioTransito: p.diasPromedioTransito ? Number(p.diasPromedioTransito) : null,
        costoTotal: p.costoTotal ? Number(p.costoTotal) : null
      })),
      totals: {
        proveedor: "Totales",
        contenedores: resumen.porProveedor.reduce((a, b) => a + b.contenedores, 0),
        rollos: resumen.porProveedor.reduce((a, b) => a + b.rollos, 0),
        metros: resumen.porProveedor.reduce((a, b) => a + Number(b.metros), 0),
        kilos: resumen.porProveedor.reduce((a, b) => a + Number(b.kilos), 0),
        costoTotal: resumen.porProveedor.reduce((a, b) => a + Number(b.costoTotal || 0), 0)
      }
    };
    if (isAdmin) {
      provTable.columns.push({ key: "costoTotal", label: "Costo Total", kind: "money", economic: true });
    }

    const prodTable: ReporteTable = {
      id: "prod-table",
      title: "Desempeño por Producto",
      columns: [
        { key: "sku", label: "SKU", kind: "text" },
        { key: "telaColor", label: "Producto", kind: "text" },
        { key: "contenedores", label: "Contenedores", kind: "count" },
        { key: "rollos", label: "Rollos", kind: "count" },
        { key: "cantidad", label: "Cantidad", kind: "count" }
      ],
      rows: resumen.porProducto.map(p => ({
        sku: p.sku,
        telaColor: `${p.tela} - ${p.color}`,
        contenedores: p.contenedores,
        rollos: p.rollos,
        cantidad: Number(p.cantidad),
        costoUnitarioReal: p.costoUnitarioReal ? Number(p.costoUnitarioReal) : null,
        costoTotal: p.costoTotal ? Number(p.costoTotal) : null
      })),
      totals: {}
    };
    if (isAdmin) {
      if (resumen.porProducto.some(p => p.costoUnitarioReal !== undefined && p.costoUnitarioReal !== null)) {
        prodTable.columns.push({ key: "costoUnitarioReal", label: "Costo Unitario", kind: "money", economic: true });
      }
      prodTable.columns.push({ key: "costoTotal", label: "Costo Total", kind: "money", economic: true });
    }

    const diffTable: ReporteTable = {
      id: "diff-table",
      title: "Diferencias Detectadas",
      columns: [
        { key: "sku", label: "SKU", kind: "text" },
        { key: "telaColor", label: "Producto", kind: "text" },
        { key: "esperado", label: "Esperado", kind: "count" },
        { key: "recibido", label: "Recibido", kind: "count" },
        { key: "diff", label: "Diferencia", kind: "count" }
      ],
      rows: resumen.diferencias.map(d => ({
        sku: d.sku,
        telaColor: `${d.tela} - ${d.color}`,
        esperado: Number(d.esperado),
        recibido: Number(d.recibido),
        diff: Number(d.recibido) - Number(d.esperado)
      })),
      totals: {}
    };

    const telaTable: ReporteTable = {
      id: "tela-table",
      title: "Resumen por Tela",
      columns: [
        { key: "tela", label: "Tela", kind: "text" },
        { key: "contenedores", label: "Contenedores", kind: "count" },
        { key: "rollos", label: "Rollos", kind: "count" },
        { key: "metros", label: "Metros", kind: "count" },
        { key: "kilos", label: "Kilos", kind: "count" }
      ],
      rows: resumen.porTela.map(t => ({
        tela: t.tela || "N/A",
        contenedores: t.contenedores,
        rollos: t.rollos,
        metros: Number(t.metros),
        kilos: Number(t.kilos),
        costoUnitarioReal: t.costoUnitarioReal ? Number(t.costoUnitarioReal) : null,
        costoTotal: t.costoTotal ? Number(t.costoTotal) : null
      })),
      totals: {}
    };
    if (isAdmin) {
      if (resumen.porTela.some(t => t.costoUnitarioReal !== undefined && t.costoUnitarioReal !== null)) {
        telaTable.columns.push({ key: "costoUnitarioReal", label: "Costo Promedio", kind: "money", economic: true });
      }
      telaTable.columns.push({ key: "costoTotal", label: "Costo Total", kind: "money", economic: true });
    }

    const colorTable: ReporteTable = {
      id: "color-table",
      title: "Resumen por Color",
      columns: [
        { key: "color", label: "Color", kind: "text" },
        { key: "contenedores", label: "Contenedores", kind: "count" },
        { key: "rollos", label: "Rollos", kind: "count" },
        { key: "metros", label: "Metros", kind: "count" },
        { key: "kilos", label: "Kilos", kind: "count" }
      ],
      rows: resumen.porColor.map(t => ({
        color: t.color || "N/A",
        contenedores: t.contenedores,
        rollos: t.rollos,
        metros: Number(t.metros),
        kilos: Number(t.kilos),
        costoUnitarioReal: t.costoUnitarioReal ? Number(t.costoUnitarioReal) : null,
        costoTotal: t.costoTotal ? Number(t.costoTotal) : null
      })),
      totals: {}
    };
    if (isAdmin) {
      if (resumen.porColor.some(t => t.costoUnitarioReal !== undefined && t.costoUnitarioReal !== null)) {
        colorTable.columns.push({ key: "costoUnitarioReal", label: "Costo Promedio", kind: "money", economic: true });
      }
      colorTable.columns.push({ key: "costoTotal", label: "Costo Total", kind: "money", economic: true });
    }

    const allCharts: ReporteChart[] = [];
    if (isAdmin) allCharts.push(mesChart);

    // Proveedor charts
    const provMetros = resumen.porProveedor.map(p => ({ proveedor: p.proveedor, metros: Number(p.metros) })).filter(p => p.metros > 0);
    if (provMetros.length > 0) {
      allCharts.push({
        id: "prov-chart-metros",
        title: "Metros por Proveedor",
        type: "bar",
        categoryKey: "proveedor",
        series: [{ key: "metros", label: "Metros (m)", kind: "count" }],
        rows: provMetros
      });
    }

    const provKilos = resumen.porProveedor.map(p => ({ proveedor: p.proveedor, kilos: Number(p.kilos) })).filter(p => p.kilos > 0);
    if (provKilos.length > 0) {
      allCharts.push({
        id: "prov-chart-kilos",
        title: "Kilos por Proveedor",
        type: "bar",
        categoryKey: "proveedor",
        series: [{ key: "kilos", label: "Kilos (kg)", kind: "count" }],
        rows: provKilos
      });
    }

    // Tela charts
    const telaMetros = resumen.porTela.map(t => ({ tela: t.tela || "N/A", metros: Number(t.metros) })).filter(t => t.metros > 0);
    if (telaMetros.length > 0) {
      allCharts.push({
        id: "tela-chart-metros",
        title: "Metros por Tela",
        type: "bar",
        categoryKey: "tela",
        series: [{ key: "metros", label: "Metros (m)", kind: "count" }],
        rows: telaMetros
      });
    }

    const telaKilos = resumen.porTela.map(t => ({ tela: t.tela || "N/A", kilos: Number(t.kilos) })).filter(t => t.kilos > 0);
    if (telaKilos.length > 0) {
      allCharts.push({
        id: "tela-chart-kilos",
        title: "Kilos por Tela",
        type: "bar",
        categoryKey: "tela",
        series: [{ key: "kilos", label: "Kilos (kg)", kind: "count" }],
        rows: telaKilos
      });
    }

    // Color charts
    const colorMetros = resumen.porColor.map(c => ({ color: c.color || "N/A", metros: Number(c.metros) })).filter(c => c.metros > 0);
    if (colorMetros.length > 0) {
      allCharts.push({
        id: "color-chart-metros",
        title: "Metros por Color",
        type: "bar",
        categoryKey: "color",
        series: [{ key: "metros", label: "Metros (m)", kind: "count" }],
        rows: colorMetros
      });
    }

    const colorKilos = resumen.porColor.map(c => ({ color: c.color || "N/A", kilos: Number(c.kilos) })).filter(c => c.kilos > 0);
    if (colorKilos.length > 0) {
      allCharts.push({
        id: "color-chart-kilos",
        title: "Kilos por Color",
        type: "bar",
        categoryKey: "color",
        series: [{ key: "kilos", label: "Kilos (kg)", kind: "count" }],
        rows: colorKilos
      });
    }

    return { charts: allCharts, tables: [provTable, prodTable, telaTable, colorTable, diffTable] };
  }, [resumen, isAdmin]);

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      const blob = await exportContenedoresPdf(resumenParams as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contenedores_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Error al exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXlsx = async () => {
    try {
      setIsExporting(true);
      const blob = await exportContenedoresXlsx(resumenParams as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contenedores_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Error al exportar Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const sortedItems = useMemo(() => {
    if (!listResult?.items) return [];
    if (activeTab === EstadoContenedor.EN_TRANSITO) {
      return [...listResult.items].sort((a, b) => new Date(a.fechaEstimadaLlegada).getTime() - new Date(b.fechaEstimadaLlegada).getTime());
    }
    return listResult.items;
  }, [listResult?.items, activeTab]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sidebar">Próximos Contenedores</h1>
            <p className="text-muted-foreground mt-1">
              Control y seguimiento de mercancía en tránsito.
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setLocation("/contenedores/nuevo")} className="shrink-0 bg-sidebar hover:bg-sidebar/90 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Contenedor
            </Button>
          )}
        </div>

        {/* Filters & Export Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-white dark:bg-card border border-border/60 rounded-lg p-1 flex items-center shadow-sm">
              <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-24 h-8 border-0 bg-transparent shadow-none focus:ring-0 font-bold text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map(offset => {
                    const y = new Date().getFullYear() - offset;
                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <div className="w-px h-4 bg-border mx-1"></div>
              <Select value={selectedSemester} onValueChange={v => {
                setSelectedSemester(v);
                if (v !== "all") setSelectedQuarter("all");
              }}>
                <SelectTrigger className="w-32 h-8 border-0 bg-transparent shadow-none focus:ring-0 font-medium text-sm">
                  <SelectValue placeholder="Semestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el año</SelectItem>
                  <SelectItem value="1">1er Semestre</SelectItem>
                  <SelectItem value="2">2do Semestre</SelectItem>
                </SelectContent>
              </Select>
              <div className="w-px h-4 bg-border mx-1"></div>
              <Select value={selectedQuarter} onValueChange={v => {
                setSelectedQuarter(v);
                if (v !== "all") setSelectedSemester("all");
              }}>
                <SelectTrigger className="w-32 h-8 border-0 bg-transparent shadow-none focus:ring-0 font-medium text-sm">
                  <SelectValue placeholder="Trimestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los trim.</SelectItem>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExporting} className="h-9 font-semibold text-xs border-border/60 bg-card shadow-sm hover:bg-muted/50">
              <FileText className="w-4 h-4 mr-2 text-report-negative" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={isExporting} className="h-9 font-semibold text-xs border-border/60 bg-card shadow-sm hover:bg-muted/50">
              <Download className="w-4 h-4 mr-2 text-report-positive" /> Excel
            </Button>
          </div>
        </div>

        {/* Dashboard Indicators */}
        {isResumenLoading ? (
          <div className="h-32 flex items-center justify-center border border-border/60 rounded-xl bg-card">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : resumen ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-report-header text-report-header-foreground border-0 shadow-md">
                <CardContent className="p-5 flex flex-col justify-center h-full">
                  <p className="text-report-header-foreground/70 text-sm font-semibold uppercase tracking-wider mb-1">En Tránsito</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black">{resumen.actual.enTransito}</span>
                    <span className="text-report-header-foreground/60 text-sm font-medium">contenedores</span>
                  </div>
                  {resumen.actual.retrasados > 0 && (
                    <div className="mt-3 inline-flex items-center text-[10px] font-bold bg-report-negative text-white px-2 py-1 rounded-sm w-fit uppercase tracking-wider">
                      <AlertCircle className="w-3 h-3 mr-1.5" />
                      {resumen.actual.retrasados} con retraso
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm relative overflow-hidden bg-card hover:border-report-modality-rollos/50 transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-report-modality-rollos"></div>
                <CardContent className="p-5 flex flex-col justify-center h-full pl-6">
                  <p className="text-report-text-muted text-xs font-bold uppercase tracking-wider mb-1">Rollos por Llegar</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground tracking-tight">{formatNumber(resumen.actual.rollosPorLlegar, { kind: "count" })}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm relative overflow-hidden bg-card hover:border-report-modality-metraje/50 transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-report-modality-metraje"></div>
                <CardContent className="p-5 flex flex-col justify-center h-full pl-6">
                  <p className="text-report-text-muted text-xs font-bold uppercase tracking-wider mb-1">Metros por Llegar</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground tracking-tight">{formatNumber(Number(resumen.actual.metrosPorLlegar), { kind: "count" })}</span>
                    <span className="text-muted-foreground font-medium">m</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm relative overflow-hidden bg-card hover:border-report-accent-warm/50 transition-colors">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-report-accent-warm"></div>
                <CardContent className="p-5 flex flex-col justify-center h-full pl-6">
                  <p className="text-report-text-muted text-xs font-bold uppercase tracking-wider mb-1">Kilos por Llegar</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground tracking-tight">{formatNumber(Number(resumen.actual.kilosPorLlegar), { kind: "count" })}</span>
                    <span className="text-muted-foreground font-medium">kg</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {resumen.actual.proximo && (
              <div className="bg-report-accent-warm-bg border border-report-accent-warm/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-report-accent-warm/5 rounded-full -translate-y-16 translate-x-12 blur-2xl pointer-events-none"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="bg-report-accent-warm/20 text-report-accent-warm p-2.5 rounded-lg border border-report-accent-warm/20">
                    <Ship className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-report-accent-warm text-xs font-bold uppercase tracking-wider">Siguiente Arribo</p>
                      <span className="bg-report-accent-warm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase">
                        Falta{resumen.actual.proximo.dias === 1 ? '' : 'n'} {resumen.actual.proximo.dias} día{resumen.actual.proximo.dias === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-foreground">
                      {resumen.actual.proximo.proveedor}
                      <span className="text-muted-foreground ml-2 font-mono text-sm">Folio #{String(resumen.actual.proximo.folio).padStart(5, '0')}</span>
                    </p>
                  </div>
                </div>
                <div className="sm:text-right relative z-10 bg-white/50 dark:bg-black/20 p-2.5 rounded-lg border border-border/50">
                  <p className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-0.5">Fecha Estimada</p>
                  <p className="text-sm font-bold text-foreground flex items-center sm:justify-end gap-1.5">
                    <Calendar className="w-3.5 h-3.5 opacity-60" />
                    {format(parseISO(resumen.actual.proximo.fechaEstimadaLlegada), "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
              </div>
            )}

            {/* Resumen del Periodo */}
            <div className="bg-report-stripe border border-border/50 rounded-xl p-5 shadow-sm">
              <h3 className="text-[10px] font-bold text-report-header uppercase tracking-wider mb-4">Resumen del Periodo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 xl:gap-6 items-center">
                <div>
                  <p className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-1">Contenedores</p>
                  <p className="text-2xl font-black text-report-header">{formatNumber(resumen.periodo.contenedores, { kind: "count" })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-1">Rollos</p>
                  <p className="text-2xl font-black text-report-modality-rollos">{formatNumber(resumen.periodo.rollos, { kind: "count" })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-1">Metros</p>
                  <p className="text-2xl font-black text-report-modality-metraje">{formatNumber(Number(resumen.periodo.metros), { kind: "count" })} <span className="text-xs font-bold opacity-60">m</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-1">Kilos</p>
                  <p className="text-2xl font-black text-report-accent-warm">{formatNumber(Number(resumen.periodo.kilos), { kind: "count" })} <span className="text-xs font-bold opacity-60">kg</span></p>
                </div>

                <div className="border-l border-border/60 pl-4 md:col-span-2 xl:col-span-2">
                  <p className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-2">Puntualidad</p>
                  <div className="flex gap-1.5 text-xs font-bold">
                    <span className="text-report-positive bg-report-positive/10 px-2 py-1 rounded w-full text-center" title="Antes">A: {resumen.periodo.antes}</span>
                    <span className="text-report-category-blue bg-report-category-blue/10 px-2 py-1 rounded w-full text-center" title="A Tiempo">T: {resumen.periodo.aTiempo}</span>
                    <span className="text-report-negative bg-report-negative/10 px-2 py-1 rounded w-full text-center" title="Retrasados">R: {resumen.periodo.despues}</span>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground mt-1.5 text-center">Tránsito Promedio: {resumen.periodo.diasPromedio !== null ? formatNumber(Number(resumen.periodo.diasPromedio), { kind: "count" }) + " días" : "-"}</p>
                </div>

                {isAdmin && resumen.periodo.costoTotal && (
                  <div className="col-span-2 border-l border-border/60 pl-4">
                    <p className="text-[10px] text-report-positive font-bold uppercase tracking-wider mb-1">Costo Total Periodo</p>
                    <p className="text-xl font-black font-mono text-report-positive">{formatNumber(Number(resumen.periodo.costoTotal), { kind: "money" })}</p>
                    {resumen.periodo.costoPromedio && (
                       <p className="text-[10px] font-semibold text-report-positive/70 mt-1">Promedio: {formatNumber(Number(resumen.periodo.costoPromedio), { kind: "money" })} / cont</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Charts & Tables */}
            {charts.length > 0 && (
              <div className="pt-2 grid grid-cols-1 gap-6">
                <ReportCharts charts={charts} />
              </div>
            )}

            {tables.length > 0 && (
              <div className="pt-2 grid grid-cols-1 xl:grid-cols-2 gap-6">
                {tables.map(t => (
                  <div key={t.id} className={`min-w-0 ${t.id === "prov-table" ? "xl:col-span-2" : ""}`}>
                    <ReportTable block={t} hasEconomicAccess={isAdmin} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* List Section */}
        <div className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-sidebar tracking-tight flex items-center gap-2">
              <Ship className="w-5 h-5 text-report-header" />
              Desglose de Contenedores
            </h2>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-3 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ListTab); setPage(1); }} className="w-full lg:w-auto">
                <TabsList className="grid grid-cols-3 bg-muted/50 p-1 w-full lg:w-[400px]">
                  <TabsTrigger value={EstadoContenedor.EN_TRANSITO} className="rounded-md font-semibold text-xs">En Tránsito</TabsTrigger>
                  <TabsTrigger value={EstadoContenedor.RECIBIDO} className="rounded-md font-semibold text-xs">Recibidos</TabsTrigger>
                  <TabsTrigger value="TODOS" className="rounded-md font-semibold text-xs">Todos</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proveedor, referencia..."
                  className="pl-9 h-9 text-xs bg-background border-border/50 focus-visible:ring-report-header"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/40">
              <Select value={filterProveedorId} onValueChange={v => { setFilterProveedorId(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-background font-medium">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Proveedores</SelectItem>
                  {catalogos?.proveedores.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSitioId} onValueChange={v => { setFilterSitioId(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-background font-medium">
                  <SelectValue placeholder="Sitio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Sitios</SelectItem>
                  {catalogos?.sitios.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="w-[200px]">
                <ProductCombobox
                  products={(catalogos?.productos as any) || []}
                  value={filterProductoId}
                  onValueChange={v => { setFilterProductoId(v); setPage(1); }}
                  placeholder="Filtrar producto..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="h-8 text-xs w-[130px] bg-background font-medium"
                  value={filterFechaDesde}
                  onChange={e => { setFilterFechaDesde(e.target.value); setPage(1); }}
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="date"
                  className="h-8 text-xs w-[130px] bg-background font-medium"
                  value={filterFechaHasta}
                  onChange={e => { setFilterFechaHasta(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>

          {isListLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card border rounded-xl h-40 animate-pulse flex flex-col">
                  <div className="bg-muted/40 h-16 w-full border-b border-border/50"></div>
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted/60 rounded w-1/2"></div>
                    <div className="h-4 bg-muted/60 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="bg-card border border-dashed border-border/60 rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Ship className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Sin contenedores</h3>
              <p className="text-muted-foreground max-w-sm">
                No se encontraron contenedores que coincidan con los filtros aplicados.
              </p>
              {canCreate && (
                <Button onClick={() => setLocation("/contenedores/nuevo")} className="mt-6" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Contenedor
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {sortedItems.map(item => (
                <ContainerBlock key={item.id} item={item} isAdmin={isAdmin} setLocation={setLocation} />
              ))}
            </div>
          )}

          {listResult && listResult.total > listResult.pageSize && (
            <div className="flex justify-center pt-4">
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="outline" disabled={page * listResult.pageSize >= listResult.total} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function ContainerBlock({ item, isAdmin, setLocation }: { item: ContenedorListItem, isAdmin: boolean, setLocation: (path: string) => void }) {
  const isOverdue = item.estado === EstadoContenedor.EN_TRANSITO && item.diasParaLlegar < 0;
  const isUrgent = item.estado === EstadoContenedor.EN_TRANSITO && item.diasParaLlegar >= 0 && item.diasParaLlegar <= 7;

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
      {/* Block Header */}
      <div
        className={cn(
          "px-5 py-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer relative",
          isOverdue ? "bg-report-negative/5 hover:bg-report-negative/10 border-b border-report-negative/20" : "bg-report-stripe/50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-border/50"
        )}
        onClick={() => setLocation(`/contenedores/${item.id}`)}
      >
        {isOverdue && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-report-negative"></div>
        )}

        <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
          <div className="flex flex-col min-w-[80px]">
            <span className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-0.5">Folio</span>
            <span className="font-mono text-lg text-report-header font-black">#{item.folio.toString().padStart(5, '0')}</span>
          </div>

          <div className="hidden md:block h-10 w-px bg-border/60"></div>

          <div className="flex flex-col min-w-[150px]">
            <span className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-0.5">Proveedor</span>
            <span className="font-bold text-foreground text-sm">{item.proveedor}</span>
            {item.referencia ? (
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5 line-clamp-1">{item.referencia}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground/50 italic mt-0.5">Sin referencia</span>
            )}
          </div>

          <div className="hidden md:block h-10 w-px bg-border/60"></div>

          <div className="flex flex-col min-w-[120px]">
            <span className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-0.5">Destino</span>
            <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
              <MapPin className="w-3.5 h-3.5 text-report-category-teal" />
              {item.sitioDestino}
            </span>
          </div>

          <div className="hidden md:block h-10 w-px bg-border/60"></div>

          <div className="flex flex-col min-w-[120px]">
             <span className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-0.5">Estado</span>
             <div className="mt-0.5">
               <span className={cn(
                 "inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                 item.estado === EstadoContenedor.EN_TRANSITO && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                 item.estado === EstadoContenedor.RECIBIDO && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                 item.estado === EstadoContenedor.CANCELADO && "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
               )}>
                 {item.estado.replace("_", " ")}
               </span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-6 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t border-border/50 md:border-0">
          <div className="flex flex-col items-start md:items-end flex-1 md:flex-auto">
            <span className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-0.5">ETA</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-bold font-mono",
                isOverdue ? "text-report-negative" : isUrgent ? "text-report-margin-medium" : "text-foreground"
              )}>
                {format(parseISO(item.fechaEstimadaLlegada), "dd/MMM/yyyy", { locale: es }).toUpperCase()}
              </span>
              {item.estado === EstadoContenedor.EN_TRANSITO && (
                <span className={cn(
                  "text-[10px] uppercase px-1.5 py-0.5 rounded-sm font-black tracking-wider",
                  isOverdue ? "bg-report-negative text-white" :
                  isUrgent ? "bg-report-margin-medium text-white" : "bg-muted text-muted-foreground"
                )}>
                  {item.diasParaLlegar < 0 ? `${Math.abs(item.diasParaLlegar)}d RETRASO` : `${item.diasParaLlegar}d`}
                </span>
              )}
            </div>
          </div>

          {isAdmin && (
            <>
              <div className="hidden sm:block h-10 w-px bg-border/60"></div>
              <div className="flex flex-col items-end hidden sm:flex min-w-[100px]">
                <span className="text-[10px] text-report-text-muted font-bold uppercase tracking-wider mb-0.5">Costo Total</span>
                <span className="font-mono text-sm text-report-positive font-bold">
                  {item.costoTotal ? formatNumber(Number(item.costoTotal), { kind: "money" }) : "PENDIENTE"}
                </span>
              </div>
            </>
          )}

          <div className="bg-white dark:bg-black/20 p-2 rounded-full border shadow-sm group-hover:bg-report-header group-hover:text-white transition-colors group-hover:border-report-header">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Block Products (Lineas) */}
      <div className="p-0 overflow-x-auto custom-scrollbar bg-background">
        {item.lineasCount === 0 ? (
          <div className="p-6 text-center border-t border-border/40">
            <p className="text-sm text-muted-foreground font-medium">Sin productos registrados en el contenedor</p>
          </div>
        ) : (
          <Table className="w-full text-sm">
            <TableHeader className="bg-transparent">
              <TableRow className="hover:bg-transparent border-border/30">
                <TableHead className="py-2.5 h-auto text-[11px] uppercase tracking-wider font-bold text-report-text-muted pl-5 w-32">SKU</TableHead>
                <TableHead className="py-2.5 h-auto text-[11px] uppercase tracking-wider font-bold text-report-text-muted">Producto</TableHead>
                <TableHead className="py-2.5 h-auto text-[11px] uppercase tracking-wider font-bold text-report-text-muted text-right">Cantidad</TableHead>
                <TableHead className="py-2.5 h-auto text-[11px] uppercase tracking-wider font-bold text-report-text-muted text-right pr-5 w-24">Rollos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.lineas.map((linea, idx) => (
                <TableRow key={`${linea.productoId}-${idx}`} className="border-border/10 hover:bg-muted/30 transition-colors">
                  <TableCell className="py-2 pl-5 text-xs font-mono font-medium text-muted-foreground">{linea.sku}</TableCell>
                  <TableCell className="py-2 text-sm font-semibold">
                    {linea.tela} <span className="text-muted-foreground font-medium ml-1">{linea.color}</span>
                    {linea.nota && <span className="ml-3 text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground italic font-normal">{linea.nota}</span>}
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono text-sm font-semibold">
                    {formatNumber(Number(linea.cantidadEsperada), { kind: "count" })}
                    <span className="text-[10px] text-muted-foreground ml-1">{linea.unidad === "METRO" ? "m" : "kg"}</span>
                  </TableCell>
                  <TableCell className="py-2 pr-5 text-right font-mono text-sm font-semibold">
                    {linea.rollosEsperados ? formatNumber(linea.rollosEsperados, { kind: "count" }) : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row for this container */}
              <TableRow className="hover:bg-transparent bg-report-stripe/30 border-t-2 border-border/50">
                <TableCell colSpan={2} className="py-2.5 pr-4 text-right text-[11px] font-bold uppercase tracking-wider text-report-text-muted">Total Contenedor</TableCell>
                <TableCell className="py-2.5 text-right font-mono text-sm font-black text-report-header">
                  {formatNumber(Number(item.totales.metros), { kind: "count" })} <span className="text-[10px] font-semibold text-report-header/60">m</span>
                  <span className="mx-1 text-border">/</span>
                  {formatNumber(Number(item.totales.kilos), { kind: "count" })} <span className="text-[10px] font-semibold text-report-header/60">kg</span>
                </TableCell>
                <TableCell className="py-2.5 pr-5 text-right font-mono text-sm font-black text-report-modality-rollos">
                  {formatNumber(item.totales.rollos, { kind: "count" })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
