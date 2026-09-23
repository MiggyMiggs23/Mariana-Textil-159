import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  GetE7AtribucionResponse,
  GetE7ClienteExportacionResponse,
} from "@workspace/api-zod";
import { createE7Reader, E7_LEYENDAS, type E7Session } from "./e7-read-model";
import {
  e7AttributionPdf,
  e7AttributionWorkbook,
  e7StatementHtml,
  e7StatementPdf,
  e7StatementWorkbook,
} from "./e7-export";
import {
  E7_ATTRIBUTION_ENABLED,
  E7_CLIENT_FINANCIAL_READS_ENABLED,
  E7_E5_READ_SOURCE_ENABLED,
  E7_ENABLED,
} from "./e7-feature";
import { E5_ENABLED } from "./e5-feature";
import type { CreditLedgerQuery } from "./credit-aging-read-model";

const now = new Date("2026-02-01T12:00:00.000Z");
const session: E7Session = { userId: 1, sessionId: "70000000-0000-4000-8000-000000000001" };
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
const ledgerRows = [
  { cliente_id: 1, id: 1, ticket_id: 11, directed_movimiento_id: null, movimiento_origen_id: null,
    tipo: "VENTA_CREDITO", importe: "100.00", created_at: new Date("2026-01-02T12:00:00Z"),
    fecha_vencimiento: null, dias_plazo: null, notas: null, folio: 101, metadata: null,
    prevent_implicit_favor: false, immutable_applied_cents: 0, explicit_favor_applications: [] },
  { cliente_id: 1, id: 2, ticket_id: 12, directed_movimiento_id: null, movimiento_origen_id: null,
    tipo: "VENTA_CREDITO", importe: "100.00", created_at: new Date("2026-01-03T12:00:00Z"),
    fecha_vencimiento: null, dias_plazo: null, notas: null, folio: 102, metadata: null,
    prevent_implicit_favor: false, immutable_applied_cents: 0, explicit_favor_applications: [] },
  { cliente_id: 1, id: 3, ticket_id: null, directed_movimiento_id: null, movimiento_origen_id: null,
    tipo: "ABONO", importe: "-120.00", created_at: new Date("2026-01-04T12:00:00Z"),
    fecha_vencimiento: null, dias_plazo: null, notas: null, folio: null, metadata: null,
    prevent_implicit_favor: false, immutable_applied_cents: 12000, explicit_favor_applications: [] },
  ...[51, 52, 53].map((id, index) => ({
    cliente_id: 1, id, ticket_id: null, directed_movimiento_id: null, movimiento_origen_id: null,
    tipo: "ABONO", importe: "-5.00", created_at: new Date(`2026-01-0${5 + index}T12:00:00Z`),
    fecha_vencimiento: null, dias_plazo: null, notas: null, folio: null, metadata: null,
    prevent_implicit_favor: false, immutable_applied_cents: 0, explicit_favor_applications: [],
  })),
];
type Actor = { id: number; rol: string; ubicacion_id: number | null; alcance_consulta: string };
function permissionDatabase(granted = true) {
  let selects = 0;
  const database = { select() {
    const index = selects++;
    const chain = {
      from() { return chain; }, innerJoin() { return chain; }, where() { return chain; },
      async limit() {
        return granted && index % 3 === 0
          ? [{ puedeVer: true, puedeCrear: false, puedeEditar: false, puedeAutorizar: false }]
          : [];
      },
    };
    return chain;
  } };
  return { database: database as never, get selects() { return selects; } };
}
function databaseFixture(options: { actors?: Array<Actor | null>; historicalSql?: boolean } = {}) {
  const actors = options.actors ?? [{ id: 1, rol: "ADMIN", ubicacion_id: null, alcance_consulta: "TODAS" }];
  let authReads = 0, queries = 0, transactions = 0;
  const seen: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: CreditLedgerQuery = { async query<T>(text: string, values: readonly unknown[] = []) {
    queries++; seen.push({ text, values });
    const rows = (() => {
      if (/FROM usuarios u JOIN sesiones/.test(text)) return [actors[Math.min(authReads++, actors.length - 1)]].filter(Boolean);
      if (/SELECT id,nombre FROM ubicaciones/.test(text)) {
        return (values[0] as number[]).map(id => ({ id, nombre: `Tienda ${id}` }));
      }
      if (/SELECT limite_credito::text AS limite FROM clientes/.test(text)) return [{ limite: "300.00" }];
      if (/SELECT m\.cliente_id,m\.id,m\.ticket_id/.test(text)) return ledgerRows;
      if (/SELECT m\.id,[\s\S]*CASE WHEN m\.id IN/.test(text)) {
        const historicalIds = new Set((text.match(/m\.id IN \(([\d,]+)\)/)?.[1] ?? "")
          .split(",").filter(Boolean).map(Number));
        return [
          { id: 1, ticket_id: 11, ubicacion_id: 1, folio: "F-101", cuenta_destino: null, naturaleza: null,
            sitio_origen_id: 1, original_tipo: null },
          { id: 2, ticket_id: 12, ubicacion_id: 2, folio: "F-102", cuenta_destino: null, naturaleza: null,
            sitio_origen_id: 2, original_tipo: null },
          { id: 3, ticket_id: null, ubicacion_id: null, folio: null, cuenta_destino: "CAJA_FISICA",
            naturaleza: "OPERACION_CREDITO_SIN_DINERO", sitio_origen_id: 1, original_tipo: null },
          ...[51, 52, 53].map(id => ({ id, ticket_id: null, ubicacion_id: null, folio: null, cuenta_destino: "CUENTA_FISCAL",
            naturaleza: null, sitio_origen_id: historicalIds.has(id) ? null : 9, original_tipo: null })),
        ];
      }
      if (/SELECT r\.id,r\.fecha_recepcion,r\.ubicacion_id/.test(text)) {
        return [{ id: "70000000-0000-4000-8000-000000000010",
          fecha_recepcion: "2025-12-20T12:00:00.000Z", ubicacion_id: 1,
          pendiente: text.includes("COALESCE(a.importe,0)-COALESCE(d.importe,0)") ? "15.00" : "120.00" }];
      }
      if (/SELECT r\.id::text AS id,[\s\S]*UNION ALL SELECT d\.clave/.test(text)) {
        return [
          { id: "70000000-0000-4000-8000-000000000010", fecha: "2026-01-10T12:00:00.000Z",
            importe: "120.00", ubicacion_id: 1, tipo: "RECEPCION_RETENIDA" },
          { id: "70000000-0000-4000-8000-000000000011", fecha: "2026-01-15T12:00:00.000Z",
            importe: "-20.00", ubicacion_id: null, tipo: "DEVOLUCION_RETENIDA" },
        ];
      }
      if (/FROM ticket_pagos p JOIN tickets t/.test(text)) {
        return [{ id: "POS:1", ticket_id: 21, folio: 201, fecha: "2026-01-08T12:00:00.000Z", importe: "30.00",
          ubicacion_id: 1, cuenta: "CAJA_FISICA" }];
      }
      if (/SELECT DISTINCT m\.cliente_id AS id/.test(text)) return [{ id: 1 }];
      if (/SELECT id,fecha_recepcion,importe::text,ubicacion_id,cuenta_destino/.test(text)) {
        return [{ id: "70000000-0000-4000-8000-000000000010",
          fecha_recepcion: "2026-01-10T12:00:00.000Z", importe: "120.00",
          ubicacion_id: 1, cuenta_destino: "CAJA_FISICA" }];
      }
      if (/SELECT d\.clave,d\.importe::text,d\.fuente/.test(text)) {
        return [{ clave: "70000000-0000-4000-8000-000000000011", importe: "20.00",
          fuente: { tipo: "CAJA", cuentaOrigen: "CAJA_FISICA" }, fecha: "2026-01-15T12:00:00.000Z" }];
      }
      throw new Error(`E7_FIXTURE_SQL_NOT_ALLOWED: ${text}`);
    })();
    return { rows: rows as T[] };
  } };
  const transaction = async <T>(work: (db: CreditLedgerQuery) => Promise<T>) => {
    transactions++; return work(database);
  };
  return { database, transaction, seen, get queries() { return queries; },
    get authReads() { return authReads; }, get transactions() { return transactions; } };
}
function reader(fixture: ReturnType<typeof databaseFixture>, extra: Record<string, unknown> = {}) {
  return createE7Reader({ enabled: true, attributionEnabled: true, e5Enabled: true, now: () => now,
    database: fixture.database, transaction: fixture.transaction, ...extra });
}
const attributionQuery = { desde: "2026-01-01", hasta: "2026-01-31" };
function extractLatin1PdfLines(pdf: Buffer) {
  const source = pdf.toString("latin1");
  assert.match(source, /^%PDF-1\.4\n/);
  assert.match(source, /\nxref\n/);
  assert.match(source, /\ntrailer\n/);
  const lines = [...source.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(match =>
    match[1]!.replace(/\\([\\()])/g, "$1"));
  assert.equal(lines.length > 2, true);
  return lines;
}
test("E7-PRODUCTION-GATES-CLIENT-READ-ONLY", () => {
  assert.deepEqual({
    e7: E7_ENABLED,
    clientFinancialReads: E7_CLIENT_FINANCIAL_READS_ENABLED,
    installedE5ReadSource: E7_E5_READ_SOURCE_ENABLED,
    attribution: E7_ATTRIBUTION_ENABLED,
    e5Operations: E5_ENABLED,
  }, {
    e7: true,
    clientFinancialReads: true,
    installedE5ReadSource: true,
    attribution: true,
    e5Operations: false,
  });
});

test("E7-OFF-NO-READS", async () => {
  const fixture = databaseFixture(), api = createE7Reader({
    enabled: false, e5Enabled: true, database: fixture.database, transaction: fixture.transaction,
  });
  await assert.rejects(() => api.statement(session, 1), code("E7_DISABLED"));
  await assert.rejects(() => api.attribution(session, attributionQuery), code("E7_DISABLED"));
  assert.deepEqual([fixture.queries, fixture.transactions], [0, 0]);
});
test("E7-E5-DEPENDENCY-NO-FALLBACK", async () => {
  const fixture = databaseFixture(), api = createE7Reader({
    enabled: true, attributionEnabled: true, e5Enabled: false,
    database: fixture.database, transaction: fixture.transaction,
  });
  await assert.rejects(() => api.attribution(session, attributionQuery), code("E7_DEPENDENCIA_NO_DISPONIBLE"));
  assert.deepEqual([fixture.queries, fixture.transactions], [0, 0]);
});
test("E7-ATTRIBUTION-GATE-IS-INDEPENDENT", async () => {
  const fixture = databaseFixture(), api = createE7Reader({
    enabled: true, attributionEnabled: false, e5Enabled: true,
    database: fixture.database, transaction: fixture.transaction,
  });
  await assert.rejects(() => api.attribution(session, attributionQuery), code("E7_ATRIBUCION_DISABLED"));
  assert.deepEqual([fixture.queries, fixture.transactions], [0, 0]);
});
test("E7-SESSION-MUST-BE-CURRENT", async () => {
  const fixture = databaseFixture({ actors: [null] });
  await assert.rejects(() => reader(fixture).statement(session, 1), code("NO_AUTENTICADO"));
  assert.equal(fixture.seen[0]!.values[3], "2026-01-31T20:00:00.000Z");
  assert.equal(fixture.transactions, 0);
});
test("E7-CONTADOR-A-F-HARD-DENY", async () => {
  for (const actor of [
    { id: 7, rol: "CONTADOR", ubicacion_id: 1, alcance_consulta: "TODAS", perfil: "A" },
    { id: 8, rol: "CONTADOR", ubicacion_id: 1, alcance_consulta: "TODAS", perfil: "F" },
  ]) {
    const fixture = databaseFixture({ actors: [actor] }), permissions = permissionDatabase(true);
    await assert.rejects(() => createE7Reader({ enabled: true, e5Enabled: true, now: () => now,
      database: fixture.database, transaction: fixture.transaction,
      permissionDatabase: permissions.database }).statement({ ...session, userId: actor.id }, 1),
    code("PERFIL_DENEGADO"));
    assert.equal(permissions.selects, 0);
  }
});
test("E7-CENTRAL-PERMISSION-AND-SITE-SCOPE", async () => {
  const fixture = databaseFixture({ actors: [{ id: 4, rol: "CAJA", ubicacion_id: 1, alcance_consulta: "PROPIA" }] });
  const permissions = permissionDatabase(true);
  const api = reader(fixture, { permissionDatabase: permissions.database });
  let own!: Awaited<ReturnType<typeof api.statement>>;
  await assert.doesNotReject(async () => { own = await api.statement({ ...session, userId: 4 }, 1); });
  assert.deepEqual(own.alcance.ubicaciones.map(site => site.id), [1]);
  await assert.rejects(() => api.statement({ ...session, userId: 4 }, 1, { ubicacionIds: "1,2" }),
    (error: unknown) => (error as { status?: number }).status === 403);
  assert.equal(permissions.selects >= 6, true);
});
test("E7-REAUTHORIZES-BEFORE-DELIVERY", async () => {
  const fixture = databaseFixture({ actors: [
    { id: 1, rol: "ADMIN", ubicacion_id: null, alcance_consulta: "TODAS" },
    { id: 1, rol: "ADMIN", ubicacion_id: 2, alcance_consulta: "PROPIA" },
  ] });
  await assert.rejects(() => reader(fixture).statement(session, 1), code("PERFIL_CAMBIADO"));
  assert.equal(fixture.authReads, 2);
});
test("E7-FOUR-GLOBALS-SITE-DETAIL", async () => {
  const fixture = databaseFixture();
  const result = await reader(fixture).statement(session, 1, { ubicacionId: "1" });
  GetE7ClienteExportacionResponse.parse(result);
  assert.deepEqual(result.resumenGlobal, {
    deudaActual: "65.00", saldoAFavor: "0.00", limiteCredito: "300.00", creditoDisponible: "235.00",
  });
  assert.deepEqual(Object.keys(result.resumenGlobal).sort(),
    ["creditoDisponible", "deudaActual", "limiteCredito", "saldoAFavor"].sort());
  assert.equal(result.movimientos.every(row => row.ubicacionId === 1), true);
  assert.equal(result.movimientos.some(row => row.tipo === "SALDO_DEUDOR"), false);
});
test("E7-CANONICAL-FIFO-PORTIONS", async () => {
  const fixture = databaseFixture();
  let result!: Awaited<ReturnType<ReturnType<typeof reader>["statement"]>>;
  await assert.doesNotReject(async () => {
    result = await reader(fixture).statement(session, 1, { ubicacionId: "2" });
  });
  const applications = result.movimientos.filter(row => row.tipo === "APLICACION");
  assert.equal(applications.reduce((sum, row) => sum + Number(row.importe), 0), -35);
  assert.equal(applications.every(row => row.ubicacionId === 2), true);
});
test("E7-RECEIPT-APPLICATION-NOT-DOUBLE-INCOME", async () => {
  const fixture = databaseFixture();
  const result = await reader(fixture).attribution(session, attributionQuery);
  GetE7AtribucionResponse.parse(result);
  assert.deepEqual([result.cobranzaTotal, result.recepcionesFisicas, result.aplicacionesNotas],
    ["145.00", "150.00", "135.00"]);
  assert.equal(result.movimientos.filter(row => row.id === "E5:70000000-0000-4000-8000-000000000010").length, 1);
  assert.equal(result.movimientos.some(row => row.id === "ledger:3"), false);
  const pos = result.movimientos.find(row => row.id === "POS:1");
  assert.deepEqual([pos?.detailHref, pos?.documentHref, pos?.folio],
    ["/tickets/21", "/tickets/21", "201"]);
  const application = result.movimientos.find(row => row.tipo === "APLICACION");
  assert.deepEqual([application?.detailHref, application?.documentHref],
    ["/clientes/1/movimientos/3", "/tickets/11"]);
  assert.equal(result.movimientos.filter(row => row.id.startsWith("E5:"))
    .every(row => row.detailHref === null && row.documentHref === null), true);
});
test("E7-RETAINED-STOCK-NOT-RANGE-FLOW", async () => {
  const fixture = databaseFixture();
  const result = await reader(fixture).attribution(session, attributionQuery);
  assert.deepEqual(result.retenidos, [{
    cobroId: "70000000-0000-4000-8000-000000000010",
    fechaRecepcion: "2025-12-20T12:00:00.000Z", ubicacionId: 1,
    importePendiente: "15.00", antiguedadDias: 43,
  }]);
  assert.equal(result.totalRetenido, "15.00");
});
test("E7-HISTORIC-51-53-UNLOCATED-GLOBAL-ONLY", async () => {
  const global = await reader(databaseFixture()).attribution(session, attributionQuery);
  const historic = global.movimientos.filter(row => row.tipo === "REGISTRO_HISTORICO");
  assert.deepEqual(historic.map(row => [row.id, row.ubicacionId]),
    [["ledger:51", null], ["ledger:52", null], ["ledger:53", null]]);
  const site = await reader(databaseFixture()).attribution(session, { ...attributionQuery, ubicacionId: "1" });
  assert.equal(site.movimientos.some(row => row.tipo === "REGISTRO_HISTORICO"), false);
  assert.deepEqual([site.cobranzaTotal, site.recepcionesFisicas], [null, null]);
});
test("E7-MISSING-MONETARY-SOURCE-FAILS", async () => {
  const fixture = databaseFixture();
  const original = fixture.database.query.bind(fixture.database);
  fixture.database.query = async <T>(text: string, values: readonly unknown[] = []) => {
    const result = await original<T>(text, values);
    if (/SELECT m\.id,[\s\S]*CASE WHEN m\.id IN/.test(text)) {
      result.rows = result.rows.map(row => Number((row as { id?: unknown }).id) === 51
        ? { ...row, cuenta_destino: null } : row);
    }
    return result;
  };
  await assert.rejects(() => reader(fixture).attribution(session, attributionQuery), code("E7_FUENTE_INVALIDA"));
});
test("E7-STATEMENT-REAL-DOCUMENTS-AND-LEGENDS", async () => {
  const data = await reader(databaseFixture()).statement(session, 1, { ubicacionId: "1" });
  const workbook = e7StatementWorkbook(data), bytes = await workbook.xlsx.writeBuffer();
  const parsed = new ExcelJS.Workbook();
  await assert.doesNotReject(() => parsed.xlsx.load(bytes as ArrayBuffer));
  const summary = parsed.getWorksheet("Alcance y resumen")!.getColumn(1).values.map(String).join("\n");
  for (const legend of E7_LEYENDAS) assert.match(summary, new RegExp(legend.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const pdfLines = extractLatin1PdfLines(e7StatementPdf(data));
  for (const legend of E7_LEYENDAS) assert.equal(pdfLines.includes(legend), true);
  assert.equal(pdfLines.includes("Deuda actual global: 65.00"), true);
  assert.match(e7StatementHtml(data), /El resumen global de crédito considera todos los sitios\./);
});
test("E7-ATTRIBUTION-REAL-DOCUMENTS-AND-LEGENDS", async () => {
  const data = await reader(databaseFixture()).attribution(session, attributionQuery);
  const workbook = e7AttributionWorkbook(data), bytes = await workbook.xlsx.writeBuffer();
  const parsed = new ExcelJS.Workbook();
  await assert.doesNotReject(() => parsed.xlsx.load(bytes as ArrayBuffer));
  assert.deepEqual(parsed.worksheets.map(sheet => sheet.name),
    ["Alcance y puente", "Puente por fuente", "Detalle autorizado", "Retenido separado"]);
  const text = parsed.getWorksheet("Alcance y puente")!.getColumn(1).values.map(String).join("\n");
  for (const legend of E7_LEYENDAS) assert.match(text,
    new RegExp(legend.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(text, /Aplicaciones netas a notas: 135\.00 \(no segundo ingreso\)/);
  const pdfLines = extractLatin1PdfLines(e7AttributionPdf(data));
  for (const legend of E7_LEYENDAS) assert.equal(pdfLines.includes(legend), true);
  assert.equal(pdfLines.includes("Retenido pendiente del alcance al generar: 15.00 (no favor ni deuda pagada)"), true);
});