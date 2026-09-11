import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { relative } from "node:path";
import test from "node:test";
import * as ts from "typescript";
import { despacharCodigoEscaneado } from "@workspace/scanned-code";

const root = new URL("../../../../", import.meta.url);
const componentFile = new URL(
  "artifacts/mariana-textil/src/components/campo-escaneo.tsx",
  root,
);
const sourceDirectory = fileURLToPath(new URL("../", import.meta.url));

type ScannerClassification = "series" | "raw";

/**
 * This is deliberately a source inventory rather than a list of page names.
 * Adding a CampoEscaneo in a new screen must either be classified here or make
 * this regression fail before the screen can silently change scan semantics.
 *
 * `salida-detail` is the migration predecessor for the delivery component.
 * The implementation agent is moving that scanner to
 * `components/salida-venta-entrega.tsx`; both names stay classified while the
 * move is in flight, but the inventory below only permits one of them at a
 * time.
 */
const EXPECTED_SCANNER_SCREENS: Record<string, ScannerClassification> = {
  "components/recepcion-salidas.tsx": "raw",
  "components/salida-mostrador.tsx": "series",
  "components/salidas-extraordinarias.tsx": "series",
  "components/salida-venta-cliente-nueva.tsx": "series",
  "components/salida-venta-entrega.tsx": "series",
  "pages/ajustes.tsx": "series",
  "pages/auditorias-inventario.tsx": "series",
  "pages/cobros.tsx": "raw",
  "pages/entradas.tsx": "raw",
  "pages/etiquetas.tsx": "series",
  "pages/pos.tsx": "series",
  "pages/salida-detail.tsx": "series",
  "pages/salida-nueva.tsx": "series",
};

type ScannerUsage = {
  file: string;
  classification: ScannerClassification;
  interpretRollCode: boolean | undefined;
  scanMode: string | undefined;
  line: number;
};

async function collectTsxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectTsxFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function staticAttributeValue(
  element: ts.JsxSelfClosingElement | ts.JsxOpeningElement,
  name: string,
): string | boolean | undefined {
  for (const property of element.attributes.properties) {
    if (!ts.isJsxAttribute(property) || property.name.text !== name) continue;
    if (!property.initializer) return true;
    if (ts.isStringLiteral(property.initializer)) return property.initializer.text;
    if (ts.isJsxExpression(property.initializer)) {
      if (!property.initializer.expression) return true;
      if (property.initializer.expression.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
      }
      if (property.initializer.expression.kind === ts.SyntaxKind.FalseKeyword) {
        return false;
      }
      if (ts.isStringLiteral(property.initializer.expression)) {
        return property.initializer.expression.text;
      }
    }
  }
  return undefined;
}

function scannerUsages(source: string, filePath: string): ScannerUsage[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const relativePath = relative(sourceDirectory, filePath).replaceAll("\\", "/");
  const classification = EXPECTED_SCANNER_SCREENS[relativePath];

  const usages: ScannerUsage[] = [];
  const inspect = (node: ts.Node) => {
    const element =
      ts.isJsxSelfClosingElement(node)
        ? node
        : ts.isJsxElement(node)
          ? node.openingElement
          : null;
    if (element && element.tagName.getText(sourceFile) === "CampoEscaneo") {
      if (!classification) {
        throw new Error(`Unclassified CampoEscaneo screen: ${relativePath}`);
      }
      const interpretRollCode = staticAttributeValue(element, "interpretRollCode");
      const scanMode = staticAttributeValue(element, "scanMode");
      usages.push({
        file: relativePath,
        classification,
        interpretRollCode:
          typeof interpretRollCode === "boolean"
            ? interpretRollCode
            : undefined,
        scanMode: typeof scanMode === "string" ? scanMode : undefined,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          .line + 1,
      });
    }
    ts.forEachChild(node, inspect);
  };
  inspect(sourceFile);
  return usages;
}

async function discoverScannerUsages(): Promise<ScannerUsage[]> {
  const paths = await collectTsxFiles(sourceDirectory);
  const usages: ScannerUsage[] = [];
  for (const filePath of paths) {
    const source = await readFile(filePath, "utf8");
    usages.push(...scannerUsages(source, filePath));
  }
  return usages;
}

test("CampoEscaneo keeps keyboard and camera scans on the same delivery path", async () => {
  const source = await readFile(componentFile, "utf8");

  assert.match(source, /const deliver = useCallback/);
  assert.match(source, /despacharCodigoEscaneado\(/);
  assert.match(source, /scanMode\?: ModoEscaneo/);
  assert.match(source, /interpretRollCode = true/);
  assert.match(source, /scanMode \?\? \(interpretRollCode \? "serie" : "raw"\)/);
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

test("every CampoEscaneo usage is discovered and explicitly classified", async () => {
  const usages = await discoverScannerUsages();
  assert.ok(usages.length > 0, "No CampoEscaneo JSX usage was discovered");

  const files = [...new Set(usages.map((usage) => usage.file))].sort();
  const legacyDelivery = "pages/salida-detail.tsx";
  const newDelivery = "components/salida-venta-entrega.tsx";
  const expectedFiles = Object.keys(EXPECTED_SCANNER_SCREENS)
    .filter((file) => file !== legacyDelivery && file !== newDelivery)
    .sort();
  assert.deepEqual(
    files.filter((file) => file !== legacyDelivery && file !== newDelivery),
    expectedFiles,
  );

  const deliveryFiles = files.filter(
    (file) => file === legacyDelivery || file === newDelivery,
  );
  assert.ok(
    deliveryFiles.length === 1,
    `Delivery scanner must live in exactly one screen, found: ${deliveryFiles.join(", ") || "none"}`,
  );

  for (const usage of usages) {
    assert.equal(
      usage.classification,
      EXPECTED_SCANNER_SCREENS[usage.file],
      `${usage.file}:${usage.line} must remain classified`,
    );
    if (usage.classification === "raw") {
      assert.ok(
        usage.scanMode === "raw" || usage.interpretRollCode === false,
        `${usage.file}:${usage.line} is a raw document/quantity scanner and must opt out of series normalization`,
      );
    } else {
      assert.notEqual(
        usage.scanMode,
        "raw",
        `${usage.file}:${usage.line} is a series scanner and cannot use raw mode`,
      );
      assert.notEqual(
        usage.interpretRollCode,
        false,
        `${usage.file}:${usage.line} is a series scanner and cannot disable series normalization`,
      );
    }
  }
});

test("all series scanners resolve the same QR through the CampoEscaneo dispatcher", async () => {
  const usages = await discoverScannerUsages();
  const seriesFiles = [
    ...new Set(
      usages
        .filter((usage) => usage.classification === "series")
        .map((usage) => usage.file),
    ),
  ];
  const payloads = [
    "TAF-BLA-1002874",
    "taf-bla-1002874",
    "  taf-bla-1002874  ",
  ];

  for (const file of seriesFiles) {
    for (const payload of payloads) {
      const keyboard = despacharCodigoEscaneado(payload, "serie");
      const camera = despacharCodigoEscaneado(payload, "serie");
      assert.equal(
        keyboard.valor,
        "1002874",
        `${file} keyboard route must resolve a SKU-SERIE QR to its series`,
      );
      assert.deepEqual(
        camera,
        keyboard,
        `${file} camera and keyboard routes must share the dispatcher`,
      );
    }
  }
});

test("raw document and quantity scanners preserve their input", async () => {
  const usages = await discoverScannerUsages();
  const rawFiles = [
    ...new Set(
      usages
        .filter((usage) => usage.classification === "raw")
        .map((usage) => usage.file),
    ),
  ];
  const payload = "  https://example.test/salida?id=42  ";

  assert.deepEqual(rawFiles.sort(), [
    "components/recepcion-salidas.tsx",
    "pages/cobros.tsx",
    "pages/entradas.tsx",
  ]);
  for (const file of rawFiles) {
    assert.equal(
      despacharCodigoEscaneado(payload, "raw").valor,
      payload,
      `${file} must preserve raw scanner text`,
    );
  }
});

test("the delivery scanner is a classified series consumer of the shared normalizer", async () => {
  const delivery = await readFile(
    new URL("salida-venta-entrega.tsx", import.meta.url),
    "utf8",
  );
  assert.match(delivery, /normalizarSerieEscaneada\(codigo\)/);
  assert.match(delivery, /scanMode="serie"/);
  assert.match(delivery, /<CampoEscaneo/);
  assert.match(delivery, /const \[scanValue, setScanValue\] = useState\(""\)/);
  assert.match(delivery, /value=\{scanValue\}/);
  assert.match(delivery, /onChange=\{setScanValue\}/);
  assert.doesNotMatch(delivery, /onChange=\{\(\) => undefined\}/);
});

test("CampoEscaneo releases camera resources", async () => {
  const component = await readFile(componentFile, "utf8");
  assert.match(component, /fallbackControlsRef\.current\?\.stop\(\)/);
  assert.match(component, /streamRef\.current\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(component, /if \(!cameraOpen\) \{[\s\S]*stopCamera\(\)/);
  assert.match(component, /stopCamera\(\);[\s\S]*setCameraOpen\(false\);[\s\S]*void deliver\(rawValue, "camera"\)/);
  assert.match(component, /return stopCamera;/);
  assert.match(component, /onOpenChange=\{\(open\) => \{[\s\S]*if \(!open\) stopCamera\(\)/);
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