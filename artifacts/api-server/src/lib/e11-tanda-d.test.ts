import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { E11_ENABLED, E11_PROFILE_ASSIGNMENT_ENABLED, E11_RECONCILIATION_ENABLED, E11_E5_PREPARATION_ENABLED } from "./e11-feature";
import { createE11Runtime, e11Runtime } from "./e11-runtime";
import { E5_ENABLED, E5_CONTADOR_A_ENABLED } from "./e5-feature";
import { E7_ATTRIBUTION_ENABLED, E7_CLIENT_FINANCIAL_READS_ENABLED, E7_ENABLED } from "./e7-feature";
import { E9_ENABLED } from "./e9-feature";
import { E4_CASH_OUT_ENABLED } from "./e4-cash-out";
import { E12_SUPPLIER_CASH_ENABLED } from "./e12-supplier-cash";
import { e11Identity, e11FiscalClients, e11FiscalSales, e11SecurityLock, e11UserRoleChange, type E11Sql } from "./e11-repository";
import { e11Period, e11Capability } from "./e11";
import { e11LegacyAllowed } from "../middlewares/e11-legacy";

// Synthetic query contract only: no DB driver, network, auth session or real writes.
const dialect = new PgDialect();
const uiSource = readFileSync(new URL("../../../mariana-textil/src/lib/e11-feature-flags.ts", import.meta.url), "utf8");
function uiFlag(name: string) {
  const match = uiSource.match(new RegExp(`export const ${name} = (true|false);`));
  assert.ok(match, `Missing UI gate ${name}`);
  return match[1] === "true";
}
function fixture(role: string, profile: string | null = null) {
  const queries: string[] = [];
  const tx: E11Sql = { execute: async query => {
    const text = dialect.sqlToQuery(query).sql;
    queries.push(text);
    if (text.includes("FROM usuarios")) return { rows: [{ id: 7, rol: role, activo: true }] };
    if (text.includes("FROM e11_perfiles")) return { rows: profile ? [{ perfil: profile, version: 1 }] : [] };
    return { rows: [] };
  } };
  return { tx, queries };
}
test("released gates enable ADMIN profile assignment but keep E5 preparation closed", () => {
  assert.deepEqual([E11_ENABLED, E11_RECONCILIATION_ENABLED, uiFlag("E11_ENABLED"), uiFlag("E11_UI_ENABLED"),
    uiFlag("E11_RECONCILIATION_ENABLED")], [true, true, true, true, true]);
  assert.deepEqual([E11_PROFILE_ASSIGNMENT_ENABLED, uiFlag("E11_PROFILE_ASSIGNMENT_ENABLED")], [true, true]);
  assert.deepEqual([E11_E5_PREPARATION_ENABLED, uiFlag("E11_E5_PREPARATION_ENABLED"),
    E5_ENABLED, E5_CONTADOR_A_ENABLED, E12_SUPPLIER_CASH_ENABLED], Array(5).fill(false));
  assert.deepEqual([E7_ENABLED, E7_CLIENT_FINANCIAL_READS_ENABLED, E7_ATTRIBUTION_ENABLED], [true, true, true]);
  assert.equal(E9_ENABLED, true);
  assert.equal(E4_CASH_OUT_ENABLED, true);
});
test("Tanda D: default CONTADOR is F with fiscal read and documentary reconciliation only", async () => {
  const f = fixture("CONTADOR");
  const actor = await e11Identity(f.tx, 7);
  assert.equal(actor.perfil, "F");
  assert.deepEqual(actor.capacidades, ["FISCAL_LEER", "FISCAL_CONCILIAR"]);
  assert.ok(f.queries.every(query => !/\b(INSERT|UPDATE|DELETE)\b/.test(query)));
  assert.throws(() => e11Capability(actor, "FINANZAS_LIMITADAS_LEER"));
  assert.throws(() => e11Capability(actor, "E5_PREPARAR"));
});
test("Tanda D: existing explicit A reads sanitized finance but cannot prepare E5", async () => {
  const actor = await e11Identity(fixture("CONTADOR", "A").tx, 7);
  assert.deepEqual(actor.capacidades, ["FINANZAS_LIMITADAS_LEER"]);
  assert.throws(() => e11Capability(actor, "FISCAL_CONCILIAR"));
  assert.throws(() => e11Capability(actor, "E5_PREPARAR"));
});
test("ADMIN receives profile assignment without receiving E5 preparation", async () => {
  const actor = await e11Identity(fixture("ADMIN").tx, 7);
  assert.deepEqual(actor.capacidades, ["FISCAL_LEER", "FINANZAS_LIMITADAS_LEER", "PERFILES_ADMINISTRAR"]);
  assert.ok(!actor.capacidades.includes("E5_PREPARAR"));
});
test("Tanda D: other roles receive no E11 capabilities", async () => {
  for (const role of ["SISTEMAS", "SUPERVISOR", "CAJA", "TERMINAL"]) {
    assert.deepEqual((await e11Identity(fixture(role).tx, 7)).capacidades, []);
  }
});
test("Tanda D: fiscal query contract stays read-only and invoice-filtered", async () => {
  const f = fixture("CONTADOR");
  await e11FiscalClients(f.tx);
  await e11FiscalSales(f.tx, "2026-09-01", "2026-09-24");
  assert.ok(f.queries.length >= 2);
  assert.ok(f.queries.every(query => /^\s*SELECT\b/.test(query)));
  assert.ok(f.queries.every(query => /factur/i.test(query)));
  assert.ok(f.queries.every(query => !/\b(fondo_movimientos|e5_recepciones)\b/.test(query)));
});
test("Tanda D: documentary period policy keeps daily optional and week/month mandatory", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  assert.equal(e11Period("DIA", "2026-09-01", now).obligatorio, false);
  assert.equal(e11Period("SEMANA", "2026-09-07", now).obligatorio, true);
  assert.equal(e11Period("MES", "2026-09-01", now).obligatorio, true);
});
test("Tanda D: legacy finance and payment surfaces remain denied to CONTADOR", () => {
  assert.equal(e11LegacyAllowed(E11_ENABLED, "CONTADOR", "/proveedores"), false);
  assert.equal(e11LegacyAllowed(E11_ENABLED, "CONTADOR", "/fondo"), false);
});
test("Tanda D: explicit OFF runtime still performs no security or role-change SQL", async () => {
  const f = fixture("ADMIN");
  await createE11Runtime({ flags: { enabled: false, profiles: false, reconciliation: false,
    preparation: false, e5Enabled: false, e5ContadorA: false } }).run(async () => {
    assert.ok(Object.values(e11Runtime().flags).every(flag => flag === false));
    await e11SecurityLock(f.tx);
    await e11UserRoleChange(f.tx, 7, "CONTADOR", true, 1);
  });
  assert.equal(f.queries.length, 0);
});