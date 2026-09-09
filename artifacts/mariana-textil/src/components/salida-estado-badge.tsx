import { Badge } from "@/components/ui/badge";

export const SALIDA_ESTADO_PRESENTATION = {
  ARMANDO: { label: "Armando", className: "bg-blue-100 text-blue-800 border-blue-200" },
  EN_TRANSITO: { label: "En tránsito", className: "bg-amber-100 text-amber-800 border-amber-200" },
  RECIBIDA: { label: "Recibida", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  ENTREGADA: { label: "Entregada", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  CANCELADA: { label: "Cancelada", className: "bg-slate-200 text-slate-800 border-slate-300" },
} as const;

export type SalidaEstado = keyof typeof SALIDA_ESTADO_PRESENTATION;

export function getSalidaEstadoLabel(estado: string) {
  return estado in SALIDA_ESTADO_PRESENTATION
    ? SALIDA_ESTADO_PRESENTATION[estado as SalidaEstado].label
    : estado;
}

export function SalidaEstadoBadge({ estado }: { estado: string }) {
  const presentation = estado in SALIDA_ESTADO_PRESENTATION
    ? SALIDA_ESTADO_PRESENTATION[estado as SalidaEstado]
    : { label: estado, className: "bg-slate-100 text-slate-800 border-slate-200" };

  return (
    <Badge
      variant="outline"
      className={`font-medium ${presentation.className}`}
      data-testid={`salida-estado-${estado.toLowerCase()}`}
    >
      {presentation.label}
    </Badge>
  );
}