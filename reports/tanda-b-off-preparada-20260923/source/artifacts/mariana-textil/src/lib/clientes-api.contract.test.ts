import assert from "node:assert/strict";
import test from "node:test";
import {
  carteraAuthPartition,
  carteraEffectiveScope,
  carteraScopeContractError,
  carteraScopeKey,
  carteraScopePath,
  carteraScopeQuery,
} from "./clientes-api";

test("cartera scope serializes global, single-site, and multi-site requests", () => {
  assert.deepEqual(carteraScopeQuery({}), {});
  assert.equal(carteraScopeKey({}), "global");
  assert.deepEqual(carteraScopeQuery({ ubicacionIds: [7] }), { ubicacionId: 7 });
  assert.equal(carteraScopeKey({ ubicacionIds: [7] }), "sitio:7");
  assert.deepEqual(carteraScopeQuery({ ubicacionIds: [7, 2] }), { ubicacionIds: "2,7" });
  assert.equal(carteraScopeKey({ ubicacionIds: [7, 2] }), "sitios:2,7");
});

test("cartera exports carry the resolved request scope", () => {
  assert.equal(carteraScopePath("/clientes/cartera.xlsx", {}), "/clientes/cartera.xlsx");
  assert.equal(carteraScopePath("/clientes/cartera.xlsx", { ubicacionId: 4 }), "/clientes/cartera.xlsx?ubicacionId=4");
  assert.equal(carteraScopePath("/clientes/cartera.pdf", { ubicacionIds: [4, 9] }), "/clientes/cartera.pdf?ubicacionIds=4%2C9");
});

test("auth partition prevents an expired session from reusing the previous identity cache", () => {
  const globalAdmin = { id: 8, rol: "ADMIN" as const, alcanceConsulta: "TODAS" as const, ubicacion: null };
  assert.notEqual(carteraAuthPartition(globalAdmin), carteraAuthPartition(undefined));
  assert.match(
    carteraScopeContractError(undefined, undefined, {}),
    /identidad actual/,
  );
});

test("same user id still partitions cartera when role or assigned scope changes", () => {
  const ownSite = { id: 8, rol: "CAJA" as const, alcanceConsulta: "PROPIA" as const, ubicacion: { id: 2 } };
  const movedSite = { id: 8, rol: "CAJA" as const, alcanceConsulta: "PROPIA" as const, ubicacion: { id: 7 } };
  const unrestricted = { id: 8, rol: "ADMIN" as const, alcanceConsulta: "TODAS" as const, ubicacion: null };
  assert.notEqual(carteraAuthPartition(ownSite), carteraAuthPartition(movedSite));
  assert.notEqual(carteraAuthPartition(ownSite), carteraAuthPartition(unrestricted));
});

test("cached global response is rejected for a newly restricted assigned-site user", () => {
  const globalResponse = {
    clientes: [],
    resumen: { totalClientes: 10, clientesConSaldo: 2, totalCartera: "100.00", totalVencido: "20.00" },
    alcance: {
      tipo: "GLOBAL",
      ubicaciones: [],
      generadoEn: "2026-01-01T00:00:00.000Z",
      saldoAFavorDisponible: true,
    },
  };
  const ownSite = { id: 8, rol: "CAJA" as const, alcanceConsulta: "PROPIA" as const, ubicacion: { id: 2 } };
  const error = carteraScopeContractError(globalResponse, ownSite, {});
  assert.match(error ?? "", /incompatible/);
  assert.match(error ?? "", /Sitios: 2/);
});

test("current assigned-site response is accepted only when metadata proves that scope", () => {
  const ownSite = { id: 8, rol: "CAJA" as const, alcanceConsulta: "PROPIA" as const, ubicacion: { id: 2 } };
  const response = {
    clientes: [],
    resumen: { totalClientes: 1, clientesConSaldo: 1, totalCartera: "10.00", totalVencido: "0.00" },
    alcance: {
      tipo: "SITIOS",
      ubicaciones: [{ id: 2, nombre: "Cruces" }],
      generadoEn: "2026-01-01T00:00:00.000Z",
      saldoAFavorDisponible: false,
    },
  };
  assert.equal(carteraScopeContractError(response, ownSite, {}), null);
});

test("CAJA remains restricted even when legacy alcanceConsulta is TODAS", () => {
  const cajaLegacy = { id: 9, rol: "CAJA" as const, alcanceConsulta: "TODAS" as const, ubicacion: { id: 4 } };
  assert.deepEqual(carteraEffectiveScope(cajaLegacy), { kind: "ASSIGNED", assignedId: 4 });
  const globalResponse = {
    clientes: [],
    resumen: { totalClientes: 1, clientesConSaldo: 1, totalCartera: "10.00", totalVencido: "0.00" },
    alcance: { tipo: "GLOBAL", ubicaciones: [], generadoEn: "2026-01-01T00:00:00.000Z", saldoAFavorDisponible: true },
  };
  assert.match(carteraScopeContractError(globalResponse, cajaLegacy, {}) ?? "", /Sitios: 4/);
});

test("CAJA without an assigned site fails closed, while ADMIN and SUPERVISOR stay unrestricted", () => {
  const cajaWithoutSite = { id: 9, rol: "CAJA" as const, alcanceConsulta: "TODAS" as const, ubicacion: null };
  const adminLegacy = { id: 1, rol: "ADMIN" as const, alcanceConsulta: "PROPIA" as const, ubicacion: null };
  const supervisorLegacy = { id: 2, rol: "SUPERVISOR" as const, alcanceConsulta: "PROPIA" as const, ubicacion: null };
  assert.equal(carteraEffectiveScope(cajaWithoutSite).kind, "INVALID");
  assert.deepEqual(carteraEffectiveScope(adminLegacy), { kind: "UNRESTRICTED" });
  assert.deepEqual(carteraEffectiveScope(supervisorLegacy), { kind: "UNRESTRICTED" });
});