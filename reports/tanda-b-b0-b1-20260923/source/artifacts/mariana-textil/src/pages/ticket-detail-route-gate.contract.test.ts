import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("salidas viewers can mount linked ticket trace without widening role access", async () => {
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const routeStart = app.indexOf('path="/tickets/:id"');
  const ticketRoute = routeStart >= 0 ? app.slice(routeStart, routeStart + 500) : "";

  assert.ok(routeStart >= 0, "ticket detail route must exist");
  assert.match(
    ticketRoute,
    /allowedAnyModules=\{\[Modules\.COBROS_PAGOS, Modules\.POS, Modules\.SALIDAS\]\}/,
  );
  assert.match(
    ticketRoute,
    /allowedRoles=\{\["ADMIN", "CONTADOR", "SISTEMAS"\]\}/,
  );
  assert.match(
    app,
    /allowedAnyModules\.some\(\(module\) => hasPermission\(user, module, allowedAction\)\)/,
  );
});

test("ticket mutation controls do not inherit salidas view permission", async () => {
  const detail = await readFile(new URL("./ticket-detail.tsx", import.meta.url), "utf8");

  assert.match(
    detail,
    /const canCancel =\s*user\?\.rol === Role\.ADMIN \|\|\s*\(user != null && hasPermission\(user, Modules\.POS, "crear"\)\)/,
  );
  assert.match(
    detail,
    /\{canCancel && ticket\.estado !== EstadoTicket\.CANCELADO && \(/,
  );
  assert.doesNotMatch(detail, /hasPermission\(user, Modules\.SALIDAS, "(?:crear|editar|autorizar)"\)/);
});