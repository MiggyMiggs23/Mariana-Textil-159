import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("admin","pending-cancel");
try{
 await page.goto("http://127.0.0.1:43820/pos");
 await page.getByRole("combobox").first().click();
 await page.getByRole("option",{name:"TANDA E CONTINUACION",exact:true}).click();
 await page.getByText("Ticket (Contado)",{exact:true}).click();
 await page.getByPlaceholder("Buscar por serie de rollo, SKU o tela...").fill("993000006");
 await page.getByRole("button",{name:"Agregar",exact:true}).first().click();
 await snap(page,"pending-cancel-02-cart150");
 await page.getByRole("button",{name:"Confirmar Venta",exact:true}).click();
 await page.waitForURL(/\/tickets\/\d+/);
 await page.getByRole("button",{name:"Cancelar Ticket",exact:true}).waitFor();
 await snap(page,"pending-cancel-03-created-button");
 await page.getByRole("button",{name:"Cancelar Ticket",exact:true}).click();
 await page.getByRole("dialog").locator("textarea").fill("TANDA EC cancelar pendiente sin cobro; devolver rollo006");
 await snap(page,"pending-cancel-04-reason");
 await page.getByRole("button",{name:"Continuar",exact:true}).click();
 await snap(page,"pending-cancel-05-confirm");
 console.log("INPUTS",await page.getByRole("dialog").locator("input").evaluateAll(es=>es.map(e=>({id:e.id,placeholder:e.placeholder}))));
}catch(e){await snap(page,"pending-cancel-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}