import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const source = (path: string) => readFile(new URL(`artifacts/mariana-textil/src/${path}`, root), "utf8");

test("Task 51 frontend contract keeps dispatch documents operational and price-free", async () => {
  const [pos, ticket, camionetas, choferes, app, detail, document, css, spec, viajes] = await Promise.all([
    source("pages/pos.tsx"), source("pages/ticket-detail.tsx"), source("pages/configuracion/camionetas.tsx"),
    source("pages/configuracion/choferes.tsx"), source("App.tsx"), source("pages/viaje-detail.tsx"),
    source("pages/viaje-documento.tsx"), source("index.css"),
    readFile(new URL("lib/api-spec/openapi.yaml", root), "utf8"), source("pages/viajes.tsx"),
  ]);
  assert.match(pos, /documentoTipo.*NOTA|NOTA.*documentoTipo/s);
  assert.match(ticket, /notaSinPrecios|isNota/);
  const noPriceContract = spec.slice(spec.indexOf("TicketDocumentoImpresionSinPrecios:"), spec.indexOf("TicketLineaImpresionConPrecios:"));
  assert.doesNotMatch(noPriceContract, /precioUnitario|precioSugerido|subtotal|iva|total/);
  assert.match(ticket, /const isPriceless = !isInternal && printData\.notaSinPrecios;/);
  assert.match(ticket, /!isPriceless && \([\s\S]*precioUnitario/);
  assert.match(ticket, /groupPrintLinesByModality\(printData\.lineas\)/);
  assert.doesNotMatch(ticket.slice(ticket.indexOf("{/* Nota Print Pages */}")), /serieRollo/);
  for (const catalog of [camionetas, choferes]) assert.doesNotMatch(catalog, /DELETE|Eliminar|Trash2/);
  assert.match(app, /path="\/viajes"/); assert.match(app, /path="\/viajes\/:id\/documento"/);
  assert.match(detail, /href=\{`\/tickets\/\$\{x\.id\}`\}/); assert.match(detail, /href=\{`\/salidas\/\$\{x\.id\}`\}/);
  assert.match(document, /min-h-\[279mm\].*w-\[216mm\]/);
  assert.match(css, /@page viaje-page\s*\{[\s\S]*size:\s*216mm 279mm;/);
  assert.match(viajes, /import \{ Plus, Truck \} from "lucide-react"/);
  assert.match(viajes, /<Truck className="text-primary" \/>Viajes/);
  assert.doesNotMatch(viajes, /\bRoute\b/);
});