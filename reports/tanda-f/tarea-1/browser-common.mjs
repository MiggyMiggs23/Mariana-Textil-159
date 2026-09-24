import fs from "node:fs";
import {chromium} from "../../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
export const root="/home/runner/workspace",evidence=root+"/reports/tanda-f/tarea-1/evidence",origin="http://127.0.0.1:43820";
fs.mkdirSync(evidence,{recursive:true});
export const fixture=JSON.parse(fs.readFileSync(root+"/reports/tanda-f/setup/fixture-manifest-redacted.json","utf8"));
export async function open(role){
 const browser=await chromium.launch({headless:true,executablePath:root+"/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",env:{...process.env,LD_LIBRARY_PATH:root+"/.local/tanda-f/browser-libs"},args:["--no-sandbox"],timeout:20000});
 const page=await browser.newPage({viewport:{width:1360,height:1000}});
 page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(20000);
 await page.route("**/*",route=>{const u=new URL(route.request().url());return u.origin===origin||["data:","blob:"].includes(u.protocol)?route.continue():route.abort();});
 const creds=JSON.parse(fs.readFileSync(root+"/.local/tanda-f/credentials.json","utf8"))[role];
 await page.goto(origin+"/login");
 await page.getByLabel("Usuario",{exact:true}).fill(creds.username);
 await page.getByLabel("Contraseña",{exact:true}).fill(creds.password);
 await page.getByRole("button",{name:"Ingresar",exact:true}).click();
 await page.waitForURL(url=>!url.pathname.includes("login"));
 return {browser,page};
}
export async function snap(page,name){
 await page.screenshot({path:evidence+"/"+name+".png",fullPage:true});
 const text=await page.locator("body").innerText();
 fs.writeFileSync(evidence+"/"+name+".txt",text);
 console.log(name,text.slice(-9000));
}