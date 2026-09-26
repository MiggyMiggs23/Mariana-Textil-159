import assert from "node:assert/strict";
import test from "node:test";
import { mapReadWorkload, withReadWorkload } from "./read-workload";

test("catalogues share three slots, preserve global order and never queue thousands of DB loans", async () => {
  let active = 0, peak = 0;
  const work = async (n: number) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, n % 3));
    active--; return n * 2;
  };
  const a = Array.from({ length: 101 }, (_, i) => i);
  const [one, two, detail] = await Promise.all([
    mapReadWorkload(a, work), mapReadWorkload(a, work), withReadWorkload(() => work(999)),
  ]);
  assert.equal(peak, 3); assert.equal(active, 0);
  assert.deepEqual(one, a.map(n => n * 2)); assert.deepEqual(two, one); assert.equal(detail, 1998);
});
test("failure is explicit, halts further admission for that list and slots recover", async () => {
  let calls = 0;
  await assert.rejects(() => mapReadWorkload(Array.from({ length: 1000 }, (_, i) => i), async n => {
    calls++; if (n === 0) throw new Error("source failure");
    await new Promise(resolve => setTimeout(resolve, 2)); return n;
  }), /source failure/);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(calls <= 3);
  assert.deepEqual(await mapReadWorkload([1, 2, 3, 4], async n => n), [1, 2, 3, 4]);
  assert.deepEqual(await mapReadWorkload([], async n => n), []);
});