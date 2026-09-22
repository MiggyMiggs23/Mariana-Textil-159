/** Pure cash arithmetic. Never joins applications or infers a receipt identity. */
export type CashOrigin = "FONDO_INICIAL" | "TICKET" | "ABONO" | "COBRO_RETENIDO" | "SALIDA";
export type CashDocument = {
  origen: CashOrigin; id: string; folio: string | null; importe: string; href: string | null;
  evidencia?: {
    referencia: string | null; motivo: string | null; fecha: string | null;
    usuarioId: number | null; proveedorId: number | null;
    usuarioNombre?: string | null; proveedorNombre?: string | null;
  };
};
export type CashBreakdown = {
  version: "E2" | "LEGACY"; fondoInicial: string; cobrosTickets: string;
  abonosFisicos: string; cobrosRetenidos: string; salidasFisicas: string;
  efectivoEsperado: string; documentos: CashDocument[];
};
export function cashCents(value: string): bigint {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("E2: importe monetario inválido");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return (BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"))) * (negative ? -1n : 1n);
}
export function cashMoney(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
export type CreditCashMovement = {
  id: number; clienteId: number; sesionCajaId: number | null; naturaleza: string | null;
  formaPago: string | null; cuentaDestino: string | null; tipo: string; importe: string;
  operacionProductor: string | null; operacionClave: string | null;
  referencia?: string | null; notas?: string | null; createdAt?: Date; usuarioId?: number;
};
export type RetainedCashReceipt = {
  sesionCajaId: number | null; naturaleza: string; medio: string; cuentaDestino: string;
  operacionProductor: string; operacionClave: string; importe: string;
  referencia?: string | null; motivo?: string | null; fechaReal?: Date; usuarioId?: number;
};
export function creditCashDocuments(sessionId: number, movements: CreditCashMovement[], retained: RetainedCashReceipt[]): CashDocument[] {
  const documents: CashDocument[] = [];
  for (const movement of movements) {
    if (movement.sesionCajaId !== sessionId || movement.naturaleza !== "INGRESO_FISICO" ||
        movement.formaPago !== "EFECTIVO" || movement.cuentaDestino !== "CAJA_FISICA") continue;
    // E1 has no pending-to-abono origin FK. A future conversion producer is
    // unsupported until it supplies an immutable origin link; never infer by
    // customer, amount, applications or timestamps, or silently count it twice.
    if (movement.tipo !== "ABONO" || !["ABONO_ORDINARIO", "ABONO_DIRIGIDO"].includes(movement.operacionProductor ?? "") || !movement.operacionClave)
      throw new Error("E2: recepción sin identidad/origen físico soportado");
    if (cashCents(movement.importe) >= 0n) throw new Error("E2: signo de abono inválido");
    documents.push({ origen: "ABONO", id: `${movement.operacionProductor}:${movement.operacionClave}`, folio: null,
      importe: cashMoney(-cashCents(movement.importe)), href: `/clientes/${movement.clienteId}/movimientos/${movement.id}`,
      evidencia: { referencia: movement.referencia ?? null, motivo: movement.notas ?? null,
        fecha: movement.createdAt?.toISOString() ?? null, usuarioId: movement.usuarioId ?? null, proveedorId: null } });
  }
  for (const receipt of retained) {
    if (receipt.sesionCajaId !== sessionId || receipt.naturaleza !== "INGRESO_FISICO" ||
        receipt.medio !== "EFECTIVO" || receipt.cuentaDestino !== "CAJA_FISICA") continue;
    if (receipt.operacionProductor !== "COBRO_PENDIENTE" || !receipt.operacionClave)
      throw new Error("E2: cobro retenido sin identidad soportada");
    documents.push({ origen: "COBRO_RETENIDO", id: `${receipt.operacionProductor}:${receipt.operacionClave}`, folio: null, importe: receipt.importe, href: null,
      evidencia: { referencia: receipt.referencia ?? null, motivo: receipt.motivo ?? null,
        fecha: receipt.fechaReal?.toISOString() ?? null, usuarioId: receipt.usuarioId ?? null, proveedorId: null } });
  }
  return documents;
}
export function calculateCash(documents: CashDocument[], version: CashBreakdown["version"] = "E2"): CashBreakdown {
  const sums: Record<CashOrigin, bigint> = { FONDO_INICIAL: 0n, TICKET: 0n, ABONO: 0n, COBRO_RETENIDO: 0n, SALIDA: 0n };
  const seen = new Set<string>();
  for (const document of documents) {
    // ABONO and retained use the same immutable operation namespace.
    const key = `${["ABONO", "COBRO_RETENIDO"].includes(document.origen) ? "RECEIPT" : document.origen}:${document.id}`;
    if (seen.has(key)) throw new Error("E2: recepción/documento duplicado");
    seen.add(key);
    const amount = cashCents(document.importe);
    if (amount < 0n || !(document.origen in sums)) throw new Error("E2: documento físico inválido");
    sums[document.origen] += amount;
  }
  return {
    version, fondoInicial: cashMoney(sums.FONDO_INICIAL), cobrosTickets: cashMoney(sums.TICKET),
    abonosFisicos: cashMoney(sums.ABONO), cobrosRetenidos: cashMoney(sums.COBRO_RETENIDO),
    salidasFisicas: cashMoney(sums.SALIDA),
    efectivoEsperado: cashMoney(sums.FONDO_INICIAL + sums.TICKET + sums.ABONO + sums.COBRO_RETENIDO - sums.SALIDA),
    documentos: documents,
  };
}
export type CashSnapshot = { version: "E2"; sesionId: number; efectivoContado: string; diferencia: string; efectivoDesglose: CashBreakdown };
export function validateCashSnapshot(value: unknown, sessionId: number): CashSnapshot {
  const invalid = () => { throw new Error("E2: snapshot de caja inválido; no se recalculará el corte cerrado"); };
  if (!value || typeof value !== "object") return invalid();
  const snapshot = value as CashSnapshot;
  const data = snapshot.efectivoDesglose;
  if (snapshot.version !== "E2" || snapshot.sesionId !== sessionId || data?.version !== "E2" || !Array.isArray(data.documentos)) return invalid();
  for (const d of data.documentos) {
    if (!d || typeof d.id !== "string" || typeof d.importe !== "string" ||
      !(d.folio === null || typeof d.folio === "string") ||
      !(d.href === null || (typeof d.href === "string" && /^\/(?:tickets\/\d+|clientes\/\d+\/movimientos\/\d+)$/.test(d.href)))) return invalid();
    if (d.evidencia !== undefined) {
      if (!d.evidencia || typeof d.evidencia !== "object") return invalid();
      for (const key of ["referencia", "motivo", "fecha"] as const)
        if (d.evidencia[key] !== null && typeof d.evidencia[key] !== "string") return invalid();
      for (const key of ["usuarioId", "proveedorId"] as const)
        if (d.evidencia[key] !== null && (!Number.isInteger(d.evidencia[key]) || d.evidencia[key]! <= 0)) return invalid();
      for (const key of ["usuarioNombre", "proveedorNombre"] as const)
        if (d.evidencia[key] !== undefined && d.evidencia[key] !== null && typeof d.evidencia[key] !== "string") return invalid();
    }
  }
  if (data.documentos.filter(d => d.origen === "FONDO_INICIAL" && d.id === String(sessionId)).length !== 1 ||
      data.documentos.filter(d => d.origen === "FONDO_INICIAL").length !== 1) return invalid();
  const computed = calculateCash(data.documentos);
  for (const key of ["fondoInicial", "cobrosTickets", "abonosFisicos", "cobrosRetenidos", "salidasFisicas", "efectivoEsperado"] as const) {
    if (computed[key] !== data[key]) return invalid();
  }
  if (typeof snapshot.efectivoContado !== "string" || typeof snapshot.diferencia !== "string" ||
      cashCents(snapshot.efectivoContado) < 0n ||
      cashMoney(cashCents(snapshot.efectivoContado) - cashCents(data.efectivoEsperado)) !== snapshot.diferencia) return invalid();
  return snapshot;
}

/** Dependency-injected selection boundary: closed sessions never call liveReader.
 * Legacy values deliberately retain the original per-surface numeric semantics. */
export async function resolveSessionCash(
  session: { id: number; estado: string; efectivoContado: string | null },
  snapshots: unknown[],
  legacy: { efectivoEsperado: string; diferencia: string | null },
  liveReader: () => Promise<CashBreakdown>,
): Promise<{ efectivoEsperado: string; diferencia: string | null; efectivoDesglose?: CashBreakdown }> {
  let efectivoDesglose: CashBreakdown;
  if (session.estado === "CERRADA") {
    if (snapshots.length > 1) throw new Error("E2: snapshots de cierre duplicados");
    if (snapshots.length === 0) return legacy;
    const snapshot = validateCashSnapshot(snapshots[0], session.id);
    return { efectivoDesglose: snapshot.efectivoDesglose, efectivoEsperado: snapshot.efectivoDesglose.efectivoEsperado, diferencia: snapshot.diferencia };
  } else {
    if (session.estado !== "ABIERTA") throw new Error("E2: estado de sesión inválido");
    efectivoDesglose = await liveReader();
  }
  return { efectivoDesglose, efectivoEsperado: efectivoDesglose.efectivoEsperado,
    diferencia: session.efectivoContado == null ? null : cashMoney(cashCents(session.efectivoContado) - cashCents(efectivoDesglose.efectivoEsperado)) };
}