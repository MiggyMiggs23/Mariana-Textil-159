import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readPage = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("Tiempo Real Contract", () => {
  it("renders principal row and secondary attention row in exact order", () => {
    const page = readPage("./tiempo-real.tsx");
    // Principal row: Ventas (Total), Cobrado (Caja), Ventas a crédito, Utilidad
    assert.match(page, /grid-cols-1 md:grid-cols-2 xl:grid-cols-4[\s\S]*Ventas \(Total\)[\s\S]*Cobrado \(Caja\)[\s\S]*Ventas a crédito[\s\S]*Utilidad/);

    // Secondary row reuses the same four-column grid and centers its cards in the two inner columns.
    assert.match(page, /grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4[\s\S]*xl:col-start-2[\s\S]*Ventas pendientes de cobro o autorización[\s\S]*Tickets cancelados/);
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

  it("pluralizes dashboard counts and hides a cancellation rate without a sales base", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /value === 1 \? singular : plural/);
    assert.match(page, /formatCountLabel\(dashboard\.cancelaciones\.tickets, "ticket", "tickets"\)/);
    assert.match(page, /formatCountLabel\(pendingTickets, "ticket", "tickets"\)/);
    assert.match(page, /formatCountLabel\(pendingNotes, "nota", "notas"\)/);
    assert.match(page, /hasCancellationRateBase = \(totals\?\.tickets \?\? 0\) > 0/);
    assert.match(page, /\{hasCancellationRateBase && \([\s\S]*Tasa de cancelación:/);
  });
});
