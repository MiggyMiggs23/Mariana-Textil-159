import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import test from "node:test";
import {
  buildEstadoCuentaWorkbook,
  type EstadoCuentaExportProjection,
} from "./routes/clientes";

const root = new URL("../../../", import.meta.url);
const auditSummary = {
  cartera: {
    dateFields: [
      "routes/clientes.ts dateOnly/calendarDate for JSON and XLSX",
      "credit-allocation.ts dueAt/calendarDate for projected charges",
    ],
    dayFields: [
      "creditDueDays",
      "diasVencido",
    ],
    derivedKind: "UTC-midnight ordinal calendar-label difference",
  },
  cobros: {
    dateFields: [
      "routes/notificaciones.ts calendarDate for notification fechaVencimiento",
      "projected charge dueAt remains YYYY-MM-DD text",
    ],
    dayFields: ["diasVencido"],
    derivedKind: "UTC-midnight ordinal calendar-label difference",
  },
  alerts: {
    dateFields: [
      "lib/admin-alertas.ts projected dueAt is YYYY-MM-DD text",
      "routes/admin-alertas.ts passes generated credit date strings unchanged",
    ],
    dayFields: ["diasRestantes"],
    derivedKind: "UTC-midnight ordinal calendar-label difference",
  },
  testedBoundaries: [
    "2026-01-01 day one",
    "2026-01-31 month end",
    "2024-02-29 leap day",
    "2026-10-16 target date",
  ],
};

test("estado de cuenta XLSX production builder preserves due-date text", async () => {
  const localMidnight = (label: string) => {
    const [year, month, day] = label.split("-").map(Number);
    return new Date(year!, month! - 1, day);
  };
  const labels = [
    ["2026-01-01", new Date("2026-01-01T00:00:00.000Z")],
    ["2026-01-31", localMidnight("2026-01-31")],
    ["2024-02-29", new Date("2024-02-29T00:00:00.000Z")],
    ["2026-10-16", localMidnight("2026-10-16")],
  ] as const;
  const rows = labels.map(([__, fechaVencimiento], index) => ({
    id: index + 1,
    fecha: new Date("2026-01-01T12:00:00.000Z"),
    tipo: "VENTA_CREDITO",
    fechaVencimiento,
    formaPago: "EFECTIVO",
    importe: "100.00",
    saldoCorridoHistorico: "100.00",
    referencia: null,
    usuario: "Fixture",
  }));
  const projection: EstadoCuentaExportProjection = {
    allCharges: labels.map(([label, fechaVencimiento], index) => ({
      movimientoId: index + 1,
      ticketId: index + 1,
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      dueAt: label,
      originalCents: 10_000,
      pendienteCents: 10_000,
      folio: 1000 + index,
      diasPlazo: 7,
      notas: null,
      tipo: "VENTA_CREDITO" as const,
    })),
    movementProjections: labels.map(([_label, _date], index) => ({
      movementId: index + 1,
      saldoDeudorProyectadoCents: 10_000,
      saldoAFavorProyectadoCents: 0,
    })),
    balanceCents: 10_000,
    overpaymentCents: 0,
  };

  // This calls the exact production XLSX builder used by the route; no HTTP,
  // session, DB query, or write is involved.
  const workbook = buildEstadoCuentaWorkbook(rows, projection);
  const bytes = await workbook.xlsx.writeBuffer();
  const parsedWorkbook = new ExcelJS.Workbook();
  await parsedWorkbook.xlsx.load(bytes as ArrayBuffer);
  const sheet = parsedWorkbook.getWorksheet("Estado de cuenta");
  assert.ok(sheet);
  const headerRow = sheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values : [];
  const dueDateColumnIndex = headerValues.findIndex(
    (value: unknown) => value === "Fecha de vencimiento",
  );
  assert.ok(dueDateColumnIndex > 0);

  const parsed = labels.map(([label], index) => {
    const cell = sheet.getRow(index + 2).getCell(dueDateColumnIndex);
    assert.equal(typeof cell.value, "string");
    assert.equal(cell.value, label);
    assert.doesNotMatch(String(cell.value), /T00:00:00|Z/);
    return { label, value: cell.value, type: typeof cell.value };
  });
  assert.deepEqual(parsed.map((item) => item.value), labels.map(([label]) => label));

  const reportUrl = new URL("reports/calendar-due-date/excel-verification.json", root);
  await mkdir(new URL("./", reportUrl), { recursive: true });
  let runs: unknown[] = [];
  try {
    runs = JSON.parse(await readFile(reportUrl, "utf8")).runs ?? [];
  } catch {
    // The report is an execution artifact and may not exist on the first run.
  }
  const timezone = process.env.TZ ?? "system";
  runs = runs.filter((run: any) => run?.timezone !== timezone);
  runs.push({
    verification: "in-memory production estado-cuenta XLSX builder",
    timezone,
    fixtureOnly: true,
    liveApi: false,
    databaseQueries: false,
    databaseWrites: false,
    parsedDueDateCells: parsed,
    assertions: [
      "Fecha de vencimiento column is present",
      "all parsed due dates are exact YYYY-MM-DD strings",
      "ExcelJS parsed no Date objects or ISO timestamp suffixes",
    ],
  });
  await writeFile(reportUrl, `${JSON.stringify({ auditSummary, runs }, null, 2)}\n`, "utf8");
});