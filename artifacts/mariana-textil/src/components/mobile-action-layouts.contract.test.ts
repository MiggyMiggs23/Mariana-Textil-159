import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

const page = (name: string) =>
  readFile(
    new URL(`artifacts/mariana-textil/src/pages/${name}.tsx`, root),
    "utf8",
  );

test("document and ticket actions stack safely on phones", async () => {
  const [entrada, ticket] = await Promise.all([
    page("entrada-documento"),
    page("ticket-detail"),
  ]);

  assert.match(
    entrada,
    /flex flex-col gap-3[^"]*sm:flex-row[^"]*sm:justify-between/,
  );
  assert.match(entrada, /className="w-full sm:w-auto" onClick=\{\(\) => void printWhenReady\("print-entrada"\)\}/);

  assert.match(
    ticket,
    /flex flex-col gap-4 no-print sm:flex-row sm:items-center sm:justify-between/,
  );
  assert.match(ticket, /flex flex-col gap-3 sm:flex-row sm:flex-wrap/);
  assert.equal((ticket.match(/className="w-full sm:w-auto"/g) ?? []).length, 3);
  assert.match(ticket, /CardContent className="overflow-x-auto p-0">[\s\S]*min-w-\[700px\]/);
});

test("client and roll detail retain responsive action and movement layouts", async () => {
  const [cliente, rollo] = await Promise.all([
    page("cliente-detail"),
    page("rollo-detail"),
  ]);

  assert.match(
    cliente,
    /flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between/,
  );
  assert.match(cliente, /<div className="flex flex-wrap gap-2">/);

  assert.match(
    rollo,
    /flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between/,
  );
  assert.match(
    rollo,
    /flex flex-col items-start gap-3 sm:flex-row sm:justify-between/,
  );
  assert.match(rollo, /flex flex-wrap items-center gap-4 text-sm text-muted-foreground/);
  assert.match(rollo, /Badge variant="outline" className="shrink-0 text-sm bg-background"/);
  assert.match(rollo, /grid grid-cols-1 gap-6 border-y py-6 sm:grid-cols-2 md:grid-cols-4/);
  assert.match(rollo, /CardContent className="overflow-x-auto p-0">[\s\S]*<Table className="min-w-\[700px\]">/);
});