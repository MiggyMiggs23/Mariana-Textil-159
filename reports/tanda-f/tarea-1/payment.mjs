import {open,snap,fixture,origin} from "./browser-common.mjs";
const [amount,label,siteIndex="0"]=process.argv.slice(2);
if(!/^\d+(\.\d{1,2})?$/.test(amount)||!/^[\w-]+$/.test(label))throw Error("Explicit amount/evidence label required");
const {browser,page}=await open("admin");
try{
await page.goto(origin+"/cobros?tab=cartera");
await page.getByRole("combobox").first().click();
await page.getByRole("option",{name:fixture.sites[Number(siteIndex)].nombre,exact:true}).click();
await page.getByTestId("button-caja-registrar-abono").click();
await page.getByTestId("button-cliente-context-combobox").click();
await page.getByTestId("input-cliente-context-search").fill("TANDA F CLIENTE");
await page.getByTestId("option-cliente-"+fixture.customer.id).click();
await page.getByTestId("cliente-payment-amount").fill(amount);
await page.getByTestId("e3-payment-method").click();
await page.getByRole("option",{name:"Efectivo",exact:true}).click();
await snap(page,label+"-form");
await page.getByTestId("e3-preview").click();
await page.getByTestId("e3-confirm").waitFor();
await snap(page,label+"-fifo-preview");
await page.getByTestId("e3-confirm").click();
await page.getByText("Abono registrado exitosamente",{exact:true}).waitFor();
await snap(page,label+"-success");
}catch(e){await snap(page,label+"-blocked");throw e;}finally{await browser.close();}