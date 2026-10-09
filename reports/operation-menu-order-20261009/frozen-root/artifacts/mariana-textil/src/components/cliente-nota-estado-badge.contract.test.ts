import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("nota state presentation is shared and keeps canonical backend states", async () => {
  const source = await readFile(new URL("./cliente-nota-estado-badge.tsx", import.meta.url), "utf8");
  assert.match(source, /PENDIENTE.*ABONO_PARCIAL.*PAGADA.*CON_RETRASO/s);
  assert.match(source, /saldoPendiente/);
  assert.match(source, /CON_RETRASO/);
  assert.match(source, /overdue|retraso|vencid/i);
});

test("affected credit views use the shared state badge", async () => {
  const [detail, cobros, note, alerts, notifications] = await Promise.all([
    readFile(new URL("../pages/cliente-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/cobros.tsx", import.meta.url), "utf8"),
    readFile(new URL("./cliente-nota-credito.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/alertas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../pages/notificaciones.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(detail, /ClienteNotaEstadoBadge/);
  assert.match(cobros, /ClienteNotaEstadoBadge/);
  assert.match(note, /ClienteNotaEstadoBadge/);
  assert.match(alerts, /ClienteNotaEstadoBadge/);
  assert.match(notifications, /ClienteNotaEstadoBadge/);
});