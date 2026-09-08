import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readPage = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("Tiempo Real Contract", () => {
  it("renders principal row and secondary attention row in exact order", () => {
    const page = readPage("./tiempo-real.tsx");
    // Principal row: Ventas (Total), Cobrado (Caja), Ventas a crédito, Utilidad
    assert.match(page, /grid-cols-1 md:grid-cols-2 xl:grid-cols-4[\s\S]*Ventas \(Total\)[\s\S]*Cobrado \(Caja\)[\s\S]*Ventas a crédito[\s\S]*Utilidad/);

    // Secondary row: Ventas pendientes..., Tickets cancelados
    assert.match(page, /Ventas pendientes de cobro o autorización[\s\S]*Tickets cancelados/);
  });

  it("CANCELADAS drilldown columns/link rule", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /breakdownConcept === "CANCELADAS".*Cancelado por/);
    assert.match(page, /breakdownConcept !== "CANCELADAS"[\s\S]*Hora/);
    assert.match(page, /breakdownConcept !== "CANCELADAS"[\s\S]*Cliente/);
    assert.match(page, /<Link href=\{`\/tickets\/\$\{item\.id\}`\}[\s\S]*item\.folio/);
    assert.doesNotMatch(page, /href=\{`\/tickets\/\$\{item\.id\}`\}[^>]*>[\s\S]{0,200}item\.(importe|nombreUsuarioCancelacion|motivoCancelacion)/);
  });

  it("shared boolean use for cancellation", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /dashboard\.cancelaciones\.excedeUmbral/);
    assert.doesNotMatch(page, /tasaCancelacion\)\s*>\s*10|tasaCancelacion\s*>\s*10/);
  });
});
