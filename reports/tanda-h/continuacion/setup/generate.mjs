// Generate fresh, independently rooted setup from the successful H scripts.
import fs from "node:fs";
const root=process.cwd(), out=root+"/reports/tanda-h/continuacion/setup", priv=root+"/private.local/tanda-h-resume";
fs.mkdirSync(priv,{recursive:true,mode:0o700});fs.chmodSync(priv,0o700);
const exclude=root+"/.git/info/exclude";
if(!fs.readFileSync(exclude,"utf8").includes("/private.local/"))fs.appendFileSync(exclude,"\n/private.local/\n");
const adapt=s=>s.replaceAll('"../../../scripts/node_modules/pg/lib/index.js"',JSON.stringify(root+"/scripts/node_modules/pg/lib/index.js"))
 .replaceAll(root+"/.local/tanda-h",priv).replaceAll('/.local/tanda-h','/private.local/tanda-h-resume')
 .replaceAll("/reports/tanda-h/setup","/reports/tanda-h/continuacion/setup")
 .replaceAll("55444","55445").replaceAll("tanda_h_","tanda_hr_").replaceAll("h_performance","hr_browser")
 .replaceAll('["inventory","performance","permissions"]','["browser"]')
 .replaceAll('["inventory","performance"]','["browser"]')
 .replaceAll('["template","inventory","performance","permissions","witness"]','["template","browser","witness"]')
 .replaceAll('const role="h_"+name','const role="hr_"+name')
 .replaceAll("'h_%'","'hr_%'").replaceAll('"tanda_"+x.rolname','"tanda_"+x.rolname')
 .replaceAll("43871","43874").replaceAll("43881","43884");
for(const name of ["freeze","lifecycle","api-runner","proxy"]){
 let s=adapt(fs.readFileSync(root+"/reports/tanda-h/setup/"+name+".mjs","utf8"));
 if(name==="freeze")s=s.replace('if(fs.existsSync(s))','if(commit!=="b77bd7db4f97368433ef7dbce6e5c756b78b4452")throw Error("Unexpected source freeze");\nif(fs.existsSync(s))');
 fs.writeFileSync(out+"/"+name+".mjs",s);
}
// Adapt the outer H preparation wrapper and explicitly rewrite the generated F base.
let prep=adapt(fs.readFileSync(root+"/reports/tanda-h/setup/prepare.mjs","utf8"));
prep=prep.replace(' .replace(\'"/home/runner/workspace/scripts/node_modules/pg/lib/index.js"\',JSON.stringify(root+"/scripts/node_modules/pg/lib/index.js"))', ' .replace(\'"../../../scripts/node_modules/pg/lib/index.js"\',JSON.stringify(root+"/scripts/node_modules/pg/lib/index.js"))');
prep=prep.replace('fs.writeFileSync(r+"/prepare-generated.mjs",text',
 `text=text.replaceAll("/.local/tanda-h","/private.local/tanda-h-resume").replaceAll("/reports/tanda-h/setup","/reports/tanda-h/continuacion/setup").replaceAll("tanda_h_","tanda_hr_").replaceAll('["inventory","performance","permissions"]','["browser"]').replaceAll('["template","inventory","performance","permissions","witness"]','["template","browser","witness"]');\nfs.writeFileSync(r+"/prepare-generated.mjs",text`);
fs.writeFileSync(out+"/prepare.mjs",prep);
let own=adapt(fs.readFileSync(root+"/reports/tanda-h/setup/prepare-ownership.mjs","utf8")).replaceAll("h_${worker}","hr_${worker}").replaceAll('"h_"+worker','"hr_"+worker').replaceAll('"reports/tanda-h/setup/','"reports/tanda-h/continuacion/setup/');
fs.writeFileSync(out+"/prepare-ownership.mjs",own);
let load=fs.readFileSync(root+"/reports/tanda-g-ampliada/tarea-4/load.mjs","utf8")
 .replaceAll("tanda-g-ampliada","tanda-h").replaceAll("tarea-4","continuacion/setup")
 .replaceAll("tanda_ga_performance","tanda_hr_browser").replaceAll("ga_performance","hr_browser").replaceAll("55442","55445")
 .replace("($2::int[])[1+(g-1)%7]","($2::int[])[1+(g-1)%3]");
load=adapt(load).replaceAll(".performance;",".browser;");
fs.writeFileSync(out+"/load.mjs",load);
let cash=adapt(fs.readFileSync(root+"/reports/tanda-h/tarea-2/cash-write.mjs","utf8"))
 .replaceAll(".performance;",".browser;").replaceAll("tanda_hr_performance","tanda_hr_browser")
 .replaceAll("/reports/tanda-h/tarea-2/cash-write.json","/reports/tanda-h/continuacion/setup/cash-write.json")
 .replace('throw Error("Isolation mismatch");',`throw Error("Isolation mismatch");\nconst customer=(await pool.query("INSERT INTO clientes(nombre,dias_credito,limite_credito) VALUES('TANDA H RESUME SMALL CUSTOMER',30,5000) RETURNING id,nombre")).rows[0];\nf.customer=customer;\nfs.writeFileSync(root+"/reports/tanda-h/continuacion/setup/small-customer.json",JSON.stringify(customer,null,2));`);
fs.writeFileSync(out+"/cash-write.mjs",cash);
console.log("Fresh setup scripts generated; no application launched.");