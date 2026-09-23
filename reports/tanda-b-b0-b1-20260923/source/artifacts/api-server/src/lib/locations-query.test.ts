import assert from "node:assert/strict";
import test from "node:test";
import { resolveLocationsListDecision } from "./locations-query";

test("locations catalog is active-only by default for every role", () => {
  assert.deepEqual(resolveLocationsListDecision(undefined, "ADMIN"), {
    ok: true,
    includeInactive: false,
  });
  assert.deepEqual(resolveLocationsListDecision(undefined, "SUPERVISOR"), {
    ok: true,
    includeInactive: false,
  });
});

test("only ADMIN can explicitly request inactive locations", () => {
  assert.deepEqual(resolveLocationsListDecision("true", "ADMIN"), {
    ok: true,
    includeInactive: true,
  });
  assert.deepEqual(resolveLocationsListDecision("true", "SUPERVISOR"), {
    ok: false,
    status: 403,
    error: "Solo ADMIN puede consultar ubicaciones inactivas.",
  });
});

test("false remains active-only and does not broaden non-admin reads", () => {
  assert.deepEqual(resolveLocationsListDecision("false", "BODEGA"), {
    ok: true,
    includeInactive: false,
  });
});

test("invalid and repeated modes fail at the request boundary", () => {
  assert.equal(resolveLocationsListDecision("1", "ADMIN").ok, false);
  assert.equal(resolveLocationsListDecision(["true", "false"], "ADMIN").ok, false);
});