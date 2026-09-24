import {run,snap,origin} from "./browser.mjs";
await run(async p=>{
 await p.goto(origin+"/entradas");await p.getByTestId("btn-create-entrada").click();
 await p.getByTestId("select-entrada-ubicacion").click();await p.getByRole("option",{name:"TANDA F TIENDA 1",exact:true}).click();
 await p.getByTestId("select-entrada-proveedor").click();await p.getByRole("option",{name:"TANDA F IMPORTADOR",exact:true}).click();
 await p.waitForTimeout(1000);await p.getByText("Ninguno",{exact:true}).click();
 await p.getByRole("option").filter({hasText:"TANDA-F-T2-CONTAINER"}).click();
 await p.getByPlaceholder("Escribe tela, color o SKU...").fill("TANDA-F-METRO");await p.getByRole("option").filter({hasText:"TANDA F METRO"}).click();
 await p.getByTestId("input-declared").fill("2");await p.getByTestId("input-costo-unitario").fill("100");
 await p.getByTestId("btn-add-line").click();await p.getByTestId("input-uniform-qty").fill("10");await p.getByTestId("button-apply-uniform").click();await snap(p,"07-roll-capture");
 await p.getByRole("button",{name:"Confirmar Línea",exact:true}).click();
 await p.getByLabel("Imprimir Etiquetas",{exact:true}).uncheck();
 await p.getByLabel("Imprimir Documento",{exact:true}).uncheck();
 await p.getByTestId("btn-save-entrada").click();await p.waitForTimeout(1500);await snap(p,"08-entry-saved");
 await p.getByRole("button",{name:"Confirmar y guardar",exact:true}).click();await p.waitForTimeout(1500);await snap(p,"08b-entry-confirmed");
});