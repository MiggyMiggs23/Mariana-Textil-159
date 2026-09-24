import fs from "node:fs";
import {createHash} from "node:crypto";
const root=process.cwd(),r=root+"/.local/tanda-g-ampliada",out=root+"/reports/tanda-g-ampliada/tarea-4";
const frozen=r+"/frozen-source",f=JSON.parse(fs.readFileSync(root+"/reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json"));
const url=JSON.parse(fs.readFileSync(r+"/worker-databases.json")).performance.url;
process.env.NODE_ENV="test";process.env.REQUIRE_ISOLATED_TEST_DATABASE="1";process.env.TEST_DATABASE_URL=url;
process.env.DATABASE_URL="postgresql://postgres@127.0.0.1:55442/tanda_ga_witness";
process.env.APPLICATION_DATABASE_URL=process.env.DATABASE_URL;
const {pool,db}=await import(frozen+"/lib/db/src/index.ts");
const identity=(await pool.query("select current_database() db,current_user actor,inet_server_port() port")).rows[0];
if(identity.db!=="tanda_ga_performance"||identity.actor!=="ga_performance"||identity.port!==55442)throw Error("Isolation failure");
const {buildCorteCaja}=await import(frozen+"/artifacts/api-server/src/lib/pos.ts");
const {buildReport}=await import(frozen+"/artifacts/api-server/src/lib/reportes.ts");
const {buildEstadoCuentaExportReadQuery}=await import(frozen+"/artifacts/api-server/src/lib/clientes-financial-read-scope.ts");
await pool.query("SET statement_timeout='25s'");
const original=pool.query.bind(pool),captured=new Map();let current="setup";
pool.query=async function(q,...args){
 const text=typeof q==="string"?q:q.text,values=typeof q==="string"?(args[0]||[]):(q.values||args[0]||[]);
 const start=performance.now();
 try{return await original(q,...args);}finally{
  const elapsed=performance.now()-start,key=createHash("sha256").update(text).digest("hex").slice(0,16);
  const old=captured.get(key);
  if(!old||elapsed>old.maxMs)captured.set(key,{key,workload:current,text,values,maxMs:elapsed});
 }
};
const grouped=`SELECT p.id AS producto_id,p.sku,p.tela,p.color,p.unidad,COUNT(r.id)::int AS rollos_count,COALESCE(SUM(r.cantidad_actual),0)::text AS cantidad_total
 FROM productos p LEFT JOIN rollos r ON r.producto_id=p.id AND r.estado='DISPONIBLE' AND ($1::int IS NULL OR r.ubicacion_id=$1)
 WHERE p.activo=true AND ($2::text IS NULL OR p.tela ILIKE $2 OR p.color ILIKE $2 OR p.sku ILIKE $2)
 GROUP BY p.id HAVING $3 OR COUNT(r.id)>0 ORDER BY p.tela,p.color,p.sku`;
// Same projection, joins, grouping, ordering and 200-row limit as GET /tickets.
const cashier=`SELECT t.id,t.folio,t.ubicacion_id,u.nombre,t.usuario_terminal_id,a.nombre,t.cliente_id,c.nombre,t.nota_sin_precios,
 t.subtotal,t.iva,t.tasa_iva,t.total,t.estado,t.cobrado,t.cobrado_at,t.usuario_caja_id,t.facturado,t.sesion_caja_id,t.uuid_cliente,t.created_at,t.cancelado_at,t.cancelado_por,t.motivo_cancelacion,t.autorizado_por,COUNT(l.id)
 FROM tickets t JOIN ubicaciones u ON u.id=t.ubicacion_id JOIN usuarios a ON a.id=t.usuario_terminal_id
 LEFT JOIN clientes c ON c.id=t.cliente_id LEFT JOIN ticket_lineas l ON l.ticket_id=t.id
 WHERE t.ubicacion_id=$1 AND t.cobrado=false
 GROUP BY t.id,u.nombre,a.nombre,c.nombre ORDER BY t.cobrado ASC,t.created_at DESC LIMIT 200`;
const account=buildEstadoCuentaExportReadQuery(f.customer.id,{tipo:"GLOBAL",ubicaciones:[],generadoEn:new Date().toISOString(),saldoAFavorDisponible:true});
const cases=[
 ["cashier_pending_read",()=>pool.query(cashier,[f.sites[0].id])],
 ["client_account_export_query",()=>pool.query(account.text,account.values)],
 ["grouped_stock_global",()=>pool.query(grouped,[null,null,false])],
 ["grouped_stock_store",()=>pool.query(grouped,[f.sites[0].id,null,false])],
 ["cash_cut_buildCorteCaja",()=>buildCorteCaja(db,f.sessions[0].id)],
 ["credit_clients_buildReport",()=>buildReport("clientes",{desde:"2025-09-24",hasta:"2026-09-23"},f.sites.slice(0,3).map(s=>s.id),true)],
];
const results=[];
const percentile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.ceil(a.length*p)-1];
try{
 for(const [name,fn]of cases){
  current=name;const samples=[];let error=null;
  for(let i=0;i<21;i++){
   const start=performance.now();
   try{await fn();samples.push(performance.now()-start);}
   catch(e){error={message:e.message,code:e.code};break;}
   if(performance.now()-start>25000)break;
  }
  const warm=samples.slice(1);
  const result={name,firstTouchMs:samples[0],warmSamplesMs:warm,p50Ms:warm.length?percentile(warm,.5):null,p95Ms:warm.length?percentile(warm,.95):null,error};
  results.push(result);fs.writeFileSync(out+"/benchmark-results.json",JSON.stringify({identity,results,coldClaim:false,concurrency:1},null,2));
  console.log(JSON.stringify({name,firstTouchMs:result.firstTouchMs,p50Ms:result.p50Ms,p95Ms:result.p95Ms,error}));
 }
 pool.query=original;
 const plans=[];
 for(const q of captured.values()){
  // Every distinct measured statement gets a real executor/buffer plan.
  try{const plan=await original("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "+q.text,q.values);plans.push({...q,values:undefined,plan:plan.rows[0]["QUERY PLAN"]});}
  catch(e){plans.push({...q,values:undefined,explainError:e.message});}
 }
 fs.writeFileSync(out+"/query-plans.json",JSON.stringify(plans,null,2));
 fs.writeFileSync(out+"/query-summary.json",JSON.stringify(plans.map(p=>({key:p.key,workload:p.workload,maxMs:p.maxMs,executionMs:p.plan?.[0]?.["Execution Time"],explainError:p.explainError})),null,2));
}finally{pool.query=original;await pool.end();}