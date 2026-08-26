import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
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
  exportContenedoresXlsx
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportTable } from "@/components/reportes/report-table";
import { ReportCharts } from "@/components/reportes/report-charts";
import { ReporteTable, ReporteChart } from "@workspace/api-client-react";
import { ProductCombobox } from "@/components/product-combobox";
import { formatNumber } from "@workspace/number-format";
import { Ship, Plus, Search, Calendar, MapPin, Loader2, ArrowRight, Download, FileText, AlertCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

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

        {/* Resumen Section */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border">
            <div className="flex items-center gap-3">
              <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map(offset => {
                    const y = new Date().getFullYear() - offset;
                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                  })}
                </SelectContent>
              </Select>

              <Select value={selectedSemester} onValueChange={v => {
                setSelectedSemester(v);
                if (v !== "all") setSelectedQuarter("all");
              }}>
                <SelectTrigger className="w-36 bg-background">
                  <SelectValue placeholder="Semestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el año</SelectItem>
                  <SelectItem value="1">1er Semestre</SelectItem>
                  <SelectItem value="2">2do Semestre</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedQuarter} onValueChange={v => {
                setSelectedQuarter(v);
                if (v !== "all") setSelectedSemester("all");
              }}>
                <SelectTrigger className="w-36 bg-background">
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

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExporting}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={isExporting}>
                <Download className="w-4 h-4 mr-2" /> Excel
              </Button>
            </div>
          </div>

          {isResumenLoading ? (
            <div className="h-32 flex items-center justify-center border rounded-xl bg-card">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : resumen ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-sidebar to-sidebar/90 text-white shadow-md border-0 lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                      <p className="text-sidebar-foreground/80 text-sm font-medium">En Tránsito</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-black">{resumen.actual.enTransito}</span>
                        <span className="text-sidebar-foreground/70 text-sm font-medium mb-1">contenedores</span>
                      </div>
                      {resumen.actual.retrasados > 0 && (
                        <div className="mt-4 inline-flex items-center text-xs font-bold bg-destructive/20 text-red-200 px-2 py-1 rounded-md">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {resumen.actual.retrasados} con retraso
                        </div>
                      )}
                    </div>
                    {resumen.actual.proximo && (
                      <div className="bg-sidebar-accent/50 rounded-lg p-3 text-sm md:text-right border border-sidebar-accent">
                        <p className="text-sidebar-foreground/70 text-xs uppercase font-bold tracking-wider mb-1">Próximo en llegar</p>
                        <p className="font-semibold">{resumen.actual.proximo.proveedor}</p>
                        <p className="text-sidebar-foreground/80">Llegada: {format(parseISO(resumen.actual.proximo.fechaEstimadaLlegada), "d MMM yyyy", { locale: es })}</p>
                        <p className="text-sidebar-foreground/60 text-xs">Folio #{String(resumen.actual.proximo.folio).padStart(5, '0')}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm font-medium">Rollos por Llegar</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">{formatNumber(resumen.actual.rollosPorLlegar, { kind: "count" })}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm font-medium">Metros / Kilos por Llegar</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">{formatNumber(Number(resumen.actual.metrosPorLlegar), { kind: "count" })}</span>
                    <span className="text-muted-foreground text-sm font-medium mb-1">m</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2 text-muted-foreground">
                    <span className="text-lg font-semibold">{formatNumber(Number(resumen.actual.kilosPorLlegar), { kind: "count" })}</span>
                    <span className="text-xs font-medium mb-1">kg</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-muted/20 border border-border/50 rounded-xl p-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Resumen del Periodo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contenedores Recibidos</p>
                  <p className="text-xl font-bold">{formatNumber(resumen.periodo.contenedores, { kind: "count" })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Rollos Recibidos</p>
                  <p className="text-xl font-bold">{formatNumber(resumen.periodo.rollos, { kind: "count" })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Metros Recibidos</p>
                  <p className="text-xl font-bold">{formatNumber(Number(resumen.periodo.metros), { kind: "count" })} <span className="text-xs font-normal">m</span></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Kilos Recibidos</p>
                  <p className="text-xl font-bold">{formatNumber(Number(resumen.periodo.kilos), { kind: "count" })} <span className="text-xs font-normal">kg</span></p>
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <p className="text-xs text-muted-foreground mb-1">Días Tránsito Promedio</p>
                  <p className="text-xl font-bold">{resumen.periodo.diasPromedio !== null ? formatNumber(Number(resumen.periodo.diasPromedio), { kind: "count" }) : "-"} <span className="text-xs font-normal">días</span></p>
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <p className="text-xs text-muted-foreground mb-1">Puntualidad</p>
                  <div className="flex gap-2 text-xs font-medium mt-2">
                    <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" title="Antes">A: {resumen.periodo.antes}</span>
                    <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" title="A Tiempo">T: {resumen.periodo.aTiempo}</span>
                    <span className="text-destructive bg-red-50 px-1.5 py-0.5 rounded" title="Retrasados">R: {resumen.periodo.despues}</span>
                  </div>
                </div>
                {isAdmin && resumen.periodo.costoTotal && (
                  <>
                    <div className="col-span-2">
                      <p className="text-xs text-emerald-800/70 mb-1">Costo Total Periodo</p>
                      <p className="text-xl font-mono font-bold text-emerald-700">{formatNumber(Number(resumen.periodo.costoTotal), { kind: "money" })}</p>
                    </div>
                    {resumen.periodo.costoPromedio && (
                      <div className="col-span-2">
                        <p className="text-xs text-emerald-800/70 mb-1">Costo Promedio (Contenedor)</p>
                        <p className="text-xl font-mono font-bold text-emerald-700">{formatNumber(Number(resumen.periodo.costoPromedio), { kind: "money" })}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {charts.length > 0 && (
              <div className="pt-4 grid grid-cols-1 gap-6">
                <ReportCharts charts={charts} />
              </div>
            )}

            {tables.length > 0 && (
              <div className="pt-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
                {tables.map(t => (
                  <div key={t.id} className={`min-w-0 ${t.id === "prov-table" ? "xl:col-span-2" : ""}`}>
                    <ReportTable block={t} hasEconomicAccess={isAdmin} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
        </div>

        {/* List Section */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ListTab); setPage(1); }} className="w-full md:w-auto">
                <TabsList className="w-full md:w-auto grid grid-cols-3 bg-muted/50 p-1">
                  <TabsTrigger value={EstadoContenedor.EN_TRANSITO} className="rounded-md">En Tránsito</TabsTrigger>
                  <TabsTrigger value={EstadoContenedor.RECIBIDO} className="rounded-md">Recibidos</TabsTrigger>
                  <TabsTrigger value="TODOS" className="rounded-md">Todos</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proveedor, ref..."
                  className="pl-9 bg-background border-muted-foreground/20 focus-visible:ring-sidebar"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-muted/20 p-2 rounded-lg border border-border/50">
              <Select value={filterProveedorId} onValueChange={v => { setFilterProveedorId(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-background">
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
                <SelectTrigger className="w-[160px] h-8 text-xs bg-background">
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
                  className="h-8 text-xs w-[130px] bg-background"
                  value={filterFechaDesde}
                  onChange={e => { setFilterFechaDesde(e.target.value); setPage(1); }}
                />
                <span className="text-xs text-muted-foreground">-</span>
                <Input
                  type="date"
                  className="h-8 text-xs w-[130px] bg-background"
                  value={filterFechaHasta}
                  onChange={e => { setFilterFechaHasta(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          </div>

          <Card className="shadow-sm overflow-hidden border-border/50">
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[100px] font-semibold">Folio</TableHead>
                    <TableHead className="font-semibold">Proveedor / Ref</TableHead>
                    <TableHead className="font-semibold">Destino</TableHead>
                    <TableHead className="font-semibold">Llegada Est.</TableHead>
                    <TableHead className="text-right font-semibold">Líneas</TableHead>
                    <TableHead className="text-right font-semibold">Rollos</TableHead>
                    <TableHead className="text-right font-semibold">Metros</TableHead>
                    <TableHead className="text-right font-semibold">Kilos</TableHead>
                    {isAdmin && <TableHead className="text-right font-semibold">Costo Total</TableHead>}
                    <TableHead className="text-center font-semibold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isListLoading ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 10 : 9} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : listResult?.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 10 : 9} className="h-32 text-center text-muted-foreground">
                        No se encontraron contenedores.
                      </TableCell>
                    </TableRow>
                  ) : (
                    listResult?.items.map(item => {
                      const isOverdue = item.estado === EstadoContenedor.EN_TRANSITO && item.diasParaLlegar < 0;
                      const isUrgent = item.estado === EstadoContenedor.EN_TRANSITO && item.diasParaLlegar >= 0 && item.diasParaLlegar <= 7;

                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-muted/40 transition-colors group"
                          onClick={() => setLocation(`/contenedores/${item.id}`)}
                        >
                          <TableCell className="font-mono font-semibold text-sidebar">#{item.folio.toString().padStart(5, '0')}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{item.proveedor}</div>
                            {item.referencia && <div className="text-xs text-muted-foreground font-medium">{item.referencia}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm font-medium">
                              <MapPin className="w-3 h-3 mr-1.5 opacity-40" />
                              {item.sitioDestino}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-sm",
                                isOverdue ? "text-destructive font-bold" :
                                isUrgent ? "text-amber-600 font-bold" : "font-medium"
                              )}>
                                {format(parseISO(item.fechaEstimadaLlegada), "d MMM yyyy", { locale: es })}
                              </span>
                              {item.estado === EstadoContenedor.EN_TRANSITO && (
                                <span className={cn(
                                  "text-[10px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wider",
                                  isOverdue ? "bg-destructive/10 text-destructive" :
                                  isUrgent ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                                )}>
                                  {item.diasParaLlegar < 0 ? `Retraso ${Math.abs(item.diasParaLlegar)}d` : `${item.diasParaLlegar}d`}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.lineas}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(item.totales.rollos, { kind: "count" })}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(Number(item.totales.metros), { kind: "count" })}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(Number(item.totales.kilos), { kind: "count" })}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right font-mono text-emerald-600 font-medium">
                              {item.costoTotal ? formatNumber(Number(item.costoTotal), { kind: "money" }) : "-"}
                            </TableCell>
                          )}
                          <TableCell className="text-center">
                            <span className={cn(
                              "inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold",
                              item.estado === EstadoContenedor.EN_TRANSITO && "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/20",
                              item.estado === EstadoContenedor.RECIBIDO && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-400/20",
                              item.estado === EstadoContenedor.CANCELADO && "bg-gray-50 text-gray-700 ring-1 ring-gray-600/20 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-400/20"
                            )}>
                              {item.estado.replace("_", " ")}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

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