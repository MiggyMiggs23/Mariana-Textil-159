import { ReportesCatalogos } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText } from "lucide-react";
import { CombinedFilterBar, MultiSelectConfig } from "@/components/shared/combined-filter-bar";

export type FilterState = {
  periodo: string;
  modalidad: "TODO" | "ROLLOS" | "METRAJE";
  desde?: string;
  hasta?: string;
  ubicacionIds: number[];
  productoIds: number[];
  telas: string[];
  colores: string[];
  unidades: string[];
  usuarioIds: number[];
  clienteIds: number[];
  proveedorIds: number[];
  formasPago: string[];
  facturado?: boolean;
};

export const DEFAULT_FILTERS: FilterState = {
  periodo: "mensual",
  modalidad: "TODO",
  ubicacionIds: [],
  productoIds: [],
  telas: [],
  colores: [],
  unidades: [],
  usuarioIds: [],
  clienteIds: [],
  proveedorIds: [],
  formasPago: [],
  facturado: undefined,
};

interface ReportFilterBarProps {
  catalogos?: ReportesCatalogos;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onRefresh: () => void;
  onDownloadExcel?: () => void;
  onDownloadPdf?: () => void;
  actionsDisabled?: boolean;
}

export function ReportFilterBar({
  catalogos,
  filters,
  onChange,
  onRefresh,
  onDownloadExcel,
  onDownloadPdf,
  actionsDisabled = false,
}: ReportFilterBarProps) {
  const isCustom = filters.periodo === "personalizado";

  const handlePeriodoChange = (val: string) => {
    onChange({ ...filters, periodo: val });
  };

  const handleFacturadoChange = (val: string) => {
    let facturado: boolean | undefined = undefined;
    if (val === "facturado") facturado = true;
    if (val === "nota") facturado = false;
    onChange({ ...filters, facturado });
  };

  const clearAll = () => {
    onChange(DEFAULT_FILTERS);
  };

  const multiSelects: MultiSelectConfig[] = catalogos
    ? [
        {
          key: "ubicacionIds",
          label: "Sitios",
          options: (catalogos.sites || []).map((s) => ({ id: s.id, nombre: s.label })),
          selected: filters.ubicacionIds.map(String),
        },
        {
          key: "productoIds",
          label: "Productos",
          options: (catalogos.products || []).map((p) => ({ id: p.id, nombre: p.label })),
          selected: filters.productoIds.map(String),
        },
        {
          key: "telas",
          label: "Telas",
          options: (catalogos.fabrics || []).map((t) => ({ id: t, nombre: t })),
          selected: filters.telas,
        },
        {
          key: "colores",
          label: "Colores",
          options: (catalogos.colors || []).map((c) => ({ id: c, nombre: c })),
          selected: filters.colores,
        },
        {
          key: "unidades",
          label: "Unidades",
          options: (catalogos.units || []).map((u) => ({ id: u, nombre: u })),
          selected: filters.unidades,
        },
        {
          key: "usuarioIds",
          label: "Usuarios",
          options: (catalogos.users || []).map((u) => ({ id: u.id, nombre: u.label })),
          selected: filters.usuarioIds.map(String),
        },
        {
          key: "clienteIds",
          label: "Clientes",
          options: (catalogos.clients || []).map((c) => ({ id: c.id, nombre: c.label })),
          selected: filters.clienteIds.map(String),
        },
        {
          key: "proveedorIds",
          label: "Proveedores",
          options: (catalogos.suppliers || []).map((p) => ({ id: p.id, nombre: p.label })),
          selected: filters.proveedorIds.map(String),
        },
        {
          key: "formasPago",
          label: "Métodos",
          options: (catalogos.paymentMethods || []).map((m) => ({ id: m, nombre: m })),
          selected: filters.formasPago,
        },
      ]
    : [];

  const handleMultiSelectChange = (key: string, selected: string[]) => {
    if (key.endsWith("Ids")) {
      onChange({ ...filters, [key]: selected.map(Number) });
    } else {
      onChange({ ...filters, [key]: selected });
    }
  };

  const extraChips = [
    ...(filters.modalidad !== "TODO"
      ? [{
          key: "modalidad",
          label: "Modalidad",
          value: filters.modalidad === "ROLLOS" ? "Solo rollos" : "Solo metraje",
          onRemove: () => onChange({ ...filters, modalidad: "TODO" as const }),
        }]
      : []),
    ...(filters.facturado !== undefined
      ? [{
          key: "facturado",
          label: "Comprobante",
          value: filters.facturado ? "Facturado" : "Público Gral.",
          onRemove: () => onChange({ ...filters, facturado: undefined }),
        }]
      : []),
  ];

  const prefixControls = (
    <Select value={filters.periodo} onValueChange={handlePeriodoChange}>
      <SelectTrigger className="w-full lg:w-[160px] h-9 bg-background font-medium" data-testid="filter-periodo">
        <SelectValue placeholder="Periodo" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="diario">Hoy</SelectItem>
        <SelectItem value="semanal">Esta Semana</SelectItem>
        <SelectItem value="mensual">Este Mes</SelectItem>
        <SelectItem value="trimestral">Este Trimestre</SelectItem>
        <SelectItem value="semestral">Este Semestre</SelectItem>
        <SelectItem value="anual">Este Año</SelectItem>
        <SelectItem value="personalizado">Personalizado</SelectItem>
      </SelectContent>
    </Select>
  );

  const suffixControls = (
    <>
      <Select
        value={filters.modalidad}
        onValueChange={(modalidad: "TODO" | "ROLLOS" | "METRAJE") => onChange({ ...filters, modalidad })}
      >
        <SelectTrigger className="w-full lg:w-[150px] h-9 bg-background" data-testid="filter-modalidad">
          <SelectValue placeholder="Modalidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODO">Todo</SelectItem>
          <SelectItem value="ROLLOS">Solo rollos</SelectItem>
          <SelectItem value="METRAJE">Solo metraje</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.facturado === undefined ? "todos" : filters.facturado ? "facturado" : "nota"}
        onValueChange={handleFacturadoChange}
      >
        <SelectTrigger className="w-full lg:w-[140px] h-9 bg-background" data-testid="filter-facturado">
          <SelectValue placeholder="Comprobante" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todo</SelectItem>
          <SelectItem value="facturado">Facturado</SelectItem>
          <SelectItem value="nota">Público Gral.</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  const actions = (
    <>
      {onDownloadPdf && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadPdf}
          disabled={actionsDisabled}
          className="h-9 gap-1.5 flex"
          data-testid="download-pdf"
        >
          <FileText className="w-4 h-4 text-red-500" /> <span className="hidden xl:inline">PDF</span>
        </Button>
      )}
      {onDownloadExcel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadExcel}
          disabled={actionsDisabled}
          className="h-9 gap-1.5 flex"
          data-testid="download-excel"
        >
          <Download className="w-4 h-4 text-green-600" /> <span className="hidden xl:inline">Excel</span>
        </Button>
      )}
    </>
  );

  return (
    <CombinedFilterBar
      multiSelects={multiSelects}
      onMultiSelectChange={handleMultiSelectChange}
      showDateRange={isCustom}
      desde={filters.desde}
      hasta={filters.hasta}
      onDateRangeChange={(desde, hasta) => onChange({ ...filters, desde, hasta })}
      prefixControls={prefixControls}
      suffixControls={suffixControls}
      actions={actions}
      onClearAll={clearAll}
      extraChips={extraChips}
    />
  );
}
