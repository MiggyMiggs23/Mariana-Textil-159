"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// artifacts/api-server/src/lib/payment-behavior.test.ts
var import_strict = __toESM(require("node:assert/strict"), 1);
var import_node_test = __toESM(require("node:test"), 1);

// sealed-db:db
var db = new Proxy({}, { get() {
  throw Error("DB forbidden in pure projection test");
} });

// artifacts/api-server/src/lib/date-only.ts
function calendarDate(value) {
  if (typeof value === "string") return value.slice(0, 10);
  const utcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
  const year = utcMidnight ? value.getUTCFullYear() : value.getFullYear();
  const month = utcMidnight ? value.getUTCMonth() + 1 : value.getMonth() + 1;
  const day2 = utcMidnight ? value.getUTCDate() : value.getDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day2).padStart(2, "0")}`;
}

// artifacts/api-server/src/lib/credit-allocation.ts
function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}
function projectCreditLedgerCore(movements) {
  const ordered = [...movements].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const cents = (value) => moneyToCents(value);
  const reversedAbonos = new Set(ordered.filter(
    (m) => m.tipo === "REVERSO" && m.movimientoOrigenId != null && cents(m.importe) > 0
  ).map((m) => m.movimientoOrigenId));
  const ticketReductions = /* @__PURE__ */ new Map();
  const directedPayments = [];
  for (const movement2 of ordered) {
    const amount = cents(movement2.importe);
    const isLinkedReversal = movement2.tipo === "REVERSO" && movement2.ticketId != null && amount < 0;
    const isDirectedPayment = movement2.tipo === "ABONO" && movement2.directedMovimientoId != null && !reversedAbonos.has(movement2.id) && amount < 0;
    if (isLinkedReversal) {
      ticketReductions.set(
        movement2.ticketId,
        (ticketReductions.get(movement2.ticketId) ?? 0) - amount
      );
    }
    if (isDirectedPayment) directedPayments.push(movement2);
  }
  const sourceMovements = ordered.filter((movement2) => {
    const amount = cents(movement2.importe);
    return movement2.tipo === "DEVOLUCION_COMERCIAL" || movement2.tipo === "ABONO" && !reversedAbonos.has(movement2.id) || movement2.tipo === "AJUSTE" && amount < 0;
  });
  const baseTargetBalances = /* @__PURE__ */ new Map();
  const chargeMovements = ordered.filter((movement2) => movement2.tipo === "VENTA_CREDITO" || movement2.tipo === "AJUSTE" && cents(movement2.importe) > 0);
  for (const movement2 of chargeMovements) {
    baseTargetBalances.set(
      movement2.id,
      Math.max(
        0,
        Math.max(0, cents(movement2.importe)) - (movement2.tipo === "VENTA_CREDITO" && movement2.ticketId != null ? ticketReductions.get(movement2.ticketId) ?? 0 : 0)
      )
    );
  }
  const directedReservedBySource = /* @__PURE__ */ new Map();
  for (const payment of directedPayments) {
    const targetId = payment.directedMovimientoId;
    const targetBalance = baseTargetBalances.get(targetId) ?? 0;
    const appliedCents = Math.min(
      targetBalance,
      Math.max(0, -cents(payment.importe))
    );
    if (appliedCents <= 0) continue;
    baseTargetBalances.set(targetId, targetBalance - appliedCents);
    directedReservedBySource.set(payment.id, appliedCents);
  }
  const balances = new Map(
    chargeMovements.map((movement2) => [
      movement2.id,
      baseTargetBalances.get(movement2.id) ?? 0
    ])
  );
  const explicitAllocations = [];
  const allocations = [];
  const overpaymentSources = /* @__PURE__ */ new Map();
  const sourceIds = new Set(sourceMovements.map((movement2) => movement2.id));
  const targetById = new Map(chargeMovements.map((movement2) => [movement2.id, movement2]));
  const movementPrecedes = (left, right) => left.createdAt.getTime() < right.createdAt.getTime() || left.createdAt.getTime() === right.createdAt.getTime() && left.id < right.id;
  const canImplicitlyApply = (source, target) => (
    // Unmarked historical charges preserve the old global FIFO projection.
    !target.preventImplicitFavor || movementPrecedes(target, source)
  );
  for (const source of sourceMovements) {
    if (source.tipo === "DEVOLUCION_COMERCIAL") {
      const targetId = source.movimientoOrigenId;
      const target = targetId == null ? void 0 : targetById.get(targetId);
      const reduction = -cents(source.importe);
      const pending = targetId == null ? void 0 : balances.get(targetId);
      if (!target || target.tipo !== "VENTA_CREDITO" || target.ticketId !== source.ticketId || !movementPrecedes(target, source) || !Number.isSafeInteger(reduction) || reduction < 0 || pending == null || reduction > pending) {
        throw new Error("DEVOLUCION_COMERCIAL_LEDGER_INVALIDO: cancelaci\xF3n dirigida incompatible con la deuda.");
      }
      balances.set(target.id, pending - reduction);
      continue;
    }
    let remainingCents = Math.max(
      0,
      Math.max(0, -cents(source.importe)) - (directedReservedBySource.get(source.id) ?? 0)
    );
    const applyNormal = (targetPredicate) => {
      for (const target of chargeMovements) {
        if (remainingCents <= 0) break;
        if (!targetPredicate(target) || !canImplicitlyApply(source, target)) {
          continue;
        }
        const balanceBeforeCents = balances.get(target.id) ?? 0;
        if (balanceBeforeCents <= 0) continue;
        const appliedCents = Math.min(remainingCents, balanceBeforeCents);
        balances.set(target.id, balanceBeforeCents - appliedCents);
        remainingCents -= appliedCents;
        allocations.push({
          sourceId: source.id,
          targetId: target.id,
          appliedCents,
          balanceBeforeCents,
          balanceAfterCents: balanceBeforeCents - appliedCents
        });
      }
    };
    const applications = source.tipo === "ABONO" ? source.explicitFavorApplications ?? [] : [];
    for (const application of applications) {
      if (application.sourceId !== source.id || !sourceIds.has(source.id) || !Number.isFinite(application.amountCents) || application.amountCents <= 0) {
        continue;
      }
      const target = targetById.get(application.targetId);
      if (!target) continue;
      applyNormal(
        (candidate) => candidate.id !== target.id && movementPrecedes(candidate, target)
      );
      if (remainingCents <= 0) break;
      const balanceBeforeCents = balances.get(target.id) ?? 0;
      const appliedCents = Math.min(
        remainingCents,
        balanceBeforeCents,
        application.amountCents
      );
      if (appliedCents <= 0) continue;
      balances.set(target.id, balanceBeforeCents - appliedCents);
      remainingCents -= appliedCents;
      explicitAllocations.push({
        sourceId: source.id,
        targetId: target.id,
        appliedCents,
        balanceBeforeCents,
        balanceAfterCents: balanceBeforeCents - appliedCents
      });
    }
    applyNormal(() => true);
    overpaymentSources.set(source.id, remainingCents);
  }
  const overpaymentCents = [...overpaymentSources.values()].reduce(
    (sum, amount) => sum + amount,
    0
  );
  const allCharges = chargeMovements.map((movement2) => ({
    movimientoId: movement2.id,
    ticketId: movement2.ticketId,
    createdAt: movement2.createdAt,
    dueAt: movement2.fechaVencimiento == null ? null : calendarDate(movement2.fechaVencimiento),
    originalCents: Math.max(0, cents(movement2.importe)),
    pendienteCents: balances.get(movement2.id) ?? 0,
    folio: movement2.folio ?? null,
    diasPlazo: movement2.diasPlazo ?? null,
    notas: movement2.notas ?? null,
    tipo: movement2.tipo
  }));
  const charges = allCharges.filter((charge) => charge.pendienteCents > 0);
  const balanceCents = charges.reduce((sum, charge) => sum + charge.pendienteCents, 0);
  return {
    charges,
    allCharges,
    allocations: [...allocations, ...explicitAllocations],
    overpaymentCents,
    overpaymentSources: sourceMovements.filter((movement2) => movement2.tipo !== "DEVOLUCION_COMERCIAL").map((movement2) => ({
      movementId: movement2.id,
      availableCents: overpaymentSources.get(movement2.id) ?? 0,
      tipo: movement2.tipo
    })),
    balanceCents
  };
}
function projectSimpleLedgerPrefixes(ordered) {
  const targets = [];
  const sources = [];
  const result = [];
  const movementPrecedes = (left, right) => left.createdAt.getTime() < right.createdAt.getTime() || left.createdAt.getTime() === right.createdAt.getTime() && left.id < right.id;
  const canImplicitlyApply = (source, target) => !target.preventImplicitFavor || movementPrecedes(target, source);
  for (const movement2 of ordered) {
    const amountCents = moneyToCents(movement2.importe);
    const isTarget = movement2.tipo === "VENTA_CREDITO" || movement2.tipo === "AJUSTE" && amountCents > 0;
    const isSource = movement2.tipo === "ABONO" && amountCents < 0 || movement2.tipo === "AJUSTE" && amountCents < 0;
    if (isTarget) {
      const target = { movement: movement2, balanceCents: amountCents };
      for (const source of sources) {
        if (source.remainingCents <= 0 || !canImplicitlyApply(source.movement, movement2)) {
          continue;
        }
        const applied = Math.min(source.remainingCents, target.balanceCents);
        source.remainingCents -= applied;
        target.balanceCents -= applied;
        if (target.balanceCents <= 0) break;
      }
      targets.push(target);
    }
    if (isSource) {
      const source = {
        movement: movement2,
        remainingCents: Math.max(0, -amountCents)
      };
      for (const target of targets) {
        if (source.remainingCents <= 0) break;
        if (!canImplicitlyApply(source.movement, target.movement)) continue;
        const applied = Math.min(source.remainingCents, target.balanceCents);
        source.remainingCents -= applied;
        target.balanceCents -= applied;
      }
      sources.push(source);
    }
    result.push({
      movementId: movement2.id,
      saldoDeudorProyectadoCents: targets.reduce(
        (sum, target) => sum + target.balanceCents,
        0
      ),
      saldoAFavorProyectadoCents: sources.reduce(
        (sum, source) => sum + source.remainingCents,
        0
      )
    });
  }
  return result;
}
function projectCreditLedger(movements, options = {}) {
  const ordered = [...movements].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const projection = projectCreditLedgerCore(ordered);
  const includeAllocationTraces = options.includeAllocationTraces === true;
  const movementProjections = options.includeMovementProjections === true ? ordered.some((movement2) => movement2.tipo === "REVERSO" || movement2.tipo === "DEVOLUCION_COMERCIAL" || movement2.directedMovimientoId != null || (movement2.explicitFavorApplications?.length ?? 0) > 0) ? ordered.map((_, index) => {
    const prefix = projectCreditLedgerCore(ordered.slice(0, index + 1));
    return {
      movementId: ordered[index].id,
      saldoDeudorProyectadoCents: prefix.balanceCents,
      saldoAFavorProyectadoCents: prefix.overpaymentCents,
      ...includeAllocationTraces ? { allocations: prefix.allocations } : {}
    };
  }) : includeAllocationTraces ? ordered.map((_, index) => {
    const prefix = projectCreditLedgerCore(ordered.slice(0, index + 1));
    return {
      movementId: ordered[index].id,
      saldoDeudorProyectadoCents: prefix.balanceCents,
      saldoAFavorProyectadoCents: prefix.overpaymentCents,
      allocations: prefix.allocations
    };
  }) : projectSimpleLedgerPrefixes(ordered) : [];
  return { ...projection, movementProjections };
}

// artifacts/api-server/src/lib/clientes-aging.ts
function mexicoCityDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

// artifacts/api-server/src/lib/payment-behavior.ts
var PAYMENT_BEHAVIOR_GREEN_MIN_PERCENT = 90;
var PAYMENT_BEHAVIOR_YELLOW_MIN_PERCENT = 70;
var PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES = 5;
var CREDIT_INCREASE_SUBSTANTIAL_UTILIZATION_PERCENT = 75;
var day = (value) => typeof value === "string" ? value.slice(0, 10) : mexicoCityDate(value);
function projectPaymentBehavior(movements, limit, today = /* @__PURE__ */ new Date()) {
  const ledger = projectCreditLedger(movements);
  const byId = new Map(movements.map((movement2) => [movement2.id, movement2]));
  const paymentDates = /* @__PURE__ */ new Map();
  for (const allocation of ledger.allocations) {
    const source = byId.get(allocation.sourceId);
    if (source?.tipo === "ABONO") {
      paymentDates.set(allocation.targetId, [...paymentDates.get(allocation.targetId) ?? [], source.createdAt]);
    }
  }
  for (const movement2 of movements) {
    if (movement2.tipo === "ABONO" && movement2.directedMovimientoId != null) {
      paymentDates.set(movement2.directedMovimientoId, [
        ...paymentDates.get(movement2.directedMovimientoId) ?? [],
        movement2.createdAt
      ]);
    }
  }
  let settledNotes = 0;
  let onTimeNotes = 0;
  let overdueOpenNotes = 0;
  let openNotDueNotes = 0;
  const todayDay = day(today);
  for (const charge of ledger.allCharges.filter((item) => item.tipo === "VENTA_CREDITO")) {
    const dates = paymentDates.get(charge.movimientoId) ?? [];
    if (charge.pendienteCents === 0 && dates.length > 0) {
      settledNotes += 1;
      const settledAt = dates.reduce((latest, value) => value > latest ? value : latest);
      if (charge.dueAt != null && day(settledAt) <= charge.dueAt) onTimeNotes += 1;
    } else if (charge.pendienteCents > 0 && charge.dueAt != null && charge.dueAt < todayDay) {
      overdueOpenNotes += 1;
    } else if (charge.pendienteCents > 0) {
      openNotDueNotes += 1;
    }
  }
  const evaluatedNotes = settledNotes + overdueOpenNotes;
  const percentage = evaluatedNotes === 0 ? 0 : Math.round(onTimeNotes * 1e4 / evaluatedNotes) / 100;
  const sufficientHistory = settledNotes >= PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES;
  const color = !sufficientHistory ? "INSUFFICIENT" : percentage >= PAYMENT_BEHAVIOR_GREEN_MIN_PERCENT ? "GREEN" : percentage >= PAYMENT_BEHAVIOR_YELLOW_MIN_PERCENT ? "YELLOW" : "RED";
  const balanceCents = ledger.balanceCents - ledger.overpaymentCents;
  const limitCents = Math.round(Number(limit) * 100);
  const utilizationPercent = limitCents <= 0 ? 0 : Math.round(balanceCents * 1e4 / limitCents) / 100;
  const suggestCreditIncrease = color === "GREEN" && sufficientHistory && utilizationPercent >= CREDIT_INCREASE_SUBSTANTIAL_UTILIZATION_PERCENT && overdueOpenNotes === 0;
  return {
    percentage,
    settledNotes,
    evaluatedNotes,
    onTimeNotes,
    overdueOpenNotes,
    openNotDueNotes,
    color,
    sufficientHistory,
    utilizationPercent,
    suggestCreditIncrease,
    suggestionReason: suggestCreditIncrease ? `${settledNotes} notas liquidadas, ${percentage}% a tiempo y ${utilizationPercent}% del l\xEDmite utilizado.` : null,
    period: "Todo el historial autorizado hasta hoy",
    explanation: "Mide por nota liquidada si se pag\xF3 a m\xE1s tardar en su vencimiento; incluye vencidas impagas como tard\xEDas y excluye abiertas a\xFAn no vencidas."
  };
}

// artifacts/api-server/src/lib/payment-behavior.test.ts
var movement = (id, tipo, importe, createdAt, extra = {}) => ({
  id,
  ticketId: tipo === "VENTA_CREDITO" ? id : null,
  tipo,
  importe,
  createdAt: /* @__PURE__ */ new Date(`${createdAt}T12:00:00Z`),
  ...extra
});
(0, import_node_test.default)("payment on due date is on time and every note has equal weight", () => {
  const rows = [
    movement(1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    movement(2, "ABONO", -100, "2026-01-10"),
    movement(3, "VENTA_CREDITO", 1e5, "2026-01-11", { fechaVencimiento: "2026-01-20" }),
    movement(4, "ABONO", -1e5, "2026-01-21")
  ];
  const result = projectPaymentBehavior(rows, 2e5, /* @__PURE__ */ new Date("2026-02-01T12:00:00Z"));
  import_strict.default.equal(result.percentage, 50);
  import_strict.default.equal(result.settledNotes, 2);
  import_strict.default.equal(result.color, "INSUFFICIENT");
});
(0, import_node_test.default)("overdue unpaid counts late while open not-yet-due is excluded", () => {
  const rows = [
    movement(1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    movement(2, "VENTA_CREDITO", 100, "2026-01-10", { fechaVencimiento: "2026-03-10" })
  ];
  const result = projectPaymentBehavior(rows, 1e3, /* @__PURE__ */ new Date("2026-02-01T12:00:00Z"));
  import_strict.default.equal(result.evaluatedNotes, 1);
  import_strict.default.equal(result.overdueOpenNotes, 1);
  import_strict.default.equal(result.openNotDueNotes, 1);
});
(0, import_node_test.default)("effective payment date uses the Mexico City day near UTC midnight", () => {
  const rows = [
    movement(1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    { ...movement(2, "ABONO", -100, "2026-01-11"), createdAt: /* @__PURE__ */ new Date("2026-01-11T00:30:00Z") }
  ];
  const result = projectPaymentBehavior(rows, 1e3, /* @__PURE__ */ new Date("2026-02-01T12:00:00Z"));
  import_strict.default.equal(result.onTimeNotes, 1);
});
(0, import_node_test.default)("credit suggestion requires green, sufficient history, utilization and no overdue", () => {
  const rows = Array.from({ length: PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES }, (_, index) => [
    movement(index * 2 + 1, "VENTA_CREDITO", 100, "2026-01-01", { fechaVencimiento: "2026-01-10" }),
    movement(index * 2 + 2, "ABONO", -100, "2026-01-10")
  ]).flat();
  const result = projectPaymentBehavior(rows, 1e3, /* @__PURE__ */ new Date("2026-02-01T12:00:00Z"));
  import_strict.default.equal(result.color, "GREEN");
  import_strict.default.equal(result.suggestCreditIncrease, false);
});
