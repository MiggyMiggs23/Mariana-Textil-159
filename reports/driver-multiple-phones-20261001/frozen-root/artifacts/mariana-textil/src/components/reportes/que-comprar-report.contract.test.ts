import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const report = await readFile(new URL("./que-comprar-report.tsx", import.meta.url), "utf8");

test("Qué comprar consume los campos canónicos del reporte", () => {
  assert.match(report, /const value = row\.sugerencia/);
  assert.match(report, /const notMoved = row\.noMovimiento === true/);
  assert.match(report, /const underMinimum = row\.bajoMinimo === true/);
  assert.match(report, /row\.deficitMinimoObservado/);
  assert.doesNotMatch(report, /"sinMovimiento"|"noSeHaMovido"|"suggestion"|"recomendacion"/);
});

test("la tabla y la evidencia se pueden usar en pantallas estrechas", () => {
  assert.match(report, /aria-label="Renglones de qué comprar;/);
  assert.match(report, /aria-label="Movimientos de evidencia;/);
  assert.match(report, /ariaLabel="Episodios bajo mínimo del periodo;/);
  assert.match(report, /max-h-\[90vh\][\s\S]*max-h-\[90dvh\][\s\S]*w-\[calc\(100vw-2rem\)\]/);
  assert.match(report, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(report, /aria-label=\{`Ver evidencia de \$\{rowLabel\(row\)\}`\}/);
});

test("la evidencia separa episodios previos del conteo del periodo", () => {
  assert.match(report, /const carriedEpisodes = Array\.isArray\(evidence\.carriedEpisodes\)/);
  assert.match(report, /Episodios anteriores al periodo \(no incluidos en conteo\)/);
  assert.match(report, /Episodios bajo mínimo en el periodo/);
  assert.match(report, /event\.carriedIntoPeriod === true/);
  assert.match(report, /Eventos de episodios/);
  assert.match(report, /const eventEntries = Array\.isArray\(evidence\.eventos\) \? evidence\.eventos : \[\];/);
});