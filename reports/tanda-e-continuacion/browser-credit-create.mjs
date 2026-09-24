import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("admin","credit");
try{
 await page.goto("http://127.0.0.1:43820/pos");
 await page.getByRole("combobox").first().click();
 await page.getByRole("option",{name:"TANDA E CONTINUACION",exact:true}).click();
 await page.getByText("Notas (Crédito)",{exact:true}).click();
 await snap(page,"credit-02-pos");
 await page.getByPlaceholder("Buscar por serie de rollo, SKU o tela...").fill("993000003");
 await page.getByRole("button",{name:"Agregar",exact:true}).first().click();
 await snap(page,"credit-03-roll");
 await page.getByTestId("button-select-client").click();
 await page.getByPlaceholder("Nombre o teléfono...").fill("TANDA EC CLIENTE");
 await page.getByTestId("option-client-8").click();
 await snap(page,"credit-04-customer");
 await page.getByRole("button",{name:"Confirmar Venta",exact:true}).click();
 await page.waitForURL(/\/tickets\/\d+/);
 await snap(page,"credit-05-created");
}catch(e){await snap(page,"credit-create-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}