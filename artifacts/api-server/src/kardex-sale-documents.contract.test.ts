import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  resolveDocument,
  resolveMovementReference,
} from "./lib/kardex-document";

const source = readFileSync(new URL("./lib/kardex.ts", import.meta.url), "utf8");
const documentSource = readFileSync(new URL("./lib/kardex-document.ts", import.meta.url), "utf8");
const salidas = readFileSync(new URL("./lib/salidas.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../../mariana-textil/src/App.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../mariana-textil/src/pages/movimientos.tsx", import.meta.url), "utf8");

test("existing movement document resolver links both sale document types", () => {
  for (const tipo of [
    "TICKET",
    "NOTA",
    "TICKET_BOLSA_NORMAL",
    "TICKET_PIEZA_NORMAL",
    "TICKET_BOLSA_METREADO",
  ]) {
    assert.deepEqual(resolveDocument({ tipo, id: "42" }, new Map(), new Map([[42, 123]]), new Map()), {
      label: `${tipo === "NOTA" ? "Nota" : "Ticket"} 123`,
      route: "/tickets/42",
    });
  }
  assert.deepEqual(resolveDocument({ tipo: "NOTA", id: "99" }, new Map(), new Map(), new Map()), { label: null, route: null });
});

test("document resolver only follows primary IDs, never a different document folio", () => {
  const entradas = new Map([[7, { id: 7, label: "MAT-000042" }]]);
  const tickets = new Map([[11, 9001]]);
  const salidas = new Map([[13, "MAT-000314"]]);

  assert.deepEqual(
    resolveDocument({ tipo: "ENTRADA", id: "7" }, entradas, new Map(), new Map()),
    { label: "Entrada MAT-000042", route: "/entradas/7/documento" },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "ENTRADA", id: "42" }, entradas, new Map(), new Map()),
    { label: null, route: null },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "TICKET", id: "11" }, new Map(), tickets, new Map()),
    { label: "Ticket 9001", route: "/tickets/11" },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "TICKET", id: "9001" }, new Map(), tickets, new Map()),
    { label: null, route: null },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "SALIDA", id: "13" }, new Map(), new Map(), salidas),
    { label: "Salida MAT-000314", route: "/salidas/13" },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "SALIDA", id: null }, new Map(), new Map(), salidas),
    { label: null, route: null },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "RECEPCION_SALIDA", id: "13" }, new Map(), new Map(), salidas),
    { label: "Recepción de salida MAT-000314", route: "/salidas/13" },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "RECEPCION_SALIDA", id: "99" }, new Map(), new Map(), salidas),
    { label: null, route: null },
  );
  assert.deepEqual(
    resolveDocument({ tipo: null, id: null }, new Map(), new Map(), new Map()),
    { label: null, route: null },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "TICKET_METRO_METREADO", id: "11" }, new Map(), tickets, new Map()),
    { label: "Ticket 9001", route: "/tickets/11" },
  );
  assert.deepEqual(
    resolveDocument({ tipo: "TICKET_DESCONOCIDO", id: "11" }, new Map(), tickets, new Map()),
    { label: null, route: null },
  );
});

test("credit movement references use the live owner client route", () => {
  assert.deepEqual(
    resolveDocument(
      { tipo: "MOVIMIENTO_CREDITO", id: "77" },
      new Map(),
      new Map(),
      new Map(),
      new Map([[77, { clienteId: 42 }]]),
    ),
    {
      label: "Movimiento de crédito 77",
      route: "/clientes/42/movimientos/77",
    },
  );
  assert.deepEqual(
    resolveDocument(
      { tipo: "MOVIMIENTO_CREDITO", id: "77" },
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    ),
    { label: null, route: null },
  );
});

test("entry history uses the rollo FK when a folio collides with another entry ID", () => {
  const entradas = new Map([
    [7, { id: 7, label: "MAT-000042" }],
    [42, { id: 42, label: "MAT-000007" }],
  ]);
  const source = {
    tipo: "RECEPCION",
    documentoTipo: "ENTRADA",
    documentoId: "42",
    movimientoOrigenId: null,
    rolloId: 99,
    recepcionId: 7,
  };
  const stableReference = resolveMovementReference(source);

  assert.deepEqual(stableReference, { tipo: "ENTRADA", id: "7" });
  assert.deepEqual(
    resolveDocument(stableReference, entradas, new Map(), new Map()),
    { label: "Entrada MAT-000042", route: "/entradas/7/documento" },
  );
  assert.deepEqual(
    resolveDocument(
      resolveMovementReference({ ...source, recepcionId: null }),
      entradas,
      new Map(),
      new Map(),
    ),
    { label: null, route: null },
  );
});

test("cancellation only inherits a known original reference", () => {
  const original = {
    tipo: "RECEPCION",
    documentoTipo: "ENTRADA",
    documentoId: "42",
    movimientoOrigenId: null,
    rolloId: 99,
    recepcionId: 7,
  };
  assert.deepEqual(
    resolveMovementReference(
      { ...original, tipo: "CANCELACION", documentoTipo: null, documentoId: null },
      { tipo: "ENTRADA", id: "42", rolloId: 99 },
    ),
    { tipo: "ENTRADA", id: "7" },
  );
  assert.deepEqual(
    resolveMovementReference(
      { ...original, tipo: "CANCELACION", documentoTipo: null, documentoId: null },
      null,
    ),
    { tipo: null, id: null },
  );
  assert.deepEqual(
    resolveMovementReference(
      { ...original, tipo: "CANCELACION", documentoTipo: null, documentoId: null },
      { tipo: "ENTRADA", id: "42", rolloId: 100 },
    ),
    { tipo: null, id: null },
  );
  for (const tipo of ["TICKET", "NOTA", "SALIDA"]) {
    assert.deepEqual(
      resolveMovementReference(
        { ...original, tipo: "CANCELACION", documentoTipo: null, documentoId: null },
        { tipo, id: "42", rolloId: 99 },
      ),
      { tipo, id: "42" },
    );
    assert.deepEqual(
      resolveMovementReference(
        { ...original, tipo: "CANCELACION", documentoTipo: null, documentoId: null },
        { tipo, id: "42", rolloId: 100 },
      ),
      { tipo: null, id: null },
    );
  }
  assert.deepEqual(
    resolveMovementReference(
      { ...original, tipo: "CANCELACION", documentoTipo: null, documentoId: null, rolloId: null },
      { tipo: "TICKET", id: "42", rolloId: 99 },
    ),
    { tipo: null, id: null },
  );
});

test("note IDs are loaded and searchable, and the sale writer supplies traceability fields", () => {
  for (const tipo of [
    "TICKET",
    "NOTA",
    "TICKET_BOLSA_NORMAL",
    "TICKET_PIEZA_NORMAL",
    "TICKET_BOLSA_METREADO",
  ]) {
    assert.match(documentSource, new RegExp(`"${tipo}"`));
  }
  assert.match(documentSource, /TICKET_DOCUMENT_TYPES = \[[\s\S]*TICKET_BOLSA_METREADO/);
  assert.match(documentSource, /TICKET_NAVIGATION_DOCUMENT_TYPES = \[[\s\S]*TICKET_METRO_METREADO/);
  assert.match(source, /ticketDocumentTypesSql = sql\.join/);
  assert.match(
    source,
    /isTicketNavigationDocumentType\(reference\.tipo\)\s*&&\s*reference\.id/,
  );
  assert.match(appSource, /path="\/salidas\/:id"/);
  assert.doesNotMatch(
    documentSource,
    /\/salidas\/\$\{salidaId\}\/documento\/recepcion/,
  );
  assert.match(source, /const referencedTicketId =\s*isTicketDocumentType\(reference\.tipo\)/);
  assert.match(salidas, /if \(!ticket\)[\s\S]*TICKET_NOT_FOUND/);
  assert.match(
    salidas,
    /documentoTipo:\s*ticket\.documentoTipo,\s*documentoId:\s*String\(ticketId\),\s*salidaId:\s*r\.salidaId/,
  );
  assert.equal((page.match(/row\.documentoRuta \?/g) ?? []).length, 2, "desktop and mobile use the enriched document route");
});