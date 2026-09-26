import { Badge } from "@/components/ui/badge";
import {
  getSalidaEstadoPresentation,
  SALIDA_ESTADO_LABELS,
  type SalidaEstadoPresentationInput,
} from "@workspace/api-zod";

export const SALIDA_ESTADO_PRESENTATION = {
  ARMANDO: { label: SALIDA_ESTADO_LABELS.ARMANDO, className: "bg-blue-100 text-blue-800 border-blue-200" },
  EN_TRANSITO: { label: SALIDA_ESTADO_LABELS.EN_TRANSITO, className: "bg-amber-100 text-amber-800 border-amber-200" },
  RECIBIDA: { label: SALIDA_ESTADO_LABELS.RECIBIDA, className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  ENTREGADA: { label: SALIDA_ESTADO_LABELS.ENTREGADA, className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  CANCELADA: { label: SALIDA_ESTADO_LABELS.CANCELADA, className: "bg-slate-200 text-slate-800 border-slate-300" },
} as const;

export type SalidaEstado = keyof typeof SALIDA_ESTADO_PRESENTATION;

export function getSalidaEstadoLabel(estado: string) {
  return getSalidaEstadoPresentation({ estado }).label;
}

export function SalidaEstadoBadge(props: SalidaEstadoPresentationInput & { className?: string }) {
  const presentation = getSalidaEstadoPresentation(props);
  const classNameByLabel: Record<string, string> = {
    [SALIDA_ESTADO_LABELS.ARMANDO]: "bg-blue-100 text-blue-800 border-blue-200",
    [SALIDA_ESTADO_LABELS.EN_TRANSITO]: "bg-amber-100 text-amber-800 border-amber-200",
    [SALIDA_ESTADO_LABELS.RECIBIDA]: "bg-cyan-100 text-cyan-800 border-cyan-200",
    [SALIDA_ESTADO_LABELS.ENTREGADA]: "bg-emerald-100 text-emerald-800 border-emerald-200",
    [SALIDA_ESTADO_LABELS.CANCELADA]: "bg-slate-200 text-slate-800 border-slate-300",
    "En curso": "bg-blue-100 text-blue-800 border-blue-200",
    "Por autorizar": "bg-amber-100 text-amber-800 border-amber-200",
    Autorizada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <Badge
      variant="outline"
      className={`font-medium ${classNameByLabel[presentation.label] ?? "bg-slate-100 text-slate-800 border-slate-200"} ${props.className || ""}`}
      data-testid={`salida-estado-${props.estado.toLowerCase()}`}
    >
      {presentation.label}
    </Badge>
  );
}

export { getSalidaEstadoPresentation };
export type { SalidaEstadoPresentationInput };