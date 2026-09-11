/**
 * Presentation labels for salida history.
 *
 * `estado` remains the persisted EstadoSalida value. Customer-sale labels are
 * derived from that value and the already-linked sale document instead of
 * introducing new lifecycle values.
 */
export const SALIDA_ESTADO_LABELS = {
  ARMANDO: "Armando",
  EN_TRANSITO: "En tránsito",
  RECIBIDA: "Recibida",
  ENTREGADA: "Entregada",
  CANCELADA: "Cancelada",
} as const;

export type SalidaEstadoPresentationInput = {
  estado: string;
  modalidad?: string | null;
  documentoVenta?: unknown | null;
  /** Existing DTO projection of ticket payment or note authorization. */
  autorizada?: boolean | null;
};

export type SalidaEstadoPresentation = {
  label: string;
};

/**
 * Derives the one history label used by the UI and salida reports.
 *
 * Transfer and counter-sale rows retain the five existing labels. For a
 * VENTA_CLIENTE row, the linked document marks the transition from En curso
 * to Por autorizar, while its existing `autorizada` projection marks the
 * transition to Autorizada. Terminal salida states always win.
 */
export function getSalidaEstadoPresentation(
  input: SalidaEstadoPresentationInput,
): SalidaEstadoPresentation {
  if (input.modalidad === "VENTA_CLIENTE") {
    if (input.estado === "CANCELADA") return { label: "Cancelada" };
    if (input.estado === "ENTREGADA") return { label: "Entregada" };
    if (input.documentoVenta != null) {
      return { label: input.autorizada === true ? "Autorizada" : "Por autorizar" };
    }
    return { label: "En curso" };
  }

  return {
    label:
      input.estado in SALIDA_ESTADO_LABELS
        ? SALIDA_ESTADO_LABELS[input.estado as keyof typeof SALIDA_ESTADO_LABELS]
        : input.estado,
  };
}