import { useState, useMemo } from "react";
import { ReportesCatalogos } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X, ChevronDown, Check, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterState = {
  periodo: string;
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

export function ReportFilterBar({ catalogos, filters, onChange, onRefresh, onDownloadExcel, onDownloadPdf, actionsDisabled = false }: ReportFilterBarProps) {
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

  const activeCount = 
    filters.ubicacionIds.length + 
    filters.productoIds.length + 
    filters.telas.length + 
    filters.colores.length + 
    filters.unidades.length + 
    filters.usuarioIds.length + 
    filters.clienteIds.length + 
    filters.proveedorIds.length + 
    filters.formasPago.length + 
    (filters.facturado !== undefined ? 1 : 0);

  return (
    <div className="space-y-4" data-testid="report-filter-bar">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-card p-3 rounded-lg border shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Period Selector */}
          <Select value={filters.periodo} onValueChange={handlePeriodoChange}>
            <SelectTrigger className="w-[160px] h-9 bg-background font-medium" data-testid="filter-periodo">
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

          {isCustom && (
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border h-9">
              <Input 
                type="date" 
                value={filters.desde || ""} 
                onChange={e => onChange({ ...filters, desde: e.target.value })} 
                className="h-7 text-sm bg-background border-none w-[130px]" 
                data-testid="filter-desde"
              />
              <span className="text-muted-foreground text-sm">-</span>
              <Input 
                type="date" 
                value={filters.hasta || ""} 
                onChange={e => onChange({ ...filters, hasta: e.target.value })} 
                className="h-7 text-sm bg-background border-none w-[130px]" 
                data-testid="filter-hasta"
              />
            </div>
          )}

          <div className="h-6 w-px bg-border mx-1" />

          {/* Facturado Toggle */}
          <Select 
            value={filters.facturado === undefined ? "todos" : filters.facturado ? "facturado" : "nota"} 
            onValueChange={handleFacturadoChange}
          >
            <SelectTrigger className="w-[140px] h-9 bg-background" data-testid="filter-facturado">
              <SelectValue placeholder="Comprobante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo</SelectItem>
              <SelectItem value="facturado">Facturado</SelectItem>
              <SelectItem value="nota">Público Gral.</SelectItem>
            </SelectContent>
          </Select>

          {/* Catalog Multi-Selects */}
          {catalogos && (
            <>
              <MultiSelectFilter 
                label="Sitios" 
                options={(catalogos.sites || []).map(s => ({ id: s.id, nombre: s.label }))} 
                selected={filters.ubicacionIds.map(String)} 
                onChange={(v) => onChange({ ...filters, ubicacionIds: v.map(Number) })} 
              />
              <MultiSelectFilter 
                label="Productos" 
                options={(catalogos.products || []).map(p => ({ id: p.id, nombre: p.label }))} 
                selected={filters.productoIds.map(String)} 
                onChange={(v) => onChange({ ...filters, productoIds: v.map(Number) })} 
              />
              <MultiSelectFilter 
                label="Telas" 
                options={(catalogos.fabrics || []).map(t => ({ id: t, nombre: t }))} 
                selected={filters.telas} 
                onChange={(v) => onChange({ ...filters, telas: v })} 
              />
              <MultiSelectFilter 
                label="Colores" 
                options={(catalogos.colors || []).map(c => ({ id: c, nombre: c }))} 
                selected={filters.colores} 
                onChange={(v) => onChange({ ...filters, colores: v })} 
              />
              <MultiSelectFilter 
                label="Unidades" 
                options={(catalogos.units || []).map(u => ({ id: u, nombre: u }))} 
                selected={filters.unidades} 
                onChange={(v) => onChange({ ...filters, unidades: v })} 
              />
              <MultiSelectFilter 
                label="Usuarios" 
                options={(catalogos.users || []).map(u => ({ id: u.id, nombre: u.label }))} 
                selected={filters.usuarioIds.map(String)} 
                onChange={(v) => onChange({ ...filters, usuarioIds: v.map(Number) })} 
              />
              <MultiSelectFilter 
                label="Clientes" 
                options={(catalogos.clients || []).map(c => ({ id: c.id, nombre: c.label }))} 
                selected={filters.clienteIds.map(String)} 
                onChange={(v) => onChange({ ...filters, clienteIds: v.map(Number) })} 
              />
              <MultiSelectFilter 
                label="Proveedores" 
                options={(catalogos.suppliers || []).map(p => ({ id: p.id, nombre: p.label }))} 
                selected={filters.proveedorIds.map(String)} 
                onChange={(v) => onChange({ ...filters, proveedorIds: v.map(Number) })} 
              />
              <MultiSelectFilter 
                label="Métodos" 
                options={(catalogos.paymentMethods || []).map(m => ({ id: m, nombre: m }))} 
                selected={filters.formasPago} 
                onChange={(v) => onChange({ ...filters, formasPago: v })} 
              />
            </>
          )}

          {/* Active Chips Summary */}
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 ml-2 border-l pl-2">
              <span className="text-xs text-muted-foreground mr-1">Filtros activos: {activeCount}</span>
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" data-testid="filter-clear-all">
                <X className="w-3.5 h-3.5 mr-1" /> Limpiar
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onDownloadPdf && (
            <Button variant="outline" size="sm" onClick={onDownloadPdf} disabled={actionsDisabled} className="h-9 gap-1.5 hidden sm:flex" data-testid="download-pdf">
              <FileText className="w-4 h-4 text-red-500" /> <span className="hidden xl:inline">PDF</span>
            </Button>
          )}
          {onDownloadExcel && (
            <Button variant="outline" size="sm" onClick={onDownloadExcel} disabled={actionsDisabled} className="h-9 gap-1.5 hidden sm:flex" data-testid="download-excel">
              <Download className="w-4 h-4 text-green-600" /> <span className="hidden xl:inline">Excel</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MultiSelectFilter({ 
  label, 
  options, 
  selected, 
  onChange 
}: { 
  label: string; 
  options: { id: number | string; nombre: string }[]; 
  selected: string[]; 
  onChange: (val: string[]) => void 
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(o => o.nombre.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  if (!options || options.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("h-9 border-dashed gap-1.5", selected.length > 0 && "border-solid bg-sidebar/5 border-sidebar/20")}
          data-testid={`filter-btn-${label.toLowerCase()}`}
        >
          <Filter className="w-3.5 h-3.5 opacity-50" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-sm font-mono text-[10px]">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="w-3 h-3 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <div className="p-2 border-b">
          <Input 
            placeholder="Buscar..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="h-8 text-xs"
            data-testid={`filter-search-${label.toLowerCase()}`}
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1 custom-scrollbar">
          {filteredOptions.length === 0 && (
            <div className="p-2 text-center text-xs text-muted-foreground">No hay opciones</div>
          )}
          {filteredOptions.map(opt => {
            const isSelected = selected.includes(String(opt.id));
            return (
              <div 
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted cursor-pointer"
                onClick={() => toggleOption(String(opt.id))}
                data-testid={`filter-opt-${label.toLowerCase()}-${opt.id}`}
              >
                <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center shrink-0", isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input")}>
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
                <span className="truncate">{opt.nombre}</span>
              </div>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="p-2 border-t bg-muted/30">
            <Button variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => onChange([])} data-testid={`filter-clear-${label.toLowerCase()}`}>
              Limpiar selección
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}