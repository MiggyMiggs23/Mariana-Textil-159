import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useHistoryEntryState } from "@/lib/internal-navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Search,
  Plus,
  Trash2,
  Printer,
  Ban,
  Receipt,
  CheckCircle,
  HelpCircle,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useBuscarPos,
  useCrearTicket,
  useValidarPrecioPos,
  useGetCurrentUser,
  useGetPosClienteCreditoDisponible,
  getGetPosClienteCreditoDisponibleQueryKey,
  useListLocations,
  useListarTickets,
  getGetCurrentUserQueryKey,
  getListLocationsQueryKey,
  getListarTicketsQueryKey,
  getBuscarPosQueryKey,
  getBuscarPosQueryOptions,
  TipoTicket,
  PosRolloDisponible,
  PosProducto,
  TicketLineaInput,
  TicketInput,
  Role,
} from "@workspace/api-client-react";

import { useLocationScope } from "@/lib/location-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { getApiErrorMessage } from "@/lib/api-error";
import { ClientSelector } from "@/components/client-selector";
import {
  allowedCreditTerm,
  CREDIT_TERMS,
  type CreditTerm,
} from "@/lib/credit-terms";
import { CampoEscaneo } from "@/components/campo-escaneo";
import { requestAppSound } from "@/components/notification-audio-controller";
import { formatNumber, formatUnit } from "@workspace/number-format";
import {
  advertenciaSkuEscaneado,
  type CodigoEscaneadoInterpretado,
} from "@workspace/scanned-code";
import {
  mayoreoThresholdForUnit,
  suggestedMeteredPrice,
} from "@workspace/metered-pricing";

type PriceValidation = {
  status: "idle" | "checking" | "valid" | "invalid" | "error";
  message?: string;
};

type CartLineKey = string;

function getCartLineKey(item: any): CartLineKey {
  return item.rollos
    ? `producto-${item.producto.id}`
    : `producto-metreado-${item.producto.id}`;
}

function meteredCostWarning(item: any): string | null {
  const cost = item.producto.costoReferenciaMetreado?.costoUnitario;
  if (
    cost != null &&
    Number.isFinite(item.precioUnitario) &&
    item.precioUnitario < Number(cost)
  ) {
    return "El precio capturado está por debajo del costo de referencia metreado. La venta puede continuar.";
  }
  return null;
}

function cartLineSubtotalCents(item: any): number {
  if (item.rollos) {
    return item.rollos.reduce(
      (sum: number, rollo: PosRolloDisponible) =>
        sum +
        Math.round(
          (Math.round(Number(rollo.cantidadActual) * 1000) *
            Math.round(Number(item.precioUnitario) * 100)) /
            1000,
        ),
      0,
    );
  }
  return Math.round(
    (Math.round(Number(item.cantidad) * 1000) *
      Math.round(Number(item.precioUnitario) * 100)) /
      1000,
  );
}

// Componente Cart Line para el POS
function CartLineItem({
  item,
  onRemove,
  isMetreado,
  onChangeQuantity,
  onChangePrice,
  locationId,
  lineKey,
  priceValidation,
  onPriceValidationChange,
}: {
  item: any;
  onRemove: () => void;
  isMetreado: boolean;
  onChangeQuantity?: (qty: number) => void;
  onChangePrice: (price: number) => void;
  locationId: number;
  lineKey: CartLineKey;
  priceValidation: PriceValidation;
  onPriceValidationChange: (
    lineKey: CartLineKey,
    validation: PriceValidation,
  ) => void;
}) {
  const validarPrecio = useValidarPrecioPos();
  const validationSequence = useRef(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const sequence = ++validationSequence.current;

    if (isMetreado || !item.rollos) {
      onPriceValidationChange(lineKey, { status: "valid" });
      return;
    }

    if (!Number.isFinite(item.precioUnitario) || item.precioUnitario <= 0) {
      onPriceValidationChange(lineKey, {
        status: "invalid",
        message: "Captura un precio mayor a cero.",
      });
      return;
    }

    onPriceValidationChange(lineKey, { status: "checking" });
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all(
        item.rollos.map((rollo: PosRolloDisponible) =>
          validarPrecio.mutateAsync({
            data: {
              ubicacionId: locationId,
              productoId: item.producto.id,
              rolloId: rollo.id,
              precioUnitario: item.precioUnitario,
            },
          }),
        ),
      )
        .then((results) => {
            if (!active || validationSequence.current !== sequence) return;
            const rejected = results.find((result) => !result.valido);
            onPriceValidationChange(
              lineKey,
              !rejected
                ? { status: "valid" }
                : {
                    status: "invalid",
                    message:
                      rejected.mensaje ??
                      "El precio está por debajo del mínimo permitido.",
                  },
            );
          })
        .catch((error) => {
            if (!active || validationSequence.current !== sequence) return;
            onPriceValidationChange(lineKey, {
              status: "error",
              message: getApiErrorMessage(
                error,
                "No se pudo validar el precio. Intenta de nuevo.",
              ),
            });
          });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    isMetreado,
    item.precioUnitario,
    item.producto.id,
    item.rollos,
    lineKey,
    locationId,
    onPriceValidationChange,
  ]);

  const priceIsBlocked =
    priceValidation.status === "invalid" || priceValidation.status === "error";
  const belowMeteredCost = isMetreado ? meteredCostWarning(item) : null;
  const meteredUnit = formatUnit(item.producto.unidad);
  const meteredThreshold = mayoreoThresholdForUnit(item.producto.unidad);
  const requiresWholeQuantity = item.producto.unidad === "BOLSA";

  return (
    <div className={`border-b py-3 last:border-0 ${isMetreado ? 'bg-amber-50/30' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">
              {item.producto.tela} - {item.producto.color}
            </span>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${isMetreado ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
              {isMetreado ? 'Metreado' : 'Rollo'}
            </span>
             {isMetreado && (
               <>
                 <span
                   className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-violet-100 text-violet-800"
                   data-testid={`precio-tipo-${item.producto.id}`}
                 >
                   {item.meteredPriceTier === "MAYOREO"
                      ? `Mayoreo (${meteredThreshold} ${meteredUnit} o más)`
                      : `Menudeo (menos de ${meteredThreshold} ${meteredUnit})`}
                 </span>
                 {item.meteredPriceTierChanged && (
                   <span className="text-xs font-medium text-violet-800" role="status">
                     Precio sugerido actualizado al cruzar el umbral.
                   </span>
                 )}
               </>
             )}
             {!isMetreado && item.rollos && (
               <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                 {item.rollos.length} {item.rollos.length === 1 ? "rollo" : "rollos"}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.producto.sku}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-24">
            <Label className="text-[10px] text-muted-foreground">
              Precio / {formatUnit(item.producto.unidad)}
            </Label>
            <div className="relative">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={item.precioUnitario}
                onChange={(event) =>
                  onChangePrice(Number(event.target.value) || 0)
                }
                className={`h-8 text-right font-mono ${priceIsBlocked ? "border-destructive ring-1 ring-destructive" : ""}`}
                aria-invalid={priceIsBlocked}
                 data-testid={`input-precio-${item.producto.id}`}
              />
              {priceValidation.status === "checking" && (
                <Loader2 className="absolute left-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          {isMetreado ? (
            <div className="w-20">
              <Input
                type="number"
                min={requiresWholeQuantity ? "1" : "0.001"}
                step={requiresWholeQuantity ? "1" : "0.001"}
                value={item.cantidad}
                onChange={(e) => {
                  const quantity = Number(e.target.value) || 0;
                  if (
                    onChangeQuantity &&
                    (!requiresWholeQuantity || Number.isInteger(quantity))
                  ) {
                    onChangeQuantity(quantity);
                  }
                }}
                className="h-8 text-right font-mono"
              />
            </div>
           ) : (
             <div className="font-mono text-sm whitespace-nowrap">
               {formatNumber(item.cantidad, { kind: "quantity" })} {formatUnit(item.producto.unidad)}
            </div>
          )}

          <div className="w-24 text-right font-bold">
            {formatNumber(cartLineSubtotalCents(item) / 100, { kind: "money" })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {!isMetreado && item.rollos && (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
            {expanded ? "Ocultar series" : "Ver series"}
          </Button>
          {item.hasDifferentSuggestedPrices && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Los rollos tenían precios sugeridos distintos; este precio se aplica a todos.
            </p>
          )}
          {expanded && (
            <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2">
              {item.rollos.map((rollo: PosRolloDisponible) => (
                <div key={rollo.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono">{rollo.serie}</span>
                  <span className="text-muted-foreground">
                    {formatNumber(rollo.cantidadActual, { kind: "quantity" })} {formatUnit(rollo.unidad)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive"
                    onClick={() => item.onRemoveRollo(rollo.id)}
                    aria-label={`Quitar rollo ${rollo.serie}`}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {priceIsBlocked && priceValidation.message && (
        <p
          className="mt-2 text-xs font-medium text-destructive"
          role="alert"
          data-testid={`precio-error-${item.producto.id}`}
        >
          {priceValidation.message}
        </p>
      )}
       {belowMeteredCost && (
         <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-800" role="alert">
           <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
           {belowMeteredCost}
         </p>
       )}
       {isMetreado && item.producto.costoReferenciaMetreado && (
         <p className="mt-1 text-xs text-muted-foreground">
           Costo de referencia:{" "}
           {item.producto.costoReferenciaMetreado.costoUnitario == null
             ? "sin costo conocido"
             : formatNumber(item.producto.costoReferenciaMetreado.costoUnitario, { kind: "money" })}
           {item.producto.costoReferenciaMetreado.esMayorA12Meses
             ? " (último costo conocido, mayor a 12 meses)"
             : ""}
         </p>
       )}
    </div>
  );
}

export default function PosPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { selectedLocationId, setSelectedLocationId } = useLocationScope();
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey() },
  });
  const canChooseLocation = currentUser?.rol === Role.ADMIN;
  const {
    data: availableLocations,
    isLoading: loadingLocations,
    isError: locationsFailed,
  } = useListLocations({
    query: {
      enabled: canChooseLocation && !selectedLocationId,
      queryKey: getListLocationsQueryKey(),
    },
  });

  const [tipoTicket, setTipoTicket] = useHistoryEntryState<TipoTicket>("pos.tipo-ticket", TipoTicket.NORMAL);
  const [search, setSearch] = useHistoryEntryState("pos.search", "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lastScannedCode, setLastScannedCode] =
    useState<CodigoEscaneadoInterpretado | null>(null);
  const [skuWarning, setSkuWarning] = useState<string | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setLastScannedCode(null);
    setSkuWarning(null);
  }, []);

  // Timer for debouncing search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Cart state
  const [cart, setCart] = useState<any[]>([]);
  const cartRef = useRef<any[]>([]);
  const commitCart = useCallback(
    (update: (current: any[]) => any[]) => {
      const next = update(cartRef.current);
      cartRef.current = next;
      setCart(next);
    },
    [],
  );
  const [facturar, setFacturar] = useState(false);
  const [clientId, setClientId] = useState<string>("1");
  const [clientName, setClientName] = useState("Venta a Público");
  const [credito, setCredito] = useState(false);
  const [diasPlazo, setDiasPlazo] = useState<CreditTerm | null>(null);
  const [documentoTipo, setDocumentoTipo] =
    useHistoryEntryState<"TICKET" | "NOTA" | null>("pos.document-type", null);
  const [notaSinPrecios, setNotaSinPrecios] = useState(false);
  const [imprimirTubulares, setImprimirTubulares] = useState(false);
  const [nombreDestinatario, setNombreDestinatario] = useState("");
  const [direccionEntregaSnapshot, setDireccionEntregaSnapshot] = useState("");

  const searchParams = useMemo(
    () => ({
      q: debouncedSearch,
      tipo: tipoTicket,
      ubicacionId: selectedLocationId || 0,
    }),
    [debouncedSearch, tipoTicket, selectedLocationId],
  );

  const {
    data: searchResults,
    isFetching,
    isError: searchFailed,
    error: searchError,
  } = useBuscarPos(searchParams, {
    query: {
      enabled: debouncedSearch.length >= 2 && !!selectedLocationId,
      queryKey: getBuscarPosQueryKey(searchParams),
    },
  });

  const crearTicket = useCrearTicket();
  const {
    data: clienteCredito,
    isLoading: loadingClienteCredito,
    isError: clienteCreditoFailed,
  } = useGetPosClienteCreditoDisponible(
    Number(clientId) || 0,
    { ubicacionId: selectedLocationId || 0 },
    {
    query: {
      enabled: Boolean(clientId) && clientId !== "1" && Boolean(selectedLocationId),
      queryKey: getGetPosClienteCreditoDisponibleQueryKey(
        Number(clientId) || 0,
        { ubicacionId: selectedLocationId || 0 },
      ),
      staleTime: 10_000,
    },
  });

  const addToCart = useCallback((item: any, automatic = false) => {
    // Para NORMAL, añadir el rollo
    if (tipoTicket === TipoTicket.NORMAL) {
      const current = cartRef.current;
      if (current.some((group) => group.rollos?.some((rollo: PosRolloDisponible) => rollo.id === item.id))) {
        if (automatic) requestAppSound("ALERTA");
        toast({
          title: "El rollo ya está en el ticket",
          variant: "destructive",
        });
        return;
      }
      const existingIndex = current.findIndex(
          (group) => group.rollos && group.producto.id === item.productoId,
        );
      let nextCart: any[];
        if (existingIndex >= 0) {
          const existing = current[existingIndex];
          const suggestedPriceDiffers =
            !existing.suggestedPrices.includes(Number(item.precioSugerido));
          nextCart = [...current];
          nextCart[existingIndex] = {
            ...existing,
            rollos: [...existing.rollos, item],
            cantidad: existing.cantidad + Number(item.cantidadActual),
            suggestedPrices: [
              ...existing.suggestedPrices,
              Number(item.precioSugerido),
            ],
            hasDifferentSuggestedPrices:
              existing.hasDifferentSuggestedPrices || suggestedPriceDiffers,
            priceValidation: { status: "idle" },
          };
        } else {
          nextCart = [
          ...current,
          {
          rollos: [item],
          producto: {
            id: item.productoId,
            sku: item.sku,
            tela: item.tela,
            color: item.color,
            unidad: item.unidad,
          },
          cantidad: Number(item.cantidadActual),
          precioUnitario: Number(item.precioSugerido),
          priceValidation: { status: "idle" },
          isMetreado: false,
          suggestedPrices: [Number(item.precioSugerido)],
          hasDifferentSuggestedPrices: false,
        },
          ];
        }
      cartRef.current = nextCart;
      setCart(nextCart);
    } else {
      // Para METREADO, cada producto-color is an independent line.
      if (cart.find((c) => c.producto.id === item.id && c.isMetreado)) {
        toast({
          title: "El producto ya está en el ticket. Ajusta la cantidad.",
          variant: "default",
        });
        return;
      }
      const nextCart = [
        ...cartRef.current,
        (() => {
          const suggested = suggestedMeteredPrice(1, item, item.unidad);
          return {
          rollo: null,
          producto: item,
          cantidad: 1,
          precioUnitario: Number(suggested.price),
          priceValidation: { status: "valid" },
          isMetreado: true,
          meteredPriceTier: suggested.tier,
          meteredPriceTierChanged: false,
        };
        })(),
      ];
      cartRef.current = nextCart;
      setCart(nextCart);
    }
    if (automatic) {
      requestAppSound("AVISO");
      toast({
        title: "Rollo agregado",
        description: `${item.tela} - ${item.color} · Serie ${item.serie}`,
      });
    }
    setSearch((current) =>
      automatic && current !== String(item.serie) ? current : "",
    );
    return true;
  }, [tipoTicket, toast]);

  const handleSearchScan = useCallback(
    async (
      value: string,
      codigo: CodigoEscaneadoInterpretado,
      source: "scanner" | "manual" | "camera",
    ) => {
      setSearch(value);
      setSkuWarning(null);
      if (
        tipoTicket !== TipoTicket.NORMAL ||
        source === "manual" ||
        !codigo.serie ||
        !selectedLocationId
      ) {
        setLastScannedCode(codigo.sku ? codigo : null);
        return;
      }

      try {
        const results = await queryClient.fetchQuery(
          getBuscarPosQueryOptions({
            q: codigo.serie,
            ubicacionId: selectedLocationId,
          }),
        );
        const exactMatches = results.rollos.filter(
          (rollo) => rollo.serie === codigo.serie,
        );
        if (exactMatches.length !== 1) {
          requestAppSound("ALERTA");
          toast({
            title:
              exactMatches.length > 1
                ? "El escaneo es ambiguo"
                : "No se pudo agregar el rollo",
            description:
              exactMatches.length > 1
                ? "Elige el rollo correcto de la lista."
                : "No está disponible en este sitio o el código no corresponde a un rollo disponible.",
            variant: "destructive",
          });
          return;
        }
        const rollo = exactMatches[0];
        setSkuWarning(advertenciaSkuEscaneado(codigo, rollo.sku));
        addToCart(rollo, true);
      } catch (error) {
        requestAppSound("ALERTA");
        toast({
          title: "No se pudo verificar el rollo",
          description: getApiErrorMessage(
            error,
            "Revisa la conexión e intenta escanear de nuevo.",
          ),
          variant: "destructive",
        });
      }
    },
    [addToCart, queryClient, selectedLocationId, tipoTicket, toast],
  );

  useEffect(() => {
    if (
      isFetching ||
      !lastScannedCode?.serie ||
      lastScannedCode.serie !== debouncedSearch ||
      !searchResults
    ) return;
    const rollo = searchResults.rollos.find(
      (item) => item.serie === lastScannedCode.serie,
    );
    setSkuWarning(
      rollo ? advertenciaSkuEscaneado(lastScannedCode, rollo.sku) : null,
    );
    setLastScannedCode(null);
  }, [debouncedSearch, isFetching, lastScannedCode, searchResults]);

  const updateCartQuantity = (index: number, qty: number) => {
    commitCart((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index && item.isMetreado
          ? (() => {
              const suggested = suggestedMeteredPrice(
                qty,
                item.producto,
                item.producto.unidad,
              );
              const crossedTier = item.meteredPriceTier !== suggested.tier;
              return {
                ...item,
                cantidad: qty,
                // Keep a freely edited price within a tier; crossing the
                // threshold deliberately refreshes the prefilled suggestion.
                precioUnitario: crossedTier
                  ? Number(suggested.price)
                  : item.precioUnitario,
                meteredPriceTier: suggested.tier,
                meteredPriceTierChanged: crossedTier,
                priceValidation: { status: "valid" },
              };
            })()
          : item,
      ),
    );
  };

  const updateCartPrice = (index: number, price: number) => {
    commitCart((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              precioUnitario: price,
              // METREADO has no hard price floor: its below-cost signal is
              // informational, so only roll-linked lines need async validation.
              priceValidation: item.isMetreado
                ? { status: "valid" }
                : { status: "idle" },
            }
          : item,
      ),
    );
  };

  const updateCartPriceValidation = useCallback(
    (lineKey: CartLineKey, validation: PriceValidation) => {
      commitCart((current) =>
        current.map((item) =>
          getCartLineKey(item) === lineKey &&
          (item.priceValidation?.status !== validation.status ||
            item.priceValidation?.message !== validation.message)
            ? { ...item, priceValidation: validation }
            : item,
        ),
      );
    },
    [commitCart],
  );

  const removeFromCart = (index: number) => {
    commitCart((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const removeRolloFromGroup = (groupIndex: number, rolloId: number) => {
    commitCart((current) =>
      current.flatMap((item, itemIndex) => {
        if (itemIndex !== groupIndex || !item.rollos) return [item];
        const rollos = item.rollos.filter((rollo: PosRolloDisponible) => rollo.id !== rolloId);
        if (rollos.length === 0) return [];
        return [{
          ...item,
          rollos,
          cantidad: rollos.reduce(
            (sum: number, rollo: PosRolloDisponible) => sum + Number(rollo.cantidadActual),
            0,
          ),
          priceValidation: { status: "idle" },
        }];
      }),
    );
  };

  const cartSubtotalCents = cart.reduce(
    (sum, item) => sum + cartLineSubtotalCents(item),
    0,
  );
  const cartSubtotal = cartSubtotalCents / 100;
  const cartIvaCents = facturar ? Math.round(cartSubtotalCents * 0.16) : 0;
  const cartIva = cartIvaCents / 100;
  const cartTotal = (cartSubtotalCents + cartIvaCents) / 100;
  const creditoDisponible = Number(clienteCredito?.creditoDisponible ?? 0);
  const limiteCredito = Number(clienteCredito?.limiteCredito ?? 0);
  const creditoFaltante = credito
    ? Math.max(0, cartTotal - creditoDisponible)
    : 0;
  const creditoCercaDelLimite =
    credito &&
    limiteCredito > 0 &&
    creditoFaltante === 0 &&
    creditoDisponible - cartTotal <= limiteCredito * 0.2;
  const creditoBloqueado =
    credito &&
    (clientId === "1" ||
      diasPlazo === null ||
      clienteCreditoFailed ||
      loadingClienteCredito ||
      limiteCredito <= 0 ||
      creditoFaltante > 0);
  const hasInvalidValues = cart.some(
    (item) =>
      !Number.isFinite(item.cantidad) ||
      item.cantidad <= 0 ||
      !Number.isFinite(item.precioUnitario) ||
      item.precioUnitario <= 0,
  );
  const validatingPrices = cart.some(
    (item) =>
      item.priceValidation?.status === "idle" ||
      item.priceValidation?.status === "checking",
  );
  const blockedPrice = cart.find(
    (item) =>
      item.priceValidation?.status === "invalid" ||
      item.priceValidation?.status === "error",
  );
  const confirmDisabled =
    cart.length === 0 ||
    !clientId ||
    (documentoTipo === "NOTA" &&
      clientId === "1" &&
      (!nombreDestinatario.trim() || !direccionEntregaSnapshot.trim())) ||
    crearTicket.isPending ||
    hasInvalidValues ||
    validatingPrices ||
    Boolean(blockedPrice);
    // Credit validation is intentionally based on the ledger-backed server
    // projection and is repeated atomically by the server.
  const finalConfirmDisabled = confirmDisabled || creditoBloqueado;

  const handleCreateTicket = () => {
    if (!selectedLocationId) {
      toast({
        title: "Selecciona un sitio válido",
        variant: "destructive",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Agrega al menos un producto al ticket",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Selecciona un cliente",
        description: "Toda venta debe asociarse a un cliente.",
        variant: "destructive",
      });
      return;
    }
    if (creditoBloqueado) {
      toast({
        title:
          diasPlazo === null
            ? "Elige el plazo de crédito"
            : "Crédito insuficiente",
        description:
          creditoFaltante > 0
            ? `Disponible: ${formatNumber(creditoDisponible, { kind: "money" })}. Faltan: ${formatNumber(creditoFaltante, { kind: "money" })}.`
            : limiteCredito <= 0
              ? "Este cliente tiene límite de crédito en cero."
              : "No se pudo validar el crédito disponible.",
        variant: "destructive",
      });
      return;
    }

    if (hasInvalidValues) {
      toast({
        title: "Revisa cantidades y precios",
        description: "Todos deben ser mayores a 0.",
        variant: "destructive",
      });
      return;
    }

    if (validatingPrices || blockedPrice) {
      toast({
        title: "Revisa los precios del ticket",
        description:
          blockedPrice?.priceValidation?.message ??
          "Espera a que termine la validación de precios.",
        variant: "destructive",
      });
      return;
    }

    if (documentoTipo === "NOTA" && clientId === "1") {
      if (!nombreDestinatario.trim() || !direccionEntregaSnapshot.trim()) {
        toast({
          title: "Faltan datos de entrega",
          description: "Para Notas de público en general, el nombre del destinatario y la dirección de entrega son obligatorios.",
          variant: "destructive",
        });
        return;
      }
    }

    const uuid = crypto.randomUUID();
    const lineas: TicketLineaInput[] = cart.flatMap((item) =>
      item.rollos
        ? item.rollos.map((rollo: PosRolloDisponible) => ({
      rolloId: rollo.id,
      productoId: item.producto.id,
      tipo: TipoTicket.NORMAL,
      cantidad: Number(rollo.cantidadActual),
      precioUnitario: Number(item.precioUnitario),
    }))
        : [{
            rolloId: null,
            productoId: item.producto.id,
            tipo: TipoTicket.METREADO,
            cantidad: Number(item.cantidad),
            precioUnitario: Number(item.precioUnitario),
          }],
    );

    const hasNormal = cart.some((item) => !item.isMetreado);
    const input: TicketInput = {
      uuidCliente: uuid,
      ubicacionId: selectedLocationId,
      tipo: hasNormal ? TipoTicket.NORMAL : TipoTicket.METREADO,
      facturado: hasNormal ? facturar : false,
      clienteId: Number(clientId),
      credito,
      diasPlazo: credito ? diasPlazo : null,
      lineas,
      documentoTipo: documentoTipo as "TICKET" | "NOTA",
      notaSinPrecios: documentoTipo === "NOTA" ? notaSinPrecios : false,
      nombreDestinatario: documentoTipo === "NOTA" && clientId === "1" ? nombreDestinatario.trim() : undefined,
      direccionEntregaSnapshot: documentoTipo === "NOTA" && clientId === "1" ? direccionEntregaSnapshot.trim() : undefined,
    };

    crearTicket.mutate(
      { data: input },
      {
        onSuccess: (ticket) => {
          toast({
            title: `${documentoTipo} creado correctamente`,
            description: `Folio: ${ticket.folio}`,
          });
          commitCart(() => []);
          setSearch("");
          setFacturar(false);
          setClientId("1");
          setClientName("Venta a Público");
          setCredito(false);
          setDiasPlazo(null);
          setDocumentoTipo(null);
          setNotaSinPrecios(false);
          setNombreDestinatario("");
          setDireccionEntregaSnapshot("");
          setImprimirTubulares(false);
          setLocation(
            `/tickets/${ticket.id}?print=3${imprimirTubulares ? "&tubulares=1" : ""}`,
          );
        },
        onError: (err: unknown) => {
          const message = getApiErrorMessage(
            err,
            "No se pudo crear el ticket.",
          );
          toast({
            title: "Error al crear ticket",
            description: message,
            variant: "destructive",
          });
          const data =
            err && typeof err === "object"
              ? (err as { data?: { code?: string } }).data
              : undefined;
          if (
            data?.code === "PRICE_BELOW_COST" ||
            data?.code === "ROLLO_SIN_COSTO"
          ) {
            commitCart((current) =>
              current.map((item) =>
                item.rollos?.some((rollo: PosRolloDisponible) =>
                  message.includes(String(rollo.serie)),
                )
                  ? {
                      ...item,
                      priceValidation: { status: "invalid", message },
                    }
                  : item,
              ),
            );
          }
        },
      },
    );
  };

  if (!selectedLocationId) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <div className="w-full max-w-md text-center text-muted-foreground">
          <HelpCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
          <h2 className="text-xl font-semibold text-foreground">
            Selecciona un sitio
          </h2>
          <p className="mb-5">
            Debes estar en un sitio específico para operar la terminal POS.
          </p>
          {canChooseLocation ? (
            <Select
              onValueChange={(value) => setSelectedLocationId(Number(value))}
            >
              <SelectTrigger className="bg-background text-left">
                <SelectValue
                  placeholder={
                    loadingLocations
                      ? "Cargando sitios..."
                      : "Seleccionar tienda o bodega"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableLocations?.map((location) => (
                  <SelectItem key={location.id} value={String(location.id)}>
                    {location.nombre}
                  </SelectItem>
                ))}
                {!loadingLocations && availableLocations?.length === 0 && (
                  <SelectItem value="none" disabled>
                    No hay sitios operativos activos
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-md border bg-muted/30 p-3 text-sm">
              Tu usuario no tiene un sitio asignado. Pide a un ADMIN que lo
              configure.
            </p>
          )}
          {locationsFailed && (
            <p className="mt-3 text-sm text-destructive">
              No se pudieron cargar los sitios. Recarga la página o vuelve
              a iniciar sesión.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!documentoTipo) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          <button
            onClick={() => setDocumentoTipo("TICKET")}
            className="flex flex-col items-center justify-center p-16 bg-card border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all shadow-sm group"
          >
            <Receipt className="h-24 w-24 text-muted-foreground group-hover:text-primary mb-6 transition-colors" />
            <span className="text-4xl font-black tracking-tight text-sidebar group-hover:text-primary transition-colors">TICKET</span>
          </button>
          <button
            onClick={() => setDocumentoTipo("NOTA")}
            className="flex flex-col items-center justify-center p-16 bg-card border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all shadow-sm group"
          >
            <FileText className="h-24 w-24 text-muted-foreground group-hover:text-primary mb-6 transition-colors" />
            <span className="text-4xl font-black tracking-tight text-sidebar group-hover:text-primary transition-colors">NOTA</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* Left side - Search and Results */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setDocumentoTipo(null);
              setNotaSinPrecios(false);
              commitCart(() => []);
            }}
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-sidebar"
            title="Cambiar tipo de documento"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar flex items-center gap-2">
              Terminal POS
              <span className="text-muted-foreground font-normal text-lg bg-muted px-2 py-0.5 rounded-md">
                {documentoTipo}
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Escanea o busca artículos para la venta.
            </p>
          </div>
        </div>

        <Tabs
          value={tipoTicket}
          onValueChange={(v) => setTipoTicket(v as TipoTicket)}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value={TipoTicket.NORMAL}>
              Venta de Rollos (NORMAL)
            </TabsTrigger>
            <TabsTrigger value={TipoTicket.METREADO}>
              Cortes (METREADO)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="flex-1 flex flex-col shadow-sm border-sidebar-border/10 overflow-hidden">
          <div className="p-4 border-b bg-muted/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <CampoEscaneo
                value={search}
                onChange={handleSearchChange}
                onScan={handleSearchScan}
                clearOnScan={false}
                placeholder={
                  tipoTicket === TipoTicket.NORMAL
                    ? "Buscar por serie de rollo, SKU o tela..."
                    : "Buscar por producto o SKU..."
                }
                className="pl-10 h-12 text-lg shadow-sm"
                containerClassName="w-full"
                autoFocus
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
            {skuWarning && (
              <div
                className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{skuWarning}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-secondary/20">
            {debouncedSearch.length < 2 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Escanea o escribe para buscar...
              </div>
            ) : searchFailed ? (
              <div
                className="h-full flex items-center justify-center text-center text-destructive"
                role="alert"
              >
                {getApiErrorMessage(
                  searchError,
                  "No se pudo realizar la búsqueda. Intenta de nuevo.",
                )}
              </div>
            ) : !searchResults ||
              (searchResults.rollos.length === 0 &&
                searchResults.productos.length === 0) ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No se encontraron resultados para "{debouncedSearch}"
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
                {tipoTicket === TipoTicket.NORMAL &&
                  searchResults.rollos.map((rollo: PosRolloDisponible) => (
                    <Card
                      key={rollo.id}
                      className="overflow-hidden hover:border-primary/50 transition-colors shadow-sm"
                    >
                      <div className="p-4 flex gap-4 items-center justify-between">
                        <div className="overflow-hidden">
                          <div className="font-bold text-base truncate">
                            {rollo.tela} - {rollo.color}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-sm font-semibold">
                              {rollo.serie}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {rollo.sku}
                            </span>
                          </div>
                          <div className="text-sm mt-2 text-muted-foreground">
                            Disp:{" "}
                            <span className="font-semibold text-foreground">
                               {formatNumber(rollo.cantidadActual, { kind: "quantity" })} {formatUnit(rollo.unidad)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <div className="font-bold text-lg">
                            {formatNumber(rollo.precioSugerido, { kind: "money" })}
                            /{formatUnit(rollo.unidad)}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addToCart(rollo)}
                            disabled={
                              !!cart.find((c) => c.rollo?.id === rollo.id)
                            }
                          >
                            <Plus className="h-4 w-4 mr-1" /> Agregar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                {tipoTicket === TipoTicket.METREADO &&
                  searchResults.productos
                    .filter((prod: PosProducto) => (prod.unidad === "METRO" || prod.unidad === "BOLSA") && prod.seVendePorMetro)
                    .map((prod: PosProducto) => (
                    <Card
                      key={prod.id}
                      className="overflow-hidden hover:border-primary/50 transition-colors shadow-sm"
                    >
                      <div className="p-4 flex gap-4 items-center justify-between">
                        <div className="overflow-hidden">
                          <div className="font-bold text-base truncate">
                            {prod.tela} - {prod.color}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {prod.sku}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 shrink-0">
                          <div className="font-bold text-lg">
                             {formatNumber(prod.precioMenudeo, { kind: "money" })}
                            /{formatUnit(prod.unidad)}
                          </div>
                           <div className="text-xs text-muted-foreground text-right">
                             Mayoreo: {formatNumber(prod.precioMayoreo, { kind: "money" })} · desde {mayoreoThresholdForUnit(prod.unidad)} {formatUnit(prod.unidad)}
                           </div>
                          <Button
                            size="sm"
                            onClick={() => addToCart(prod)}
                            variant="secondary"
                          >
                            <Plus className="h-4 w-4 mr-1" /> Seleccionar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Right side - Cart */}
      <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col">
        <Card className="flex-1 flex flex-col shadow-md border-sidebar-primary/20 bg-white">
          <CardHeader className="bg-sidebar text-white rounded-t-lg pb-4">
            <CardTitle className="flex justify-between items-center text-lg">
              <span>Ticket de Venta</span>
              <span className="bg-white/20 text-white px-2 py-0.5 rounded text-sm">
                {cart.length} renglones
              </span>
            </CardTitle>
          </CardHeader>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <ShoppingCart className="h-16 w-16 mb-4" />
                <p>El ticket está vacío</p>
              </div>
            ) : (
              <div className="space-y-1">
                {cart.map((item, idx) => (
                  <CartLineItem
                    key={getCartLineKey(item)}
                    item={{
                      ...item,
                      onRemoveRollo: (rolloId: number) => removeRolloFromGroup(idx, rolloId),
                    }}
                    lineKey={getCartLineKey(item)}
                    locationId={selectedLocationId}
                    priceValidation={item.priceValidation ?? { status: "idle" }}
                    onPriceValidationChange={updateCartPriceValidation}
                    onRemove={() => removeFromCart(idx)}
                    isMetreado={item.isMetreado}
                    onChangeQuantity={(qty) => updateCartQuantity(idx, qty)}
                    onChangePrice={(price) => updateCartPrice(idx, price)}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <CardFooter className="flex-col items-stretch p-5 bg-muted/10 gap-4">
            <div className="flex items-center space-x-2 bg-secondary/50 p-3 rounded-md">
              <Checkbox
                id="facturar"
                checked={facturar}
                onCheckedChange={(v) => setFacturar(v as boolean)}
              />
              <div>
                <Label
                  htmlFor="facturar"
                  className="font-semibold cursor-pointer"
                >
                  Requiere Factura
                </Label>
                <p className="text-xs text-muted-foreground">
                  El precio negociado es antes de IVA.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-secondary/50 p-3 rounded-md">
              <Checkbox
                id="imprimir-tubulares"
                checked={imprimirTubulares}
                onCheckedChange={(value) => setImprimirTubulares(value === true)}
                data-testid="imprimir-tubulares"
              />
              <div>
                <Label
                  htmlFor="imprimir-tubulares"
                  className="font-semibold cursor-pointer"
                >
                  Imprimir tubulares
                </Label>
                <p className="text-xs text-muted-foreground">
                  Agrega una tira por color de los rollos identificados.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg bg-primary/5 p-4">
              {facturar ? (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>
                       {formatNumber(cartSubtotal, { kind: "money" })}
                    </span>
                  </div>
                  <div
                    className="flex justify-between text-sm text-muted-foreground"
                    data-testid="pos-iva"
                  >
                    <span>IVA (16%)</span>
                    <span>
                       {formatNumber(cartIva, { kind: "money" })}
                    </span>
                  </div>
                </>
              ) : null}
              <div
                className={`flex justify-between items-end ${facturar ? "border-t border-primary/15 pt-2" : ""}`}
              >
                <span className="text-muted-foreground font-medium">Total</span>
                <span
                  className="text-3xl font-bold tracking-tight text-primary"
                  data-testid="pos-total"
                >
                   {formatNumber(cartTotal, { kind: "money" })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Cliente <span aria-hidden="true">*</span>
              </Label>
              <ClientSelector
                value={clientId ? Number(clientId) : null}
                required
                onChange={(client) => {
                  setClientId(String(client.id));
                  setClientName(client.nombre);
                  setCredito(false);
                  setDiasPlazo(allowedCreditTerm(client.diasCredito));
                  if (documentoTipo === "NOTA") {
                    setNotaSinPrecios(client.recibeNotaSinPrecios || false);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground" data-testid="text-ticket-client">
                El ticket se emitirá a nombre de {clientName}.
              </p>
              {clientId !== "1" && (
                <div className="space-y-3 rounded-md border p-3">
                  {loadingClienteCredito ? (
                    <p className="text-sm text-muted-foreground">Consultando libro mayor de crédito…</p>
                  ) : clienteCreditoFailed ? (
                    <p className="text-sm text-destructive" role="alert">No se pudo consultar el crédito disponible.</p>
                  ) : clienteCredito ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">Crédito disponible</span>
                        <strong data-testid="credito-disponible">
                          {formatNumber(creditoDisponible, { kind: "money" })}
                        </strong>
                      </div>
                      {limiteCredito <= 0 && (
                        <p className="text-sm font-medium text-destructive" role="alert">
                          Este cliente tiene límite de crédito en cero y no puede comprar a crédito.
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="venta-credito"
                          checked={credito}
                          disabled={limiteCredito <= 0}
                          onCheckedChange={(checked) => setCredito(checked === true)}
                        />
                        <Label htmlFor="venta-credito">Venta a crédito</Label>
                      </div>
                      {credito && (
                        <div className="space-y-2">
                          <Label>Plazo de esta venta</Label>
                          <Select
                            value={diasPlazo == null ? undefined : String(diasPlazo)}
                            onValueChange={(value) => setDiasPlazo(Number(value) as CreditTerm)}
                          >
                            <SelectTrigger data-testid="select-credit-term">
                              <SelectValue placeholder="Elige 7, 15, 30 o 60 días" />
                            </SelectTrigger>
                            <SelectContent>
                              {CREDIT_TERMS.map((term) => (
                                <SelectItem key={term} value={String(term)}>{term} días</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {creditoFaltante > 0 ? (
                            <p className="text-sm font-medium text-destructive" role="alert">
                              Disponible: {formatNumber(creditoDisponible, { kind: "money" })}. Faltan: {formatNumber(creditoFaltante, { kind: "money" })}.
                            </p>
                          ) : creditoCercaDelLimite ? (
                            <p className="text-sm font-medium text-amber-700" role="status">
                              Esta venta está cerca del límite; quedarían {formatNumber(creditoDisponible - cartTotal, { kind: "money" })} disponibles.
                            </p>
                          ) : null}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
              {clientId === "1" && (
                <p className="text-sm font-medium text-muted-foreground">
                  Venta a Público no admite compras a crédito.
                </p>
              )}
            </div>

            {documentoTipo === "NOTA" && (
              <div className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-sidebar">Formato de Nota</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setNotaSinPrecios(false)}
                      className={`flex flex-col items-center justify-center p-3 border rounded-md transition-all ${
                        !notaSinPrecios
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                          : "border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="font-semibold text-sm">Nota con precios</span>
                      <span className="text-[10px] mt-1 opacity-80 text-center">Formato estándar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotaSinPrecios(true)}
                      className={`flex flex-col items-center justify-center p-3 border rounded-md transition-all ${
                        notaSinPrecios
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                          : "border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="font-semibold text-sm">Nota de Productos</span>
                      <span className="text-[10px] mt-1 opacity-80 text-center">Sin importes ni totales</span>
                    </button>
                  </div>
                </div>

                {clientId === "1" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="nombreDestinatario" className="text-sm font-bold text-sidebar">
                        Nombre del Destinatario <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="nombreDestinatario"
                        value={nombreDestinatario}
                        onChange={(e) => setNombreDestinatario(e.target.value)}
                        placeholder="Nombre completo de quien recibe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="direccionEntrega" className="text-sm font-bold text-sidebar">
                        Dirección de Entrega <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="direccionEntrega"
                        value={direccionEntregaSnapshot}
                        onChange={(e) => setDireccionEntregaSnapshot(e.target.value)}
                        placeholder="Calle, número, colonia, ciudad..."
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {(validatingPrices || blockedPrice) && (
              <p
                className={`text-sm ${blockedPrice ? "text-destructive" : "text-muted-foreground"}`}
                role={blockedPrice ? "alert" : "status"}
                data-testid="confirmar-venta-explicacion"
              >
                {blockedPrice
                  ? "Corrige los precios marcados antes de confirmar la venta."
                  : "Validando precios antes de confirmar…"}
              </p>
            )}

            <Button
              size="lg"
              className="w-full h-14 text-lg font-bold mt-2"
              disabled={finalConfirmDisabled}
              onClick={handleCreateTicket}
              data-testid="button-confirmar-venta"
            >
              {crearTicket.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5" />
              )}
              {crearTicket.isPending ? "Enviando venta…" : "Confirmar Venta"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// Minimal icon that was missing from lucide-react import
function ShoppingCart(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
