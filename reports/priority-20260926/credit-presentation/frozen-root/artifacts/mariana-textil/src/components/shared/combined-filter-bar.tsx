import { useState, useMemo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Filter, X, ChevronDown, Check, SlidersHorizontal, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export interface FilterOption {
  id: string | number;
  nombre: string;
}

export interface MultiSelectConfig {
  key: string;
  label: string;
  options: FilterOption[];
  selected: string[];
}

export interface CombinedFilterBarProps {
  // Multi selects
  multiSelects: MultiSelectConfig[];
  onMultiSelectChange: (key: string, selected: string[]) => void;

  // Date range
  showDateRange?: boolean;
  desde?: string;
  hasta?: string;
  onDateRangeChange?: (desde?: string, hasta?: string) => void;

  // Layout slots
  prefixControls?: ReactNode;
  suffixControls?: ReactNode;
  actions?: ReactNode;

  // Global clear (clears custom controls too, consumer implements it)
  onClearAll: () => void;
  // Extra count from custom controls (e.g. modalidad !== TODO)
  extraActiveCount?: number;
  extraChips?: Array<{ key: string; label: string; value: string; onRemove: () => void }>;
}

export function CombinedFilterBar({
  multiSelects,
  onMultiSelectChange,
  showDateRange = false,
  desde,
  hasta,
  onDateRangeChange,
  prefixControls,
  suffixControls,
  actions,
  onClearAll,
  extraActiveCount = 0,
  extraChips = [],
}: CombinedFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Compute chips for multi-selects
  const chips: { key: string; id: string; label: string; display: string }[] = useMemo(() => {
    const list: { key: string; id: string; label: string; display: string }[] = [];
    multiSelects.forEach((ms) => {
      ms.selected.forEach((selId) => {
        const opt = ms.options.find((o) => String(o.id) === selId);
        if (opt) {
          list.push({ key: ms.key, id: selId, label: ms.label, display: opt.nombre });
        }
      });
    });
    return list;
  }, [multiSelects]);

  const activeCount = chips.length + extraActiveCount + extraChips.length + (showDateRange && (desde || hasta) ? 1 : 0);

  const handleRemoveChip = (key: string, id: string) => {
    const ms = multiSelects.find((m) => m.key === key);
    if (ms) {
      onMultiSelectChange(key, ms.selected.filter((s) => s !== id));
    }
  };

  const handleClearDateRange = () => {
    if (onDateRangeChange) onDateRangeChange("", "");
  };

  const hasDateRangeActive = showDateRange && (desde || hasta);

  const desktopControls = (
    <div className="hidden lg:flex flex-wrap items-center gap-2 flex-1">
      {prefixControls}

      {showDateRange && onDateRangeChange && (
        <>
          <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border h-9">
            <Input
              type="date"
              value={desde || ""}
              onChange={(e) => onDateRangeChange(e.target.value, hasta)}
              className="h-7 text-sm bg-background border-none w-[130px]"
              data-testid="filter-desde"
            />
            <span className="text-muted-foreground text-sm">-</span>
            <Input
              type="date"
              value={hasta || ""}
              onChange={(e) => onDateRangeChange(desde, e.target.value)}
              className="h-7 text-sm bg-background border-none w-[130px]"
              data-testid="filter-hasta"
            />
          </div>
          <div className="h-6 w-px bg-border mx-1" />
        </>
      )}

      {suffixControls}

      {multiSelects.map((ms) => (
        <MultiSelectFilter
          key={ms.key}
          label={ms.label}
          options={ms.options}
          selected={ms.selected}
          onChange={(val) => onMultiSelectChange(ms.key, val)}
        />
      ))}
    </div>
  );

  const mobileControls = (
    <div className="flex lg:hidden items-center gap-2 flex-1">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-sm">
                {activeCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] sm:w-[400px] flex flex-col p-0">
          <SheetHeader className="p-4 border-b text-left">
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <div className="p-4 flex flex-col gap-5">
              {prefixControls && <div className="flex flex-col gap-3">{prefixControls}</div>}

              {showDateRange && onDateRangeChange && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Rango de fechas</span>
                  <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border">
                    <Input
                      type="date"
                      value={desde || ""}
                      onChange={(e) => onDateRangeChange(e.target.value, hasta)}
                      className="h-8 text-sm bg-background border-none flex-1"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="date"
                      value={hasta || ""}
                      onChange={(e) => onDateRangeChange(desde, e.target.value)}
                      className="h-8 text-sm bg-background border-none flex-1"
                    />
                  </div>
                </div>
              )}

              {suffixControls && <div className="flex flex-col gap-3">{suffixControls}</div>}

              {multiSelects.length > 0 && <Separator />}

              {multiSelects.map((ms) => (
                <div key={ms.key} className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{ms.label}</span>
                  <MultiSelectMobile
                    options={ms.options}
                    selected={ms.selected}
                    onChange={(val) => onMultiSelectChange(ms.key, val)}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <SheetFooter className="p-4 border-t flex flex-row items-center gap-2">
            <Button variant="outline" className="flex-1" onClick={onClearAll}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Ver resultados
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="combined-filter-bar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-3 rounded-lg border shadow-sm">
        {desktopControls}
        {mobileControls}

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium mr-1 uppercase tracking-wider">
            Filtros Activos:
          </span>

          {hasDateRangeActive && (
            <Badge variant="secondary" className="px-2 py-1 gap-1 bg-muted border font-normal">
              <CalendarIcon className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground mr-1">Rango:</span>
              {desde || "Inicio"} - {hasta || "Fin"}
              <button
                onClick={handleClearDateRange}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
                <span className="sr-only">Remover</span>
              </button>
            </Badge>
          )}

          {chips.map((chip) => (
            <Badge key={`${chip.key}-${chip.id}`} variant="secondary" className="px-2 py-1 gap-1 bg-muted border font-normal">
              <span className="text-muted-foreground mr-1">{chip.label}:</span>
              {chip.display}
              <button
                onClick={() => handleRemoveChip(chip.key, chip.id)}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
                <span className="sr-only">Remover</span>
              </button>
            </Badge>
          ))}

          {extraChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="px-2 py-1 gap-1 bg-muted border font-normal">
              <span className="text-muted-foreground mr-1">{chip.label}:</span>
              {chip.value}
              <button
                type="button"
                onClick={chip.onRemove}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
                aria-label={`Quitar filtro ${chip.label}: ${chip.value}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar todo
          </Button>
        </div>
      )}
    </div>
  );
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((o) => o.nombre.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
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
          className={cn(
            "h-9 border-dashed gap-1.5",
            selected.length > 0 && "border-solid bg-sidebar/5 border-sidebar/20"
          )}
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
          {filteredOptions.map((opt) => {
            const isSelected = selected.includes(String(opt.id));
            return (
              <div
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted cursor-pointer"
                onClick={() => toggleOption(String(opt.id))}
                data-testid={`filter-opt-${label.toLowerCase()}-${opt.id}`}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                  )}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
                <span className="truncate">{opt.nombre}</span>
              </div>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="p-2 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => onChange([])}
              data-testid={`filter-clear-${label.toLowerCase()}`}
            >
              Limpiar selección
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectMobile({
  options,
  selected,
  onChange,
}: {
  options: FilterOption[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((o) => o.nombre.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="border rounded-md overflow-hidden flex flex-col">
      <div className="p-2 border-b bg-muted/20">
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs bg-background"
        />
      </div>
      <div className="max-h-[160px] overflow-y-auto p-1 custom-scrollbar bg-background">
        {filteredOptions.length === 0 && (
          <div className="p-2 text-center text-xs text-muted-foreground">No hay opciones</div>
        )}
        {filteredOptions.map((opt) => {
          const isSelected = selected.includes(String(opt.id));
          return (
            <div
              key={opt.id}
              className="flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-muted cursor-pointer"
              onClick={() => toggleOption(String(opt.id))}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                )}
              >
                {isSelected && <Check className="w-3 h-3" />}
              </div>
              <span className="truncate">{opt.nombre}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
