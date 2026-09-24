import {run,snap,origin} from "./browser.mjs";
await run(async p=>{
 await p.goto(origin+"/salidas?tab=recepcion");
 await p.getByText("Folio TFA-000001",{exact:true}).click();await snap(p,"14-reception-preview");
 await p.getByRole("button",{name:"Confirmar recepción de todos los rollos",exact:true}).click();await p.waitForTimeout(1200);await snap(p,"15-received");
});