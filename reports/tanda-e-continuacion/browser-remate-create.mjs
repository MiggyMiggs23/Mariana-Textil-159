import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("admin","remate");
try{
 await page.goto("http://127.0.0.1:43820/inventario/rollos/6237");
 await page.getByLabel("Motivo obligatorio para rollo 6237").fill("TANDA EC remate autorizado de rollo sintético con costo100 para venta90");
 await snap(page,"remate-02-before-mark");
 await page.getByRole("button",{name:"Marcar remate",exact:true}).click();
 await page.getByRole("button",{name:"Retirar remate",exact:true}).waitFor();
 await snap(page,"remate-03-marked");
 await page.goto("http://127.0.0.1:43820/pos");
 await page.getByRole("combobox").first().click();
 await page.getByRole("option",{name:"TANDA E CONTINUACION",exact:true}).click();
 await page.getByText("Ticket (Contado)",{exact:true}).click();
 await page.getByPlaceholder("Buscar por serie de rollo, SKU o tela...").fill("993000005");
 await page.getByRole("button",{name:"Agregar",exact:true}).first().click();
 await page.locator('input[type="number"]').fill("90");
 await page.locator('input[type="number"]').blur();
 await snap(page,"remate-04-price90");
 await page.getByRole("button",{name:"Confirmar Venta",exact:true}).click();
 await page.waitForURL(/\/tickets\/\d+/);
 await snap(page,"remate-05-created");
}catch(e){await snap(page,"remate-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}