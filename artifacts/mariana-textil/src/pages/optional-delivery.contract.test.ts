import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const text = (file: string) => readFile(new URL(file, import.meta.url), "utf8");
test("delivery fields are optional while public-credit prohibition remains", async () => {
  const source = await text("./pos.tsx");
  assert.doesNotMatch(source, /Faltan datos de entrega|!nombreDestinatario\.trim|!direccionEntregaSnapshot\.trim/);
  for (const id of ["nombreDestinatario", "direccionEntrega"]) {
    const label = source.match(new RegExp(`<Label htmlFor="${id}"[\\s\\S]*?</Label>`))?.[0];
    assert.ok(label);
    assert.doesNotMatch(label, /text-destructive|\*/);
    assert.match(source, new RegExp(`id="${id}"`));
  }
  assert.match(source, /documentoTipo === "NOTA" && \(clientId === "1" \|\| diasPlazo === null\)/);
  assert.match(source, /nombreDestinatario:.*nombreDestinatario.trim\(\)/);
  assert.match(source, /direccionEntregaSnapshot:.*direccionEntregaSnapshot.trim\(\)/);
});
test("trip lookup permits null recipient through independent client and folio alternatives", async () => {
  const source = await text("../../../api-server/src/routes/viajes.ts");
  assert.match(source, /or\(ilike\(ticketsTable.nombreDestinatario, term\), ilike\(clientesTable.nombre, term\), sql`CAST/);
  assert.match(source, /ticket.direccion \|\| ticket.destinatario \|\| ticket.cliente \|\| "Sin destino"/);
});
