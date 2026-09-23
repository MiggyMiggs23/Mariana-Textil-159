import assert from "node:assert/strict";
import {canonical,digest} from "./common.mjs";
const sections=["riTriggers","dependencies"];
const authorizedIdentities=new Set([
  "public.validar_movimiento_credito_e1()","public.e1_guard_pending_receipts_closed()",
  "operaciones_productor_naturaleza_ck_e1 on public.operaciones_credito_e1",
  "zz_e1_pending_receipts_closed on public.cobros_credito_pendientes_e1",
]);
export function multiset(rows) {
  assert.ok(Array.isArray(rows),"Auxiliary rows must be an array");
  const bag=new Map();
  for(const row of rows) {
    assert.ok(row&&typeof row==="object"&&!Array.isArray(row),"Invalid auxiliary row");
    const key=canonical(row),entry=bag.get(key);
    if(entry)entry.count++;else bag.set(key,{row,count:1});
  }
  return bag;
}
function representation(rows) {
  return [...multiset(rows)].sort(([a],[b])=>a<b?-1:a>b?1:0)
    .map(([key,{count}])=>({key,count}));
}
export function auxiliaryFingerprint(catalog) {
  return digest(canonical(Object.fromEntries(sections.map(s=>[s,representation(catalog[s])]))));
}
// Rows are NOT deduplicated: count(B1)=count(real B0)+count(fixture after)
// -count(fixture before), independently for every full semantic edge/RI row.
// pg_identify_object identities already encode captured column subobjects;
// no missing numeric OID/sub-ID or synthetic identity is invented here.
export function projectAuxiliaryMultiset(live,before,after) {
  const projected=structuredClone(live),delta={};
  for(const section of sections) {
    const old=multiset(before[section]),next=multiset(after[section]),base=multiset(live[section]);
    const removed=[],added=[];
    for(const key of new Set([...old.keys(),...next.keys()])) {
      const was=old.get(key)?.count??0,now=next.get(key)?.count??0,change=now-was;
      if(!change)continue;
      const row=(next.get(key)??old.get(key)).row;
      if(change<0) {
        assert.equal(section,"dependencies","Existing FK RI semantics/multiplicity must remain identical");
        assert.ok(authorizedIdentities.has(row.source?.identity),`Unauthorized dependency removal ${key}`);
        assert.ok((base.get(key)?.count??0)>=-change,`Removed dependency multiplicity absent from real B0 ${key}`);
        const remaining=base.get(key).count+change;
        if(remaining)base.set(key,{row:base.get(key).row,count:remaining});else base.delete(key);
        removed.push({row,count:-change});
      } else {
        const count=(base.get(key)?.count??0)+change;
        base.set(key,{row:base.get(key)?.row??structuredClone(row),count});
        added.push({row,count:change});
      }
    }
    projected[section]=[...base].sort(([a],[b])=>a<b?-1:a>b?1:0)
      .flatMap(([,e])=>Array.from({length:e.count},()=>structuredClone(e.row)));
    const removedCount=removed.reduce((n,e)=>n+e.count,0),addedCount=added.reduce((n,e)=>n+e.count,0);
    assert.equal(projected[section].length,live[section].length+addedCount-removedCount,"Multiset conservation");
    delta[section]={removed,added,baseRows:live[section].length,projectedRows:projected[section].length,
      baseDistinct:multiset(live[section]).size,projectedDistinct:base.size};
  }
  return {projected,delta};
}