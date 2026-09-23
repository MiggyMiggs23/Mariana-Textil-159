import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ListEntradasQueryParams } from "@workspace/api-zod";
import { parseMexicoDateQuery } from "./lib/mexico-date";

function parseEntradasReadQuery(raw: Record<string, unknown>) {
  const query = ListEntradasQueryParams.parse(raw);
  return {
    ...query,
    fechaDesde: parseMexicoDateQuery(query.fechaDesde, "start"),
    fechaHasta: parseMexicoDateQuery(query.fechaHasta, "end"),
  };
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
  );
  assert.throws(
    () => parseEntradasReadQuery({ fechaHasta: "2026-02-30" }),
  );
});

test("the entradas read handler validates calendar strings before Mexico bounds", () => {
  const source = readFileSync(new URL("./routes/inventario.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /const q = ListEntradasQueryParams\.parse\(req\.query\);\s*const fechaDesde = parseMexicoDateQuery\(q\.fechaDesde, "start"\);\s*const fechaHasta = parseMexicoDateQuery\(q\.fechaHasta, "end"\);/s,
  );
  assert.match(source, /if \(fechaDesde\) conditions\.push\(gte\(entradasTable\.fecha, fechaDesde\)\)/);
  assert.match(source, /if \(fechaHasta\) conditions\.push\(lte\(entradasTable\.fecha, fechaHasta\)\)/);
});