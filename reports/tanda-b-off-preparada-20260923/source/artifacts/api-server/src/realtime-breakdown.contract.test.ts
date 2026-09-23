import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("pending includes unpaid Tickets and unauthorized Notes, including null authorization", () => {
  const predicates = read("./lib/accounted-document.ts");
  assert.match(predicates, /documento_tipo='TICKET'[\s\S]*cobrado=false/);
  assert.match(predicates, /documento_tipo='NOTA'[\s\S]*autorizacion_estado IS DISTINCT FROM 'AUTORIZADA'/);
});

test("realtime breakdown shares card predicates and has stable pagination order", () => {
  const analytics = read("./lib/admin-analytics.ts");
  const start = analytics.indexOf("export async function listRealtimeBreakdown");
  const end = analytics.indexOf("\nexport async function ", start + 1);
  const detail = analytics.slice(start, end);
  assert.match(detail, /collectedTicketPredicate\("t"\)/);
  assert.match(detail, /authorizedCreditPredicate\("t"\)/);
  assert.match(detail, /pendingTicketPredicate\("t"\)/);
  assert.match(detail, /FROM movimientos_credito m[\s\S]*m\.tipo='VENTA_CREDITO'/);
  assert.match(detail, /ORDER BY \$\{timestamp\} DESC,t\.id DESC LIMIT \$4 OFFSET \$5/);
  assert.doesNotMatch(detail, /\b(costo|utilidad|margen)\b/i);
});

test("salida breakdown concepts reuse the shared read model with stable paging and links", () => {
  const analytics = read("./lib/admin-analytics.ts");
  const readModelStart = analytics.indexOf("const REALTIME_SALIDA_DEFINITIONS");
  const start = analytics.indexOf("async function listRealtimeSalidaBreakdown");
  const end = analytics.indexOf("\n/** Paginated rows", start);
  const readModel = analytics.slice(readModelStart, start);
  const detail = analytics.slice(start, end);
  assert.match(readModel, /SALIDAS_EN_TRANSITO:[\s\S]*estado: "EN_TRANSITO"[\s\S]*timestamp: "s\.enviada_at"/);
  assert.match(readModel, /SALIDAS_CANCELADAS:[\s\S]*estado: "CANCELADA"[\s\S]*timestamp: "s\.cancelada_at"/);
  assert.match(readModel, /s\.origen_id=\$3/);
  assert.match(detail, /buildRealtimeSalidaOperationalReadModel\(concepto\)/);
  assert.match(detail, /ORDER BY \$\{readModel\.timestamp\} DESC,s\.id DESC LIMIT \$4 OFFSET \$5/);
  assert.match(detail, /href: `\/salidas\/\$\{Number\(row\.salidaId\)\}`/);
  assert.doesNotMatch(detail, /movimientos_inventario|kardex/i);
});

test("realtime detail route resolves read scope and rejects a requested location outside it", () => {
  const route = read("./routes/admin-analytics.ts");
  const start = route.indexOf('router.get("/admin/dashboard/realtime/desglose"');
  const end = route.indexOf("\n});", start);
  const detailRoute = route.slice(start, end);
  assert.match(detailRoute, /resolveReadScope\(req\.auth!, query\.ubicacionId\)/);
  assert.match(detailRoute, /query\.ubicacionId !== scope\.ubicacionId/);
  assert.match(detailRoute, /status\(403\)/);
});