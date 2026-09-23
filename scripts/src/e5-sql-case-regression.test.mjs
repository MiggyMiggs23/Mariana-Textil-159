import fs from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
const e5=fs.readFileSync(new URL("../../reports/e5/01-preparado.sql",import.meta.url),"utf8");
const e11=fs.readFileSync(new URL("../../reports/e11/01-preparado.sql",import.meta.url),"utf8");
const expression="CASE WHEN returned>0 THEN 'DEVUELTO' WHEN total=0 THEN 'PENDIENTE'\n          WHEN total=r.importe THEN 'APLICADO' ELSE 'PARCIAL' END";
function verify(body,consumer) {
  assert.equal(body.split(`(${expression})`).length,2,"Unique parenthesized CASE required in IF condition");
  const start=body.indexOf("CREATE FUNCTION public.e5_graph_guard()");
  assert.ok(start>=0);const a=body.indexOf("AS $$",start)+5,b=body.indexOf("$$;",a);
  assert.ok(b>a);
  const hash=createHash("sha256").update(body.slice(a,b)).digest("hex");
  assert.ok(consumer.includes(`('public.e5_graph_guard()','${hash}')`),"E11 must pin exact E5 prosrc");
  return hash;
}
test("textual regression: parenthesized CASE and exact consumer prosrc hash",()=>{
  assert.equal(verify(e5,e11),"303366993fe3529b329a2a0c980a4efcda37eef1c1bf0a1e9bd43bb52ca73267");
});
test("textual regression rejects removal of only the two parentheses",()=>{
  assert.throws(()=>verify(e5.replace(`(${expression})`,expression),e11));
});
test("textual regression rejects stale E11 source hash",()=>{
  assert.throws(()=>verify(e5,e11.replace("303366993fe3529b329a2a0c980a4efcda37eef1c1bf0a1e9bd43bb52ca73267",
    "564fe05aee5d577aa60ab5ed5d9a8365e819ba0b82b4e7893ad791995d7b514c")));
});