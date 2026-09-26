import assert from "node:assert/strict";
import path from "node:path";
import { start, state, origin } from "./runtime.mjs";
const rt = await start(process.argv[2] === "cut-only" ? "cut-print-retest" : "documents-print-check"), { p, read, write, snap, result } = rt, f = state.fixtures;
let error;
const site = async () => {
  await p.getByRole("combobox").first().click(); await p.getByRole("option", { name: f.site.nombre, exact: true }).click();
};
try {
  if (process.argv[2] === "cut-only") {
    const cut = await read(`/api/sesiones-caja/${f.cash.id}/corte`);
    assert.equal(cut.status, 200); assert.equal(cut.body.sesion.estado, "CERRADA");
    assert.equal(cut.body.efectivoContado, "1925.00"); assert.equal(cut.body.efectivoEsperado, "1925.00");
    assert.equal(cut.body.diferencia, "0.00"); result.existingCut = cut.body;
  }
  for (const [name, id] of (process.argv[2] === "cut-only" ? [] : [["retained", f.retained.id], ["directed", f.directed.id]])) {
    const cobro = await read(`/api/e5/cobros/${id}`); assert.equal(cobro.status, 200);
    for (const [type, documentId] of [["receipt", cobro.body.reciboId], ...cobro.body.aplicaciones.map(a => ["application", a.constanciaId])]) {
      await p.goto(origin + `/cobros/pendientes/${id}/documentos/${documentId}`); await site();
      await p.getByLabel("Motivo de impresión / reimpresión", { exact: true }).fill("OWNER POSTREVIEW evidencia del recorrido nativo autorizado");
      await write(`document-${name}-${type}`, "POST", `/api/e5/cobros/${id}/documentos/${documentId}/impresiones`, p.getByRole("button", { name: "Solicitar impresión / reimpresión", exact: true }));
      const file = path.join(rt.folder, `${name}-${type}.pdf`); await p.pdf({ path: file, printBackground: true, preferCSSPageSize: true }); rt.register(file);
    }
  }
  await p.goto(origin + "/cobros"); await site();
  await p.getByRole("button", { name: "Historial de cortes", exact: true }).click();
  await p.getByRole("button", { name: "Ver corte", exact: true }).first().click();
  await p.getByRole("dialog").getByText("$1,925.00", { exact: true }).first().waitFor();
  await p.getByText("Consultando capacidad de envío…", { exact: true }).waitFor({ state: "hidden" });
  await p.getByText("Consultando corte canónico…", { exact: true }).waitFor({ state: "hidden" });
  await p.evaluate(() => {
    window.__observedPrint = [];
    window.addEventListener("beforeprint", () => {
      const target = document.querySelector(".corte-print"), parents = [];
      for (let el = target; el; el = el.parentElement) {
        const style = getComputedStyle(el);
        parents.push({ tag: el.tagName, className: el.className, display: style.display, visibility: style.visibility, textLength: el.textContent?.length });
      }
      window.__observedPrint.push({ printMedia: matchMedia("print").matches, bodyClass: document.body.className, parents });
    });
  });
  await p.getByRole("button", { name: "Imprimir Corte", exact: true }).click();
  result.beforePdf = await p.evaluate(() => ({ bodyClass: document.body.className, events: window.__observedPrint }));
  const file = path.join(rt.folder, "corte-native-print-repeat.pdf");
  await p.pdf({ path: file, printBackground: true, preferCSSPageSize: true }); rt.register(file);
  result.afterPdf = await p.evaluate(() => ({ bodyClass: document.body.className, events: window.__observedPrint }));
  // Inspect the existing print flag while it is still set by the native button.
  // No DOM style/class injection or replacement of window.print is performed.
  await p.emulateMedia({ media: "print" });
  result.printCss = await p.evaluate(() => {
    const el = document.querySelector(".corte-print"), css = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { bodyClass: document.body.className, printMedia: matchMedia("print").matches, directBodyChild: el.parentElement === document.body, display: css.display, visibility: css.visibility, transform: css.transform, translate: css.translate, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  });
  await p.emulateMedia({ media: "screen" });
  await snap("screen-cut-after-native-print");
} catch (e) { error = e; }
finally { await rt.finish(error); }