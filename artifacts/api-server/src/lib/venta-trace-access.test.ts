import assert from "node:assert/strict";
import test from "node:test";
import { canDeliverVenta, canReadLinkedVentaTrace } from "./venta-trace-access";

test("relation-scoped trace access covers receiving and origin staff only", () => {
  assert.equal(canReadLinkedVentaTrace({ rol: "TERMINAL", ubicacionId: 1, puedeVerSalidas: false, puedeVerSalidasVenta: true, linkedOrigins: [2] }), true, "Mariana receiving");
  assert.equal(canReadLinkedVentaTrace({ rol: "ALMACEN", ubicacionId: 2, puedeVerSalidas: true, puedeVerSalidasVenta: false, linkedOrigins: [2] }), true, "origin staff");
  assert.equal(canReadLinkedVentaTrace({ rol: "ALMACEN", ubicacionId: 3, puedeVerSalidas: true, puedeVerSalidasVenta: false, linkedOrigins: [2] }), false, "unrelated origin");
  assert.equal(canReadLinkedVentaTrace({ rol: "TERMINAL", ubicacionId: 1, puedeVerSalidas: false, puedeVerSalidasVenta: true, linkedOrigins: [] }), false, "ordinary unrelated record");
});

test("delivery allows origin view baseline and admin without cross-origin access", () => {
  assert.equal(canDeliverVenta({ rol: "BODEGA", assignedLocationId: 2, originId: 2, puedeVerSalidas: true, puedeEditarSalidas: false }), true);
  assert.equal(canDeliverVenta({ rol: "BODEGA", assignedLocationId: 3, originId: 2, puedeVerSalidas: true, puedeEditarSalidas: false }), false);
  assert.equal(canDeliverVenta({ rol: "BODEGA", assignedLocationId: 2, originId: 2, puedeVerSalidas: false, puedeEditarSalidas: false }), false);
  assert.equal(canDeliverVenta({ rol: "ADMIN", assignedLocationId: null, originId: 2, puedeVerSalidas: false, puedeEditarSalidas: false }), true);
});