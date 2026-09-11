import assert from "node:assert/strict";
import test from "node:test";
import {
  advertenciaSkuEscaneado,
  despacharCodigoEscaneado,
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

test("el dispatcher normaliza el payload impreso SKU-SERIE a la misma serie", () => {
  const payloadImpreso = "TAF-BLA-1002874";
  const entregado = despacharCodigoEscaneado(payloadImpreso, "serie");

  assert.equal(entregado.valor, "1002874");
  assert.deepEqual(entregado.codigo, interpretarCodigoEscaneado(payloadImpreso));
  assert.equal(normalizarSerieEscaneada(payloadImpreso), "1002874");
});

test("normaliza el mismo QR SKU-SERIE sin importar mayúsculas o espacios", () => {
  const payloads = [
    "TAF-BLA-1002874",
    "taf-bla-1002874",
    "  taf-bla-1002874  ",
    "\ttaf-bla-1002874\n",
  ];

  for (const payload of payloads) {
    assert.equal(normalizarSerieEscaneada(payload), "1002874");
  }
});

test("el dispatcher compartido conserva la ruta de series y la ruta raw", () => {
  const payload = "  taf-bla-1002874  ";
  const serie = despacharCodigoEscaneado(payload, "serie");
  const raw = despacharCodigoEscaneado(payload, "raw");

  assert.equal(serie.valor, "1002874");
  assert.deepEqual(serie.codigo, {
    serie: "1002874",
    sku: "TAF-BLA",
    textoOriginal: payload,
  });
  assert.equal(raw.valor, payload);
  assert.deepEqual(raw.codigo, serie.codigo);
  assert.equal(despacharCodigoEscaneado(payload).valor, "1002874");
});
