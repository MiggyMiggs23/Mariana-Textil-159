import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_STORE_ORDER, orderStores } from "./store-order";

test("orders known stores canonically and unknown stores by name then id", () => {
  const rows = [
    { ubicacionId: 8, nombreUbicacion: "Zacatecas" },
    { ubicacionId: 9, nombreUbicacion: "Álamo" },
    { ubicacionId: 5, nombreUbicacion: "Coco" },
    { ubicacionId: 7, nombreUbicacion: "Mariana" },
    { ubicacionId: 3, nombreUbicacion: "Cruces" },
    { ubicacionId: 2, nombreUbicacion: "Álamo" },
  ];
  assert.deepEqual(CANONICAL_STORE_ORDER, ["Mariana", "Coco", "Cruces"]);
  assert.deepEqual(orderStores(rows).map((row) => row.ubicacionId), [7, 5, 3, 2, 9, 8]);
  assert.deepEqual(rows.map((row) => row.ubicacionId), [8, 9, 5, 7, 3, 2]);
});