import fs from "node:fs";
import {open,snap,fixture,origin,root} from "./browser-common.mjs";
const notes=[];
for(let index=0;index<3;index++){
 const {browser,page}=await open("admin");
 try{
 await page.goto(origin+"/pos");
 await page.getByRole("combobox").first().click();
 await page.getByRole("option",{name:fixture.sites[index].nombre,exact:true}).click();
 await page.getByText("Notas (Crédito)",{exact:true}).click();
 const roll=fixture.rolls.find(x=>x.siteId===fixture.sites[index].id&&x.unit==="METRO");
 await page.getByPlaceholder("Buscar por serie de rollo, SKU o tela...").fill(roll.serie);
 await page.getByRole("button",{name:"Agregar",exact:true}).first().click();
 await page.getByTestId("button-select-client").click();
 await page.getByPlaceholder("Nombre o teléfono...").fill("TANDA F CLIENTE");
 await page.getByTestId("option-client-"+fixture.customer.id).click();
 await snap(page,`02-site${index+1}-credit-preview`);
 await page.getByRole("button",{name:"Confirmar Venta",exact:true}).click();
 await page.waitForURL(/\/tickets\/\d+/);
 notes.push({site:fixture.sites[index].id,url:page.url(),roll:roll.id});
 await snap(page,`03-site${index+1}-credit-created`);
 }catch(e){await snap(page,`blocked-create-site${index+1}`);throw e;}
 finally{await browser.close();fs.writeFileSync(root+"/reports/tanda-f/tarea-1/notes-created.json",JSON.stringify(notes,null,2));}
 const cash=await open(index===0?"caja":"caja"+(index+1));
 try{
 await cash.page.goto(origin+"/cobros");
 await cash.page.getByRole("button",{name:"Autorizar",exact:true}).first().waitFor();
 await snap(cash.page,`04-site${index+1}-authorize-before`);
 await cash.page.getByRole("button",{name:"Autorizar",exact:true}).first().click();
 await snap(cash.page,`05-site${index+1}-authorize-dialog`);
 await cash.page.getByRole("dialog").getByRole("button",{name:"Autorizar",exact:true}).click();
 await cash.page.getByRole("dialog").waitFor({state:"hidden"});
 await snap(cash.page,`06-site${index+1}-authorized`);
 }catch(e){await snap(cash.page,`blocked-authorize-site${index+1}`);throw e;}
 finally{await cash.browser.close();}
}