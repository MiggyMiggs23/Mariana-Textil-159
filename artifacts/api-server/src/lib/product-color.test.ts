import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CreateProductoBody, UpdateProductoBody } from "@workspace/api-zod";
import {
  canEditProductColorHex,
  normalizeProductColorHex,
} from "./product-color";

test("product color hex contract validates set and clear values", () => {
  assert.equal(UpdateProductoBody.safeParse({ colorHex: "#a1b2c3" }).success, true);
  assert.equal(UpdateProductoBody.safeParse({ colorHex: null }).success, true);
  assert.equal(UpdateProductoBody.safeParse({ colorHex: "a1b2c3" }).success, false);
  assert.equal(UpdateProductoBody.safeParse({ colorHex: "#GG0000" }).success, false);
  assert.equal(CreateProductoBody.safeParse({
    tela: "Lino",
    color: "Azul",
    unidad: "METRO",
    precioSugerido: "10.00",
    colorHex: "#123456",
  }).success, true);
});

test("product color hex is normalized to canonical uppercase and can be cleared", () => {
  assert.equal(normalizeProductColorHex("#a1b2c3"), "#A1B2C3");
  assert.equal(normalizeProductColorHex(null), null);
  assert.throws(() => normalizeProductColorHex("#abcd"));
});

test("only ADMIN can edit the manually captured product color", () => {
  assert.equal(canEditProductColorHex("ADMIN"), true);
  assert.equal(canEditProductColorHex("SUPERVISOR"), false);
  assert.equal(canEditProductColorHex("CAJA"), false);
});

test("product color hex stays separate, ADMIN-only, and report-backed", async () => {
  const [route, report] = await Promise.all([
    readFile(new URL("../routes/productos.ts", import.meta.url), "utf8"),
    readFile(new URL("./reportes-inventory.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /"colorHex" in parsed\.data && !canEditProductColorHex/);
  assert.match(route, /"colorHex" in body\.data && !canEditProductColorHex/);
  assert.match(route, /colorHex: row\.colorHex/);
  assert.match(report, /p\.color_hex/);
  assert.match(report, /colorHex: r\.color_hex/);
  assert.doesNotMatch(route, /generateSku\([^)]*colorHex/);
});