import {open,snap} from "./browser-common.mjs";
const {browser,page}=await open("admin","abono");
try{
 await page.goto("http://127.0.0.1:43820/cobros?tab=cartera");
 await page.getByRole("combobox").first().click();
 await page.getByRole("option",{name:"TANDA E CONTINUACION",exact:true}).click();
 await snap(page,"abono-02-cartera");
 await page.getByTestId("button-caja-registrar-abono").click();
 await page.getByTestId("button-cliente-context-combobox").click();
 await page.getByTestId("input-cliente-context-search").fill("TANDA EC");
 await page.getByTestId("option-cliente-8").click();
 await snap(page,"abono-03-form");
 await page.getByTestId("cliente-payment-amount").fill("50");
 await page.getByTestId("e3-payment-method").click();
 await page.getByRole("option",{name:"Efectivo",exact:true}).click();
 await snap(page,"abono-04-amount");
 await page.getByTestId("e3-preview").click();
 await page.getByTestId("e3-confirm").waitFor();
 await snap(page,"abono-05-preview");
 await page.getByTestId("e3-confirm").click();
 await page.getByText("Abono registrado exitosamente",{exact:true}).waitFor();
 await snap(page,"abono-06-success");
 console.log("RECEIPT LINKS",await page.locator('a[href*="recibo"]').evaluateAll(es=>es.map(e=>({text:e.textContent,href:e.getAttribute("href")}))));
}catch(e){await snap(page,"abono-blocked");console.log("BLOCKED",e.message);}
finally{await browser.close();}