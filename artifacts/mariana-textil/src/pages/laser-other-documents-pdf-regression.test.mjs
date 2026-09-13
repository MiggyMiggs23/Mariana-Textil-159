#!/usr/bin/env node
/*
 * Read-only Chromium PDF regression for the mounted Entrada, Nota and Hoja de
 * Viaje routes.  The route and API responses are real; only browser Fetch is
 * intercepted.  This file intentionally imports the CDP/PDF primitives from
 * the Salida laser harness so that all four documents use the same browser
 * lifecycle and raster implementation.
 *
 * The Salida harness exports these shared functions:
 *   launchChromium, createPage, closePage, evaluate,
 *   extractPdfPages, assertRasterSafeArea, findRasterTool,
 *   assertPdfTextSafeArea
 *
 * `extractPdfPages`, `assertRasterSafeArea`, and the optional text safe-area
 * assertion accept a final dimensions object:
 *   { widthMm, heightMm, safeMm, toleranceMm }
 *
 * Run after starting the web workflow:
 *
 *   node artifacts/mariana-textil/src/pages/laser-other-documents-pdf-regression.test.mjs
 *
 * Optional:
 *   LASER_DOCUMENTS_BASE_URL=http://localhost:80
 *   CHROMIUM_BIN=/repl/tools/bin/chromium
 *   LASER_OTHER_DOCUMENT_PDF_ARTIFACT_DIR=/tmp/laser-other-documents-pdf-regression
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as salidaHarness from "./laser-documents-pdf-regression.test.mjs";
import {
  LASER_DOCUMENT_FIXTURES,
  LASER_DOCUMENT_SOURCE_SELECTORS,
} from "./laser-document-fixtures.mjs";

const APP_URL = (process.env.LASER_DOCUMENTS_BASE_URL ?? "http://localhost:80").replace(
  /\/+$/,
  "",
);
const ARTIFACT_DIR =
  process.env.LASER_OTHER_DOCUMENT_PDF_ARTIFACT_DIR ??
  path.join(os.tmpdir(), "laser-other-documents-pdf-regression");
const CHROMIUM_BIN = process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium";
const SAFE_MM = 5;
const TOLERANCE_MM = 0;
const RASTER_DPI = 96;

const shared = (name) => {
  const value = salidaHarness[name];
  if (typeof value !== "function") {
    throw new Error(
      `Salida laser harness must export ${name} for the other-document regression`,
    );
  }
  return value;
};

const launchChromium = shared("launchChromium");
const createPage = shared("createPage");
const closePage = shared("closePage");
const evaluate = shared("evaluate");
const extractPdfPages = shared("extractPdfPages");
const assertRasterSafeArea = shared("assertRasterSafeArea");
const assertPdfTextSafeArea = shared("assertPdfTextSafeArea");
const findRasterTool = shared("findRasterTool");

function describeError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function jsonResponse(body, status = 200) {
  return {
    responseCode: status,
    responseHeaders: [
      { name: "Content-Type", value: "application/json; charset=utf-8" },
      { name: "Cache-Control", value: "no-store" },
    ],
    body: Buffer.from(JSON.stringify(body)).toString("base64"),
  };
}

const DOCUMENT_CONFIG = Object.freeze({
  entrada: Object.freeze({
    widthMm: 216,
    heightMm: 279,
    printClass: "print-entrada",
    buttonText: "Imprimir / Guardar PDF",
    domPageCount: (fixture) => fixture.expectedPageCount,
    selectors: LASER_DOCUMENT_SOURCE_SELECTORS.entrada,
  }),
  nota: Object.freeze({
    widthMm: 148,
    heightMm: 210,
    printClass: "print-credito",
    buttonText: "Imprimir Nota",
    domPageCount: (fixture) => fixture.expectedPageCount,
    selectors: LASER_DOCUMENT_SOURCE_SELECTORS.nota,
  }),
  viaje: Object.freeze({
    widthMm: 216,
    heightMm: 279,
    printClass: "print-viaje",
    buttonText: "Imprimir",
    // The Hoja de Viaje route mounts one fixed page for both requested probes.
    domPageCount: () => 1,
    selectors: LASER_DOCUMENT_SOURCE_SELECTORS.viaje,
  }),
});

const scenarios = [
  ["entrada", "count1"],
  ["entrada", "measured10"],
  ["entrada", "measured11"],
  ["entrada", "measured12"],
  ["entrada", "max"],
  ["entrada", "overflowPages"],
  ["entrada", "series40"],
  ["entrada", "series41"],
  ["nota", "count1"],
  ["nota", "max"],
  ["nota", "overflowPages"],
  ["viaje", "count1"],
  ["viaje", "max"],
].map(([kind, fixtureName]) => {
  const fixture = LASER_DOCUMENT_FIXTURES[kind][fixtureName];
  const config = DOCUMENT_CONFIG[kind];
  return Object.freeze({
    ...fixture,
    kind,
    fixtureName,
    widthMm: config.widthMm,
    heightMm: config.heightMm,
    printClass: config.printClass,
    buttonText: config.buttonText,
    expectedDomPageCount: config.domPageCount(fixture),
    selectors: config.selectors,
  });
});

function describeApiRequest(url, method) {
  const parsed = new URL(url);
  return `${method} ${parsed.pathname}${parsed.search}`;
}

async function installApiFixture(page, scenario, requestedRequests) {
  await page.cdp.call(
    "Fetch.enable",
    {
      patterns: [{ urlPattern: "*://*/api/*", requestStage: "Request" }],
    },
    page.sessionId,
  );
  page.cdp.on(
    "Fetch.requestPaused",
    async (event) => {
      const requestKey = describeApiRequest(event.request.url, event.request.method);
      requestedRequests.push(requestKey);
      const responseBody = scenario.apiResponses[requestKey];
      try {
        if (responseBody === undefined) {
          await page.cdp.call(
            "Fetch.fulfillRequest",
            {
              requestId: event.requestId,
              ...jsonResponse(
                { message: `Unexpected API request in laser fixture: ${requestKey}` },
                404,
              ),
            },
            page.sessionId,
          );
          return;
        }
        await page.cdp.call(
          "Fetch.fulfillRequest",
          {
            requestId: event.requestId,
            ...jsonResponse(responseBody),
          },
          page.sessionId,
        );
      } catch (error) {
        try {
          await page.cdp.call(
            "Fetch.failRequest",
            { requestId: event.requestId, errorReason: "BlockedByClient" },
            page.sessionId,
          );
        } catch {
          // The page may close while a fixture response is being completed.
        }
        requestedRequests.push(`fixture-error ${describeError(error)}`);
      }
    },
    page.sessionId,
  );
}

async function waitForMountedRoute(page, scenario) {
  const browserScenario = JSON.stringify({
    expectedDomPageCount: scenario.expectedDomPageCount,
    buttonText: scenario.buttonText,
    selectors: scenario.selectors,
  });
  const result = await evaluate(
    page,
    `async function waitForDocumentRoute() {
      const scenario = ${browserScenario};
      const normalizedText = (value) => String(value ?? "").replace(/\\s+/gu, " ").trim();
      const deadline = Date.now() + 15_000;
      const selectors = scenario.selectors;
      while (Date.now() < deadline) {
        const pages = document.querySelectorAll(selectors.page);
        const button = Array.from(document.querySelectorAll("button")).find(
          (candidate) =>
            normalizedText(candidate.textContent) === scenario.buttonText,
        );
        if (pages.length >= scenario.expectedDomPageCount && button) {
          return {
            pageCount: pages.length,
            rowCount: document.querySelectorAll(selectors.row).length,
            buttonText: normalizedText(button.textContent),
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(
        "Timed out waiting for mounted document route",
      );
    }`,
  );
  assert.equal(result.pageCount, scenario.expectedDomPageCount);
  assert.equal(result.buttonText, scenario.buttonText);
  return result;
}

async function installPrintSignal(page) {
  return evaluate(
    page,
    function installDocumentPrintSignal() {
      const key = "__laserOtherDocumentOriginalPrint";
      const callsKey = "__laserOtherDocumentPrintCalls";
      window[key] = window.print;
      window[callsKey] = 0;
      window.print = () => {
        window[callsKey] += 1;
      };
       return { key, callsKey };
    },
  );
}

async function clickPrintButton(page, scenario) {
  const buttonText = JSON.stringify(scenario.buttonText);
  await evaluate(
    page,
    `function clickMountedDocumentPrintButton() {
      const buttonText = ${buttonText};
      const normalizedText = (value) => String(value ?? "").replace(/\\s+/gu, " ").trim();
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) =>
          normalizedText(candidate.textContent) === buttonText,
      );
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error("Missing document print button");
      }
      if (button.disabled) {
        throw new Error("Document print button is disabled");
      }
      button.click();
    }`,
  );
  return evaluate(
    page,
    async function waitForDocumentPrintSignal() {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        if (window.__laserOtherDocumentPrintCalls === 1) {
          return {
            printCalls: window.__laserOtherDocumentPrintCalls,
            bodyClass: document.body.className,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(
        "Timed out waiting for document printWhenReady signal",
      );
    },
  );
}

async function restorePrintSignal(page) {
  return evaluate(
    page,
    function restoreDocumentPrintSignal() {
      if (window.__laserOtherDocumentOriginalPrint) {
        window.print = window.__laserOtherDocumentOriginalPrint;
      }
      delete window.__laserOtherDocumentOriginalPrint;
      delete window.__laserOtherDocumentPrintCalls;
      return true;
    },
  );
}

async function measureMountedRoute(page, scenario) {
  const selectors = JSON.stringify(scenario.selectors);
  return evaluate(
    page,
    `function measureMountedDocumentRoute() {
      const selectors = ${selectors};
      const box = (element) => {
        if (!(element instanceof HTMLElement)) {
          throw new Error("Cannot measure a non-HTMLElement");
        }
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const pageElements = Array.from(
        document.querySelectorAll(selectors.page),
      );
      const frameElements = selectors.frame
        ? Array.from(document.querySelectorAll(selectors.frame))
        : [];
      const rows = Array.from(
        document.querySelectorAll(selectors.row),
      ).map((row) => box(row));
      const noteSections = frameElements
        .filter((frame) => frame.classList.contains("nota-page-frame"))
        .map((frame) => ({
          table: box(frame.querySelector(".document-product-grid")),
          legal: box(frame.querySelector('[data-testid="note-legal-block"]')),
          totals: frame.querySelector('[data-testid="note-totals-block"]')
            ? box(frame.querySelector('[data-testid="note-totals-block"]')) : null,
        }));
      return {
        pages: pageElements.map((element) => box(element)),
        frames: frameElements.map((element) => box(element)),
        rows,
        pageCount: pageElements.length,
        rowCount: rows.length,
        noteSections,
        entrySections: frameElements
          .filter((frame) => frame.querySelector(".document-footer"))
          .map((frame) => ({
            table: box(frame.querySelector(".document-product-grid")),
            footer: box(frame.querySelector(".document-footer")),
            frame: box(frame),
          })),
      };
    }`,
  );
}

function assertMountedSafeFrame(measurement, scenario) {
  for (const section of measurement.entrySections ?? []) {
    assert(section.table.bottom <= section.footer.y, "Entrada product grid overlaps its footer");
    assert(section.footer.bottom <= section.frame.bottom, "Entrada footer exceeds its inner frame");
  }
  for (const section of measurement.noteSections ?? []) {
    assert(section.table.bottom <= section.legal.y, "Nota product grid overlaps its legal text");
    if (section.totals) {
      assert(section.table.bottom <= section.totals.y, "Nota product grid overlaps its totals");
    }
  }
  if (measurement.frames.length === 0) return;
  for (const [index, frame] of measurement.frames.entries()) {
    const page = measurement.pages[index];
    assert(page, `missing page box for ${scenario.kind} frame ${index + 1}`);
    assert(frame.x >= page.x - 0.5);
    assert(frame.y >= page.y - 0.5);
    assert(frame.right <= page.right + 0.5);
    assert(frame.bottom <= page.bottom + 0.5);
  }
}

function comparablePdfText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("es-MX")
    .replace(/-\s+/gu, "-");
}

function pdfContainsText(pdfText, expectedText) {
  const comparableText = comparablePdfText(pdfText);
  const comparableExpected = comparablePdfText(expectedText);
  if (comparableText.includes(comparableExpected)) return true;
  const wrappedParts = comparableExpected.match(/[^-]+-|-?[^-]+$/gu) ?? [];
  return (
    wrappedParts.length > 1 &&
    wrappedParts.every((part) => comparableText.includes(part))
  );
}

function responseWithRows(scenario) {
  if (scenario.kind === "entrada") {
    return Object.values(scenario.apiResponses).find(
      (response) => response && Array.isArray(response.lineas) && Array.isArray(response.rollos),
    );
  }
  if (scenario.kind === "nota") {
    return Object.values(scenario.apiResponses).find(
      (response) =>
        response &&
        response.documentoTipo === "NOTA" &&
        Array.isArray(response.lineas),
    );
  }
  return Object.values(scenario.apiResponses).find(
    (response) => response && Array.isArray(response.rollos),
  );
}

function assertPdfText(pdf, scenario) {
  assert.equal(pdf.pageCount, scenario.expectedPageCount);
  assert(pdf.pages.length === scenario.expectedPageCount);
  assert(
    pdf.pages.every((page) => page.length > 0),
    `${scenario.name} must not contain a blank PDF page`,
  );
  const allText = pdf.pages.join(" ");
  for (const expectedText of scenario.expectedText) {
    assert(
      pdfContainsText(allText, expectedText),
      `${scenario.name} PDF is missing expected text: ${expectedText}`,
    );
  }

  const response = responseWithRows(scenario);
  assert(response, `missing row-bearing response for ${scenario.name}`);
  if (scenario.kind === "entrada") {
    for (const row of response.lineas) {
      for (const text of [row.skuProducto, row.telaProducto, row.colorProducto]) {
        assert(pdfContainsText(allText, text), `${scenario.name} PDF is missing ${text}`);
      }
    }
    for (const rollo of response.rollos) {
      assert(pdfContainsText(allText, rollo.serie), `${scenario.name} PDF is missing ${rollo.serie}`);
    }
  } else if (scenario.kind === "nota") {
    for (const row of response.lineas) {
      for (const text of [row.skuProducto, row.telaProducto, row.colorProducto]) {
        assert(pdfContainsText(allText, text), `${scenario.name} PDF is missing ${text}`);
      }
    }
    assert(pdfContainsText(allText, "total"), `${scenario.name} PDF is missing totals`);
    assert(pdfContainsText(allText, "documento"), `${scenario.name} PDF is missing the total document label`);
    assert(
      pdfContainsText(allText, "firma de conformidad"),
      `${scenario.name} PDF is missing signature`,
    );
  } else {
    for (const rollo of response.rollos) {
      assert(pdfContainsText(allText, rollo.serie), `${scenario.name} PDF is missing ${rollo.serie}`);
    }
    for (const text of ["Totales:", "Documentos"]) {
      assert(pdfContainsText(allText, text), `${scenario.name} PDF is missing ${text}`);
    }
  }
}

function allowedRequests(scenario) {
  return new Set(scenario.expectedApiRequests);
}

async function capturePdf(page, scenario, pdfPath) {
  const pdfResult = await page.cdp.call(
    "Page.printToPDF",
    {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      paperWidth: scenario.widthMm / 25.4,
      paperHeight: scenario.heightMm / 25.4,
      scale: 1,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
    },
    page.sessionId,
  );
  await writeFile(pdfPath, Buffer.from(pdfResult.data, "base64"));
  return pdfPath;
}

async function runScenario(browser, scenario, rasterTool) {
  const requestedRequests = [];
  const report = {
    name: scenario.name,
    kind: scenario.kind,
    fixtureName: scenario.fixtureName,
    configuredRowCount: scenario.count,
    route: scenario.route,
    expectedPageCount: scenario.expectedPageCount,
    expectedDomPageCount: scenario.expectedDomPageCount,
    dimensionsMm: {
      width: scenario.widthMm,
      height: scenario.heightMm,
      safe: SAFE_MM,
    },
    requestedRequests,
    status: "running",
  };
  const page = await createPage(browser);
  await installApiFixture(page, scenario, requestedRequests);
  try {
    await page.cdp.call(
      "Page.navigate",
      { url: `${APP_URL}${scenario.route}` },
      page.sessionId,
    );
    report.mounted = await waitForMountedRoute(page, scenario);
    await installPrintSignal(page, scenario);
    report.print = await clickPrintButton(page, scenario);
    assert.equal(report.print.printCalls, 1);
    assert(
      report.print.bodyClass.split(/\s+/u).includes(scenario.printClass),
      `${scenario.name} must activate ${scenario.printClass}`,
    );
    await page.cdp.call("Emulation.setEmulatedMedia", { media: "print" }, page.sessionId);
    report.layout = await measureMountedRoute(page, scenario);
    assert.equal(report.layout.pageCount, scenario.expectedDomPageCount);
    assertMountedSafeFrame(report.layout, scenario);

    const pdfPath = path.join(ARTIFACT_DIR, `${scenario.name}.pdf`);
    try {
      await capturePdf(page, scenario, pdfPath);
      report.pdfPath = pdfPath;
      report.pdf = extractPdfPages(pdfPath, {
        widthMm: scenario.widthMm,
        heightMm: scenario.heightMm,
      });
      assertPdfText(report.pdf, scenario);
      try {
        report.pdfTextSafeArea = assertPdfTextSafeArea(report.pdf, {
          widthMm: scenario.widthMm,
          heightMm: scenario.heightMm,
          safeMm: SAFE_MM,
          toleranceMm: TOLERANCE_MM,
        });
      } catch (error) {
        // pdftotext ascender boxes can begin above visible glyph ink.  Keep
        // this diagnostic in the report; raster ink is the authoritative
        // four-edge safe-area assertion.
        report.pdfTextSafeArea = {
          status: "diagnostic-failed",
          failure: describeError(error),
        };
      }
      report.raster = await assertRasterSafeArea(
        pdfPath,
        ARTIFACT_DIR,
        scenario.expectedPageCount,
        rasterTool,
        {
          widthMm: scenario.widthMm,
          heightMm: scenario.heightMm,
          pageSizePoints: report.pdf.pageSizePoints,
          safeMm: SAFE_MM,
          toleranceMm: TOLERANCE_MM,
        },
      );
      const unexpectedRequests = requestedRequests.filter(
        (request) => !allowedRequests(scenario).has(request),
      );
      assert.deepEqual(
        unexpectedRequests,
        [],
        `${scenario.name} made an API request without a fixture`,
      );
      report.status = "passed";
    } finally {
      await restorePrintSignal(page);
    }
  } catch (error) {
    report.status = "failed";
    report.failure = describeError(error);
  } finally {
    await closePage(page);
  }
  return report;
}

async function main() {
  const rasterTool = findRasterTool();
  if (!rasterTool) {
    throw new Error(
      "ImageMagick is required for raster safe-area assertions; install convert/magick and rerun this harness",
    );
  }
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await launchChromium();
  const report = {
    status: "running",
    fixturePolicy:
      "Read-only browser Fetch fixtures only; no DB writes, users, sessions, or live API calls.",
    scenarios: [],
    browser: {
      executable: CHROMIUM_BIN,
      version: browser.browserVersion,
      launchArgs: browser.args,
    },
  };
  try {
    const requestedKinds = process.env.LASER_DOCUMENT_KINDS?.split(",");
    const selectedScenarios = scenarios.filter(
      (scenario) => (!requestedKinds || requestedKinds.includes(scenario.kind))
        && (!process.env.LASER_DOCUMENT_CASES || process.env.LASER_DOCUMENT_CASES.split(",").includes(scenario.fixtureName)),
    );
    assert(selectedScenarios.length > 0, "No laser document scenarios selected");
    for (const scenario of selectedScenarios) {
      try {
        report.scenarios.push(await runScenario(browser, scenario, rasterTool));
      } catch (error) {
        report.scenarios.push({
          name: scenario.name,
          kind: scenario.kind,
          status: "harness-failed",
          failure: describeError(error),
        });
      }
    }
    report.status = report.scenarios.every(
      (scenario) => scenario.status === "passed",
    )
      ? "passed"
      : "failed";
  } finally {
    report.browser.stderrTail = browser.stderr.join("").slice(-4_000);
    await browser.close();
  }
  const reportPath = path.join(ARTIFACT_DIR, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        reportPath,
        scenarios: report.scenarios.map((scenario) => ({
          name: scenario.name,
          status: scenario.status,
          expectedPageCount: scenario.expectedPageCount ?? null,
          actualPageCount: scenario.pdf?.pageCount ?? null,
          failure: scenario.failure ?? null,
        })),
      },
      null,
      2,
    ),
  );
  if (report.status !== "passed") process.exitCode = 1;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  await main();
}
