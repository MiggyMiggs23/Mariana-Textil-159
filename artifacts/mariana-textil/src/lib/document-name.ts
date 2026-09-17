import { getApiErrorMessage } from "@/lib/api-error";

export type DocumentoStatusPresentation = {
  label: string;
  className: string;
};

export function documentoTipoLabel(
  tipo: string | null | undefined,
): string {
  if (tipo === "NOTA") return "Nota";
  if (tipo === "TICKET") return "Ticket";
  return tipo || "Documento";
}

const canonicalDocumentErrorMessages: Record<string, (nombre: string) => string> = {
  "Ticket no encontrado.": (nombre) =>
    `${nombre} no ${nombre === "Nota" ? "encontrada" : "encontrado"}.`,
  "No tienes permiso para consultar este ticket.": (nombre) =>
    `${nombre}: no tienes permiso para consultar este documento.`,
  "El ticket ya está cancelado.": (nombre) =>
    `${nombre === "Nota" ? "La" : "El"} ${nombre.toLowerCase()} ya está ${nombre === "Nota" ? "cancelada" : "cancelado"}.`,
  "No se puede cobrar un ticket cancelado.": (nombre) =>
    `${nombre}: no se puede ${nombre === "Nota" ? "autorizar" : "cobrar"} un documento cancelado.`,
  "El ticket ya fue cobrado.": (nombre) =>
    nombre === "Nota" ? `${nombre}: el documento ya fue procesado en Caja.` : `${nombre} ya fue cobrado.`,
  "Se requiere una sesión de caja abierta en la ubicación del ticket.": (nombre) =>
    `${nombre}: se requiere una sesión de caja abierta en la ubicación del documento.`,
};

/**
 * Rewords only canonical document phrases emitted by the existing API.
 * Unknown server messages remain exact so their useful cause is not hidden.
 */
export function documentoErrorMessage(
  error: unknown,
  documentoTipo: string | null | undefined,
  fallback = "No se pudo completar la operación.",
): string {
  const message = getApiErrorMessage(error, fallback);
  return canonicalDocumentErrorMessages[message]?.(documentoTipoLabel(documentoTipo)) ?? message;
}

export function documentoStatusPresentation({
  documentoTipo,
  cobrado,
  autorizacionEstado,
}: {
  documentoTipo: string | null | undefined;
  cobrado: boolean | null | undefined;
  autorizacionEstado: string | null | undefined;
}): DocumentoStatusPresentation {
  const nombre = documentoTipoLabel(documentoTipo);

  if (documentoTipo === "NOTA") {
    if (autorizacionEstado === "AUTORIZADA") {
      // Green means Caja processing is complete; it does not mean a credit balance was paid.
      return {
        label: `${nombre} autorizada`,
        className: "bg-emerald-100 text-emerald-700",
      };
    }
    if (autorizacionEstado === "PENDIENTE") {
      // Amber means Caja still needs to perform the pending authorization action.
      return {
        label: `${nombre} por autorizar`,
        className: "bg-amber-100 text-amber-700",
      };
    }
    // Neutral means the legacy or incomplete response lacks confirmation of Caja processing.
    return {
      label: `${nombre}: autorización sin confirmar`,
      className: "bg-primary/10 text-primary",
    };
  }

  if (documentoTipo === "TICKET") {
    if (cobrado === true) {
      // Green means Caja processing is complete; it does not describe a debt balance.
      return {
        label: `${nombre} cobrado`,
        className: "bg-emerald-100 text-emerald-700",
      };
    }
    if (cobrado === false) {
      // Amber means Caja still has a pending collection action.
      return {
        label: `${nombre} por cobrar`,
        className: "bg-amber-100 text-amber-700",
      };
    }
    // Neutral means the response does not confirm whether Caja processed the document.
    return {
      label: `${nombre} registrado`,
      className: "bg-primary/10 text-primary",
    };
  }

  return {
    label: `${nombre}: estado sin confirmar`,
    className: "bg-primary/10 text-primary",
  };
}