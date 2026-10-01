import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "../..");
const app = resolve(root, "artifacts/mariana-textil/src");
const original = resolve(import.meta.dirname, "original");
const read = (base, file) => readFileSync(resolve(base, file), "utf8");
const roles = ["ADMIN", "TERMINAL", "CAJA", "SUPERVISOR", "BODEGA", "SISTEMAS", "CONTADOR"];
const Role = Object.fromEntries(roles.map(role => [role, role]));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const icons = new Proxy({}, { get: (_, name) => name });

// Execute the captured and candidate source, not a handwritten visibility oracle.
// No React runtime, server, network, build output, or application side effects.
function load(source, dependencies = {}, env = {}) {
  const result = ts.transpileModule(source.replaceAll("import.meta.env", "__env"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.deepEqual(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error), []);
  const exports = {};
  vm.runInNewContext(result.outputText, {
    exports, __env: env,
    require: name => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const permissions = load(read(original, "permisos.ts"), { "@/lib/e3-feature-flags": { E3_ENABLED: true } });
const user = (rol, permisos = []) => ({ rol, permisos, nombre: "Prueba" });
const permission = (modulo, bits) => ({
  modulo, puedeVer: !!(bits & 1), puedeCrear: !!(bits & 2),
  puedeEditar: !!(bits & 4), puedeAutorizar: !!(bits & 8),
});
const flat = groups => Array.from(groups).flatMap(g => Array.from(g.items));
const identity = item => JSON.stringify({
  name: item.name, path: item.path, icon: item.icon, module: item.module,
  anyModules: item.anyModules, allowedRoles: item.allowedRoles, isClickable: item.isClickable,
});
const multiset = groups => flat(groups).map(identity).sort();
function navigation(before, e7 = true, fondo = false) {
  return load(read(before ? original : app, before ? "app-navigation.ts" : "components/layout/app-navigation.ts"), {
    "lucide-react": icons, "@/lib/permisos": permissions,
    "@/lib/e7-feature-flags": { e7On: () => e7 },
  }, { VITE_FONDO_E10_ENABLED: String(fondo) });
}
const before = navigation(true), after = navigation(false);

test("captured originals match pre-patch hashes and active frozen sources; routes/permissions/E11 untouched", () => {
  const proof = JSON.parse(read(import.meta.dirname, "baseline-proof.json"));
  const paths = {
    "app-navigation.ts": "components/layout/app-navigation.ts",
    "app-layout.tsx": "components/layout/app-layout.tsx",
    "App.tsx": "App.tsx", "permisos.ts": "lib/permisos.ts", "e11.tsx": "pages/e11.tsx",
  };
  for (const [name, path] of Object.entries(paths)) {
    const captured = read(original, name);
    assert.equal(createHash("sha256").update(captured).digest("hex"), proof.originalSha256[name]);
    assert.equal(captured, read(resolve(root, proof.activeFrozenRoot, "artifacts/mariana-textil/src"), path));
    if (!name.startsWith("app-")) assert.equal(read(app, path), captured, `${path} must not change`);
  }
});

test("only requested group/order changes; names/routes/icons/clickability/allowlists/anyModules identical", () => {
  assert.deepEqual(multiset(before.NAV_GROUPS), multiset(after.NAV_GROUPS));
  const expected = {
    DIRECTORIO: ["Clientes", "Proveedores", "Reportes", "Próximos Contenedores"],
    CONFIGURACIÓN: ["Sitios", "Usuarios", "Permisos", "Camionetas", "Choferes", "Equipos", "Bitácora"],
    "ADMINISTRACIÓN CONTABLE": ["Conciliación de Kardex"],
  };
  for (const [title, names] of Object.entries(expected)) {
    assert.deepEqual(Array.from(after.NAV_GROUPS.find(g => g.title === title).items, i => i.name), names);
  }
  for (const group of before.NAV_GROUPS.filter(g => !["DIRECTORIO", "CONFIGURACIÓN", undefined].includes(g.title))) {
    assert.equal(JSON.stringify(after.NAV_GROUPS.find(g => g.title === group.title)), JSON.stringify(group));
  }
});

test("all roles: exhaustive permission truth tables for every entry, all actions and missing grants, E7/Fondo combinations", () => {
  // Every existing item is role-only or depends on exactly its own module.
  // Exhausting each dependency projection proves the result for ANY global
  // permission vector (including its full visibility multiset by composition).
  assert.ok(flat(before.NAV_GROUPS).every(item => !item.anyModules));
  let cases = 0;
  for (const e7 of [false, true]) for (const fondo of [false, true]) {
    const oldNav = navigation(true, e7, fondo), newNav = navigation(false, e7, fondo);
    for (const rol of roles) for (const item of flat(oldNav.NAV_GROUPS)) {
      for (let bits = -1; bits < 16; bits++) {
        const current = user(rol, bits < 0 ? [] : [permission(item.module, bits)]);
        assert.deepEqual(multiset(newNav.getVisibleNavGroups(current)), multiset(oldNav.getVisibleNavGroups(current)),
          `${rol}/${item.name}/${bits}/E7=${e7}/Fondo=${fondo}`);
        cases++;
      }
    }
  }
  assert.ok(cases > 14000);
});

test("all roles: exhaustive simultaneous read-grant combinations across the three affected groups", () => {
  const modules = [...new Set(flat(after.NAV_GROUPS.filter(g =>
    ["DIRECTORIO", "CONFIGURACIÓN", "ADMINISTRACIÓN CONTABLE"].includes(g.title))).map(i => i.module))];
  assert.equal(modules.length, 12);
  for (const rol of roles) for (let bits = 0; bits < 2 ** modules.length; bits++) {
    const current = user(rol, modules.map((module, index) => permission(module, (bits >> index) & 1)));
    assert.deepEqual(multiset(after.getVisibleNavGroups(current)), multiset(before.getVisibleNavGroups(current)),
      `${rol}/${bits}`);
  }
});

function e11Links(state) {
  const source = read(original, "e11.tsx");
  const ast = ts.createSourceFile("e11.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const selected = ast.statements.filter(node =>
    (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ["can", "fiscal", "admin"].includes(d.name.getText(ast)))) ||
    (ts.isFunctionDeclaration(node) && node.name?.text === "useE11AdminNavLinks"));
  const code = selected.map(n => n.getText(ast)).join("\n");
  return load(`import { useE11Session, e11On, E11_RECONCILIATION_ENABLED } from "fixture";\n${code}`, {
    fixture: { useE11Session: () => state.session, e11On: () => state.enabled, E11_RECONCILIATION_ENABLED: state.reconciliation },
  }).useE11AdminNavLinks();
}

function layout(before, current, links) {
  const source = read(before ? original : app, before ? "app-layout.tsx" : "components/layout/app-layout.tsx");
  const hook = () => ({});
  const api = new Proxy({ Role, useGetCurrentUser: () => ({ data: current }) }, { get: (obj, key) => obj[key] ?? hook });
  const deps = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useEffect: hook, useState: initial => [initial, hook] },
    wouter: { Link: "Link", useLocation: () => ["/", hook] },
    "@workspace/api-client-react": api,
    "@/lib/permisos": permissions,
    "@tanstack/react-query": { useQuery: hook, useQueryClient: hook },
    "lucide-react": icons,
    "@/lib/utils": { cn: (...parts) => parts.filter(Boolean).join(" ") },
    "@/lib/location-scope": { useLocationScope: hook },
    "@/lib/etiquetas-api": { etiquetasApi: { alertas: hook } },
    "@/components/layout/app-navigation": before ? navigation(true) : after,
    "@/lib/home-route": { getHomeRoute: () => "/" },
    "@/pages/e11": { E11Navigation: "E11Navigation", useE11AdminNavLinks: () => links },
  };
  for (const path of ["ui/button", "ui/select", "brand-logo", "ui/dialog", "notifications-bell", "test-system-reset"]) {
    deps[`@/components/${path}`] = icons;
  }
  return load(source, deps).AppLayout;
}
function collect(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => collect(child, predicate));
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)];
}
const navLinks = tree => collect(tree, n => n.type === "Link" && n.props["data-testid"]?.startsWith("nav-item-"));
const linkMultiset = tree => navLinks(tree).map(n => JSON.stringify({
  href: n.props.href, testId: n.props["data-testid"],
  label: collect(n.props.children, c => c.type === "span").map(s => s.props.children),
})).sort();

test("rendered sidebar multiset and test IDs preserved for all E11 link subsets and roles; Kardex independent", () => {
  const possible = [
    { name: "Conciliaciones documentales", path: "/contabilidad/conciliaciones" },
    { name: "Administrar perfiles A/F", path: "/usuarios" },
  ];
  for (const rol of roles) for (const granted of [false, true]) for (let bits = 0; bits < 4; bits++) {
    const links = possible.filter((_, i) => bits & (1 << i));
    const current = user(rol, Object.values(permissions.Modules).map(m => permission(m, granted ? 15 : 0)));
    const oldTree = layout(true, current, links)({ children: null });
    const newTree = layout(false, current, links)({ children: null });
    assert.deepEqual(linkMultiset(newTree), linkMultiset(oldTree), `${rol}/${granted}/E11 links=${bits}`);
    const accounting = collect(newTree, n => n.props["data-testid"] === "nav-group-administracion-contable");
    const hasKardex = rol !== "CONTADOR" && (rol === "ADMIN" || granted);
    if (rol === "TERMINAL") { assert.equal(accounting.length, 0); continue; }
    assert.equal(accounting.length, links.length || hasKardex ? 1 : 0);
    if (accounting.length) assert.deepEqual(navLinks(accounting).map(n => n.props.href),
      [...links.map(l => l.path), ...(hasKardex ? ["/administracion/conciliacion"] : [])]);
  }
});

test("exhaustive actual E11 gates: role/profile/capability/session/frontend/backend flags preserve independent Kardex", () => {
  for (const rol of roles) for (const perfil of [null, "A", "F"]) for (let bits = 0; bits < 32; bits++) {
    const session = bits & 1 ? {
      identity: { rolBase: rol, perfil, capacidades: bits & 2 ? ["FISCAL_LEER"] : [] },
      flags: { conciliacion: !!(bits & 4) },
    } : null;
    const links = e11Links({ session, enabled: !!(bits & 8), reconciliation: !!(bits & 16) });
    const expectsAdmin = !!(bits & 1) && !!(bits & 8) && rol === "ADMIN" && perfil === null;
    const expectsFiscal = !!(bits & 1) && !!(bits & 8) && rol === "CONTADOR" && perfil === "F" && !!(bits & 2);
    assert.deepEqual(Array.from(links, l => l.path), [
      ...((expectsAdmin || expectsFiscal) && (bits & 4) && (bits & 16) ? ["/contabilidad/conciliaciones"] : []),
      ...(expectsAdmin ? ["/usuarios"] : []),
    ]);
    for (const granted of [false, true]) {
      const current = user(rol, [permission(permissions.Modules.CONCILIACION, granted ? 1 : 0)]);
      const oldItems = multiset(before.getVisibleNavGroups(current));
      const newItems = multiset(after.getVisibleNavGroups(current));
      // E11 hook remains byte-identical and all four possible link subsets were rendered above.
      assert.deepEqual([...newItems, ...Array.from(links, l => JSON.stringify(l))].sort(),
        [...oldItems, ...Array.from(links, l => JSON.stringify(l))].sort());
    }
  }
});

test("reset button, desktop/mobile shells and all layout code outside nav assembly remain byte-identical", () => {
  const oldSource = read(original, "app-layout.tsx"), newSource = read(app, "components/layout/app-layout.tsx");
  assert.equal(newSource.split("  const navGroups =")[0], oldSource.split("  const navGroups =")[0]);
  assert.equal(newSource.slice(newSource.indexOf("  return (\n    <div className=\"min-h-[100dvh] flex bg-background\">")),
    oldSource.slice(oldSource.indexOf("  return (\n    <div className=\"min-h-[100dvh] flex bg-background\">")));
  assert.equal((newSource.match(/user\.rol === Role\.ADMIN && <TestSystemResetButton \/>/g) ?? []).length, 2);
});