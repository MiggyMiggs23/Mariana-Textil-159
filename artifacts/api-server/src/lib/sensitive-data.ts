/**
 * Removes financial fields from response payloads visible to TERMINAL.
 *
 * The operation is recursive because inventory responses include costs in
 * nested entry lines and rollos. It returns a new value and never mutates the
 * object that was validated by the route response schema.
 */
export function omitTerminalSensitiveFields<T>(value: T, omitSensitive: boolean): T {
  if (!omitSensitive) return value;
  return omit(value) as T;
}

/** Server-side field omission for the non-financial SUPERVISOR role. */
export function omitSupervisorSensitiveFields<T>(
  value: T,
  isSupervisor: boolean,
): T {
  if (!isSupervisor) return value;
  return omit(value, true) as T;
}

export function isSupervisorSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[_\-\s]/g, "").toLowerCase();
  return (
    normalized.includes("costo") ||
    normalized.includes("precio") ||
    normalized.includes("margen") ||
    normalized.includes("utilidad") ||
    normalized.includes("ganancia") ||
    normalized.includes("inventariovalor") ||
    normalized.includes("valorinventario") ||
    normalized.includes("valormercancia") ||
    normalized.includes("limitecredito") ||
    normalized.includes("diascredito") ||
    normalized.includes("creditodisponible") ||
    normalized.includes("saldocredito") ||
    normalized.includes("balance") ||
    normalized.includes("saldoactual") ||
    normalized.includes("saldopendiente") ||
    normalized.includes("saldoacumulado") ||
    normalized.includes("totaldeuda") ||
    normalized.includes("totalcartera") ||
    normalized.includes("totalvencido") ||
    normalized.includes("totalpagado") ||
    normalized.includes("totalcomprado") ||
    normalized.includes("totalcompra") ||
    normalized.includes("totalventa") ||
    normalized === "subtotal" ||
    normalized === "iva" ||
    normalized === "comprasresumen" ||
    normalized === "comprashistorial" ||
    normalized === "ventas" ||
    normalized === "compras" ||
    normalized.includes("importe") ||
    normalized.includes("monto") ||
    normalized.includes("formapago") ||
    normalized.includes("mezclapago") ||
    normalized === "pagos" ||
    normalized === "pago" ||
    normalized === "cobros" ||
    normalized.includes("efectivo") ||
    normalized.includes("tarjeta") ||
    normalized.includes("transferencia") ||
    normalized.includes("moneda") ||
    normalized.includes("estadocredito") ||
    normalized.includes("puedecomprarcredito") ||
    normalized.includes("documentoine") ||
    normalized.includes("ineurl") ||
    normalized.includes("inearchivo") ||
    normalized.includes("documentourl") ||
    normalized.includes("archivourl") ||
    normalized.includes("nombrearchivo") ||
    normalized.includes("mimetype") ||
    normalized.includes("tamanobytes") ||
    normalized.includes("documentpublicid") ||
    normalized.includes("subidoat") ||
    normalized.includes("subidopor") ||
    normalized.includes("objectkey") ||
    normalized.includes("storagemetadata")
  );
}

function omit(value: unknown, supervisor = false): unknown {
  if (value == null || value instanceof Date || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => omit(item, supervisor));

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nestedValue]) =>
      (supervisor ? isSupervisorSensitiveKey(key) : isTerminalSensitiveKey(key))
        ? []
        : [[key, omit(nestedValue, supervisor)]],
    ),
  );
}

function isTerminalSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[_\-\s]/g, "").toLowerCase();
  return (
    normalized.includes("costo") ||
    normalized.includes("precio") ||
    normalized.includes("margen") ||
    normalized.includes("utilidad")
  );
}