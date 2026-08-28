import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useListAuditoria,
  useGetAuditoria,
  useListUsers,
  useListLocations,
  exportAuditoriaXlsx,
  getGetAuditoriaQueryKey,
} from '@workspace/api-client-react';
import type { ListAuditoriaParams, Role } from '@workspace/api-client-react';
import {
  Calendar as CalendarIcon,
  Search,
  Download,
  FilterX,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Clock
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

const AUDIT_ROLES: Role[] = [
  'ADMIN',
  'TERMINAL',
  'CAJA',
  'SUPERVISOR',
  'BODEGA',
  'SISTEMAS',
  'CONTADOR',
];

export default function Auditoria() {
  const { toast } = useToast();

  // Fitros
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [usuarioId, setUsuarioId] = useState<string>('all');
  const [rol, setRol] = useState<Role | 'all'>('all');
  const [sitioId, setSitioId] = useState<string>('all');
  const [modulo, setModulo] = useState<string>('');
  const [accion, setAccion] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Selected for detail
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Queries
  const { data: users } = useListUsers();
  const { data: locations } = useListLocations();

  const params: ListAuditoriaParams = useMemo(() => ({
    desde: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    hasta: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : (dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined),
    usuarioId: usuarioId !== 'all' ? Number(usuarioId) : undefined,
    rol: rol !== 'all' ? rol : undefined,
    sitioId: sitioId !== 'all' ? Number(sitioId) : undefined,
    modulo: modulo || undefined,
    accion: accion || undefined,
    search: search || undefined,
    page,
    pageSize,
  }), [dateRange, usuarioId, rol, sitioId, modulo, accion, search, page, pageSize]);

  const { data, isFetching } = useListAuditoria(params);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await exportAuditoriaXlsx(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bitacora_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Exportación exitosa', description: 'El archivo se ha descargado.' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo exportar la bitácora.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    setUsuarioId('all');
    setRol('all');
    setSitioId('all');
    setModulo('');
    setAccion('');
    setSearch('');
    setPage(1);
  };

  const setShortcut = (days: number, month = false) => {
    const today = new Date();
    if (month) {
      setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
    } else {
      setDateRange({ from: subDays(today, days), to: today });
    }
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bitácora</h1>
          <p className="text-sm text-muted-foreground">
            Bitácora operativa de solo lectura.
          </p>
        </div>
        <Button onClick={handleExport} disabled={isExporting} variant="outline" className="shrink-0 bg-white">
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar Excel
        </Button>
      </div>

      <div className="bg-card border rounded-lg shadow-sm">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
          <div className="space-y-1.5 flex flex-col">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white h-9",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy")} -{" "}
                        {format(dateRange.to, "dd/MM/yy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yy")
                    )
                  ) : (
                    <span>Seleccionar rango</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShortcut(0)} className="text-xs">Hoy</Button>
                  <Button variant="secondary" size="sm" onClick={() => setShortcut(7)} className="text-xs">7 días</Button>
                  <Button variant="secondary" size="sm" onClick={() => setShortcut(30)} className="text-xs">30 días</Button>
                  <Button variant="secondary" size="sm" onClick={() => setShortcut(0, true)} className="text-xs">Mes actual</Button>
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => { setDateRange(range || { from: undefined }); setPage(1); }}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Rol</Label>
            <Select value={rol} onValueChange={(value) => { setRol(value as Role | 'all'); setPage(1); }}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {AUDIT_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Usuario</Label>
            <Select value={usuarioId} onValueChange={(v) => { setUsuarioId(v); setPage(1); }}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {users?.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sitio</Label>
            <Select value={sitioId} onValueChange={(v) => { setSitioId(v); setPage(1); }}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sitios</SelectItem>
                {locations?.map(l => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Módulo</Label>
            <Input
              placeholder="Ej. PRODUCTOS"
              className="h-9 bg-white"
              value={modulo}
              onChange={(e) => { setModulo(e.target.value.toUpperCase()); setPage(1); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Acción</Label>
            <Input
              placeholder="Ej. CREAR"
              className="h-9 bg-white"
              value={accion}
              onChange={(e) => { setAccion(e.target.value.toUpperCase()); setPage(1); }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Búsqueda</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Entidad, folio..."
                  className="pl-8 h-9 bg-white"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={clearFilters} title="Limpiar filtros">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t bg-white rounded-b-lg">
          <div className="relative">
            {isFetching && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-[160px]">Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Módulo / Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Sitio</TableHead>
                  <TableHead className="w-[80px] text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No se encontraron registros en la bitácora con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((item) => (
                    <TableRow key={item.id} className="group cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedId(item.id)}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(item.fecha), 'dd/MM/yyyy HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.usuario || 'Sistema'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{item.ip}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-sidebar-primary tracking-wide">
                            {item.modulo || '-'}
                          </span>
                          <Badge variant={
                            item.accion === 'CREAR' ? 'default' :
                            item.accion === 'ELIMINAR' ? 'destructive' : 'secondary'
                          } className="text-[10px] px-1.5 py-0 rounded-sm">
                            {item.accion}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.entidad}</div>
                        {item.entidadId && (
                          <div className="text-xs text-muted-foreground font-mono">ID: {item.entidadId}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.sitio || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && (
            <div className="p-4 border-t flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, data.total)} de <span className="font-medium text-foreground">{data.total}</span> registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <div className="font-medium tabular-nums px-2">
                  {page} / {Math.ceil(data.total / pageSize) || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(data.total / pageSize)}
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AuditoriaDetailSheet
        id={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function AuditoriaDetailSheet({ id, onClose }: { id: string | null, onClose: () => void }) {
  const { data, isLoading } = useGetAuditoria(id as unknown as number, {
    query: {
      enabled: !!id,
      queryKey: getGetAuditoriaQueryKey(id as unknown as number)
    }
  });

  const allKeys = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    if (data.datosAntes) Object.keys(data.datosAntes).forEach(k => keys.add(k));
    if (data.datosDespues) Object.keys(data.datosDespues).forEach(k => keys.add(k));
    return Array.from(keys).sort();
  }, [data]);

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-3xl lg:max-w-4xl border-l p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b bg-muted/20">
          <SheetTitle className="text-xl">Detalle de Bitácora</SheetTitle>
          <SheetDescription>
            Registro de cambios detallado.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Fecha y Hora</div>
                  <div className="font-mono text-sm font-medium">{format(new Date(data.fecha), 'dd/MM/yyyy HH:mm:ss')}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Usuario</div>
                  <div className="font-medium text-sm">{data.usuario || 'Sistema'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">IP de Origen</div>
                  <div className="font-mono text-sm">{data.ip}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Módulo / Acción</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{data.modulo || '-'}</span>
                    <Badge variant={
                      data.accion === 'CREAR' ? 'default' :
                      data.accion === 'ELIMINAR' ? 'destructive' : 'secondary'
                    } className="text-[10px] px-1.5 py-0 rounded-sm">
                      {data.accion}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Entidad</div>
                  <div className="font-medium text-sm">{data.entidad}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">ID Entidad</div>
                  <div className="font-mono text-sm">{data.entidadId || '-'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Sitio</div>
                  <div className="font-medium text-sm">{data.sitio || '-'}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold tracking-tight mb-4 flex items-center">
                  <div className="h-4 w-1 bg-primary rounded-full mr-2"></div>
                  Comparación de Datos
                </h3>

                {allKeys.length === 0 ? (
                  <div className="text-center p-8 bg-muted/30 border rounded-lg border-dashed">
                    <p className="text-sm text-muted-foreground">No hay datos asociados a este evento.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[180px] border-r font-semibold">Campo</TableHead>
                          <TableHead className="w-1/2 border-r text-destructive/80 font-semibold">Antes</TableHead>
                          <TableHead className="w-1/2 text-emerald-600 font-semibold">Después</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allKeys.map(key => {
                          const valAntes = data.datosAntes ? (data.datosAntes as any)[key] : undefined;
                          const valDespues = data.datosDespues ? (data.datosDespues as any)[key] : undefined;

                          // Convert undefined/null to something printable
                          const strAntes = valAntes === undefined ? '-' : valAntes === null ? 'null' : typeof valAntes === 'object' ? JSON.stringify(valAntes) : String(valAntes);
                          const strDespues = valDespues === undefined ? '-' : valDespues === null ? 'null' : typeof valDespues === 'object' ? JSON.stringify(valDespues) : String(valDespues);

                          const isChanged = strAntes !== strDespues;

                          return (
                            <TableRow key={key} className={cn(isChanged ? "bg-amber-50/30" : "")}>
                              <TableCell className="font-mono text-xs border-r font-medium text-muted-foreground bg-muted/10">{key}</TableCell>
                              <TableCell className={cn(
                                "font-mono text-[13px] border-r break-all",
                                isChanged && strAntes !== '-' ? "text-destructive/90 bg-destructive/5" : "text-muted-foreground"
                              )}>
                                {strAntes}
                              </TableCell>
                              <TableCell className={cn(
                                "font-mono text-[13px] break-all",
                                isChanged && strDespues !== '-' ? "text-emerald-700 bg-emerald-50" : "text-muted-foreground"
                              )}>
                                {strDespues}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-destructive">
              Error al cargar los detalles.
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
