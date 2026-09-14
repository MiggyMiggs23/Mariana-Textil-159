import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GetProveedorUtilidadResponse } from "../../../lib/api-zod/src/generated/api";
import {
  summarizeProveedorUtilidadRows,
  countDistinctRollosSinCosto,
} from "./lib/proveedor-utilidad-pure";

const comprasSource = readFile(
  new URL("./lib/compras-proveedor.ts", import.meta.url),
  "utf8",
);
const routesSource = readFile(
  new URL("./routes/proveedores.ts", import.meta.url),
  "utf8",
);

test("utilidad atribuye por entradas.proveedor_id y no por rollos.proveedor_id", async () => {
  const source = await comprasSource;
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("function movementTypesForSummary"),
  );

  assert.match(utilitySource, /JOIN entradas e ON e\.id = r\.recepcion_id/);
  assert.match(utilitySource, /e\.proveedor_id = \$\{opts\.proveedorId\}/);
  assert.doesNotMatch(utilitySource, /\br\.proveedor_id\b/);
});

test("utilidad conserva el predicado y fecha canónicos de contabilización", async () => {
  const source = await comprasSource;
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("function movementTypesForSummary"),
  );

  assert.match(utilitySource, /accountedDocumentPredicate\("t"\)/);
  assert.match(utilitySource, /accountedDocumentAt\("t"\)/);
  assert.ok(
    utilitySource.includes('accountedDocumentAt("t"))} >= ${opts.desde}'),
  );
  assert.ok(
    utilitySource.includes('accountedDocumentAt("t"))} <= ${opts.hasta}'),
  );
});

test("costo usa snapshot congelado para NORMAL y costo físico para METREADO", async () => {
  const source = await comprasSource;
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("function movementTypesForSummary"),
  );

  assert.match(utilitySource, /a\.costo_unitario_congelado/);
  assert.match(utilitySource, /r\.costo_unitario AS rollo_costo_unitario/);
  assert.match(utilitySource, /m\.rollo_costo_unitario/);
  assert.match(
    utilitySource,
    /CASE WHEN a\.costo_unitario_congelado IS NULL THEN NULL/,
  );
});

test("rollos sin costo se cuentan como ids físicos distintos aunque se vendan repetidamente", () => {
  const repeatedRoll = [
    { lineaId: 10, rolloId: 44, ventas: "10.00", costo: null },
    { lineaId: 11, rolloId: 44, ventas: "12.00", costo: null },
    { lineaId: 12, rolloId: 45, ventas: "8.00", costo: null },
  ];

  assert.equal(countDistinctRollosSinCosto(repeatedRoll), 2);
  assert.equal(
    summarizeProveedorUtilidadRows(repeatedRoll).rollosExcluidosSinCosto,
    2,
  );
});

test("la consulta de resumen cuenta rollos físicos distintos, no renglones", async () => {
  const source = await comprasSource;
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("function movementTypesForSummary"),
  );

  assert.match(
    utilitySource,
    /COUNT\(DISTINCT rollo_id\) FILTER \(WHERE costo IS NULL\).*rollos_excluidos_sin_costo/s,
  );
});

test("resumen y detalle concilian ventas, costo, utilidad y exclusiones", () => {
  const detail = [
    { lineaId: 1, rolloId: 20, ventas: "100.00", costo: "70.00" },
    { lineaId: 1, rolloId: 21, ventas: "50.00", costo: "35.00" },
    { lineaId: 2, rolloId: 22, ventas: "25.00", costo: null },
  ];
  const summary = summarizeProveedorUtilidadRows(detail, 1);

  assert.deepEqual(summary, {
    ventas: "150.00",
    costo: "105.00",
    utilidad: "45.00",
    margenPct: "30.00",
    lineasIncluidas: 1,
    lineasExcluidasSinRollo: 1,
    lineasExcluidasSinCosto: 1,
    rollosExcluidosSinCosto: 1,
  });
});

test("la ruta exige el permiso de lectura de finanzas de proveedores", async () => {
  const source = await routesSource;
  const start = source.indexOf('"/proveedores/:id/utilidad"');
  assert.notEqual(start, -1);
  const route = source.slice(start, start + 400);
  assert.match(route, /requierePermiso\("proveedores_finanzas", "ver"\)/);
});

test("el contrato generado exige rollosExcluidosSinCosto en el resumen", () => {
  const parsed = GetProveedorUtilidadResponse.parse({
    proveedorId: 7,
    desde: "2026-01-01T06:00:00.000Z",
    hasta: "2026-01-02T05:59:59.999Z",
    ubicacionId: null,
    summary: {
      ventas: "150.00",
      costo: "105.00",
      utilidad: "45.00",
      margenPct: "30.00",
      lineasIncluidas: 1,
      lineasExcluidasSinRollo: 1,
      lineasExcluidasSinCosto: 1,
      rollosExcluidosSinCosto: 1,
    },
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  assert.equal(parsed.summary.rollosExcluidosSinCosto, 1);
  assert.equal(
    GetProveedorUtilidadResponse.safeParse({
      ...parsed,
      summary: {
        ...parsed.summary,
        rollosExcluidosSinCosto: undefined,
      },
    }).success,
    false,
  );
});