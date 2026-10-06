import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
test("floor catalogs and inventory helpers consistently use numeric level then id", () => {
  for (const path of ["./routes/locations.ts", "./routes/auditorias-inventario.ts", "./routes/inventario.ts", "./lib/inventario.ts", "./lib/salidas.ts", "./lib/auditoria-inventario.ts"]) {
    const source = read(path);
    assert.ok(source.includes(".orderBy(asc(pisosTable.nivel), asc(pisosTable.id))"), path);
    assert.ok(!source.includes(".orderBy(asc(pisosTable.nombre))"), path);
    assert.ok(!source.includes(".orderBy(asc(pisosTable.id))"), path);
  }
});
test("additive schema never assigns levels inferred from floor names", () => {
  const source = read("../../../lib/db/src/lib/pisos-schema.ts");
  assert.ok(source.includes("ALTER TABLE pisos ADD COLUMN IF NOT EXISTS nivel integer;"));
  assert.doesNotMatch(source, /UPDATE\s+pisos|nivel\s+integer\s+(?:NOT NULL|DEFAULT)/i);
});