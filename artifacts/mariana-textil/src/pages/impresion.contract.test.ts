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
  assert.match(entrada, /QRCodeSVG/);
  assert.match(entrada, /\/entradas\/\$\{entrada\.id\}\/documento/);
  assert.match(entrada, /ESCANEAR PARA VER/);
});

test("Salida page specifies 216x140mm exactly and has correct signatures", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const salida = await readFile(new URL("artifacts/mariana-textil/src/pages/salida-documento.tsx", root), "utf8");

  assert.match(css, /@page salida-page\s*\{[\s\S]*size:\s*216mm 140mm;/);
  assert.match(css, /\.salida-page-print\s*\{[\s\S]*page:\s*salida-page;/);
  assert.match(salida, /className=[\s\S]*?salida-page-print[\s\S]*?w-\[216mm\]\s*h-\[140mm\]/);
  assert.match(salida, /ENTREGA/);
  assert.match(salida, /TRANSPORTA/);
  assert.match(salida, /RECIBE/);
  assert.match(salida, /tab=recepcion&id=\$\{salida\.id\}/);
  assert.match(salida, /ESCANEAR PARA RECIBIR/);
  assert.match(css, /\.salida-page-print:last-child\s*\{[\s\S]*page-break-after:\s*auto;/);
});

test("Labels have exact physical size without padding", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  assert.match(css, /@page label\s*\{[\s\S]*size:\s*100mm 70mm;[\s\S]*margin:\s*0;/);
  assert.match(css, /\.label-page\s*\{[\s\S]*page:\s*label;[\s\S]*width:\s*100mm;[\s\S]*height:\s*70mm;[\s\S]*margin:\s*0;/);
  assert.match(css, /body\.printing-labels\s*\{[\s\S]*margin:\s*0;[\s\S]*padding:\s*0;/);
  assert.match(css, /body\.printing-labels \.etiquetas-print\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*0;[\s\S]*top:\s*0;/);
});

test("Replit development banner is hidden from every print medium", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  assert.match(css, /@media print\s*\{[\s\S]*#replit-dev-banner,[\s\S]*\[data-replit-dev-banner\][\s\S]*display:\s*none !important;/);
});

test("Thermal label uses spacing instead of vertical dividers and enlarges logo and QR", async () => {
  const label = await readFile(new URL("artifacts/mariana-textil/src/components/label-print.tsx", root), "utf8");
  assert.doesNotMatch(label, /border-l border-gray-400/);
  assert.match(label, /gap-\[2mm\]/);
  assert.match(label, /max-w-\[30mm\]/);
  assert.match(label, /width="29mm"/);
});

test("Credit Note (ticket-detail) prints exactly 216x140mm in two copies with internal QR", async () => {
  const css = await readFile(new URL("artifacts/mariana-textil/src/index.css", root), "utf8");
  const detail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");

  // CSS constraints
  assert.match(css, /@page credito-page\s*\{[\s\S]*size:\s*216mm 140mm;/);
  assert.match(css, /\.credito-page-print\s*\{[\s\S]*page:\s*credito-page;/);
  assert.match(detail, /credito-page-print[\s\S]*w-\[216mm\][\s\S]*h-\[140mm\]/);

  // Two copies logic (COPIA INTERNA / COPIA CLIENTE)
  assert.match(detail, /\[true, false\]\.map\(\(isInternal/);
  assert.match(detail, /COPIA INTERNA/);
  assert.match(detail, /COPIA CLIENTE/);

  // QR only on internal
  assert.match(detail, /isInternal && \([\s\S]*?<QRCodeSVG/);

  // Auto-print routing based on credit vs thermal
  assert.match(detail, /const printClass = esCredito \? "print-credito" : "print-80mm";/);

  // Cobros routing to detail with print parameter
  assert.match(cobros, /setLocation\(\`\/tickets\/\$\{printedTicketId\}\?print=3\`\);/);
});