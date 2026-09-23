import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClienteNotaEstadoBadge } from "./cliente-nota-estado-badge";

test("Los cuatro estados reales renderizan icono y estado, nunca un importe en la insignia", () => {
  const states = ["PENDIENTE", "ABONO_PARCIAL", "PAGADA", "CON_RETRASO"] as const;
  const labels = states.map((estadoNota) => {
    const html = renderToStaticMarkup(createElement(ClienteNotaEstadoBadge, {
      estadoNota, saldoPendiente: "25000.00", id: 7,
    }));
    assert.match(html, /<svg/);
    assert.doesNotMatch(html, /25[,.]?000|Saldo pendiente/i);
    const text = html.replace(/<[^>]+>/g, "").trim();
    assert.ok(text.length > 0);
    return text;
  });
  assert.equal(new Set(labels).size, 4);
});