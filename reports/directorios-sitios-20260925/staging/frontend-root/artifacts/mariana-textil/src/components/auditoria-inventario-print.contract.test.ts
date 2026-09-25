import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceRoot = new URL("../", import.meta.url);

test("audit inventory print keeps Letter geometry and indivisible rows", async () => {
  const [css, component] = await Promise.all([
    readFile(new URL("index.css", sourceRoot), "utf8"),
    readFile(
      new URL("components/auditoria-inventario-print.tsx", sourceRoot),
      "utf8",
    ),
  ]);

  assert.match(
    css,
    /@page audit-inventory\s*\{[\s\S]*?size:\s*letter portrait;[\s\S]*?margin:\s*10mm;/,
  );
  assert.match(
    css,
    /body\.print-auditoria-inventario \.audit-inventory-row,[\s\S]*?body\.print-auditoria-inventario \.audit-inventory-signatures\s*\{[\s\S]*?break-inside:\s*avoid-page;[\s\S]*?page-break-inside:\s*avoid;/,
  );
  assert.match(component, /className={`audit-inventory-row grid/);
  assert.match(component, /data-audit-row=\{row\.serie\}/);
  assert.match(component, /className="audit-inventory-signatures /);
  assert.equal(
    (component.match(/Mariana Textil · Auditoría de Inventario/g) ?? [])
      .length,
    1,
    "the maintained component has one nonrepeating header",
  );
  assert.doesNotMatch(component, /rowsPerPage|slice\(/);
});