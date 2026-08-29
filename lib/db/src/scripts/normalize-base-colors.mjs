/**
 * Operator-only, idempotent catalog normalization for the three reviewed
 * "Base" variants. Dry-run is the default. This is deliberately not wired to
 * migrations or startup.
 *
 * Preview:
 *   node ./src/scripts/normalize-base-colors.mjs --dry-run
 * Apply:
 *   NORMALIZE_BASE_COLORS_CONFIRM=NORMALIZE_REVIEWED_BASE_VARIANTS \
 *   node ./src/scripts/normalize-base-colors.mjs --apply
 */
import pg from "pg";

const { Pool } = pg;
const exactMappings = new Map([
  ["Manta Libano", "Crudo"],
  ["Manta Libanito", "Crudo"],
]);
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if (apply && args.has("--dry-run")) throw new Error("Use sólo --apply o --dry-run.");
if (apply && process.env.NORMALIZE_BASE_COLORS_CONFIRM !== "NORMALIZE_REVIEWED_BASE_VARIANTS") {
  throw new Error("Falta la confirmación explícita para aplicar.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatoria.");

function clean(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function titleCase(value) {
  const shortWords = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "con", "por", "para"]);
  return value.trim().replace(/\s+/g, " ").split(" ").map((word, index) => {
    const lower = word.toLocaleLowerCase("es-MX");
    if (index > 0 && shortWords.has(lower)) return lower;
    if (lower === "mm") return "Mm";
    const camel = /[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]/.test(word.slice(1));
    return word.charAt(0).toLocaleUpperCase("es-MX") + (camel ? word.slice(1) : lower.slice(1));
  }).join(" ");
}
function baseSku(tela, color) {
  const telaPart = tela.trim().split(/\s+/).slice(0, 3).map((word) => {
    const token = clean(word);
    return /^\d+$/.test(token) ? token : token.slice(0, 3);
  }).join("").slice(0, 12);
  return `${telaPart}-${clean(color.trim().split(/\s+/)[0] ?? "").slice(0, 3)}`;
}

function reviewedBaseColor(tela) {
  const exact = exactMappings.get(tela);
  if (exact) return exact;
  return clean(tela).startsWith("PELLON") ? "Blanco" : null;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const identity = await client.query(
    "SELECT current_database() AS database_name, current_schema() AS schema_name",
  );
  console.log("Identidad confirmada:", identity.rows[0]);
  await client.query("SELECT pg_advisory_xact_lock($1)", [0x50524f44]);
  // All rows are locked because this script title-cases the whole catalog,
  // not only the three reviewed Base mappings.
  const { rows } = await client.query(
    "SELECT id, tela, color, sku FROM productos ORDER BY tela, color, id FOR UPDATE",
  );
  const unauthorized = rows.filter((row) => {
    const tela = titleCase(row.tela);
    const color = titleCase(row.color);
    return color === "Base" && reviewedBaseColor(tela) == null;
  });
  console.log("Casos no autorizados (sólo se reportan):", unauthorized);

  const desired = rows.map((row) => {
    const tela = titleCase(row.tela);
    const baseColor = titleCase(row.color);
    const mappedColor = reviewedBaseColor(tela);
    const color = mappedColor != null && baseColor === "Base"
      ? mappedColor
      : baseColor;
    return {
      ...row,
      telaDespues: tela,
      colorDespues: color,
      skuDespues: row.sku,
      recalcularSku: color !== baseColor,
    };
  });
  // Allocate reviewed SKU changes deterministically and collision-safely.
  const allocatedSkus = new Set(
    desired.filter((row) => !row.recalcularSku).map((row) => row.sku),
  );
  for (const row of desired.filter((candidate) => candidate.recalcularSku)) {
    const base = baseSku(row.telaDespues, row.colorDespues);
    let sku = base;
    let suffix = 2;
    while (allocatedSkus.has(sku)) sku = `${base}${suffix++}`;
    row.skuDespues = sku;
    allocatedSkus.add(sku);
  }
  const collisions = { variantes: [], skus: [] };
  for (const [kind, key] of [
    ["variantes", (row) => `${row.telaDespues}\u0000${row.colorDespues}`],
    ["skus", (row) => row.skuDespues],
  ]) {
    const grouped = new Map();
    for (const row of desired) {
      const value = key(row);
      grouped.set(value, [...(grouped.get(value) ?? []), row.id]);
    }
    for (const [value, ids] of grouped) {
      if (ids.length > 1) collisions[kind].push({ value, ids });
    }
  }
  const snapshots = desired
    .filter((row) => row.tela !== row.telaDespues || row.color !== row.colorDespues || row.sku !== row.skuDespues)
    .map((row) => ({
      id: row.id, telaAntes: row.tela, telaDespues: row.telaDespues,
      colorAntes: row.color, colorDespues: row.colorDespues,
      skuAntes: row.sku, skuDespues: row.skuDespues,
    }));
  const reviewedIds = desired
    .filter((row) => row.recalcularSku)
    .map((row) => row.id);
  const labelEvidence = reviewedIds.length === 0
    ? []
    : (await client.query(
        `SELECT p.id AS producto_id, p.tela, p.sku AS sku_actual,
                COUNT(DISTINCT r.id)::int AS rollos,
                COUNT(DISTINCT re.id)::int AS reimpresiones,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT re.sku_snapshot), NULL) AS sku_impresos
           FROM productos p
           LEFT JOIN rollos r ON r.producto_id = p.id
           LEFT JOIN reimpresiones_etiqueta re ON re.rollo_id = r.id
          WHERE p.id = ANY($1::int[])
          GROUP BY p.id, p.tela, p.sku
          ORDER BY p.id`,
        [reviewedIds],
      )).rows;
  console.log("Snapshots SKU autorizados:", snapshots);
  console.log("Rollos y etiquetas con SKU anterior:", labelEvidence);
  console.log("Colisiones previstas:", collisions);
  if (collisions.variantes.length || collisions.skus.length) {
    throw new Error("Se detectaron colisiones tela/color o SKU; rollback completo antes de mutar.");
  }

  if (apply) {
    for (const snapshot of snapshots) {
      await client.query(
        "UPDATE productos SET tela = $1, color = $2, sku = $3, updated_at = now() WHERE id = $4",
        [snapshot.telaDespues, snapshot.colorDespues, snapshot.skuDespues, snapshot.id],
      );
    }
    await client.query("COMMIT");
    console.log(`Aplicados ${snapshots.length} cambios autorizados.`);
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