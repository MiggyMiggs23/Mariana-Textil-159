import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// TEMPORARY TEST-ONLY FEATURE. Remove this file and its two AppLayout mounts
// when the owner starts real operations. The server is the authority on scope.
export const TEST_RESET_LOGIN_NOTICE_KEY = "mariana:test-reset:login-notice";
export const TEST_RESET_LOGIN_MESSAGE =
  "Se borraron los datos de prueba y se cerraron todas las sesiones. Vuelve a iniciar sesión.";
const STATUS_URL = "/api/admin/test-reset";

type ResetStatus = { enabled: boolean; protectCustomers: boolean };

async function readStatus(): Promise<ResetStatus> {
  const response = await fetch(STATUS_URL, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo confirmar la disponibilidad del reinicio.");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" ||
    typeof (body as { enabled?: unknown }).enabled !== "boolean" ||
    typeof (body as { protectCustomers?: unknown }).protectCustomers !== "boolean") {
    throw new Error("Respuesta de disponibilidad inválida; no se puede reiniciar.");
  }
  return body as ResetStatus;
}

function returnToLogin(message: string, result: "complete" | "session"): void {
  try {
    sessionStorage.setItem(TEST_RESET_LOGIN_NOTICE_KEY, message);
  } catch {
    // URL marker carries a fixed local message if private browsing blocks storage.
  }
  window.location.replace(`${import.meta.env.BASE_URL}login?testReset=${result}`);
}

export function TestSystemResetButton() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["admin", "test-reset", "availability"],
    queryFn: readStatus,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const executingRef = useRef(false);
  const [error, setError] = useState("");

  // A failed/unavailable gate does not expose a destructive UI. POST has its
  // own server-side ADMIN and test-environment checks as well.
  if (status.data?.enabled !== true) return null;

  async function execute() {
    if (confirmation !== "BORRAR" || executingRef.current) return;
    executingRef.current = true;
    setPending(true);
    setError("");
    try {
      // Recheck the kill switch at the last possible moment.
      const freshStatus = await readStatus();
      if (!freshStatus.enabled) throw new Error("El reinicio de pruebas ya no está disponible.");
      if (freshStatus.protectCustomers !== status.data?.protectCustomers) {
        void status.refetch();
        throw new Error("Cambió el alcance de clientes protegidos. Revisa de nuevo la lista antes de confirmar.");
      }
      const response = await fetch(STATUS_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "BORRAR" }),
      });
      if (response.status === 401) {
        returnToLogin("Tu sesión se cerró. Vuelve a iniciar sesión antes de consultar los datos.", "session");
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = body && typeof body === "object"
          ? (body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message
          : undefined;
        throw new Error(typeof detail === "string" ? detail : "No se pudo reiniciar. Los datos no se confirmaron como borrados.");
      }
      if (!body || typeof body !== "object" || (body as { success?: unknown }).success !== true ||
        (body as { requiresLogin?: unknown }).requiresLogin !== true) {
        throw new Error("Respuesta no confirmada. Consulta al administrador antes de volver a intentar.");
      }
      void queryClient.cancelQueries().catch(() => {});
      queryClient.clear();
      returnToLogin(TEST_RESET_LOGIN_MESSAGE, "complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo confirmar el reinicio. No repitas la operación sin verificar su estado.");
    } finally {
      executingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-red-500/50 px-3 py-3" data-testid="test-reset-sidebar">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 border-red-500/60 bg-red-950/40 text-red-100 hover:bg-red-900 hover:text-white"
        onClick={() => { setConfirmation(""); setError(""); setOpen(true); }}
        data-testid="button-test-reset"
      >
        <Trash2 className="h-4 w-4" />
        Borrar datos de prueba
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogContent onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
          onInteractOutside={(event) => { if (pending) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Reiniciar sistema de pruebas
            </DialogTitle>
            <DialogDescription>
              Esto borra definitivamente los datos de prueba. Todas las sesiones se cerrarán
              y tendrás que volver a iniciar sesión. Quedará registrado quién lo hizo y cuándo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Se conserva:</strong> proveedores, catálogo de productos, precios vigentes,
              usuarios, permisos, sitios, camionetas, choferes, equipos, toda la configuración
              y el cliente interno del sistema{status.data.protectCustomers ? ", y todos los clientes" : ""}.</p>
            <p><strong>Se borra:</strong> {status.data.protectCustomers ? "" : "clientes de prueba; "}
              existencias y rollos; ventas, tickets,
              notas, entradas, salidas y viajes; pagos, abonos y crédito; cortes y sesiones de caja;
              etiquetas impresas; auditorías y bitácora de prueba; alertas, notificaciones,
              movimientos, sesiones de acceso, revisiones de equipos, historial de precios,
              operaciones de fondo y conciliación.</p>
            <p>Los folios vuelven a cero y la próxima serie de rollo comienza en 10000001.</p>
            <label htmlFor="test-reset-confirmation" className="block font-medium">
              Escribe BORRAR para confirmar
            </label>
            <Input id="test-reset-confirmation" data-testid="input-test-reset-confirmation"
              autoComplete="off" value={confirmation} disabled={pending}
              onChange={(event) => setConfirmation(event.target.value)} />
            {error && <p role="alert" className="text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={confirmation !== "BORRAR" || pending}
              onClick={() => void execute()} data-testid="button-confirm-test-reset">
              {pending ? "Borrando datos de prueba…" : "Borrar datos de prueba"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}