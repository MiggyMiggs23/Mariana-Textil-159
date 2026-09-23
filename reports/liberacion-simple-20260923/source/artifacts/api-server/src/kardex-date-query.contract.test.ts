import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ExportKardexXlsxQueryParams,
  GetKardexGroupedQueryParams,
  GetKardexQueryParams,
} from "@workspace/api-zod";
import { parseMexicoDateQuery } from "./lib/mexico-date";

test("kardex query schemas retain calendar strings before SQL boundary conversion", () => {
  for (const schema of [
    GetKardexQueryParams,
    GetKardexGroupedQueryParams,
    ExportKardexXlsxQueryParams,
  ]) {
    const query = schema.parse({
      desde: "2026-08-22",
      hasta: "2026-08-31",
    });
    assert.equal(query.desde, "2026-08-22");
    assert.equal(query.hasta, "2026-08-31");
    assert.equal(
      parseMexicoDateQuery(query.desde, "start")?.toISOString(),
      "2026-08-22T06:00:00.000Z",
    );
    assert.equal(
      parseMexicoDateQuery(query.hasta, "end")?.toISOString(),
      "2026-09-01T05:59:59.999Z",
    );
  }
});

test("kardex query schemas reject malformed and impossible calendar filters", () => {
  for (const schema of [
    GetKardexQueryParams,
    GetKardexGroupedQueryParams,
    ExportKardexXlsxQueryParams,
  ]) {
    assert.throws(() => schema.parse({ desde: "2026-8-22" }));
    assert.throws(() => schema.parse({ hasta: "2026-02-30" }));
  }
});

test("kardex routes convert dates only after generated query validation", () => {
  const source = readFileSync(
    new URL("./routes/inventario.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /normalized\[key\] = parseMexicoDateQuery\(/,
  );
  assert.match(
    source,
    /const q = GetKardexQueryParams\.parse\(normalizeKardexQuery\(req\.query\)\);\s*const \{ invalid, \.\.\.dateBounds \} = parseKardexDateBounds\(q\);/s,
  );
  assert.match(
    source,
    /const q = GetKardexGroupedQueryParams\.parse\(\s*normalizeKardexQuery\(req\.query\),\s*\);\s*const \{ invalid, \.\.\.dateBounds \} = parseKardexDateBounds\(q\);/s,
  );
  assert.match(
    source,
    /const q = ExportKardexXlsxQueryParams\.parse\(\s*normalizeKardexQuery\(req\.query\),\s*\);\s*const \{ invalid, \.\.\.dateBounds \} = parseKardexDateBounds\(q\);/s,
  );
  assert.match(source, /kardexFilters\(\{ \.\.\.q, \.\.\.dateBounds \}/);
});