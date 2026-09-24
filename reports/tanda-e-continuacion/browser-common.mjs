import fs from "node:fs";
import {chromium} from "../../.cache/pnpm/dlx/0be451ecc86649edb1205a8454559cdd433606b22e8744a742f8d93fdb9e4b57/1a0642de1a4-8c2/node_modules/.pnpm/playwright@1.55.0/node_modules/playwright/index.mjs";
const root="/home/runner/workspace";
export const evidence=root+"/reports/tanda-e-continuacion/evidence";
fs.mkdirSync(evidence,{recursive:true});
export async function open(role,prefix){
 const browser=await chromium.launch({headless:true,executablePath:process.env.TANDA_E_CHROMIUM_EXECUTABLE??root+"/.cache/ms-playwright/chromium-1187/chrome-linux/chrome",env:{...process.env,LD_LIBRARY_PATH:root+"/.local/tanda-e-continuacion/browser-libs"},args:["--no-sandbox"],timeout:20000});
 const page=await browser.newPage({viewport:{width:1360,height:1000}});
 page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(20000);
 await page.route("**/*",route=>{const u=new URL(route.request().url());return u.origin==="http://127.0.0.1:43820"||["data:","blob:"].includes(u.protocol)?route.continue():route.abort();});
 const creds=JSON.parse(fs.readFileSync(root+"/.local/tanda-e-continuacion/credentials.json","utf8"))[role];
 await page.goto("http://127.0.0.1:43820/login");
 await page.getByLabel("Usuario",{exact:true}).fill(creds.username);
 await page.getByLabel("Contraseña",{exact:true}).fill(creds.password);
 await page.getByRole("button",{name:"Ingresar",exact:true}).click();
 await page.waitForURL(url=>!url.pathname.includes("login"));
 await page.screenshot({path:evidence+"/"+prefix+"-01-login.png",fullPage:true});
 return {browser,page};
}
export async function snap(page,name){await page.screenshot({path:evidence+"/"+name+".png",fullPage:true});console.log((await page.locator("body").innerText()).slice(-14000));}