import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectCreditLedger } from "./lib/credit-allocation";

const root = new URL("../../../", import.meta.url);

test("estado de cuenta projects current balances while retaining raw running history", async () => {
  const [spec, route] = await Promise.all([
    readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"),
    readFile(new URL("artifacts/api-server/src/routes/clientes.ts", root), "utf8"),
  ]);

  assert.match(
    spec,
    /ClienteMovimiento:[\s\S]*?saldoPendiente: \{ type: \["string", "null"\] \}/,
  );
  assert.match(
    route,
    /loadCustomerCreditProjection\(id\)/,
  );
  assert.match(
    route,
    /projectedCharges = new Map\(balance\.allCharges/,
  );
  assert.match(
    route,
    /saldoPendiente:[\s\S]*?projectedCharges\.get/,
  );
  assert.match(
    route,
    /SUM\(m\.importe\) OVER \(ORDER BY m\.created_at,m\.id\) AS saldo_corrido/,
  );
  assert.match(route, /m\.ticket_id/);
  assert.match(route, /ticket_id AS "ticketId"/);
  assert.match(route, /Saldo corrido histórico/);
  assert.match(route, /saldo actual proyectado/);
});

test("overpayment export distinguishes historical running balance from current outstanding", async () => {
  const route = await readFile(
    new URL("artifacts/api-server/src/routes/clientes.ts", root),
    "utf8",
  );
  const projection = projectCreditLedger([
    {
      id: 1,
      ticketId: null,
      tipo: "ABONO",
      importe: "-50.00",
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
    },
  ]);

  assert.equal(projection.balanceCents, 0);
  assert.equal(projection.overpaymentCents, 5_000);
  assert.match(route, /SALDO ACTUAL PROYECTADO/);
  assert.match(route, /saldoCorridoHistorico/);
  assert.match(
    route,
    /saldo actual proyectado \$\{formatNumber\(centsToMoney\(projection\.balanceCents\)/,
  );
  assert.match(
    route,
    /saldo corrido histórico \$\{formatNumber\(row\.saldoCorridoHistorico/,
  );
});

test("POS sale capability receives only minimal credit availability", async () => {
  const [clientesRoute, posRoute, spec] = await Promise.all([
    readFile(new URL("artifacts/api-server/src/routes/clientes.ts", root), "utf8"),
    readFile(new URL("artifacts/api-server/src/routes/pos.ts", root), "utf8"),
    readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"),
  ]);

  const detailedRoute = clientesRoute.match(
    /router\.get\(\s*"\/clientes\/:id\/credito",[\s\S]*?\n\);/,
  )?.[0] ?? "";
  assert.match(detailedRoute, /requierePermiso\("clientes_credito", "ver"\)/);
  assert.doesNotMatch(detailedRoute, /requierePermiso\("pos", "ver"\)|resolvePermiso/);

  const minimalRoute = posRoute.match(
    /router\.get\(\s*"\/pos\/clientes\/:clienteId\/credito-disponible",[\s\S]*?\n\);/,
  )?.[0] ?? "";
  assert.match(minimalRoute, /requierePermiso\("pos", "crear"\)/);
  assert.doesNotMatch(minimalRoute, /requierePermiso\("pos", "ver"\)/);
  assert.match(minimalRoute, /scopedLocation/);
  assert.match(minimalRoute, /assertOperationalLocation/);

  const minimalSchema = spec.match(
    /PosClienteCreditoDisponible:[\s\S]*?(?=\n    [A-Z][A-Za-z]+:)/,
  )?.[0] ?? "";
  assert.match(minimalSchema, /limiteCredito/);
  assert.match(minimalSchema, /saldoComprometido/);
  assert.match(minimalSchema, /creditoDisponible/);
  assert.doesNotMatch(
    minimalSchema,
    /totalVencido|primerVencimiento|fechaVencimiento|primeraCompra|ultimaActividad|antiguedad/,
  );
});