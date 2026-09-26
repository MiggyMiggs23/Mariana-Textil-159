import assert from "node:assert/strict";
import path from "node:path";
import { start, state, persist, origin } from "./runtime.mjs";
const rt = await start("salida-transfer"), { p, write, read, snap, result } = rt, f = state.fixtures;
let error;
try {
  if (process.argv[2] !== "resume-receive") {
  await p.goto(origin + "/ubicaciones"); await p.getByTestId("button-create-location").click();
  const d = p.getByRole("dialog"); await d.locator("input").first().fill("OWNER POSTREVIEW26 DESTINO");
  await d.getByPlaceholder("MA").fill("OWD");
  f.destination = await write("destination", "POST", "/api/locations", d.getByRole("button", { name: "Guardar", exact: true })); persist();
  await p.goto(origin + "/salidas/nueva");
  const origen = p.locator("div.space-y-1\\.5").filter({ has: p.locator("label").filter({ hasText: /^Origen$/ }) }).getByRole("combobox");
  await origen.click(); await p.getByRole("option", { name: f.site.nombre, exact: true }).click();
  await p.getByText("Seleccione destino", { exact: true }).click();
  await p.getByRole("option", { name: f.destination.nombre, exact: true }).click();
  await p.getByPlaceholder("Nombre, placas...").fill("OWNER TRANSPORTE NATIVO");
  const scan = p.getByPlaceholder("Escanea o ingresa la serie del rollo y presiona Enter...");
  await scan.fill(f.entry.rollos[3].serie);
  f.salida = await write("salida-scan", "POST", "/api/salidas/borrador/rollos", { click: () => scan.press("Enter") }); persist();
  f.salida = await write("salida-send", "POST", `/api/salidas/${f.salida.id}/enviar`, p.getByRole("button", { name: "Guardar y enviar", exact: true })); persist();
  }
  const sent = await read(`/api/salidas/${f.salida.id}`); assert.equal(sent.status, 200); assert.equal(sent.body.estado, "EN_TRANSITO"); result.sent = sent.body;
  await p.goto(origin + `/salidas/${f.salida.id}`);
  await p.getByTestId("btn-print-salida").click();
  await p.waitForURL(url => url.pathname.endsWith("/documento/salida"));
  await p.getByTestId("document-page-1").waitFor();
  await snap("authentic-salida-document");
  const pdf = path.join(rt.folder, "salida-original.pdf"); await p.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true }); rt.register(pdf);
  await p.goto(origin + "/salidas"); await p.getByRole("combobox").first().click();
  await p.getByRole("option", { name: f.destination.nombre, exact: true }).click();
  await p.getByRole("tab", { name: "Recepción", exact: true }).click();
  const input = p.getByRole("textbox", { name: "QR o folio de salida", exact: true });
  await p.getByText(`Folio ${f.salida.folioFormateado}`, { exact: true }).waitFor();
  await input.fill(String(f.salida.folio)); await input.press("Enter");
  await p.getByRole("button", { name: "Confirmar recepción de todos los rollos", exact: true }).waitFor();
  if (!await p.getByRole("checkbox", { name: "¿Llegó completo?", exact: true }).isChecked()) await p.getByRole("checkbox", { name: "¿Llegó completo?", exact: true }).check();
  f.received = await write("salida-receive", "POST", `/api/salidas/${f.salida.id}/recibir`, p.getByRole("button", { name: "Confirmar recepción de todos los rollos", exact: true })); persist();
  const after = await read(`/api/salidas/${f.salida.id}`); assert.equal(after.status, 200); assert.equal(after.body.estado, "RECIBIDA");
  result.received = after.body; await snap("received-independent");
} catch (e) { error = e; }
finally { await rt.finish(error); }