import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./movimientos.tsx", import.meta.url), "utf8");
const kardex = readFileSync(new URL("../../../api-server/src/lib/kardex.ts", import.meta.url), "utf8");

test("ticket links use the validated real ticket id, never list position", () => {
  assert.match(kardex, /ticketMap\.has\(Number\(reference\.id\)\)[\s\S]*ticketId: referencedTicketId/);
  assert.match(page, /canReadTicketAtLocation\(row\.ubicacionId\) && row\.ticketId != null[\s\S]*href=\{`\/tickets\/\$\{row\.ticketId\}\?returnTo=\$\{encodeURIComponent\(movimientosReturnUrl\)\}`\}/);
  assert.doesNotMatch(page, /\/tickets\/\$\{(?:index|i)\}/);
});

test("movement filters and pagination restore with SPA history entries", () => {
  for (const key of ["movimientos.search-input", "movimientos.page"]) {
    assert.ok(page.includes(`useHistoryEntryState("${key}"`));
  }
  assert.match(page, /useHistoryEntryState<\{[\s\S]*>\("movimientos\.filters"/);
  assert.match(page, /movimientosReturnUrl[\s\S]*tipos: filters\.tipos\.length[\s\S]*page: String\(page\)/);
});