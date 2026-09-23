import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUsername } from "./auth-identifiers";

test("normalizes case and surrounding whitespace", () => {
  assert.equal(normalizeUsername("  Admin  "), "admin");
});

test("removes invisible direction and zero-width marks", () => {
  assert.equal(normalizeUsername("\u200Fprueba.caja"), "prueba.caja");
  assert.equal(normalizeUsername("prueba.\u200Bterminal"), "prueba.terminal");
  assert.equal(normalizeUsername("\u2066prueba.bodega\u2069"), "prueba.bodega");
});

test("normalizes compatibility forms", () => {
  assert.equal(normalizeUsername("ＡＤＭＩＮ"), "admin");
});