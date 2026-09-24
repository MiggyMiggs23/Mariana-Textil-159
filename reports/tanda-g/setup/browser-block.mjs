import fs from "node:fs";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "../../../scripts/node_modules/pg/lib/index.js";
import {chromium} from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(),origin="http://127.0.0.1:43840",dir=root+"/reports/tanda-g/candidate/browser";
const browser=await chromium.launch({headless:true,executablePath:root+"/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",env:{...process.env,LD_LIBRARY_PATH:root+"/.local/tanda-g/browser-libs"},args:["--no-sandbox"]});
const p=await browser.newPage({viewport:{width:1360,height:1000}});
const client=new pg.Client({host:"127.0.0.1",port:55441,user:"postgres",database:"tanda_g_browser",options:"-c default_transaction_read_only=on"});await client.connect();
try{
const creds=JSON.parse(fs.readFileSync(root+"/.local/tanda-g/credentials.json")).admin;
const login=await fetch("http://127.0.0.1:43843/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({usuario:creds.username,password:creds.password})});
assert.ok(login.ok);const cookie=login.headers.get("set-cookie").split(";")[0];
const existing=(await client.query("select id from movimientos where rollo_id=6234 and justificacion='TANDA G browser blocked reversal target'")).rows;
for(const [cantidadNueva,justificacion] of existing.length?[]:[["12","TANDA G browser blocked reversal target"],["14","TANDA G browser successor adjustment"]]){
 const response=await fetch("http://127.0.0.1:43843/api/inventario/rollos/6234/ajustar",{method:"POST",headers:{"content-type":"application/json",cookie},body:JSON.stringify({cantidadNueva,justificacion,uuidCliente:randomUUID()})});assert.equal(response.status,200,await response.text());
}
await p.goto(origin+"/login");await p.getByLabel("Usuario",{exact:true}).fill(creds.username);await p.getByLabel("Contraseña",{exact:true}).fill(creds.password);await p.getByRole("button",{name:"Ingresar",exact:true}).click();await p.waitForURL(u=>!u.pathname.includes("login"));
await p.goto(origin+"/inventario/ajustes");await p.getByRole("tab",{name:/Revisión Pendiente/}).click();
const before=(await client.query("select row_to_json(r) as r from rollos r where id=6234")).rows;
const countBefore=(await client.query("select count(*) from movimientos where rollo_id=6234")).rows;
const responsePromise=p.waitForResponse(r=>r.url().includes("/revertir")&&r.request().method()==="POST");
await p.getByRole("row").filter({hasText:"TANDA G browser blocked reversal target"}).getByRole("button",{name:"Rechazar",exact:true}).click();
const response=await responsePromise;const body=await response.json();
await p.waitForTimeout(400);
await p.screenshot({path:dir+"/03-reversal-block.png",fullPage:true});
const text=await p.locator("body").innerText();fs.writeFileSync(dir+"/03-reversal-block.txt",text);
const after=(await client.query("select row_to_json(r) as r from rollos r where id=6234")).rows;
const countAfter=(await client.query("select count(*) from movimientos where rollo_id=6234")).rows;
assert.deepEqual(before,after);assert.deepEqual(countBefore,countAfter);assert.ok(response.status()>=400);
fs.writeFileSync(dir+"/reversal-result.json",JSON.stringify({status:response.status(),body,before,after,countBefore,countAfter},null,2));console.log(JSON.stringify({status:response.status(),body}));console.log(text.slice(-3500));
}finally{await client.end();await browser.close();}