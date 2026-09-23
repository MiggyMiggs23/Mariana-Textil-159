import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useCrearSalidaDineroCaja,
  useListarSalidasDineroCaja,
  useListarProveedoresActivosCaja,
  useGetCurrentUser,
  useObtenerCorteCaja,
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
import { E4_CASH_OUT_ENABLED } from "@/lib/e4-feature-flags";
import { cents } from "@/components/proveedor-efectivo-e12";
import { SalidaDineroE4Item } from "./salidas-dinero-e4-item";

export function SalidasDineroE4Panel({ sesionId, canCreate, tiendaId }: { sesionId: number; canCreate: boolean; tiendaId?: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedorId, setProveedorId] = useState<string>("none");
  const [cuentaOrigen, setCuentaOrigen] = useState<"CAJA_FISICA" | "CUENTA_NO_FISCAL" | "CUENTA_FISCAL">("CAJA_FISICA");
  const [tipo, setTipo] = useState<"EXTRAORDINARIA" | "PROVEEDOR">("EXTRAORDINARIA");
  const [desbloqueoMotivo, setDesbloqueoMotivo] = useState("");
  const isSubmitting = useRef(false);
  const [checking, setChecking] = useState(false);
  const lastIntention = useRef({ snapshot: "", uuid: crypto.randomUUID() });

  const { data: user } = useGetCurrentUser();
  const isAdmin = user?.rol === Role.ADMIN;
  // If MARIANA_LOCATION_ID = 1, it's defined in cobros.tsx but we can check if it's 1
  const isMariana = tiendaId === 1;

  const { data, isLoading, isError, error } = useListarSalidasDineroCaja(sesionId, { query: {
    queryKey: [...getListarSalidasDineroCajaQueryKey(sesionId), JSON.stringify(user)],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  } });
  const { data: proveedores = [] } = useListarProveedoresActivosCaja({ query: { enabled: isMariana, queryKey: getListarProveedoresActivosCajaQueryKey() } });
  const crear = useCrearSalidaDineroCaja();
  const requiresCashValidation = E4_CASH_OUT_ENABLED && cuentaOrigen === "CAJA_FISICA";
  const disponibilidad = useObtenerCorteCaja(sesionId, { query: {
    enabled: requiresCashValidation && canCreate && !!user,
    queryKey: [...getObtenerCorteCajaQueryKey(sesionId), JSON.stringify(user)],
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true,
    refetchInterval: requiresCashValidation && canCreate ? 15000 : false,
  } });

  useEffect(() => {
    setCuentaOrigen("CAJA_FISICA");
    if (tipo === "EXTRAORDINARIA") setProveedorId("none");
  }, [tipo]);

  const submit = async (event: React.FormEvent) => {
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
    isSubmitting.current = true;
    let applyCashUnlock = false;
    if (requiresCashValidation) {
      setChecking(true);
      try {
        const importe = cents(monto);
        if (importe === null || importe <= 0) throw new Error("Captura un importe positivo con máximo dos decimales.");
        const fresh = await disponibilidad.refetch();
        if (fresh.error) throw fresh.error;
        if (fresh.data?.sesion.estado !== "ABIERTA") throw new Error("La sesión de Caja ya no está abierta.");
        const saldo = fresh.data?.efectivoEsperado;
        if (saldo == null || !Number.isFinite(Number(saldo))) throw new Error("Saldo de Caja no disponible.");
        const isInsufficient = importe > Math.round(Number(saldo) * 100);
        if (isInsufficient) {
          if (tipo === "PROVEEDOR") {
            throw new Error("Saldo de Caja insuficiente. Las salidas a proveedor no admiten desbloqueo.");
          }
          if (!isAdmin || !desbloqueoMotivo.trim()) {
            throw new Error("Saldo de Caja insuficiente. Solo ADMIN puede autorizar una salida extraordinaria con motivo explícito.");
          }
          applyCashUnlock = true;
        }
      } catch (err) {
        toast({ title: "No se pudo registrar la salida", description: getApiErrorMessage(err), variant: "destructive" });
        isSubmitting.current = false;
        setChecking(false);
        return;
      }
      setChecking(false);
    }

    const currentSnapshot = JSON.stringify({
      sesionId, tiendaId, usuarioId: user?.id,
      desbloqueoMotivo,
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
          ...(applyCashUnlock ? { desbloqueoCaja: { motivo: desbloqueoMotivo.trim() } } : {}),
        },
      },
      {
        onSuccess: () => {
          setMonto("");
          setMotivo("");
          setProveedorId("none");
          setTipo("EXTRAORDINARIA");
          setDesbloqueoMotivo("");
          lastIntention.current = { snapshot: "", uuid: crypto.randomUUID() };
          queryClient.invalidateQueries({ queryKey: getListarSalidasDineroCajaQueryKey(sesionId) });
          queryClient.invalidateQueries({ queryKey: getObtenerCorteCajaQueryKey(sesionId) });
          queryClient.invalidateQueries({ queryKey: getObtenerSesionCajaActualQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListarSesionesCajaQueryKey() });
          queryClient.invalidateQueries({ predicate: ({ queryKey }) => {
            const url = queryKey[0];
            return typeof url === "string" && /^\/api\/(salidas-dinero-caja|caja|sesiones-caja|cortes)(\/|$|\?)/.test(url);
          } });
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
          <form onSubmit={submit} aria-label="Registrar salida de dinero">
            <fieldset disabled={checking || crear.isPending} className="grid gap-4 md:grid-cols-2 bg-muted/20 p-4 rounded-lg border">
            <div>
              <Label htmlFor="salida-tipo">Tipo de Salida</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "EXTRAORDINARIA" | "PROVEEDOR")} disabled={crear.isPending || checking}>
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
              <Select value={cuentaOrigen} onValueChange={(v) => setCuentaOrigen(v as typeof cuentaOrigen)} disabled>
                <SelectTrigger id="salida-cuenta"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAJA_FISICA">{formatAccountDestination("CAJA_FISICA")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">E4 opera exclusivamente con Caja Física; Fondo y mezcla E12 están desactivados.</p>
            </div>

            <div>
              <Label htmlFor="salida-proveedor">Proveedor</Label>
              <Select value={proveedorId} onValueChange={setProveedorId} disabled={tipo === "EXTRAORDINARIA" || crear.isPending || checking}>
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


            {requiresCashValidation && <p className="md:col-span-2 text-sm">Saldo Caja (servidor): {disponibilidad.data?.efectivoEsperado ?? "Consultando disponibilidad"}. Se revalida al confirmar; la API conserva la autoridad final.</p>}
            {requiresCashValidation && disponibilidad.error && <p role="alert" className="text-destructive">{getApiErrorMessage(disponibilidad.error)}</p>}
            {(isAdmin && requiresCashValidation && tipo === "EXTRAORDINARIA") && (
              <div className="md:col-span-2 space-y-1 mt-2 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <Label htmlFor="salida-desbloqueo" className="text-xs font-bold text-amber-900">Motivo de desbloqueo extraordinario (solo si hay insuficiencia)</Label>
                <Input id="salida-desbloqueo" maxLength={1000} value={desbloqueoMotivo} onChange={(e) => setDesbloqueoMotivo(e.target.value)} disabled={crear.isPending || checking} placeholder="Justificación obligatoria cuando Caja es insuficiente" className="bg-white" />
              </div>
            )}

            <Button type="submit" disabled={crear.isPending || checking} className="md:col-span-2">
              {crear.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar salida {tipo.toLowerCase()}
            </Button>
            </fieldset>
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
