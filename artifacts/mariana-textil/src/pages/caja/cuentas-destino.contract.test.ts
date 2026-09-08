import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getGetAdminCuentasDestinoQueryKey,
  getListAdminCuentaDestinoMovimientosQueryKey,
} from "@workspace/api-client-react";

const readPage = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("Cuentas Destino Contract", () => {
  it("generates correct query key for cuentas destino list with location scope", () => {
    const key = getGetAdminCuentasDestinoQueryKey({
      desde: "2024-01-01",
      hasta: "2024-01-31",
      ubicacionId: 5
    });
    
    assert.deepStrictEqual(key, [
      "/api/admin/cuentas-destino",
      { desde: "2024-01-01", hasta: "2024-01-31", ubicacionId: 5 }
    ]);
  });

  it("generates correct query key for cuenta destino detalle including matrix cell filters", () => {
    const key = getListAdminCuentaDestinoMovimientosQueryKey("CAJA_FISICA", {
      desde: "2024-01-01",
      hasta: "2024-01-31",
      ubicacionId: 5,
      facturado: true,
      formaPago: "EFECTIVO",
      incongruente: true,
      page: 1,
      pageSize: 50
    });

    assert.deepStrictEqual(key, [
      "/api/admin/cuentas-destino/CAJA_FISICA/movimientos",
      { 
        desde: "2024-01-01", 
        hasta: "2024-01-31", 
        ubicacionId: 5,
        facturado: true,
        formaPago: "EFECTIVO",
        incongruente: true,
        page: 1,
        pageSize: 50
      }
    ]);
  });

  it("renders server-owned reconciled values without financial formulas", () => {
    const summary = readPage("./cuentas-destino.tsx");
    assert.match(summary, /cobradoVariacionPorcentaje/);
    assert.match(summary, /porCobrarVariacionPorcentaje/);
    assert.match(summary, /vendidoVariacionPorcentaje/);
    assert.match(summary, /Ant: \{formatNumber\(row\.importeAnterior, \{ kind: "money" \}\)\}/);
    assert.match(summary, /formatNumber\(row\.variacionPorcentaje, \{ kind: "percentage", percentageInput: "percent" \}\)/);
    assert.doesNotMatch(summary, /getVariation|cobrado\s*\+\s*porCobrar|reduce\([^)]*importe/);
    assert.match(summary, /data\.matriz\.cierra/);
    assert.match(summary, /overflow-x-auto[\s\S]*data\.matriz\.filas/);
    assert.match(summary, /data\.ivaFacturado\.base/);
    assert.match(summary, /data\.ivaFacturado\.iva/);
    assert.match(summary, /data\.porTienda\.map/);
    assert.match(summary, /t\.cobrado/);
    assert.match(summary, /t\.porCobrar/);
    assert.match(summary, /t\.vendido/);
  });

  it("passes matrix and inconsistency filters to the real detail page", () => {
    const summary = readPage("./cuentas-destino.tsx");
    const detail = readPage("./cuenta-destino-detalle.tsx");
    assert.match(summary, /params\.set\("facturado"/);
    assert.match(summary, /params\.set\("formaPago"/);
    assert.match(summary, /incongruente=true/);
    assert.match(detail, /facturado: facturado === "true"/);
    assert.match(detail, /formaPago: formaPago \|\| undefined/);
    assert.match(detail, /incongruente: incongruente \|\| undefined/);
    assert.match(detail, /query\.data\.montoTotal/);
    assert.doesNotMatch(detail, /items\.reduce/);
  });
});