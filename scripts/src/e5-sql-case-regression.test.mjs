import fs from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import {auditIfCases} from "./sql-if-case-audit.mjs";
const e5=fs.readFileSync(new URL("../../reports/e5/01-preparado.sql",import.meta.url),"utf8");
const e11=fs.readFileSync(new URL("../../reports/e11/01-preparado.sql",import.meta.url),"utf8");
const expression="CASE WHEN returned>0 THEN 'DEVUELTO' WHEN total=0 THEN 'PENDIENTE'\n          WHEN total=r.importe THEN 'APLICADO' ELSE 'PARCIAL' END";
const expressions=[expression,...["PROPONER","AUTORIZAR","RECHAZAR"].map(a=>`CASE WHEN o.accion='${a}' THEN 1 ELSE 0 END`)];
function verify(body,consumer) {
  for(const expression of expressions)assert.equal(body.split(`(${expression})`).length,2,"Unique parenthesized CASE required in IF condition");
  assert.deepEqual(auditIfCases(body).filter(c=>!c.safe),[],"Unprotected CASE within IF");
  const start=body.indexOf("CREATE FUNCTION public.e5_graph_guard()");
  assert.ok(start>=0);const a=body.indexOf("AS $$",start)+5,b=body.indexOf("$$;",a);
  assert.ok(b>a);
  const hash=createHash("sha256").update(body.slice(a,b)).digest("hex");
  assert.ok(consumer.includes(`('public.e5_graph_guard()','${hash}')`),"E11 must pin exact E5 prosrc");
  return hash;
}
test("textual regression: parenthesized CASE and exact consumer prosrc hash",()=>{
  assert.equal(verify(e5,e11),"87911ce23ea2ad1f936e2aa4a718788f7aba2a7b95f1ec9845f5d5baaa520c02");
});
for(const [i,expression] of expressions.entries())test(`textual regression rejects removal of CASE pair ${i+1}`,()=>{
  assert.throws(()=>verify(e5.replace(`(${expression})`,expression),e11));
  assert.ok(auditIfCases(e5.replace(`(${expression})`,expression)).some(c=>!c.safe));
});
test("textual regression rejects stale E11 source hash",()=>{
  for(const old of ["303366993fe3529b329a2a0c980a4efcda37eef1c1bf0a1e9bd43bb52ca73267",
    "564fe05aee5d577aa60ab5ed5d9a8365e819ba0b82b4e7893ad791995d7b514c"])
    assert.throws(()=>verify(e5,e11.replace("87911ce23ea2ad1f936e2aa4a718788f7aba2a7b95f1ec9845f5d5baaa520c02",old)));
});
for(const file of ["tanda-b-20260922/e4","tanda-b-20260922/e12","e9","e5","e11"])
  test(`all IF/ELSIF CASE conditions in ${file} have protected expression nesting`,()=>{
    const sql=fs.readFileSync(new URL(`../../reports/${file}/01-preparado.sql`,import.meta.url),"utf8");
    assert.deepEqual(auditIfCases(sql).filter(c=>!c.safe),[]);
  });
test("subquery/function nesting protects CASE; comments/quoted strings are not executable",()=>{
  const cases=auditIfCases("IF EXISTS (SELECT CASE WHEN true THEN 1 END) OR coalesce(CASE x WHEN 1 THEN true END,false) THEN NULL; END IF; -- IF CASE THEN\nSELECT 'IF CASE THEN';");
  assert.equal(cases.length,2);assert.ok(cases.every(c=>c.safe));
});