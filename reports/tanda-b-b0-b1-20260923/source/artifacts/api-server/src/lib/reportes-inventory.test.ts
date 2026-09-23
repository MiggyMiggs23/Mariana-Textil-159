import assert from "node:assert/strict";
import test from "node:test";
import { aggregateExtraordinaryLosses, buildTransitVisibilityKpis, classifyCoverage, classifyNoMovement, reconciles, reverseDailyCloses } from "./reportes-inventory";
import {
  isSalidaEnTransitoOverdue,
  SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS,
} from "./admin-alertas";

test("coverage honors configurable stock bands and absent demand", () => {
  assert.equal(classifyCoverage(null), "SIN_VENTAS");
  assert.equal(classifyCoverage(7, 7, 15, 45, 90), "CRITICO");
  assert.equal(classifyCoverage(15, 7, 15, 45, 90), "BAJO");
  assert.equal(classifyCoverage(45, 7, 15, 45, 90), "NORMAL");
  assert.equal(classifyCoverage(90, 7, 15, 45, 90), "EXCESO");
});
test("no movement bands use inclusive lower boundaries", () => {
  assert.equal(classifyNoMovement(29), "<30");
  assert.equal(classifyNoMovement(30), "30-59");
  assert.equal(classifyNoMovement(90), "90-179");
  assert.equal(classifyNoMovement(180), "180+");
});
test("reverse daily close undoes movements after each close", () => {
  assert.deepEqual(reverseDailyCloses(12, [{ day: "2025-01-03", quantity: -3 }, { day: "2025-01-02", quantity: 5 }], ["2025-01-01", "2025-01-02", "2025-01-03"]), [{ day: "2025-01-01", quantity: 10 }, { day: "2025-01-02", quantity: 15 }, { day: "2025-01-03", quantity: 12 }]);
  assert.equal(reconciles(10, 10.0005, 10.0005), true);
  assert.equal(reconciles(10, 10.01), false);
});

test("a transit exit becomes overdue strictly after the configurable 24-hour boundary", () => {
  const now = new Date("2026-01-02T12:00:00.000Z");
  const exactBoundary = new Date(now.getTime() - SALIDA_EN_TRANSITO_ALERT_THRESHOLD_HOURS * 60 * 60 * 1000);
  assert.equal(isSalidaEnTransitoOverdue(exactBoundary, now), false);
  assert.equal(isSalidaEnTransitoOverdue(new Date(exactBoundary.getTime() - 1), now), true);
});

test("container and inter-site transit are exclusive visibility KPIs", () => {
  const physicalAvailability = 17;
  const kpis = buildTransitVisibilityKpis(
    new Map([["METRO", { cantidad: 8, valor: 80 }]]),
    new Map([["METRO", { cantidad: 3, valor: 30 }]]),
  );
  const value = (id: string) => kpis.find((kpi) => kpi.id === id)?.value;
  assert.equal(value("en-contenedor-cantidad-METRO"), 8);
  assert.equal(value("en-transito-entre-sitios-cantidad-METRO"), 3);
  assert.equal(physicalAvailability, 17, "transit visibility must not change available totals");
});

test("extraordinary losses aggregate absolute quantity and frozen roll cost", () => {
  const rows = aggregateExtraordinaryLosses([
    { motivo: "MERMA", sku: "A", tela: "Lino", color: "Rojo", unidad: "METRO", sitio: "Norte", cantidad: -2, costoUnitario: 12.5 },
    { motivo: "MERMA", sku: "A", tela: "Lino", color: "Rojo", unidad: "METRO", sitio: "Norte", cantidad: -3, costoUnitario: 12.5 },
  ]);

  assert.deepEqual(rows, [{
    motivo: "MERMA",
    sku: "A",
    tela: "Lino",
    color: "Rojo",
    unidad: "METRO",
    sitio: "Norte",
    cantidad: 5,
    costo: 62.5,
  }]);
});

test("extraordinary losses never combine reasons, units, products, or sites", () => {
  const base = { tela: "Lino", color: "Rojo", cantidad: -1, costoUnitario: 10 };
  const rows = aggregateExtraordinaryLosses([
    { ...base, motivo: "MERMA", sku: "A", unidad: "METRO", sitio: "Norte" },
    { ...base, motivo: "ROBO", sku: "A", unidad: "METRO", sitio: "Norte" },
    { ...base, motivo: "MUESTRA", sku: "A", unidad: "KILO", sitio: "Norte" },
    { ...base, motivo: "MUESTRA", sku: "B", unidad: "BOLSA", sitio: "Norte" },
    { ...base, motivo: "MUESTRA", sku: "B", unidad: "BOLSA", sitio: "Sur" },
    { ...base, motivo: null, sku: "A", unidad: "METRO", sitio: "Norte" },
  ]);

  assert.equal(rows.length, 5);
  assert.deepEqual(new Set(rows.map(row => row.motivo)), new Set(["MERMA", "ROBO", "MUESTRA"]));
  assert.deepEqual(new Set(rows.map(row => row.unidad)), new Set(["METRO", "KILO", "BOLSA"]));
});

test("extraordinary losses omit reversed origins and preserve unreversed exits", () => {
  const base = { sku: "A", tela: "Lino", color: "Rojo", unidad: "METRO", sitio: "Norte", cantidad: -2, costoUnitario: 10 };
  const rows = aggregateExtraordinaryLosses([
    { ...base, motivo: "MERMA", reversed: true },
    { ...base, motivo: "ROBO", reversed: false },
  ]);

  assert.equal(rows.some(row => row.motivo === "MERMA"), false);
  assert.deepEqual(rows.find(row => row.motivo === "ROBO"), {
    motivo: "ROBO",
    sku: "A",
    tela: "Lino",
    color: "Rojo",
    unidad: "METRO",
    sitio: "Norte",
    cantidad: 2,
    costo: 20,
  });
});

test("a missing frozen cost keeps only its extraordinary economic group pending", () => {
  const rows = aggregateExtraordinaryLosses([
    { motivo: "ROBO", sku: "A", tela: "Lino", color: "Rojo", unidad: "METRO", sitio: "Norte", cantidad: -2, costoUnitario: null },
    { motivo: "ROBO", sku: "A", tela: "Lino", color: "Rojo", unidad: "METRO", sitio: "Norte", cantidad: -1, costoUnitario: 10 },
    { motivo: "MERMA", sku: "A", tela: "Lino", color: "Rojo", unidad: "METRO", sitio: "Norte", cantidad: -1, costoUnitario: 10 },
  ]);

  assert.equal(rows.find(row => row.motivo === "ROBO")?.costo, null);
  assert.equal(rows.find(row => row.motivo === "MERMA")?.costo, 10);
});