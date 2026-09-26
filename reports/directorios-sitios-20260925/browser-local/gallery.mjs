// Generate a portable, self-contained HTML artifact from real Chromium PNGs.
// Run only after capture.mjs after and capture.mjs after-cruces-store have completed.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const base = import.meta.dirname;
const names = {
  before: "ANTES 1 · build activo congelado (directorio de clientes anterior)",
  "pre-simplification": "ANTES 2 · directorios y sitios, justo antes de simplificar",
  after: "DESPUÉS · build candidato final simplificado (sin activar)",
  "after-cruces-store": "PRUEBA ADICIONAL · Cruces reclasificada como TIENDA sólo en la respuesta local",
};
const esc = text => text.replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]);
const caption = (file, mode) => {
  const captions = {
    "clientes": "Listado de clientes: nombre, teléfono, RFC y columnas comerciales.",
    "clientes-cartera": mode === "before"
      ? "Cartera en el build activo congelado: incluye BODEGAS en el alcance."
      : mode === "after-cruces-store"
        ? "Cruces aparece en Cartera únicamente al reclasificarse como TIENDA en la respuesta sintética."
        : "Cartera: sólo Global y TIENDAS activas; se excluyen las cuatro BODEGAS.",
    "clientes-analisis": "Análisis de clientes inicialmente recogido en el build final.",
    "clientes-analisis-expandido": "Desplegable de análisis de clientes abierto en Chromium.",
    "proveedores": "Listado de proveedores y campos comerciales.",
    "proveedores-analisis": "Análisis global de proveedores inicialmente recogido en el build final.",
    "proveedores-analisis-expandido": "Desplegable de análisis de proveedores abierto en Chromium.",
    "proveedores-ultimas-compras": "Historial de compras: fila sintética válida del contrato y filtros.",
    "proveedor-ficha-telefono-rfc": "Ficha de proveedor: RFC y teléfono comprobados en el DOM.",
    "cliente-ficha-telefono-rfc": "Ficha de cliente: teléfono y RFC comprobados en el DOM.",
    "cliente-ultimas-ventas": "Últimas ventas: operación sintética y folio navegable.",
    "cliente-venta-documento-original": "Navegación real desde el folio 725 al documento de ticket en la SPA.",
    "cliente-estado-cuenta": "Estado de cuenta: pestaña de crédito independiente del historial de ventas.",
    "cobros-cartera-selector": "Selector contextual de crédito en Cobros: sólo Global y tiendas.",
    "reportes-clientes-credito-selector": "Selector contextual de crédito en Reportes: sólo Global y tiendas.",
  };
  const key = file.replace(".png", "");
  if (captions[key]) return captions[key];
  if (key.endsWith("-sitios-abierto")) return `${key.split("-")[0]}: menú operativo abierto; aparecen cuatro BODEGAS y tres TIENDAS sintéticas.`;
  if (key.endsWith("-bodega-cruces")) return `${key.split("-")[0]}: Bodega Cruces seleccionada como sitio operativo.`;
  return key.replaceAll("-", " ");
};
const embedded = async (mode, file) => `data:image/png;base64,${(await readFile(join(base, "screenshots", mode, file))).toString("base64")}`;
const panels = [];
for (const [mode, label] of Object.entries(names)) {
  const dir = join(base, "screenshots", mode);
  let files;
  try { files = (await readdir(dir)).filter(n => n.endsWith(".png")).sort(); }
  catch { throw Error(`Missing captures for ${mode}; gallery will not fabricate evidence`); }
  if (!files.length) throw Error(`No screenshots in ${dir}`);
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
  if (manifest.missingApiFixtures?.length || manifest.browserErrors?.length) throw Error(`${mode} has errors/unstubbed APIs; gallery will not present it as verified`);
  panels.push(`<section><h2>${esc(label)}</h2><p>${esc(manifest.dist)} · ${files.length} capturas PNG · ${esc(manifest.capturedAt)}</p><div class="grid">${(await Promise.all(files.map(async file => `<figure><figcaption>${esc(caption(file, mode))}</figcaption><img loading="lazy" src="${await embedded(mode, file)}" alt="${esc(label + " / " + file)}"></figure>`))).join("")}</div></section>`);
}
const contactItems = [
  ["after", "inventario-sitios-abierto.png", "Inventario: bodegas operativas"],
  ["after", "entradas-sitios-abierto.png", "Entradas: bodegas operativas"],
  ["after", "salidas-sitios-abierto.png", "Salidas: bodegas operativas"],
  ["after", "viajes-sitios-abierto.png", "Viajes: bodegas operativas"],
  ["after", "movimientos-sitios-abierto.png", "Movimientos: bodegas operativas"],
  ["after", "clientes-cartera.png", "Cartera: sin BODEGAS"],
  ["after-cruces-store", "clientes-cartera.png", "Cruces reclasificada TIENDA: ahora aparece"],
];
const contactFigures = (await Promise.all(contactItems.map(async ([mode, file, text]) => `<figure><figcaption>${esc(text)}</figcaption><img src="${await embedded(mode, file)}" alt="${esc(text)}"></figure>`))).join("");
const css = `body{margin:0;background:#edf1f6;color:#16223b;font:15px/1.5 system-ui}header{background:#101c3c;color:white;padding:24px 4vw}h1{margin:0;font-size:28px}header p{max-width:1050px}main{padding:0 3vw 4vw}section{margin:24px 0;background:white;padding:20px;border-radius:14px}h2{margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,550px),1fr));gap:18px}.contact{grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))}figure{margin:0;border:1px solid #cbd3e3;border-radius:9px;overflow:hidden;background:#f6f8fc}figcaption{font-weight:600;padding:10px 14px}img{width:100%;height:auto;display:block}`;
const intro = `<header><h1>Capturas comparativas locales</h1><p>Exportaciones PNG reales de Chromium/CDP sobre builds estáticos, con API simulada en servidor privado loopback. <strong>Los nombres Tienda Centro/Norte/Sur y las cuatro Bodegas son datos sintéticos de prueba: no representan el catálogo real.</strong> Sin consultas a la base de datos ni a la API productiva. El candidato final NO está activado. «ANTES 1» es el build activo congelado de clientes; «ANTES 2» es el build de directorios/sitios preservado justo antes de esta simplificación; no deben confundirse. La ficha completa del proveedor y la pestaña «Últimas ventas» no existían en ANTES 1: para ellas se compara ANTES 2 con DESPUÉS.</p><p>Las imágenes están integradas en base64 y son descargables abriendo este HTML sin servidor.</p></header>`;
const sheet = `<section><h2>Resumen visual inmediato · cinco vistas operativas y Cartera</h2><div class="grid contact">${contactFigures}</div></section>`;
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capturas locales verificadas · Mariana Textil</title><style>${css}</style>${intro}<main>${sheet}${panels.join("")}</main></html>`;
const output = join(base, "..", "capturas-antes-despues.html");
await writeFile(output, html);
console.log(`Portable gallery: ${output} (${Buffer.byteLength(html)} bytes)`);
const contact = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resumen visual · ubicaciones sintéticas</title><style>${css}</style>${intro}<main>${sheet}</main></html>`;
const contactPath = join(base, "..", "capturas-resumen-operativo.html");
await writeFile(contactPath, contact);
console.log(`Portable contact sheet: ${contactPath} (${Buffer.byteLength(contact)} bytes)`);