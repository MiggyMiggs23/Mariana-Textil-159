import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readPage = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("Tiempo Real Contract", () => {
  it("renders principal row and secondary attention row in exact order", () => {
    const page = readPage("./tiempo-real.tsx");
    // Principal row: Ventas (Total), Cobrado (Caja), Ventas a crédito, Utilidad
    assert.match(page, /grid-cols-1 md:grid-cols-2 xl:grid-cols-4[\s\S]*Ventas \(Total\)[\s\S]*Cobrado \(Caja\)[\s\S]*Ventas a crédito[\s\S]*Utilidad/);

    // Secondary row reuses the same four-column grid.
    assert.match(page, /grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4[\s\S]*Ventas pendientes de cobro o autorización[\s\S]*Salidas en tránsito[\s\S]*Tickets cancelados[\s\S]*Salidas canceladas/);
    assert.equal(
      (page.match(/className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"/g) ?? []).length,
      2,
      "Both rows share full width, breakpoints, equal columns and spacing",
    );
    assert.doesNotMatch(page, /xl:col-start-2/);
  });

  it("explains color semantics with concise code comments", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /\{?\/\*.*[Aa]mber.*\*\/\}/i);
    assert.match(page, /\{?\/\*.*[Rr]ed.*\*\/\}/i);
  });

  it("SALIDAS drilldown columns/link rule", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /isSalidaBreakdown \? \(/);
    assert.match(page, /<TableHead>Origen<\/TableHead>/);
    assert.match(page, /<TableHead>Destino o Cliente<\/TableHead>/);
    assert.match(page, /<Link href=\{item\.href\}/);
    assert.match(page, /format\(parseISO\(item\.fecha\), "dd\/MM\/yyyy HH:mm"\)/);
    assert.doesNotMatch(page, /href=\{`\/tickets\/\$\{item\.id\}`\}[^>]*>[\s\S]{0,200}item\.(origen|destino)/);
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
    assert.match(page, /attentionCardTone\("red", dashboard\?\.cancelaciones\.tickets, dashboard\?\.cancelaciones\.importe\)/);
    assert.match(page, /attentionCardTone\("red", dashboard\?\.salidasCanceladas\.conteo, dashboard\?\.salidasCanceladas\.importe\)/);
    assert.doesNotMatch(page, /cancelledTone\.state === "elevated"/);
    assert.doesNotMatch(page, /tasaCancelacion\)\s*>\s*10|tasaCancelacion\s*>\s*10/);
  });

  it("pluralizes dashboard counts and always shows the server cancellation rate, even without sales", () => {
    const page = readPage("./tiempo-real.tsx");
    assert.match(page, /value === 1 \? singular : plural/);
    assert.match(page, /formatCountLabel\(dashboard\.cancelaciones\.tickets, "ticket", "tickets"\)/);
    assert.match(page, /formatCountLabel\(pendingTickets, "ticket", "tickets"\)/);
    assert.match(page, /formatCountLabel\(pendingNotes, "nota", "notas"\)/);
    assert.doesNotMatch(page, /hasCancellationRateBase/);
    assert.match(page, /Tasa de cancelación: \{formatNumber\(dashboard\.cancelaciones\.tasaCancelacion/);
    const cardContent = page.slice(page.indexOf('{formatCountLabel(dashboard.cancelaciones.tickets'), page.indexOf("</CardContent>", page.indexOf('{formatCountLabel(dashboard.cancelaciones.tickets')));
    assert.doesNotMatch(cardContent, /&&|\?\s*\(/);
  });
});
