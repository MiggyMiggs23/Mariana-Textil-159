/**
 * SKU utility tests - run with: node lib/db/src/lib/sku.test.mjs
 * No external test framework required.
 */

import assert from "node:assert/strict";

// ── Inline implementation (mirrors sku.ts) ──────────────────────────────────
function normalize(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function telaPrefix(tela) {
  const words = tela.trim().split(/\s+/).slice(0, 3);
  const parts = words.map((word) => {
    const clean = normalize(word);
    if (clean.length === 0) return "";
    // Pure numeric token → preserve fully
    if (/^\d+$/.test(clean)) return clean;
    // All other tokens → first 3 chars
    return clean.slice(0, 3);
  });
  return parts.join("").slice(0, 12);
}

function colorPrefix(color) {
  const words = color.trim().split(/\s+/);
  const clean = normalize(words[0] ?? "");
  return clean.slice(0, 3);
}

function generateBaseSku(tela, color) {
  const tp = telaPrefix(tela);
  const cp = colorPrefix(color);
  return `${tp}-${cp}`;
}

function generateSku(tela, color, existingSkus) {
  const base = generateBaseSku(tela, color);
  if (!existingSkus.has(base)) return base;
  let counter = 2;
  while (true) {
    const candidate = `${base}${counter}`;
    if (!existingSkus.has(candidate)) return candidate;
    counter++;
  }
}

// ── Test cases ───────────────────────────────────────────────────────────────
const cases = [
  ["Tafeta", "Rojo", "TAF-ROJ"],
  ["Tafeta", "Azul Rey", "TAF-AZU"],
  ["Gabardina Metepec", "Base", "GABMET-BAS"],
  ["Gabardina Ripstop", "Base", "GABRIP-BAS"],
  ["Franela Cilo Baby", "Blanco", "FRACILBAB-BLA"],
  ["Franela 50", "Base", "FRA50-BAS"],
  ["Loneta Economica Cruda", "Base", "LONECOCRU-BAS"],
  ["Mezclilla 4 oz", "Base", "MEZ4OZ-BAS"],
  ["Tul 15", "Base", "TUL15-BAS"],
  ["Forro Cartera 60gms", "Base", "FORCAR60G-BAS"],
  ["Manta Cresponada Blanca Cruda", "Base", "MANCREBLA-BAS"],
  ["SMS Cubrebocas", "Base", "SMSCUB-BAS"],
];

let passed = 0;
let failed = 0;

for (const [tela, color, expected] of cases) {
  const result = generateBaseSku(tela, color);
  if (result === expected) {
    console.log(`  ✓  ${tela} / ${color}  →  ${result}`);
    passed++;
  } else {
    console.error(`  ✗  ${tela} / ${color}  →  got "${result}", expected "${expected}"`);
    failed++;
  }
}

// Collision test
console.log("\n── Collision tests ──");
const existing = new Set(["TAF-ROJ"]);
const sku1 = generateSku("Tafeta", "Rojo", existing);
assert.equal(sku1, "TAF-ROJ2", `Collision suffix 2 expected, got ${sku1}`);
existing.add("TAF-ROJ2");
const sku2 = generateSku("Tafeta", "Rojo", existing);
assert.equal(sku2, "TAF-ROJ3", `Collision suffix 3 expected, got ${sku2}`);
console.log("  ✓  TAF-ROJ → TAF-ROJ2 → TAF-ROJ3 (collision chain)");
passed += 2;

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
