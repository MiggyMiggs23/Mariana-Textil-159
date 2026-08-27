import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("Cartera functionality respects block 2 constraints", async () => {
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");
  const ticketDetail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");

  // 1. QR points to /cobros?tab=cartera&ticketId=<id>
  assert.match(ticketDetail, /\/cobros\?tab=cartera&ticketId=\$\{ticket.id\}/);

  // 2. Scan parsing handles URL and folio
  assert.match(cobros, /url\.pathname\.startsWith\("\/tickets\/"\)/);
  assert.match(cobros, /url\.searchParams\.get\("ticketId"\)/);
  assert.match(cobros, /test\(value\)/);
  assert.match(cobros, /setSearchFolio\(parseInt/);

  // 3. Order is oldest to newest
  assert.match(cobros, /sort\(\(a, b\) => new Date\(a\.fecha!\)\.getTime\(\) - new Date\(b\.fecha!\)\.getTime\(\)\)/);

  // 4. Highlight without isolating
  assert.match(cobros, /const isHighlighted = nota\.ticketFolio === ticket\.folio;/);
  assert.match(cobros, /bg-primary\/10 border-primary\/20/);
  assert.doesNotMatch(cobros, /filter.*nota\.ticketFolio === ticket\.folio/);

  // 5. Absence of 'marcar pagada'
  assert.doesNotMatch(cobros, /marcar pagada/i);
  assert.doesNotMatch(cobros, /mark as paid/i);

  // 6. Payment is not directed to a note
  assert.match(cobros, /ticketId:\s*null/);
  
  // 7. Filtering for VENTA_CREDITO with pending balance
  assert.match(cobros, /m\.tipo === "VENTA_CREDITO" && m\.estado !== "PAGADA"/);
  
  // 8. Checking for specific implementation details added
  // Parse date properly to avoid YYYY-MM-DD UTC shift
  assert.match(cobros, /T12:00:00/);
  
  // Checking for stable key without Math.random()
  assert.doesNotMatch(cobros, /Math\.random\(\)/);
  
  // Checking for the label ESCANEADA
  assert.match(cobros, /ESCANEADA/);
  assert.doesNotMatch(cobros, />\s*ESCANEA\s*</);

  // Checking that explicit type is used instead of any
  assert.match(cobros, /const defaultTab: "operativa" | "historial" | "cartera" =/);
  assert.doesNotMatch(cobros, /defaultTab as any/);
  
  // Checking that saldoPendiente is rendered
  assert.match(cobros, /nota\.saldoPendiente/);
});
