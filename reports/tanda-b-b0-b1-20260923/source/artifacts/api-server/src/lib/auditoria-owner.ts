export type AuditedCreditMovement = {
  id: number | string;
  clienteId: number | string;
  tipo: string;
  createdAt: Date | string;
  importe: number | string;
};

export type CreditMovementAuditIdentity = {
  entidad: string;
  entidadId: string | null;
  fecha: Date | string;
  datosAntes: unknown;
  datosDespues: unknown;
};

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function timestamp(value: unknown): number | null {
  const parsed = value instanceof Date ? value : new Date(String(value));
  const milliseconds = parsed.getTime();
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function sameMoney(left: unknown, right: unknown): boolean {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    Math.round(leftNumber * 100) === Math.round(rightNumber * 100)
  );
}

function objectValues(value: unknown, depth = 0): Record<string, unknown>[] {
  if (
    value == null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    depth > 3
  ) {
    return [];
  }
  const object = value as Record<string, unknown>;
  return [
    object,
    ...Object.values(object).flatMap((child) => objectValues(child, depth + 1)),
  ];
}

function identityValue(
  object: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      return object[key];
    }
  }
  return undefined;
}

/**
 * Strictly matches the live movement against the immutable identity retained in
 * an audit payload. An audit ID or entity ID by itself is unsafe because a
 * purged movement may later reuse that numeric ID.
 */
export function auditMatchesCreditMovementIdentity(
  audit: CreditMovementAuditIdentity,
  movement: AuditedCreditMovement | null,
): boolean {
  if (
    movement == null ||
    audit.entidad !== "movimientos_credito" ||
    positiveInteger(audit.entidadId) !== positiveInteger(movement.id)
  ) {
    return false;
  }
  const clienteId = positiveInteger(movement.clienteId);
  const movementAt = timestamp(movement.createdAt);
  const auditAt = timestamp(audit.fecha);
  if (
    clienteId == null ||
    movementAt == null ||
    auditAt == null ||
    auditAt < movementAt
  ) {
    return false;
  }

  const payloadObjects = [
    ...objectValues(audit.datosAntes),
    ...objectValues(audit.datosDespues),
  ];
  return payloadObjects.some((payload) => {
    const payloadClienteId = positiveInteger(
      identityValue(payload, ["clienteId", "cliente_id"]),
    );
    const payloadTipo = identityValue(payload, ["tipo"]);
    const payloadCreatedAt = timestamp(
      identityValue(payload, ["createdAt", "created_at"]),
    );
    const payloadImporte = identityValue(payload, ["importe"]);
    return (
      payloadClienteId === clienteId &&
      typeof payloadTipo === "string" &&
      payloadTipo === movement.tipo &&
      payloadCreatedAt === movementAt &&
      sameMoney(payloadImporte, movement.importe)
    );
  });
}

/**
 * Returns the live owner only after the strict identity predicate succeeds.
 * Missing or mismatched historical metadata intentionally remains unresolved.
 */
export function resolveAuditedCreditMovementOwner(
  audit: CreditMovementAuditIdentity,
  movement: AuditedCreditMovement | null,
): number | null {
  if (!auditMatchesCreditMovementIdentity(audit, movement)) return null;
  const clienteId = positiveInteger(movement?.clienteId);
  return clienteId;
}
