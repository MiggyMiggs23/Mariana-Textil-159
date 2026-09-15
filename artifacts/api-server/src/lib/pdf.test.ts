import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createReadableReportPdf, createTextPdf, wrapPdfLines } from "./pdf";

test("composed PDF wraps wide and unbroken rows without losing trailing columns", () => {
  const source = `Serie: ${"W".repeat(180)} | Última columna: 543533`;
  const lines = wrapPdfLines([source, "", "Total General: 103302"]);
  assert.ok(lines.every((line) => line.length <= 58));
  assert.equal(lines.join("").replace(/\s/g, ""), `${source}Total General: 103302`.replace(/\s/g, ""));
  assert.ok(lines.join("\n").includes("543533"));
});


test("wrapped composed PDF paginates rather than truncating rows", () => {
  const lines = wrapPdfLines(Array.from({ length: 60 }, (_, index) => `Fila ${index}: ${"W".repeat(180)}`));
  const pdf = createTextPdf("Reporte", lines).toString("ascii");
  assert.ok(lines.length > 60);
  assert.ok(pdf.includes(`/Count ${Math.ceil(lines.length / 55)}`));
  assert.ok(pdf.includes("Fila 59:"));
  assert.ok(pdf.endsWith("%%EOF"));
});

test("report PDF embeds Spanish accents and arrows in a real table", async () => {
  const pdf = await createReadableReportPdf({
    section: "ventas",
    generatedAt: "2026-01-01T12:00:00.000Z",
    range: {
      desde: "2026-01-01T06:00:00.000Z",
      hasta: "2027-01-01T05:59:59.999Z",
      previousDesde: "internal",
      yearAgoDesde: "internal",
    },
    activeFilters: ["modalidad=TODO"],
    tables: [{
      id: "unicode",
      title: "Página · Día · Participación →",
      columns: [
        { key: "dia", label: "Día", kind: "text" },
        { key: "participacion", label: "Participación", kind: "percentage" },
        { key: "direccion", label: "Dirección →", kind: "text" },
      ],
      rows: [{ dia: "Página", participacion: 12.5, direccion: "→" }],
      totals: { dia: "Total General", participacion: 12.5 },
    }],
  });
  const path = join(tmpdir(), `report-pdf-unicode-${process.pid}.pdf`);
  try {
    writeFileSync(path, pdf, { mode: 0o600 });
    const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
    assert.match(text, /Página/);
    assert.match(text, /Día/);
    assert.match(text, /Participación/);
    assert.match(text, /→/);
    assert.doesNotMatch(text, /previousDesde|yearAgoDesde|�/);
  } finally {
    rmSync(path, { force: true });
  }
});

test("long report rows split with repeated headers and stay inside landscape geometry", async () => {
  const pdf = await createReadableReportPdf({
    section: "que-comprar",
    generatedAt: "2026-01-01T12:00:00.000Z",
    range: {
      desde: "2026-01-01T06:00:00.000Z",
      hasta: "2027-01-01T05:59:59.999Z",
    },
    activeFilters: [],
    tables: [{
      id: "long-row",
      title: "Evidencia extensa",
      columns: [
        { key: "sku", label: "SKU", kind: "text" },
        { key: "evidencia", label: "Evidencia", kind: "text" },
        { key: "cantidad", label: "Cantidad", kind: "quantity" },
      ],
      rows: [{
        sku: "SKU-LONG",
        evidencia: `${"movimiento observado con detalle ".repeat(500)}FIN-LONG-ROW`,
        cantidad: 1234,
      }],
      totals: {},
    }],
  });
  const path = join(tmpdir(), `report-pdf-long-row-${process.pid}.pdf`);
  try {
    writeFileSync(path, pdf, { mode: 0o600 });
    const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
    const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
    assert.match(text, /SKU-LONG/);
    assert.match(text, /FIN-LONG-ROW/);
    assert.ok((text.match(/^SKU$/gm) ?? []).length > 1);
    assert.match(info, /Pages:\s+[2-9]\d*/);
    assert.match(info, /Page size:\s+841(?:\.\d+)? x 595(?:\.\d+)? pts/);
  } finally {
    rmSync(path, { force: true });
  }
});

test("independent PDF reading keeps X04 zero cells and long evidence tails", async () => {
  const zeroQuantities = [
    "Rollos · metros: 0.000",
    "Rollos · kilos: 0.000",
    "Rollos · bolsas: 0.000",
    "Metraje · metros: 0.000",
    "Metraje · bolsas: 0.000",
  ].join(" · ");
  const x04Columns = [
    { key: "nombreUbicacion", label: "Tienda", kind: "text" },
    { key: "participacion", label: "Part. %", kind: "percentage" },
    { key: "ventas", label: "Ventas", kind: "money" },
    { key: "tendenciaPorcentaje", label: "Tendencia", kind: "percentage" },
    { key: "margen", label: "Utilidad", kind: "money" },
    { key: "tickets", label: "Tickets", kind: "count" },
    { key: "ticketPromedio", label: "Promedio", kind: "money" },
    { key: "rollosMetraje", label: "Rollos / Metraje", kind: "text" },
    { key: "mediosPago", label: "Medios de Pago", kind: "text" },
    { key: "mejorPeorDia", label: "Mejor / Peor Día", kind: "text" },
    { key: "porcentajeFacturado", label: "Facturado %", kind: "percentage" },
    { key: "diferenciaCaja", label: "Dif. Caja", kind: "money" },
  ];
  const x04Rows = ["Tienda A", "Tienda B", "Tienda C"].map((nombreUbicacion) => ({
    nombreUbicacion,
    participacion: 0,
    ventas: 0,
    tendenciaPorcentaje: 0,
    margen: 0,
    tickets: 0,
    ticketPromedio: 0,
    rollosMetraje: zeroQuantities,
    mediosPago: "Efectivo: 0.00 · Transferencia: 0.00 · Crédito: 0.00",
    mejorPeorDia: null,
    porcentajeFacturado: 0,
    diferenciaCaja: 0,
  }));
  const evidenceUrl = "/api/reportes/que-comprar/evidencia?productoId=demo-product-001&ubicacionId=demo-site-002&desde=2026-01-01&hasta=2026-12-31";
  const isoTail = "2026-09-13T23:11:37.035Z";
  const qColumns = [
    ["sku", "SKU", "text"],
    ["tela", "Tela", "text"],
    ["color", "Color", "text"],
    ["unidad", "Unidad", "text"],
    ["sitio", "Sitio", "text"],
    ...Array.from({ length: 12 }, (_, index) => [
      `consumoMes${String(index + 1).padStart(2, "0")}`,
      `Consumo ${index + 1}`,
      "quantity",
    ]),
    ["ventaRealCliente", "Venta real al cliente", "quantity"],
    ["existenciaActual", "Existencia actual", "quantity"],
    ["minimoCapturado", "Mínimo capturado", "quantity"],
    ["coberturaDiasExistencia", "Días de cobertura de existencia actual", "days"],
    ["coberturaDiasMinimo", "Días que cubre el mínimo", "days"],
    ["deficitMinimoObservado", "Déficit observado contra mínimo (no pedido)", "quantity"],
    ["mesesHistoria", "Meses de historia", "count"],
    ["periodoConsumoDias", "Periodo de consumo observado (días)", "days"],
    ["noMovimiento", "Sin movimiento en periodo", "text"],
    ["mesesSinMovimiento", "Meses sin movimiento", "count"],
    ["bajoMinimo", "Bajo mínimo", "text"],
    ["episodiosBajoMinimo", "Episodios bajo mínimo", "count"],
    ["sugerencia", "Observación", "text"],
    ["evidenceUrl", "Evidencia", "text"],
  ];
  const qRow = {
    sku: "SKU-LONG",
    tela: "Tela",
    color: "Color",
    unidad: "Mts.",
    sitio: "Tienda A",
    ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`consumoMes${String(index + 1).padStart(2, "0")}`, 0])),
    ventaRealCliente: 0,
    existenciaActual: 0,
    minimoCapturado: 0,
    coberturaDiasExistencia: null,
    coberturaDiasMinimo: null,
    deficitMinimoObservado: 0,
    mesesHistoria: 0,
    periodoConsumoDias: 0,
    noMovimiento: "false",
    mesesSinMovimiento: 0,
    bajoMinimo: "false",
    episodiosBajoMinimo: 0,
    sugerencia: `Sin información suficiente; cuenta con 0 meses de historia. COLA-SUGERENCIA ${isoTail}`,
    evidenceUrl,
  };
  const pdf = await createReadableReportPdf({
    section: "que-comprar",
    generatedAt: "2026-01-01T12:00:00.000Z",
    range: { desde: "2026-01-01T06:00:00.000Z", hasta: "2027-01-01T05:59:59.999Z" },
    activeFilters: [],
    tables: [
      {
        id: "x04-comparativo-tiendas",
        title: "X04 · Tabla comparativa por tienda (TIENDA activa)",
        columns: x04Columns,
        rows: x04Rows,
        totals: {
          ...x04Rows[0],
          nombreUbicacion: "Total General",
        },
      },
      {
        id: "que-comprar",
        title: "Qué comprar por producto y sitio",
        columns: qColumns.map(([key, label, kind]) => ({ key, label, kind })),
        rows: [qRow],
        totals: {},
      },
    ],
  });
  const path = join(tmpdir(), `report-pdf-cell-tail-${process.pid}.pdf`);
  try {
    writeFileSync(path, pdf, { mode: 0o600 });
    const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
    const compact = text.replace(/\s+/g, "");
    const bbox = execFileSync("pdftotext", ["-bbox", path, "-"], { encoding: "utf8" });
    const pages = [...bbox.matchAll(/<page width="([^"]+)" height="([^"]+)"[^>]*>([\s\S]*?)<\/page>/g)];
    assert.ok(pages.length >= 2);
    for (const page of pages) {
      const width = Number(page[1]);
      const height = Number(page[2]);
      assert.equal(width, 841.89);
      assert.equal(height, 595.28);
      for (const match of page[3]!.matchAll(
        /<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)"[^>]*>/g,
      )) {
        assert.ok(Number(match[1]) >= 0 && Number(match[3]) <= width);
        assert.ok(Number(match[2]) >= 0 && Number(match[4]) <= height);
      }
    }
    assert.match(text, /X04 · Tabla comparativa por tienda/);
    assert.match(text, /Qué comprar por producto y sitio/);
    assert.equal((compact.match(/Metraje·bolsas:0\.000/g) ?? []).length, 4);
    assert.ok(compact.includes(evidenceUrl));
    assert.ok(compact.includes(isoTail));
    assert.match(text, /COLA-SUGERENCIA/);
    assert.match(text, /SKU\s+Tela\s+Color/);
    assert.match(text, /Evidencia/);
  } finally {
    rmSync(path, { force: true });
  }
});