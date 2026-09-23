import assert from "node:assert/strict";
import {canonical} from "./common.mjs";
export const replacements=[
  ["function","validar_movimiento_credito_e1",""],
  ["constraint","operaciones_productor_naturaleza_ck_e1","operaciones_credito_e1"],
  ["function","e1_guard_pending_receipts_closed",""],
  ["trigger","zz_e1_pending_receipts_closed","cobros_credito_pendientes_e1"],
];
const key=(r,section)=>section==="schemaRows"
  ?canonical([r.kind,r.schema_name,r.object_name,r.parent_name]):canonical([r.kind,r.schema_name??r.schema??"public",r.parent,r.name]);
const allowed=(r,section)=>replacements.some(([kind,name,parent])=>r.kind===kind&&
  (section==="schemaRows"?r.schema_name==="public"&&r.object_name===name&&r.parent_name===parent:
    (r.schema_name??r.schema??"public")==="public"&&r.name===name&&r.parent===parent));
function unique(rows,keyFn,label) {
  const m=new Map();
  for(const r of rows){const k=keyFn(r);assert.ok(!m.has(k),`Duplicate catalog identity ${label}: ${k}`);m.set(k,r);}
  return m;
}
const cmp=(a,b)=>a<b?-1:a>b?1:0;
export function project(live,before,after) {
  const result=structuredClone(live), evidence={added:{},replaced:{}};
  for(const section of ["schemaRows","attributes"]) {
    const old=unique(before[section],r=>key(r,section),"fixture before");
    const next=unique(after[section],r=>key(r,section),"fixture after");
    const base=unique(live[section],r=>key(r,section),"real B0");
    const added=[], changed=[];
    for(const [k,r] of old) {
      assert.ok(next.has(k),"SQL removed object without replacement");
      const n=next.get(k);
      if(canonical(n)===canonical(r)) continue;
      assert.ok(allowed(r,section),`Unauthorized replacement: ${k}`);
      assert.deepEqual(base.get(k),r,"Fixture old replacement differs from real B0");
      base.set(k,n); changed.push({before:r,after:n});
    }
    for(const [k,r] of next) if(!old.has(k)) {
      assert.ok(!base.has(k),`Addition collides with real B0: ${k}`);
      base.set(k,r); added.push(r);
    }
    evidence.added[section]=added;evidence.replaced[section]=changed;
    const fields=section==="schemaRows"?["kind","schema_name","object_name","parent_name","definition"]:["kind","parent","name","definition"];
    result[section]=[...base.values()].sort((a,b)=>{for(const f of fields){const n=cmp(a[f],b[f]);if(n)return n;}return 0;});
  }
  assert.equal(evidence.replaced.schemaRows.length,4,"Exactly four old E1 definitions must change");
  // Raw enum numbers and ALL non-allowlisted original rows stay byte-exact.
  for(const section of ["schemaRows","attributes"]) for(const r of live[section]) {
    const n=result[section].find(x=>key(x,section)===key(r,section));
    if(!allowed(r,section)) assert.deepEqual(n,r,"Nonallowlisted B0 drift");
  }
  return {projected:result,evidence};
}
export {projectAuxiliaryMultiset as projectAuxiliary} from "./auxiliary-multiset.mjs";
const q=s=>`"${s.replaceAll('"','""')}"`;
const lit=s=>`'${s.replaceAll("'","''")}'`;
// Deliberately incomplete dependency fixture: no actors, full catalog, business
// rows, copied ACLs or old triggers other than the exact authorized E1 guard.
export function fixture(live) {
  const names=["usuarios","clientes","ubicaciones","sesiones_caja","salidas_dinero_caja",
    "fondo_movimientos","fondo_mariana","pagos_proveedor","aplicaciones_pago_proveedor",
    "solicitudes_pago_dirigido","auditoria","movimientos_credito","operaciones_credito_e1",
    "cobros_credito_pendientes_e1","aplicaciones_credito","tickets","notificaciones_sistema"];
  const columns=live.schemaRows.filter(r=>r.kind==="column"&&r.schema_name==="public"&&names.includes(r.object_name));
  const types=new Set(columns.map(r=>r.definition.split(/:[tf]:/)[0].replace(/\[\]$/,"").replace(/^public\./,"").replaceAll('"',"")));
  const enums=[...new Set(live.attributes.filter(r=>r.kind==="enum"&&types.has(r.parent)).map(r=>r.parent))];
  const ddl=["SET search_path=public,pg_catalog;"];
  for(const e of enums) ddl.push(`CREATE TYPE public.${q(e)} AS ENUM (${live.attributes.filter(r=>r.kind==="enum"&&r.parent===e).sort((a,b)=>+a.definition-+b.definition).map(r=>lit(r.name)).join(",")});`);
  for(const name of names) {
    const rows=columns.filter(r=>r.object_name===name);assert.ok(rows.length,`Missing dependency ${name}`);
    ddl.push(`CREATE TABLE public.${q(name)} (${rows.map(r=>`${q(r.parent_name)} ${r.definition.split(/:[tf]:/)[0]}`).join(",")});`);
    for(const r of live.schemaRows.filter(r=>r.kind==="constraint"&&r.parent_name===name&&
      (/^(PRIMARY KEY|UNIQUE) /.test(r.definition)||r.object_name==="operaciones_productor_naturaleza_ck_e1")))
      ddl.push(`ALTER TABLE public.${q(name)} ADD CONSTRAINT ${q(r.object_name)} ${r.definition};`);
  }
  for(const name of ["validar_movimiento_credito_e1","e1_guard_pending_receipts_closed"]) {
    const rows=live.schemaRows.filter(r=>r.kind==="function"&&r.object_name===name&&r.parent_name==="");
    assert.equal(rows.length,1);ddl.push(rows[0].definition+";");
  }
  const trigger=live.schemaRows.find(r=>r.kind==="trigger"&&r.object_name==="zz_e1_pending_receipts_closed");
  assert.ok(trigger);ddl.push(trigger.definition+";");
  // Independent sentinel proves actual row/sequence snapshot sensitivity.
  ddl.push("CREATE TABLE public.tanda_b_probe(id bigserial PRIMARY KEY, value text NOT NULL); INSERT INTO public.tanda_b_probe(value) VALUES ('disposable-only');");
  return ddl.join("\n");
}