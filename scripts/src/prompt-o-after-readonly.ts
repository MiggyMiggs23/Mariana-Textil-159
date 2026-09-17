/**
 * Prompt O AFTER gate.
 *
 * This is intentionally not the BEFORE reproducer: it does not extract or
 * reimplement the old dateOnly/parseDate functions.  Run only after the
 * boundary/schema worker has landed and the owning agent explicitly requests
 * the AFTER verification.
 *
 * It reads the same real note in one REPEATABLE READ READ ONLY transaction,
 * requires the generated target response field to remain a calendar string,
 * and compares it with the unchanged production print projection/formatter.
 */
import assert from "node:assert/strict";
import { drizzle } from "../../artifacts/api-server/node_modules/drizzle-orm/node-postgres/index.js";
import * as schema from "../../lib/db/src/schema/index.ts";
import { pool } from "../../lib/db/src/index.ts";
import {
  GetClienteNotaCreditoResponse,
} from "../../lib/api-zod/src/generated/api.ts";
import {
  buildTicketDetail,
  projectTicketPrintDocument,
} from "../../artifacts/api-server/src/lib/pos.ts";
import { formatDateOnlyMx } from "../../artifacts/mariana-textil/src/lib/date-only.ts";

const TARGET_TICKET_ID = 106;
const EXPECTED_CALENDAR_DAY = "2026-10-16";

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(?:postgres(?:ql)?):\/\/\S+/gi, "[connection-redacted]")
    .replace(
      /\b(?:password|secret|token|authorization)\s*=\s*\S+/gi,
      "$1=[redacted]",
    );
}

function mexicoToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const client = await pool.connect();
let transactionOpen = false;
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  transactionOpen = true;
  const identity = (
    await client.query(
      `SELECT current_database() AS database_name,
              current_schema() AS schema_name,
              current_setting('transaction_read_only') AS transaction_read_only,
              current_setting('transaction_isolation') AS transaction_isolation`,
    )
  ).rows[0];
  assert.equal(identity?.transaction_read_only, "on");
  assert.equal(identity?.transaction_isolation, "repeatable read");

  const row = (
    await client.query<{
      ticket_id: number;
      folio: number;
      ticket_due: string;
      movement_due: string;
    }>(
      `SELECT t.id::int AS ticket_id,
              t.folio::int AS folio,
              t.fecha_vencimiento::text AS ticket_due,
              m.fecha_vencimiento::text AS movement_due
         FROM tickets t
         JOIN movimientos_credito m
           ON m.ticket_id = t.id
          AND m.tipo = 'VENTA_CREDITO'
          AND m.fecha_vencimiento IS NOT NULL
          AND m.fecha_vencimiento::text = t.fecha_vencimiento::text
        WHERE t.id = $1
          AND t.fecha_vencimiento IS NOT NULL
        LIMIT 1`,
      [TARGET_TICKET_ID],
    )
  ).rows[0];
  assert.ok(row, "AFTER target ticket was not found.");
  assert.equal(row.ticket_due, row.movement_due);
  assert.equal(row.ticket_due, EXPECTED_CALENDAR_DAY);

  const targetField = GetClienteNotaCreditoResponse.shape.fechaVencimiento;
  const targetValue = targetField.parse(row.ticket_due);
  assert.equal(
    typeof targetValue,
    "string",
    "AFTER target schema still coerces a calendar day to Date.",
  );
  assert.equal(targetValue, row.ticket_due);
  assert.equal(JSON.stringify({ fechaVencimiento: targetValue }), JSON.stringify({
    fechaVencimiento: EXPECTED_CALENDAR_DAY,
  }));

  const today = mexicoToday();
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const lastDay = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(
    new Date(Date.UTC(todayYear!, todayMonth!, 0)).getUTCDate(),
  ).padStart(2, "0")}`;
  const boundaryInputs = {
    dayOne: `${today.slice(0, 8)}01`,
    lastDay,
    today,
  };
  const boundaryOutputs = Object.fromEntries(
    Object.entries(boundaryInputs).map(([label, value]) => {
      const parsed = targetField.parse(value);
      assert.equal(parsed, value, `Boundary ${label} was not preserved as a string.`);
      const formatted = formatDateOnlyMx(parsed);
      assert.match(formatted, /^\d{2}\/\d{2}\/\d{4}$/);
      return [label, { input: value, parsed, formatted }];
    }),
  );

  const database = drizzle(client, { schema });
  const ticket = await buildTicketDetail(database, TARGET_TICKET_ID, false);
  assert.ok(ticket, "AFTER target ticket detail was not built.");
  const printed = projectTicketPrintDocument(ticket, "CLIENTE");
  assert.ok(printed, "AFTER print projection was not built.");
  assert.equal(printed.fechaVencimiento, row.ticket_due);
  const screenValue = formatDateOnlyMx(targetValue);
  const printValue = formatDateOnlyMx(printed.fechaVencimiento as string);
  assert.equal(screenValue, printValue);

  console.log(
    JSON.stringify(
      {
        status: "PASS_AFTER_READONLY",
        transaction: {
          database: identity.database_name,
          schema: identity.schema_name,
          readOnly: identity.transaction_read_only,
          isolation: identity.transaction_isolation,
        },
        ticketId: row.ticket_id,
        folio: row.folio,
        databaseCalendarDay: row.ticket_due,
        targetSerializedField: targetValue,
        printSerializedField: printed.fechaVencimiento,
        screenFormatted: screenValue,
        printFormatted: printValue,
        equal: screenValue === printValue,
        boundaries: boundaryOutputs,
        piiPrinted: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ status: "NOT_READY_OR_FAIL", error: safeError(error) }, null, 2));
  process.exitCode = 1;
} finally {
  if (transactionOpen) {
    try {
      await client.query("ROLLBACK");
    } catch (error) {
      console.error(JSON.stringify({ rollbackError: safeError(error) }));
    }
  }
  client.release();
  await pool.end();
}