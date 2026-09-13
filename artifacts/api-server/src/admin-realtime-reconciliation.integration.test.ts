import assert from "node:assert/strict";
import test from "node:test";

/**
 * This suite deliberately does not INSERT fixture rows.  The adapter below
 * prefixes each production SELECT with read-only CTEs and lets PostgreSQL
 * execute the real analytics SQL, including both its card aggregate and its
 * paginated detail aggregate.
 *
 * The disposable-test runner supplies the canonical schema and authorized
 * seed only.  The CTEs shadow the application tables for the statement's
 * lifetime; no actor, user, customer, product, or transaction is persisted.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const applicationDatabaseUrl =
  process.env.APPLICATION_DATABASE_URL ?? process.env.DATABASE_URL;

const FROM = "2025-05-10T00:00:00.000Z";
const TO = "2025-05-10T23:59:59.999Z";
const MID = "2025-05-10T12:00:00.000Z";
const BEFORE = "2025-05-09T23:59:59.999Z";
const AFTER = "2025-05-11T00:00:00.000Z";

type FixtureTicket = {
  id: number;
  folio: number;
  ubicacion_id: number;
  cliente_id: number;
  subtotal: string;
  iva: string;
  total: string;
  estado: "VENDIDO" | "CANCELADO";
  cobrado: boolean;
  cobrado_at: string | null;
  facturado: boolean;
  credito: boolean;
  dias_plazo: number | null;
  fecha_vencimiento: string | null;
  documento_tipo: "TICKET" | "NOTA";
  autorizacion_estado: "NO_APLICA" | "PENDIENTE" | "AUTORIZADA";
  autorizado_at: string | null;
  sesion_caja_id: number | null;
  usuario_terminal_id: number;
  created_at: string;
  cancelado_at: string | null;
  cancelado_por: number | null;
  motivo_cancelacion: string | null;
};

const tickets: FixtureTicket[] = [
  // COBRADO: created outside, processed exactly at the lower boundary.
  {
    id: 101, folio: 101, ubicacion_id: 1, cliente_id: 1,
    subtotal: "100.00", iva: "0.00", total: "100.00",
    estado: "VENDIDO", cobrado: true, cobrado_at: FROM,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: BEFORE,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // COBRADO zero amount: count must remain one, even when sum is unchanged.
  {
    id: 102, folio: 102, ubicacion_id: 1, cliente_id: 1,
    subtotal: "0.00", iva: "0.00", total: "0.00",
    estado: "VENDIDO", cobrado: true, cobrado_at: TO,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // COBRADO: creation is outside the period, but Caja processing is inside.
  {
    id: 103, folio: 103, ubicacion_id: 1, cliente_id: 1,
    subtotal: "50.00", iva: "0.00", total: "50.00",
    estado: "VENDIDO", cobrado: true, cobrado_at: MID,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: BEFORE,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // Creation is inside, but its Caja processing is outside: not COBRADO here.
  {
    id: 104, folio: 104, ubicacion_id: 1, cliente_id: 1,
    subtotal: "75.00", iva: "0.00", total: "75.00",
    estado: "VENDIDO", cobrado: true, cobrado_at: AFTER,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // CREDIT: authorization is at the lower boundary; creation is outside.
  {
    id: 201, folio: 201, ubicacion_id: 1, cliente_id: 1,
    subtotal: "125.00", iva: "0.00", total: "125.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: true, credito: true, dias_plazo: 30, fecha_vencimiento: "2025-06-09",
    documento_tipo: "NOTA", autorizacion_estado: "AUTORIZADA", autorizado_at: FROM,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: BEFORE,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // CREDIT zero amount: distinct document count must not follow amount.
  {
    id: 202, folio: 202, ubicacion_id: 1, cliente_id: 1,
    subtotal: "0.00", iva: "0.00", total: "0.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: true, credito: true, dias_plazo: 30, fecha_vencimiento: "2025-06-09",
    documento_tipo: "NOTA", autorizacion_estado: "AUTORIZADA", autorizado_at: TO,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // Authorization outside the period: created inside must not leak into CREDIT.
  {
    id: 203, folio: 203, ubicacion_id: 1, cliente_id: 1,
    subtotal: "80.00", iva: "0.00", total: "80.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: true, credito: true, dias_plazo: 30, fecha_vencimiento: "2025-06-09",
    documento_tipo: "NOTA", autorizacion_estado: "AUTORIZADA", autorizado_at: AFTER,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // Pending unauthorized Note: no authorization date exists.
  {
    id: 204, folio: 204, ubicacion_id: 1, cliente_id: 1,
    subtotal: "60.00", iva: "0.00", total: "60.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: false, credito: true, dias_plazo: 30, fecha_vencimiento: "2025-06-09",
    documento_tipo: "NOTA", autorizacion_estado: "PENDIENTE", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // PENDIENTE: exact lower boundary.
  {
    id: 301, folio: 301, ubicacion_id: 1, cliente_id: 1,
    subtotal: "40.00", iva: "0.00", total: "40.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: FROM,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // PENDIENTE zero amount: count is still observable.
  {
    id: 302, folio: 302, ubicacion_id: 1, cliente_id: 1,
    subtotal: "0.00", iva: "0.00", total: "0.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: TO,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // Pending unauthorized Note in the middle of the period.
  {
    id: 303, folio: 303, ubicacion_id: 1, cliente_id: 1,
    subtotal: "60.00", iva: "0.00", total: "60.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: false, credito: true, dias_plazo: 30, fecha_vencimiento: "2025-06-09",
    documento_tipo: "NOTA", autorizacion_estado: "PENDIENTE", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // Created outside: it must not be PENDIENTE for this period.
  {
    id: 304, folio: 304, ubicacion_id: 1, cliente_id: 1,
    subtotal: "70.00", iva: "0.00", total: "70.00",
    estado: "VENDIDO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: BEFORE,
    cancelado_at: null, cancelado_por: null, motivo_cancelacion: null,
  },
  // CANCELADAS: created outside, cancelled at the lower boundary; no
  // cobro/authorization timestamp is present.
  {
    id: 401, folio: 401, ubicacion_id: 1, cliente_id: 1,
    subtotal: "200.00", iva: "0.00", total: "200.00",
    estado: "CANCELADO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: BEFORE,
    cancelado_at: FROM, cancelado_por: null, motivo_cancelacion: "sin cobro",
  },
  // CANCELADAS zero amount at the upper boundary.
  {
    id: 402, folio: 402, ubicacion_id: 1, cliente_id: 1,
    subtotal: "0.00", iva: "0.00", total: "0.00",
    estado: "CANCELADO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: TO, cancelado_por: null, motivo_cancelacion: "monto cero",
  },
  // Created inside but cancelled outside: excluded from this card/detail.
  {
    id: 403, folio: 403, ubicacion_id: 1, cliente_id: 1,
    subtotal: "50.00", iva: "0.00", total: "50.00",
    estado: "CANCELADO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: AFTER, cancelado_por: null, motivo_cancelacion: "fuera de rango",
  },
  {
    id: 405, folio: 405, ubicacion_id: 1, cliente_id: 1,
    subtotal: "30.00", iva: "0.00", total: "30.00",
    estado: "CANCELADO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: MID,
    cancelado_at: MID, cancelado_por: null, motivo_cancelacion: "captura",
  },
  // This site contains only a cancellation in the period: its card rate is
  // exactly 100%, and it must remain visible with a site filter.
  {
    id: 404, folio: 404, ubicacion_id: 2, cliente_id: 1,
    subtotal: "10.00", iva: "0.00", total: "10.00",
    estado: "CANCELADO", cobrado: false, cobrado_at: null,
    facturado: false, credito: false, dias_plazo: null, fecha_vencimiento: null,
    documento_tipo: "TICKET", autorizacion_estado: "NO_APLICA", autorizado_at: null,
    sesion_caja_id: null, usuario_terminal_id: 1, created_at: BEFORE,
    cancelado_at: MID, cancelado_por: null, motivo_cancelacion: "única cancelación",
  },
];

const ticketPayments = [
  { id: 1, ticket_id: 101, forma_pago: "EFECTIVO", importe: "100.00" },
  { id: 2, ticket_id: 102, forma_pago: "EFECTIVO", importe: "0.00" },
  { id: 3, ticket_id: 103, forma_pago: "TRANSFERENCIA", importe: "50.00" },
];

const creditMovements = [
  { id: 1, ticket_id: 201, tipo: "VENTA_CREDITO", importe: "125.00" },
  { id: 2, ticket_id: 202, tipo: "VENTA_CREDITO", importe: "0.00" },
  { id: 3, ticket_id: 203, tipo: "VENTA_CREDITO", importe: "80.00" },
  { id: 4, ticket_id: 204, tipo: "VENTA_CREDITO", importe: "60.00" },
];

const locations = [
  { id: 1, nombre: "Main", tipo: "TIENDA", activa: true },
  { id: 2, nombre: "All cancelled", tipo: "TIENDA", activa: true },
  { id: 3, nombre: "Empty", tipo: "TIENDA", activa: true },
];

const outputs = [
  { id: 501, folio: 501, origen_id: 1, destino_id: 2, cliente_id: null, estado: "EN_TRANSITO", enviada_at: FROM, cancelada_at: null },
  { id: 502, folio: 502, origen_id: 1, destino_id: 2, cliente_id: null, estado: "EN_TRANSITO", enviada_at: TO, cancelada_at: null },
  { id: 503, folio: 503, origen_id: 1, destino_id: 2, cliente_id: null, estado: "EN_TRANSITO", enviada_at: AFTER, cancelada_at: null },
  { id: 504, folio: 504, origen_id: 2, destino_id: 1, cliente_id: null, estado: "EN_TRANSITO", enviada_at: MID, cancelada_at: null },
  { id: 601, folio: 601, origen_id: 1, destino_id: null, cliente_id: null, estado: "CANCELADA", enviada_at: null, cancelada_at: FROM },
  { id: 602, folio: 602, origen_id: 1, destino_id: null, cliente_id: null, estado: "CANCELADA", enviada_at: null, cancelada_at: TO },
  { id: 603, folio: 603, origen_id: 1, destino_id: null, cliente_id: null, estado: "CANCELADA", enviada_at: null, cancelada_at: AFTER },
  { id: 604, folio: 604, origen_id: 2, destino_id: null, cliente_id: null, estado: "CANCELADA", enviada_at: null, cancelada_at: MID },
];

const outputValues = [
  { salida_id: 501, rollo_id: 1, cantidad_enviada: "1.00" },
  { salida_id: 502, rollo_id: 2, cantidad_enviada: "1.00" },
  { salida_id: 503, rollo_id: 3, cantidad_enviada: "1.00" },
  { salida_id: 504, rollo_id: 4, cantidad_enviada: "1.00" },
  { salida_id: 601, rollo_id: 5, cantidad_enviada: "1.00" },
  { salida_id: 602, rollo_id: 6, cantidad_enviada: "1.00" },
  { salida_id: 603, rollo_id: 7, cantidad_enviada: "1.00" },
  { salida_id: 604, rollo_id: 8, cantidad_enviada: "1.00" },
];

const rolls = [
  { id: 1, producto_id: 1 }, { id: 2, producto_id: 2 },
  { id: 3, producto_id: 3 }, { id: 4, producto_id: 4 },
  { id: 5, producto_id: 5 }, { id: 6, producto_id: 6 },
  { id: 7, producto_id: 7 }, { id: 8, producto_id: 8 },
];

const products = [
  { id: 1, precio_sugerido: "300.00" },
  { id: 2, precio_sugerido: "0.00" },
  { id: 3, precio_sugerido: "50.00" },
  { id: 4, precio_sugerido: "40.00" },
  { id: 5, precio_sugerido: "75.00" },
  { id: 6, precio_sugerido: "0.00" },
  { id: 7, precio_sugerido: "25.00" },
  { id: 8, precio_sugerido: "100.00" },
];

function quoteJson(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function recordset(
  name: string,
  value: unknown,
  columns: string,
) {
  return `${name} AS (
    SELECT * FROM jsonb_to_recordset(${quoteJson(value)}) AS row(${columns})
  )`;
}

const readonlyFixtures = [
  recordset("ubicaciones", locations, "id integer,nombre text,tipo text,activa boolean"),
  recordset("tickets", tickets, [
    "id integer", "folio integer", "ubicacion_id integer", "cliente_id integer",
    "subtotal numeric", "iva numeric", "total numeric", "estado text",
    "cobrado boolean", "cobrado_at timestamptz", "usuario_terminal_id integer",
    "facturado boolean", "credito boolean", "dias_plazo integer",
    "fecha_vencimiento date", "documento_tipo text", "autorizacion_estado text",
    "autorizado_at timestamptz", "sesion_caja_id integer", "created_at timestamptz",
    "cancelado_at timestamptz", "cancelado_por integer", "motivo_cancelacion text",
  ].join(",")),
  recordset("ticket_pagos", ticketPayments, "id integer,ticket_id integer,forma_pago text,importe numeric"),
  recordset("movimientos_credito", creditMovements, "id integer,ticket_id integer,tipo text,importe numeric"),
  recordset("salidas", outputs, [
    "id integer", "folio integer", "origen_id integer", "destino_id integer",
    "cliente_id integer", "estado text", "enviada_at timestamptz",
    "cancelada_at timestamptz",
  ].join(",")),
  recordset("salida_rollos", outputValues, "salida_id integer,rollo_id integer,cantidad_enviada numeric"),
  recordset("rollos", rolls, "id integer,producto_id integer"),
  recordset("productos", products, "id integer,precio_sugerido numeric"),
  recordset("clientes", [], "id integer,nombre text"),
  recordset("usuarios", [], "id integer,nombre text"),
  recordset("ticket_lineas", [], "ticket_id integer,importe numeric,costo_total_congelado numeric"),
  recordset("sesiones_caja", [], "id integer,ubicacion_id integer,usuario_id integer,abierta_at timestamptz,estado text"),
].join(",\n");

function injectReadOnlyFixtures(query: string) {
  const trimmed = query.trimStart();
  if (/^with\b/i.test(trimmed)) {
    return trimmed.replace(/^with\b/i, `WITH ${readonlyFixtures},`);
  }
  return `WITH ${readonlyFixtures} ${trimmed}`;
}

function assertReadOnlyQuery(query: string) {
  assert.match(query, /^\s*(?:WITH|SELECT)\b/i, "analytics adapter only accepts SELECT statements");
  assert.doesNotMatch(
    query,
    /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|DROP|CREATE)\b/i,
    "analytics reconciliation must never execute a write",
  );
}

async function runWithReadOnlyFixtures(
  pool: { query: (query: string, values?: unknown[]) => Promise<unknown> },
  callback: () => Promise<void>,
) {
  const originalQuery = pool.query.bind(pool);
  pool.query = (async (query: string, values?: unknown[]) => {
    assertReadOnlyQuery(query);
    return originalQuery(injectReadOnlyFixtures(query), values);
  }) as typeof pool.query;
  try {
    await callback();
  } finally {
    pool.query = originalQuery;
  }
}

function sumDetailItems(items: Array<{ importe: string }>) {
  return items.reduce((sum, item) => sum + Number(item.importe), 0).toFixed(2);
}

type RealtimeDetailItem = {
  importe: string;
  id?: number;
  salidaId?: number;
  [key: string]: unknown;
};

type RealtimeDetailPage = {
  items: RealtimeDetailItem[];
  total: number;
  montoTotal: string;
};

async function allDetailPages(
  analytics: typeof import("./lib/admin-analytics"),
  filters: import("./lib/admin-analytics").AnalyticsFilters,
  concept: import("./lib/admin-analytics").RealtimeBreakdownConcept,
) {
  const pages = await Promise.all([
    analytics.listRealtimeBreakdown(filters, concept, 1, 2),
    analytics.listRealtimeBreakdown(filters, concept, 2, 2),
    analytics.listRealtimeBreakdown(filters, concept, 3, 2),
  ]) as unknown as RealtimeDetailPage[];
  const first = pages[0]!;
  const items = pages.flatMap((page) => page.items);
  assert.equal(items.length, first.total, `${concept} pagination loses or duplicates rows`);
  assert.equal(
    sumDetailItems(items),
    first.montoTotal,
    `${concept} detail pages do not reconcile to their aggregate amount`,
  );
  assert.equal(new Set(items.map((item) => "id" in item ? item.id : item.salidaId)).size, items.length);
  for (const item of items) {
    // VentasTotal and Utilidad deliberately have no realtime-detail meaning.
    // Do not invent a reconciliation against either financial-only field.
    assert.equal("ventasTotal" in item, false);
    assert.equal("utilidad" in item, false);
    assert.equal("margen" in item, false);
  }
  return { pages, items, total: first.total, amount: first.montoTotal };
}

const skipMessage =
  "requires the disposable PostgreSQL runner (TEST_DATABASE_URL not set)";

if (!testDatabaseUrl) {
  test(skipMessage, { skip: true }, () => {});
} else if (testDatabaseUrl === applicationDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL must differ from the application database.");
} else {
  test("six realtime cards reconcile with their actual paginated SQL details", async () => {
    const [{ pool }, analytics] = await Promise.all([
      import("@workspace/db"),
      import("./lib/admin-analytics"),
    ]);
    const typedPool = pool as unknown as {
      query: (query: string, values?: unknown[]) => Promise<unknown>;
    };
    const filters = {
      desde: new Date(FROM),
      hasta: new Date(TO),
    };
    const mainFilters = { ...filters, ubicacionId: 1 };
    const cancelledSiteFilters = { ...filters, ubicacionId: 2 };
    const emptySiteFilters = { ...filters, ubicacionId: 3 };

    try {
      await runWithReadOnlyFixtures(typedPool, async () => {
        const summary = await analytics.getSalesSummary(filters);
        const stores = await analytics.getRealtimeStores(filters);

        // Financial sales predicates remain independent of the cancellation
        // card: only processed Ticket/authorized Note documents are sales.
        assert.deepEqual(
          {
            ventas: summary.ventas,
            cobrado: summary.cobrado,
            pendiente: summary.pendiente,
            tickets: summary.tickets,
            ticketsCobrados: summary.ticketsCobrados,
            documentosPendientes: summary.documentosPendientes,
          },
          {
            ventas: "275.00",
            cobrado: "150.00",
             pendiente: "160.00",
            tickets: 5,
            ticketsCobrados: 3,
            documentosPendientes: 4,
          },
        );

        const collected = await allDetailPages(analytics, filters, "COBRADO");
        assert.deepEqual(
          { count: summary.ticketsCobrados, amount: summary.cobrado },
          { count: collected.total, amount: collected.amount },
        );
        assert.deepEqual(
          collected.items.map((item) => item.id),
          [102, 103, 101],
          "COBRADO must use cobro/processed dates, inclusive boundaries, not created_at",
        );
        assert.ok(collected.items.every((item) => item.importe !== "75.00"));

        const credit = await allDetailPages(analytics, filters, "CREDITO");
        const creditCard = stores.reduce(
          (total, store) => ({
            count: total.count + store.creditoOperaciones,
            amount: total.amount + Number(store.credito),
          }),
          { count: 0, amount: 0 },
        );
        assert.deepEqual(
          creditCard,
          { count: credit.total, amount: Number(credit.amount) },
          "CREDITO card and detail must use the same authorized ledger documents",
        );
        assert.deepEqual(
          credit.items.map((item) => item.id),
          [202, 201],
          "credit authorization date is the financial date basis",
        );
        assert.equal(new Set(credit.items.map((item) => item.id)).size, credit.total);
        assert.equal(credit.amount, "125.00");
        assert.ok(!credit.items.some((item) => item.id === 203), "authorization outside range leaked");

        const pending = await allDetailPages(analytics, filters, "PENDIENTE");
        assert.deepEqual(
          { count: summary.documentosPendientes, amount: summary.pendiente },
          { count: pending.total, amount: pending.amount },
        );
        assert.deepEqual(
          pending.items.map((item) => item.id),
          [302, 303, 204, 301],
          "PENDIENTE must use created_at and retain unauthorized Notes",
        );
        assert.ok(!pending.items.some((item) => item.id === 304));
        assert.ok(!pending.items.some((item) => item.id === 401));

        const cancelled = await allDetailPages(analytics, filters, "CANCELADAS");
        assert.deepEqual(
          { count: summary.cancelaciones, amount: summary.importeCancelaciones },
          { count: cancelled.total, amount: cancelled.amount },
          "CANCELADAS card and detail must use cancelado_at, including uncobrado rows",
        );
        assert.deepEqual(
          cancelled.items.map((item) => item.id),
          [402, 405, 404, 401],
        );
        assert.ok(cancelled.items.some((item) => item.id === 401));
        assert.ok(!cancelled.items.some((item) => item.id === 403));
        assert.equal(summary.cancelaciones, 4);
        assert.equal(summary.importeCancelaciones, "240.00");
        assert.deepEqual(
          analytics.summarizeRealtimeCancellations(summary),
          {
            tickets: cancelled.total,
            importe: cancelled.amount,
            tasaCancelacion: "44.44",
            excedeUmbral: true,
          },
        );

        const transit = await allDetailPages(analytics, filters, "SALIDAS_EN_TRANSITO");
        const cancelledOutputs = await allDetailPages(analytics, filters, "SALIDAS_CANCELADAS");
        const salidaCards = await analytics.getRealtimeSalidaSummaries(filters);
        // Salida cards expose document counts only, not a financial valuation.
        // Their details still retain and reconcile amounts across all pages.
        assert.equal(salidaCards.salidasEnTransito.conteo, transit.total);
        assert.equal(salidaCards.salidasCanceladas.conteo, cancelledOutputs.total);
        assert.equal(transit.amount, "340.00");
        assert.equal(cancelledOutputs.amount, "175.00");

        // Site scope is applied identically to every card/detail pair.
        const siteCases: Array<{
          filters: typeof mainFilters;
          concept: import("./lib/admin-analytics").RealtimeBreakdownConcept;
          count: number;
          amount: string;
        }> = [
          { filters: mainFilters, concept: "COBRADO", count: 3, amount: "150.00" },
          { filters: mainFilters, concept: "CREDITO", count: 2, amount: "125.00" },
           { filters: mainFilters, concept: "PENDIENTE", count: 4, amount: "160.00" },
          { filters: mainFilters, concept: "CANCELADAS", count: 3, amount: "230.00" },
          { filters: mainFilters, concept: "SALIDAS_EN_TRANSITO", count: 2, amount: "300.00" },
          { filters: mainFilters, concept: "SALIDAS_CANCELADAS", count: 2, amount: "75.00" },
          { filters: cancelledSiteFilters, concept: "CANCELADAS", count: 1, amount: "10.00" },
          { filters: emptySiteFilters, concept: "CANCELADAS", count: 0, amount: "0.00" },
        ];
        for (const siteCase of siteCases) {
          const detail = await allDetailPages(analytics, siteCase.filters, siteCase.concept);
          assert.deepEqual(
            { count: detail.total, amount: detail.amount },
            { count: siteCase.count, amount: siteCase.amount },
            `${siteCase.concept} site-filter mismatch`,
          );
        }

        const mainSummary = await analytics.getSalesSummary(mainFilters);
        const mainStores = await analytics.getRealtimeStores(mainFilters);
        const mainSalidaCards = await analytics.getRealtimeSalidaSummaries(mainFilters);
        const mainCreditStore = mainStores.find((store) => store.ubicacionId === 1)!;
        assert.deepEqual(
          {
            count: mainSummary.ticketsCobrados,
            amount: mainSummary.cobrado,
          },
          { count: 3, amount: "150.00" },
        );
        assert.deepEqual(
          {
            count: mainCreditStore.creditoOperaciones,
            amount: mainCreditStore.credito,
          },
          { count: 2, amount: "125.00" },
        );
        assert.deepEqual(
          {
            count: mainSummary.documentosPendientes,
            amount: mainSummary.pendiente,
          },
          { count: 4, amount: "160.00" },
        );
        assert.deepEqual(
          {
            count: mainSummary.cancelaciones,
            amount: mainSummary.importeCancelaciones,
          },
          { count: 3, amount: "230.00" },
        );
        assert.equal(mainSalidaCards.salidasEnTransito.conteo, 2);
        assert.equal(mainSalidaCards.salidasCanceladas.conteo, 2);

        const mainStore = stores.find((store) => store.ubicacionId === 1)!;
        const cancelledOnlyStore = stores.find((store) => store.ubicacionId === 2)!;
        const emptyStore = stores.find((store) => store.ubicacionId === 3)!;
        assert.equal(mainStore.cancelaciones, 3);
        assert.equal(cancelledOnlyStore.cancelaciones, 1);
        assert.equal(cancelledOnlyStore.tasaCancelacion, "100.00");
        assert.equal(emptyStore.cancelaciones, 0);
        assert.equal(emptyStore.tasaCancelacion, "0.00");

        const mainCancelled = await analytics.listRealtimeBreakdown(
          mainFilters,
          "CANCELADAS",
          1,
          50,
        );
        assert.equal(mainCancelled.total, cancelledOnlyStore.cancelaciones + 2);
        assert.equal(mainCancelled.montoTotal, "230.00");
      });
    } finally {
      await pool.end();
    }
  });
}