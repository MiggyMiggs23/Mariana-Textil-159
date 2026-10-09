import { useEffect, useRef, useState } from "react";
import { useGetCurrentUser, getGetCurrentUserQueryKey, useGetOpcionesPagoEfectivoProveedor, getGetOpcionesPagoEfectivoProveedorQueryKey, type E12PagoEfectivoInput, type E12PagoEfectivoDetalle, type E12OpcionesPagoEfectivo } from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";
import { E12_ENABLED } from "@/lib/e12-feature-flags";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-error";

export function cents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

// Consumes the server balance; never reconstructs Caja from sales or movements.
export function cajaOverrideProblem(enabled: boolean, importe: number, saldo: string | null | undefined, admin: boolean, motivo: string) {
  if (!enabled || importe === 0) return null;
  if (saldo == null || !Number.isFinite(Number(saldo))) return "Saldo de Caja no disponible.";
  if (motivo.trim().length > 1000) return "El motivo admite máximo 1000 caracteres.";
  if (importe > Math.round(Number(saldo) * 100) && (!admin || !motivo.trim())) return "Saldo de Caja insuficiente. Solo ADMIN puede autorizarlo con motivo explícito.";
  return null;
}

export function invalidateE12(client: QueryClient, admin: boolean) {
  return client.invalidateQueries({ predicate: ({ queryKey }) => {
    const url = queryKey[0];
    return typeof url === "string" && (
      /^\/api\/(proveedores|pagos-dirigidos|solicitudes-pago-dirigido|caja|sesiones-caja|cortes|salidas-dinero-caja)(\/|$|\?)/.test(url) ||
      (admin && url.startsWith("/api/fondo"))
    );
  } });
}

export function useProveedorEfectivoE12(proveedorId: number, active: boolean, open: boolean, total: string) {
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), enabled: E12_ENABLED && active && open } });
  const admin = user?.rol === "ADMIN";
  const enabled = E12_ENABLED && active;
  const [caja, setCaja] = useState("");
  const [fondo, setFondo] = useState("");
  const [motivo, setMotivo] = useState("");
  const intention = useRef({ snapshot: "", uuid: "" });
  const options = useGetOpcionesPagoEfectivoProveedor(proveedorId, { query: {
    enabled: enabled && open && !!user,
    queryKey: [...getGetOpcionesPagoEfectivoProveedorQueryKey(proveedorId), JSON.stringify(user)],
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: enabled && open ? 15000 : false,
  } });
  useEffect(() => {
    if (open) { setCaja(""); setFondo(""); setMotivo(""); }
  }, [open, proveedorId, user?.id, user?.rol]);
  const validate = (data: E12OpcionesPagoEfectivo | undefined) => {
    if (!enabled) return null;
    if (!data?.enabled) return data?.motivoInactivo || "No está disponible el pago en efectivo E12.";
    const c = cents(admin ? caja || "0" : total);
    const f = cents(admin ? fondo || "0" : "0");
    const t = cents(total);
    if (c === null || f === null || t === null || t <= 0 || c + f !== t) return "Caja y Fondo deben sumar exactamente el importe, con máximo dos decimales.";
    if (c > 0 && !data.sesionCajaId) return "Se requiere una sesión abierta de Mariana para usar Caja.";
    if (f > 0 && (!admin || !data.fondo || f > (cents(data.fondo.saldo) ?? -1))) return "Saldo de Fondo insuficiente. No admite sobregiro.";
    const cajaProblem = cajaOverrideProblem(enabled, c, data.saldoCaja, admin && !!data.puedeDesbloquearCaja, motivo);
    if (cajaProblem) return cajaProblem;
    if (motivo.trim().length > 1000) return "El motivo admite máximo 1000 caracteres.";
    return null;
  };
  const prepare = async (content: unknown): Promise<E12PagoEfectivoInput | undefined> => {
    if (!enabled) return undefined;
    const fresh = await options.refetch();
    if (fresh.error) throw fresh.error;
    const problem = validate(fresh.data);
    if (problem) throw new Error(problem);
    const c = cents(admin ? caja || "0" : total)!;
    const f = cents(admin ? fondo || "0" : "0")!;
    const body = {
      caja: (c / 100).toFixed(2),
      ...(admin ? { fondo: (f / 100).toFixed(2) } : {}),
      sesionCajaId: c > 0 ? fresh.data!.sesionCajaId : null,
      ...(admin && fresh.data?.puedeDesbloquearCaja && motivo.trim() ? { desbloqueoCaja: { motivo: motivo.trim() } } : {}),
    };
    const snapshot = JSON.stringify({ proveedorId, identity: JSON.stringify(user), content, ...body });
    if (intention.current.snapshot !== snapshot) intention.current = { snapshot, uuid: crypto.randomUUID() };
    return { ...body, claveOperacion: intention.current.uuid };
  };
  return { enabled, admin, caja, setCaja, fondo, setFondo, motivo, setMotivo, options, prepare,
    problem: enabled ? (options.error ? getApiErrorMessage(options.error) : validate(options.data)) : null,
    accepted: () => { intention.current = { snapshot: "", uuid: "" }; },
  };
}

export function ProveedorEfectivoE12Fields({ draft, disabled }: { draft: ReturnType<typeof useProveedorEfectivoE12>; disabled: boolean }) {
  if (!draft.enabled) return null;
  const data = draft.options.data;
  return <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-3">
    <legend className="text-sm font-bold">Origen del efectivo · Mariana</legend>
    {draft.options.isFetching && <p className="text-sm">Consultando disponibilidad…</p>}
    <p className="text-sm">Sesión: {data?.sesionCajaId ?? "Sin sesión abierta"} · Saldo Caja: {data?.saldoCaja ?? "No disponible"}</p>
    {draft.admin && data?.fondo ? <>
      <Label htmlFor="e12-caja">Importe de Caja</Label><Input id="e12-caja" data-testid="input-e12-caja" inputMode="decimal" value={draft.caja} onChange={e => draft.setCaja(e.target.value)} />
      <Label htmlFor="e12-fondo">Importe de Fondo · Saldo {data.fondo.saldo}</Label><Input id="e12-fondo" data-testid="input-e12-fondo" inputMode="decimal" value={draft.fondo} onChange={e => draft.setFondo(e.target.value)} />
      <p className="text-xs text-muted-foreground">Fondo puro no requiere sesión de Caja. Fondo nunca admite saldo negativo.</p>
    </> : <p className="text-sm">El importe completo se paga desde Caja.</p>}
    {draft.admin && data?.puedeDesbloquearCaja && <><Label htmlFor="e12-motivo">Justificación de sobregiro de Caja (si corresponde)</Label><Input id="e12-motivo" data-testid="input-e12-desbloqueo" maxLength={1000} value={draft.motivo} onChange={e => draft.setMotivo(e.target.value)} /></>}
    {draft.problem && <p role="alert" className="text-sm text-destructive">{draft.problem}</p>}
    <p className="text-xs text-muted-foreground">La disponibilidad no es una reserva; se revalida al confirmar.</p>
  </fieldset>;
}

export function E12Evidence({ detail, admin }: { detail?: E12PagoEfectivoDetalle; admin: boolean }) {
  if (!E12_ENABLED || !admin || !detail) return null;
  return <div className="space-y-1 text-xs border rounded p-2">
    <p>Efectivo: Caja {detail.caja} · Fondo {detail.fondo} · Total {detail.total}</p>
    <p>Pago #{detail.pagoProveedorId} · Sesión {detail.sesionCajaId ?? "No requerida"} · Salida {detail.salidaCajaId ?? "No aplica"}</p>
    <p>Registrado: {detail.createdAt} · Operación {detail.claveOperacion}</p>
    {detail.sesionCajaId && <a className="underline" href={`/caja/cortes?sesionId=${detail.sesionCajaId}`}>Corte de la sesión</a>}
    {detail.movimientoFondoId && <a className="underline" href={`/fondo/movimientos/${detail.movimientoFondoId}`}>Movimiento de Fondo</a>}
    {detail.desbloqueoCaja && <p>Desbloqueo Caja: {detail.desbloqueoCaja.motivo} · Usuario {detail.desbloqueoCaja.usuarioId} · {detail.desbloqueoCaja.createdAt}</p>}
    {detail.retorno && <><p>{detail.retorno.naturaleza === "CORRECCION_CAPTURA" ? "Corrección de captura" : "Recuperación física de efectivo"}: {detail.retorno.motivo}</p><p>Retorno completo: Caja {detail.retorno.caja} · Fondo {detail.retorno.fondo} · Sesión {detail.retorno.sesionCajaId ?? "No requerida"} · {detail.retorno.createdAt}</p>{detail.retorno.sesionCajaId && <a className="underline" href={`/caja/cortes?sesionId=${detail.retorno.sesionCajaId}`}>Corte del retorno</a>}{detail.retorno.movimientoFondoId && <a className="underline" href={`/fondo/movimientos/${detail.retorno.movimientoFondoId}`}>Retorno a Fondo</a>}</>}
  </div>;
}