import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const componentFile = new URL(
  "artifacts/mariana-textil/src/components/campo-escaneo.tsx",
  root,
);

test("CampoEscaneo keeps keyboard and camera scans on the same delivery path", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /const deliver = useCallback/);
  assert.match(source, /interpretarCodigoEscaneado\(rawValue\)/);
  assert.match(source, /codigo\.serie[\s\S]*\? codigo\.serie[\s\S]*: codigo\.textoOriginal/);
  assert.match(source, /await onScan\(scannedValue, codigo, source\)/);
  assert.match(source, /const submit = \(\) => \{[\s\S]*deliver\(value, source\)/);
  assert.match(source, /void deliver\(rawValue, "camera"\)/);
  assert.match(source, /typedCharactersRef\.current >= 7[\s\S]*elapsed <= 350[\s\S]*largestTypingGapRef\.current <= 50/);
  assert.match(source, /\? "scanner"[\s\S]*: "manual"/);
  assert.match(source, /clearOnScan\) onChange\(""\)/);
  assert.match(source, /inputRef\.current\?\.focus\(\)/);

  assert.match(source, /BarcodeDetector/);
  assert.match(source, /await import\("@zxing\/browser"\)/);
  assert.match(source, /BrowserMultiFormatReader/);
  assert.match(source, /facingMode: \{ ideal: "environment" \}/);
  for (const format of ["qr_code", "code_128", "code_39", "ean_13", "upc_a"]) {
    assert.match(source, new RegExp(`"${format}"`));
  }
  assert.match(source, /Habilita el permiso de cámara.*ajustes del teléfono/s);
  assert.match(source, /cameraCapable &&/);
});

test("CampoEscaneo releases camera resources and every scanning screen uses it", async () => {
  const pages = {
    "salida-nueva": "artifacts/mariana-textil/src/pages/salida-nueva.tsx",
    pos: "artifacts/mariana-textil/src/pages/pos.tsx",
    ajustes: "artifacts/mariana-textil/src/pages/ajustes.tsx",
    etiquetas: "artifacts/mariana-textil/src/pages/etiquetas.tsx",
    "entradas roll capture": "artifacts/mariana-textil/src/pages/entradas.tsx",
    "Salidas reception": "artifacts/mariana-textil/src/components/recepcion-salidas.tsx",
  };
  const [component, ...sources] = await Promise.all([
    readFile(componentFile, "utf8"),
    ...Object.values(pages).map((path) => readFile(new URL(path, root), "utf8")),
  ]);

  assert.match(component, /fallbackControlsRef\.current\?\.stop\(\)/);
  assert.match(component, /streamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(component, /if \(!cameraOpen\) \{[\s\S]*stopCamera\(\)/);
  assert.match(component, /stopCamera\(\);[\s\S]*setCameraOpen\(false\);[\s\S]*void deliver\(rawValue, "camera"\)/);
  assert.match(component, /return stopCamera;/);
  assert.match(component, /onOpenChange=\{\(open\) => \{[\s\S]*if \(!open\) stopCamera\(\)/);

  for (const [name, source] of Object.entries(
    Object.fromEntries(Object.keys(pages).map((name, index) => [name, sources[index]])),
  )) {
    assert.match(source, /import \{ CampoEscaneo \} from "@\/components\/campo-escaneo";/, name);
    assert.match(source, /<CampoEscaneo/, name);
  }
  assert.match(sources[5]!, /onScan=\{selectScan\}/);
  assert.match(sources[4]!, /interpretRollCode=\{false\}/);
  assert.match(sources[5]!, /interpretRollCode=\{false\}/);
});

test("SKU mismatch warnings are visible and do not block roll operations", async () => {
  const [pos, salida, etiquetas, ajustes] = await Promise.all([
    readFile(new URL("artifacts/mariana-textil/src/pages/pos.tsx", root), "utf8"),
    readFile(new URL("artifacts/mariana-textil/src/pages/salida-nueva.tsx", root), "utf8"),
    readFile(new URL("artifacts/mariana-textil/src/pages/etiquetas.tsx", root), "utf8"),
    readFile(new URL("artifacts/mariana-textil/src/pages/ajustes.tsx", root), "utf8"),
  ]);

  for (const source of [pos, salida, etiquetas, ajustes]) {
    assert.match(source, /advertenciaSkuEscaneado/);
  }
  assert.match(pos, /skuWarning[\s\S]*role="alert"/);
  assert.match(etiquetas, /skuWarning[\s\S]*<Alert/);
  assert.match(ajustes, /skuWarning[\s\S]*role="alert"/);
  assert.match(
    salida,
    /const warning = advertenciaSkuEscaneado[\s\S]*if \(warning\)[\s\S]*toast\([\s\S]*(?:setScannedRolls|setDraft)/,
  );
  assert.doesNotMatch(
    salida,
    /if \(warning\) \{[\s\S]{0,300}\breturn\b/,
  );
});