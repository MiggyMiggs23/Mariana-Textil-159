import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function sources() {
  const [spec, route, ledgerSchema] = await Promise.all([
    readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"),
    readFile(new URL("artifacts/api-server/src/routes/clientes.ts", root), "utf8"),
    readFile(new URL("lib/db/src/schema/pos.ts", root), "utf8"),
  ]);
  return { spec, route, ledgerSchema };
}

test("contrato de notas de crédito deriva los tres estados sin persistirlos", async () => {
  const { spec, route, ledgerSchema } = await sources();

  assert.match(
    spec,
    /ClienteNotaCreditoDetalle:[\s\S]*?estado: \{ type: string, enum: \[PENDIENTE, PARCIAL, PAGADA\] \}/,
  );
  assert.match(
    route,
    /function moneyState[\s\S]*?balanceCents === 0\) return "PAGADA"[\s\S]*?balanceCents < originalCents \? "PARCIAL"[\s\S]*?: "PENDIENTE"/,
  );
  const movementDefinition = ledgerSchema.slice(
    ledgerSchema.indexOf('export const movimientosCreditoTable'),
    ledgerSchema.indexOf('export type InsertMovimientoCredito'),
  );
  assert.doesNotMatch(movementDefinition, /\bestado\s*:/);
});

test("consultas de detalle usan aplicaciones_credito en ambas direcciones", async () => {
  const { route } = await sources();

  assert.match(
    route,
    /FROM aplicaciones_credito a[\s\S]*?WHERE a\.venta_movimiento_id=\$1/,
  );
  assert.match(
    route,
    /FROM aplicaciones_credito a[\s\S]*?WHERE a\.abono_movimiento_id=\$1 AND sale\.cliente_id=\$2/,
  );
});

test("antigüedad toma fecha_vencimiento en calendario America/Mexico_City", async () => {
  const { route } = await sources();

  assert.match(
    route,
    /function creditDueDays[\s\S]*?timeZone: "America\/Mexico_City"[\s\S]*?Math\.max\(0, Math\.floor\(difference \/ 86_400_000\)\)/,
  );
  assert.match(route, /m\.fecha_vencimiento AS "fechaVencimiento"/);
});

test("reimpresión audita antes de responder y no actualiza el ledger", async () => {
  const { route } = await sources();
  const start = route.indexOf('"/clientes/:id/notas/:ticketId/reimprimir"');
  const end = route.indexOf('// ── POST /clientes/:id/pagos', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = route.slice(start, end);

  assert.match(handler, /accion: "REIMPRIMIR_NOTA_CREDITO"/);
  assert.match(handler, /entidad: "tickets"/);
  assert.match(handler, /sitioId: Number\(ticket\.sitioId\)/);
  assert.ok(
    handler.indexOf("await db.insert(auditoriaTable)") <
      handler.indexOf("res.status(201).json"),
    "la auditoría debe persistirse antes de contestar",
  );
  assert.doesNotMatch(handler, /\.update\(|UPDATE\s+movimientos_credito/i);
});