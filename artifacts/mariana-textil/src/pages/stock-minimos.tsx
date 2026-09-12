import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Info,
  Loader2,
  Save,
  Search,
  ShieldAlert,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocationScope } from "@/lib/location-scope";
import { hasPermission, Modules } from "@/lib/permisos";
import {
  getStockMinimoConfig,
  getStockMinimos,
  updateStockMinimo,
  updateStockMinimoConfig,
  type StockMinimoProducto,
} from "@/lib/stock-minimos-api";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { formatNumber, formatUnit } from "@workspace/number-format";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No se pudo completar la operación. Intenta de nuevo.";
}

function displayQuantity(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return formatNumber(value, { kind: "quantity" });
}

export default function StockMinimos() {
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { selectedLocationId } = useLocationScope();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  // A global header selection is required. A user limited to one site already
  // receives that site from the scope provider. Never use a local site picker.
  const ubicacionId = selectedLocationId ?? user?.ubicacion?.id ?? null;
  const canEdit = hasPermission(user, Modules.INVENTARIO, "editar");

  const configQuery = useQuery({
    queryKey: ["stock-minimos", "config", ubicacionId],
    queryFn: () => getStockMinimoConfig(ubicacionId as number),
    enabled: ubicacionId !== null,
    retry: false,
  });

  const productsQuery = useQuery({
    queryKey: ["stock-minimos", "products", ubicacionId, debouncedSearch],
    queryFn: () => getStockMinimos(ubicacionId as number, debouncedSearch || undefined),
    // Deliberately wait for the confirmed enabled response. An off site must
    // not cause a product/inventory query.
    enabled: ubicacionId !== null && configQuery.data?.habilitado === true,
    retry: false,
  });

  const configMutation = useMutation({
    mutationFn: (habilitado: boolean) =>
      updateStockMinimoConfig(ubicacionId as number, habilitado),
    onSuccess: (data) => {
      setPageError(null);
      queryClient.setQueryData(["stock-minimos", "config", ubicacionId], data);
      if (!data.habilitado) {
        setDrafts({});
        setRowError({});
        queryClient.removeQueries({
          queryKey: ["stock-minimos", "products", ubicacionId],
        });
      }
    },
    onError: (error) => setPageError(errorMessage(error)),
  });

  const valueMutation = useMutation({
    mutationFn: ({
      productoId,
      minimo,
    }: {
      productoId: number;
      minimo: number | null;
    }) => updateStockMinimo(productoId, ubicacionId as number, minimo),
    onSuccess: (_data, variables) => {
      setRowError((current) => {
        const next = { ...current };
        delete next[variables.productoId];
        return next;
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.productoId];
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: ["stock-minimos", "products", ubicacionId],
      });
    },
    onError: (error, variables) => {
      setRowError((current) => ({
        ...current,
        [variables.productoId]: errorMessage(error),
      }));
    },
  });

  useEffect(() => {
    setSearch("");
    setDrafts({});
    setRowError({});
    setPageError(null);
  }, [ubicacionId]);

  const products = productsQuery.data?.productos ?? [];
  const hasUnsavedValues = useMemo(
    () => Object.keys(drafts).length > 0,
    [drafts],
  );

  const setDraft = (producto: StockMinimoProducto, value: string) => {
    setRowError((current) => {
      const next = { ...current };
      delete next[producto.productoId];
      return next;
    });
    setDrafts((current) => ({ ...current, [producto.productoId]: value }));
  };

  const saveMinimum = (producto: StockMinimoProducto) => {
    const raw = drafts[producto.productoId];
    if (raw === undefined) return;

    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setRowError((current) => ({
        ...current,
        [producto.productoId]: "Captura un mínimo mayor o igual a cero, o deja el campo vacío.",
      }));
      return;
    }

    setRowError((current) => {
      const next = { ...current };
      delete next[producto.productoId];
      return next;
    });
    valueMutation.mutate({ productoId: producto.productoId, minimo: value });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sidebar">
            Stock mínimo
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configura el mínimo por producto y por sitio. El encabezado controla
            el sitio operativo; no se configura un sitio desde esta pantalla.
          </p>
        </div>

        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Consumo por sitio, no total entre sitios</AlertTitle>
          <AlertDescription>
            El consumo del sitio incluye ventas más salidas, incluso traslados.
            No lo sumes entre sitios: contarías dos veces el mismo traslado.
            Para decidir compras, el reporte usa la venta real al cliente.
          </AlertDescription>
        </Alert>

        {ubicacionId === null ? (
          <Alert data-testid="stock-minimos-select-site">
            <Info className="h-4 w-4" />
            <AlertTitle>Selecciona un sitio en el encabezado</AlertTitle>
            <AlertDescription>
              El stock mínimo se activa por sitio. Elige un sitio desde el
              selector global del encabezado para consultar o configurar sus
              mínimos.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {pageError && (
              <Alert variant="destructive" data-testid="stock-minimos-error">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>No se pudo actualizar la configuración</AlertTitle>
                <AlertDescription>{pageError}</AlertDescription>
              </Alert>
            )}

            {configQuery.isLoading ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Consultando configuración del sitio…
                </CardContent>
              </Card>
            ) : configQuery.isError ? (
              <Alert variant="destructive" data-testid="stock-minimos-config-error">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>No se pudo cargar el stock mínimo</AlertTitle>
                <AlertDescription>
                  {errorMessage(configQuery.error)}
                </AlertDescription>
              </Alert>
            ) : (
              <Card data-testid="stock-minimos-settings">
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Activar motor de stock mínimo</CardTitle>
                      <CardDescription className="mt-1 max-w-2xl">
                        Apagado no calcula, alerta ni consulta productos de este
                        sitio. Al encenderlo podrás capturar mínimos opcionales
                        por producto.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={configQuery.data?.habilitado ? "default" : "secondary"}>
                        {configQuery.data?.habilitado ? "Activo" : "Apagado"}
                      </Badge>
                      <Switch
                        checked={configQuery.data?.habilitado === true}
                        disabled={!canEdit || configMutation.isPending}
                        onCheckedChange={(checked) => {
                          setPageError(null);
                          configMutation.mutate(checked);
                        }}
                        aria-label="Activar stock mínimo para el sitio"
                        data-testid="stock-minimos-toggle"
                      />
                    </div>
                  </div>
                  {!canEdit && (
                    <p className="text-sm text-muted-foreground">
                      Tienes permiso para consultar inventario, pero no para
                      configurar mínimos.
                    </p>
                  )}
                </CardHeader>
              </Card>
            )}

            {configQuery.data?.habilitado === true && (
              <Card data-testid="stock-minimos-products">
                <CardHeader className="gap-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <CardTitle>Mínimos por producto</CardTitle>
                      <CardDescription>
                        Deja un producto vacío para que no genere alertas.
                        Captura la cantidad en la unidad nativa del producto.
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar SKU, tela o color"
                        className="pl-9"
                        aria-label="Buscar productos para stock mínimo"
                      />
                    </div>
                  </div>
                  {hasUnsavedValues && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Hay cambios sin guardar.
                    </p>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {productsQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Cargando productos del sitio…
                    </div>
                  ) : productsQuery.isError ? (
                    <Alert variant="destructive" className="m-4">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>No se pudieron cargar los productos</AlertTitle>
                      <AlertDescription>{errorMessage(productsQuery.error)}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[760px]">
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead className="text-right">Existencia</TableHead>
                            <TableHead className="min-w-[190px]">Mínimo</TableHead>
                            <TableHead className="w-28 text-right">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((producto) => {
                            const value =
                              drafts[producto.productoId] ??
                              (producto.minimo === null ? "" : String(producto.minimo));
                            const hasDraft = drafts[producto.productoId] !== undefined;
                            const hasError = rowError[producto.productoId];
                            return (
                              <TableRow key={producto.productoId}>
                                <TableCell>
                                  <div className="font-medium">{producto.tela}</div>
                                  <div className="text-sm text-muted-foreground">{producto.color}</div>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{producto.sku}</TableCell>
                                <TableCell>{formatUnit(producto.unidad)}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {displayQuantity(producto.existencia)}
                                </TableCell>
                                <TableCell>
                                  <Label htmlFor={`minimo-${producto.productoId}`} className="sr-only">
                                    Mínimo para {producto.tela} {producto.color}
                                  </Label>
                                  <Input
                                    id={`minimo-${producto.productoId}`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    inputMode="decimal"
                                    value={value}
                                    disabled={!canEdit || valueMutation.isPending}
                                    onChange={(event) => setDraft(producto, event.target.value)}
                                    placeholder="Sin mínimo"
                                    aria-invalid={Boolean(hasError)}
                                  />
                                  {hasError && (
                                    <p className="mt-1 text-xs text-destructive">{hasError}</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant={hasDraft ? "default" : "ghost"}
                                    disabled={!canEdit || !hasDraft || valueMutation.isPending}
                                    onClick={() => saveMinimum(producto)}
                                    aria-label={`Guardar mínimo para ${producto.tela} ${producto.color}`}
                                  >
                                    <Save className="mr-1.5 h-4 w-4" />
                                    Guardar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {products.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="h-28 text-center text-muted-foreground"
                              >
                                No hay productos para este sitio con esa búsqueda.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}