import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
const front = path.join(import.meta.dirname, "frozen-root/artifacts/mariana-textil");
const requireFront = createRequire(path.join(front, "package.json"));
const React = requireFront("react"), { act } = React;
const { createRoot } = requireFront("react-dom/client");
const { QueryClient, QueryClientProvider, useQueryClient } = requireFront("@tanstack/react-query");
const jsdomName = fs.readdirSync("node_modules/.pnpm").find(name => name.startsWith("jsdom@"));
const { JSDOM } = createRequire(path.resolve("package.json"))(path.resolve("node_modules/.pnpm", jsdomName, "node_modules/jsdom"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document,
  sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage,
  Event: dom.window.Event, CustomEvent: dom.window.CustomEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const SessionContext = React.createContext(null);
const deps = {
  react: React,
  "@tanstack/react-query": { useQueryClient },
  "@/lib/e11-session": {
    useE11Session: () => React.useContext(SessionContext), e11On: () => true,
    e11Error: error => error?.message ?? "error",
  },
};
function compile(relative) {
  const sourceRoot = process.env.E11_WRITE_BASELINE === "1" && relative === "hooks/use-e11-write.ts"
    ? path.join(import.meta.dirname, "../clientlist-parallel/frozen-root/artifacts/mariana-textil") : front;
  const source = fs.readFileSync(path.join(sourceRoot, "src", relative), "utf8");
  const output = ts.transpileModule(source, {
    fileName: relative, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.deepEqual(output.diagnostics, []);
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output.outputText}\n})`)(name => {
    assert.ok(name in deps, `Unexpected dependency ${name}`);
    return deps[name];
  }, module, module.exports);
  return module.exports;
}
const recovery = compile("lib/e11-recovery.ts");
deps["@/lib/e11-recovery"] = recovery;
const { useE11Write } = compile("hooks/use-e11-write.ts");
const uuid = "11111111-1111-4111-8111-111111111111";
const otherUuid = "22222222-2222-4222-8222-222222222222";
const command = { uuid, revision: "original" }, operation = "decision:fixture";
const pause = () => new Promise(resolve => setTimeout(resolve, 10));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function fixture({ seedConfirmed = false, sendFailure = false } = {}) {
  localStorage.clear(); sessionStorage.clear();
  const identity = { usuarioId: 7, capacidades: ["FISCAL_DECIDIR"] };
  const session = {
    identity, key: JSON.stringify([7, "CONTADOR", "F", 1, 1]),
    check: async () => {
      checks++;
      if (revoked) throw new Error("PERFIL_CAMBIADO");
      return identity;
    },
  };
  const key = `e11-intencion:${encodeURIComponent(session.key)}:${operation}`;
  let revoked = false, checks = 0, sends = 0, hook;
  const refresh = deferred(), reachedRefresh = deferred();
  const client = new QueryClient();
  client.invalidateQueries = async (_filters, options) => {
    if (options?.throwOnError) {
      reachedRefresh.resolve();
      await refresh.promise;
    }
  };
  if (seedConfirmed) {
    sessionStorage.setItem(key, JSON.stringify({ scope: session.key, operation, command, confirmed: true }));
    recovery.e11MarkRecovery(uuid, operation, "CONFIRMED", identity.usuarioId);
  }
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container);
  function Probe() {
    hook = useE11Write(operation, "FISCAL_DECIDIR",
      async value => { sends++; if (sendFailure) throw new Error("uncertain network rejection"); return { uuid: value.uuid }; },
      async () => {},
      (response, value) => response.uuid === value.uuid);
    return React.createElement("div", { "data-blocked": hook.blocked }, hook.error);
  }
  const render = () => root.render(React.createElement(QueryClientProvider, { client },
    React.createElement(SessionContext.Provider, { value: session }, React.createElement(Probe))));
  await act(async () => { render(); await pause(); });
  let mounted = true;
  return {
    key, session, refresh, reachedRefresh, container,
    get hook() { return hook; }, get sends() { return sends; }, get checks() { return checks; },
    revoke() { revoked = true; },
    async unmount() { if (mounted) { await act(async () => root.unmount()); mounted = false; } },
    async dispose() { await this.unmount(); client.clear(); container.remove(); },
  };
}
async function start(f) {
  let run;
  await act(async () => {
    run = f.hook.run(command);
    await f.reachedRefresh.promise;
    await pause();
  });
  assert.equal(f.sends, 1);
  assert.equal(JSON.parse(sessionStorage.getItem(f.key)).confirmed, true);
  assert.equal(recovery.e11Recoveries()[0].state, "CONFIRMED");
  return { run };
}
async function finish(f, run, reject = false) {
  await act(async () => {
    reject ? f.refresh.reject(new Error("refresh rejected")) : f.refresh.resolve();
    await run; await pause();
  });
}

test("authoritative ACK + successful invalidation/check clears exact durable marker even after actual hook unmount", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    await f.unmount();
    await finish(f, run);
    assert.equal(f.checks, 4, "fresh guard before verify/send, after response and after refresh");
    assert.equal(sessionStorage.getItem(f.key), null);
    assert.deepEqual(recovery.e11Recoveries(), []);
    assert.equal(f.sends, 1);
  } finally { await f.dispose(); }
});

test("mounted success clears only acknowledged durable state, without resend", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    await finish(f, run);
    assert.equal(sessionStorage.getItem(f.key), null);
    assert.deepEqual(recovery.e11Recoveries(), []);
    assert.equal(f.hook.pending, null);
    assert.equal(f.sends, 1);
  } finally { await f.dispose(); }
});

test("refresh rejection after unmount retains confirmed marker and payload", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    await f.unmount();
    await finish(f, run, true);
    assert.equal(JSON.parse(sessionStorage.getItem(f.key)).confirmed, true);
    assert.equal(recovery.e11Recoveries()[0].state, "CONFIRMED");
    assert.equal(f.checks, 3, "no successful post-refresh guard on rejection");
  } finally { await f.dispose(); }
});

test("uncertain failed send never erases recovery evidence", async () => {
  const f = await fixture({ sendFailure: true });
  try {
    await act(async () => { await f.hook.run(command); await pause(); });
    assert.equal(f.sends, 1);
    assert.equal(recovery.e11Recoveries()[0].state, "RESULTADO_INCIERTO");
    assert.equal(JSON.parse(sessionStorage.getItem(f.key)).command.uuid, uuid);
    assert.notEqual(JSON.parse(sessionStorage.getItem(f.key)).confirmed, true);
  } finally { await f.dispose(); }
});

test("newer intention in same namespace is never erased by older ACK settlement", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    await f.unmount();
    const newer = JSON.stringify({ scope: f.session.key, operation, command: { uuid: otherUuid, revision: "new" } });
    sessionStorage.setItem(f.key, newer);
    recovery.e11MarkRecovery(otherUuid, operation, "RESULTADO_INCIERTO", 7);
    await finish(f, run);
    assert.equal(sessionStorage.getItem(f.key), newer);
    assert.equal(recovery.e11Recoveries().length, 2);
    assert.ok(recovery.e11Recoveries().some(r => r.uuidOriginal === uuid && r.state === "CONFIRMED"));
  } finally { await f.dispose(); }
});

test("logout/session revocation after ACK fails final guard and retains quarantined recovery", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    await f.unmount();
    f.revoke();
    recovery.e11Quarantine(sessionStorage, f.key);
    await finish(f, run);
    assert.equal(sessionStorage.getItem(f.key), null, "provider-style quarantine already removed private payload");
    assert.equal(recovery.e11Recoveries()[0].state, "RESULTADO_CONFIRMADO_NO_CONSULTABLE");
    assert.equal(f.checks, 4);
  } finally { await f.dispose(); }
});

test("session guard failure alone retains exact confirmed payload and marker", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    const before = sessionStorage.getItem(f.key);
    await f.unmount();
    f.revoke();
    await finish(f, run);
    assert.equal(sessionStorage.getItem(f.key), before);
    assert.equal(recovery.e11Recoveries()[0].state, "CONFIRMED");
  } finally { await f.dispose(); }
});

test("same UUID with replacement payload is not mistaken for the acknowledged command", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    await f.unmount();
    const replacement = JSON.stringify({ scope: f.session.key, operation, command: { uuid, revision: "replacement" }, confirmed: true });
    sessionStorage.setItem(f.key, replacement);
    await finish(f, run);
    assert.equal(sessionStorage.getItem(f.key), replacement);
    assert.equal(recovery.e11Recoveries()[0].state, "CONFIRMED");
  } finally { await f.dispose(); }
});

test("even if session check succeeds, changed recovery state is never erased", async () => {
  const f = await fixture();
  try {
    const { run } = await start(f);
    await f.unmount();
    recovery.e11MarkRecovery(uuid, operation, "QUARANTINE", 7);
    await finish(f, run);
    assert.equal(recovery.e11Recoveries()[0].state, "QUARANTINE");
    assert.equal(JSON.parse(sessionStorage.getItem(f.key)).confirmed, true);
  } finally { await f.dispose(); }
});

test("pre-existing cached CONFIRMED marker is not trusted for automatic cleanup or resend", async () => {
  const f = await fixture({ seedConfirmed: true });
  try {
    await act(async () => { await f.hook.run(command); await pause(); });
    assert.equal(f.hook.blocked, true);
    assert.equal(f.sends, 0);
    assert.equal(f.checks, 0);
    assert.equal(recovery.e11Recoveries()[0].state, "CONFIRMED");
    assert.equal(JSON.parse(sessionStorage.getItem(f.key)).confirmed, true);
  } finally { await f.dispose(); }
});