import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { FondoError, canonicalPayload, formatMoney, movementDto, parseMoney } from "./fondo";
import { createFondoRouter, enforceFondoAdmin, neutralizeFondoCsvText } from "../routes/fondo";

test("money conversion is exact beyond Number safe integer range", () => {
  const value = "9007199254740993.07";
  assert.equal(formatMoney(parseMoney(value)), value);
  assert.equal(formatMoney(-parseMoney("1.05")), "-1.05");
  assert.equal(formatMoney(0n), "0.00");
});

test("money parser rejects noncanonical and floating representations", () => {
  for (const value of ["1", "1.2", "01.00", "+1.00", "-1.00", "1e2", " 1.00", "NaN", "92233720368547758.08"]) {
    assert.throws(() => parseMoney(value), (error) =>
      error instanceof FondoError && error.status === 400 && error.code === "VALIDATION_ERROR");
  }
});

test("canonical idempotency payload ignores object insertion order but not content", () => {
  assert.equal(
    canonicalPayload({ motivo: "capital", nested: { b: true, a: "1.00" } }),
    canonicalPayload({ nested: { a: "1.00", b: true }, motivo: "capital" }),
  );
  assert.notEqual(canonicalPayload({ importe: "1.00" }), canonicalPayload({ importe: "1.01" }));
});

test("initial reconciliation evidence remains reachable in movement detail", () => {
  const proof = { efectivoFisicoContado: "0.00", declaracionSinDuplicacion: true as const, evidencia: "Conteo físico y revisión de caja/entregas" };
  const detail = movementDto({
    id: "00000000-0000-0000-0000-000000000001", ordinal: "1",
    fondo_id: "00000000-0000-0000-0000-000000000002", naturaleza: "INGRESO",
    categoria: "SALDO_INICIAL", importe_centavos: "0", motivo: "saldo inicial",
    autor_id: 1, autor_nombre: "ADMIN", original_id: null, inverso_id: null,
    created_at: "2026-09-18T00:00:00.000Z", conciliacion_inicial: proof,
  });
  assert.deepEqual(detail.conciliacionInicial, proof);
});

test("CSV neutralizes user text formulas but never changes canonical money helpers", () => {
  for (const value of ["=1+1", " +SUM(A1)", "\t-CMD", "\u0000@evil"]) {
    assert.equal(neutralizeFondoCsvText(value), `'${value}`);
  }
  assert.equal(neutralizeFondoCsvText("motivo normal"), "motivo normal");
  assert.equal(formatMoney(-105n), "-1.05");
});

test("router owns a non-optional exact ADMIN guard before data access", () => {
  let status = 0;
  let payload: unknown;
  let nextCalls = 0;
  const req = { auth: { user: { rol: "SUPERVISOR" } } } as unknown as Request;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { payload = value; return this; },
  } as unknown as Response;
  enforceFondoAdmin(req, res, (() => { nextCalls += 1; }) as NextFunction);
  assert.equal(status, 403);
  assert.deepEqual(payload, { error: "No tienes permisos para esta operación." });
  assert.equal(nextCalls, 0);

  const router = createFondoRouter({
    db: { query: async () => ({ rows: [] }), connect: async () => { throw new Error("must not connect"); } },
    authorizeAdmin: [],
    enabled: () => true,
  });
  const stack = (router as unknown as { stack: Array<{ handle: unknown }> }).stack;
  assert.equal(stack.some((layer) => layer.handle === enforceFondoAdmin), true);
});