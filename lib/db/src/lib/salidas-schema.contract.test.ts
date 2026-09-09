import assert from "node:assert/strict";
import test from "node:test";
import { ensureSalidasSchema } from "./salidas-schema";

test("salidas startup schema includes venta, delivery and ticket linkage", async () => {
  const statements: string[] = [];
  const client = {
    query: async (text: string) => {
      statements.push(text);
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client };

  await ensureSalidasSchema(pool as never);
  const ddl = statements.join("\n");

  assert.match(ddl, /'VENTA_CLIENTE'/);
  assert.match(ddl, /'ENTREGADA'/);
  assert.match(ddl, /ARRAY\['ARMANDO', 'EN_TRANSITO', 'RECIBIDA', 'ENTREGADA', 'CANCELADA'\]/);
  assert.match(ddl, /estado::text = 'ENTREGADA' THEN 'ENTREGADA'/);
  assert.match(ddl, /cliente_id integer REFERENCES clientes\(id\)/);
  assert.match(ddl, /ticket_id integer REFERENCES tickets\(id\)/);
  assert.match(ddl, /usuario_entrega_id integer REFERENCES usuarios\(id\)/);
  assert.match(ddl, /entregada_at timestamptz/);
  assert.match(ddl, /salidas_cliente_estado_idx/);
  assert.match(ddl, /salidas_ticket_idx/);
  assert.doesNotMatch(ddl, /DELETE FROM salidas/i);
  assert.equal(statements.at(0), "BEGIN");
  assert.equal(statements.at(-1), "COMMIT");
});