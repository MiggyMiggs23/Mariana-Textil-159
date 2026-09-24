import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {randomBytes,randomUUID,createHash} from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
const ROOT="/home/runner/workspace", R=ROOT+"/.local/tanda-f", REPORT=ROOT+"/reports/tanda-f/setup";
const PG="/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin";
const port=55440, database="tanda_f_template";
fs.mkdirSync(R,{recursive:true,mode:0o700}); fs.chmodSync(R,0o700);
const progress=text=>{fs.appendFileSync(REPORT+"/progress.txt",new Date().toISOString()+" "+text+"\n");console.log(text);};
function run(name,args,env=process.env){
 const result=spawnSync(PG+"/"+name,args,{env,encoding:"utf8",timeout:150000,maxBuffer:3000000});
 if(result.status!==0){fs.writeFileSync(R+"/last-error.txt",result.stderr||"",{mode:0o600});throw Error(name+" failed; private diagnostics retained");}
 return result.stdout;
}
const env={PATH:process.env.PATH,HOME:process.env.HOME,PGHOST:"127.0.0.1",PGPORT:String(port),PGUSER:"postgres",PGDATABASE:"postgres"};
function verifyProcess(){
 const pid=Number(fs.readFileSync(R+"/cluster/postmaster.pid","utf8").split("\n")[0]);
 const cmd=fs.readFileSync("/proc/"+pid+"/cmdline","utf8").split("\0");
 if(!cmd.includes(R+"/cluster")||!cmd.includes(String(port)))throw Error("Private postgres process identity mismatch");
 return pid;
}
if(process.argv.includes("--capture")){
 if(fs.existsSync(R+"/source.dump")||fs.existsSync(R+"/cluster"))throw Error("Refusing overwrite");
 const pid=180;
 const command=fs.readFileSync("/proc/"+pid+"/cmdline","utf8").replaceAll("\0"," ");
 if(!command.includes("artifacts/api-server/dist-tanda-e-20260923/index.mjs"))throw Error("Effective API process changed");
 const raw=fs.readFileSync("/proc/"+pid+"/environ","utf8").split("\0").find(x=>x.startsWith("DATABASE_URL="))?.slice(13);
 if(!raw||raw!==process.env.DATABASE_URL)throw Error("Effective API database mismatch");
 const u=new URL(raw);
 const sourceEnv={PATH:process.env.PATH,HOME:process.env.HOME,PGHOST:u.searchParams.get("host")||u.hostname,PGPORT:u.port||"5432",PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),PGSSLMODE:u.searchParams.get("sslmode")||"prefer",PGOPTIONS:"-c default_transaction_read_only=on",PGCONNECT_TIMEOUT:"8"};
 const identity=run("psql",["-XAt","-v","ON_ERROR_STOP=1","-c","SELECT current_database(),current_setting('transaction_read_only'),current_setting('server_version_num')"],sourceEnv).trim();
 if(!identity.startsWith("heliumdb|on|16"))throw Error("Unexpected source identity");
 run("pg_dump",["-Fc","--no-owner","--no-acl","-f",R+"/source.dump"],sourceEnv);fs.chmodSync(R+"/source.dump",0o600);
 fs.writeFileSync(REPORT+"/source-identity.json",JSON.stringify({apiPid:pid,command,identity,sha256:createHash("sha256").update(fs.readFileSync(R+"/source.dump")).digest("hex"),readOnly:true,quiescenceClaim:false},null,2));
 run("initdb",["-D",R+"/cluster","-U","postgres","--auth-local=trust","--auth-host=trust","--no-locale","--encoding=UTF8"]);
 fs.mkdirSync(R+"/socket",{mode:0o700});
 progress("Fresh effective API dump captured read-only; private cluster initialized. No application writes.");
}
if(process.argv.includes("--prepare")){
 run("pg_ctl",["-D",R+"/cluster","-l",R+"/postgres-preparation.log","-o",`-p ${port} -k ${R}/socket -h 127.0.0.1`,"-w","start"]);
 let c;
 try{
 const pid=verifyProcess();
 if(!process.argv.includes("--resume-fixtures")){
 run("createdb",[database],env);
 run("pg_restore",["--exit-on-error","--no-owner","--no-acl","-d",database,R+"/source.dump"],env);
 }
 c=new pg.Client({host:"127.0.0.1",port,user:"postgres",database});await c.connect();
 const identity=(await c.query("SELECT current_database() db,current_setting('data_directory') dir,inet_server_port() port")).rows[0];
 if(identity.db!==database||identity.dir!==R+"/cluster"||identity.port!==port)throw Error("SQL copy identity mismatch");
 verifyProcess();
 await c.query("BEGIN");
 await c.query("UPDATE usuarios SET activo=false,nombre='Restored disabled actor '||id,usuario='restored-disabled-'||id,password_hash=crypt($1,gen_salt('bf',8))",[randomBytes(32).toString("hex")]);
 await c.query("DELETE FROM sesiones");
 const one=async(sql,p=[]) => (await c.query(sql,p)).rows[0];
 const sites=[],credentials={},sessions=[];
 for(let i=1;i<=3;i++)sites.push(await one("INSERT INTO ubicaciones(nombre,iniciales,tipo) VALUES($1,$2,'TIENDA') RETURNING id,nombre",["TANDA F TIENDA "+i,["TFA","TFB","TFC"][i-1]]));
 const roles=(await c.query("SELECT unnest(enum_range(NULL::rol_usuario))::text role")).rows.map(x=>x.role);
 for(const role of roles){
 const key=role.toLowerCase(),username=role==="ADMIN"?"admin":"tandaf-"+key,password=randomBytes(24).toString("base64url");
 const actor=await one("INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id) VALUES($1,$2,crypt($3,gen_salt('bf',10)),$4,$5) RETURNING id",["TANDA F "+role,username,password,role,sites[0].id]);
 credentials[key]={username,password,id:actor.id,role,siteId:sites[0].id};
 }
 for(let i=1;i<3;i++){
 const key="caja"+(i+1),username="tandaf-"+key,password=randomBytes(24).toString("base64url");
 const actor=await one("INSERT INTO usuarios(nombre,usuario,password_hash,rol,ubicacion_id) VALUES($1,$2,crypt($3,gen_salt('bf',10)),'CAJA',$4) RETURNING id",["TANDA F CAJA "+(i+1),username,password,sites[i].id]);
 credentials[key]={username,password,id:actor.id,role:"CAJA",siteId:sites[i].id};
 }
 const customer=await one("INSERT INTO clientes(nombre,dias_credito,limite_credito) VALUES('TANDA F CLIENTE GLOBAL',30,5000) RETURNING id,nombre,limite_credito,dias_credito");
 const supplier=await one("INSERT INTO proveedores(nombre,tipo) VALUES('TANDA F PROVEEDOR','NACIONAL') RETURNING id");
 const importSupplier=await one("INSERT INTO proveedores(nombre,tipo) VALUES('TANDA F IMPORTADOR','IMPORTACION') RETURNING id");
 const products=[],entries=[],rolls=[];
 for(const unit of ["METRO","KILO","PIEZA","BOLSA"])products.push(await one("INSERT INTO productos(sku,tela,color,unidad,precio_sugerido,precio_mayoreo,precio_menudeo) VALUES($1,$2,'AZUL TF',$3,150,150,150) RETURNING id,unidad",["TANDA-F-"+unit,"TANDA F "+unit,unit]));
 for(const [index,site] of sites.entries()){
 const entry=await one("INSERT INTO entradas(folio,ubicacion_id,proveedor_id,usuario_id,fecha,total_rollos,total_costo,uuid_cliente) VALUES(1,$1,$2,$3,now(),32,32000,$4) RETURNING id",[site.id,supplier.id,credentials.admin.id,randomUUID()]);entries.push({...entry,siteId:site.id});
 await c.query("INSERT INTO entrada_folio(ubicacion_id,ultimo_folio) VALUES($1,1)",[site.id]);
 for(const [pi,product] of products.entries()){
 for(let i=1;i<=8;i++){
 const serie=String(994000000+index*1000+pi*100+i);
 const roll=await one("INSERT INTO rollos(serie,producto_id,ubicacion_id,proveedor_id,recepcion_id,estado,cantidad_inicial,cantidad_actual,costo_unitario,costo_total) VALUES($1,$2,$3,$4,$5,'DISPONIBLE',10,10,100,1000) RETURNING id",[serie,product.id,site.id,supplier.id,entry.id]);
 const movement=await one("INSERT INTO movimientos(rollo_id,producto_id,ubicacion_id,tipo,cantidad,saldo_posterior,documento_tipo,documento_id,usuario_id,uuid_cliente) VALUES($1,$2,$3,'RECEPCION',10,$4,'ENTRADA',$5,$6,$7) RETURNING id",[roll.id,product.id,site.id,i*10,String(entry.id),credentials.admin.id,randomUUID()]);
 rolls.push({id:roll.id,serie,productId:product.id,siteId:site.id,unit:product.unidad,entryId:entry.id,supplierId:supplier.id,movementId:movement.id});
 }
 await c.query("INSERT INTO existencias(producto_id,ubicacion_id,cantidad_total,rollos_count) VALUES($1,$2,80,8)",[product.id,site.id]);
 }
 const actor=index===0?credentials.caja:credentials["caja"+(index+1)];
 const session=await one("INSERT INTO sesiones_caja(ubicacion_id,usuario_id,fecha_operativa,fondo_inicial) VALUES($1,$2,(now() at time zone 'America/Mexico_City')::date,5000) RETURNING id,ubicacion_id,estado,fecha_operativa,fondo_inicial",[site.id,actor.id]);sessions.push(session);
 await c.query("INSERT INTO sesiones_caja_dias(ubicacion_id,fecha_operativa,sesion_caja_id) SELECT ubicacion_id,fecha_operativa,id FROM sesiones_caja WHERE id=$1",[session.id]);
 }
 await c.query("COMMIT");
 const checks=(await c.query(`SELECT (SELECT count(*) FROM usuarios WHERE activo)::int active_actors,(SELECT count(*) FROM sesiones)::int auth_sessions,(SELECT count(*) FROM usuarios WHERE activo AND nombre NOT LIKE 'TANDA F %')::int restored_active_actors`)).rows[0];
 const inventory=(await c.query(`SELECT p.unidad,r.ubicacion_id,r.producto_id,count(*)::int rolls,sum(r.cantidad_actual) quantity,max(x.cantidad_total) cache,(SELECT sum(m.cantidad) FROM movimientos m WHERE m.producto_id=r.producto_id AND m.ubicacion_id=r.ubicacion_id) ledger FROM rollos r JOIN productos p ON p.id=r.producto_id JOIN existencias x ON x.producto_id=r.producto_id AND x.ubicacion_id=r.ubicacion_id WHERE r.producto_id=ANY($1) GROUP BY p.unidad,r.ubicacion_id,r.producto_id ORDER BY r.ubicacion_id,p.unidad`,[products.map(x=>x.id)])).rows;
 const provenance=(await one("SELECT count(*)::int n FROM rollos r JOIN entradas e ON e.id=r.recepcion_id AND e.proveedor_id=r.proveedor_id JOIN movimientos m ON m.rollo_id=r.id AND m.tipo='RECEPCION' AND m.documento_id=e.id::text WHERE r.producto_id=ANY($1)",[products.map(x=>x.id)])).n;
 if(checks.active_actors!==9||checks.auth_sessions!==0||checks.restored_active_actors!==0||provenance!==96||inventory.length!==12||inventory.some(x=>Number(x.quantity)!==80||x.quantity!==x.cache||x.quantity!==x.ledger))throw Error("Fixture verification failed");
 fs.writeFileSync(R+"/credentials.json",JSON.stringify(credentials,null,2),{mode:0o600});
 fs.writeFileSync(R+"/session-secret",randomBytes(48).toString("hex"),{mode:0o600});
 fs.writeFileSync(REPORT+"/fixture-manifest-redacted.json",JSON.stringify({sites,actors:Object.fromEntries(Object.entries(credentials).map(([key,{password,...actor}])=>[key,actor])),customer,supplier,importSupplier,products,entries,rolls,sessions},null,2));
 fs.writeFileSync(REPORT+"/verification.json",JSON.stringify({identity,pid,checks,inventory,provenance,permissions:"Natural roles; restored matrix unchanged; no actor overrides inserted"},null,2));
 await c.end();c=null;
 run("pg_dump",["-Fc","--no-owner","--no-acl","-d",database,"-f",R+"/template.dump"],env);fs.chmodSync(R+"/template.dump",0o600);
 for(const name of ["browser","concurrency","permissions","reversal"]){
 verifyProcess();run("createdb",["tanda_f_"+name],env);
 run("pg_restore",["--exit-on-error","--no-owner","--no-acl","-d","tanda_f_"+name,R+"/template.dump"],env);
 }
 run("createdb",["tanda_f_witness"],env);
 fs.writeFileSync(REPORT+"/template-identity.json",JSON.stringify({sha256:createHash("sha256").update(fs.readFileSync(R+"/template.dump")).digest("hex"),databases:["template","browser","concurrency","permissions","reversal","witness"].map(x=>"tanda_f_"+x),port},null,2));
 progress("Verified template and four independent copies prepared: 9 natural-role synthetic actors, 3 stores, shared credit customer, 96 traced multiunit rolls. PostgreSQL will stop cleanly; MAIN owns launch/teardown.");
 }catch(error){if(c){await c.query("ROLLBACK").catch(()=>{});await c.end();}fs.writeFileSync(R+"/prepare-error.txt",String(error),{mode:0o600});throw Error("Preparation failed; inspect private prepare-error.txt");}
 finally{verifyProcess();run("pg_ctl",["-D",R+"/cluster","-m","fast","-w","stop"]);}
}