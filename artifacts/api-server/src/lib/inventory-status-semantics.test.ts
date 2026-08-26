import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

test("cache uses signed kardex quantity and only DISPONIBLE roll counts", () => {
  const inventory = source("./inventario.ts");
  const refresh = inventory.slice(
    inventory.indexOf("async function refreshCache"),
    inventory.indexOf("async function getSaldo"),
  );
  assert.match(refresh, /COALESCE\(SUM\(cantidad\), 0\)::text/);
  assert.match(refresh, /eq\(rollosTable\.estado, "DISPONIBLE"\)/);
  assert.doesNotMatch(refresh, /EN_TRANSITO|ABIERTO/);
});

test("full cache rebuild has one transaction and a three-source pair union", () => {
  const inventory = source("./inventario.ts");
  const rebuild = inventory.slice(
    inventory.indexOf("export async function reconstruirCacheExistencias"),
    inventory.indexOf("// ── Dashboard helper"),
  );
  assert.equal((rebuild.match(/db\.transaction/g) ?? []).length, 1);
  assert.match(rebuild, /FROM existencias[\s\S]*UNION[\s\S]*FROM movimientos[\s\S]*UNION[\s\S]*FROM rollos/);
  assert.match(rebuild, /SUM\(cantidad\)/);
  assert.match(rebuild, /WHERE estado = 'DISPONIBLE'/);
  assert.doesNotMatch(rebuild, /refreshCache\(/);
});

test("grouped inventory and dashboard physical-on-hand SQL are DISPONIBLE only", () => {
  const route = source("../routes/inventario.ts");
  const grouped = route.slice(
    route.indexOf('"/existencias/agrupadas"'),
    route.indexOf("type Child", route.indexOf('"/existencias/agrupadas"')),
  );
  assert.match(grouped, /resolveReadScope/);
  assert.match(grouped, /r\.estado = 'DISPONIBLE'/);
  assert.doesNotMatch(grouped, /ABIERTO|EN_TRANSITO/);
  assert.doesNotMatch(grouped, /cantidad_actual\s*>\s*0/);

  const inventory = source("./inventario.ts");
  const dashboard = inventory.slice(
    inventory.indexOf("export async function getInventarioPorUbicacion"),
    inventory.indexOf("// ── Pending-review count"),
  );
  assert.match(dashboard, /eq\(rollosTable\.estado, "DISPONIBLE"\)/);
  assert.doesNotMatch(dashboard, /ABIERTO|EN_TRANSITO/);
});

test("inventory report separates container KPIs from existence totals", () => {
  const report = source("./reportes-inventory.ts");
  assert.match(report, /r\.estado='DISPONIBLE'/);
  assert.match(report, /const containerScope = productScope\(ctx, "p", "r\.ubicacion_id"\)/);
  assert.match(report, /r\.estado='EN_TRANSITO' AND \$\{containerScope\.text\}/);
  assert.doesNotMatch(report, /JOIN contenedores c ON c\.entrada_id=en\.id/);
  assert.match(report, /label: `En contenedor cantidad \$\{unidad\}`/);
  assert.match(report, /label: `En contenedor valor \$\{unidad\}`[\s\S]*economic: true/);
  assert.match(report, /const containerKpis[\s\S]*return \{ kpis: \[\.\.\.Object\.entries\(totals\)[\s\S]*\.\.\.containerKpis\]/);
  assert.doesNotMatch(
    report.slice(report.indexOf("const totals ="), report.indexOf("const rollScope =")),
    /container|EN_TRANSITO/,
  );
  assert.match(report, /r\.estado='ABIERTO'[\s\S]*table\("rollos-abiertos"/);
});