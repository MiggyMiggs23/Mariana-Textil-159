import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("admin","transfer");
try{
 await page.goto("http://127.0.0.1:43820/pos");
 await page.getByRole("combobox").first().click();
 await page.getByRole("option",{name:"TANDA E CONTINUACION",exact:true}).click();
 await snap(page,"transfer-02-site");
 await page.getByText("Ticket (Contado)",{exact:true}).click();
 await snap(page,"transfer-02-ticket-mode");
 await page.getByPlaceholder("Buscar por serie de rollo, SKU o tela...").fill("993000002");
 await page.getByRole("button",{name:"Agregar",exact:true}).first().waitFor();
 await snap(page,"transfer-02-pos");
 await page.getByRole("button",{name:"Agregar",exact:true}).first().click();
 await snap(page,"transfer-03-added");
 await page.getByRole("button",{name:"Confirmar Venta",exact:true}).click();
 await page.waitForURL(/\/tickets\/\d+/);
 await snap(page,"transfer-04-created");
 console.log("INPUTS",await page.locator("input").evaluateAll(es=>es.map(e=>({placeholder:e.placeholder,type:e.type}))));
}catch(e){await snap(page,"transfer-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}