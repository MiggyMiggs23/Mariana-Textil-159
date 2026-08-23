import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Search, Plus, Trash2, Printer, Ban, Receipt, CheckCircle, HelpCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useBuscarPos,
  useCrearTicket,
  useListarTickets,
  getListarTicketsQueryKey,
  getBuscarPosQueryKey,
  TipoTicket,
  PosRolloDisponible,
  PosProducto,
  TicketLineaInput,
  TicketInput
} from "@workspace/api-client-react";

import { useLocationScope } from "@/lib/location-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Componente Cart Line para el POS
function CartLineItem({ 
  item, 
  onRemove, 
  isMetreado,
  onChangeQuantity 
}: { 
  item: any, 
  onRemove: () => void, 
  isMetreado: boolean,
  onChangeQuantity?: (qty: number) => void 
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{item.producto.tela} - {item.producto.color}</span>
          {!isMetreado && item.rollo && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
              {item.rollo.serie}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {item.producto.sku} • {item.precioUnitario.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/{item.producto.unidad}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {isMetreado ? (
          <div className="w-20">
            <Input 
              type="number" 
              min="0.1" 
              step="0.1" 
              value={item.cantidad} 
              onChange={(e) => onChangeQuantity && onChangeQuantity(Number(e.target.value) || 0)}
              className="h-8 text-right font-mono"
            />
          </div>
        ) : (
          <div className="font-mono text-sm">{item.cantidad} {item.producto.unidad}</div>
        )}
        
        <div className="w-24 text-right font-bold">
          {(item.cantidad * item.precioUnitario).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
        </div>
        
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function PosPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { selectedLocationId } = useLocationScope();
  const queryClient = useQueryClient();

  const [tipoTicket, setTipoTicket] = useState<TipoTicket>(TipoTicket.NORMAL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Timer for debouncing search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Cart state
  const [cart, setCart] = useState<any[]>([]);
  const [facturar, setFacturar] = useState(false);
  const [clientId, setClientId] = useState<string>("");

  const searchParams = useMemo(() => ({
    q: debouncedSearch,
    tipo: tipoTicket,
    ubicacionId: selectedLocationId || 0
  }), [debouncedSearch, tipoTicket, selectedLocationId]);

  const { data: searchResults, isFetching } = useBuscarPos(searchParams, {
    query: {
      enabled: debouncedSearch.length >= 2 && !!selectedLocationId,
      queryKey: getBuscarPosQueryKey(searchParams)
    }
  });

  const crearTicket = useCrearTicket();

  // Reset cart when ticket type changes
  useEffect(() => {
    setCart([]);
    setFacturar(false);
  }, [tipoTicket]);

  const addToCart = (item: any) => {
    // Para NORMAL, añadir el rollo
    if (tipoTicket === TipoTicket.NORMAL) {
      if (cart.find(c => c.rollo?.id === item.id)) {
        toast({ title: "El rollo ya está en el ticket", variant: "destructive" });
        return;
      }
      setCart([...cart, {
        rollo: item,
        producto: { id: item.productoId, sku: item.sku, tela: item.tela, color: item.color, unidad: item.unidad },
        cantidad: Number(item.cantidadActual),
        precioUnitario: Number(item.precioSugerido)
      }]);
    } else {
      // Para METREADO, añadir producto con cantidad 1 (editable luego)
      if (cart.find(c => c.producto.id === item.id)) {
        toast({ title: "El producto ya está en el ticket. Ajusta la cantidad.", variant: "default" });
        return;
      }
      setCart([...cart, {
        rollo: null,
        producto: item,
        cantidad: 1,
        precioUnitario: Number(item.precioSugerido)
      }]);
    }
    setSearch("");
  };

  const updateCartQuantity = (index: number, qty: number) => {
    const newCart = [...cart];
    newCart[index].cantidad = qty;
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);

  const handleCreateTicket = () => {
    if (!selectedLocationId) {
      toast({ title: "Selecciona una ubicación válida", variant: "destructive" });
      return;
    }
    
    if (cart.length === 0) return;
    
    if (cart.some(item => isNaN(item.cantidad) || item.cantidad <= 0)) {
      toast({ title: "Revisa las cantidades", description: "Las cantidades deben ser mayores a 0.", variant: "destructive" });
      return;
    }

    const uuid = crypto.randomUUID();
    const lineas: TicketLineaInput[] = cart.map(item => ({
      rolloId: item.rollo?.id || null,
      productoId: item.producto.id,
      cantidad: Number(item.cantidad),
      precioUnitario: Number(item.precioUnitario)
    }));

    const input: TicketInput = {
      uuidCliente: uuid,
      ubicacionId: selectedLocationId,
      tipo: tipoTicket,
      facturado: tipoTicket === TipoTicket.NORMAL ? facturar : false,
      clienteId: clientId ? Number(clientId) : null,
      lineas
    };

    crearTicket.mutate({ data: input }, {
      onSuccess: (ticket) => {
        toast({ title: "Ticket creado correctamente", description: `Folio: ${ticket.folio}` });
        setCart([]);
        setSearch("");
        setFacturar(false);
        setLocation(`/tickets/${ticket.id}`);
      },
      onError: (err: any) => {
        toast({ 
          title: "Error al crear ticket", 
          description: err?.message || err?.error || "Error desconocido", 
          variant: "destructive" 
        });
      }
    });
  };

  if (!selectedLocationId) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <HelpCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
          <h2 className="text-xl font-semibold text-foreground">Selecciona una ubicación</h2>
          <p>Debes estar en una ubicación específica para operar la terminal POS.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full max-w-[1600px] mx-auto">
      {/* Left side - Search and Results */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-sidebar">Terminal POS</h1>
            <p className="text-muted-foreground text-sm">Escanea o busca artículos para la venta.</p>
          </div>
          <Link href="/tickets">
            <Button variant="outline" size="sm">
              <Receipt className="mr-2 h-4 w-4" />
              Tickets Recientes
            </Button>
          </Link>
        </div>

        <Tabs 
          value={tipoTicket} 
          onValueChange={(v) => setTipoTicket(v as TipoTicket)}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value={TipoTicket.NORMAL}>Venta de Rollos (NORMAL)</TabsTrigger>
            <TabsTrigger value={TipoTicket.METREADO}>Cortes (METREADO)</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="flex-1 flex flex-col shadow-sm border-sidebar-border/10 overflow-hidden">
          <div className="p-4 border-b bg-muted/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tipoTicket === TipoTicket.NORMAL ? "Buscar por serie de rollo, SKU o tela..." : "Buscar por producto o SKU..."}
                className="pl-10 h-12 text-lg shadow-sm"
                autoFocus
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-secondary/20">
            {debouncedSearch.length < 2 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Escanea o escribe para buscar...
              </div>
            ) : !searchResults || (searchResults.rollos.length === 0 && searchResults.productos.length === 0) ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No se encontraron resultados para "{debouncedSearch}"
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
                {tipoTicket === TipoTicket.NORMAL && searchResults.rollos.map((rollo: PosRolloDisponible) => (
                  <Card key={rollo.id} className="overflow-hidden hover:border-primary/50 transition-colors shadow-sm">
                    <div className="p-4 flex gap-4 items-center justify-between">
                      <div className="overflow-hidden">
                        <div className="font-bold text-base truncate">{rollo.tela} - {rollo.color}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-sm font-semibold">
                            {rollo.serie}
                          </span>
                          <span className="text-xs text-muted-foreground">{rollo.sku}</span>
                        </div>
                        <div className="text-sm mt-2 text-muted-foreground">
                          Disp: <span className="font-semibold text-foreground">{rollo.cantidadActual} {rollo.unidad}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="font-bold text-lg">
                          {Number(rollo.precioSugerido).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/{rollo.unidad}
                        </div>
                        <Button size="sm" onClick={() => addToCart(rollo)} disabled={!!cart.find(c => c.rollo?.id === rollo.id)}>
                          <Plus className="h-4 w-4 mr-1" /> Agregar
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {tipoTicket === TipoTicket.METREADO && searchResults.productos.map((prod: PosProducto) => (
                  <Card key={prod.id} className="overflow-hidden hover:border-primary/50 transition-colors shadow-sm">
                    <div className="p-4 flex gap-4 items-center justify-between">
                      <div className="overflow-hidden">
                        <div className="font-bold text-base truncate">{prod.tela} - {prod.color}</div>
                        <div className="text-xs text-muted-foreground mt-1">{prod.sku}</div>
                      </div>
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="font-bold text-lg">
                          {Number(prod.precioSugerido).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}/{prod.unidad}
                        </div>
                        <Button size="sm" onClick={() => addToCart(prod)} variant="secondary">
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
              <span>Ticket {tipoTicket === TipoTicket.NORMAL ? "Normal" : "Metreado"}</span>
              <span className="bg-white/20 text-white px-2 py-0.5 rounded text-sm">{cart.length} líneas</span>
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
                    key={idx} 
                    item={item} 
                    onRemove={() => removeFromCart(idx)} 
                    isMetreado={tipoTicket === TipoTicket.METREADO}
                    onChangeQuantity={(qty) => updateCartQuantity(idx, qty)}
                  />
                ))}
              </div>
            )}
          </div>
          
          <Separator />
          
          <CardFooter className="flex-col items-stretch p-5 bg-muted/10 gap-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-muted-foreground font-medium">Total</span>
              <span className="text-3xl font-bold tracking-tight text-primary">
                {cartTotal.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
              </span>
            </div>
            
            {tipoTicket === TipoTicket.NORMAL && (
              <div className="flex items-center space-x-2 bg-secondary/50 p-3 rounded-md">
                <Checkbox id="facturar" checked={facturar} onCheckedChange={(v) => setFacturar(v as boolean)} />
                <Label htmlFor="facturar" className="font-semibold cursor-pointer">Requiere Factura</Label>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cliente (Opcional)</Label>
              <Input 
                placeholder="ID de cliente..." 
                value={clientId} 
                onChange={(e) => setClientId(e.target.value)}
                className="h-9"
              />
            </div>
            
            <Button 
              size="lg" 
              className="w-full h-14 text-lg font-bold mt-2" 
              disabled={cart.length === 0 || crearTicket.isPending}
              onClick={handleCreateTicket}
            >
              {crearTicket.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
              Confirmar Venta
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
  )
}
