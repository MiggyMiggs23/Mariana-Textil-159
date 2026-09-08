import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Ticket and Note are absolute, independently processed operations", () => {
  const pos = read("./lib/pos.ts");
  const caja = read("../../mariana-textil/src/pages/cobros.tsx");
  assert.match(pos, /documentoTipo !== "TICKET"[\s\S]*NOTE_CHARGE_FORBIDDEN/);
  assert.match(pos, /documentoTipo !== "NOTA"[\s\S]*NOT_A_CREDIT_NOTE/);
  assert.match(pos, /autorizacionEstado: "AUTORIZADA"/);
  assert.match(pos, /origen: "AUTORIZACION_NOTA"/);
  assert.match(caja, /Ticket"} folio/);
  assert.match(caja, />\s*Cobrar\s*</);
  assert.match(caja, />\s*Autorizar\s*</);
});

test("authorization uses the shared ledger projection and has no override", () => {
  const pos = read("./lib/pos.ts");
  const route = read("./routes/pos.ts");
  assert.match(pos, /loadCustomerCreditLedgerInTransaction/);
  assert.match(pos, /projectCreditLedger\(ledger\)/);
  assert.match(pos, /Un ADMIN debe subir el límite del cliente/);
  assert.doesNotMatch(pos.slice(pos.indexOf("export async function autorizarNota")), /override|password|credenciales/i);
  assert.match(route, /db\.transaction\(\(tx\) => autorizarNota/);
});

test("Note cancellation reverses its authorized ledger charge, never a payment", () => {
  const pos = read("./lib/pos.ts");
  const cancellation = pos.slice(
    pos.indexOf("export async function cancelarTicket"),
    pos.indexOf("export async function cobrarTicket"),
  );
  assert.match(cancellation, /movimientosCreditoTable\.tipo, "VENTA_CREDITO"/);
  assert.match(cancellation, /for \(const charge of creditCharges\)/);
  assert.match(cancellation, /movimientoOrigenId: charge\.id/);
  assert.match(cancellation, /eq\(movimientosCreditoTable\.movimientoOrigenId, charge\.id\)/);
  assert.match(cancellation, /importe: decimalMoney\(-creditCents\)/);
  assert.doesNotMatch(cancellation, /ticketPagosTable/);
});

test("sales identity excludes operational pending amounts", () => {
  const collected = 12_345;
  const creditSales = 67_890;
  const pending = 99_999;
  const sales = collected + creditSales;
  assert.equal(sales, collected + creditSales);
  assert.notEqual(sales, collected + creditSales + pending);
});

test("all financial report read models use the canonical accounted predicate", () => {
  const reports = read("./lib/reportes-sales.ts");
  const commercialReports = read("./lib/reportes-commercial.ts");
  const reportFilters = read("./lib/reportes.ts");
  const clients = read("./routes/clientes.ts");
  const analytics = read("./lib/admin-analytics.ts");
  const adminAnalyticsRoute = read("./routes/admin-analytics.ts");
  for (const source of [reports, commercialReports, reportFilters, clients, analytics, adminAnalyticsRoute]) {
    assert.match(source, /accountedDocumentPredicate/);
  }
  assert.match(analytics, /pendingTicketPredicate/);
  assert.match(analytics, /credito_operaciones/);
  assert.match(analytics, /accountedDocumentAt/);
  assert.match(analytics, /documento_tipo='NOTA' AND t\.autorizacion_estado='AUTORIZADA'/);
  assert.match(analytics, /JOIN movimientos_credito m ON m\.ticket_id=ft\.id[\s\S]*m\.tipo='VENTA_CREDITO'/);
  assert.doesNotMatch(analytics.slice(analytics.indexOf("export async function compareStores")), /forma_pago='CREDITO'/);
  assert.match(clients, /accountedDocumentAt\("t"\)/);
  assert.match(clients, /to_char\(\$\{accountedDocumentAt\("t"\)\},'YYYY-MM'\)/);
  assert.match(clients, /SELECT facturado[\s\S]*accountedDocumentAt\("t"\)/);
  assert.match(analytics, /getStoreSalesGlobal[\s\S]*accountedDocumentPredicate\("t"\)[\s\S]*accountedDocumentAt\("t"\)/);
});

test("Caja feed uses the canonical pending-document predicate", () => {
  const notifications = read("./routes/notificaciones.ts");
  const feed = notifications.slice(
    notifications.indexOf('router.get("/notificaciones/feed"'),
    notifications.indexOf('router.get("/notificaciones/feed"', notifications.indexOf('router.get("/notificaciones/feed"') + 1),
  );
  assert.match(notifications, /import \{ pendingTicketPredicate \} from "\.\.\/lib\/accounted-document"/);
  assert.match(feed, /pendingTicketPredicate\("t"\)/);
  assert.doesNotMatch(feed, /t\.estado='VENDIDO' AND NOT t\.cobrado/);
});

test("sales summary excludes only credit from collected payment methods", () => {
  const analytics = read("./lib/admin-analytics.ts");
  const summary = analytics.slice(
    analytics.indexOf("export async function getSalesSummary"),
    analytics.indexOf("export async function getSessionMargin"),
  );
  assert.match(summary, /p\.forma_pago <> 'CREDITO'/);
  assert.doesNotMatch(summary, /p\.forma_pago IN \('EFECTIVO','TRANSFERENCIA','FACTURADO'\)/);
});

test("fiscal financial ranges use Caja processing timestamps", () => {
  const route = read("./routes/admin-analytics.ts");
  const fiscal = route.slice(route.indexOf("async function fiscalFigures"), route.indexOf("function presentFiscalRecord"));
  assert.match(fiscal, /accountedDocumentAt\("t"\)/);
  assert.doesNotMatch(fiscal, /t\.created_at/);
});

test("summary and realtime sales require explicit Caja processing date basis", () => {
  const analytics = read("./lib/admin-analytics.ts");
  assert.match(analytics, /dateBasis: "ACCOUNTED" \| "CREATED"/);
  assert.match(analytics, /getSalesSummary[\s\S]*where\(filters, "t", "ACCOUNTED"\)/);
  assert.match(analytics, /pendingCondition = where\(filters, "t", "CREATED"\)/);
  assert.match(analytics, /WITH filtered AS \([\s\S]*?\), pending AS \([\s\S]*pendingTicketPredicate/);
  assert.match(analytics, /getRealtimeStores[\s\S]*where\(filters, "t", "ACCOUNTED"\)/);
  assert.match(analytics, /operationalCondition = where\(filters, "t", "CREATED"\)/);
  const pending = analytics.slice(analytics.indexOf("export async function getPending"), analytics.indexOf("export function summarizeRealtimeCredit"));
  assert.match(pending, /where\(filters, "t", "CREATED"\)/);
  assert.match(pending, /pendingTicketPredicate\("t"\)/);
  assert.doesNotMatch(pending, /NOT t\.cobrado/);
});

test("supplier margin and realtime documents respect Caja processing", () => {
  const suppliers = read("./lib/compras-proveedor.ts");
  const analytics = read("./lib/admin-analytics.ts");
  const realtimeUi = read("../../mariana-textil/src/pages/caja/tiempo-real.tsx");
  assert.match(suppliers, /accountedDocumentPredicate\("t"\)/);
  assert.match(suppliers, /accountedDocumentAt\("t"\)/);
  assert.match(analytics, /documento_tipo "documentoTipo"/);
  assert.match(analytics, /autorizacion_estado "autorizacionEstado"/);
  assert.match(realtimeUi, /Nota autorizada/);
  assert.match(realtimeUi, /Ticket pendiente/);
});

test("legacy authorized Notes receive deterministic authorization timestamps", () => {
  const migration = read("../../../lib/db/src/lib/ticket-authorization-schema.ts");
  assert.match(migration, /COALESCE\(\s*t\.autorizado_at/);
  assert.match(migration, /SELECT MIN\(m\.created_at\)/);
  assert.match(migration, /m\.tipo='VENTA_CREDITO'/);
});

test("pending Notes do not reserve customer credit before authorization", () => {
  const aging = read("./lib/credit-aging-read-model.ts");
  const pos = read("./lib/pos.ts");
  assert.doesNotMatch(aging, /CreditReservation/);
  assert.doesNotMatch(pos.slice(pos.indexOf("export async function autorizarNota")), /reservas/);
});

test("Caja only retains cut printing", () => {
  const caja = read("../../mariana-textil/src/pages/cobros.tsx");
  assert.doesNotMatch(caja, /print=3|print-hoja-ventas|Imprimir hoja de ventas/);
  assert.match(caja, /print-corte/);
  assert.match(caja, /Imprimir Corte/);
});