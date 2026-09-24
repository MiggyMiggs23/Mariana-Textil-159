import fs from "node:fs";
const out="reports/tanda-h/tarea-2";
const pre=JSON.parse(fs.readFileSync(out+"/pre.json")),post=JSON.parse(fs.readFileSync(out+"/post.json"));
const changedTables=Object.keys(pre.dataset).filter(t=>JSON.stringify(pre.dataset[t])!==JSON.stringify(post.dataset[t]));
const queryEqual=pre.queries.every(q=>post.queries.some(p=>p.text===q.text&&JSON.stringify(p.values)===JSON.stringify(q.values)&&p.resultDigest===q.resultDigest));
const proof={
 fullDatasetEqual:changedTables.length===0,changedTables,
 businessDatasetEqual:changedTables.every(t=>t==="sesiones"),
 explicitExclusion:"sesiones is authentication-session storage, not sesiones_caja. Its row digest changed between samples; full dataset equality is NOT claimed. All other public tables, including all business tables, match.",
 orderedQueryResultsEqual:queryEqual,
 orderedOperationResultsEqual:pre.results.every((r,i)=>r.semanticDigest===post.results[i]?.semanticDigest),
 timings:["cash_cut","credit_report"].map(name=>({name,preMs:pre.results.filter(r=>r.name===name).map(r=>r.elapsedMs),postMs:post.results.filter(r=>r.name===name).map(r=>r.elapsedMs)})),
};
fs.writeFileSync(out+"/business-paired-proof.json",JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));