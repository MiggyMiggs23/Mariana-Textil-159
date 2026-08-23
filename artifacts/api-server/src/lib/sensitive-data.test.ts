import assert from "node:assert/strict";
import { omitTerminalSensitiveFields } from "./sensitive-data";

const payload = {
  costoUnitario: "10.00",
  costo_total: "20.00",
  totalCosto: "20.00",
  margenBruto: "5.00",
  utilidad_neta: "3.00",
  nested: [{ costo_unitario: "10.00", visible: true }],
  visible: "ok",
};

const terminal = omitTerminalSensitiveFields(payload, true) as Record<string, unknown>;
for (const key of [
  "costoUnitario",
  "costo_total",
  "totalCosto",
  "margenBruto",
  "utilidad_neta",
]) {
  assert.ok(!(key in terminal), `TERMINAL payload must omit ${key}`);
}
assert.deepEqual(terminal.nested, [{ visible: true }]);
assert.equal(terminal.visible, "ok");

assert.strictEqual(
  omitTerminalSensitiveFields(payload, false),
  payload,
  "non-TERMINAL payload must be unchanged",
);