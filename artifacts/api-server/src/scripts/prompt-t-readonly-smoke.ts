import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { buildAuditoriaDetail } from "../lib/auditoria-inventario";
import { getReactivacionContexto } from "../lib/reactivacion-faltante-evidencia";

// This only exercises reads through the application's configured connection.
// PostgreSQL rejects writes even if a called helper unexpectedly attempts one.
try {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    const audits = await tx.execute(sql`
      SELECT id FROM auditorias_inventario ORDER BY id DESC LIMIT 3
    `);
    let auditResults = 0;
    for (const audit of audits.rows) {
      const detail = await buildAuditoriaDetail(tx, Number(audit.id));
      auditResults += detail.resultados.length;
    }
    const rolls = await tx.execute(sql`
      SELECT id FROM rollos ORDER BY (estado = ${"BAJA"}) DESC, id DESC LIMIT 3
    `);
    let contexts = 0;
    for (const roll of rolls.rows) {
      await getReactivacionContexto(tx, Number(roll.id));
      contexts++;
    }
    return {
      readOnly: true,
      audits: audits.rows.length,
      auditResults,
      reactivationContexts: contexts,
    };
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  // Do not log connection configuration or record contents.
  process.stderr.write(`${error instanceof Error ? error.message : "Read failed"}\n`);
  process.exitCode = 1;
} finally {
  await pool.end();
}