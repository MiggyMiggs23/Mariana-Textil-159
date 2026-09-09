import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildThermalPageRules } from "../lib/print";

const root = new URL("../../../../", import.meta.url);

test("Entrada keeps 216x279mm paper and uses its measured safe content box", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const entrada = await readFile(new URL("artifacts/mariana-textil/src/pages/entrada-documento.tsx", root), "utf8");

  assert.match(css, /@page entrada-page\s*\{[\s\S]*size:\s*216mm 279mm;/);
  assert.match(css, /\.entrada-page-print\s*\{[\s\S]*page:\s*entrada-page;/);
  assert.match(entrada, /className=[\s\S]*?entrada-page-print[\s\S]*?w-\[216mm\]\s*h-\[279mm\]/);
  assert.match(entrada, /const rowsPerPage = 23;/);
  assert.match(entrada, /Math\.max\(0, rowsPerPage - pageLineas\.length\)/);
  assert.match(entrada, /RECIBIDO POR/i);
  assert.match(entrada, /REVISADO POR/i);
  assert.match(entrada, /AUTORIZADO POR/i);
  assert.match(entrada, /<PrintableDocumentHeader[\s\S]*qrUrl=\{documentUrl\}/);
  assert.match(entrada, /\/entradas\/\$\{entrada\.id\}\/documento/);
  assert.match(entrada, /qrLabel=\{`QR para ver entrada/);
  assert.match(entrada, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(entrada, /const seriesPerRow = 4;/);
  assert.match(entrada, /const seriesRowsPerPage = 40;/);
  assert.match(entrada, /const totalPages = globalPages\.length \+ seriesPages\.length;/);
  assert.match(entrada, /pageIndex === globalPages\.length - 1/);
  assert.match(entrada, />Listado de series</);
});

test("Salida page specifies A5 landscape and has correct control signatures", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const salida = await readFile(new URL("artifacts/mariana-textil/src/pages/salida-documento.tsx", root), "utf8");

  assert.match(css, /@page salida-page\s*\{[\s\S]*size:\s*210mm 148mm;/);
  assert.match(css, /\.salida-page-print\s*\{[\s\S]*page:\s*salida-page;/);
  assert.match(salida, /className=[\s\S]*?salida-page-print[\s\S]*?w-\[210mm\]\s*h-\[148mm\]/);
  assert.match(salida, /Generó:/);
  assert.match(salida, /Entregó:/);
  assert.match(salida, /Revisó/);
  assert.match(salida, /Entregó/);
  assert.match(salida, /Recibió/);
  assert.match(salida, /tab=recepcion&id=\$\{salida\.id\}/);
  assert.match(salida, /<PrintableDocumentHeader[\s\S]*qrUrl=\{qrUrl\}/);
  assert.match(css, /\.salida-page-print:last-child\s*\{[\s\S]*page-break-after:\s*auto;/);
  assert.match(salida, /const SALIDA_PRODUCT_ROWS_PER_PAGE = 10;/);
  assert.match(salida, /Math\.ceil\(salida\.lineas\.length \/ SALIDA_PRODUCT_ROWS_PER_PAGE\)/);
  assert.match(salida, /SALIDA_PRODUCT_ROWS_PER_PAGE - pageLineas\.length/);
  assert.match(salida, /document-product-grid/);
  assert.match(css, /\.document-product-grid th,[\s\S]*border:\s*0\.35mm solid #000 !important;/);
  assert.match(salida, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(salida, /qrSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(salida, /qrWrapperClassName="salida-qr-white-pad bg-white p-\[2mm\]"/);
  assert.match(salida, /<h1[^>]*>Salida<\/h1>/);
  assert.doesNotMatch(salida, /doc-origin-initials|salida\.inicialesSitio/);
  assert.match(salida, /data-testid="doc-origin-name">\{salida\.nombreOrigen\}/);
  assert.match(
    salida,
    /data-testid="doc-destination-name">\{isVentaCliente \? "Cliente recoge en origen" : salida\.nombreDestino\}/,
  );
  assert.doesNotMatch(salida, /data-print-palette="monochrome"|logoVariant="monochrome"/);
  assert.doesNotMatch(css, /filter:\s*grayscale\(1\)/);
  assert.match(salida, /bg-\[#1e3a8a\]/);
  assert.match(salida, /text-\[#1e3a8a\]/);
  assert.match(css, /\.salida-page-print \.salida-qr-white-pad\s*\{[\s\S]*background-color:\s*#fff !important;/);
  assert.doesNotMatch(salida, /No\. de<br\/>Serie|\{rollo\.serie\}/);
  assert.doesNotMatch(salida, /pageIndex === totalPages - 1/);
});

test("Labels have exact physical size without padding", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  assert.match(css, /@page label\s*\{[\s\S]*size:\s*100mm 70mm;[\s\S]*margin:\s*0;/);
  assert.match(css, /\.label-page\s*\{[\s\S]*page:\s*label;[\s\S]*width:\s*100mm;[\s\S]*height:\s*70mm;[\s\S]*margin:\s*0;/);
  assert.match(css, /body\.printing-labels\s*\{[\s\S]*margin:\s*0;[\s\S]*padding:\s*0;/);
  assert.match(css, /\.etiquetas-print\s*\{[\s\S]*page:\s*label;[\s\S]*width:\s*100mm;/);
  assert.match(css, /body\.printing-labels #root,[\s\S]*display:\s*none !important;/);
  assert.match(css, /body\.printing-labels \.etiquetas-print\s*\{[\s\S]*position:\s*static;/);
});

test("Replit development banner is hidden from every print medium", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  assert.match(css, /@media print\s*\{[\s\S]*#replit-dev-banner,[\s\S]*\[data-replit-dev-banner\][\s\S]*display:\s*none !important;/);
});

test("every print mode collapses body siblings outside the application root", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const printModes = [
    "print-80mm",
    "print-credito",
    "print-salida",
    "print-entrada",
    "print-viaje",
    "print-corte",
    "printing-labels",
    "printing-label-sheet",
  ];

  for (const mode of printModes) {
    assert.match(
      css,
      new RegExp(`body\\.${mode} > \\*:not\\(#root\\)\\s*\\{[\\s\\S]*?display:\\s*none !important;`),
      `${mode} must collapse every body sibling outside #root`,
    );
  }

  assert.match(css, /body\.print-viaje > \.viaje-page:not\(#root\)\s*\{[\s\S]*?display:\s*block !important;/);
  assert.match(css, /body\.printing-labels > \.etiquetas-print:not\(#root\)\s*\{[\s\S]*?display:\s*block !important;/);
  assert.match(css, /body\.printing-label-sheet > \.etiquetas-print:not\(#root\)\s*\{[\s\S]*?display:\s*grid !important;/);
  assert.match(css, /body\.print-corte > \*:not\(#root\):has\(\.corte-print\)\s*\{[\s\S]*?display:\s*contents !important;/);
});

test("Thermal label uses spacing instead of vertical dividers and enlarges logo and QR", async () => {
  const label = await readFile(new URL("artifacts/mariana-textil/src/components/label-print.tsx", root), "utf8");
  assert.doesNotMatch(label, /border-l border-gray-400/);
  assert.match(label, /gap-\[1mm\]/);
  assert.match(label, /max-w-\[33mm\]/);
  assert.match(label, /width="29mm"/);
});

test("Credit notes print exactly A5 portrait in two copies with internal QR", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");

  // CSS constraints
  assert.match(css, /@page credito-page\s*\{[\s\S]*size:\s*148mm 210mm;/);
  assert.match(css, /\.credito-page-print\s*\{[\s\S]*page:\s*credito-page;/);
  assert.match(css, /body\.print-credito \.print-credito-only\s*\{[\s\S]*page:\s*credito-page;/);
  assert.match(detail, /credito-page-print[\s\S]*w-\[148mm\][\s\S]*h-\[210mm\]/);

  // Two copies logic (COPIA INTERNA / COPIA CLIENTE)
  assert.match(detail, /\[printInterna, printCliente\]\.map\(/);
  assert.match(detail, /COPIA INTERNA/);
  assert.match(detail, /COPIA CLIENTE/);

  // QR only on internal
  assert.match(detail, /qrUrl=\{isInternal \? qrUrl : undefined\}/);

  // Auto-print routing based on nota vs thermal
  assert.match(detail, /const printPromise = isNota[\s\S]*printWhenReady\("print-credito"\)[\s\S]*printThermalTicket\(thermalPrintRoot\.current\)/);
  assert.doesNotMatch(detail, /CASH_NOTE_PRODUCT_ROWS_PER_PAGE|Nota de contado/i);
  assert.match(detail, /const NOTE_PRODUCT_ROWS_PER_PAGE = 8;/);
  assert.match(detail, /pageIndex === notePageCount - 1/);
  assert.match(detail, /const notePageCount = Math\.max\(1, Math\.ceil\(noteLines\.length \/ noteRowsPerPage\)\)/);
  assert.match(detail, /noteLines\.slice\(pageIndex \* noteRowsPerPage/);
  assert.match(detail, /noteRowsPerPage - pageLines\.length/);
  assert.match(detail, /pageIndex \* noteRowsPerPage \+ lineIndex \+ 1/);
  assert.match(css, /\.credito-page-print\s*\{[\s\S]*height:\s*210mm !important;[\s\S]*overflow:\s*clip !important;/);
  assert.match(css, /\.document-product-grid tr\s*\{[\s\S]*break-inside:\s*avoid-page !important;[\s\S]*page-break-inside:\s*avoid !important;/);

  // Caja prints cuts only; sale-document printing remains outside Caja.
  assert.doesNotMatch(cobros, /printedTicketId|\/tickets\/.*print=3|print=3/);
});

test("Nota print conditionally renders customer header, credit terms, legal text, and IVA", async () => {
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const notaPrint = detail.slice(
    detail.indexOf("{/* Nota Print Pages */}"),
    detail.indexOf("<Dialog open={cancelOpen}"),
  );

  // The three optional customer fields are conditional grid children, not placeholder rows.
  assert.match(notaPrint, /\{printedContact && \(/);
  assert.match(notaPrint, /\{printedRecipient && \(/);
  assert.match(notaPrint, /\{printedCustomerAddress && \(/);
  assert.doesNotMatch(notaPrint, /"N\/A"|\|\| "—"/);
  assert.match(notaPrint, />Cliente</);
  assert.match(notaPrint, />Folio Venta</);
  assert.match(notaPrint, />Fecha Venta</);

  // Credit terms use the persisted sale fields for every Nota.
  assert.doesNotMatch(notaPrint, /const creditTicket = printData\.esCredito;/);
  assert.match(notaPrint, /const paymentDate = printData\.fechaVencimiento;/);
  assert.match(notaPrint, /const termDays = printData\.diasPlazo;/);
  assert.match(notaPrint, /formatDateOnlyMx\(paymentDate\)/);
  assert.match(notaPrint, /\{paymentDate && \([\s\S]*>Fecha de pago</);
  assert.match(notaPrint, /\{termDays && \([\s\S]*>Plazo</);

  const legalParagraphs = [
    "RECIBO DE MERCANCÍA Y PAGARÉ",
    "Recibo a mi entera satisfacción la mercancía aquí detallada.",
    "Por este pagaré, reconozco deber y me obligo incondicionalmente a pagar a la orden de MARIANA TEXTIL, en la fecha de pago señalada en esta nota, el monto de esta nota, por concepto de mercancía recibida.",
    "El presente pagaré se rige por los artículos 170, fracciones I, II, III, IV, V y VI; 171; y 174, primer párrafo, de la LGTOC, y demás disposiciones aplicables.",
  ];
  for (const paragraph of legalParagraphs) {
    assert.ok(notaPrint.includes(`<p${paragraph === legalParagraphs[0] ? ' className="font-bold"' : ""}>${paragraph}</p>`));
    assert.equal(
      notaPrint.split(paragraph).length - 1,
      paragraph === legalParagraphs[1] ? 2 : 1,
      paragraph === legalParagraphs[1]
        ? "The receipt sentence appears on intermediate pages and inside the final-page promissory note."
        : `The exact legal paragraph must have one source rendering location: ${paragraph}`,
    );
  }
  assert.doesNotMatch(notaPrint, /lugar de pago|domicilio/i);
  assert.match(
    notaPrint,
    /pageIndex === notePageCount - 1[\s\S]*RECIBO DE MERCANCÍA Y PAGARÉ[\s\S]*El presente pagaré se rige/,
  );
  assert.match(
    notaPrint,
    /\) : \(\s*<p>Recibo a mi entera satisfacción la mercancía aquí detallada\.<\/p>/,
  );
  assert.match(
    notaPrint,
    /className="text-\[10px\] leading-\[12px\] text-gray-500 mb-2 pr-2 text-justify"[\s\S]*data-testid="note-legal-block"/,
  );
  assert.match(notaPrint, /data-testid="note-signature-block"/);
  assert.match(notaPrint, /data-testid="note-totals-block"/);
  assert.match(notaPrint, /className="w-\[35%\] shrink-0 self-start"/);

  // Subtotal always prints; IVA only does so for facturado and labels the persisted rate.
  assert.match(notaPrint, /"subtotal" in printData/);
  assert.match(notaPrint, /\{printData\.facturado && \([\s\S]*IVA \(\{formatNumber\(printData\.tasaIva/);
  assert.doesNotMatch(notaPrint, /IVA \(16(?:\.00)?%\)/);
});

test("Credit-note pagination keeps eight complete rows with its measured readable legal footer", async () => {
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");

  assert.match(detail, /const NOTE_PRODUCT_ROWS_PER_PAGE = 8;/);
  assert.match(
    detail,
    /Chromium PDF raster at 120dpi[\s\S]*Eight complete[\s\S]*Row nine crosses the[\s\S]*safe credit capacity is eight/,
  );
  assert.match(
    detail,
    /className="px-4 mt-1 mb-0 relative z-10 shrink-0 flex h-\[280px\] gap-2"/,
  );
});

test("Cash Ticket only exposes the measured 80mm thermal format", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const print = await readFile(new URL("artifacts/mariana-textil/src/lib/print.ts", root), "utf8");
  assert.doesNotMatch(css, /size:\s*80mm 250mm/);
  assert.match(print, /await waitForPrintableAssets\(root\)/);
  assert.match(print, /getBoundingClientRect\(\)\.height/);
  assert.match(print, /page\.scrollHeight/);
  assert.match(print, /@page thermal-page-\$\{index\}/);
  assert.match(detail, /printThermalTicket\(thermalPrintRoot\.current\)/);
  assert.match(css, /body\.print-80mm #root \*:has\(\.print-80mm-only\)\s*\{[\s\S]*display:\s*contents !important;/);
  assert.match(css, /body\.print-80mm \.print-80mm-only\s*\{[\s\S]*position:\s*static;/);
  assert.doesNotMatch(css, /carta-page|print-carta|print-document-container/);
  assert.doesNotMatch(detail, /Imprimir Media Carta|handlePrintCarta|print-carta/);
  assert.equal((detail.match(/<DocumentQrCode/g) ?? []).length, 0);
  assert.equal((detail.match(/<MonochromeBrandLogo className="mx-auto (?:mb-1 )?h-auto w-\[25mm\]"/g) ?? []).length, 1);
});

test("Thermal ticket renders vertical product blocks with unit-safe quantities", async () => {
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  assert.match(detail, /VENTA: \{modality\}/);
  assert.match(detail, /modality === "POR ROLLO"/);
  // This contract predated the customer-sale work and had already become stale
  // when PIEZA was added: protect every known label plus the unknown-unit fallback.
  for (const [unit, label] of [
    ["METRO", "Metros"],
    ["KILO", "Kilos"],
    ["BOLSA", "Bolsas"],
    ["PIEZA", "Piezas"],
  ]) {
    assert.match(
      detail,
      new RegExp(`line\\.unidadProducto === "${unit}" \\? "${label}"`),
    );
  }
  assert.match(detail, /: formatUnit\(line\.unidadProducto\)/);
  assert.match(detail, /<span>Precio:<\/span>/);
  assert.match(detail, /<span>Importe:<\/span>/);
  assert.match(detail, /Total de rollos:/);
  assert.match(detail, /Total a pagar:/);
  assert.match(detail, /ticket-product-block border-b border-dashed border-black/);
  assert.match(detail, /ticket-summary mt-2 border-2 border-black bg-black/);
});

test("three complete logical ticket pages precede single tabular add-ons", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");

  assert.match(detail, /get\("tabulares"\) === "1"/);
  assert.match(detail, /\(\["CLIENTE", "CAJA", "ADMINISTRACIÓN"\] as const\)\.map/);
  assert.match(detail, /className="ticket-copy" data-thermal-page=\{copyLabel\}/);
  assert.match(detail, /data-thermal-page=\{`TABULAR-\$\{group\.color\}`\}/);
  assert.match(css, /\.ticket-copy\s*\{[\s\S]*break-after:\s*page;/);
  assert.match(css, /\.ticket-product-block,[\s\S]*\.ticket-summary\s*\{[\s\S]*break-inside:\s*avoid-page;/);
  assert.match(css, /\.print-ticket-container > \[data-thermal-page\]:last-child\s*\{[\s\S]*break-after:\s*auto;/);
  assert.match(detail, /tabularGroups\.map/);
  assert.ok(detail.indexOf('["CLIENTE", "CAJA", "ADMINISTRACIÓN"]') < detail.indexOf("tabularGroups.map"));
  assert.match(detail, /Folio:/);
  assert.match(detail, /Color:/);
  assert.match(detail, /rollo\.serie/);
  assert.match(detail, /formatNumber\(rollo\.cantidad, \{ kind: "quantity" \}\)/);
  assert.match(detail, /formatUnit\(rollo\.unidad\)/);
  assert.match(detail, /group\.totales\[unidad\]/);
});

test("thermal summary is the same indivisible two-row box in all three copies", async () => {
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");

  assert.match(detail, /const totalNormalRolls = countNormalRollItems\(ticket\.lineas\)/);
  assert.equal((detail.match(/Total de rollos:/g) ?? []).length, 1);
  assert.equal((detail.match(/Total a pagar:/g) ?? []).length, 1);
  assert.doesNotMatch(detail, /TOTAL GENERAL:/);
  assert.match(
    detail,
    /\(\["CLIENTE", "CAJA", "ADMINISTRACIÓN"\] as const\)\.map\([\s\S]*ticket-summary[\s\S]*Total de rollos:[\s\S]*\{totalNormalRolls\}[\s\S]*Total a pagar:[\s\S]*ticket\.total[\s\S]*<\/section>/,
  );
  assert.match(
    css,
    /\.ticket-product-block,\s*\.ticket-summary\s*\{[\s\S]*break-inside:\s*avoid-page;[\s\S]*page-break-inside:\s*avoid;/,
  );
});

test("six distinct products stay assigned to each measured logical copy", () => {
  const products = ["LINO", "SEDA", "GABARDINA", "MEZCLILLA", "SATIN", "MANTA"];
  const logicalPages = ["CLIENTE", "CAJA", "ADMINISTRACIÓN"].map((copy) => ({
    copy,
    products: [...products],
  }));

  assert.equal(new Set(products).size, 6);
  assert.deepEqual(
    logicalPages.map(({ copy }) => copy),
    ["CLIENTE", "CAJA", "ADMINISTRACIÓN"],
  );
  logicalPages.forEach(({ products: assignedProducts }) => {
    assert.deepEqual(assignedProducts, products);
  });

  const rules = buildThermalPageRules([720, 720, 720, 180, 220]);
  assert.deepEqual(
    [...rules.matchAll(/@page (thermal-page-\d+)/g)].map((match) => match[1]),
    [
      "thermal-page-0",
      "thermal-page-1",
      "thermal-page-2",
      "thermal-page-3",
      "thermal-page-4",
    ],
  );
  assert.doesNotMatch(rules, /250mm/);
});

test("Viaje isolates one exact letter page for printing", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const viaje = await readFile(new URL("artifacts/mariana-textil/src/pages/viaje-documento.tsx", root), "utf8");
  assert.match(viaje, /printWhenReady\("print-viaje"\)/);
  assert.match(viaje, /viaje-document-shell/);
  assert.match(css, /body\.print-viaje \.viaje-page\s*\{[\s\S]*height:\s*278\.5mm !important;/);
  assert.match(css, /body\.print-viaje \.viaje-page\s*\{[\s\S]*width:\s*215\.5mm !important;/);
  assert.match(css, /body\.print-viaje \.viaje-page\s*\{[\s\S]*position:\s*static;/);
  assert.match(css, /body\.print-viaje #root\s*\{[\s\S]*display:\s*none !important;/);
  assert.match(viaje, /createPortal\(/);
});

test("ticket detail screen band and thermal beginning/end on every copy", async () => {
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");

  // screen band inside detail view
  assert.match(detail, /bg-destructive text-destructive-foreground[\s\S]*CANCELADO/);

  // thermal beginning/end on every copy
  assert.match(detail, /\(\["CLIENTE", "CAJA", "ADMINISTRACIÓN"\] as const\)\.map[\s\S]*ticket\.estado === EstadoTicket\.CANCELADO[\s\S]*border-y-4 border-black[\s\S]*CANCELADO/);
});

test("unchanged A5 watermark", async () => {
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  // ensure the huge rotated CANCELADO watermark still exists for Note prints
  assert.match(detail, /text-9xl font-black text-red-600 rotate-\[-30deg\] tracking-widest/);
});