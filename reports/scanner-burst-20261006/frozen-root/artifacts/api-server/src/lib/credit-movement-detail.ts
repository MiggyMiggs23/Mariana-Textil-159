import {
  centsToMoney,
  moneyToCents,
  type CreditAllocation,
  type CreditLedgerCharge,
  type CreditLedgerMovement,
} from "./credit-allocation";
import {
  loadCustomerCreditProjection,
  type CustomerCreditProjection,
} from "./credit-aging-read-model";
import { deriveEstadoNota } from "./clientes-aging";
import {
  auditMatchesCreditMovementIdentity,
  type AuditedCreditMovement,
} from "./auditoria-owner";

/**
 * The detail reader deliberately has a tiny database surface.  Keeping the
 * adapter structural makes the projection and identity checks unit-testable
 * without importing the application or creating database rows.
 */
export type CreditMovementDetailDatabase = {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

export type CreditMovementDetailMovement = {
  id: number | string;
  clienteId: number | string;
  clienteNombre: string;
  tipo: "ABONO" | "REVERSO" | "AJUSTE";
  importe: string;
  fechaEfectiva: Date | string;
  formaPago: string | null;
  cuentaDestino: string | null;
  referencia: string | null;
  notas: string | null;
  usuarioRegistrador: string;
  ticketId: number | string | null;
  ticketFolio: number | string | null;
  movimientoOriginalId: number | string | null;
  movimientoOriginalTipo: string | null;
  movimientoOriginalImporte?: string | null;
  movimientoOriginalFechaEfectiva?: Date | string | null;
  reversoMovimientoId: number | string | null;
  motivoReverso: string | null;
};

export type CreditMovementDetailApplicationEvidence = {
  abonoMovimientoId: number | string;
  ticketId: number | string | null;
  folio: number | string | null;
  movimientoVentaId: number | string;
  aplicado: string;
  importeOriginal: string;
  fechaVencimiento: string | Date | null;
};

export type CreditMovementDetailAuditEvent = {
  id: number | string;
  accion: string;
  fecha: Date | string;
  entidad: string;
  entidadId: string | null;
  usuario: string | null;
  datosAntes: unknown;
  datosDespues: unknown;
};

export type CreditMovementDetailReparto = {
  ticketId: number | null;
  folio: number | null;
  movimientoVentaId: number;
  importeAplicado: string;
  saldoAntes: string | null;
  saldoDespues: string | null;
  vigente: boolean;
};

export type CreditMovementAudit = {
  id: number;
  accion: string;
  fecha: string;
  usuario: string | null;
  motivo: string | null;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function absoluteMoney(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("-") ? trimmed.slice(1) : trimmed;
}

function sameMoney(left: unknown, right: string): boolean {
  const value = Number(left);
  return Number.isFinite(value) && moneyToCents(value) === moneyToCents(right);
}

function legacyNoteState(
  importeOriginal: string,
  saldoPendiente: string,
  fechaVencimiento: string | null,
): "PENDIENTE" | "PARCIAL" | "PAGADA" {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const state = deriveEstadoNota({
    importeOriginal,
    saldoPendiente,
    fechaVencimiento,
    hoy: today,
  });
  return state === "PAGADA"
    ? "PAGADA"
    : state === "ABONO_PARCIAL" || state === "CON_RETRASO"
      ? "PARCIAL"
      : "PENDIENTE";
}

/**
 * Converts only the allocation trace returned by projectCreditLedger into
 * API rows.  It never reads aplicaciones_credito and never computes a
 * balance independently.
 */
export function buildProjectedAllocationRows(
  allocations: CreditAllocation[],
  charges: CreditLedgerCharge[],
  vigente: boolean,
): CreditMovementDetailReparto[] {
  const chargesById = new Map(
    charges.map((charge) => [charge.movimientoId, charge]),
  );
  return allocations.flatMap((allocation) => {
    const charge = chargesById.get(allocation.targetId);
    if (!charge) return [];
    return [{
      ticketId: charge.ticketId,
      folio: charge.folio,
      movimientoVentaId: charge.movimientoId,
      importeAplicado: centsToMoney(allocation.appliedCents),
      saldoAntes: centsToMoney(allocation.balanceBeforeCents),
      saldoDespues: centsToMoney(allocation.balanceAfterCents),
      vigente,
    }];
  });
}

export function buildHistoricalEvidenceRows(
  rows: CreditMovementDetailApplicationEvidence[],
): CreditMovementDetailReparto[] {
  return rows.flatMap((row) => {
    const movimientoVentaId = asNumber(row.movimientoVentaId);
    if (movimientoVentaId == null) return [];
    return [{
      ticketId: row.ticketId == null ? null : asNumber(row.ticketId),
      folio: row.folio == null ? null : asNumber(row.folio),
      movimientoVentaId,
      importeAplicado: row.aplicado,
      saldoAntes: null,
      saldoDespues: null,
      vigente: false,
    }];
  });
}

function buildAuditedHistoricalEvidenceRows(
  rows: CreditMovementDetailApplicationEvidence[],
  audits: CreditMovementDetailAuditEvent[],
): CreditMovementDetailReparto[] {
  const assignments = audits.flatMap((audit) => {
    const payload = auditPayload(audit);
    const rawAssignments = payload.asignaciones;
    if (!Array.isArray(rawAssignments)) return [];
    return rawAssignments.flatMap((value) => {
      const assignment = asObject(value);
      const movimientoVentaId = asNumber(assignment.movimientoVentaId);
      const aplicado = asString(assignment.aplicado);
      if (movimientoVentaId == null || aplicado == null) return [];
      return [{
        movimientoVentaId,
        aplicado,
        saldoAntes: asString(assignment.saldoAntes),
        saldoDespues: asString(assignment.saldoDespues),
      }];
    });
  });
  return rows.flatMap((row) => {
    const audited = assignments.find(
      (assignment) =>
        assignment.movimientoVentaId === Number(row.movimientoVentaId) &&
        sameMoney(assignment.aplicado, row.aplicado),
    );
    if (!audited) return buildHistoricalEvidenceRows([row]);
    const [historical] = buildHistoricalEvidenceRows([row]);
    return historical
      ? [{
          ...historical,
          saldoAntes: audited.saldoAntes,
          saldoDespues: audited.saldoDespues,
        }]
      : [];
  });
}

function auditPayload(row: CreditMovementDetailAuditEvent): Record<string, unknown> {
  return {
    ...asObject(row.datosAntes),
    ...asObject(row.datosDespues),
  };
}

/**
 * An audit entity id by itself is not identity. Match the event-specific
 * action/entity fields and the shared strict retained movement snapshot
 * predicate before using an event as capture evidence.
 */
export function auditMatchesMovement(
  audit: CreditMovementDetailAuditEvent,
  movement: Pick<CreditMovementDetailMovement, "clienteId" | "id" | "tipo" | "importe" | "fechaEfectiva">,
): boolean {
  const payload = auditPayload(audit);
  const movementId = Number(movement.id);
  const clientId = Number(movement.clienteId);
  if (!Number.isSafeInteger(movementId) || !Number.isSafeInteger(clientId)) return false;

  if (movement.tipo === "ABONO") {
    if (audit.accion !== "PAGO_CLIENTE" || audit.entidad !== "clientes") {
      return false;
    }
    if (
      Number(audit.entidadId) !== clientId ||
      Number(payload.movimientoCreditoId) !== movementId
    ) {
      return false;
    }
    return auditedMovementIdentityMatches(audit, movement);
  }

  if (movement.tipo === "AJUSTE") {
    if (audit.accion !== "AJUSTE_CREDITO" || audit.entidad !== "clientes") {
      return false;
    }
    if (
      Number(audit.entidadId) !== clientId ||
      Number(payload.movimientoCreditoId) !== movementId
    ) {
      return false;
    }
    return auditedMovementIdentityMatches(audit, movement);
  }

  if (audit.accion !== "REVERSAR_PAGO_CLIENTE" || audit.entidad !== "movimientos_credito") {
    return false;
  }
  if (Number(audit.entidadId) !== movementId) return false;
  if (Number(payload.reversoId) !== movementId) return false;
  return auditedMovementIdentityMatches(audit, movement);
}

function auditMatchesOriginalPayment(
  audit: CreditMovementDetailAuditEvent,
  movement: CreditMovementDetailMovement,
  originalId: number,
): boolean {
  const payload = auditPayload(audit);
  const originalAmount = movement.movimientoOriginalImporte;
  return (
    movement.tipo === "REVERSO" &&
    audit.accion === "PAGO_CLIENTE" &&
    audit.entidad === "clientes" &&
    Number(audit.entidadId) === Number(movement.clienteId) &&
    Number(payload.movimientoCreditoId) === originalId &&
    originalAmount != null &&
    movement.movimientoOriginalFechaEfectiva != null &&
    auditedMovementIdentityMatches(audit, {
      id: originalId,
      clienteId: movement.clienteId,
      tipo: "ABONO",
      importe: originalAmount,
      fechaEfectiva: movement.movimientoOriginalFechaEfectiva,
    })
  );
}

function auditedMovementIdentityMatches(
  audit: CreditMovementDetailAuditEvent,
  movement: Pick<
    CreditMovementDetailMovement,
    "clienteId" | "id" | "tipo" | "importe" | "fechaEfectiva"
  >,
): boolean {
  const movementId = Number(movement.id);
  const clientId = Number(movement.clienteId);
  if (!Number.isSafeInteger(movementId) || !Number.isSafeInteger(clientId)) {
    return false;
  }
  const auditedMovement: AuditedCreditMovement = {
    id: movementId,
    clienteId: clientId,
    tipo: movement.tipo,
    createdAt: movement.fechaEfectiva,
    importe: movement.importe,
  };
  // PAGO_CLIENTE and AJUSTE_CREDITO historically audit the client owner, while
  // REVERSAR_PAGO_CLIENTE audits the new movement. Normalize only the owner
  // resolver's navigation key; the action/entity predicates remain above.
  const resolverAudit = {
    ...audit,
    entidad: "movimientos_credito",
    entidadId: String(movementId),
  };
  if (!auditMatchesCreditMovementIdentity(resolverAudit, auditedMovement)) {
    return false;
  }
  return auditPayloadContainsMovementId(audit, movementId);
}

function auditPayloadContainsMovementId(
  audit: CreditMovementDetailAuditEvent,
  movementId: number,
): boolean {
  const payload = auditPayload(audit);
  const candidates = [
    payload.movimiento,
    payload.movimientoCredito,
    payload.creditMovement,
  ];
  return candidates.some((candidate) => {
    const snapshot = asObject(candidate);
    return Number(snapshot.id) === movementId;
  });
}

function auditMotivo(row: CreditMovementDetailAuditEvent): string | null {
  const payload = auditPayload(row);
  return (
    asString(payload.motivo) ??
    asString(payload.motivoReverso) ??
    asString(payload.reason)
  );
}

function presentAudit(row: CreditMovementDetailAuditEvent): CreditMovementAudit | null {
  const id = asNumber(row.id);
  const fecha = asIso(row.fecha);
  if (id == null || fecha == null) return null;
  return {
    id,
    accion: row.accion,
    fecha,
    usuario: row.usuario,
    motivo: auditMotivo(row),
  };
}

function projectedRowsForSource(
  projection: CustomerCreditProjection,
  sourceId: number,
): CreditMovementDetailReparto[] {
  const traced = projection.allocations.filter(
    (allocation) => allocation.sourceId === sourceId,
  );
  return buildProjectedAllocationRows(traced, projection.allCharges, true);
}

function presentLegacyApplications(
  rows: CreditMovementDetailApplicationEvidence[],
  projection: CustomerCreditProjection,
) {
  const chargesById = new Map(
    projection.allCharges.map((charge) => [charge.movimientoId, charge]),
  );
  return rows.flatMap((row) => {
    const charge = chargesById.get(Number(row.movimientoVentaId));
    // A retained application with a purged target has no current balance
    // evidence. Do not replace that absence with zero.
    if (!charge) return [];
    const ticketId = asNumber(row.ticketId);
    const folio = asNumber(row.folio);
    const movimientoVentaId = asNumber(row.movimientoVentaId);
    if (ticketId == null || folio == null || movimientoVentaId == null) return [];
    const saldoActual = centsToMoney(charge.pendienteCents);
    const fechaVencimiento = charge.dueAt;
    return [{
      ticketId,
      folio,
      movimientoVentaId,
      aplicado: row.aplicado,
      importeOriginal: row.importeOriginal,
      saldoActual,
      resultado: legacyNoteState(row.importeOriginal, saldoActual, fechaVencimiento),
      estadoNota: deriveEstadoNota({
        importeOriginal: row.importeOriginal,
        saldoPendiente: saldoActual,
        fechaVencimiento,
        hoy: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
      }),
    }];
  });
}

export type CreditMovementDetailReadFixture = {
  movement: CreditMovementDetailMovement;
  projection: CustomerCreditProjection;
  applications: CreditMovementDetailApplicationEvidence[];
  audits: CreditMovementDetailAuditEvent[];
};

/**
 * Pure response builder for a canonical read fixture.  Verification workers
 * can feed an offline, read-only archive through this function without
 * mocking SQL result order or touching the live database.
 */
export function buildCreditMovementDetailFromReadFixture(
  fixture: CreditMovementDetailReadFixture,
): Record<string, unknown> | null {
  const { movement, projection } = fixture;
  const movementId = asNumber(movement.id);
  const clienteId = asNumber(movement.clienteId);
  if (movementId == null || clienteId == null) return null;

  const matchingAudits = fixture.audits.filter((audit) =>
    auditMatchesMovement(audit, movement),
  );
  const auditoria = matchingAudits.flatMap((audit) => {
    const item = presentAudit(audit);
    return item ? [item] : [];
  });
  const fechaCaptura = asIso(matchingAudits[0]?.fecha);
  const evidence = fixture.applications.filter(
    (row) => Number(row.abonoMovimientoId) === movementId,
  );
  const originalId = asNumber(movement.movimientoOriginalId);
  const originalEvidence =
    movement.tipo === "REVERSO" && originalId != null
      ? fixture.applications.filter(
          (row) => Number(row.abonoMovimientoId) === originalId,
        )
      : [];
  const reversoMovimientoId = asNumber(movement.reversoMovimientoId);
  const reversed = reversoMovimientoId != null;
  const originalAudits =
    movement.tipo === "REVERSO" && originalId != null
      ? fixture.audits.filter((audit) =>
          auditMatchesOriginalPayment(audit, movement, originalId),
        )
      : [];
  const historicalAudits = [...matchingAudits, ...originalAudits];

  const detail: Record<string, unknown> = {
    // Legacy fields intentionally remain present and unchanged for the
    // existing Ver Reparto dialog.
    id: movementId,
    clienteId,
    fecha: asIso(movement.fechaEfectiva),
    montoTotalAbono: absoluteMoney(movement.importe),
    formaPago: movement.formaPago,
    cuentaDestino: movement.cuentaDestino,
    referencia: movement.referencia,
    usuarioRegistrador: movement.usuarioRegistrador,
    revertido: reversed,
    reversoMovimientoId,
    motivoReverso:
      movement.tipo === "REVERSO"
        ? movement.notas
        : movement.motivoReverso,
    aplicaciones:
      movement.tipo === "ABONO"
        ? presentLegacyApplications(evidence, projection)
        : [],
    // Additive canonical detail fields.
    clienteNombre: movement.clienteNombre,
    tipo: movement.tipo,
    importe: movement.importe,
    fechaEfectiva: asIso(movement.fechaEfectiva),
    fechaCaptura,
    usuarioCaptura:
      matchingAudits[0]?.usuario ?? movement.usuarioRegistrador ?? null,
    notas: movement.notas,
    ticketId: asNumber(movement.ticketId),
    ticketFolio: asNumber(movement.ticketFolio),
    movimientoOriginalId: originalId,
  };

  if (movement.tipo === "ABONO") {
    if (reversed) {
      // Prefix projection is not captured history. Keep only immutable
      // application evidence and explicitly leave balances unknown.
      detail.reparto = buildAuditedHistoricalEvidenceRows(evidence, matchingAudits);
      detail.saldoAFavor = null;
    } else {
      detail.reparto = projectedRowsForSource(
        projection,
        movementId,
      );
      const favor = projection.overpaymentSources.find(
        (source) => source.movementId === movementId,
      )?.availableCents;
      detail.saldoAFavor = favor == null ? null : centsToMoney(favor);
    }
  }

  if (
    movement.tipo === "REVERSO" &&
    movement.movimientoOriginalTipo === "ABONO" &&
    originalId != null
  ) {
    // A reversal has no own allocation. These are immutable inactive
    // applications; null balances mean historical before/after evidence was
    // not retained, rather than a current projected zero.
    detail.aplicacionesRevertidas = buildAuditedHistoricalEvidenceRows(
      originalEvidence,
      historicalAudits,
    );
  }

  if (auditoria.length > 0) detail.auditoria = auditoria;
  return detail;
}

export type CreditMovementDetailQueryProbe = {
  name: "movement" | "applications" | "auditoria";
  text: string;
  values: readonly unknown[];
};

/**
 * Exact SQL probes used by the read adapter.  Keeping these available to the
 * readonly verification harness lets it EXPLAIN the same statements without
 * reproducing query text or inventing a fake SQL-result matcher.
 */
export function buildCreditMovementDetailReadQueries(
  clienteId: number,
  movimientoId: number,
  sourceIds: readonly number[] = [],
): CreditMovementDetailQueryProbe[] {
  const movement: CreditMovementDetailQueryProbe = {
    name: "movement",
    text: `SELECT m.id,m.cliente_id AS "clienteId",c.nombre AS "clienteNombre",
       m.tipo,m.importe::text,m.created_at AS "fechaEfectiva",
       m.forma_pago AS "formaPago",m.cuenta_destino AS "cuentaDestino",
       m.referencia,m.notas,u.nombre AS "usuarioRegistrador",
       m.ticket_id AS "ticketId",t.folio AS "ticketFolio",
       CASE WHEN original.id IS NOT NULL THEN m.movimiento_origen_id ELSE NULL END
         AS "movimientoOriginalId",
       original.tipo AS "movimientoOriginalTipo",
        original.importe::text AS "movimientoOriginalImporte",
        original.created_at AS "movimientoOriginalFechaEfectiva",
       reverse.id AS "reversoMovimientoId",
       reverse.notas AS "motivoReverso"
     FROM movimientos_credito m
     JOIN clientes c ON c.id=m.cliente_id
     JOIN usuarios u ON u.id=m.usuario_id
     LEFT JOIN tickets t ON t.id=m.ticket_id AND t.cliente_id=m.cliente_id
     LEFT JOIN movimientos_credito original
       ON original.id=m.movimiento_origen_id
      AND original.cliente_id=m.cliente_id
     LEFT JOIN movimientos_credito reverse
       ON reverse.movimiento_origen_id=m.id
      AND reverse.cliente_id=m.cliente_id
      AND reverse.tipo='REVERSO'
     WHERE m.id=$1 AND m.cliente_id=$2
       AND m.tipo IN ('ABONO','REVERSO','AJUSTE')
     LIMIT 1`,
    values: [movimientoId, clienteId],
  };
  const auditoria: CreditMovementDetailQueryProbe = {
    name: "auditoria",
    text: `SELECT a.id::text,a.accion,a.created_at AS fecha,a.entidad,a.entidad_id AS "entidadId",
     COALESCE(a.usuario_snapshot,u.nombre) AS usuario,
     a.datos_antes AS "datosAntes",a.datos_despues AS "datosDespues"
   FROM auditoria a
   LEFT JOIN usuarios u ON u.id=a.usuario_id
   WHERE (
     (a.entidad='movimientos_credito' AND a.entidad_id=ANY($1::text[]))
     OR (a.entidad='clientes' AND a.entidad_id=$2)
   )
   ORDER BY a.created_at,a.id
   LIMIT 100`,
    values: [[String(movimientoId), ...sourceIds.map(String)], String(clienteId)],
  };
  if (sourceIds.length === 0) return [movement, auditoria];
  return [
    movement,
    {
      name: "applications",
      text: `SELECT a.abono_movimiento_id AS "abonoMovimientoId",
         sale.ticket_id AS "ticketId",t.folio,
         sale.id AS "movimientoVentaId",a.importe::text AS aplicado,
         sale.importe::text AS "importeOriginal",
         sale.fecha_vencimiento AS "fechaVencimiento"
       FROM aplicaciones_credito a
       JOIN movimientos_credito sale
         ON sale.id=a.venta_movimiento_id AND sale.cliente_id=$2
       LEFT JOIN tickets t
         ON t.id=sale.ticket_id AND t.cliente_id=$2
       WHERE a.abono_movimiento_id=ANY($1::int[])
       ORDER BY a.abono_movimiento_id,a.id`,
      values: [sourceIds, clienteId],
    },
    auditoria,
  ];
}

export async function buildCreditMovementDetail(
  database: CreditMovementDetailDatabase,
  clienteId: number,
  movimientoId: number,
): Promise<Record<string, unknown> | null> {
  const movementQuery = buildCreditMovementDetailReadQueries(
    clienteId,
    movimientoId,
  )[0]!;
  const movementResult = await database.query<CreditMovementDetailMovement>(
    movementQuery.text,
    movementQuery.values,
  );
  const movement = movementResult.rows[0];
  if (!movement) return null;

  // This is the sole read-model call for current canonical allocations and
  // balances. Historical before/after values are never derived from a
  // recomputed ledger prefix.
  const projection = await loadCustomerCreditProjection(clienteId, database);

  const sourceIds = [
    movement.tipo === "ABONO" ? Number(movement.id) : null,
    movement.tipo === "REVERSO" && movement.movimientoOriginalTipo === "ABONO"
      ? Number(movement.movimientoOriginalId)
      : null,
  ].filter((id): id is number => id != null && Number.isSafeInteger(id));
  const readQueries = buildCreditMovementDetailReadQueries(
    clienteId,
    movimientoId,
    sourceIds,
  );
  const applicationQuery = readQueries.find((query) => query.name === "applications");
  const applicationResult = applicationQuery
    ? await database.query<CreditMovementDetailApplicationEvidence>(
        applicationQuery.text,
        applicationQuery.values,
      )
    : { rows: [] };
  const auditQuery = readQueries.find((query) => query.name === "auditoria")!;
  const auditResult = await database.query<CreditMovementDetailAuditEvent>(
    auditQuery.text,
    auditQuery.values,
  );
  return buildCreditMovementDetailFromReadFixture({
    movement,
    projection,
    applications: applicationResult.rows,
    audits: auditResult.rows,
  });
}
