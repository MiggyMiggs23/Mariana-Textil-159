import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { productosTable } from "@workspace/db";
import { normalizeCatalogTitleCase } from "@workspace/db/sku";
import { buildPreview } from "./lib/catalog-import";

test("normalización Title Case compartida preserva acentos y colapsa espacios", () => {
  assert.equal(normalizeCatalogTitleCase("  MANTA   LIBANO "), "Manta Libano");
  assert.equal(normalizeCatalogTitleCase("VERDE BANDERA"), "Verde Bandera");
  assert.equal(normalizeCatalogTitleCase("aZUL MARINO"), "Azul Marino");
  assert.equal(normalizeCatalogTitleCase("MANTA DE CIELO"), "Manta de Cielo");
  assert.equal(normalizeCatalogTitleCase("CASCABEL 15 MM"), "Cascabel 15 Mm");
  assert.equal(normalizeCatalogTitleCase("PomPon 25 mm"), "PomPon 25 Mm");
  assert.equal(normalizeCatalogTitleCase("pompon 25 mm"), "Pompon 25 Mm");
});

test("POST, PATCH e importación usan normalización compartida y PATCH reasigna SKU", async () => {
  const route = await readFile(new URL("./routes/productos.ts", import.meta.url), "utf8");
  const importer = await readFile(new URL("./lib/catalog-import.ts", import.meta.url), "utf8");
  assert.match(route, /normalizeCatalogTitleCase\(parsed\.data\.tela\)/);
  assert.match(route, /normalizeCatalogTitleCase\(body\.data\.color\)/);
  assert.match(importer, /normalizeCatalogTitleCase\(telaRaw\)/);
  assert.match(route, /ADVISORY_LOCK_NAMESPACES\.PRODUCT_CATALOG/);
  assert.match(route, /newSku === undefined \|\| newSku === current\.sku/);
  assert.match(route, /ne\(productosTable\.id, params\.data\.id\)/);
  assert.match(route, /updates\.sku = generateSku/);
});

test("BOLSA está en contrato, importación y núcleo POS sin mezclarse con KILO", async () => {
  const preview = buildPreview({
    headers: ["tela", "color", "unidad", "precio_sugerido"],
    rows: [["Empaque", "Transparente", "bolsa", "12.50"]],
    existingVariants: new Set(),
    existingSkus: new Set(),
  });
  assert.equal(preview[0]?.estado, "NUEVO");
  assert.equal(preview[0]?.unidad, "BOLSA");

  const [spec, enums, pos, inventory] = await Promise.all([
    readFile(
      new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../lib/db/src/schema/enums.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./lib/pos.ts", import.meta.url), "utf8"),
    readFile(new URL("./routes/inventario.ts", import.meta.url), "utf8"),
  ]);
  assert.match(spec, /enum: \[METRO, KILO, BOLSA\]/);
  assert.match(spec, /totalBolsas/);
  assert.match(enums, /"METRO",\s*"KILO",\s*"BOLSA"/);
  assert.match(pos, /producto\.unidad !== "BOLSA"/);
  assert.match(pos, /item\.linea\.unidad === "BOLSA"/);
  assert.match(pos, /BOLSA_INTEGER_QUANTITY_REQUIRED/);
  assert.match(
    pos,
    /suggestedMeteredPrice\(Number\(cantidad\), producto, producto\.unidad\)/,
  );
  assert.match(
    pos,
    /meteredPriceTier\(Number\(cantidad\), producto\.unidad\)/,
  );
  assert.match(inventory, /WHERE pr\.unidad = 'BOLSA'/);
  assert.match(inventory, /unidad === "KILO"/);
  assert.match(inventory, /cantidad de bolsas por caja/);
});

test("la importación acepta precio ausente y conserva cero como precio real", () => {
  const sinColumnaPrecio = buildPreview({
    headers: ["tela", "color", "unidad"],
    rows: [["Manta", "Crudo", "metro"]],
    existingVariants: new Set(),
    existingSkus: new Set(),
  });
  assert.equal(sinColumnaPrecio[0]?.estado, "NUEVO");
  assert.equal(sinColumnaPrecio[0]?.precioSugerido, null);

  const preciosMixtos = buildPreview({
    headers: ["tela", "color", "unidad", "precio_sugerido"],
    rows: [
      ["Manta", "Crudo", "metro", ""],
      ["Popelina", "Azul", "metro", "0"],
      ["Gabardina", "Negro", "metro", "125.50"],
    ],
    existingVariants: new Set(),
    existingSkus: new Set(),
  });
  assert.deepEqual(
    preciosMixtos.map((row) => [row.estado, row.precioSugerido]),
    [
      ["NUEVO", null],
      ["NUEVO", "0.00"],
      ["NUEVO", "125.50"],
    ],
  );
});

test("la previsualización rechaza precios inválidos y unidades ausentes o desconocidas", () => {
  const preview = buildPreview({
    headers: ["tela", "color", "unidad", "precio_sugerido"],
    rows: [
      ["Manta", "Rojo", "metro", "gratis"],
      ["Manta", "Azul", "metro", "-1"],
      ["Manta", "Verde", "", ""],
      ["Manta", "Negro", "pieza", ""],
    ],
    existingVariants: new Set(),
    existingSkus: new Set(),
  });

  assert.match(preview[0]?.error ?? "", /precio inválido: "gratis"/);
  assert.match(preview[1]?.error ?? "", /precio inválido: "-1"/);
  assert.match(preview[2]?.error ?? "", /unidad vacía/);
  assert.match(preview[3]?.error ?? "", /unidad inválida: "PIEZA"/);
  assert.ok(preview.every((row) => row.estado === "ERROR"));
});

test("precio_sugerido admite null y las variantes existentes siguen siendo aditivas", () => {
  assert.equal(productosTable.precioSugerido.notNull, false);
  const preview = buildPreview({
    headers: ["tela", "color", "unidad"],
    rows: [["Manta", "Crudo", "metro"]],
    existingVariants: new Set(["MANTA|CRUDO"]),
    existingSkus: new Set(),
  });
  assert.equal(preview[0]?.estado, "DUPLICADO");
});

test("la unidad se bloquea por referencias históricas y PATCH solo rechaza un cambio real", async () => {
  const [route, spec] = await Promise.all([
    readFile(new URL("./routes/productos.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8"),
  ]);
  for (const table of [
    "rollos",
    "movimientos",
    "ticket_lineas",
    "salida_lineas",
    "contenedor_lineas",
    "precio_historial",
    "existencias",
  ]) {
    assert.match(route, new RegExp(`FROM ${table}`));
  }
  assert.match(route, /body\.data\.unidad !== current\.unidad/);
  assert.match(route, /historial operativo/);
  assert.match(spec, /unidadBloqueada:/);
  assert.match(
    spec,
    /Verdadero cuando una referencia operativa o histórica impide cambiar la unidad/,
  );
});