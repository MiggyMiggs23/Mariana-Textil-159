import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("pagos dirigidos publishes queue and review contract", () => {
  const root = resolve(import.meta.dirname, "../../..");
  const spec = readFileSync(resolve(root, "lib/api-spec/openapi.yaml"), "utf8");
  const route = readFileSync(resolve(root, "artifacts/api-server/src/routes/pagos-dirigidos.ts"), "utf8");
  assert.ok(spec.includes("/pagos-dirigidos:"));
  assert.ok(spec.includes("/pagos-dirigidos/{id}/aprobar:"));
  assert.ok(spec.includes("MotivoRechazoPagoDirigidoInput"));
  assert.ok(spec.includes("SolicitudesPagoDirigidoResult"));
  assert.ok(route.includes("ListSolicitudesPagoDirigidoResponse"));
  assert.ok(route.includes("RechazarSolicitudPagoDirigidoBody"));
  assert.ok(route.includes("pg_advisory_xact_lock"));
  assert.ok(route.includes("DIRECTED_AMOUNT_EXCEEDS_DOCUMENT"));
});