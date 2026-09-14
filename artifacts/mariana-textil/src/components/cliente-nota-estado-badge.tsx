import { AlertTriangle, CheckCircle2, Clock3, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@workspace/number-format";

/**
 * The API derives this state from the credit ledger and due date in one place.
 * The client only presents the result; it must not infer a state from amounts
 * or dates because overdue always has precedence over a partial payment.
 */
export type EstadoNota = "PENDIENTE" | "ABONO_PARCIAL" | "PAGADA" | "CON_RETRASO";

type ClienteNotaEstadoBadgeProps = {
  estadoNota?: EstadoNota | string | null;
  saldoPendiente?: string | number | null;
  id?: string | number;
  className?: string;
  showBalance?: boolean;
};

const estadoPresentation: Record<EstadoNota, {
  label: string;
  className: string;
  icon: typeof Clock3;
}> = {
  // Amber means the note still needs collection, either untouched or partial.
  PENDIENTE: { label: "PENDIENTE", className: "border-amber-300 bg-amber-100 text-amber-900", icon: Clock3 },
  ABONO_PARCIAL: { label: "ABONO PARCIAL", className: "border-amber-300 bg-amber-100 text-amber-900", icon: Coins },
  // Green means the note has no remaining amount to collect.
  PAGADA: { label: "PAGADA", className: "border-emerald-300 bg-emerald-100 text-emerald-900", icon: CheckCircle2 },
  // Red means the due date has passed while a balance remains; it wins over partial.
  CON_RETRASO: { label: "CON RETRASO", className: "border-red-300 bg-red-100 text-red-900", icon: AlertTriangle },
};

export function ClienteNotaEstadoBadge({
  estadoNota,
  saldoPendiente,
  id,
  className,
  showBalance = true,
}: ClienteNotaEstadoBadgeProps) {
  if (!estadoNota || !(estadoNota in estadoPresentation)) {
    return null;
  }

  const presentation = estadoPresentation[estadoNota as EstadoNota];
  const Icon = presentation.icon;
  const unpaid = estadoNota !== "PAGADA";

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className ?? ""}`} data-testid={`status-nota-${id ?? "current"}`}>
      <Badge className={`gap-1 border font-semibold ${presentation.className}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {presentation.label}
      </Badge>
      {showBalance && unpaid && (
        <span className="text-sm font-bold tabular-nums text-red-700" data-testid={`text-saldo-pendiente-${id ?? "current"}`}>
          · Saldo pendiente {formatNumber(saldoPendiente ?? "0", { kind: "money" })}
        </span>
      )}
    </span>
  );
}