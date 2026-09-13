#!/usr/bin/env node
/*
 * Executable, read-only PDF regression for the real EntradaEtiquetas route.
 *
 * The API is intercepted inside the browser with deterministic fixtures.  The
 * fixture supplies auth/me and one entrada response only; it never logs in,
 * creates a session, writes to a database, or calls a live API.  The React
 * route, AppLayout, portal, existing CSS, and Chromium print media remain real.
 *
 * This captures Chromium's CDP Page.printToPDF output.  That is deliberately
 * not a Wasp WPL308 print-dialog run: the native Wasp driver is not available
 * to a headless local test.  The JSON report records that distinction instead
 * of treating a browser PDF as evidence about the printer dialog.
 *
 * No production print CSS or component belongs in this file.  Run it after
 * starting the web workflow:
 *
 *   node artifacts/mariana-textil/src/pages/entrada-etiquetas-pdf-regression.test.mjs
 *
 * Optional environment variables:
 *   ETIQUETAS_BASE_URL=http://localhost:80
 *   CHROMIUM_BIN=/repl/tools/bin/chromium
 *   ETIQUETAS_PDF_ARTIFACT_DIR=/tmp/entrada-etiquetas-pdf-regression
 *   WASP_DRIVER_DESCRIPTION="..."  (metadata only; no Wasp calls are made)
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import process from "node:process";

const APP_URL = (process.env.ETIQUETAS_BASE_URL ?? "http://localhost:80").replace(
  /\/+$/,
  "",
);
const CHROMIUM_BIN = process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium";
const ARTIFACT_DIR =
  process.env.ETIQUETAS_PDF_ARTIFACT_DIR ??
  path.join(os.tmpdir(), "entrada-etiquetas-pdf-regression");
const STARTED_AT = new Date().toISOString();
const FOOTER = "MARIANA TEXTIL";
const PRINT_CLASS = "printing-labels";

const baselineLabels = [
  {
    id: 91001,
    serie: "1000000",
    sku: "SKU-BASELINE",
    tela: "Algodón baseline",
    color: "Azul prueba",
    cantidad: "1.234",
    unidad: "METRO",
  },
];

const regressionLabels = Array.from({ length: 25 }, (_, index) => ({
  id: 92001 + index,
  serie: String(1000001 + index),
  sku: "SKU-REGRESION",
  tela: "Algodón regresión",
  color: "Azul prueba",
  cantidad: (100 + index * 0.125).toFixed(3),
  unidad: "METRO",
}));

const fixtures = [
  buildEntryFixture({
    id: 9100,
    folioFormateado: "QA-BASELINE",
    labels: baselineLabels,
  }),
  buildEntryFixture({
    id: 9200,
    folioFormateado: "QA-25",
    labels: regressionLabels,
  }),
];

function buildEntryFixture({ id, folioFormateado, labels }) {
  const cantidadTotal = labels
    .reduce((total, label) => total + Number(label.cantidad), 0)
    .toFixed(3);
  const first = labels[0];

  return {
    id,
    folio: id,
    inicialesSitio: "QA",
    folioFormateado,
    ubicacionId: 1,
    nombreUbicacion: "Sitio fixture",
    proveedorId: null,
    nombreProveedor: null,
    usuarioId: 1,
    nombreUsuario: "Usuario fixture",
    fecha: "2026-01-01",
    observaciones: "Fixture de regresión PDF",
    totalRollos: labels.length,
    totalCosto: null,
    uuidCliente: `fixture-entrada-${id}`,
    createdAt: "2026-01-01T12:00:00.000Z",
    lineas: [
      {
        productoId: 1,
        skuProducto: first.sku,
        telaProducto: first.tela,
        colorProducto: first.color,
        unidadProducto: first.unidad,
        costoUnitario: null,
        rollosCount: labels.length,
        cantidadTotal,
        costoTotal: null,
      },
    ],
    rollos: labels.map((label) => ({
      id: label.id,
      serie: label.serie,
      productoId: 1,
      cantidadInicial: label.cantidad,
      pisoId: null,
      nombrePiso: null,
      costoUnitario: null,
      costoTotal: null,
    })),
  };
}

const authFixture = {
  id: 1,
  nombre: "Usuario fixture",
  usuario: "usuario.fixture",
  rol: "TERMINAL",
  ubicacion: {
    id: 1,
    nombre: "Sitio fixture",
    iniciales: "QA",
    tipo: "TIENDA",
    activa: true,
    esSistema: false,
  },
  alcanceConsulta: "PROPIA",
  permisos: [
    {
      modulo: "entradas",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    },
  ],
};

const notificationFixture = {
  events: [],
  generatedAt: "2026-01-01T12:00:00.000Z",
  sessionKey: "browser-fixture-no-session",
};

function expectedLabelsForFixture(fixture) {
  const line = fixture.lineas[0];
  return fixture.rollos.map((rollo) => ({
    sku: line.skuProducto,
    serie: rollo.serie,
    tela: line.telaProducto,
    color: line.colorProducto,
    cantidad: rollo.cantidadInicial,
    unidad: line.unidadProducto,
  }));
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

function describeError(error) {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

class HarnessError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "HarnessError";
  }
}

function normalizedText(value) {
  return String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function fetchJson(url) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out fetching ${url}: ${describeError(lastError)}`);
}

class CdpConnection {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    webSocket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(
            new Error(
              `${message.error.message ?? "CDP error"} (${message.error.code ?? "unknown"})`,
            ),
          );
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      const sessionListeners = message.sessionId
        ? this.handlers.get(`${message.sessionId}:${message.method}`) ?? []
        : [];
      const listeners = [
        ...sessionListeners,
        ...(this.handlers.get(message.method) ?? []),
      ];
      for (const listener of listeners) listener(message.params ?? {});
    });
    webSocket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("CDP WebSocket closed"));
      }
      this.pending.clear();
    });
  }

  on(method, listener, sessionId) {
    const key = sessionId ? `${sessionId}:${method}` : method;
    const listeners = this.handlers.get(key) ?? [];
    listeners.push(listener);
    this.handlers.set(key, listeners);
  }

  async call(method, params = {}, sessionId) {
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    const response = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.webSocket.send(JSON.stringify(message));
    return response;
  }
}

async function connectCdp(wsUrl) {
  const webSocket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out connecting to ${wsUrl}`)),
      10_000,
    );
    webSocket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    webSocket.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(`CDP WebSocket error: ${String(event.error ?? event.type)}`));
    });
  });
  return new CdpConnection(webSocket);
}

async function launchChromium() {
  const port = await reservePort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "entrada-etiquetas-chromium-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];
  const browserProcess = spawn(CHROMIUM_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderr = [];
  browserProcess.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  try {
    const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
    const cdp = await connectCdp(version.webSocketDebuggerUrl);
    return {
      args,
      browserProcess,
      browserVersion: version,
      cdp,
      stderr,
      userDataDir,
      async close() {
        try {
          await cdp.call("Browser.close");
        } catch {
          browserProcess.kill("SIGTERM");
        }
        await new Promise((resolve) => {
          if (browserProcess.exitCode !== null) {
            resolve();
            return;
          }
          const timeout = setTimeout(() => {
            browserProcess.kill("SIGKILL");
            resolve();
          }, 5_000);
          browserProcess.once("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        await rm(userDataDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    browserProcess.kill("SIGKILL");
    await rm(userDataDir, { recursive: true, force: true });
    throw new Error(
      `Could not launch Chromium at ${CHROMIUM_BIN}: ${describeError(error)}\n${stderr.join("")}`,
    );
  }
}

async function createPage(browser) {
  const target = await browser.cdp.call("Target.createTarget", {
    url: "about:blank",
  });
  const attached = await browser.cdp.call("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  const sessionId = attached.sessionId;
  const page = {
    sessionId,
    targetId: target.targetId,
    cdp: browser.cdp,
  };
  await browser.cdp.call("Page.enable", {}, sessionId);
  await browser.cdp.call("Runtime.enable", {}, sessionId);
  await browser.cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  }, sessionId);
  return page;
}

async function closePage(page) {
  await page.cdp.call("Target.closeTarget", { targetId: page.targetId });
}

async function evaluate(page, expression, awaitPromise = true) {
  const result = await page.cdp.call(
    "Runtime.evaluate",
    {
      expression: `(${expression})()`,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    },
    page.sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime.evaluate failed",
    );
  }
  return result.result?.value;
}

function fixtureForEntryId(entryId) {
  const fixture = fixtures.find((item) => item.id === entryId);
  if (!fixture) throw new Error(`No browser fixture for entrada ${entryId}`);
  return fixture;
}

function pathnameFor(url) {
  return new URL(url).pathname;
}

async function installApiFixture(page, requestedPaths) {
  await page.cdp.call(
    "Fetch.enable",
    {
      patterns: [{ urlPattern: "*://*/api/*", requestStage: "Request" }],
    },
    page.sessionId,
  );
  page.cdp.on("Fetch.requestPaused", async (event) => {
    const url = event.request.url;
    const pathname = pathnameFor(url);
    requestedPaths.push(`${event.request.method} ${pathname}`);
    try {
      let response;
      if (pathname === "/api/auth/me") {
        response = jsonResponse(authFixture);
      } else if (pathname === "/api/notificaciones/feed") {
        response = jsonResponse(notificationFixture);
      } else if (pathname.startsWith("/api/inventario/entradas/")) {
        const entryId = Number(pathname.split("/").at(-1));
        response = jsonResponse(fixtureForEntryId(entryId));
      } else {
        // A real API response is never allowed to leak into this test.
        response = jsonResponse(
          { message: `Unexpected API request in PDF fixture: ${pathname}` },
          404,
        );
      }
      await page.cdp.call(
        "Fetch.fulfillRequest",
        { requestId: event.requestId, ...response },
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
        // The page may have navigated away while the fixture was being served.
      }
      requestedPaths.push(`fixture-error ${describeError(error)}`);
    }
  }, page.sessionId);
}

async function waitForLabels(page, expectedCount) {
  return evaluate(page, async function waitForLabelsInPage() {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const labels = document.querySelectorAll(".etiquetas-print .label-page");
      if (labels.length > 0) {
        return {
          count: labels.length,
          bodyClass: document.body.className,
          directBodyPrintRoots: Array.from(
            document.body.children,
            (child) => child.classList.contains("etiquetas-print"),
          ),
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for the real EntradaEtiquetas portal");
  }).then((result) => {
    assert.equal(
      result.count,
      expectedCount,
      "the full route must mount exactly the fixture label count",
    );
    return result;
  });
}

async function installPrintSignal(page) {
  return evaluate(page, function installPrintSignalInPage() {
    if (window.__entradaPdfPrintOriginal) {
      throw new Error("PDF print signal was already installed");
    }
    window.__entradaPdfPrintOriginal = window.print;
    window.__entradaPdfPrintCalls = 0;
    window.__entradaPdfPrintSignalAt = null;
    window.print = () => {
      window.__entradaPdfPrintCalls += 1;
      window.__entradaPdfPrintSignalAt = performance.now();
    };
    return {
      nativePrintOverridden: true,
      cleanupDelayMs: 1_000,
    };
  });
}

async function clickPrintSelection(page, expectedCount) {
  await evaluate(page, function clickPrintSelectionInPage() {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        (candidate.textContent ?? "").replace(/\s+/gu, " ").trim() ===
        "Imprimir Selección",
    );
    if (!button) throw new Error('Could not find the real "Imprimir Selección" button');
    if (button.disabled) throw new Error('"Imprimir Selección" is disabled');
    button.click();
  });

  const printState = await evaluate(page, async function waitForPrintSignalInPage() {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (window.__entradaPdfPrintCalls === 1) {
        const printRoot = document.querySelector(".etiquetas-print");
        return {
          bodyClass: document.body.className,
          printRootParent: printRoot?.parentElement?.tagName.toLowerCase() ?? null,
          labelCount: printRoot?.querySelectorAll(".label-page").length ?? 0,
          printCalls: window.__entradaPdfPrintCalls,
          signalAt: window.__entradaPdfPrintSignalAt,
          cleanupDelayMs: 1_000,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Timed out waiting for printWhenReady to call window.print");
  });
  assert.equal(printState.printCalls, 1, "the real print action must call window.print once");
  assert(printState.bodyClass.split(/\s+/u).includes(PRINT_CLASS));
  assert.equal(printState.labelCount, expectedCount);
  return printState;
}

async function restoreNativePrint(page) {
  await evaluate(page, function restoreNativePrintInPage() {
    if (window.__entradaPdfPrintOriginal) {
      window.print = window.__entradaPdfPrintOriginal;
    }
    delete window.__entradaPdfPrintOriginal;
    delete window.__entradaPdfPrintCalls;
    delete window.__entradaPdfPrintSignalAt;
  });
}

async function captureDomLabels(page, labels) {
  const actual = await evaluate(page, function captureLabelsInPage() {
    return Array.from(document.querySelectorAll(".etiquetas-print .label-page")).map(
      (label) => ({
        text: label.textContent ?? "",
        className: label.className,
        parent: label.parentElement?.className ?? null,
      }),
    );
  });
  assert.equal(actual.length, labels.length);
  return actual.map((item, index) => {
    const expected = labels[index];
    const text = normalizedText(item.text);
    assert(text.includes(expected.serie), `DOM label ${index + 1} is missing its series`);
    assert(text.includes(expected.sku), `DOM label ${index + 1} is missing its SKU`);
    assert(
      text.includes(expected.cantidad),
      `DOM label ${index + 1} is missing its quantity`,
    );
    assert(
      text.includes(`${expected.tela} - ${expected.color}`.toUpperCase()),
      `DOM label ${index + 1} is missing its title`,
    );
    assert(text.includes(FOOTER), `DOM label ${index + 1} is missing its footer`);
    return { expected, text };
  });
}

function extractPdfPages(pdfPath) {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const infoLines = info.split(/\r?\n/u);
  const field = (name) =>
    infoLines.find((line) => line.startsWith(`${name}:`))?.slice(name.length + 1).trim() ??
    null;
  const pageLine = infoLines.find((line) => line.startsWith("Pages:"));
  if (!pageLine) throw new Error(`pdfinfo did not report a page count for ${pdfPath}`);
  const pageCount = Number(pageLine.slice("Pages:".length).trim());
  if (!Number.isInteger(pageCount)) {
    throw new Error(`Invalid pdfinfo page count: ${pageLine}`);
  }

  const extracted = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
  });
  const pages = extracted.split("\f");
  if (pages.at(-1)?.trim() === "") pages.pop();
  if (pages.length !== pageCount) {
    throw new Error(
      `pdftotext yielded ${pages.length} page segments but pdfinfo reported ${pageCount}`,
    );
  }
  return {
    pageCount,
    pdfMetadata: {
      creator: field("Creator"),
      producer: field("Producer"),
      pageSize: field("Page size"),
      pdfVersion: field("PDF version"),
    },
    pages: pages.map(normalizedText),
  };
}

function assertPdfLabels(pdf, labels) {
  assert.equal(
    pdf.pageCount,
    labels.length,
    `PDF page count must equal label count (${labels.length}), not an extra printer page`,
  );
  assert(pdf.pages[0]?.length > 0, "PDF must not begin with a blank page");
  assert(pdf.pages.at(-1)?.length > 0, "PDF must not end with a blank page");

  for (const [index, label] of labels.entries()) {
    const page = pdf.pages[index];
    assert(page, `missing PDF page ${index + 1}`);
    assert(page.includes(label.serie), `PDF page ${index + 1} has the wrong series`);
    assert(page.includes(label.sku), `PDF page ${index + 1} has the wrong SKU`);
    assert(
      page.includes(`${label.tela} - ${label.color}`.toUpperCase()),
      `PDF page ${index + 1} has the wrong title`,
    );
    assert(
      page.includes(label.cantidad),
      `PDF page ${index + 1} has the wrong quantity`,
    );
    assert(page.includes(FOOTER), `PDF page ${index + 1} has no footer`);

    for (const other of labels) {
      if (other === label) continue;
      assert(
        !page.includes(other.serie),
        `PDF page ${index + 1} contains another label series (${other.serie})`,
      );
    }
  }
}

async function collectLogicalDiagnosis(page) {
  return evaluate(page, function collectPrintDiagnosisInPage() {
    const styleFields = (element) => {
      if (!(element instanceof Element)) return null;
      const style = getComputedStyle(element);
      return {
        ...nodeInfo(element),
        page: style.page,
        display: style.display,
        position: style.position,
        breakBefore: style.breakBefore,
        breakAfter: style.breakAfter,
        breakInside: style.breakInside,
        pageBreakBefore: style.pageBreakBefore,
        pageBreakAfter: style.pageBreakAfter,
        pageBreakInside: style.pageBreakInside,
      };
    };
    const nodeInfo = (element) => ({
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      className:
        typeof element.className === "string" ? element.className : null,
    });
    const ancestors = (element) => {
      const result = [];
      let current = element;
      while (current instanceof Element) {
        result.push(styleFields(current));
        current = current.parentElement;
      }
      return result;
    };
    const printRoot = document.querySelector(".etiquetas-print");
    const labels = Array.from(
      document.querySelectorAll(".etiquetas-print .label-page"),
    );
    return {
      bodyClass: document.body.className,
      bodyChildren: Array.from(document.body.children, styleFields),
      printRoot: printFields(printRoot),
      printRootParent: printRoot ? ancestors(printRoot) : [],
      precedingSibling: printRoot?.previousElementSibling
        ? styleFields(printRoot.previousElementSibling)
        : null,
      labels: labels.map((label, index) => ({
        index,
        text: (label.textContent ?? "").replace(/\s+/gu, " ").trim(),
        ancestors: ancestors(label),
        previousSibling: label.previousElementSibling
          ? styleFields(label.previousElementSibling)
          : null,
      })),
    };

    function printFields(element) {
      return element ? styleFields(element) : null;
    }
  });
}

async function runScenario(browser, fixture, artifactDir) {
  const scenarioName = fixture.id === 9100 ? "baseline-1-label" : "regression-25-labels";
  const expectedLabels = expectedLabelsForFixture(fixture);
  const report = {
    name: scenarioName,
    route: `/entradas/${fixture.id}/etiquetas`,
    expectedLabelCount: expectedLabels.length,
    expectedSeries: expectedLabels.map((label) => label.serie),
    requestedApiPaths: [],
    status: "running",
  };
  const page = await createPage(browser);
  await installApiFixture(page, report.requestedApiPaths);

  try {
    await page.cdp.call(
      "Page.navigate",
      { url: `${APP_URL}${report.route}` },
      page.sessionId,
    );
    await waitForLabels(page, expectedLabels.length);
    report.dom = await captureDomLabels(page, expectedLabels);
    report.printState = await installPrintSignal(page);
    report.printState = {
      ...report.printState,
      ...(await clickPrintSelection(page, expectedLabels.length)),
    };
    report.browserContext = await evaluate(page, function browserContextInPage() {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      };
    });

    report.pdfSettings = {
      paperWidthMm: 100,
      paperHeightMm: 70,
      paperWidthInches: 100 / 25.4,
      paperHeightInches: 70 / 25.4,
      scale: 1,
      marginTopInches: 0,
      marginBottomInches: 0,
      marginLeftInches: 0,
      marginRightInches: 0,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
      driver: "Chromium CDP Page.printToPDF",
    };
    let pdfResult;
    try {
      // printWhenReady has already called the intercepted native print and
      // scheduled its own exact 1,000 ms cleanup. Capture immediately so that
      // the real print state remains active, then restore only window.print.
      pdfResult = await page.cdp.call(
        "Page.printToPDF",
        {
          printBackground: report.pdfSettings.printBackground,
          preferCSSPageSize: report.pdfSettings.preferCSSPageSize,
          displayHeaderFooter: report.pdfSettings.displayHeaderFooter,
          paperWidth: report.pdfSettings.paperWidthInches,
          paperHeight: report.pdfSettings.paperHeightInches,
          scale: report.pdfSettings.scale,
          marginTop: report.pdfSettings.marginTopInches,
          marginBottom: report.pdfSettings.marginBottomInches,
          marginLeft: report.pdfSettings.marginLeftInches,
          marginRight: report.pdfSettings.marginRightInches,
        },
        page.sessionId,
      );
    } finally {
      await restoreNativePrint(page);
    }
    const pdfPath = path.join(artifactDir, `${scenarioName}.pdf`);
    await writeFile(pdfPath, Buffer.from(pdfResult.data, "base64"));
    report.pdfPath = pdfPath;
    report.pdf = extractPdfPages(pdfPath);

    try {
      const allowedApiPaths = new Set([
        "GET /api/auth/me",
        "GET /api/notificaciones/feed",
        `GET /api/inventario/entradas/${fixture.id}`,
      ]);
      const unexpectedApiRequests = report.requestedApiPaths.filter(
        (request) => !allowedApiPaths.has(request),
      );
      if (unexpectedApiRequests.length > 0) {
        throw new HarnessError(
          `The route made API requests without explicit fixtures: ${unexpectedApiRequests.join(", ")}`,
        );
      }
      report.phase = "pdf-assertion";
      assertPdfLabels(report.pdf, expectedLabels);
      report.status = "passed";
    } catch (error) {
      const harnessFailure = error instanceof HarnessError;
      report.status = harnessFailure ? "harness-failed" : "failed";
      report.failureKind = harnessFailure ? "fixture-or-harness" : "pdf-regression";
      report.failure = describeError(error);
      if (!harnessFailure) {
        // Diagnosis is intentionally logical only and is collected only after a
        // real PDF assertion fails: no geometry/height probing can mask the
        // regression or turn a passing run into a speculative diagnosis.
        report.logicalDiagnosis = await collectLogicalDiagnosis(page);
      }
      throw error;
    }
  } catch (error) {
    if (report.status === "running") {
      report.status =
        error instanceof HarnessError || report.phase !== "pdf-assertion"
          ? "harness-failed"
          : "failed";
      report.failureKind =
        report.status === "harness-failed"
          ? "fixture-or-harness"
          : "pdf-regression";
    }
    report.failure ??= describeError(error);
    throw Object.assign(new Error(`${scenarioName}: ${describeError(error)}`), {
      scenarioReport: report,
    });
  } finally {
    await closePage(page);
  }
  return report;
}

function environmentReport(browser) {
  return {
    startedAt: STARTED_AT,
    appUrl: APP_URL,
    os: {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      version: os.version(),
    },
    node: process.version,
    chromium: {
      executable: CHROMIUM_BIN,
      headless: true,
      launchArgs: browser.args,
      cdpVersion: browser.browserVersion,
    },
    pdfCapture: {
      driver: "Chromium DevTools Protocol Page.printToPDF",
      media: "print",
      nativeWindowPrintCalled: false,
      waspDriverTested: false,
      waspDriverDescription:
        process.env.WASP_DRIVER_DESCRIPTION ??
        "Not available in this headless run; Wasp WPL308 native dialog/page-count behavior remains unverified.",
      distinction:
        "This PDF proves Chromium CSS pagination only. It does not prove the Wasp WPL308 native dialog will report the same page count.",
    },
  };
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const report = {
    ...environmentReport({
      args: [],
      browserVersion: null,
    }),
    fixturePolicy:
      "Browser Fetch fixtures only; no DB writes, test users, session creation, or live API calls.",
    scenarios: [],
    status: "running",
  };

  let browser;
  try {
    browser = await launchChromium();
    report.chromium = {
      ...environmentReport(browser).chromium,
      processPid: browser.browserProcess.pid,
    };
    for (const fixture of fixtures) {
      try {
        const scenario = await runScenario(browser, fixture, ARTIFACT_DIR);
        report.scenarios.push(scenario);
      } catch (error) {
        if (error.scenarioReport) report.scenarios.push(error.scenarioReport);
        throw error;
      }
    }
    report.status = "passed";
  } catch (error) {
    const scenarioStatus = error.scenarioReport?.status;
    report.status = scenarioStatus ?? "harness-failed";
    report.failure = describeError(error);
  } finally {
    if (browser) {
      report.chromium.stderrTail = browser.stderr.join("").slice(-4_000);
      await browser.close();
    }
  }

  const reportPath = path.join(ARTIFACT_DIR, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.status,
    reportPath,
    pdfs: report.scenarios.map((scenario) => ({
      name: scenario.name,
      status: scenario.status,
      pageCount: scenario.pdf?.pageCount ?? null,
      expectedLabelCount: scenario.expectedLabelCount,
      pdfPath: scenario.pdfPath ?? null,
    })),
    environment: {
      browser: report.chromium?.cdpVersion?.Browser ?? null,
      os: `${report.os.platform}/${report.os.arch} ${report.os.release}`,
      headless: report.chromium?.headless ?? true,
      pdfDriver: report.pdfCapture.driver,
      waspDriverTested: report.pdfCapture.waspDriverTested,
    },
  }, null, 2));
  if (report.status !== "passed") process.exitCode = 1;
}

await main();