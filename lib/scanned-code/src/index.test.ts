import assert from "node:assert/strict";
import test from "node:test";
import {
  advertenciaSkuEscaneado,
  interpretarCodigoEscaneado,
  normalizarSerieEscaneada,
} from "./index";

const cases = [
  ["TAF-BLA-1002874", "1002874", "TAF-BLA"],
  ["GABMET-BAS-1002874", "1002874", "GABMET-BAS"],
  ["1002874", "1002874", null],
  ["  TAF-BLA-1002874  ", "1002874", "TAF-BLA"],
  ["taf-bla-1002874", "1002874", "TAF-BLA"],
  ["gabardina azul", null, null],
  ["TAF-BLA", null, null],
  ["100287", null, null],
  ["", null, null],
] as const;

for (const [input, serie, sku] of cases) {
  test(`interpreta ${JSON.stringify(input)}`, () => {
    assert.deepEqual(interpretarCodigoEscaneado(input), {
      serie,
      sku,
      textoOriginal: input,
    });
  });
}

test("no acepta una serie embebida en una secuencia de ocho dígitos", () => {
  assert.equal(interpretarCodigoEscaneado("10002874").serie, null);
});

test("la advertencia de SKU informa sin alterar la serie", () => {
  const codigo = interpretarCodigoEscaneado("TAF-BLA-1002874");
  assert.equal(
    advertenciaSkuEscaneado(codigo, "GABMET-AZU"),
    "Esta etiqueta dice TAF-BLA, pero el rollo 1002874 corresponde a GABMET-AZU. Verifica la etiqueta.",
  );
  assert.equal(advertenciaSkuEscaneado(codigo, "TAF-BLA"), null);
});

test("los tres consumidores normalizan el payload impreso SKU-SERIE a la misma serie", () => {
  const payloadImpreso = "TAF-BLA-1002874";
  const codigoEntregado = interpretarCodigoEscaneado(payloadImpreso);
  const consumidores = {
    "salida normal": normalizarSerieEscaneada(codigoEntregado),
    POS: normalizarSerieEscaneada(codigoEntregado),
    "salida para venta": normalizarSerieEscaneada(codigoEntregado),
  };

  assert.deepEqual(consumidores, {
    "salida normal": "1002874",
    POS: "1002874",
    "salida para venta": "1002874",
  });
  assert.equal(normalizarSerieEscaneada(payloadImpreso), "1002874");
});
