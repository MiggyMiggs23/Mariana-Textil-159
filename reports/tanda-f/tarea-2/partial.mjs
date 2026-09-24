import {run,snap,origin} from "./browser.mjs";
await run(async p=>{
 await p.goto(origin+"/pos");await p.getByRole("combobox").first().click();await p.getByRole("option",{name:"TANDA F TIENDA 2",exact:true}).click();
 await p.getByText("Notas (Crédito)",{exact:true}).click();await p.getByText("Cortes (METREADO)",{exact:true}).click();await snap(p,"16-partial-mode");
 console.log(await p.locator("input").evaluateAll(es=>es.map(e=>({placeholder:e.placeholder,type:e.type}))));
 await p.getByPlaceholder("Buscar por producto o SKU...").fill("TANDA-F-METRO");await p.waitForTimeout(800);await snap(p,"18-partial-product-result");
 const add=p.getByRole("button",{name:"Agregar",exact:true});if(await add.count()){await add.first().click();await snap(p,"19-partial-block");}
});