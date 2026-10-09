import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentUser } from "@workspace/api-client-react";
import { getVisibleNavGroups, withConfigurationLinks } from "./layout/app-navigation";

const admin = { rol: "ADMIN" } as CurrentUser;
const documents = { name: "Conciliaciones documentales", path: "/contabilidad/conciliaciones" };
const profiles = { name: "Administrar perfiles A/F", path: "/usuarios" };
test("configuration contains ten destinations in order, including both distinct /usuarios links", () => {
  const groups = withConfigurationLinks(getVisibleNavGroups(admin), [documents, profiles]);
  assert.ok(groups.every(g => g.title !== "ADMINISTRACIÓN CONTABLE"));
  const items = groups.find(g => g.title === "CONFIGURACIÓN")!.items;
  assert.deepEqual(items.map(i => i.name), [
    "Sitios", "Usuarios", "Permisos", "Camionetas", "Choferes", "Equipos",
    "Conciliación de Kardex", "Conciliaciones documentales", "Administrar perfiles A/F", "Bitácora",
  ]);
  assert.equal(items.filter(i => i.path === "/usuarios").length, 2);
  assert.equal(items.find(i => i.name === documents.name)?.testId, "nav-item--contabilidad-conciliaciones");
});
test("E11 remains an independent filtered input, not widened by configuration permissions", () => {
  const groups = getVisibleNavGroups(admin);
  assert.equal(withConfigurationLinks(groups, []), groups);
  const names = withConfigurationLinks(groups, [profiles]).flatMap(g => g.items.map(i => i.name));
  assert.ok(!names.includes(documents.name));
  assert.ok(names.includes(profiles.name));
});
test("E11-only access still creates configuration; no authorized links means no group", () => {
  assert.deepEqual(withConfigurationLinks([], []), []);
  const result = withConfigurationLinks([], [documents]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "CONFIGURACIÓN");
  assert.deepEqual(result[0].items.map(i => i.name), [documents.name]);
});
test("CONTADOR does not gain Kardex or administrative configuration entries", () => {
  const user = { rol: "CONTADOR", permisos: [] } as unknown as CurrentUser;
  const result = withConfigurationLinks(getVisibleNavGroups(user), [documents]);
  assert.deepEqual(result.find(g => g.title === "CONFIGURACIÓN")?.items.map(i => i.name), [documents.name]);
});
