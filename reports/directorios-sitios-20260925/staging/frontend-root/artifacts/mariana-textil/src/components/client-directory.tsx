import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { getListClientesQueryKey, type Cliente } from "@workspace/api-client-react";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import { getApiErrorMessage } from "@/lib/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurgaCatalogoButton } from "@/components/purga-catalogo-button";

type Sort = "nombre" | "rfc" | "telefono" | "limiteCredito" | "saldoActual" | "movementCount" | "lastActivity";
type Period = "1m" | "3m" | "1y" | "all";
type DirectoryItem = Cliente & { movementCount: number | null; lastActivity: string | null };
type DirectoryResponse = { items: DirectoryItem[]; total: number; page: number; pageSize: number; appliedPeriod: Period };
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const date = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
const periods: Record<Period, string> = { "1m": "Último mes", "3m": "Últimos tres meses", "1y": "Último año", all: "Todo el tiempo" };
const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ClientDirectory({ enabled, canFinances, isAdmin, authPartition }: {
  enabled: boolean; canFinances: boolean; isAdmin: boolean; authPartition: string;
}) {
  const [search, setSearch] = useHistoryEntryState("clientes.search", "");
  const [status, setStatus] = useHistoryEntryState("clientes.status", "active");
  const [sort, setSort] = useHistoryEntryState<Sort>("clientes.directory.sort", "nombre");
  const [direction, setDirection] = useHistoryEntryState<"asc" | "desc">("clientes.directory.direction", "asc");
  const [period, setPeriod] = useHistoryEntryState<Period>("clientes.directory.period", "all");
  const [page, setPage] = useHistoryEntryState("clientes.directory.page", 1);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 180);
    return () => window.clearTimeout(timer);
  }, [search]);
  const effectiveSort = !canFinances && ["lastActivity", "movementCount", "saldoActual", "limiteCredito"].includes(sort) ? "nombre" : sort;
  const effectiveDirection = effectiveSort !== sort ? "asc" : direction;
  const params = new URLSearchParams({
    q: debouncedSearch.trim(), sort: effectiveSort, direction: effectiveDirection, period,
    page: String(page), pageSize: "50",
  });
  if (status !== "all") params.set("active", String(status === "active"));
  const cacheScope = JSON.stringify({ authPartition, canFinances });
  const query = useQuery<DirectoryResponse>({
    queryKey: [...getListClientesQueryKey(), "listado", cacheScope, params.toString()],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/clientes/listado?${params}`, { signal, credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "No se pudo cargar el directorio de clientes.");
      }
      return { ...await response.json(), appliedPeriod: period };
    },
    enabled,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey.includes(cacheScope) ? previous : undefined,
    staleTime: 15_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: false,
  });
  const data = enabled ? query.data : undefined;
  useEffect(() => {
    if (!data || query.isPlaceholderData) return;
    const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [data, page, query.isPlaceholderData, setPage]);
  const setOrder = (column: Sort, requestedDirection?: "asc" | "desc") => {
    setSort(column);
    setDirection(requestedDirection ?? (effectiveSort === column && effectiveDirection === "asc" ? "desc" : "asc"));
    setPage(1);
  };
  const heading = (column: Sort, label: string) => {
    const active = effectiveSort === column;
    const Icon = active ? effectiveDirection === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
    return <TableHead aria-sort={active ? effectiveDirection === "asc" ? "ascending" : "descending" : "none"}>
      <button type="button" onClick={() => setOrder(column)} className={`inline-flex items-center gap-1 whitespace-nowrap rounded py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "font-bold text-primary" : ""}`} data-testid={`sort-clients-${column}`} aria-label={`Ordenar por ${label}${active ? `, ${effectiveDirection === "asc" ? "ascendente" : "descendente"}` : ""}`}>
        {label}<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
    </TableHead>;
  };
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));
  const searching = search !== debouncedSearch;
  return <div className="space-y-4">
    <Card><CardContent className="space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input value={search} maxLength={200} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Cualquier palabra del nombre, RFC o teléfono" aria-label="Buscar clientes por nombre, RFC o teléfono" className="pl-9" data-testid="input-search-clients" />
        </div>
        <select aria-label="Estado del cliente" className={selectClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} data-testid="select-client-status">
          <option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">Ordenar clientes
          <select aria-label="Ordenar clientes" className={selectClass} value={effectiveSort === "movementCount" ? "movementCount" : "nombre"} onChange={event => setOrder(event.target.value as Sort, event.target.value === "nombre" ? "asc" : "desc")} data-testid="select-client-order">
            <option value="nombre">Nombre A–Z</option>
            {canFinances && <option value="movementCount">Mayor demanda</option>}
          </select>
        </label>
        {canFinances && <Button size="sm" variant={effectiveSort === "saldoActual" && effectiveDirection === "desc" ? "default" : "outline"} aria-pressed={effectiveSort === "saldoActual" && effectiveDirection === "desc"} onClick={() => setOrder("saldoActual", "desc")} data-testid="quick-order-saldoActual">Deuda pendiente primero</Button>}
        {canFinances && <label className="flex flex-wrap items-center gap-2 text-sm sm:ml-auto">Periodo de movimientos
          <select aria-label="Periodo de movimientos" className={selectClass} value={period} onChange={event => { setPeriod(event.target.value as Period); setPage(1); }} data-testid="select-movement-period">
            {Object.entries(periods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
      </div>
      {canFinances && <p className="text-xs text-muted-foreground">Movimientos: ventas, notas y abonos del periodo elegido. Última actividad: fecha del último movimiento, sin limitar al periodo.</p>}
    </CardContent></Card>
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
      <span>{data ? `${total.toLocaleString("es-MX")} clientes encontrados` : "Directorio de clientes"}</span>
      {(query.isFetching || searching) && <span className="inline-flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" />Buscando…</span>}
    </div>
    {query.isError ? <Card><CardContent className="space-y-3 p-6" role="alert">
      <p className="text-destructive">{getApiErrorMessage(query.error, "No se pudieron cargar los clientes.")}</p>
      <Button variant="outline" onClick={() => query.refetch()}>Intentar de nuevo</Button>
    </CardContent></Card> : !data ? <Card><CardContent className="p-8 text-muted-foreground" aria-label="Cargando clientes">Cargando clientes…</CardContent></Card> :
      <Card className="overflow-hidden">
        <Table aria-busy={query.isFetching || searching} className={query.isPlaceholderData ? "opacity-60" : undefined}>
          <TableHeader><TableRow>
            {heading("nombre", "Cliente")}{heading("telefono", "Teléfono")}{heading("rfc", "RFC")}<TableHead>Estado</TableHead>
            {canFinances && <>{heading("saldoActual", "Deuda")}{heading("limiteCredito", "Límite de crédito")}{heading("movementCount", "Movimientos")}{heading("lastActivity", "Última actividad")}</>}
            {isAdmin && <TableHead>Acciones</TableHead>}
          </TableRow></TableHeader>
          <TableBody>{data.items.length ? data.items.map(client => <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
            <TableCell className="min-w-48 max-w-80 whitespace-normal font-medium"><Link href={`/clientes/${client.id}`} className="text-primary underline underline-offset-4" data-testid={`link-client-${client.id}`}>{client.nombre}</Link>{client.esSistema && <Badge variant="secondary" className="ml-2">Sistema</Badge>}</TableCell>
            <TableCell className="max-w-44 whitespace-normal">{client.telefono || "—"}</TableCell>
            <TableCell>{client.rfc || "—"}</TableCell>
            <TableCell><Badge variant={client.activo ? "secondary" : "outline"}>{client.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
            {canFinances && <>
              <TableCell className="whitespace-nowrap">{client.saldoActual == null ? <span className="text-muted-foreground">No disponible</span> : <>
                <Badge variant="outline" className={Number(client.saldoActual) > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>{Number(client.saldoActual) > 0 ? "Con deuda" : "Sin deuda"}</Badge>
                <div className="mt-1 font-semibold tabular-nums">{money.format(Number(client.saldoActual))}</div>
                {client.saldoAFavor != null && Number(client.saldoAFavor) > 0 && <div className="mt-1 text-xs text-blue-700">A favor: {money.format(Number(client.saldoAFavor))}</div>}
              </>}</TableCell>
              <TableCell className="tabular-nums">{client.limiteCredito == null ? "—" : money.format(Number(client.limiteCredito))}</TableCell>
              <TableCell className="tabular-nums"><span className="font-semibold">{client.movementCount ?? "—"}</span><div className="whitespace-nowrap text-xs text-muted-foreground">{periods[data.appliedPeriod]}</div></TableCell>
              <TableCell className="whitespace-nowrap">{client.lastActivity ? date.format(new Date(client.lastActivity)) : client.movementCount === null ? "No disponible" : "Sin movimientos"}</TableCell>
            </>}
            {isAdmin && <TableCell>{!client.activo && !client.esSistema && <PurgaCatalogoButton entidad="clientes" id={client.id} nombreVisible={client.nombre} invalidateQueryKey={getListClientesQueryKey()} />}</TableCell>}
          </TableRow>) : <TableRow><TableCell colSpan={isAdmin ? canFinances ? 9 : 5 : canFinances ? 8 : 4} className="p-10 text-center text-muted-foreground" data-testid="empty-clients">No hay clientes que coincidan con los filtros.</TableCell></TableRow>}</TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <span className="text-sm text-muted-foreground">{total ? `${(data.page - 1) * 50 + 1}–${Math.min(data.page * 50, total)} de ${total.toLocaleString("es-MX")}` : "0 resultados"} · 50 por página</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1 || query.isFetching || searching} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm">Página {page} de {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages || query.isFetching || searching} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>}
  </div>;
}