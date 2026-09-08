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
    assert.match(summary, /cobrado.variacionPorcentaje/);
    assert.match(summary, /porCobrar.variacionPorcentaje/);
    assert.match(summary, /vendido.variacionPorcentaje/);
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

  it("uses wouter search and location hooks for url state with default today and off", () => {
    const summary = readPage("./cuentas-destino.tsx");
    assert.match(summary, /useSearch/);
    assert.match(summary, /useLocation/);
    assert.match(summary, /searchParams.get\("compare"\) === "true"/);
    assert.match(summary, /todayStr = format\(new Date\(\), "yyyy-MM-dd"\)/);
    assert.match(summary, /const desde = searchParams\.get\("desde"\) \|\| todayStr/);
  });

  it("handles nullable previous display without +100% logic", () => {
    const summary = readPage("./cuentas-destino.tsx");
    const detail = readPage("./cuenta-destino-detalle.tsx");
    assert.match(summary, /- sin periodo anterior/);
    assert.match(detail, /- sin periodo anterior/);
  });

  it("includes fuente filter in the links to the detail page", () => {
    const summary = readPage("./cuentas-destino.tsx");
    const detail = readPage("./cuenta-destino-detalle.tsx");
    assert.match(summary, /fuentes: ListAdminCuentaDestinoMovimientosFuenteItem\[\]/);
    assert.match(summary, /params.append\("fuente", fuente\)/);
    assert.match(summary, /fuentes=\{\["POS"\]\}/);
    assert.match(summary, /fuentes=\{\["CREDITO"\]\}/);
    assert.match(summary, /cobro\.fuente/);
    assert.match(detail, /inherited\.getAll\("fuente"\)/);
  });

  it("uses the literal collection labels and links credit movements to the exact account row", () => {
    const summary = readPage("./cuentas-destino.tsx");
    const detail = readPage("./cuenta-destino-detalle.tsx");
    const clientTable = readFileSync(
      new URL("../../components/client-responsive-table.tsx", import.meta.url),
      "utf8",
    );

    assert.match(summary, /De ventas del periodo/);
    assert.match(summary, /De notas anteriores/);
    assert.match(summary, /A cuenta, sin aplicar/);
    assert.match(detail, /movement\.documentoTipo === "MOVIMIENTO_CREDITO"/);
    assert.match(
      detail,
      /\/clientes\/\$\{movement\.clienteId\}\?tab=estado&movimientoId=\$\{movement\.documentoId\}/,
    );
    assert.match(clientTable, /get\("movimientoId"\)/);
    assert.match(clientTable, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
    assert.match(clientTable, /data-highlighted=\{highlighted \? "true" : undefined\}/);
  });

});