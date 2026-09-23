import test from "node:test";
import assert from "node:assert/strict";
import {auxiliaryFingerprint,multiset,projectAuxiliaryMultiset} from "./auxiliary-multiset.mjs";
const edge={deptype:"a",source:{kind:"index",schema:"public",name:"idx",identity:"public.idx"},
  target:{kind:"table column",schema:"public",name:"old",identity:"public.old.col"}};
const catalog=dependencies=>({readOnly:"on",riTriggers:[],dependencies});
test("unchanged duplicate real dependencies remain repeated rows",()=>{
  const b=catalog([edge,edge]),snapshot=JSON.stringify(b);
  const result=projectAuxiliaryMultiset(b,catalog([]),catalog([]));
  assert.equal(result.projected.dependencies.length,2);
  assert.equal(multiset(result.projected.dependencies).values().next().value.count,2);
  assert.equal(JSON.stringify(b),snapshot);
});
test("multiplicity addition is delta arithmetic, not set membership",()=>{
  const r=projectAuxiliaryMultiset(catalog([edge,edge]),catalog([edge]),catalog([edge,edge]));
  assert.equal(r.projected.dependencies.length,3);assert.equal(r.delta.dependencies.added[0].count,1);
});
test("two newly emitted identical edges preserve multiplicity two",()=>{
  assert.equal(projectAuxiliaryMultiset(catalog([]),catalog([]),catalog([edge,edge])).projected.dependencies.length,2);
});
test("authorized removal subtracts only the observed count",()=>{
  const e={...edge,source:{kind:"function",identity:"public.e1_guard_pending_receipts_closed()"}};
  const r=projectAuxiliaryMultiset(catalog([e,e,e]),catalog([e,e]),catalog([e]));
  assert.equal(r.projected.dependencies.length,2);assert.equal(r.delta.dependencies.removed[0].count,1);
});
test("authorized removal cannot underflow real capture",()=>{
  const e={...edge,source:{kind:"function",identity:"public.e1_guard_pending_receipts_closed()"}};
  assert.throws(()=>projectAuxiliaryMultiset(catalog([e]),catalog([e,e]),catalog([])));
});
test("unauthorized old edge decrease rejected, even if another copy remains",()=>{
  assert.throws(()=>projectAuxiliaryMultiset(catalog([edge,edge]),catalog([edge,edge]),catalog([edge])));
});
test("existing RI multiplicity decrease rejected",()=>{
  const r={schema_name:"public",parent:"users",constraint_table:"orders",constraint_name:"actor_fk"};
  assert.throws(()=>projectAuxiliaryMultiset({...catalog([]),riTriggers:[r,r]},{...catalog([]),riTriggers:[r,r]},{...catalog([]),riTriggers:[r]}));
});
test("captured column subobject identities remain distinct",()=>{
  const second={...edge,target:{...edge.target,identity:"public.old.other_column"}};
  const r=projectAuxiliaryMultiset(catalog([edge,second]),catalog([]),catalog([]));
  assert.equal(multiset(r.projected.dependencies).size,2);
});
test("FK originating table remains part of semantic RI identity",()=>{
  const a={schema_name:"public",parent:"users",constraint_table:"orders",constraint_name:"actor_fk"};
  const b={...a,constraint_table:"invoices"};
  assert.equal(multiset([a,b]).size,2);
});
test("fingerprint ignores order but never multiplicity",()=>{
  const b={...edge,deptype:"n"};
  assert.equal(auxiliaryFingerprint(catalog([edge,b,edge])),auxiliaryFingerprint(catalog([edge,edge,b])));
  assert.notEqual(auxiliaryFingerprint(catalog([edge,b,edge])),auxiliaryFingerprint(catalog([edge,b])));
});
test("source schema mismatch never authorizes removal",()=>{
  const e={...edge,source:{kind:"function",identity:"other.e1_guard_pending_receipts_closed()"}};
  assert.throws(()=>projectAuxiliaryMultiset(catalog([e]),catalog([e]),catalog([])));
});