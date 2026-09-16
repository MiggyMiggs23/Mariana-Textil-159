import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ListEntradasQueryParams } from "@workspace/api-zod";
import { parseMexicoDateQuery } from "./lib/mexico-date";

function parseEntradasReadQuery(raw: Record<string, unknown>) {
  return ListEntradasQueryParams.parse({
    ...raw,
    fechaDesde: parseMexicoDateQuery(raw.fechaDesde, "start"),
    fechaHasta: parseMexicoDateQuery(raw.fechaHasta, "end"),
  });
}

test("GET /entradas round-trips strict HTML dates into Mexico boundaries", () => {
  const query = parseEntradasReadQuery({
    fechaDesde: "2026-08-22",
    fechaHasta: "2026-08-31",
    page: "2",
    pageSize: "10",
  });

  assert.equal(query.fechaDesde?.toISOString(), "2026-08-22T06:00:00.000Z");
  assert.equal(query.fechaHasta?.toISOString(), "2026-09-01T05:59:59.999Z");
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 10);
});

test("GET /entradas rejects malformed or impossible date-only filters", () => {
  assert.throws(
    () => parseEntradasReadQuery({ fechaDesde: "2026-8-22" }),
    /Expected date/,
  );
  assert.throws(
    () => parseEntradasReadQuery({ fechaHasta: "2026-02-30" }),
    /Expected date/,
  );
});

test("the entradas read handler normalizes dates before generated parsing", () => {
  const source = readFileSync(new URL("./routes/inventario.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /ListEntradasQueryParams\.parse\(\{\s*\.\.\.req\.query,\s*fechaDesde: parseMexicoDateQuery\(req\.query\.fechaDesde, "start"\),\s*fechaHasta: parseMexicoDateQuery\(req\.query\.fechaHasta, "end"\),/s,
  );
  assert.match(source, /if \(q\.fechaDesde\) conditions\.push\(gte\(entradasTable\.fecha, q\.fechaDesde\)\)/);
  assert.match(source, /if \(q\.fechaHasta\) conditions\.push\(lte\(entradasTable\.fecha, q\.fechaHasta\)\)/);
});