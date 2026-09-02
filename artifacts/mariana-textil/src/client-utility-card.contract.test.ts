import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./pages/cliente-detail.tsx", import.meta.url), "utf8");
const clientApi = readFileSync(new URL("./lib/clientes-api.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../../api-server/src/routes/clientes.ts", import.meta.url), "utf8");

test("client utility starts visually hidden and exposes a touch-friendly toggle", () => {
  assert.match(page, /useState\(false\)/);
  assert.match(page, /Utilidad acumulada/);
  assert.match(page, /className="h-11 w-11"/);
  assert.match(page, /aria-label=\{utilityVisible \? "Ocultar utilidad acumulada" : "Mostrar utilidad acumulada"\}/);
  assert.match(page, /<span aria-label="Utilidad oculta">••••••<\/span>/);
  assert.doesNotMatch(page, /localStorage.*utilityVisible|sessionStorage.*utilityVisible/);
});

test("client utility is server-gated and declares every excluded no-cost line", () => {
  assert.match(page, /enabled: canFinances/);
  assert.match(page, /canFinances && \(/);
  assert.match(page, /lineasExcluidasSinCosto \?\? 0/);
  assert.match(clientApi, /utilidadAcumulada\?: string/);
  assert.match(route, /requierePermiso\("clientes_finanzas", "ver"\)/);
  assert.match(route, /FILTER \(WHERE l\.costo_total_congelado IS NOT NULL\),0\)::text AS "utilidadAcumulada"/);
  assert.match(route, /lineasExcluidasSinCosto: summary\?\.lineasSinCosto \?\? 0/);
});