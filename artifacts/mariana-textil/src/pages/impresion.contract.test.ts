import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(salida, /const SALIDA_PRODUCT_ROWS_PER_PAGE = 13;/);
  assert.match(salida, /Math\.ceil\(salida\.lineas\.length \/ SALIDA_PRODUCT_ROWS_PER_PAGE\)/);
  assert.match(salida, /SALIDA_PRODUCT_ROWS_PER_PAGE - pageLineas\.length/);
  assert.match(salida, /document-product-grid/);
  assert.match(css, /\.document-product-grid th,[\s\S]*border:\s*0\.35mm solid #000 !important;/);
  assert.match(salida, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(salida, /qrSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(salida, /data-print-palette="monochrome"/);
  assert.match(salida, /logoVariant="monochrome"/);
  assert.match(salida, /qrWrapperClassName="salida-qr-white-pad bg-white p-\[2mm\]"/);
  assert.match(salida, /data-testid="doc-origin-initials"/);
  assert.match(salida, /\{salida\.inicialesSitio\}/);
  assert.match(salida, /text-5xl font-black uppercase leading-none tracking-wide text-black/);
  assert.match(css, /\.salida-page-print \.salida-dark-band\s*\{[\s\S]*background-color:\s*#1f2937 !important;/);
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

test("Thermal label uses spacing instead of vertical dividers and enlarges logo and QR", async () => {
  const label = await readFile(new URL("artifacts/mariana-textil/src/components/label-print.tsx", root), "utf8");
  assert.doesNotMatch(label, /border-l border-gray-400/);
  assert.match(label, /gap-\[1mm\]/);
  assert.match(label, /max-w-\[33mm\]/);
  assert.match(label, /width="29mm"/);
});

test("Cash and credit notes print exactly A5 portrait in two copies with internal QR", async () => {
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
  assert.match(detail, /const printClass = isNota \? "print-credito" : "print-80mm";/);
  assert.match(detail, /const CASH_NOTE_PRODUCT_ROWS_PER_PAGE = 14;/);
  assert.match(detail, /const CREDIT_NOTE_PRODUCT_ROWS_PER_PAGE = 10;/);
  assert.match(detail, /creditTicket && pageIndex === notePageCount - 1/);
  assert.match(detail, /const notePageCount = Math\.max\(1, Math\.ceil\(noteLines\.length \/ noteRowsPerPage\)\)/);
  assert.match(detail, /noteLines\.slice\(pageIndex \* noteRowsPerPage/);
  assert.match(detail, /noteRowsPerPage - pageLines\.length/);
  assert.match(detail, /pageIndex \* noteRowsPerPage \+ lineIndex \+ 1/);
  assert.match(css, /\.credito-page-print\s*\{[\s\S]*height:\s*210mm !important;[\s\S]*overflow:\s*clip !important;/);

  // Cobros routing to detail with print parameter
  assert.match(cobros, /setLocation\(\`\/tickets\/\$\{printedTicketId\}\?print=3\`\);/);
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

  // Credit terms use the persisted sale fields; cash notes omit both conditional rows.
  assert.match(notaPrint, /const creditTicket = printData\.esCredito;/);
  assert.match(notaPrint, /const paymentDate = printData\.fechaVencimiento;/);
  assert.match(notaPrint, /const termDays = printData\.diasPlazo;/);
  assert.match(notaPrint, /formatDateOnlyMx\(paymentDate\)/);
  assert.match(notaPrint, /\{creditTicket && paymentDate && \([\s\S]*>Fecha de pago</);
  assert.match(notaPrint, /\{creditTicket && termDays && \([\s\S]*>Plazo</);

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
        ? "The receipt sentence is shared by the cash-only receipt branch and the final credit legal block."
        : `The exact legal paragraph must have one source rendering location: ${paragraph}`,
    );
  }
  assert.doesNotMatch(notaPrint, /lugar de pago|domicilio/i);
  assert.match(
    notaPrint,
    /creditTicket && pageIndex === notePageCount - 1[\s\S]*RECIBO DE MERCANCÍA Y PAGARÉ[\s\S]*El presente pagaré se rige/,
  );
  assert.match(
    notaPrint,
    /\) : \(\s*<p>Recibo a mi entera satisfacción la mercancía aquí detallada\.<\/p>/,
  );
  assert.match(
    notaPrint,
    /className="text-\[10px\] leading-\[12px\] text-gray-500 mb-2 pr-2 text-justify"/,
  );

  // Subtotal always prints; IVA only does so for facturado and labels the persisted rate.
  assert.match(notaPrint, /"subtotal" in printData/);
  assert.match(notaPrint, /\{printData\.facturado && \([\s\S]*IVA \(\{formatNumber\(printData\.tasaIva/);
  assert.doesNotMatch(notaPrint, /IVA \(16(?:\.00)?%\)/);
});

test("Credit-note pagination keeps ten rows with its measured readable legal footer", async () => {
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");

  assert.match(detail, /const CREDIT_NOTE_PRODUCT_ROWS_PER_PAGE = 10;/);
  assert.match(
    detail,
    /112px header \+ 126px[\s\S]*\(10 × 24px\) rows \+ 280px footer\/legal box[\s\S]*\+ 6px bottom stripe = 786px \(7\.70px reserve\)\. The legal body is 10px[\s\S]*\(7\.5pt\) at an explicit 12px line-height \(9pt\); capacity: 10 credit rows\/page\./,
  );
  assert.match(
    detail,
    /className=\{`px-4 mt-1 mb-0 relative z-10 shrink-0 flex gap-2 \$\{creditTicket \? "h-\[280px\]" : "h-\[164px\]"\}`\}/,
  );
});

test("Ticket and media carta declare their own physical page sizes", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  assert.match(css, /@page ticket-page\s*\{[\s\S]*size:\s*80mm 250mm;/);
  assert.match(css, /\.print-ticket-container\s*\{[\s\S]*page:\s*ticket-page;/);
  assert.match(css, /body\.print-80mm #root \*:has\(\.print-80mm-only\)\s*\{[\s\S]*display:\s*contents !important;/);
  assert.match(css, /body\.print-80mm \.print-80mm-only\s*\{[\s\S]*position:\s*static;/);
  assert.match(css, /@page carta-page\s*\{[\s\S]*size:\s*140mm 216mm;/);
  assert.match(css, /\.print-document-container\s*\{[\s\S]*page:\s*carta-page;/);
  assert.equal((detail.match(/<DocumentQrCode/g) ?? []).length, 2);
});

test("tubular opt-in prints the ticket plus one isolated 80mm strip per color", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");

  assert.match(css, /@page tubular-page\s*\{[\s\S]*size:\s*80mm 250mm;/);
  assert.match(css, /\.tubular-strip-page\s*\{[\s\S]*page:\s*tubular-page;[\s\S]*break-before:\s*page;/);
  assert.match(detail, /get\("tubulares"\) === "1"/);
  assert.match(detail, /printTubulares \? \[0\] : \[0, 650, 1_300\]/);
  assert.match(detail, /tubularGroups\.map/);
  assert.match(detail, /Folio:/);
  assert.match(detail, /Color:/);
  assert.match(detail, /rollo\.serie/);
  assert.match(detail, /formatNumber\(rollo\.cantidad, \{ kind: "quantity" \}\)/);
  assert.match(detail, /formatUnit\(rollo\.unidad\)/);
  assert.match(detail, /group\.totales\[unidad\]/);
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