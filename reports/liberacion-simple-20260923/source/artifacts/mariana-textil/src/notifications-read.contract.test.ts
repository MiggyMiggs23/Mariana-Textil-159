import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bell = readFileSync(new URL("./components/notifications-bell.tsx", import.meta.url), "utf8");

test("each user can mark their visible stored notifications read from the panel", () => {
  assert.match(bell, /Marcar guardadas como leídas/);
  assert.match(bell, /storedUnreadCount === 0/);
  assert.match(bell, /useListNotificaciones/);
  assert.doesNotMatch(bell, /enabled: isAdmin/);
  assert.match(bell, /useMarkNotificacionRead/);
  assert.match(bell, /getGetNotificationFeedQueryKey/);
  assert.match(bell, /getCountNotificacionesNoLeidasQueryKey/);
  assert.match(bell, /getListNotificacionesQueryKey/);
  assert.doesNotMatch(bell, />\s*Limpiar\s*</);
});

test("stored and derived events are visibly explained", () => {
  assert.match(bell, /Notificación guardada · se marca como leída/);
  assert.match(bell, /Evento derivado · se resuelve al atender la condición/);
  assert.match(bell, /Los eventos derivados\s+desaparecen cuando se atiende la condición/);
});

test("notification popover remains bounded on phones", () => {
  assert.match(bell, /w-\[min\(92vw,420px\)\]/);
  assert.match(bell, /ScrollArea className="h-\[380px\]"/);
});