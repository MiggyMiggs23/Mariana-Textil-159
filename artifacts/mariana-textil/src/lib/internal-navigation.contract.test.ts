import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appHref,
  hasSafeInternalPreviousEntry,
  stateForNewEntry,
} from "./internal-navigation";

const tracked = (sessionId: string, depth: number) => ({
  __marianaInternalNavigation: {
    sessionId,
    entryId: `entry-${depth}`,
    depth,
    scrollX: 0,
    scrollY: 320,
  },
});

test("back is allowed only when this app session created a previous entry", () => {
  assert.equal(hasSafeInternalPreviousEntry(tracked("current", 2), "current"), true);
  assert.equal(hasSafeInternalPreviousEntry(tracked("current", 0), "current"), false);
  assert.equal(hasSafeInternalPreviousEntry(tracked("older", 3), "current"), false);
  assert.equal(hasSafeInternalPreviousEntry(null, "current"), false);
});

test("a reload-like new session cannot leave the application through back", () => {
  const statePreservedByReload = tracked("session-before-reload", 4);
  assert.equal(
    hasSafeInternalPreviousEntry(statePreservedByReload, "session-after-reload"),
    false,
  );
});

test("app hrefs retain the configured base path", () => {
  assert.equal(appHref("/tickets/9427", "/mariana-textil/"), "/mariana-textil/tickets/9427");
  assert.equal(appHref("productos", "/"), "/productos");
});

test("new entries inherit the latest global session state", () => {
  const next = stateForNewEntry(
    { __marianaPageState: { "products.search": "AZUL" } },
    {
      __marianaPageState: {
        "global.selected-location": 1,
        "products.search": "ANTERIOR",
      },
    },
    new Map([["global.selected-location", 2]]),
  ) as {
    __marianaPageState: Record<string, unknown>;
  };

  assert.deepEqual(next.__marianaPageState, {
    "global.selected-location": 2,
    "products.search": "AZUL",
  });
});

test("all requested detail pages use the shared back link and fixed fallback", () => {
  const cases = [
    ["ticket-detail.tsx", "returnPath"],
    ["rollo-detail.tsx", 'fallbackHref="/inventario"'],
    ["producto-detail.tsx", 'fallbackHref="/productos"'],
    ["proveedor-detail.tsx", 'fallbackHref="/proveedores"'],
    ["salida-detail.tsx", 'fallbackHref="/salidas"'],
    ["cliente-detail.tsx", 'fallbackHref="/clientes"'],
  ] as const;

  for (const [file, fallback] of cases) {
    const source = readFileSync(new URL(`../pages/${file}`, import.meta.url), "utf8");
    assert.match(source, /<AppBackLink\b/);
    assert.ok(
      source.includes(fallback),
      `${file} debe conservar su fallback fijo`,
    );
  }
});

test("ticket auto-print keeps tracked state and uses a base-aware URL", () => {
  const source = readFileSync(
    new URL("../pages/ticket-detail.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /history\.replaceState\(\s*window\.history\.state,/);
  assert.match(source, /appHref\(`\/tickets\/\$\{ticket\.id\}`\)/);
  assert.doesNotMatch(source, /history\.replaceState\(\{\},/);
});