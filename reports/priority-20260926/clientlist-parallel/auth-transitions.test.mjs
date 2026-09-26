import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const front = path.join(import.meta.dirname, "frozen-root/artifacts/mariana-textil");
const requireFront = createRequire(path.join(front, "package.json"));
const React = requireFront("react");
const { act } = React;
const { createRoot } = requireFront("react-dom/client");
const query = requireFront("@tanstack/react-query");
const rootRequire = createRequire(path.resolve("package.json"));
const jsdomPath = fs.readdirSync("node_modules/.pnpm").find(name => name.startsWith("jsdom@"));
const { JSDOM } = rootRequire(path.resolve("node_modules/.pnpm", jsdomPath, "node_modules/jsdom"));
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const primitive = tag => ({ children, ...props }) => React.createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) =>
  !["variant", "size", "asChild"].includes(key))), children);
const stubs = {
  "react": React, "react/jsx-runtime": requireFront("react/jsx-runtime"),
  "@tanstack/react-query": query,
  "wouter": { Link: primitive("a") },
  "@workspace/api-client-react": { getListClientesQueryKey: () => ["/api/clientes"] },
  "@/lib/internal-navigation": { useHistoryEntryState: (_key, initial) => React.useState(initial) },
  "@/lib/api-error": { getApiErrorMessage: error => error?.message },
  "@/components/ui/badge": { Badge: primitive("span") },
  "@/components/ui/button": { Button: primitive("button") },
  "@/components/ui/card": { Card: primitive("div"), CardContent: primitive("div") },
  "@/components/ui/input": { Input: primitive("input") },
  "@/components/ui/table": Object.fromEntries(Object.entries({
    Table: "table", TableBody: "tbody", TableCell: "td", TableHead: "th",
    TableHeader: "thead", TableRow: "tr",
  }).map(([key, tag]) => [key, primitive(tag)])),
  "@/components/purga-catalogo-button": { PurgaCatalogoButton: () => null },
  "lucide-react": new Proxy({}, { get: () => () => null }),
};
function compile(relative) {
  const source = fs.readFileSync(path.join(front, "src", relative), "utf8");
  const result = ts.transpileModule(source, {
    fileName: relative, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.deepEqual(result.diagnostics, []);
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${result.outputText}\n})`)(name => {
    assert.ok(name in stubs, `Unexpected dependency ${name}`);
    return stubs[name];
  }, module, module.exports);
  return module.exports;
}
const auth = compile("lib/client-directory-auth.ts");
const { ClientDirectory } = compile("components/client-directory.tsx");
const A = { id: 1, role: "ADMIN", scope: "TODAS", site: 7, financial: true, allowed: true };
const B = { id: 2, role: "CAJA", scope: "PROPIA", site: 9, financial: false, allowed: true };
const partition = user => user ? `auth:${user.id}:${user.role}:${user.scope}:${user.site}` : "auth:loading";
let lastPartition;
function Harness({ user, verifying, success = true, error = false }) {
  const authPartition = partition(user), canFinances = user?.financial ?? false;
  const denied = !user || error || !user.allowed;
  const requestPartition = auth.useDirectoryReadPartition({
    identity: JSON.stringify({ authPartition, canFinances, canViewDirectory: user?.allowed ?? false }),
    verifying, denied,
  });
  lastPartition = requestPartition;
  return React.createElement(ClientDirectory, {
    enabled: auth.directoryRowsVisible({
      active: true, userPresent: !!user, authSuccess: success, verifying, canView: user?.allowed ?? false,
    }),
    requestEnabled: !denied, requestPartition, canFinances, isAdmin: user?.role === "ADMIN", authPartition,
  });
}
const pause = async () => { await new Promise(resolve => setTimeout(resolve, 15)); };
function makeResponse(label, financial = true) {
  return { items: [{ id: 1, nombre: label, activo: true, telefono: null, rfc: null,
    ...(financial ? { saldoActual: "987654.32", limiteCredito: "999999.00", saldoAFavor: "12.00" } : {}),
    movementCount: financial ? 4 : null, lastActivity: null }], total: 1, page: 1, pageSize: 50 };
}

test("actual component + shared QueryClient: speculative results stay invisible until fresh matching authorization", async () => {
  const client = new query.QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const container = document.getElementById("root");
  const root = createRoot(container);
  const pending = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    assert.match(String(url), /^\/api\/clientes\/listado\?/);
    assert.equal(options.credentials, "include");
    const request = { resolve: payload => resolve({ ok: true, json: async () => payload }), options };
    pending.push(request);
    options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
  const render = async props => act(async () => {
    root.render(React.createElement(query.QueryClientProvider, { client }, React.createElement(Harness, props)));
    await pause();
  });
  const settle = async (index, label, financial) => act(async () => {
    pending[index].resolve(makeResponse(label, financial)); await pause(); await pause();
  });
  const noSensitive = () => {
    assert.doesNotMatch(container.textContent, /GLOBAL_SECRET|987,654|RESTRICTED_SECRET|OLD_SESSION/);
    assert.equal(container.querySelectorAll("[data-testid^='row-client-']").length, 0);
  };
  try {
    // Seed the old unpartitioned cache, as on global→restricted login without logout.
    client.setQueryData(["/api/clientes", "listado", JSON.stringify({ authPartition: partition(A), canFinances: true })], makeResponse("OLD_SESSION"));
    await render({ user: A, verifying: true });
    assert.equal(pending.length, 1, "starts before auth verification finishes");
    const firstPartition = lastPartition;
    await settle(0, "GLOBAL_SECRET", true);
    noSensitive();
    await render({ user: A, verifying: false });
    assert.equal(lastPartition, firstPartition, "matching fresh identity adopts speculative response");
    assert.match(container.textContent, /GLOBAL_SECRET/);
    assert.equal(pending.length, 1, "no second directory request on matching auth");

    // Session replacement with no logout: old cached identity during verification.
    await render({ user: A, verifying: true });
    assert.notEqual(lastPartition, firstPartition);
    noSensitive();
    const staleRequest = pending.length - 1;
    await render({ user: B, verifying: false });
    noSensitive();
    assert.equal(pending[staleRequest].options.signal.aborted, true);
    await settle(staleRequest, "GLOBAL_SECRET", true);
    noSensitive();
    await settle(pending.length - 1, "RESTRICTED_SECRET", false);
    assert.match(container.textContent, /RESTRICTED_SECRET/);
    assert.doesNotMatch(container.textContent, /GLOBAL_SECRET|987,654/);

    // Same UID: role, assignment, permission and scope changes each invalidate.
    for (const changed of [
      { ...B, role: "SUPERVISOR" },
      { ...B, site: 12 },
      { ...B, scope: "TODAS" },
      { ...B, financial: true },
    ]) {
      await render({ user: B, verifying: true });
      noSensitive();
      const previousPartition = lastPartition;
      await render({ user: changed, verifying: false });
      assert.notEqual(lastPartition, previousPartition);
      noSensitive();
    }

    // Current UID denied; cached user data can still exist after failed auth/me.
    const callsBeforeDenial = pending.length;
    await render({ user: B, verifying: false, success: false, error: true });
    noSensitive();
    await render({ user: { ...B, allowed: false }, verifying: false });
    noSensitive();
    assert.equal(pending.length, callsBeforeDenial);
    await render({ user: null, verifying: false, success: false });
    noSensitive();
    const loggedOutPartition = lastPartition;
    await render({ user: A, verifying: true });
    assert.notEqual(lastPartition, loggedOutPartition);
    noSensitive();
    await settle(pending.length - 1, "NEW_SESSION", true);
    noSensitive();
    await render({ user: A, verifying: false });
    assert.match(container.textContent, /NEW_SESSION/);
    assert.doesNotMatch(container.textContent, /OLD_SESSION|GLOBAL_SECRET|RESTRICTED_SECRET/);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    globalThis.fetch = originalFetch;
  }
});

test("fail-closed visibility truth table and verification generation model", () => {
  const allowed = { active: true, userPresent: true, authSuccess: true, verifying: false, canView: true };
  assert.equal(auth.directoryRowsVisible(allowed), true);
  for (const key of ["active", "userPresent", "authSuccess", "canView"]) {
    assert.equal(auth.directoryRowsVisible({ ...allowed, [key]: false }), false);
  }
  assert.equal(auth.directoryRowsVisible({ ...allowed, verifying: true }), false);
  const pending = { identity: "A", verifying: true, denied: false, generation: 3 };
  assert.equal(auth.advanceDirectoryReadGeneration(pending, pending), pending);
  const verified = auth.advanceDirectoryReadGeneration(pending, { ...pending, verifying: false });
  assert.equal(verified.generation, 3);
  assert.equal(auth.advanceDirectoryReadGeneration(verified, pending).generation, 4);
  assert.equal(auth.advanceDirectoryReadGeneration(pending, { ...pending, identity: "B" }).generation, 4);
  assert.equal(auth.advanceDirectoryReadGeneration(pending, { ...pending, denied: true }).generation, 4);
});