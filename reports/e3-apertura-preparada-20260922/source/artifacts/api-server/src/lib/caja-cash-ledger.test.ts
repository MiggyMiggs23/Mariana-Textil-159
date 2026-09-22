import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateCash, cashCents, cashMoney, creditCashDocuments, resolveSessionCash, validateCashSnapshot,
  type CashDocument, type CreditCashMovement, type RetainedCashReceipt,
} from "./caja-cash-ledger";

// Pure only: this dependency graph contains no DB, pool, app or initializer.
const doc = (origen: CashDocument["origen"], id: string, importe: string): CashDocument =>
  ({ origen, id, importe, folio: null, href: null });
const movement: CreditCashMovement = {
  id: 3, clienteId: 4, sesionCajaId: 1, naturaleza: "INGRESO_FISICO", formaPago: "EFECTIVO",
  cuentaDestino: "CAJA_FISICA", tipo: "ABONO", importe: "-10.03", operacionProductor: "ABONO_ORDINARIO", operacionClave: "receipt-a",
};
const retained: RetainedCashReceipt = {
  sesionCajaId: 1, naturaleza: "INGRESO_FISICO", medio: "EFECTIVO", cuentaDestino: "CAJA_FISICA",
  operacionProductor: "COBRO_PENDIENTE", operacionClave: "receipt-b", importe: "12.01",
};
const documents = [doc("FONDO_INICIAL", "1", "100.01"), doc("TICKET", "2", "20.02"),
  ...creditCashDocuments(1, [movement], [retained]), doc("SALIDA", "5", "3.04")];
const snapshot = () => ({ version: "E2", sesionId: 1, efectivoContado: "140.00", diferencia: "0.97", efectivoDesglose: calculateCash(documents) });

test("E2 sums five disjoint buckets with exact cents, including large values", () => {
  const result = calculateCash(documents);
  assert.deepEqual([result.fondoInicial, result.cobrosTickets, result.abonosFisicos, result.cobrosRetenidos, result.salidasFisicas, result.efectivoEsperado],
    ["100.01", "20.02", "10.03", "12.01", "3.04", "139.03"]);
  assert.equal(cashMoney(cashCents("9007199254740993.01") + cashCents("0.09")), "9007199254740993.10");
  assert.equal(cashMoney(cashCents("-0.01")), "-0.01");
});

test("E2 rejects duplicate physical identity across retained and abono, never amount-dedupes", () => {
  assert.throws(() => calculateCash([doc("ABONO", "same-receipt", "10"), doc("COBRO_RETENIDO", "same-receipt", "10")]), /duplicado/);
  assert.throws(() => calculateCash([doc("SALIDA", "1", "10"), doc("SALIDA", "1", "10")]), /duplicado/);
  assert.equal(calculateCash([doc("ABONO", "one", "10"), doc("ABONO", "two", "10")]).abonosFisicos, "20.00");
});

test("E2 excludes transfers, accounting corrections, other sessions and reversal evidence", () => {
  const excluded = [
    { ...movement, formaPago: "TRANSFERENCIA" }, { ...movement, naturaleza: "CORRECCION_CONTABLE" },
    { ...movement, naturaleza: null }, { ...movement, sesionCajaId: 2 },
    { ...movement, cuentaDestino: "CUENTA_FISCAL" },
    { ...movement, naturaleza: "DEVOLUCION_FISICA", tipo: "REVERSO", importe: "10.03" },
  ];
  assert.deepEqual(creditCashDocuments(1, excluded, [{ ...retained, sesionCajaId: 2 }, { ...retained, medio: "TRANSFERENCIA" }]), []);
  assert.equal(calculateCash([...creditCashDocuments(1, [movement, ...excluded], []), doc("SALIDA", "refund", "10.03")]).efectivoEsperado, "0.00");
});

test("E2 reads a receipt once regardless of attached notes/applications", () => {
  // Neither noteId nor allocation rows are inputs to creditCashDocuments.
  const multiNote = { ...movement, applications: [{ notaId: 1 }, { notaId: 2 }, { notaId: 3 }] };
  assert.equal(calculateCash(creditCashDocuments(1, [multiNote], [])).abonosFisicos, "10.03");
  assert.throws(() => calculateCash(creditCashDocuments(1, [multiNote, multiNote], [])), /duplicado/);
});

test("E2 fails closed for unsupported pending conversion or missing immutable identity", () => {
  for (const m of [
    { ...movement, operacionProductor: "COBRO_PENDIENTE" },
    { ...movement, operacionProductor: "CONVERSION_PENDIENTE" },
    { ...movement, operacionClave: null }, { ...movement, importe: "10.03" },
  ]) assert.throws(() => creditCashDocuments(1, [m], [retained]), /E2/);
  assert.throws(() => creditCashDocuments(1, [], [{ ...retained, operacionProductor: "UNKNOWN" }]), /identidad/);
});

test("E2 rejects fractional, nonfinite and malformed physical amounts", () => {
  for (const value of ["1.001", "NaN", "Infinity", "1e2", "", " 1", "+1"])
    assert.throws(() => cashCents(value), /inválido/);
  assert.throws(() => calculateCash([doc("TICKET", "x", "-1")]), /inválido/);
});

test("E2 closed legacy keeps exact per-surface values and never reads current receipts", async () => {
  let liveCalls = 0;
  const live = async () => { liveCalls++; return calculateCash(documents); };
  const session = { id: 1, estado: "CERRADA", efectivoContado: "140.00" };
  const detail = { efectivoEsperado: "116.99", diferencia: "23.01" };
  const admin = { efectivoEsperado: "120.03", diferencia: "19.97" };
  assert.deepEqual(await resolveSessionCash(session, [], detail, live), detail);
  assert.deepEqual(await resolveSessionCash(session, [], admin, live), admin);
  assert.equal(liveCalls, 0);
});

test("E2 closed valid snapshot is immutable even if live session values differ", async () => {
  const frozen = { ...snapshot(), diferencia: "0.97" };
  let liveCalls = 0;
  const result = await resolveSessionCash({ id: 1, estado: "CERRADA", efectivoContado: "999" }, [frozen],
    { efectivoEsperado: "1", diferencia: "998" }, async () => { liveCalls++; return calculateCash([]); });
  assert.equal(result.efectivoEsperado, "139.03");
  assert.equal(result.diferencia, "0.97");
  assert.deepEqual(result.efectivoDesglose?.documentos, documents);
  assert.equal(liveCalls, 0);
});

test("E2 corrupt snapshots fail explicitly and never fall back to legacy or live", async () => {
  const valid = { ...snapshot(), diferencia: "0.97" };
  for (const corrupted of [
    null, {}, { ...valid, version: "E3" }, { ...valid, sesionId: 2 },
    { ...valid, diferencia: "0" }, { ...valid, efectivoContado: null },
    { ...valid, efectivoDesglose: { ...valid.efectivoDesglose, efectivoEsperado: "100" } },
    { ...valid, efectivoDesglose: { ...valid.efectivoDesglose, documentos: [] } },
  ]) {
    await assert.rejects(resolveSessionCash({ id: 1, estado: "CERRADA", efectivoContado: "140" }, [corrupted],
      { efectivoEsperado: "1", diferencia: "1" }, async () => { throw new Error("LIVE CALLED"); }), /snapshot/);
  }
  await assert.rejects(resolveSessionCash({ id: 1, estado: "CERRADA", efectivoContado: "140" }, [valid, valid],
    { efectivoEsperado: "1", diferencia: "1" }, async () => calculateCash([])), /duplicados/);
  assert.equal(validateCashSnapshot(valid, 1).efectivoDesglose.version, "E2");
});

test("E2 open sessions use canonical cash, not legacy or stale snapshot", async () => {
  let calls = 0;
  const result = await resolveSessionCash({ id: 1, estado: "ABIERTA", efectivoContado: null }, [null],
    { efectivoEsperado: "0", diferencia: "0" }, async () => { calls++; return calculateCash(documents); });
  assert.equal(result.efectivoEsperado, "139.03");
  assert.equal(result.diferencia, null);
  assert.equal(calls, 1);
});