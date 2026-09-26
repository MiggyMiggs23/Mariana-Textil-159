import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCorteListingHref,
  encodeOpaqueQueryId,
  parseDateOnlyQuery,
  parseOpaqueQueryId,
  parsePositiveQueryId,
  selectExactPageItem,
} from "./origin-drilldown";

test("cash aggregate links preserve exact period and authorized site filters", () => {
  assert.equal(
    buildCorteListingHref({
      desde: "2026-09-01",
      hasta: "2026-09-13",
      ubicacionId: 2,
      cajeroId: 8,
    }),
    "/caja/cortes?desde=2026-09-01&hasta=2026-09-13&ubicacionId=2&cajeroId=8",
  );
});

test("origin query ids accept only positive safe integer ids", () => {
  assert.equal(parsePositiveQueryId("?sesionId=42", "sesionId"), 42);
  assert.equal(parsePositiveQueryId(undefined, "sesionId"), null);
  assert.equal(parsePositiveQueryId("?movementId=9007199254740992", "movementId"), null);
  assert.equal(parsePositiveQueryId("?movementId=0", "movementId"), null);
  assert.equal(parsePositiveQueryId("?movementId=1.5", "movementId"), null);
  assert.equal(parsePositiveQueryId("?movementId=javascript:alert(1)", "movementId"), null);
});

test("opaque movement ids preserve their exact source representation", () => {
  assert.equal(parseOpaqueQueryId("?movimientoId=credito%2Fsource%3A9", "movimientoId"), "credito/source:9");
  assert.equal(parseOpaqueQueryId(undefined, "movimientoId"), null);
  assert.equal(encodeOpaqueQueryId("credito/source:9"), "credito%2Fsource%3A9");
});

test("origin date filters accept calendar dates and ignore missing or invalid values", () => {
  assert.equal(parseDateOnlyQuery("?desde=2024-02-29", "desde"), "2024-02-29");
  assert.equal(parseDateOnlyQuery("?hasta=2024-02-30", "hasta"), null);
  assert.equal(parseDateOnlyQuery(undefined, "hasta"), null);
});

test("exact movement selection walks every paginated page", () => {
  const pageOne = [
    { id: "source-10", documentoId: 12 },
    { id: "source-11", documentoId: 11 },
  ];
  const pageTwo = [
    { id: "credito/source:12-b", documentoId: 12 },
    { id: "credito/source:12-a", documentoId: 12 },
  ];
  assert.deepEqual(
    selectExactPageItem(pageOne, "credito/source:12-a", 1, 2, (item) => item.id),
    { kind: "next-page", page: 2 },
  );
  assert.deepEqual(
    selectExactPageItem(pageTwo, "credito/source:12-a", 2, 2, (item) => item.id),
    { kind: "found", item: { id: "credito/source:12-a", documentoId: 12 } },
  );
  assert.deepEqual(
    selectExactPageItem(pageTwo, "missing-source", 2, 2, (item) => item.id),
    { kind: "not-found" },
  );
});