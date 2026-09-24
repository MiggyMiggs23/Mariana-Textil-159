import fs from "node:fs";
import assert from "node:assert/strict";
import {chromium} from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root=process.cwd(),origin="http://127.0.0.1:43840",dir=root+"/reports/tanda-g/candidate/browser";
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:root+"/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",env:{...process.env,LD_LIBRARY_PATH:root+"/.local/tanda-g/browser-libs"},args:["--no-sandbox"],timeout:20000});
const p=await browser.newPage({viewport:{width:1360,height:1000}});
p.setDefaultTimeout(12000);
await p.route("**/*",r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const snap=async name=>{await p.screenshot({path:dir+"/"+name+".png",fullPage:true});const text=await p.locator("body").innerText();fs.writeFileSync(dir+"/"+name+".txt",text);console.log(text.slice(-7000));return text;};
try{
const creds=JSON.parse(fs.readFileSync(root+"/.local/tanda-g/credentials.json")).admin;
await p.goto(origin+"/login");await p.getByLabel("Usuario",{exact:true}).fill(creds.username);await p.getByLabel("Contraseña",{exact:true}).fill(creds.password);await p.getByRole("button",{name:"Ingresar",exact:true}).click();await p.waitForURL(u=>!u.pathname.includes("login"));
await p.goto(origin+"/salidas/nueva");await p.getByText("Seleccione origen",{exact:true}).click();await p.getByRole("option",{name:"TANDA G TIENDA 1",exact:true}).click();await p.getByText("Seleccione destino",{exact:true}).click();await p.getByRole("option",{name:"TANDA G TIENDA 3",exact:true}).click();
await p.getByPlaceholder("Nombre, placas...").fill("TANDA G browser verification");await p.getByPlaceholder("Notas del envío...").fill("Tanda G four-unit verification on disposable copy");
const f=JSON.parse(fs.readFileSync(root+"/reports/tanda-g/setup/fixture-manifest-redacted.json"));
const selected=["METRO","KILO","PIEZA","BOLSA"].map(unit=>f.rolls.find(r=>r.siteId===835&&r.unit===unit));
for(const roll of selected){const input=p.getByPlaceholder("Escanea o ingresa la serie del rollo y presiona Enter...");await input.fill(roll.serie);await input.press("Enter");await p.waitForTimeout(500);}
await snap("01-mixed-unit-preview");
await p.getByRole("button",{name:"Guardar y enviar",exact:true}).click();await p.waitForTimeout(1500);await snap("02-mixed-unit-saved");
fs.writeFileSync(dir+"/transfer.json",JSON.stringify({url:p.url(),selected},null,2));
}catch(e){await snap("error");throw e;}finally{await browser.close();}