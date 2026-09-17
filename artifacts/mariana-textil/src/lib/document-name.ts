export type DocumentoStatusPresentation = {
  label: string;
  className: string;
};

export function documentoTipoLabel(
  tipo: string | null | undefined,
): string {
  if (tipo === "NOTA") return "Nota";
  if (tipo === "TICKET") return "Ticket";
  return tipo ?? "Documento";
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