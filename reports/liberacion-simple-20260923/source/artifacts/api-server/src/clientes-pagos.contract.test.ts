import assert from "node:assert/strict";
import test from "node:test";
import { paymentContracts, captureGuard } from "./tarea3-behavior-harness.mjs";
import { readFile } from "node:fs/promises";

test("contrato de abono exige cuentaDestino y preview comparte fecha efectiva", () => {
  const { CreateClientePagoBody, PreviewClientePagoBody } = paymentContracts();
  const incomplete = CreateClientePagoBody.safeParse({
    importe: 125, formaPago: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
  });
  assert.equal(incomplete.success, false);
  assert.deepEqual(incomplete.error.issues.map((issue: { path: PropertyKey[] }) => issue.path.join(".")).sort(),
    ["naturaleza", "operacionClave", "sitioOrigenId"]);
  const evidence = {
    sitioOrigenId: 1, naturaleza: "INGRESO_FISICO",
    operacionClave: "11111111-1111-4111-8111-111111111111", sesionCajaId: 1,
  };
  assert.equal(
    CreateClientePagoBody.safeParse({
      ...evidence,
      importe: 125,
      formaPago: "EFECTIVO",
      cuentaDestino: "CAJA_FISICA",
    }).success,
    true,
  );
  assert.equal(
    CreateClientePagoBody.safeParse({ ...evidence, importe: 125, formaPago: "EFECTIVO" }).success,
    false,
  );
  assert.equal(
    PreviewClientePagoBody.safeParse({
      importe: 125,
      fechaEfectiva: "2026-01-03T12:00:00.000Z",
    }).success,
    true,
  );
  const guard = captureGuard();
  const parsedEvidence = guard.readCreditEvidenceInput(evidence);
  assert.doesNotThrow(() => guard.assertCreditPhysicalContext(parsedEvidence, "EFECTIVO", "CAJA_FISICA"));
  assert.throws(
    () => guard.assertCreditCaptureEnabled(parsedEvidence, "EFECTIVO", "ABONO_ORDINARIO", "ABONO"),
    (error: any) => error instanceof guard.CreditEvidenceError
      && error.status === 403 && /captura de ingreso nuevo de efectivo.*deshabilitada/.test(error.message),
  );
  const transfer = { ...parsedEvidence, sesionCajaId: null };
  assert.doesNotThrow(() => guard.assertCreditPhysicalContext(transfer, "TRANSFERENCIA", "CUENTA_FISCAL"));
  assert.doesNotThrow(() => guard.assertCreditCaptureEnabled(transfer, "TRANSFERENCIA", "ABONO_ORDINARIO", "ABONO"));
});

test("estado de cuenta proyecta cuentaDestino desde el CTE del ledger", async () => {
  const routes = await readFile(new URL("./routes/clientes.ts", import.meta.url), "utf8");
  assert.match(
    routes,
    /WITH ledger AS \([\s\S]*m\.forma_pago, m\.cuenta_destino,[\s\S]*cuenta_destino AS "cuentaDestino"/,
  );
});