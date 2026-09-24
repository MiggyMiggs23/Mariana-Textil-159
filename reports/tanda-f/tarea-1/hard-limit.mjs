import {open,snap,fixture,origin} from "./browser-common.mjs";
const {browser,page}=await open("admin");
try{
await page.goto(origin+"/pos");
await page.getByRole("combobox").first().click();
await page.getByRole("option",{name:fixture.sites[2].nombre,exact:true}).click();
await page.getByText("Notas (Crédito)",{exact:true}).click();
await page.getByPlaceholder("Buscar por serie de rollo, SKU o tela...").fill(fixture.rolls.filter(x=>x.siteId===fixture.sites[2].id&&x.unit==="METRO")[1].serie);
await page.getByRole("button",{name:"Agregar",exact:true}).first().click();
await page.getByTestId("button-select-client").click();
await page.getByPlaceholder("Nombre o teléfono...").fill("TANDA F CLIENTE");
await page.getByTestId("option-client-"+fixture.customer.id).click();
await snap(page,"07-global-limit-preview");
const button=page.getByRole("button",{name:"Confirmar Venta",exact:true});
if(await button.isEnabled()){await button.click();await page.waitForTimeout(1000);}
await snap(page,"08-global-limit-result");
}catch(e){await snap(page,"blocked-limit");throw e;}finally{await browser.close();}