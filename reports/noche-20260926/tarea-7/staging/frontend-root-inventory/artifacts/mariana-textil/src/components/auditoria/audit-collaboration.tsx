import type { AuditoriaInventarioDetail, AuditoriaInventarioResultado } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { auditParticipantLimit } from "./use-audit-participation";

function admissionError(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return error instanceof Error ? error.message : "No se pudo renovar tu participación.";
}

export function AuditCollaboration({
  detail, active, joining, error, expired, requested, canJoin, onRetry, onJoin,
}: {
  detail: AuditoriaInventarioDetail;
  active: boolean;
  joining: boolean;
  error: unknown;
  expired: boolean;
  requested: boolean;
  canJoin: boolean;
  onRetry: () => void;
  onJoin: () => void;
}) {
  const activePeople = detail.participantes?.filter((person) => person.activo) ?? [];
  return (
    <div className="rounded-xl border bg-card p-4 text-sm space-y-2" data-testid="audit-collaboration">
      <div className="font-semibold" data-testid="audit-participant-count">
        Participantes activos: {detail.participantesActivos} / {detail.maxParticipantes}
      </div>
      <p className="text-muted-foreground" data-testid="audit-participant-names">
        {activePeople.length ? activePeople.map((person) => person.nombre).join(", ") : "Sin participantes activos"}
      </p>
      <p className="text-xs text-muted-foreground">
        Historial: {detail.participantes?.length ?? 0} usuarios · {detail.participantes?.reduce((sum, person) => sum + person.escaneos, 0) ?? 0} escaneos
      </p>
      {active ? (
        <p className="text-emerald-700 dark:text-emerald-400" data-testid="status-audit-participation">Estás participando. Puedes escanear.</p>
      ) : (
        <div role="status" data-testid="status-audit-participation" className="space-y-2">
          <p className="text-amber-700 dark:text-amber-400">
            {!requested
              ? canJoin ? "Puedes consultar esta auditoría sin ocupar un lugar. Únete para escanear." : "Consulta de solo lectura. No tienes permiso para escanear en este sitio."
              : auditParticipantLimit(error)
              ? "Ya hay 5 usuarios activos en esta auditoría. Espera a que se libere un lugar."
              : error
                ? `${admissionError(error)} Escaneo bloqueado hasta volver a unirte.`
                : expired
                  ? "Tu participación venció. Escaneo bloqueado hasta renovar."
                  : joining
                    ? "Uniéndote a la auditoría. Escaneo bloqueado mientras se confirma tu lugar."
                    : "Escaneo bloqueado hasta confirmar tu participación."}
          </p>
          {!requested && canJoin ? (
            <Button type="button" size="lg" className="w-full sm:w-auto min-h-12 text-base font-bold" onClick={onJoin} data-testid="button-audit-detail-join">Unirme a la auditoría</Button>
          ) : requested && !joining && (
            <Button type="button" size="sm" variant="outline" onClick={onRetry} data-testid="button-audit-retry-join">Reintentar participación</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditScannerAttribution({ row }: { row: AuditoriaInventarioResultado }) {
  if (!row.usuarioNombre || !row.escaneadoAt) return null;
  return (
    <span className="block text-[11px] text-muted-foreground" data-testid={`audit-scanner-${row.serie}`}>
      Escaneado por {row.usuarioNombre} · {new Date(row.escaneadoAt).toLocaleString("es-MX")}
    </span>
  );
}