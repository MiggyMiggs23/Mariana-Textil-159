import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { withBrowserFixture } from "../../../artifacts/mariana-textil/src/observable-test/browser";
const root = process.cwd(), app = path.join(root, "artifacts/mariana-textil");
const harness = path.join(app, "src/components/e5-node-test-harness.tsx");
const scratch = path.join(root, ".local/night-financial-visual");
fs.mkdirSync(scratch, { recursive: true });
const apiSource = path.join(root, "lib/api-client-react/src/generated/api.ts");
const hooks = [...new Set([...fs.readFileSync(apiSource, "utf8").matchAll(/export\s+(?:function|const)\s+(use[A-Z]\w*)/g)].map(m => m[1]))];
const wrapper = path.join(scratch, "api.ts");
fs.writeFileSync(wrapper, `export * from ${JSON.stringify(path.join(root, "lib/api-client-react/src/index.ts"))};
import {dispatchHook,dispatchTransport} from ${JSON.stringify(harness)};
${hooks.map(h => `export const ${h}=(...args)=>dispatchHook(${JSON.stringify(h)},args);`).join("\n")}
${["getE5Disponibilidad", "getE5Contexto", "getE5Cobro", "getE5DevolucionOpciones"].map(h => `export const ${h}=(...args)=>dispatchTransport(${JSON.stringify(h)},args);`).join("\n")}`);
for (const enabled of [false, true]) {
  await withBrowserFixture({
    viewport: { width: 1280, height: 900 },
    moduleAliases: { "@workspace/api-client-react": wrapper, "@/lib/e5-feature-flags": harness,
      "@/lib/location-scope": harness, "@/components/layout/app-layout": harness },
    tailwindSourceFiles: [path.join(app, "src/components/e5-pendientes.tsx")],
    entrySource: `
import React from "react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {Router} from "wouter";
import {E5Entry} from ${JSON.stringify(path.join(app, "src/components/e5-pendientes.tsx"))};
import {resetHarness,setGate} from ${JSON.stringify(harness)};
resetHarness();setGate(${enabled});
export default function Fixture(){return <QueryClientProvider client={new QueryClient()}><Router>
<main style={{padding:32}}><h1>Ensayo visual aislado — recepción dirigida</h1>
<p>Fixture sintético, sin sesión ni conexión a la aplicación. Puerta ${enabled ? "abierta" : "cerrada"}.</p>
<E5Entry clienteId={7} entrada="CLIENTE"/></main></Router></QueryClientProvider>}`,
  }, async browser => {
    await browser.waitFor("document.body?.innerText.includes('Ensayo visual aislado')");
    const rendered = await browser.evaluate<string>("document.body.innerText");
    assert.equal(rendered.includes("Recibir dirigido"), enabled);
    await browser.screenshot(path.join(root, `reports/trabajo-nocturno-20260925/tarea-1/fixture-${enabled ? "after" : "before"}.png`));
  });
}
console.log("E5_REAL_COMPONENT_SYNTHETIC_FIXTURE_BEFORE_AFTER_PASS; not authenticated browser flow");