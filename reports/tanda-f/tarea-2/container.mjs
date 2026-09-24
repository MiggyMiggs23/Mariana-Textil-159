import {run,snap,origin} from "./browser.mjs";
await run(async p=>{
 await p.goto(origin+"/contenedores/nuevo");await p.getByText("Selecciona proveedor...",{exact:true}).click();await p.getByRole("option",{name:"TANDA F IMPORTADOR",exact:true}).click();
 await p.getByText("Selecciona sitio...",{exact:true}).click();await p.getByRole("option",{name:"TANDA F TIENDA 1",exact:true}).click();
 await p.locator('input[type=date]').first().fill("2026-09-24");await p.getByPlaceholder("Ej. BL-489201").fill("TANDA-F-T2-CONTAINER");
 await p.getByRole("button",{name:"Agregar Producto",exact:true}).click();await snap(p,"02-container-line");
 await p.getByPlaceholder("Producto...",{exact:true}).fill("TANDA-F-METRO");await p.waitForTimeout(500);await snap(p,"03-product-options");
 await p.getByRole("option").filter({hasText:"TANDA F METRO"}).click();
 await p.locator('input[type=number]').nth(0).fill("20");await p.locator('input[type=number]').nth(1).fill("2");
 await p.getByRole("button",{name:"Programar Embarque",exact:true}).click();await p.waitForTimeout(1000);await snap(p,"04-container-created");
});