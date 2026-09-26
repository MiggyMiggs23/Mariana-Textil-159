import fs from "node:fs";
import http from "node:http";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "../../../lib/db/node_modules/pg/lib/index.js";
const scope = new AsyncLocalStorage();
const database = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (!["release_login_20260926","release_perf_20260926"].includes(database)) throw Error("Observer isolation");
const file = `/tmp/release-owner-20260926/${database}/sanitized-observer.ndjson`;
const hash = s => crypto.createHash("sha256").update(s).digest("hex");
const shape = s => ({ verb:s.match(/^\s*([a-z]+)/i)?.[1]?.toUpperCase()||"UNKNOWN",
  shapeSha256:hash(s.replace(/'(?:''|[^'])*'/g,"?").replace(/\b\d+\b/g,"?").replace(/\s+/g," ").trim()) });
const errorInfo = e => e ? {name:e.name,code:e.code??null,severity:e.severity??null,routine:e.routine??null,
  messageSha256:hash(String(e.message)),stackSha256:hash(String(e.stack)),
  category:e.message==="Query read timeout"?"QUERY_READ_TIMEOUT":e.message==="timeout exceeded when trying to connect"?"POOL_ACQUIRE_TIMEOUT":null,
  cause:e.cause&&e.cause!==e?{name:e.cause.name,code:e.cause.code??null,messageSha256:hash(String(e.cause.message))}:null}:null;
const emit = data => fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),request:scope.getStore()??null,...data})+"\n",{mode:0o600});
const originalEmit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,...args){
  if(event!=="request")return originalEmit.call(this,event,...args);
  const [req,res]=args,start=performance.now(),context={id:crypto.randomUUID(),method:req.method,
    route:req.url?.split("?")[0]?.replace(/\/\d+(?=\/|$)/g,"/:id")};
  return scope.run(context,()=>{
    res.setHeader("x-release-request-id",context.id);
    res.once("finish",()=>emit({event:"http_end",status:res.statusCode,durationMs:performance.now()-start}));
    return originalEmit.call(this,event,...args);
  });
};
globalThis.__releaseObservePool=pool=>{
  const counts=()=>({total:pool.totalCount,idle:pool.idleCount,waiting:pool.waitingCount,max:pool.options.max});
  const backendIds=new WeakMap();
  const connect=pool.connect;
  pool.connect=function(cb){
    const start=performance.now();emit({event:"acquire_start",...counts()});
    const done=(e,c)=>emit({event:"acquire_end",durationMs:performance.now()-start,nodePid:c?.processID??null,
      backendPid:c?backendIds.get(c)??null:null,error:errorInfo(e),...counts()});
    if(typeof cb==="function")return connect.call(this,(e,c,release)=>{done(e,c);cb(e,c,release)});
    return connect.call(this).then(c=>{done(null,c);return c},e=>{done(e);throw e});
  };
  pool.on("connect",client=>{
    const query=client.query;
    // One diagnostic SELECT per new physical connection; authoritative mapping,
    // not assuming node/PgBouncer processID equals PostgreSQL backend PID.
    query.call(client,"SELECT pg_backend_pid() AS pid",(e,r)=>{
      if(!e)backendIds.set(client,r.rows[0].pid);
      emit({event:"backend_identity",nodePid:client.processID,backendPid:backendIds.get(client)??null,error:errorInfo(e)});
    });
    client.query=function(...args){
      const start=performance.now(),context=scope.getStore(),sql=typeof args[0]==="string"?args[0]:args[0]?.text??"";
      const detail=shape(sql),done=e=>scope.run(context,()=>emit({event:"query_end",...detail,nodePid:client.processID,
        backendPid:backendIds.get(client)??null,durationMs:performance.now()-start,error:errorInfo(e),...counts()}));
      const last=args.length-1;
      if(typeof args[last]==="function"){const cb=args[last];args[last]=(e,r)=>{done(e);cb(e,r)};return query.apply(this,args);}
      try{const r=query.apply(this,args);return r?.then?r.then(v=>{done(null);return v},e=>{done(e);throw e}):r;}
      catch(e){done(e);throw e;}
    };
  });
  const target=new URL(pool.options.connectionString);target.hostname=target.hostname.replace("-pooler","");
  const observer=new pg.Pool({connectionString:target.href,max:1,application_name:"release-readonly-observer",
    options:"-c default_transaction_read_only=on",statement_timeout:2000,connectionTimeoutMillis:3000});
  let busy=false;
  setInterval(async()=>{
    emit({event:"occupancy",...counts()});if(busy)return;busy=true;
    try{
      const rows=(await observer.query(`SELECT pid,state,wait_event_type,wait_event,pg_blocking_pids(pid) blockers,
        extract(epoch FROM clock_timestamp()-xact_start)::float8 transaction_age_seconds,
        extract(epoch FROM clock_timestamp()-query_start)::float8 query_age_seconds,query
        FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`)).rows;
      emit({event:"pg_activity",rows:rows.map(({query,...safe})=>({...safe,...shape(query)}))});
      const locks=(await observer.query(`SELECT l.pid,l.locktype,l.mode,l.granted,l.relation,
        l.transactionid::text FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
        WHERE a.datname=current_database() AND l.pid<>pg_backend_pid() AND
        (NOT l.granted OR l.pid IN (SELECT unnest(pg_blocking_pids(pid)) FROM pg_stat_activity WHERE datname=current_database()))
        LIMIT 100`)).rows;
      if(locks.length)emit({event:"pg_locks",locks});
    }catch(e){emit({event:"observer_error",error:errorInfo(e)})}finally{busy=false}
  },500).unref();
};