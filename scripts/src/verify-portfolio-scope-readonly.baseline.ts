/**
 * Immutable source fixture for the pre-scope customer portfolio read.
 *
 * This file is intentionally a verbatim capture from:
 *   git show 8da78b2f6351b164c220e4127467a79b541243af:artifacts/api-server/src/routes/clientes.ts
 *
 * It is not a reimplementation of the financial projection.  The verifier
 * checks the capture against the pinned historical commit before using it as evidence, so a changed
 * working tree cannot silently become the legacy baseline.
 */

// Pinned before the scope migration. Never replace this with HEAD: a future
// commit may contain the new implementation and is not a legacy baseline.
export const LEGACY_BASELINE_COMMIT =
  "8da78b2f6351b164c220e4127467a79b541243af" as const;
export const LEGACY_BASELINE_SOURCE_PATH =
  "artifacts/api-server/src/routes/clientes.ts" as const;

export const LEGACY_CARTERA_READ_MODEL_SOURCE = String.raw`async function carteraReadModel() {
  const clients = await pool.query<{ id: number; nombre: string }>(
    "SELECT id,nombre FROM clientes WHERE activo AND NOT es_sistema",
  );
  const projections = await loadCustomerCreditProjections(clients.rows.map((client) => Number(client.id)));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  return clients.rows.map((client) => {
    const projection = projections.get(Number(client.id))!;
    const charges = projection.charges;
    const sum = (predicate: (due: string | null) => boolean) => charges.filter((charge) => predicate(charge.dueAt))
      .reduce((total, charge) => total + charge.pendienteCents, 0);
    const dueDays = (due: string | null) => due == null ? 0 : Math.max(0, Math.floor(
      (Date.parse(\`\${today}T00:00:00Z\`) - Date.parse(\`\${due}T00:00:00Z\`)) / 86400000,
    ));
    const overdue = charges.filter((charge) => charge.dueAt != null && dueDays(charge.dueAt) > 0)
      .map((charge) => charge.dueAt!).sort();
    const oldestDays = overdue[0] == null ? 0 : dueDays(overdue[0]);
    const age = oldestDays === 0 ? "POR_VENCER"
      : oldestDays <= 30 ? "1_30"
      : oldestDays <= 60 ? "31_60"
      : oldestDays <= 90 ? "61_90" : "MAS_90";
    const saldoAFavor = centsToMoney(projection.overpaymentCents);
    return { id: Number(client.id), nombre: client.nombre, saldo: centsToMoney(sum(() => true)), saldoActual: centsToMoney(sum(() => true)), saldoAFavor,
      porVencer: centsToMoney(sum((due) => due != null && due >= today)), sinPlazo: centsToMoney(sum((due) => due == null)),
      "1_30": centsToMoney(sum((due) => dueDays(due) >= 1 && dueDays(due) <= 30)),
      "31_60": centsToMoney(sum((due) => dueDays(due) >= 31 && dueDays(due) <= 60)),
      "61_90": centsToMoney(sum((due) => dueDays(due) >= 61 && dueDays(due) <= 90)),
      mas90: centsToMoney(sum((due) => dueDays(due) > 90)),
      antiguedad: charges.length && charges.every((charge) => charge.dueAt == null) ? "SIN_PLAZO" : age,
      diasVencido: overdue[0] ? Math.floor((Date.parse(\`\${today}T00:00:00Z\`) - Date.parse(\`\${overdue[0]}T00:00:00Z\`)) / 86400000) : 0,
      vencido: centsToMoney(sum((due) => due != null && due < today)),
      primerVencimiento: charges.map((charge) => charge.dueAt).filter(Boolean).sort()[0] ?? null,
    };
  }).filter((row) => row.saldoActual !== "0.00").sort((a, b) => Number(b.saldoActual) - Number(a.saldoActual));
}`.replaceAll("\\`", "`").replaceAll("\\${", "${");

export const LEGACY_RESUMEN_HANDLER_CORE_SOURCE = String.raw`       const result = await pool.query<{ id: number }>("SELECT id FROM clientes WHERE activo");
       const projections = await loadCustomerCreditProjections(result.rows.map((row) => Number(row.id)));
       const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
       const balances = [...projections.values()];
      res.json({
         totalClientes: result.rows.length,
         clientesConSaldo: balances.filter((projection) => projection.balanceCents > 0).length,
         totalCartera: centsToMoney(balances.reduce((sum, projection) => sum + projection.balanceCents, 0)),
         totalVencido: centsToMoney(balances.reduce((sum, projection) => sum + projection.charges
           .filter((charge) => charge.dueAt != null && charge.dueAt < today)
           .reduce((subtotal, charge) => subtotal + charge.pendienteCents, 0), 0)),
      });`;

export const LEGACY_BASELINE_FIXTURE = Object.freeze({
  commit: LEGACY_BASELINE_COMMIT,
  sourcePath: LEGACY_BASELINE_SOURCE_PATH,
  carteraReadModel: LEGACY_CARTERA_READ_MODEL_SOURCE,
  resumenHandlerCore: LEGACY_RESUMEN_HANDLER_CORE_SOURCE,
});