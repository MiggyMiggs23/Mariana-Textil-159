import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ZXing from "@zxing/library";
import {
  DOCUMENT_QR_SIZE,
  DocumentQrCode,
} from "@/components/document-qr-code";

const { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } =
  ZXing;

const root = new URL("./", import.meta.url);
const files = await Promise.all(
  [
    "entrada-documento.tsx",
    "salida-documento.tsx",
    "viaje-documento.tsx",
    "auditorias-inventario.tsx",
    "ticket-detail.tsx",
  ].map((name) => readFile(new URL(name, root), "utf8")),
);
const [entrada, salida, viaje, auditoria, ticket] = files;

test("los documentos usan logo centrado y QR derecho compartidos", () => {
  for (const document of [entrada, salida, viaje, auditoria]) {
    assert.match(document, /<PrintableDocumentHeader/);
    assert.match(document, /qrUrl=/);
    assert.match(document, /absoluteAppUrl\(/);
  }
  assert.match(ticket, /<PrintableDocumentHeader/);
  assert.match(ticket, /ticketDocumentUrl = absoluteAppUrl\(`\/tickets\//);
});

test("logo y QR aumentan cincuenta por ciento sobre cada formato anterior", () => {
  assert.equal(DOCUMENT_QR_SIZE, 96);
  assert.match(entrada, /logoClassName="h-\[72px\] w-\[72px\]"/);
  assert.match(salida, /logoClassName="h-\[60px\] w-\[60px\]"/);
  assert.match(viaje, /logoClassName="h-\[96px\] w-\[96px\]"/);
  assert.match(auditoria, /logoClassName="h-\[84px\] w-\[84px\]"/);
  assert.equal((ticket.match(/h-\[64\.5mm\] w-\[57mm\]/g) ?? []).length, 2);
  assert.match(ticket, /logoClassName="h-\[60px\] w-\[60px\]"/);
});

test("la nota interna lleva QR y la copia cliente conserva el espacio sin QR", () => {
  assert.match(ticket, /qrUrl=\{isInternal \? qrUrl : undefined\}/);
  assert.match(ticket, /qrLabel=\{isInternal \?/);
  assert.doesNotMatch(ticket, /new URL\(["'`]https?:\/\//);
});

test("el QR documental renderiza grande, conserva margen y se decodifica", () => {
  const expected = "https://textiles.example/salidas?tab=recepcion&id=321";
  const svg = renderToStaticMarkup(
    createElement(DocumentQrCode, { url: expected, label: "Documento" }),
  );
  assert.equal(DOCUMENT_QR_SIZE, 96);
  assert.match(svg, /height="96" width="96"/);

  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const blackPath = svg.match(/fill="#000000" d="([^"]+)"/);
  assert.ok(viewBox && blackPath);
  const modules = Number(viewBox[1]);
  const scale = 8;
  const width = modules * scale;
  const pixels = new Int32Array(width * width).fill(0xffffffff);
  for (const run of blackPath[1].matchAll(
    /M\s*(\d+)[ ,]\s*(\d+)\s*h(\d+)v1H\d+z/g,
  )) {
    const [, rawX, rawY, rawLength] = run;
    const x = Number(rawX);
    const y = Number(rawY);
    const length = Number(rawLength);
    for (let py = y * scale; py < (y + 1) * scale; py += 1) {
      pixels.fill(0xff000000, py * width + x * scale, py * width + (x + length) * scale);
    }
  }
  const bitmap = new BinaryBitmap(
    new HybridBinarizer(new RGBLuminanceSource(pixels, width, width)),
  );
  assert.equal(new QRCodeReader().decode(bitmap).getText(), expected);
});