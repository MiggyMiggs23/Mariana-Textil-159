import assert from "node:assert/strict";
import test from "node:test";

import { GetAdminAlertasResponse } from "@workspace/api-zod";

import { formatDateOnlyMx } from "./date-only";

process.env.TZ = "America/Mexico_City";

test("date-only calendar boundaries keep their persisted day in Mexico", () => {
  const calendarStart = "2026-01-01";
  const calendarToday = "2026-10-02";
  const calendarEnd = "2026-12-31";
  assert.equal(formatDateOnlyMx(calendarStart), "01/01/2026");
  assert.equal(formatDateOnlyMx(calendarToday), "02/10/2026");
  assert.equal(formatDateOnlyMx(calendarEnd), "31/12/2026");
});

test("generated calendar wire value stays a string for date-only consumers", () => {
  const persistedDate = "2026-10-02";
  const parsed = GetAdminAlertasResponse.parse({
    generatedAt: "2026-10-02T12:00:00.000Z",
    total: 1,
    documentosPendientes: [],
    creditos: [{
      movimientoId: 1005,
      ticketId: 1005,
      clienteId: 1,
      nombreCliente: "Cliente de prueba",
      nota: null,
      ticketFolio: 1005,
      importe: "100.00",
      fechaVencimiento: persistedDate,
      estadoNota: "PENDIENTE",
      diasRestantes: 0,
    }],
    salidasEnTransito: [],
    ventasAutorizadasSinEntregar: [],
  });
  const wireDate = parsed.creditos[0].fechaVencimiento;

  assert.equal(typeof wireDate, "string");
  assert.equal(JSON.stringify(wireDate), `"${persistedDate}"`);
  assert.equal(wireDate.includes("T"), false);
  assert.equal(wireDate.includes("Z"), false);

  assert.equal(formatDateOnlyMx(wireDate), "02/10/2026");
});
