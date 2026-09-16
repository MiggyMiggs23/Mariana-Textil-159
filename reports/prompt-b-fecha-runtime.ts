import assert from "node:assert/strict";
import pg from "../node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js";
import { date } from "../node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.20.0_pg@8.22.0/node_modules/drizzle-orm/pg-core/columns/date.js";
import { format } from "date-fns";
import { GetClienteNotaCreditoResponse } from "../lib/api-zod/src/generated/api";
import { deriveTicketCreditData } from "../artifacts/api-server/src/lib/clientes-aging";
import { formatDateOnlyMx } from "../artifacts/mariana-textil/src/lib/date-only";

const DATE_ONLY = "2026-10-02";
const DATE_OID = pg.types.builtins.DATE;

function section(title: string): void {
  console.log(`\n## ${title}`);
}

function runDecoderEvidence(): void {
  section("decoder real de PostgreSQL/Drizzle");
  const pgParser = pg.types.getTypeParser(DATE_OID, "text");
  const defaultPgValue = pgParser(DATE_ONLY);
  const drizzleDateParser = (typeId: number, formatName: string) =>
    typeId === DATE_OID
      ? (value: string) => value
      : pg.types.getTypeParser(typeId, formatName);
  const drizzleDriverValue = drizzleDateParser(DATE_OID, "text")(DATE_ONLY);
  const defaultColumn = date("fecha").build({});
  const dateModeColumn = date("fecha", { mode: "date" }).build({});

  assert.equal(DATE_OID, 1082);
  assert.equal(typeof defaultPgValue, "object");
  assert.equal(defaultPgValue instanceof Date, true);
  assert.equal(typeof drizzleDriverValue, "string");
  assert.equal(defaultColumn.columnType, "PgDateString");
  assert.equal(defaultColumn.mapFromDriverValue(drizzleDriverValue), DATE_ONLY);
  assert.equal(dateModeColumn.columnType, "PgDate");
  assert.equal(
    dateModeColumn.mapFromDriverValue(drizzleDriverValue).toISOString(),
    "2026-10-02T00:00:00.000Z",
  );

  console.log(
    JSON.stringify(
      {
        tz: process.env.TZ ?? "(unset)",
        wire: DATE_ONLY,
        dateOid: DATE_OID,
        defaultPgParser: {
          type: typeof defaultPgValue,
          isDate: defaultPgValue instanceof Date,
          iso: defaultPgValue.toISOString(),
          local: defaultPgValue.toString(),
        },
        drizzleNodePgParser: {
          type: typeof drizzleDriverValue,
          value: drizzleDriverValue,
        },
        defaultDrizzleColumn: {
          columnType: defaultColumn.columnType,
          mapped: defaultColumn.mapFromDriverValue(drizzleDriverValue),
        },
        explicitDateModeColumn: {
          columnType: dateModeColumn.columnType,
          mappedIso: dateModeColumn
            .mapFromDriverValue(drizzleDriverValue)
            .toISOString(),
        },
      },
      null,
      2,
    ),
  );
}

function runZodAndUiEvidence(): void {
  section("Zod endpoint y calendario LCD/impresión");
  const dateField = GetClienteNotaCreditoResponse.shape.fechaVencimiento;
  const zodDate = dateField.parse(DATE_ONLY);
  const jsonWire = JSON.stringify(zodDate);
  const lcdDate = format(new Date(JSON.parse(jsonWire)), "dd/MM/yyyy");
  const printDate = formatDateOnlyMx(DATE_ONLY);

  assert.equal(zodDate instanceof Date, true);
  assert.equal(zodDate.toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(jsonWire, '"2026-10-02T00:00:00.000Z"');

  console.log(
    JSON.stringify(
      {
        tz: process.env.TZ ?? "(unset)",
        endpoint: "GetClienteNotaCreditoResponse",
        endpointDateInput: DATE_ONLY,
        endpointDateRuntime: {
          type: typeof zodDate,
          isDate: zodDate instanceof Date,
          iso: zodDate.toISOString(),
        },
        endpointJsonWire: JSON.parse(jsonWire),
        lcdDateFnsFromIso: lcdDate,
        printDateOnlyMx: printDate,
        expectedDifferenceUnderMexico:
          process.env.TZ === "America/Mexico_City"
            ? "LCD -1 día; impresión conserva día"
            : "depende de TZ del proceso",
      },
      null,
      2,
    ),
  );
}

function runCalendarAndDerivationEvidence(): void {
  section("deriveTicketCreditData: string, Date y null");
  const createdAt = new Date("2026-09-01T12:00:00.000Z");
  const movement = (fechaVencimiento: string | Date | null) => ({
    id: 1,
    ticketId: 42,
    tipo: "VENTA_CREDITO" as const,
    importe: "100.00",
    diasPlazo: 30,
    fechaVencimiento,
    createdAt,
  });

  const fromString = deriveTicketCreditData(42, [], [
    movement(DATE_ONLY),
  ]);
  const fromDate = deriveTicketCreditData(42, [], [
    movement(new Date(`${DATE_ONLY}T00:00:00.000Z`)),
  ]);
  const fromNull = deriveTicketCreditData(42, [], [movement(null)]);
  const nonCredit = deriveTicketCreditData(42, [], []);

  assert.equal(fromString.fechaVencimiento, DATE_ONLY);
  assert.equal(fromDate.fechaVencimiento, DATE_ONLY);
  assert.equal(fromNull.fechaVencimiento, null);
  assert.equal(nonCredit.fechaVencimiento, null);
  assert.deepEqual(
    { ...fromString, fechaVencimiento: null },
    { ...fromDate, fechaVencimiento: null },
  );

  console.log(
    JSON.stringify(
      {
        tz: process.env.TZ ?? "(unset)",
        fromString,
        fromDate,
        fromNull,
        nonCredit,
        branchConclusion:
          "helper acepta Date, pero ambos valores normales conservan el mismo YYYY-MM-DD; la lectura Drizzle real aporta string",
      },
      null,
      2,
    ),
  );
}

const requestedSection = process.argv[2] ?? "all";
if (requestedSection === "decoder" || requestedSection === "all") {
  runDecoderEvidence();
}
if (requestedSection === "ui" || requestedSection === "all") {
  runZodAndUiEvidence();
}
if (requestedSection === "derive" || requestedSection === "all") {
  runCalendarAndDerivationEvidence();
}
if (!["all", "decoder", "ui", "derive"].includes(requestedSection)) {
  throw new Error(`Unknown section: ${requestedSection}`);
}