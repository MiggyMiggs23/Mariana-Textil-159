import fs from "node:fs";
import { createHash } from "node:crypto";
import pg from "../../scripts/node_modules/pg/lib/index.js";

// Standalone read-only inspection. Never import app modules or initializers.
const pid = 180;
const command = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
if (!command.includes("artifacts/api-server/dist-tanda-e-20260923/index.mjs")) {
  throw new Error("Effective API identity changed; inspection refused");
}
const env = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(Boolean).map(s => {
  const i = s.indexOf("=");
  return [s.slice(0, i), s.slice(i + 1)];
}));
if (!env.DATABASE_URL || env.DATABASE_URL !== process.env.DATABASE_URL || env.TEST_DATABASE_URL || env.NODE_ENV === "test") {
  throw new Error("Effective API connection cannot be confirmed; inspection refused");
}
const hash = value => createHash("sha256").update(value).digest("hex");
const queries = {
  begin: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  identity: "SELECT current_database() AS db, current_setting('transaction_read_only') AS readonly, current_setting('server_version_num') AS version",
  counts: `SELECT count(*)::int AS total,
    count(*) FILTER (WHERE activo=true)::int AS active,
    count(*) FILTER (WHERE activo=false)::int AS disabled,
    count(*) FILTER (WHERE activo IS NULL)::int AS active_null,
    count(*) FILTER (WHERE activo=true AND se_vende_por_metro=true)::int AS active_partial_enabled,
    count(*) FILTER (WHERE activo=false AND se_vende_por_metro=true)::int AS disabled_partial_enabled,
    count(*) FILTER (WHERE se_vende_por_metro=true)::int AS all_partial_enabled,
    count(*) FILTER (WHERE activo=true AND unidad='METRO')::int AS active_unit_metro,
    count(*) FILTER (WHERE activo=true AND unidad='METRO' AND se_vende_por_metro=true)::int AS active_unit_metro_partial_enabled
    FROM public.productos`,
  groups: "SELECT activo, unidad, se_vende_por_metro, count(*)::int AS count FROM public.productos GROUP BY activo, unidad, se_vende_por_metro ORDER BY activo, unidad, se_vende_por_metro",
  ids: "SELECT id, unidad FROM public.productos WHERE activo=true AND se_vende_por_metro=true ORDER BY id",
  end: "ROLLBACK",
};
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  options: "-c default_transaction_read_only=on",
  connectionTimeoutMillis: 8000,
  statement_timeout: 15000,
});
try {
  await client.connect();
  await client.query(queries.begin);
  const identity = (await client.query(queries.identity)).rows[0];
  if (identity.readonly !== "on" || identity.db !== decodeURIComponent(new URL(env.DATABASE_URL).pathname.slice(1))) {
    throw new Error("Read-only database identity verification failed");
  }
  const counts = (await client.query(queries.counts)).rows[0];
  const groups = (await client.query(queries.groups)).rows;
  const ids = (await client.query(queries.ids)).rows;
  await client.query(queries.end);
  const priorPath = "reports/tanda-f/tarea-2/final-audit.json";
  const prior = JSON.parse(fs.readFileSync(priorPath, "utf8"));
  const source = JSON.parse(fs.readFileSync("reports/tanda-f/setup/source-identity.json", "utf8"));
  const report = {
    checkedAt: new Date().toISOString(),
    readOnly: true,
    applicationWrites: false,
    copiesCreated: false,
    identity: {
      apiPid: pid,
      apiEntrypoint: command[1],
      connectionSource: "verified running API /proc/180/environ DATABASE_URL; matches shell internally",
      currentDatabaseSha256: hash(identity.db),
      matchesConnectionDatabase: true,
      matchesTandaFSourceDatabase: identity.db === source.identity.split("|")[0],
      transactionReadOnly: identity.readonly,
      serverVersion: identity.version,
    },
    queries,
    counts,
    groups,
    comparison: {
      evidence: priorPath,
      evidenceSha256: hash(fs.readFileSync(priorPath)),
      queryEvidence: "reports/tanda-f/tarea-2/final-audit.mjs",
      snapshotAt: prior.at,
      scope: "Tanda F isolated browser copy, not a fresh application query",
      priorActivePartialEnabled: Number(prior.partialEnabledCount[0].count),
      currentActivePartialEnabled: counts.active_partial_enabled,
      sameCount: Number(prior.partialEnabledCount[0].count) === counts.active_partial_enabled,
      sourceEvidence: "reports/tanda-f/setup/source-identity.json",
      sourceDumpSha256: source.sha256,
    },
    notes: [
      "unidad=METRO is distinct from se_vende_por_metro=true; only activo=true AND se_vende_por_metro=true answers partial-sale catalog eligibility.",
      "Disabled products are counted separately and do not satisfy active eligibility.",
      "Tanda F evidence proves the copied catalog count at its recorded time, not historical or current live application availability.",
      "No app sessions, initializers, workflow actions, mutations, dumps or copies were performed.",
      "Eligibility does not independently establish available stock, permissions or all sale prerequisites.",
    ],
    privateEligibleProductIds: ids,
  };
  fs.writeFileSync("reports/tanda-g/catalogo-solo-lectura.json", JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync("reports/tanda-g/catalogo-solo-lectura.json", 0o600);
  fs.writeFileSync("reports/tanda-g/catalogo-solo-lectura-notas.txt",
    `Solo lectura; identidad del API verificada; ninguna copia ni escritura en la aplicación.\nActual: ${counts.active_partial_enabled} activos con se_vende_por_metro=true; ${counts.active_unit_metro} activos con unidad=METRO; ${counts.disabled_partial_enabled} desactivados habilitados para metraje.\nTanda F: ${prior.partialEnabledCount[0].count} activos habilitados en su copia aislada (${prior.at}), evidencia final-audit.json y consulta final-audit.mjs.\nMETRO no equivale al indicador de venta parcial. Conteos agrupados y SQL exacto en catalogo-solo-lectura.json; IDs elegibles únicamente en ese informe privado.\n`,
    { mode: 0o600 });
  console.log(JSON.stringify({ counts, priorActivePartialEnabled: Number(prior.partialEnabledCount[0].count), report: "reports/tanda-g/catalogo-solo-lectura.json" }));
} catch (error) {
  // Do not print driver messages, which can contain connection details.
  console.error("Read-only inspection failed; no credentials or driver details displayed.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}