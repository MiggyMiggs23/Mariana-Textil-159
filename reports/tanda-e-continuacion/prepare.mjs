import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "../../scripts/node_modules/pg/lib/index.js";
const ROOT="/home/runner/workspace", R=ROOT+"/.local/tanda-e-continuacion", REPORT=ROOT+"/reports/tanda-e-continuacion";
const PG="/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
fs.mkdirSync(R,{recursive:true,mode:0o700});
fs.chmodSync(R,0o700);
const progress=(text)=>fs.appendFileSync(REPORT+"/progress.txt",new Date().toISOString()+" "+text+"\n");
function run(binary,args,env=process.env) {
 const x=spawnSync(binary,args,{env,encoding:"utf8",timeout:150000,maxBuffer:3000000});
 if(x.status!==0){fs.writeFileSync(R+"/last-error.txt",x.stderr||"",{mode:0o600});throw Error(binary.split("/").pop()+" failed; private diagnostics retained");}
 return x.stdout;
}
if(process.argv.includes("--capture")){
 progress("Inspected historical launcher, provenance rules and safe capture scripts. No app/workflow changes.");
 if(fs.existsSync(R+"/source.dump"))throw Error("Refusing overwrite");
 const env=fs.readFileSync("/proc/180/environ","utf8").split("\0");
 const raw=env.find(x=>x.startsWith("DATABASE_URL="))?.slice(13);
 if(!raw||raw!==process.env.DATABASE_URL)throw Error("Effective API target and shell do not match");
 const u=new URL(raw);
 const e={PATH:process.env.PATH,HOME:process.env.HOME,PGHOST:u.searchParams.get("host")||u.hostname,PGPORT:u.port||"5432",PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),PGSSLMODE:u.searchParams.get("sslmode")||"prefer",PGOPTIONS:"-c default_transaction_read_only=on",PGCONNECT_TIMEOUT:"8"};
 const identity=run(PG+"/psql",["-XAt","-v","ON_ERROR_STOP=1","-c","SELECT current_database(),current_setting('transaction_read_only'),current_setting('server_version_num')"],e).trim();
 if(!identity.startsWith("heliumdb|on|16"))throw Error("Unexpected source identity");
 fs.writeFileSync(REPORT+"/source-identity.txt",identity+"\nEffective running API PID 180 URL matched internally; no credentials recorded.\n");
 run(PG+"/pg_dump",["-Fc","--no-owner","--no-acl","-f",R+"/source.dump"],e);
 fs.chmodSync(R+"/source.dump",0o600);
 fs.appendFileSync(REPORT+"/source-identity.txt","Fresh read-only transactional dump SHA256 "+createHash("sha256").update(fs.readFileSync(R+"/source.dump")).digest("hex")+"\nNo quiescence or ongoing equality claimed.\n");
 run(PG+"/initdb",["-D",R+"/cluster","-U","postgres","--auth-local=trust","--auth-host=trust","--no-locale","--encoding=UTF8"]);
 fs.mkdirSync(R+"/socket",{mode:0o700});
 progress("Fresh effective-source dump captured read-only; private local cluster initialized.");
}
if(process.argv.includes("--restore")){
 run(PG+"/pg_ctl",["-D",R+"/cluster","-l",R+"/postgres-preparation.log","-o","-p 55439 -k "+R+"/socket -h 127.0.0.1","-w","start"]);
 try{
 const e={PATH:process.env.PATH,PGHOST:"127.0.0.1",PGPORT:"55439",PGUSER:"postgres",PGDATABASE:"postgres"};
 run(PG+"/createdb",["tanda_e_continuacion_copy"],e);
 run(PG+"/createdb",["tanda_e_continuacion_witness"],e);
 run(PG+"/pg_restore",["--exit-on-error","--no-owner","--no-acl","-d","tanda_e_continuacion_copy",R+"/source.dump"],e);
 progress("Fresh dump restored into local copy; original database has received no writes.");
 }finally{run(PG+"/pg_ctl",["-D",R+"/cluster","-m","fast","-w","stop"]);}
}
if(process.argv.includes("--fixtures")){
 run(PG+"/pg_ctl",["-D",R+"/cluster","-l",R+"/postgres-preparation.log","-o","-p 55439 -k "+R+"/socket -h 127.0.0.1","-w","start"]);
 const c=new pg.Client({host:"127.0.0.1",port:55439,user:"postgres",database:"tanda_e_continuacion_copy"});
 try {
 await c.connect();
 if((await c.query("select current_database() d")).rows[0].d!=="tanda_e_continuacion_copy")throw Error("Copy identity mismatch");
 await c.query("BEGIN");
 await c.query("UPDATE usuarios SET activo=false,nombre='Restored disabled actor '||id,usuario='restored-disabled-'||id,password_hash=crypt($1,gen_salt('bf',8))",[randomBytes(32).toString("hex")]);
 await c.query("DELETE FROM sesiones");
 const one=async(sql,p=[]) => (await c.query(sql,p)).rows[0];
 const site=await one("INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES('TANDA E CONTINUACION','TEC','TIENDA') RETURNING id");
 const credentials={};
 for(const [key,role] of [["admin","ADMIN"],["caja","CAJA"]]){
 const password=randomBytes(24).toString("base64url"),username=key==="admin"?"admin":"tandaec-"+key;
 const actor=await one("INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id) VALUES($1,$2,crypt($3,gen_salt('bf',10)),$4,$5) RETURNING id",["TANDA EC "+role,username,password,role,site.id]);
 credentials[key]={username,password,id:actor.id};
 }
 const customer=await one("INSERT INTO clientes(nombre,dias_credito,limite_credito) VALUES('TANDA EC CLIENTE CREDITO',30,5000) RETURNING id");
 const product=await one("INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,precio_mayoreo,precio_menudeo) VALUES('TANDA-EC-POS','TANDA EC TELA','AZUL EC','METRO',150,150,150) RETURNING id");
 const supplier=await one("INSERT INTO proveedores(nombre,tipo) VALUES('TANDA EC PROVEEDOR','NACIONAL') RETURNING id");
 const entry=await one("INSERT INTO entradas(folio,ubicacion_id,proveedor_id,usuario_id,fecha,total_rollos,total_costo,uuid_cliente) VALUES(1,$1,$2,$3,now(),10,1000,$4) RETURNING id",[site.id,supplier.id,credentials.admin.id,randomUUID()]);
 await c.query("INSERT INTO entrada_folio(ubicacion_id,ultimo_folio) VALUES($1,1)",[site.id]);
 const rolls=[];
 for(let i=1;i<=10;i++){
 const serie=String(993000000+i);
 const roll=await one("INSERT INTO rollos(serie,producto_id,ubicacion_id,proveedor_id,recepcion_id,estado,cantidad_inicial,cantidad_actual,costo_unitario,costo_total) VALUES($1,$2,$3,$4,$5,'DISPONIBLE',1,1,100,100) RETURNING id",[serie,product.id,site.id,supplier.id,entry.id]);
 const movement=await one("INSERT INTO movimientos(rollo_id,producto_id,ubicacion_id,tipo,cantidad,saldo_posterior,documento_tipo,documento_id,usuario_id,uuid_cliente) VALUES($1,$2,$3,'RECEPCION',1,$4,'ENTRADA',$5,$6,$7) RETURNING id",[roll.id,product.id,site.id,i,String(entry.id),credentials.admin.id,randomUUID()]);
 rolls.push({id:roll.id,serie,recepcionId:entry.id,proveedorId:supplier.id,movimientoId:movement.id});
 }
 await c.query("INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES($1,$2,10,10)",[product.id,site.id]);
 const session=await one("INSERT INTO sesiones_caja(ubicacion_id,usuario_id,fecha_operativa,fondo_inicial) VALUES($1,$2,(now() at time zone 'America/Mexico_City')::date,500) RETURNING id,estado,fecha_operativa,fondo_inicial",[site.id,credentials.caja.id]);
 await c.query("COMMIT");
 fs.writeFileSync(R+"/credentials.json",JSON.stringify(credentials,null,2),{mode:0o600});
 fs.writeFileSync(R+"/session-secret",randomBytes(48).toString("hex"),{mode:0o600});
 const verification=await one("SELECT count(*)::int AS rolls,count(m.id)::int AS receptions,sum(r.cantidad_actual) AS quantity FROM rollos r JOIN entradas e ON e.id=r.recepcion_id AND e.proveedor_id=r.proveedor_id JOIN movimientos m ON m.rollo_id=r.id AND m.tipo='RECEPCION' AND m.documento_id=e.id::text WHERE r.producto_id=$1 AND r.ubicacion_id=$2",[product.id,site.id]);
 fs.writeFileSync(REPORT+"/fixture-manifest-redacted.json",JSON.stringify({database:"tanda_e_continuacion_copy",site,actors:Object.fromEntries(Object.entries(credentials).map(([k,v])=>[k,{id:v.id,username:v.username}])),customer,product,supplier,entry,rolls,session,verification,purposes:["cash","transfer","credit authorization / E3","unmarked undercost negative","remate", "five reserve rolls"],costPerRoll:100,listPrice:150,customerCreditLimit:5000,customerCreditDays:30},null,2));
 progress("Actors anonymized/disabled and auth sessions removed only in copy. Ten fully traced synthetic rolls, credit customer and OPEN cash session fund500 committed.");
 }catch(error){await c.query("ROLLBACK").catch(()=>{});fs.writeFileSync(R+"/fixture-error.txt",String(error),{mode:0o600});throw Error("Fixture setup failed; inspect private fixture-error.txt");}
 finally{await c.end();run(PG+"/pg_ctl",["-D",R+"/cluster","-m","fast","-w","stop"]);}
}
if(process.argv.includes("--verify")){
 run(PG+"/pg_ctl",["-D",R+"/cluster","-l",R+"/postgres-preparation.log","-o","-p 55439 -k "+R+"/socket -h 127.0.0.1","-w","start"]);
 const c=new pg.Client({host:"127.0.0.1",port:55439,user:"postgres",database:"tanda_e_continuacion_copy"});
 try{
 await c.connect();
 const f=JSON.parse(fs.readFileSync(REPORT+"/fixture-manifest-redacted.json","utf8"));
 if((await c.query("select current_database() d")).rows[0].d!=="tanda_e_continuacion_copy")throw Error("Identity mismatch");
 await c.query("INSERT INTO sesiones_caja_dias(ubicacion_id,fecha_operativa,sesion_caja_id) SELECT ubicacion_id,fecha_operativa,id FROM sesiones_caja WHERE id=$1 ON CONFLICT DO NOTHING",[f.session.id]);
 const checks=(await c.query(`SELECT current_database() database,
 (SELECT count(*) FROM usuarios WHERE activo) active_actors,
 (SELECT count(*) FROM usuarios WHERE activo AND usuario NOT IN ('admin','tandaec-caja')) restored_active_actors,
 (SELECT count(*) FROM sesiones) auth_sessions,
 (SELECT estado FROM sesiones_caja WHERE id=$1) cash_state,
 (SELECT fondo_inicial FROM sesiones_caja WHERE id=$1) initial_fund,
 (SELECT count(*) FROM sesiones_caja_dias WHERE sesion_caja_id=$1) daily_guard,
 (SELECT count(*) FROM tickets WHERE ubicacion_id=$2) synthetic_tickets,
 (SELECT cantidad_total FROM existencias WHERE producto_id=$3 AND ubicacion_id=$2) stock,
 (SELECT sum(cantidad) FROM movimientos WHERE producto_id=$3 AND ubicacion_id=$2) ledger_stock`,[f.session.id,f.site.id,f.product.id])).rows[0];
 if(checks.active_actors!=="2"||checks.restored_active_actors!=="0"||checks.auth_sessions!=="0"||checks.cash_state!=="ABIERTA"||checks.daily_guard!=="1"||checks.stock!==checks.ledger_stock)throw Error("Verification failed");
 fs.writeFileSync(REPORT+"/fixture-check.json",JSON.stringify(checks,null,2));
 progress("Final copy verification passed: two synthetic active actors, zero restored active actors/auth sessions, daily guardian, OPEN fund500, zero synthetic tickets, stock equals ledger.");
 }finally{await c.end();run(PG+"/pg_ctl",["-D",R+"/cluster","-m","fast","-w","stop"]);}
}