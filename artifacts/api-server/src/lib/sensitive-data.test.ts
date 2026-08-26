import assert from "node:assert/strict";
import {
  isSupervisorSensitiveKey,
  omitSupervisorSensitiveFields,
  omitTerminalSensitiveFields,
} from "./sensitive-data";

const payload = {
  costoUnitario: "10.00",
  costo_total: "20.00",
  costo_unitario_congelado: "10.00",
  costo_total_congelado: "20.00",
  totalCosto: "20.00",
  margen: "5.00",
  margenBruto: "5.00",
  utilidad: "3.00",
  utilidad_neta: "3.00",
  nested: [{ costo_unitario: "10.00", visible: true }],
  visible: "ok",
};

const terminal = omitTerminalSensitiveFields(payload, true) as Record<string, unknown>;
for (const key of [
  "costoUnitario",
  "costo_total",
  "costo_unitario_congelado",
  "costo_total_congelado",
  "totalCosto",
  "margen",
  "margenBruto",
  "utilidad",
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

const supervisorPayload = {
  precioSugerido: "99.00",
  limiteCredito: "1000.00",
  diasCredito: 30,
  pagos: [{ importe: "20.00", formaPago: "EFECTIVO" }],
  documentoIneUrl: "secret",
  saldoPosterior: "12.500",
  documentoTipo: "SALIDA",
  totalRollos: 2,
  nested: { costoPorUnidad: "5.00", cantidad: "12.500" },
};
assert.deepEqual(omitSupervisorSensitiveFields(supervisorPayload, true), {
  saldoPosterior: "12.500",
  documentoTipo: "SALIDA",
  totalRollos: 2,
  nested: { cantidad: "12.500" },
});
assert.equal(isSupervisorSensitiveKey("precio_negociado"), true);
assert.equal(isSupervisorSensitiveKey("saldoPosterior"), false);
assert.strictEqual(
  omitSupervisorSensitiveFields(supervisorPayload, false),
  supervisorPayload,
);