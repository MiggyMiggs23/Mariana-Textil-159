import fs from "node:fs";
import crypto from "node:crypto";
import { baselineE1E2 } from "../../trabajo-nocturno-20260925/tarea-1/baseline-e1-e2.mjs";

export async function initializeAuxiliary(pool) {
  const identity = (await pool.query("SELECT current_database() AS database")).rows[0];
  if (identity.database !== "scanner_collab_e2e_20260926") throw Error("Auxiliary DB identity rejected");
  if ((await pool.query("SELECT to_regclass('public.e11_perfiles') AS relation")).rows[0].relation)
    throw Error("Auxiliary schema already present; refuse unreviewed repeated installation");
  const files = [
    "reports/e3-apertura-preparada-20260922/sql/01-install-prepared.sql",
    "reports/e3-apertura-preparada-20260922/sql/03-prepare-ordinary-cash-gate-retirement.REHEARSAL-ONLY.sql",
    ...[1, 2, 3, 4].map(n => `reports/tanda-b-b0-b1-20260923/r5/sql/${n}.sql`),
    "reports/trabajo-nocturno-20260925/tarea-2/historical-pre-e11-graph.sql",
    "reports/e11/01-preparado.sql",
    "reports/trabajo-nocturno-20260925/tarea-1/installed-graph-readonly.sql",
    "reports/tanda-e-20260923/tarea-2/01-corregir-e11-graph-alias.sql",
  ];
  const client = await pool.connect();
  const hashes = {};
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE movimientos_credito ADD COLUMN IF NOT EXISTS e2_insert_xid xid8; ALTER TABLE cobros_credito_pendientes_e1 ADD COLUMN IF NOT EXISTS e2_insert_xid xid8");
    const baseline = baselineE1E2();
    hashes["baselineE1E2()"] = crypto.createHash("sha256").update(baseline).digest("hex");
    await client.query(baseline);
    for (const file of files) {
      const original = fs.readFileSync(file, "utf8");
      hashes[file] = crypto.createHash("sha256").update(original).digest("hex");
      if (file.endsWith("/01-corregir-e11-graph-alias.sql")) {
        // Base SQL can already contain this released repair. Inspect the actual
        // transactional function, not merely the source file, before deciding.
        const definition = (await client.query(
          "SELECT pg_get_functiondef('public.e11_graph()'::regprocedure) AS definition"
        )).rows[0].definition;
        const fragments = Object.fromEntries(
          [...original.matchAll(/(first_original|first_corrected|second_original|second_corrected) constant text := \$fragment\$([\s\S]*?)\$fragment\$;/g)]
            .map(match => [match[1], match[2]])
        );
        if (Object.keys(fragments).length !== 4) throw Error("Alias repair fragment contract changed");
        const counts = Object.fromEntries(Object.entries(fragments).map(([name, text]) =>
          [name, definition.split(text).length - 1]));
        const legacy = counts.first_original === 1 && counts.second_original === 1 &&
          counts.first_corrected === 0 && counts.second_corrected === 0;
        const corrected = counts.first_original === 0 && counts.second_original === 0 &&
          counts.first_corrected === 1 && counts.second_corrected === 1;
        if (!legacy && !corrected) throw Error("Unrecognized E11 alias definition; installation aborted");
        const relaxed = (await client.query(
          `SELECT EXISTS(SELECT 1 FROM pg_proc, unnest(coalesce(proconfig,ARRAY[]::text[])) setting
            WHERE oid='public.e11_graph()'::regprocedure AND setting LIKE 'plpgsql.variable_conflict=%') AS relaxed`
        )).rows[0].relaxed;
        if (relaxed) throw Error("E11 variable_conflict relaxation rejected");
        hashes["e11AliasState"] = corrected ? "already-corrected-verified-no-DDL" : "legacy-repair-required";
        if (corrected) continue;
      }
      let sql = original.replace(/^\\set ON_ERROR_STOP on\r?$/gm, "")
        .replace(/^BEGIN;\r?$/gm, "").replace(/^COMMIT;\r?$/gm, "");
      if (file.endsWith("/01-install-prepared.sql")) {
        const start = sql.indexOf("CREATE FUNCTION public.e3_receipt_immutable()");
        if (start < 0) throw Error("E3 baseline boundary changed");
        sql = sql.slice(start);
      }
      await client.query("SET LOCAL search_path = public");
      await client.query(sql);
    }
    await client.query("COMMIT");
    return hashes;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}