import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ExportarSalidasQueryParams,
  ListSalidasQueryParams,
} from "@workspace/api-zod";
function parseSalidaRange(
  schema: typeof ListSalidasQueryParams | typeof ExportarSalidasQueryParams,
  raw: Record<string, unknown>,
) {
  const query = schema.parse(raw);
  return {
    query,
    fechaDesde:
      query.fechaDesde === undefined
        ? undefined
        : new Date(`${query.fechaDesde}T00:00:00.000Z`),
    fechaHasta:
      query.fechaHasta === undefined
        ? undefined
        : new Date(`${query.fechaHasta}T00:00:00.000Z`),
  };
}

test("salidas list/export preserve calendar strings and historical UTC SQL bounds", () => {
  for (const schema of [ListSalidasQueryParams, ExportarSalidasQueryParams]) {
    const parsed = parseSalidaRange(schema, {
      fechaDesde: "2026-08-22",
      fechaHasta: "2026-08-31",
    });

    assert.equal(parsed.query.fechaDesde, "2026-08-22");
    assert.equal(parsed.query.fechaHasta, "2026-08-31");
    assert.equal(
      parsed.fechaDesde?.toISOString(),
      "2026-08-22T00:00:00.000Z",
    );
    assert.equal(
      parsed.fechaHasta?.toISOString(),
      "2026-08-31T00:00:00.000Z",
    );
  }
});

test("salidas list/export reject malformed and impossible calendar filters before SQL", () => {
  for (const schema of [ListSalidasQueryParams, ExportarSalidasQueryParams]) {
    assert.throws(() => parseSalidaRange(schema, { fechaDesde: "2026-8-22" }));
    assert.throws(() => parseSalidaRange(schema, { fechaHasta: "2026-02-30" }));
  }
});

test("salidas routes validate calendar strings before historical UTC SQL bounds", () => {
  const source = readFileSync(
    new URL("./routes/salidas.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const query = ListSalidasQueryParams\.parse\(raw\);\s*const dateBounds = parseSalidaDateBounds\(query\);/s,
  );
  assert.match(
    source,
    /const query = ExportarSalidasQueryParams\.parse\(raw\);\s*const dateBounds = parseSalidaDateBounds\(query\);/s,
  );
  assert.doesNotMatch(source, /new Date\(raw\.fecha(?:Desde|Hasta)\)/);
  assert.match(
    source,
    /new Date\(`\$\{query\.fechaDesde\}T00:00:00\.000Z`\)/,
  );
  assert.match(
    source,
    /new Date\(`\$\{query\.fechaHasta\}T00:00:00\.000Z`\)/,
  );
  assert.match(source, /fechaDesde: dateBounds\.fechaDesde/);
  assert.match(source, /fechaHasta: dateBounds\.fechaHasta/);
});