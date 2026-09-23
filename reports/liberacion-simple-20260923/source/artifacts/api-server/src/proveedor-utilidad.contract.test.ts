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
const inventorySource = readFile(
  new URL("./lib/inventario.ts", import.meta.url),
  "utf8",
);
const posSource = readFile(
  new URL("./lib/pos.ts", import.meta.url),
  "utf8",
);

test("utilidad atribuye por entradas.proveedor_id y no por rollos.proveedor_id", async () => {
  const source = await comprasSource;
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("export async function utilidadPorProveedor"),
  );

  assert.match(utilitySource, /JOIN entradas e ON e\.id = n\.entrada_id/);
  assert.match(utilitySource, /e\.proveedor_id = \$\{opts\.proveedorId\}/);
  assert.doesNotMatch(utilitySource, /\br\.proveedor_id\b/);
});

test("utilidad conserva el predicado y fecha canónicos de contabilización", async () => {
  const source = await comprasSource;
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("export async function utilidadPorProveedor"),
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

test("la utilidad lee el ledger durable y no usa movimientos normales como FIFO", async () => {
  const source = await comprasSource;
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("export async function utilidadPorProveedor"),
  );

  assert.match(utilitySource, /FROM ticket_linea_consumos c/);
  assert.match(utilitySource, /JOIN accounted_lines a ON a\.linea_id = n\.linea_id/);
  assert.match(utilitySource, /r\.recepcion_id = n\.entrada_id/);
  assert.match(utilitySource, /JOIN movimientos m/);
  assert.match(utilitySource, /legacy_normal_evidence/);
  assert.match(utilitySource, /HAVING COUNT\(\*\) = 1/);
  assert.match(utilitySource, /reversal\.tipo = 'CANCELACION'/);
  assert.match(utilitySource, /reversal\.movimiento_origen_id = m\.id/);
  assert.match(utilitySource, /costo_unitario_congelado/);
  assert.match(utilitySource, /NOT EXISTS \([\s\S]*ticket_linea_consumos c/);
  assert.match(utilitySource, /WHERE e\.proveedor_id = \$\{opts\.proveedorId\}/);
});

test("costo usa snapshot congelado para NORMAL y costo físico para METREADO", async () => {
  const source = await comprasSource;
  const traceSource = await readFile(
    new URL("./lib/supplier-trace.ts", import.meta.url),
    "utf8",
  );
  const utilitySource = source.slice(
    source.indexOf("function supplierUtilityCte"),
    source.indexOf("export async function utilidadPorProveedor"),
  );

  assert.match(utilitySource, /c\.costo_centavos/);
  assert.match(utilitySource, /n\.costo_centavos::numeric \/ 100/);
  assert.match(traceSource, /costoMode: "LINE_FROZEN" \| "ROLL_PHYSICAL"/);
  assert.match(traceSource, /roll\.costoUnitario/);
  assert.match(traceSource, /isValidUnitCost\(roll\.costoUnitario\)/);
  assert.match(traceSource, /allocatePhysicalCostCents/);
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

  assert.match(
    source,
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
  const route = source.slice(start, start + 2200);
  assert.match(route, /requierePermiso\("proveedores_finanzas", "ver"\)/);
  assert.match(route, /rol === "SUPERVISOR"/);
  assert.match(route, /SUPERVISOR no puede consultar utilidad/);
  assert.match(route, /res\.status\(403\)/);
});

test("la reversa genérica no puede cancelar VENTA de ticket", async () => {
  const inventory = await inventorySource;
  const pos = await posSource;
  assert.match(inventory, /TICKET_CANCELLATION_REQUIRED/);
  assert.match(inventory, /permitirCancelacionDocumento !== true/);
  assert.match(pos, /permitirCancelacionDocumento: true/);
});

test("METRO METREADO nuevo exige fuentes físicas y cancela restaurando cantidad", async () => {
  const posSource = await readFile(
    new URL("./lib/pos.ts", import.meta.url),
    "utf8",
  );
  const inventorySource = await readFile(
    new URL("./lib/inventario.ts", import.meta.url),
    "utf8",
  );
  assert.match(posSource, /producto\.unidad === "METRO"/);
  assert.match(posSource, /SOURCE_ROLLO_REQUIRED/);
  assert.match(
    inventorySource,
    /documentoTipo\?\: string[\s\S]*TICKET_METRO_METREADO/,
  );
  assert.match(inventorySource, /orig\.documentoTipo === "TICKET_METRO_METREADO"/);
});

test("la migración es explícita, aditiva y no edita datos existentes", async () => {
  const migration = await readFile(
    new URL("../../../lib/db/migrations/20260914_supplier_trace.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ticket_linea_consumos/);
  assert.match(migration, /cantidad_milesimas BIGINT/);
  assert.match(migration, /ingreso_centavos BIGINT/);
  assert.match(migration, /costo_centavos BIGINT/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE/);
  assert.match(migration, /ENABLE ALWAYS TRIGGER ticket_linea_consumos_append_only/);
  assert.match(migration, /BEGIN;\s+/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, /ticket_linea_consumos_movimiento_consumo_uidx/);
  assert.match(migration, /ticket_linea_consumos_reversa_uidx/);
  assert.match(migration, /allocation source does not match roll entry supplier/);
  assert.match(migration, /original\.movimiento_id IS DISTINCT FROM movement\.movimiento_origen_id/);
  assert.match(migration, /AND tipo = 'CONSUMO'\s+FOR UPDATE/);
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