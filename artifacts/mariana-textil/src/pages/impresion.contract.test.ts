import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("Entrada page specifies 216x279mm and has exactly 20 rows for pagination", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const entrada = await readFile(new URL("artifacts/mariana-textil/src/pages/entrada-documento.tsx", root), "utf8");

  assert.match(css, /@page entrada-page\s*\{[\s\S]*size:\s*216mm 279mm;/);
  assert.match(css, /\.entrada-page-print\s*\{[\s\S]*page:\s*entrada-page;/);
  assert.match(entrada, /className=[\s\S]*?entrada-page-print[\s\S]*?w-\[216mm\]\s*h-\[279mm\]/);
  assert.match(entrada, /const rowsPerPage = 20;/);
  assert.match(entrada, /Math\.max\(0, rowsPerPage - pageLineas\.length\)/);
  assert.match(entrada, /RECIBIDO POR/i);
  assert.match(entrada, /REVISADO POR/i);
  assert.match(entrada, /AUTORIZADO POR/i);
  assert.match(entrada, /<PrintableDocumentHeader[\s\S]*qrUrl=\{documentUrl\}/);
  assert.match(entrada, /\/entradas\/\$\{entrada\.id\}\/documento/);
  assert.match(entrada, /qrLabel=\{`QR para ver entrada/);
});

test("Salida page specifies A6 landscape and has correct control signatures", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const salida = await readFile(new URL("artifacts/mariana-textil/src/pages/salida-documento.tsx", root), "utf8");

  assert.match(css, /@page salida-page\s*\{[\s\S]*size:\s*148mm 105mm;/);
  assert.match(css, /\.salida-page-print\s*\{[\s\S]*page:\s*salida-page;/);
  assert.match(salida, /className=[\s\S]*?salida-page-print[\s\S]*?w-\[148mm\]\s*h-\[105mm\]/);
  assert.match(salida, /Generó:/);
  assert.match(salida, /Entregó:/);
  assert.match(salida, /Firma de Entrega/);
  assert.match(salida, /Firma de Recibe/);
  assert.match(salida, /tab=recepcion&id=\$\{salida\.id\}/);
  assert.match(salida, /<PrintableDocumentHeader[\s\S]*qrUrl=\{qrUrl\}/);
  assert.match(css, /\.salida-page-print:last-child\s*\{[\s\S]*page-break-after:\s*auto;/);
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

test("Credit Note (ticket-detail) prints exactly 216x140mm in two copies with internal QR", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");

  // CSS constraints
  assert.match(css, /@page credito-page\s*\{[\s\S]*size:\s*216mm 140mm;/);
  assert.match(css, /\.credito-page-print\s*\{[\s\S]*page:\s*credito-page;/);
  assert.match(css, /body\.print-credito \.print-credito-only\s*\{[\s\S]*page:\s*credito-page;/);
  assert.match(detail, /credito-page-print[\s\S]*w-\[216mm\][\s\S]*h-\[140mm\]/);

  // Two copies logic (COPIA INTERNA / COPIA CLIENTE)
  assert.match(detail, /\[printInterna, printCliente\]\.map\(/);
  assert.match(detail, /COPIA INTERNA/);
  assert.match(detail, /COPIA CLIENTE/);

  // QR only on internal
  assert.match(detail, /qrUrl=\{isInternal \? qrUrl : undefined\}/);

  // Auto-print routing based on nota vs thermal
  assert.match(detail, /const printClass = isNota \? "print-credito" : "print-80mm";/);

  // Cobros routing to detail with print parameter
  assert.match(cobros, /setLocation\(\`\/tickets\/\$\{printedTicketId\}\?print=3\`\);/);
});

test("Ticket and media carta declare their own physical page sizes", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  assert.match(css, /@page ticket-page\s*\{[\s\S]*size:\s*80mm 200mm;/);
  assert.match(css, /\.print-ticket-container\s*\{[\s\S]*page:\s*ticket-page;/);
  assert.match(css, /body\.print-80mm #root \*:has\(\.print-80mm-only\)\s*\{[\s\S]*display:\s*contents !important;/);
  assert.match(css, /body\.print-80mm \.print-80mm-only\s*\{[\s\S]*position:\s*static;/);
  assert.match(css, /@page carta-page\s*\{[\s\S]*size:\s*140mm 216mm;/);
  assert.match(css, /\.print-document-container\s*\{[\s\S]*page:\s*carta-page;/);
  assert.equal((detail.match(/<DocumentQrCode/g) ?? []).length, 2);
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