/**
 * Read-only PostgreSQL regression for supplier utility attribution.
 *
 * This is deliberately not a `.test` module: importing @workspace/db from a
 * test process disables application database access. The script uses only
 * statement-scoped VALUES CTEs shadowing the report's table names, starts a
 * READ ONLY transaction, and never creates schema or persists fixture rows.
 *
 * Run explicitly with a permitted DATABASE_URL:
 *   pnpm --filter @workspace/api-server run verify:supplier-utility-readonly
 */
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";

const fixtureCtes = `
  tickets (id, folio, estado, documento_tipo, cobrado, cobrado_at,
           autorizacion_estado, autorizado_at, ubicacion_id) AS (
    VALUES
      (1, 1001, 'VENDIDO', 'TICKET', true,  '2026-09-10T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (2, 1002, 'VENDIDO', 'TICKET', true,  '2026-09-11T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (3, 1003, 'VENDIDO', 'TICKET', true,  '2026-09-12T10:00:00Z'::timestamptz, NULL, NULL, 20),
      (4, 1004, 'VENDIDO', 'TICKET', true,  '2026-09-13T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (5, 1005, 'VENDIDO', 'TICKET', false, '2026-09-14T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (6, 1006, 'VENDIDO', 'NOTA', NULL, NULL, 'AUTORIZADA', '2026-09-15T10:00:00Z'::timestamptz, 10),
      (7, 1007, 'VENDIDO', 'TICKET', true,  '2026-10-01T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (8, 1008, 'VENDIDO', 'TICKET', true,  '2026-09-16T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (9, 1009, 'VENDIDO', 'TICKET', true,  '2026-09-17T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (10, 1010, 'VENDIDO', 'TICKET', true, '2026-09-18T10:00:00Z'::timestamptz, NULL, NULL, 10),
      (11, 1011, 'VENDIDO', 'TICKET', true, '2026-09-19T10:00:00Z'::timestamptz, NULL, NULL, 10)
  ),
  ticket_lineas (
    id, ticket_id, producto_id, tipo, cantidad, precio_unitario, importe,
    rollo_id, costo_unitario_congelado, costo_total_congelado
  ) AS (
    VALUES
      (101, 1, 501, 'METREADO', 1.000::numeric, 10.01::numeric, 10.01::numeric, NULL, NULL, NULL),
      (201, 2, 501, 'METREADO', 0.500::numeric, 10.00::numeric, 5.00::numeric, NULL, NULL, NULL),
      (202, 2, 501, 'METREADO', 0.500::numeric, 10.02::numeric, 5.01::numeric, NULL, NULL, NULL),
      (301, 3, 501, 'METREADO', 1.000::numeric, 6.00::numeric, 6.00::numeric, NULL, NULL, NULL),
      (401, 4, 501, 'METREADO', 1.000::numeric, 7.00::numeric, 7.00::numeric, NULL, NULL, NULL),
      (501, 5, 501, 'METREADO', 1.000::numeric, 8.00::numeric, 8.00::numeric, NULL, NULL, NULL),
      (601, 6, 501, 'METREADO', 1.000::numeric, 20.00::numeric, 20.00::numeric, NULL, NULL, NULL),
      (701, 7, 501, 'METREADO', 1.000::numeric, 9.00::numeric, 9.00::numeric, NULL, NULL, NULL),
      (801, 8, 501, 'NORMAL', 1.000::numeric, 15.00::numeric, 15.00::numeric, 17, 4.00::numeric, 4.00::numeric),
      -- Known physical roll with purged NULL frozen cost.
      (901, 9, 501, 'NORMAL', 1.000::numeric, 11.00::numeric, 11.00::numeric, 17, NULL, NULL),
      -- Same known roll, explicitly zero frozen cost; remains unavailable.
      (1001, 10, 501, 'NORMAL', 1.000::numeric, 12.00::numeric, 12.00::numeric, 17, 0.00::numeric, 0.00::numeric),
      -- Accounted ticket but its matching legacy VENTA was cancelled.
      (1101, 11, 501, 'NORMAL', 1.000::numeric, 13.00::numeric, 13.00::numeric, 18, 6.00::numeric, 6.00::numeric)
  ),
  ticket_linea_consumos (
    id, ticket_id, ticket_linea_id, rollo_id, entrada_id, proveedor_id,
    cantidad_milesimas, ingreso_centavos, costo_centavos, tipo, reversa_de_id
  ) AS (
    VALUES
      -- One line split across two suppliers: 1001 cents become 501 + 500.
      (1001, 1, 101, 11, 101, 1, 500::bigint, 501::bigint, 250::bigint, 'CONSUMO', NULL::bigint),
      (1002, 1, 101, 12, 102, 2, 500::bigint, 500::bigint, 150::bigint, 'CONSUMO', NULL::bigint),
      -- Partial cancellation of the first physical allocation: 250/251/125.
      (1003, 1, 101, 11, 101, 1, 250::bigint, 251::bigint, 125::bigint, 'REVERSA', 1001::bigint),
      -- Same missing-cost physical roll appears on two rows; count it once.
      (2001, 2, 201, 13, 103, 1, 500::bigint, 500::bigint, NULL::bigint, 'CONSUMO', NULL::bigint),
      (2002, 2, 202, 13, 103, 1, 500::bigint, 501::bigint, NULL::bigint, 'CONSUMO', NULL::bigint),
      -- Different site; must not enter a site-10 report.
      (3001, 3, 301, 14, 104, 1, 1000::bigint, 600::bigint, 100::bigint, 'CONSUMO', NULL::bigint),
      -- Unpaid ticket has physical evidence but is not canonical.
      (5001, 5, 501, 14, 104, 1, 1000::bigint, 800::bigint, 100::bigint, 'CONSUMO', NULL::bigint),
      -- Authorized NOTA is canonical and uses provider 1.
      (6001, 6, 601, 15, 105, 1, 1000::bigint, 2000::bigint, 1000::bigint, 'CONSUMO', NULL::bigint),
      -- Outside the requested date range.
      (7001, 7, 701, 16, 106, 1, 1000::bigint, 900::bigint, 100::bigint, 'CONSUMO', NULL::bigint)
  ),
  rollos (id, recepcion_id, serie) AS (
    VALUES
      (11, 101, 'R11'),
      (12, 102, 'R12'),
      (13, 103, 'R13'),
      (14, 104, 'R14'),
      (15, 105, 'R15'),
      (16, 106, 'R16'),
      (17, 107, 'R17'),
      (18, 108, 'R18')
  ),
  entradas (id, folio, proveedor_id) AS (
    VALUES
      (101, 9001, 1),
      (102, 9002, 2),
      (103, 9003, 1),
      (104, 9004, 1),
      (105, 9005, 1),
      (106, 9006, 1),
      (107, 9007, 1),
      (108, 9008, 1)
  ),
  movimientos (
    id, rollo_id, producto_id, ubicacion_id, tipo, cantidad, documento_id,
    documento_tipo, movimiento_origen_id
  ) AS (
    VALUES
      (8001, 17, 501, 10, 'VENTA', -1.000::numeric, '8', 'TICKET', NULL::bigint),
      (9001, 17, 501, 10, 'VENTA', -1.000::numeric, '9', 'TICKET', NULL::bigint),
      (10001, 17, 501, 10, 'VENTA', -1.000::numeric, '10', 'TICKET', NULL::bigint),
      (11001, 18, 501, 10, 'VENTA', -1.000::numeric, '11', 'TICKET', NULL::bigint),
      (11002, 18, 501, 10, 'CANCELACION', 1.000::numeric, '11', 'TICKET', 11001::bigint)
  ),
  proveedores (id, nombre) AS (
    VALUES (1, 'Proveedor uno'), (2, 'Proveedor dos')
  ),
  productos (id, sku, tela, color, unidad) AS (
    VALUES (501, 'TELA-501', 'Tela fixture', 'Color fixture', 'METRO')
  ),
`;

const dialect = new PgDialect();

type ReportOptions = {
  proveedorId: number;
  ubicacionId?: number | null;
  desde: Date;
  hasta: Date;
};

function renderWithFixtures(
  cte: ReturnType<typeof import("../lib/compras-proveedor").supplierUtilityCte>,
): { text: string; params: unknown[] } {
  const rendered = dialect.sqlToQuery(cte);
  assert.match(rendered.sql, /^\s*WITH\s+/);
  return {
    text: rendered.sql.replace(/^\s*WITH\s+/, `WITH ${fixtureCtes}`),
    params: rendered.params,
  };
}

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    linea_id: Number(row.linea_id),
    rollo_id: Number(row.rollo_id),
    proveedor_id: Number(row.proveedor_id),
    cantidad: Number(row.cantidad).toFixed(3),
    ventas: Number(row.ventas).toFixed(2),
    costo: row.costo == null ? null : Number(row.costo).toFixed(2),
  }));
}

function normalizeSummary(row: Record<string, unknown>) {
  return {
    ventas: Number(row.ventas).toFixed(2),
    costo: Number(row.costo).toFixed(2),
    lineas_incluidas: String(row.lineas_incluidas),
    lineas_excluidas_sin_costo: String(row.lineas_excluidas_sin_costo),
    rollos_excluidos_sin_costo: String(row.rollos_excluidos_sin_costo),
    total: String(row.total),
    lineas_excluidas_sin_rollo: String(row.lineas_excluidas_sin_rollo),
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the read-only verification.");
  }

  // Dynamic imports ensure DATABASE_URL is checked before @workspace/db opens
  // its bounded pool, while keeping this file outside test-process safeguards.
  const [{ supplierUtilityCte }, { pool }] = await Promise.all([
    import("../lib/compras-proveedor"),
    import("@workspace/db"),
  ]);
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionStarted = true;

    const options = {
      desde: new Date("2026-09-01T00:00:00.000Z"),
      hasta: new Date("2026-09-30T23:59:59.999Z"),
      ubicacionId: 10,
    };
    const sourceSql = (proveedorId: number) => {
      const rendered = renderWithFixtures(
        supplierUtilityCte({ ...options, proveedorId }),
      );
      return {
        text: `${rendered.text}
          SELECT linea_id, rollo_id, proveedor_id, cantidad::text,
                 ventas::text, costo::text
          FROM source
          ORDER BY linea_id, rollo_id`,
        params: rendered.params,
      };
    };
    const summarySql = (proveedorId: number) => {
      const rendered = renderWithFixtures(
        supplierUtilityCte({ ...options, proveedorId }),
      );
      return {
        text: `${rendered.text}
          , untraceable AS (
            SELECT COUNT(*) FILTER (
              WHERE NOT EXISTS (
                SELECT 1 FROM ticket_linea_consumos c
                WHERE c.ticket_linea_id = a.linea_id
                  AND c.tipo = 'CONSUMO'
              )
              AND NOT EXISTS (
                SELECT 1 FROM legacy_normal_evidence legacy
                WHERE legacy.linea_id = a.linea_id
              )
            )::text AS lineas_excluidas_sin_rollo
            FROM accounted_lines a
          ),
          summary AS (
            SELECT
              COALESCE(SUM(ventas) FILTER (WHERE costo IS NOT NULL), 0)::text AS ventas,
              COALESCE(SUM(costo) FILTER (WHERE costo IS NOT NULL), 0)::text AS costo,
              COUNT(DISTINCT linea_id) FILTER (WHERE costo IS NOT NULL)::text AS lineas_incluidas,
              COUNT(DISTINCT linea_id) FILTER (WHERE costo IS NULL)::text AS lineas_excluidas_sin_costo,
              COUNT(DISTINCT rollo_id) FILTER (WHERE costo IS NULL)::text AS rollos_excluidos_sin_costo,
              COUNT(*)::text AS total
            FROM source
            WHERE cantidad > 0
          )
          SELECT summary.*, untraceable.lineas_excluidas_sin_rollo
          FROM summary CROSS JOIN untraceable`,
        params: rendered.params,
      };
    };

    const providerOneSource = sourceSql(1);
    const providerTwoSource = sourceSql(2);
    const providerOneRows = (
      await client.query(providerOneSource.text, providerOneSource.params)
    ).rows;
    const providerTwoRows = (
      await client.query(providerTwoSource.text, providerTwoSource.params)
    ).rows;
    assert.deepEqual(
      normalizeRows(providerOneRows),
      [
        { linea_id: 101, rollo_id: 11, proveedor_id: 1, cantidad: "0.250", ventas: "2.50", costo: "1.25" },
        { linea_id: 201, rollo_id: 13, proveedor_id: 1, cantidad: "0.500", ventas: "5.00", costo: null },
        { linea_id: 202, rollo_id: 13, proveedor_id: 1, cantidad: "0.500", ventas: "5.01", costo: null },
        { linea_id: 601, rollo_id: 15, proveedor_id: 1, cantidad: "1.000", ventas: "20.00", costo: "10.00" },
        { linea_id: 801, rollo_id: 17, proveedor_id: 1, cantidad: "1.000", ventas: "15.00", costo: "4.00" },
        { linea_id: 901, rollo_id: 17, proveedor_id: 1, cantidad: "1.000", ventas: "11.00", costo: null },
        { linea_id: 1001, rollo_id: 17, proveedor_id: 1, cantidad: "1.000", ventas: "12.00", costo: null },
      ],
    );
    assert.deepEqual(
      normalizeRows(providerTwoRows),
      [
        { linea_id: 101, rollo_id: 12, proveedor_id: 2, cantidad: "0.500", ventas: "5.00", costo: "1.50" },
      ],
    );
    assert.equal(
      providerOneRows.some((row) => Number(row.linea_id) === 1101),
      false,
      "a legacy NORMAL sale with a cancellation movement is not fallback evidence",
    );

    const providerOneSummaryQuery = summarySql(1);
    const providerOneSummary = (
      await client.query(
        providerOneSummaryQuery.text,
        providerOneSummaryQuery.params,
      )
    ).rows[0];
    assert.deepEqual(normalizeSummary(providerOneSummary), {
      ventas: "37.50",
      costo: "15.25",
      lineas_incluidas: "3",
      lineas_excluidas_sin_costo: "4",
      rollos_excluidos_sin_costo: "2",
      total: "7",
      lineas_excluidas_sin_rollo: "2",
    });
    const providerTwoSummaryQuery = summarySql(2);
    const providerTwoSummary = (
      await client.query(
        providerTwoSummaryQuery.text,
        providerTwoSummaryQuery.params,
      )
    ).rows[0];
    assert.deepEqual(normalizeSummary(providerTwoSummary), {
      ventas: "5.00",
      costo: "1.50",
      lineas_incluidas: "1",
      lineas_excluidas_sin_costo: "0",
      rollos_excluidos_sin_costo: "0",
      total: "1",
      lineas_excluidas_sin_rollo: "2",
    });

    await client.query("ROLLBACK");
    transactionStarted = false;
    console.log("supplier utility read-only SQL regression: PASS");
  } finally {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

main().catch(async () => {
  // Do not print connection strings or driver errors that may echo them.
  console.error("supplier utility read-only SQL regression: FAIL");
  process.exitCode = 1;
});