import assert from "node:assert/strict";
import test from "node:test";
import {
  coincideTextoExacto,
  ejecutarSiTextoCoincide,
} from "../lib/confirmacion-texto-exacto";

const flujosActivos = [
  ["desactivar usuario", "maria.operadora"],
  ["cambiar rol", "maria.operadora"],
  ["cancelar ticket cobrado", "T-000123"],
  ["ajuste de inventario mayor a 10 rollos", "AJUSTE"],
  ["borrar cliente", "Textiles del Centro"],
  ["desactivar sitio", "Bodega Norte"],
  ["salida a mostrador mayor a 5 rollos", "MOSTRADOR"],
] as const;

for (const [flujo, requerido] of flujosActivos) {
  test(`${flujo}: bloquea texto distinto y permite coincidencia literal`, () => {
    let llamadas = 0;
    assert.equal(coincideTextoExacto("", requerido), false);
    assert.equal(ejecutarSiTextoCoincide("", requerido, () => llamadas++), false);
    assert.equal(llamadas, 0);
    assert.equal(coincideTextoExacto(`${requerido} `, requerido), false);
    assert.equal(coincideTextoExacto(requerido.toLowerCase(), requerido), requerido === requerido.toLowerCase());
    assert.equal(coincideTextoExacto(requerido, requerido), true);
    assert.equal(ejecutarSiTextoCoincide(requerido, requerido, () => llamadas++), true);
    assert.equal(llamadas, 1);
  });
}