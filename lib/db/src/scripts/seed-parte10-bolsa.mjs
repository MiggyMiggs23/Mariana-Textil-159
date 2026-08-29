/**
 * Idempotent, operator-only seed for the four reviewed BOLSA products.
 *
 * Preview:
 *   node ./src/scripts/seed-parte10-bolsa.mjs --dry-run
 * Apply:
 *   SEED_PARTE10_BOLSA_CONFIRM=CREATE_REVIEWED_BAG_PRODUCTS \
 *   node ./src/scripts/seed-parte10-bolsa.mjs --apply
 */
import pg from "pg";

const { Pool } = pg;
const reviewed = [
  { tela: "Cascabel 15 Mm", color: "Oro", baseSku: "CAS15MM-ORO" },
  { tela: "Cascabel 22 Mm", color: "Oro", baseSku: "CAS22MM-ORO" },
  { tela: "PomPon 25 Mm", color: "Blanco", baseSku: "POM25MM-BLA" },
  { tela: "PomPon 38 Mm", color: "Blanco", baseSku: "POM38MM-BLA" },
];
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if (apply && args.has("--dry-run")) throw new Error("Use sólo --apply o --dry-run.");
if (
  apply &&
  process.env.SEED_PARTE10_BOLSA_CONFIRM !== "CREATE_REVIEWED_BAG_PRODUCTS"
) {
  throw new Error("Falta la confirmación explícita para aplicar.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatoria.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const identity = await client.query(
    "SELECT current_database() AS database_name, current_schema() AS schema_name",
  );
  console.log("Identidad confirmada:", identity.rows[0]);
  await client.query("SELECT pg_advisory_xact_lock($1)", [0x50524f44]);

  const { rows: existing } = await client.query(
    "SELECT id, tela, color, sku, unidad, precio_sugerido FROM productos FOR UPDATE",
  );
  const byVariant = new Map(
    existing.map((row) => [`${row.tela}\u0000${row.color}`, row]),
  );
  const allocatedSkus = new Set(existing.map((row) => row.sku));
  const plan = [];

  for (const item of reviewed) {
    const current = byVariant.get(`${item.tela}\u0000${item.color}`);
    if (current) {
      if (current.unidad !== "BOLSA" || Number(current.precio_sugerido) !== 0) {
        throw new Error(
          `${item.tela} / ${item.color} ya existe con unidad o precio distinto.`,
        );
      }
      plan.push({ action: "EXISTENTE", ...current });
      continue;
    }
    let sku = item.baseSku;
    let suffix = 2;
    while (allocatedSkus.has(sku)) sku = `${item.baseSku}${suffix++}`;
    allocatedSkus.add(sku);
    plan.push({ action: "CREAR", ...item, sku });
  }

  console.log("Plan de productos BOLSA:", plan);
  if (apply) {
    for (const item of plan.filter((row) => row.action === "CREAR")) {
      await client.query(
        `INSERT INTO productos
          (sku, tela, color, unidad, precio_sugerido, activo, se_vende_por_metro)
         VALUES ($1, $2, $3, 'BOLSA', '0.00', true, false)`,
        [item.sku, item.tela, item.color],
      );
    }
    await client.query("COMMIT");
    console.log("Productos BOLSA confirmados.");
  } else {
    await client.query("ROLLBACK");
    console.log("DRY RUN: no se modificaron datos.");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}