import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useCrearSalidaDineroCaja,
  useListarSalidasDineroCaja,
  useListarProveedoresActivosCaja,
  useGetCurrentUser,
  getListarSalidasDineroCajaQueryKey,
  getObtenerCorteCajaQueryKey,
  getObtenerSesionCajaActualQueryKey,
  getListarSesionesCajaQueryKey,
  getListarProveedoresActivosCajaQueryKey,
  Role,
} from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { formatAccountDestination } from "@workspace/number-format";
import { getApiErrorMessage } from "@/lib/api-error";
import { SalidaDineroE4Item } from "./salidas-dinero-e4-item";

export function SalidasDineroE4Panel({ sesionId, canCreate, tiendaId }: { sesionId: number; canCreate: boolean; tiendaId?: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedorId, setProveedorId] = useState<string>("none");
  const [cuentaOrigen, setCuentaOrigen] = useState<"CAJA_FISICA" | "CUENTA_NO_FISCAL" | "CUENTA_FISCAL">("CAJA_FISICA");
  const [tipo, setTipo] = useState<"EXTRAORDINARIA" | "PROVEEDOR">("EXTRAORDINARIA");
  const isSubmitting = useRef(false);
  const lastIntention = useRef({ snapshot: "", uuid: crypto.randomUUID() });

  const { data: user } = useGetCurrentUser();
  const isAdmin = user?.rol === Role.ADMIN;
  // If MARIANA_LOCATION_ID = 1, it's defined in cobros.tsx but we can check if it's 1
  const isMariana = tiendaId === 1;

  const { data, isLoading, isError, error } = useListarSalidasDineroCaja(sesionId, { query: { queryKey: getListarSalidasDineroCajaQueryKey(sesionId) } });
  const { data: proveedores = [] } = useListarProveedoresActivosCaja({ query: { enabled: isMariana, queryKey: getListarProveedoresActivosCajaQueryKey() } });
  const crear = useCrearSalidaDineroCaja();

  useEffect(() => {
    if (tipo === "EXTRAORDINARIA") {
      setProveedorId("none");
      setCuentaOrigen("CAJA_FISICA");
    }
  }, [tipo]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting.current) return;

    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0 || !motivo.trim()) {
      toast({ title: "Captura un monto mayor a cero y un motivo.", variant: "destructive" });
      return;
    }

    if (tipo === "PROVEEDOR" && (proveedorId === "none" || !proveedorId)) {
      toast({ title: "Debes seleccionar un proveedor activo.", variant: "destructive" });
      return;
    }

    const currentSnapshot = JSON.stringify({
      monto: valor.toFixed(2),
      motivo: motivo.trim(),
      cuentaOrigen,
      proveedorId: proveedorId !== "none" ? Number(proveedorId) : null,
      tipo
    });

    if (lastIntention.current.snapshot !== currentSnapshot) {
      lastIntention.current = { snapshot: currentSnapshot, uuid: crypto.randomUUID() };
    }

    isSubmitting.current = true;
    crear.mutate(
      {
        id: sesionId,
        data: {
          monto: valor.toFixed(2),
          motivo: motivo.trim(),
          cuentaOrigen,
          proveedorId: proveedorId !== "none" ? Number(proveedorId) : null,
          tipo,
          claveOperacion: lastIntention.current.uuid,
        },
      },
      {
        onSuccess: () => {
          setMonto("");
          setMotivo("");
          setProveedorId("none");
          setTipo("EXTRAORDINARIA");
          lastIntention.current = { snapshot: "", uuid: crypto.randomUUID() };
          queryClient.invalidateQueries({ queryKey: getListarSalidasDineroCajaQueryKey(sesionId) });
          queryClient.invalidateQueries({ queryKey: getObtenerCorteCajaQueryKey(sesionId) });
          queryClient.invalidateQueries({ queryKey: getObtenerSesionCajaActualQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListarSesionesCajaQueryKey() });
          toast({ title: "Salida de dinero registrada." });
        },
        onError: (err: unknown) => {
          toast({
            title: "No se pudo registrar la salida",
            description: getApiErrorMessage(err, "Intenta nuevamente."),
            variant: "destructive",
          });
        },
        onSettled: () => {
          isSubmitting.current = false;
        }
      }
    );
  };

  // For capturing, ADMIN can anywhere authorized.
  // CAJA/SUPERVISOR can only in their store (handled by backend but UI should match)
  // "PROVEEDOR: exclusivamente Mariana (id constante 1)"
  const canCaptureProveedor = isMariana;

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="text-lg">Salidas de dinero</CardTitle>
        <CardDescription>Pagos operativos y extraordinarios (E4).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {canCreate && (
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 bg-muted/20 p-4 rounded-lg border" aria-label="Registrar salida de dinero">
            <div>
              <Label htmlFor="salida-tipo">Tipo de Salida</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)} disabled={crear.isPending}>
                <SelectTrigger id="salida-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXTRAORDINARIA">Extraordinaria</SelectItem>
                  {canCaptureProveedor && <SelectItem value="PROVEEDOR">Proveedor</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="salida-monto">Monto</Label>
              <Input id="salida-monto" type="number" min="0.01" step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} disabled={crear.isPending} />
            </div>

            <div>
              <Label htmlFor="salida-cuenta">Cuenta de origen</Label>
              <Select value={cuentaOrigen} onValueChange={(v) => setCuentaOrigen(v as any)} disabled={tipo === "EXTRAORDINARIA" || crear.isPending}>
                <SelectTrigger id="salida-cuenta"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAJA_FISICA">{formatAccountDestination("CAJA_FISICA")}</SelectItem>
                  {tipo === "PROVEEDOR" && (
                    <>
                      <SelectItem value="CUENTA_NO_FISCAL">{formatAccountDestination("CUENTA_NO_FISCAL")}</SelectItem>
                      <SelectItem value="CUENTA_FISCAL">{formatAccountDestination("CUENTA_FISCAL")}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {tipo === "EXTRAORDINARIA" && <p className="text-xs text-muted-foreground mt-1">Siempre Caja Física.</p>}
            </div>

            <div>
              <Label htmlFor="salida-proveedor">Proveedor</Label>
              <Select value={proveedorId} onValueChange={setProveedorId} disabled={tipo === "EXTRAORDINARIA" || crear.isPending}>
                <SelectTrigger id="salida-proveedor">
                  <SelectValue placeholder={tipo === "EXTRAORDINARIA" ? "No aplica" : "Selecciona proveedor"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="salida-motivo">Motivo</Label>
              <Input id="salida-motivo" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={crear.isPending} />
            </div>

            <Button type="submit" disabled={crear.isPending} className="md:col-span-2">
              {crear.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar salida {tipo.toLowerCase()}
            </Button>
          </form>
        )}

        <div>
          <h4 className="font-semibold text-sidebar mb-3">Registro de Salidas</h4>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando salidas…</p>
          ) : isError ? (
            <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(error, "No se pudieron cargar las salidas.")}</p>
          ) : (
            <div className="space-y-4">
              {data?.salidas.length ? (
                data.salidas.map((salida) => {
                  const proveedor = proveedores.find((p) => p.id === salida.proveedorId);
                  return (
                    <SalidaDineroE4Item
                      key={salida.id}
                      salida={salida}
                      nombreProveedor={proveedor?.nombre}
                      sesionId={sesionId}
                      userRole={user?.rol}
                      userUbicacionId={user?.ubicacion?.id}
                      tiendaId={tiendaId}
                    />
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded border border-dashed">Sin salidas registradas.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
