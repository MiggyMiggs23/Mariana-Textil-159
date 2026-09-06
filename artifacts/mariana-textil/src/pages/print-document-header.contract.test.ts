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

test("logo y QR documentales conservan su escala y el ticket usa logo físico de 25 mm", () => {
  assert.equal(DOCUMENT_QR_SIZE, 112);
  assert.match(entrada, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(salida, /logoSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(salida, /qrSize=\{DOCUMENT_QR_SIZE\}/);
  assert.match(viaje, /qrSize=\{160\}/);
  assert.match(viaje, /qrRenderAsCanvas/);
  assert.match(viaje, /logoClassName="h-\[115px\] w-\[115px\]"/);
  assert.match(auditoria, /logoClassName="h-\[100px\] w-\[100px\]"/);
  assert.equal((ticket.match(/h-auto w-\[25mm\]/g) ?? []).length, 1);
  assert.match(ticket, /logoClassName="h-\[72px\] w-\[72px\]"/);
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
  assert.equal(DOCUMENT_QR_SIZE, 112);
  assert.match(svg, /height="112" width="112"/);

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