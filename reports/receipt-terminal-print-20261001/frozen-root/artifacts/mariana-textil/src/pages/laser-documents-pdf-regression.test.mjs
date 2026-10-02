#!/usr/bin/env node
/*
 * Read-only Chromium PDF regression for the mounted Salida document route.
 *
 * This harness intercepts the real route's HTTP reads; it does not seed a
 * database, create a user, or replace the React route with a test renderer.
 * It intentionally uses the same fixture module as the other laser-document
 * checks for auth and notifications.  The Salida response below is the full
 * GET /api/salidas/{id}/documento contract and varies only in line count.
 *
 * Run after starting the web workflow:
 *
 *   node artifacts/mariana-textil/src/pages/laser-documents-pdf-regression.test.mjs
 *
 * Optional:
 *   LASER_DOCUMENTS_BASE_URL=http://localhost:80
 *   CHROMIUM_BIN=/repl/tools/bin/chromium
 *   LASER_DOCUMENT_PDF_ARTIFACT_DIR=/tmp/laser-documents-pdf-regression
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { LASER_DOCUMENT_FIXTURES } from "./laser-document-fixtures.mjs";

const APP_URL = (process.env.LASER_DOCUMENTS_BASE_URL ?? "http://localhost:80").replace(
  /\/+$/,
  "",
);
const CHROMIUM_BIN = process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium";
const ARTIFACT_DIR =
  process.env.LASER_DOCUMENT_PDF_ARTIFACT_DIR ??
  path.join(os.tmpdir(), "laser-documents-pdf-regression");
const PRINT_CLASS = "print-salida";
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 148;
const SAFE_MM = 5;
const RASTER_DPI = 96;
const RASTER_TOLERANCE_MM = 0;

const sharedApiResponses = LASER_DOCUMENT_FIXTURES.entrada.count1.apiResponses;
const authFixture = {
  ...sharedApiResponses["GET /api/auth/me"],
  rol: "TERMINAL",
  alcanceConsulta: "PROPIA",
  permisos: [
    {
      modulo: "salidas",
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeAutorizar: false,
    },
  ],
};
const notificationFixture = sharedApiResponses["GET /api/notificaciones/feed"];
const notificationsPanelFixture = {
  notificaciones: [],
  sistema: [],
  porVencer: [],
  vencidas: [],
  clientesConMultiplesVencidas: [],
};
const unreadNotificationsFixture = { count: 0 };

function ordinal(index) {
  return String(index + 1).padStart(2, "0");
}

function salidaLinea(index) {
  const number = ordinal(index);
  return {
    id: 84000 + index,
    productoId: 85000 + index,
    skuProducto: `SKU-SALIDA-${number}`,
    telaProducto: `Tela salida ${number}`,
    colorProducto: index % 2 === 0 ? "Azul salida" : "Rojo salida",
    unidadProducto: "METRO",
    cantidadSolicitada: "1.000",
    cantidadEnviada: "1.000",
    cantidadRecibida: "1.000",
    rollosSolicitados: 1,
    rollosEnviados: 1,
    rollosRecibidos: 1,
    nota: null,
  };
}

function salidaRollo(index, linea) {
  const number = ordinal(index);
  return {
    id: 86000 + index,
    lineaId: linea.id,
    rolloId: 87000 + index,
    serie: `SERIE-SALIDA-${number}`,
    estado: "DISPONIBLE",
    cantidadEnviada: "1.000",
    cantidadRecibida: "1.000",
    recibido: true,
    diferencia: null,
    notaDiferencia: null,
    cantidadActual: "1.000",
    productoId: linea.productoId,
    sku: linea.skuProducto,
    tela: linea.telaProducto,
    color: linea.colorProducto,
    unidad: linea.unidadProducto,
  };
}

function buildSalida(id, count) {
  const lineas = Array.from({ length: count }, (_, index) => salidaLinea(index));
  return {
    id,
    folio: id,
    folioFormateado: `QA-SAL-${id}`,
    modalidad: "TRASLADO",
    estado: "RECIBIDA",
    origenId: 1,
    nombreOrigen: "Sitio origen PDF",
    destinoId: 2,
    nombreDestino: "Sitio destino PDF",
    clienteId: null,
    nombreCliente: null,
    documentoVenta: null,
    autorizada: null,
    armadoPorId: 1,
    nombreArmadoPor: "Usuario PDF fixture",
    fechaArmado: "2026-01-01T12:00:00.000Z",
    totalProductos: count,
    totalCantidadSolicitada: `${count}.000`,
    totalCantidadEnviada: `${count}.000`,
    totalCantidadRecibida: `${count}.000`,
    totalRollos: count,
    totalMetros: `${count}.000`,
    totalKilos: "0.000",
    totalBolsas: "0.000",
    totalPiezas: "0.000",
    usuarioId: 1,
    nombreUsuario: "Usuario PDF fixture",
    transportista: "Transportista PDF fixture",
    observaciones: "Observaciones de safe area PDF",
    diferenciasPendientes: false,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    uuidCliente: `laser-salida-${id}`,
    enviadoPorId: 1,
    nombreEnviadoPor: "Usuario PDF fixture",
    fechaEnvio: "2026-01-01T12:05:00.000Z",
    notaEnvio: null,
    transporteEfectivo: "Transportista PDF fixture",
    viaje: null,
    recibidoPorId: 1,
    nombreRecibidoPor: "Usuario PDF fixture",
    fechaRecepcion: "2026-01-01T12:10:00.000Z",
    notaRecepcion: null,
    canceladoPorId: null,
    nombreCanceladoPor: null,
    fechaCancelacion: null,
    motivoCancelacion: null,
    pisosRetorno: [],
    entregadoPorId: null,
    nombreEntregadoPor: null,
    fechaEntrega: null,
    lineas,
    rollos: lineas.map((linea, index) => salidaRollo(index, linea)),
  };
}

const scenarios = [
  { name: "salida-count-1", id: 84001, count: 1, expectedPageCount: 1 },
  { name: "salida-count-10", id: 84010, count: 10, expectedPageCount: 1 },
  { name: "salida-count-11-boundary", id: 84011, count: 11, expectedPageCount: 2 },
].map((scenario) => ({ ...scenario, fixture: buildSalida(scenario.id, scenario.count) }));

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
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function normalizedText(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
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
            new Error(`${message.error.message ?? "CDP error"} (${message.error.code ?? "unknown"})`),
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
      for (const pending of this.pending.values()) pending.reject(new Error("CDP WebSocket closed"));
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
    const response = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.webSocket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return response;
  }
}

async function connectCdp(wsUrl) {
  const webSocket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${wsUrl}`)), 10_000);
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

export async function launchChromium() {
  const port = await reservePort();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "laser-salida-chromium-"));
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
  const browserProcess = spawn(CHROMIUM_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
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
          if (browserProcess.exitCode !== null) return resolve();
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
    throw new Error(`Could not launch Chromium at ${CHROMIUM_BIN}: ${describeError(error)}\n${stderr.join("")}`);
  }
}

export async function createPage(browser) {
  const target = await browser.cdp.call("Target.createTarget", { url: "about:blank" });
  const attached = await browser.cdp.call("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  const page = {
    sessionId: attached.sessionId,
    targetId: target.targetId,
    cdp: browser.cdp,
  };
  await browser.cdp.call("Page.enable", {}, page.sessionId);
  await browser.cdp.call("Runtime.enable", {}, page.sessionId);
  await browser.cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  }, page.sessionId);
  return page;
}

export async function closePage(page) {
  await page.cdp.call("Target.closeTarget", { targetId: page.targetId });
}

export async function evaluate(page, expression) {
  const result = await page.cdp.call(
    "Runtime.evaluate",
    {
      expression: `(${expression})()`,
      awaitPromise: true,
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

function fixtureForId(id) {
  const scenario = scenarios.find((item) => item.id === id);
  if (!scenario) throw new Error(`No Salida fixture for id ${id}`);
  return scenario.fixture;
}

async function installApiFixture(page, requestedPaths) {
  await page.cdp.call("Fetch.enable", {
    patterns: [{ urlPattern: "*://*/api/*", requestStage: "Request" }],
  }, page.sessionId);
  page.cdp.on("Fetch.requestPaused", async (event) => {
    const url = new URL(event.request.url);
    const pathName = url.pathname;
    requestedPaths.push(`${event.request.method} ${pathName}`);
    try {
      let response;
      if (pathName === "/api/auth/me") {
        response = jsonResponse(authFixture);
      } else if (pathName === "/api/notificaciones/feed") {
        response = jsonResponse(notificationFixture);
      } else if (pathName === "/api/notificaciones") {
        response = jsonResponse(notificationsPanelFixture);
      } else if (pathName === "/api/notificaciones/no-leidas/count") {
        response = jsonResponse(unreadNotificationsFixture);
      } else if (pathName.startsWith("/api/salidas/") && pathName.endsWith("/documento")) {
        response = jsonResponse(fixtureForId(Number(pathName.split("/").at(-2))));
      } else {
        response = jsonResponse({ message: `Unexpected API request: ${pathName}` }, 404);
      }
      await page.cdp.call("Fetch.fulfillRequest", {
        requestId: event.requestId,
        ...response,
      }, page.sessionId);
    } catch (error) {
      try {
        await page.cdp.call("Fetch.failRequest", {
          requestId: event.requestId,
          errorReason: "BlockedByClient",
        }, page.sessionId);
      } catch {
        // The page can close while an intercepted request is being resolved.
      }
      requestedPaths.push(`fixture-error ${describeError(error)}`);
    }
  }, page.sessionId);
}

async function waitForSalida(page, expectedPageCount) {
  const result = await evaluate(page, async function waitForMountedSalida() {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const pages = document.querySelectorAll(".salida-page-print");
      if (pages.length > 0 && document.querySelector('[data-testid="doc-print-button"]')) {
        return {
          pageCount: pages.length,
          lineCount: document.querySelectorAll(".salida-page-print tbody tr").length,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for the mounted Salida document route");
  });
  assert.equal(result.pageCount, expectedPageCount);
  return result;
}

async function installPrintSignal(page) {
  return evaluate(page, function installPrintSignalInPage() {
    window.__laserSalidaOriginalPrint = window.print;
    window.__laserSalidaPrintCalls = 0;
    window.print = () => {
      window.__laserSalidaPrintCalls += 1;
    };
    return true;
  });
}

async function clickPrintButton(page) {
  await evaluate(page, function clickSalidaPrintButton() {
    const button = document.querySelector('[data-testid="doc-print-button"]');
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Could not find the real Salida print button");
    }
    button.click();
  });
  return evaluate(page, async function waitForSalidaPrintSignal() {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (window.__laserSalidaPrintCalls === 1) {
        return {
          printCalls: window.__laserSalidaPrintCalls,
          bodyClass: document.body.className,
          pages: document.querySelectorAll(".salida-page-print").length,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Timed out waiting for printWhenReady to call window.print");
  });
}

async function measureMountedSalida(page) {
  return evaluate(page, function measureSalidaLayout() {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing layout element: ${selector}`);
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    };
    const pageBox = box(".salida-page-print");
    const frameBox = box(".salida-page-frame");
    const headerBox = box(".salida-page-frame .document-header");
    const metadataBox = box(".salida-page-frame .document-metadata");
    const tableBox = box(".salida-page-frame .document-table");
    const footerBox = box(".salida-page-frame .document-footer");
    const rows = Array.from(document.querySelectorAll(".salida-page-frame .document-product-grid tbody tr"))
      .slice(0, 10)
      .map((row) => {
        const rect = row.getBoundingClientRect();
        return { y: rect.y, height: rect.height, bottom: rect.bottom };
      });
    return {
      page: pageBox,
      frame: frameBox,
      header: headerBox,
      metadata: metadataBox,
      table: tableBox,
      footer: footerBox,
      rows,
      frameContentHeight: frameBox.height,
      tableAvailableHeight: footerBox.y - tableBox.y,
      frameInkWithinPage:
        frameBox.x >= pageBox.x &&
        frameBox.y >= pageBox.y &&
        frameBox.right <= pageBox.right &&
        frameBox.bottom <= pageBox.bottom,
    };
  });
}

async function restoreNativePrint(page) {
  await evaluate(page, function restoreSalidaPrint() {
    if (window.__laserSalidaOriginalPrint) window.print = window.__laserSalidaOriginalPrint;
    delete window.__laserSalidaOriginalPrint;
    delete window.__laserSalidaPrintCalls;
  });
}

export function extractPdf(pdfPath, {
  widthMm = PAGE_WIDTH_MM,
  heightMm = PAGE_HEIGHT_MM,
} = {}) {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const pageCount = Number(info.match(/^Pages:\s+(\d+)/mu)?.[1]);
  assert(Number.isInteger(pageCount), `pdfinfo did not report a page count for ${pdfPath}`);
  const pageSize = info.match(/^Page size:\s+(.+)$/mu)?.[1]?.trim() ?? "";
  const pointSize = pageSize.match(/^([\d.]+)\s*x\s*([\d.]+)\s*pts/i);
  const mmSize = pageSize.match(/^([\d.]+)\s*x\s*([\d.]+)\s*mm/i);
  let pageSizePoints;
  if (pointSize) {
    pageSizePoints = {
      width: Number(pointSize[1]),
      height: Number(pointSize[2]),
    };
    assert(Math.abs(pageSizePoints.width - (widthMm / 25.4) * 72) < 0.5);
    assert(Math.abs(pageSizePoints.height - (heightMm / 25.4) * 72) < 0.5);
  } else {
    assert(mmSize, `unexpected PDF page size: ${pageSize}`);
    assert(Math.abs(Number(mmSize[1]) - widthMm) < 0.1);
    assert(Math.abs(Number(mmSize[2]) - heightMm) < 0.1);
    pageSizePoints = {
      width: (Number(mmSize[1]) / 25.4) * 72,
      height: (Number(mmSize[2]) / 25.4) * 72,
    };
  }
  const layout = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  const pages = layout.split("\f");
  if (pages.at(-1)?.trim() === "") pages.pop();
  assert.equal(pages.length, pageCount, "pdftotext page segments must equal pdfinfo");
  const bboxText = execFileSync("pdftotext", ["-bbox", pdfPath, "-"], { encoding: "utf8" });
  const bboxPages = [];
  for (const pageMatch of bboxText.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/gu)) {
    const words = [];
    for (const wordMatch of pageMatch[1].matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/gu)) {
      const attrs = wordMatch[1];
      const text = normalizedText(wordMatch[2].replace(/<[^>]*>/gu, ""));
      const number = (name) => Number(attrs.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1]);
      const word = { text, xMin: number("xMin"), xMax: number("xMax"), yMin: number("yMin"), yMax: number("yMax") };
      if (text && Object.values(word).slice(1).every(Number.isFinite)) words.push(word);
    }
    bboxPages.push(words);
  }
  assert.equal(bboxPages.length, pageCount, "pdftotext bbox pages must equal pdfinfo");
  return {
    pageCount,
    pageSize,
    pageSizePoints,
    pages: pages.map(normalizedText),
    // Kept as a complete diagnostic record. pdftotext's font boxes are not
    // the authoritative rendered-ink bounds (font ascenders can be invisible).
    bboxPages,
    fontBboxPages: bboxPages,
  };
}

function assertPdfText(pdf, fixture, expectedPageCount) {
  assert.equal(pdf.pageCount, expectedPageCount);
  assert(pdf.pages.every((page) => page.length > 0), "PDF must not contain blank pages");
  const linesByPage = Array.from({ length: expectedPageCount }, (_, pageIndex) =>
    fixture.lineas.slice(pageIndex * 10, (pageIndex + 1) * 10),
  );
  for (const [pageIndex, lines] of linesByPage.entries()) {
    const text = pdf.pages[pageIndex];
    assert(text, `missing PDF page ${pageIndex + 1}`);
    for (const line of lines) {
      for (const field of [line.skuProducto, line.telaProducto, line.colorProducto, "1.00"]) {
        assert(text.includes(field), `page ${pageIndex + 1} is missing ${field}`);
      }
    }
    for (const field of ["Observaciones", "Total", "Revisó", "Entregó", "Recibió"]) {
      assert(text.includes(field), `page ${pageIndex + 1} is missing ${field}`);
    }
  }
  const allText = pdf.pages.join(" ");
  assert(allText.includes("Total Mts."), "PDF must print the total metres");
}

export function findRasterTool() {
  for (const candidate of ["convert", "magick"]) {
    try {
      execFileSync("sh", ["-c", `command -v ${candidate}`], { stdio: "ignore" });
      return candidate;
    } catch {
      // Try the next ImageMagick executable.
    }
  }
  return null;
}

function rasterTrim(tool, imagePath) {
  const args = [
    imagePath,
    "-alpha",
    "off",
    "-fuzz",
    "0%",
    "-format",
    "%@",
    "info:",
  ];
  return execFileSync(tool, args, { encoding: "utf8" }).trim();
}

export function assertRasterSafeArea(pdfPath, artifactDir, pageCount, rasterTool, {
  widthMm = PAGE_WIDTH_MM,
  heightMm = PAGE_HEIGHT_MM,
  safeMm = SAFE_MM,
  dpi = RASTER_DPI,
  toleranceMm = RASTER_TOLERANCE_MM,
  pageSizePoints,
} = {}) {
  const rasterPrefix = path.join(artifactDir, path.basename(pdfPath, ".pdf"));
  execFileSync("pdftoppm", [
    "-png",
    "-r",
    String(dpi),
    "-f",
    "1",
    "-l",
    String(pageCount),
    pdfPath,
    rasterPrefix,
  ], { stdio: "ignore" });

  const safePx = (safeMm / 25.4) * dpi;
  const tolerancePx = (toleranceMm / 25.4) * dpi;
  const actualPageSizePoints = pageSizePoints ?? {
    width: (widthMm / 25.4) * 72,
    height: (heightMm / 25.4) * 72,
  };
  const expectedWidth = Math.ceil((actualPageSizePoints.width / 72) * dpi);
  const expectedHeight = Math.ceil((actualPageSizePoints.height / 72) * dpi);
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const imagePath = `${rasterPrefix}-${pageNumber}.png`;
    const dimensions = execFileSync(rasterTool, [
      imagePath,
      "-format",
      "%w %h",
      "info:",
    ], { encoding: "utf8" }).trim().split(/\s+/u).map(Number);
    const [width, height] = dimensions;
    // pdftoppm rounds its raster canvas up from the actual PDF point size;
    // use the measured pdfinfo points rather than nominal CSS millimetres.
    assert.equal(width, expectedWidth);
    assert.equal(height, expectedHeight);
    const bounds = rasterTrim(rasterTool, imagePath);
    const match = bounds.match(/^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/u);
    assert(match, `could not parse raster ink bounds: ${bounds}`);
    const [, rawWidth, rawHeight, rawX, rawY] = match;
    const inkWidth = Number(rawWidth);
    const inkHeight = Number(rawHeight);
    const inkX = Number(rawX);
    const inkY = Number(rawY);
    assert(inkX >= safePx - tolerancePx, `page ${pageNumber} ink starts before 5 mm: ${bounds}`);
    assert(inkY >= safePx - tolerancePx, `page ${pageNumber} ink starts before 5 mm: ${bounds}`);
    assert(inkX + inkWidth <= width - safePx + tolerancePx, `page ${pageNumber} ink ends past 5 mm: ${bounds}`);
    assert(inkY + inkHeight <= height - safePx + tolerancePx, `page ${pageNumber} ink ends past 5 mm: ${bounds}`);
    // A raster canvas is rounded up; its extra fraction of a pixel is not paper.
    const edgeClearanceMm = {
      left: (inkX / dpi) * 25.4,
      top: (inkY / dpi) * 25.4,
      right: actualPageSizePoints.width * 25.4 / 72 - (inkX + inkWidth) * 25.4 / dpi,
      bottom: actualPageSizePoints.height * 25.4 / 72 - (inkY + inkHeight) * 25.4 / dpi,
    };
    for (const [edge, clearance] of Object.entries(edgeClearanceMm)) {
      assert(clearance >= safeMm - toleranceMm, `page ${pageNumber} ${edge} clearance ${clearance} mm is below ${safeMm} mm`);
    }
    pages.push({
      pageNumber,
      imagePath,
      width,
      height,
      inkBoundsPx: { x: inkX, y: inkY, width: inkWidth, height: inkHeight },
      inkBoundsMm: {
        x: (inkX / dpi) * 25.4,
        y: (inkY / dpi) * 25.4,
        width: (inkWidth / dpi) * 25.4,
        height: (inkHeight / dpi) * 25.4,
      },
      borderBandMm: safeMm,
      edgeClearanceMm,
    });
  }
  return {
    dpi,
    widthMm,
    heightMm,
    safeMm,
    toleranceMm,
    pageSizePoints: actualPageSizePoints,
    pages,
  };
}

export function inspectPdfTextBounds(pdf, {
  widthMm = PAGE_WIDTH_MM,
  heightMm = PAGE_HEIGHT_MM,
  safeMm = SAFE_MM,
  toleranceMm = RASTER_TOLERANCE_MM,
} = {}) {
  const safePt = (safeMm / 25.4) * 72;
  const tolerancePt = (toleranceMm / 25.4) * 72;
  const fontBoxOverlaps = [];
  for (const [pageIndex, words] of pdf.bboxPages.entries()) {
    const overlaps = words.filter((word) =>
      word.xMin < safePt - tolerancePt ||
      word.yMin < safePt - tolerancePt ||
      word.xMax > (widthMm / 25.4) * 72 - safePt + tolerancePt ||
      word.yMax > (heightMm / 25.4) * 72 - safePt + tolerancePt,
    );
    fontBoxOverlaps.push({
      pageNumber: pageIndex + 1,
      count: overlaps.length,
      words: overlaps,
    });
  }
  return {
    authority: "diagnostic-only-font-boxes",
    widthMm,
    heightMm,
    safeMm,
    toleranceMm,
    fontBoxOverlaps,
  };
}

// Backwards-compatible name for the other document harness while making the
// non-authoritative nature explicit in its returned diagnostic payload.
export const assertPdfTextSafeArea = inspectPdfTextBounds;

async function runScenario(browser, scenario, rasterTool) {
  const requestedPaths = [];
  const report = {
    name: scenario.name,
    route: `/salidas/${scenario.id}/documento/salida`,
    expectedPageCount: scenario.expectedPageCount,
    requestedPaths,
    pdfSettings: {
      paperWidthMm: PAGE_WIDTH_MM,
      paperHeightMm: PAGE_HEIGHT_MM,
      marginMm: 0,
      scale: 1,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    },
    status: "running",
  };
  const page = await createPage(browser);
  await installApiFixture(page, requestedPaths);
  try {
    await page.cdp.call("Page.navigate", {
      url: `${APP_URL}${report.route}`,
    }, page.sessionId);
    await waitForSalida(page, scenario.expectedPageCount);
    await installPrintSignal(page);
    const printState = await clickPrintButton(page);
    assert.equal(printState.printCalls, 1);
    assert(printState.bodyClass.split(/\s+/u).includes(PRINT_CLASS));
    await page.cdp.call("Emulation.setEmulatedMedia", { media: "print" }, page.sessionId);
    report.layoutMeasurement = await measureMountedSalida(page);
    assert(report.layoutMeasurement.frameInkWithinPage, "the inner frame must stay inside the padded page box");
    assert.equal(report.layoutMeasurement.rows.length, 10);
    assert(
      report.layoutMeasurement.rows.every((row) =>
        row.bottom <= report.layoutMeasurement.footer.y + 0.5,
      ),
      "the measured ten-row table must finish before the indivisible footer",
    );

    const pdfResult = await page.cdp.call("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      paperWidth: PAGE_WIDTH_MM / 25.4,
      paperHeight: PAGE_HEIGHT_MM / 25.4,
      scale: 1,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
    }, page.sessionId);
    await restoreNativePrint(page);
    const pdfPath = path.join(ARTIFACT_DIR, `${scenario.name}.pdf`);
    await writeFile(pdfPath, Buffer.from(pdfResult.data, "base64"));
    report.pdfPath = pdfPath;
    report.pdf = extractPdf(pdfPath);
    assertPdfText(report.pdf, scenario.fixture, scenario.expectedPageCount);
    report.fontBoxDiagnostics = inspectPdfTextBounds(report.pdf);
    report.raster = assertRasterSafeArea(
      pdfPath,
      ARTIFACT_DIR,
      scenario.expectedPageCount,
      rasterTool,
      { pageSizePoints: report.pdf.pageSizePoints },
    );
    const allowed = new Set([
      "GET /api/auth/me",
      "GET /api/notificaciones/feed",
      "GET /api/notificaciones",
      "GET /api/notificaciones/no-leidas/count",
      `GET /api/salidas/${scenario.id}/documento`,
    ]);
    assert.deepEqual(
      requestedPaths.filter((item) => !allowed.has(item)),
      [],
      "the mounted route must not make an unfixed API request",
    );
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = describeError(error);
    const scenarioError = error instanceof Error ? error : new Error(String(error));
    scenarioError.scenarioReport = report;
    throw scenarioError;
  } finally {
    await closePage(page);
  }
  return report;
}

async function main() {
  const rasterTool = findRasterTool();
  if (!rasterTool) {
    throw new Error(
      "ImageMagick is required for raster safe-area assertions; install convert/magick and rerun: node artifacts/mariana-textil/src/pages/laser-documents-pdf-regression.test.mjs",
    );
  }
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await launchChromium();
  const report = {
    status: "running",
    fixturePolicy: "Read-only browser Fetch fixtures; no DB writes, seeds, users, or live API calls.",
    scenarios: [],
    browser: {
      executable: CHROMIUM_BIN,
      version: browser.browserVersion,
      launchArgs: browser.args,
    },
  };
  try {
    for (const scenario of scenarios) {
      try {
        report.scenarios.push(await runScenario(browser, scenario, rasterTool));
      } catch (error) {
        if (error?.scenarioReport) report.scenarios.push(error.scenarioReport);
        throw error;
      }
    }
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = describeError(error);
  } finally {
    report.browser.stderrTail = browser.stderr.join("").slice(-4_000);
    await browser.close();
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
      pdfPath: scenario.pdfPath ?? null,
    })),
  }, null, 2));
  if (report.status !== "passed") process.exitCode = 1;
}

/*
 * Keep the regression executable while making its browser/PDF primitives
 * reusable by the other laser-document harness. Importing this module must
 * never launch Chromium or touch the filesystem.
 */
export { extractPdf as extractPdfPages };

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) await main();