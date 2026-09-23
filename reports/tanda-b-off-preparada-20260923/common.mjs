import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
export const report = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(report, "../..");
export const revision = "1031a630fd461c3df89767bad7a14cc777e56261";
export const distName = "dist-tanda-b-off-20260923";
export const digest = value => createHash("sha256").update(value).digest("hex");
export const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object" ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}` : JSON.stringify(value);
export const json = file => JSON.parse(fs.readFileSync(file, "utf8"));
export const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
export function requireMain() {
  if (process.env.TANDA_B_MAIN_ONLY !== "AUTHORIZED") throw new Error("MAIN explicit authorization required.");
}
export function run(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: "utf8", timeout: 120000, maxBuffer: 128 * 1024 * 1024, ...options });
  if (r.status !== 0) throw new Error(`${path.basename(command)} failed (exit ${r.status}); connection details withheld.`);
  return r;
}
export function pgEnvironment(urlString, pgBin) {
  const u = new URL(urlString);
  if (!["postgres:", "postgresql:"].includes(u.protocol)) throw new Error("PostgreSQL URL required");
  return { PATH: pgBin, HOME: "/tmp", LANG: "C.UTF-8",
    PGHOST: u.searchParams.get("host") || u.hostname, PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)), PGSSLMODE: u.searchParams.get("sslmode") || "prefer",
    PGCONNECT_TIMEOUT: "5", PGAPPNAME: "tanda-b-off-readonly",
    PGOPTIONS: "-c default_transaction_read_only=on" };
}
export function pgTools() {
  const bin = process.env.TANDA_B_PG_BIN;
  if (!bin || !path.isAbsolute(bin)) throw new Error("Explicit absolute TANDA_B_PG_BIN required.");
  for (const tool of ["psql", "pg_dump", "initdb", "pg_ctl", "createdb"]) {
    if (!fs.existsSync(path.join(bin, tool))) throw new Error(`Missing PostgreSQL tool: ${tool}`);
  }
  if (!/PostgreSQL\) 16\./.test(run(path.join(bin, "psql"), ["--version"]).stdout)) throw new Error("PostgreSQL16 required");
  return bin;
}
export function catalog(env, bin) {
  const result = run(path.join(bin, "psql"), ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"], {
    env, input: fs.readFileSync(path.join(report, "release-catalog.sql"), "utf8"),
  });
  const value = JSON.parse(result.stdout.trim());
  if (value.readOnly !== "on" || Number(value.enabledEventTriggers) !== 0) throw new Error("READONLY/event-trigger assertion failed");
  return value;
}
export function fingerprints(c) {
  return { schemaSha256: digest(canonical(c.schemaRows)), attributesSha256: digest(canonical(c.attributes)) };
}
export function verifyOutputs() {
  const manifest = json(path.join(report, "manifest.json"));
  for (const [file, hash] of Object.entries(manifest.outputs)) {
    if (digest(fs.readFileSync(path.join(root, file))) !== hash) throw new Error(`Output integrity mismatch: ${file}`);
  }
  return manifest;
}
export const closedEnv = {
  E3_ENABLED: "false", E3_DIRECTED_ENABLED: "false", E3_ORDINARY_CASH_ENABLED: "false",
  E4_CASH_OUT_ENABLED: "false", E5_ENABLED: "false", E5_CONTADOR_A_ENABLED: "false",
  E7_ENABLED: "false", E7_UI_ENABLED: "false", E9_ENABLED: "false",
  E11_ENABLED: "false", E11_UI_ENABLED: "false", E11_PROFILE_ASSIGNMENT_ENABLED: "false",
  E11_RECONCILIATION_ENABLED: "false", E11_E5_PREPARATION_ENABLED: "false", E12_ENABLED: "false", E12_SUPPLIER_CASH_ENABLED: "false",
  FONDO_E10_ENABLED: "false", CREDIT_REFUNDS_ENABLED: "false", CREDIT_CASH_INCOME_ENABLED: "false",
  CREDIT_ABONO_EVIDENCE_ENABLED: "false", CREDIT_PENDING_RECEIPTS_ENABLED: "false",
  CREDIT_HISTORICAL_ATTRIBUTION_ENABLED: "false", REMATE_RELEASED: "false", REMATE_UI_RELEASED: "false",
};