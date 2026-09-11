import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./lib/kardex.ts", import.meta.url), "utf8");
const salidas = readFileSync(new URL("./lib/salidas.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../mariana-textil/src/pages/movimientos.tsx", import.meta.url), "utf8");
// Execute the actual resolver without importing the application's database.
const resolverSource = source.slice(source.indexOf("function resolveDocument("), source.indexOf("export async function getKardex("));
const js = ts.transpileModule(resolverSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const resolveDocument = new Function(`${js}; return resolveDocument;`)();

test("existing movement document resolver links both sale document types", () => {
  for (const tipo of ["TICKET", "NOTA"]) {
    assert.deepEqual(resolveDocument({ tipo, id: "42" }, new Map(), new Map([[42, 123]]), new Map()), {
      label: `${tipo === "NOTA" ? "Nota" : "Ticket"} 123`,
      route: "/tickets/42",
    });
  }
  assert.deepEqual(resolveDocument({ tipo: "NOTA", id: "99" }, new Map(), new Map(), new Map()), { label: null, route: null });
});

test("note IDs are loaded and searchable, and the sale writer supplies traceability fields", () => {
  assert.match(source, /documentoTipo\} in \('TICKET', 'NOTA'\)/);
  assert.match(source, /kardex_origen\.documento_tipo in \('TICKET', 'NOTA'\)/);
  assert.match(source, /\.filter\(\(reference\) => \(reference\.tipo === "TICKET" \|\| reference\.tipo === "NOTA"\) && reference\.id\)/);
  assert.match(source, /const referencedTicketId =\s*\(reference\.tipo === "TICKET" \|\| reference\.tipo === "NOTA"\)/);
  assert.match(salidas, /documentoTipo: ticket\?\.documentoTipo \?\? "TICKET", documentoId: String\(ticketId\), salidaId: r\.salidaId/);
  assert.equal((page.match(/row\.documentoRuta \?/g) ?? []).length, 2, "desktop and mobile use the enriched document route");
});