#!/usr/bin/env node

/**
 * Prompt L stop-gate verifier.
 *
 * This is intentionally an isolated read-only harness.  It reads the live
 * catalog through DATABASE_URL, then mounts the production LabelPrint module
 * in a disposable browser document with the compiled application stylesheet.
 * It does not import the API server (whose startup initializers are writes),
 * does not create a user/session, and never writes to PostgreSQL.
 */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { access, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workspaceRoot = resolve(new URL("../..", import.meta.url).pathname);
const appRoot = join(workspaceRoot, "artifacts", "mariana-textil");
const reportRoot = join(workspaceRoot, "reports", "prompt-l");
const cssPath = join(appRoot, "dist", "public", "assets", "index-CTwFjwBL.css");
const expectedProducts = 1234;
const expectedPrices = 1016;
const approvedProductsHash = "9b5a7bfb4133c1c700f9d242628c0c46";
const approvedPricesHash = "64f5ec3242e70cdfe37e1a242c26b506";
const quantity = "35.000";
const dpi = 96;
const mmPerPx = 25.4 / dpi;

const requireFromApiServer = createRequire(
  new URL("../../artifacts/api-server/package.json", import.meta.url),
);
const { build } = requireFromApiServer("esbuild");

function fail(message) {
  throw new Error(message);
}

function assertDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is required; refusing to fall back to another database.");
  }
}

async function readDatabase() {
  assertDatabaseUrl();
  const requireFromDb = createRequire(
    new URL("../../lib/db/package.json", import.meta.url),
  );
  const { Client } = requireFromDb("pg");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  let transactionOpen = false;
  try {
    // A read-only repeatable-read transaction makes the export one coherent
    // snapshot and independently protects this verifier from accidental SQL.
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;

    const identity = (
      await client.query(`
        SELECT
          current_database() AS database_name,
          current_schema() AS schema_name,
          current_setting('server_version') AS server_version,
          current_setting('transaction_isolation') AS transaction_isolation,
          current_setting('transaction_read_only') AS transaction_read_only
      `)
    ).rows[0];

    const productRows = (
      await client.query(`
        SELECT *
        FROM public.productos
        ORDER BY id
      `)
    ).rows;

    const productSummary = (
      await client.query(`
        SELECT
          count(*)::text AS count,
          md5(
            COALESCE(
              string_agg(
                md5(to_jsonb(t)::text),
                '' ORDER BY to_jsonb(t)::text, md5(to_jsonb(t)::text)
              ),
              ''
            )
          ) AS ordered_canonical_row_hash
        FROM public.productos AS t
      `)
    ).rows[0];

    const priceSummary = (
      await client.query(`
        SELECT
          count(*)::text AS count,
          md5(
            COALESCE(
              string_agg(
                md5(to_jsonb(t)::text),
                '' ORDER BY to_jsonb(t)::text, md5(to_jsonb(t)::text)
              ),
              ''
            )
          ) AS ordered_canonical_row_hash
        FROM public.precio_historial AS t
      `)
    ).rows[0];

    const inventorySummary = (
      await client.query(`
        SELECT
          (SELECT count(*)::text FROM public.rollos) AS rollos,
          (
            SELECT count(*)::text
            FROM public.rollos
            WHERE serie IS NOT NULL AND btrim(serie) <> ''
          ) AS assigned_series,
          (
            SELECT count(*)::text
            FROM public.rollos
            WHERE serie IS NULL OR btrim(serie) = ''
          ) AS null_or_empty_series,
          (
            SELECT count(*)::text
            FROM (
              SELECT serie
              FROM public.rollos
              WHERE serie IS NOT NULL AND btrim(serie) <> ''
              GROUP BY serie
              HAVING count(*) > 1
            ) AS duplicates
          ) AS duplicate_series_groups
      `)
    ).rows[0];

    const seriesSummary = (
      await client.query(`
        SELECT
          count(*)::text AS row_count,
          min(ultimo_numero)::text AS min_ultimo_numero,
          max(ultimo_numero)::text AS max_ultimo_numero
        FROM public.series_consecutivo
      `)
    ).rows[0];

    const seriesColumns = (
      await client.query(`
        SELECT
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'series_consecutivo'
        ORDER BY ordinal_position
      `)
    ).rows;

    const colors = (
      await client.query(`
        SELECT
          count(*)::text AS total_count,
          count(*) FILTER (WHERE color IS NOT NULL AND btrim(color) <> '')::text
            AS non_null_non_empty_color_count,
          count(DISTINCT btrim(color))
            FILTER (WHERE color IS NOT NULL AND btrim(color) <> '')::text
            AS distinct_non_empty_color_count,
          count(*) FILTER (WHERE color_hex IS NOT NULL AND btrim(color_hex) <> '')::text
            AS non_null_non_empty_color_hex_count
        FROM public.productos
      `)
    ).rows[0];

    const gate = {
      readOnlyTransaction: identity.transaction_read_only === "on",
      zeroRollos: inventorySummary.rollos === "0",
      zeroAssignedSeries: inventorySummary.assigned_series === "0",
      noDuplicateAssignedSeries: inventorySummary.duplicate_series_groups === "0",
      productsMatchApprovedSnapshot:
        productSummary.count === String(expectedProducts) &&
        productSummary.ordered_canonical_row_hash === approvedProductsHash,
      pricesMatchApprovedSnapshot:
        priceSummary.count === String(expectedPrices) &&
        priceSummary.ordered_canonical_row_hash === approvedPricesHash,
    };
    gate.pass = Object.values(gate).every(Boolean);

    if (!gate.pass) {
      return {
        identity,
        productRows,
        productSummary,
        priceSummary,
        inventorySummary,
        seriesSummary,
        seriesColumns,
        colors,
        gate,
      };
    }

    return {
      identity,
      productRows,
      productSummary,
      priceSummary,
      inventorySummary,
      seriesSummary,
      seriesColumns,
      colors,
      gate,
    };
  } finally {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    await client.end();
  }
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

async function buildBrowserBundles(tempDir) {
  const labelEntry = join(tempDir, "label-entry.tsx");
  const labelBundle = join(tempDir, "label-entry.js");
  const decoderEntry = join(tempDir, "decoder-entry.ts");
  const decoderBundle = join(tempDir, "decoder-entry.js");
  const labelSourcePath = join(appRoot, "src", "components", "label-print.tsx");

  await writeFile(
    labelEntry,
    `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { LabelPrint } from ${JSON.stringify(labelSourcePath)};

      const printRoot = document.getElementById("print-root");
      if (!printRoot) throw new Error("isolated print root is missing");
      const root = createRoot(printRoot);

      window.mountLabelCatalog = (products, series) => {
        root.render(
          React.createElement(
            React.Fragment,
            null,
            products.map((product, index) =>
              React.createElement(LabelPrint, {
                key: product.id,
                className: "catalog-label",
                data: {
                  sku: product.sku,
                  serie: series,
                  tela: product.tela,
                  color: product.color,
                  cantidad: ${JSON.stringify(quantity)},
                  unidad: product.unidad,
                },
              }),
            ),
          ),
        );
      };
    `,
    "utf8",
  );

  await writeFile(
    decoderEntry,
    `
      import { BrowserQRCodeReader } from "@zxing/browser";
      import {
        BinaryBitmap,
        DecodeHintType,
        HybridBinarizer,
        QRCodeReader,
        RGBLuminanceSource,
      } from "@zxing/library";
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserQRCodeReader(hints);
      const pureHints = new Map();
      pureHints.set(DecodeHintType.PURE_BARCODE, true);
      pureHints.set(DecodeHintType.TRY_HARDER, true);
      const pureReader = new QRCodeReader();
      const decodeSvg = async (svgText) => {
        const parsed = new DOMParser().parseFromString(
          svgText,
          "image/svg+xml",
        );
        const svg = parsed.documentElement;
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const viewBox = (svg.getAttribute("viewBox") || "")
          .trim()
          .split(/\s+/)
          .map(Number);
        const matrixSize = Number.isFinite(viewBox[2]) ? viewBox[2] : 33;
        const pixelSize = matrixSize * 16;
        svg.setAttribute("width", String(pixelSize));
        svg.setAttribute("height", String(pixelSize));
        svg.removeAttribute("style");
        svg.setAttribute("style", "width:" + pixelSize + "px;height:" + pixelSize + "px");
        const normalizedSvg = new XMLSerializer().serializeToString(svg);
        const image = new Image();
        const objectUrl = URL.createObjectURL(
          new Blob([normalizedSvg], { type: "image/svg+xml" }),
        );
        image.src = objectUrl;
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error("source image cannot be decoded."));
        });
        URL.revokeObjectURL(objectUrl);
        const errors = [];
        for (const scale of [8, 12, 16, 24, 32]) {
          const size = matrixSize * scale;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) throw new Error("2D canvas context unavailable");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, size, size);
          context.imageSmoothingEnabled = false;
          context.drawImage(image, 0, 0, size, size);
          try {
            return reader.decodeFromCanvas(canvas).getText();
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
            try {
              const rgba = context.getImageData(0, 0, size, size).data;
              const luminances = new Uint8ClampedArray(size * size);
              for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel++) {
                luminances[pixel] =
                  (rgba[index] * 299 +
                    rgba[index + 1] * 587 +
                    rgba[index + 2] * 114) /
                  1000;
              }
              const source = new RGBLuminanceSource(luminances, size, size);
              const bitmap = new BinaryBitmap(new HybridBinarizer(source));
              return pureReader.decode(bitmap, pureHints).getText();
            } catch (pureError) {
              errors.push(
                pureError instanceof Error
                  ? pureError.message
                  : String(pureError),
              );
            }
          }
        }
        throw new Error(
          errors.join(" | ") +
            " [matrix=" +
            matrixSize +
            ",natural=" +
            image.naturalWidth +
            "x" +
            image.naturalHeight +
            "]",
        );
      };
      window.decodeLabelQr = decodeSvg;
    `,
    "utf8",
  );

  const aliasPlugin = {
    name: "prompt-l-mariana-ts-path-alias",
    setup(esbuild) {
      esbuild.onResolve({ filter: /^@\// }, async (args) => {
        const basePath = resolve(appRoot, "src", args.path.slice(2));
        for (const extension of ["", ".tsx", ".ts", ".jsx", ".js", ".png", ".jpg", ".jpeg", ".svg"]) {
          try {
            await access(`${basePath}${extension}`);
            return { path: `${basePath}${extension}` };
          } catch {
            // Keep looking for the source extension used by the real Vite alias.
          }
        }
        return { path: basePath };
      });
    },
  };

  await build({
    entryPoints: [labelEntry],
    outfile: labelBundle,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    logLevel: "silent",
    absWorkingDir: appRoot,
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl", ".svg": "dataurl" },
    plugins: [aliasPlugin],
  });

  await build({
    entryPoints: [decoderEntry],
    outfile: decoderBundle,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    logLevel: "silent",
    absWorkingDir: appRoot,
    plugins: [],
  });

  return {
    labelBundle: await readFile(labelBundle, "utf8"),
    decoderBundle: await readFile(decoderBundle, "utf8"),
  };
}

async function resolvePlaywrightCore() {
  if (process.env.PLAYWRIGHT_CORE_PATH) {
    return process.env.PLAYWRIGHT_CORE_PATH;
  }
  const linksDir = join(workspaceRoot, ".cache", "ms-playwright", ".links");
  const linkNames = ["f09aa759359698e2cf78febfa0b0f27cab61e50c", "f1b0773f1dc67e80ded6f5b2710f17d2a7d05c31"];
  for (const name of linkNames) {
    try {
      return (await readFile(join(linksDir, name), "utf8")).trim();
    } catch {
      // Try the next known package link.
    }
  }
  fail("playwright-core is not available through the existing package links.");
}

async function resolveBrowserExecutable() {
  const candidates = [
    "/repl/tools/bin/chromium",
    join(
      workspaceRoot,
      ".cache",
      "ms-playwright",
      "chromium-1187",
      "chrome-linux",
      "chrome",
    ),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next existing browser binary.
    }
  }
  fail("The existing Playwright Chromium executable is unavailable.");
}

function pxToMm(value) {
  return value * mmPerPx;
}

function issueKey(issue) {
  return `${issue.productId}:${issue.kind}`;
}

async function inspectCatalog(page, products, series) {
  const expected = products.map((product) => ({
    id: product.id,
    sku: product.sku,
    tela: product.tela,
    color: product.color,
    unidad: product.unidad,
    productName: `${product.tela} - ${product.color}`.toUpperCase(),
    quantity,
    qrPayload: `${product.sku}-${series}`,
  }));

  await page.evaluate(
    async ({ rows, targetSeries }) => {
      window.mountLabelCatalog(rows, targetSeries);
      await document.fonts?.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve()),
        ),
      );
      window.dispatchEvent(new Event("beforeprint"));
      await new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve()),
        ),
      );
    },
    { rows: products, targetSeries: series },
  );

  return page.evaluate(
    ({ expectedRows, targetSeries, physical }) => {
      const rangeWidth = (element) => {
        const textNode = element?.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;
        const range = document.createRange();
        range.selectNodeContents(textNode);
        return range.getBoundingClientRect().width;
      };
      const rect = (element) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          x: Number(box.x.toFixed(3)),
          y: Number(box.y.toFixed(3)),
          width: Number(box.width.toFixed(3)),
          height: Number(box.height.toFixed(3)),
          widthMm: Number((box.width * physical.mmPerPx).toFixed(3)),
          heightMm: Number((box.height * physical.mmPerPx).toFixed(3)),
        };
      };
      const autoFitInfo = (element) => {
        if (!element) return null;
        const text = element.querySelector("span");
        return {
          text: element.textContent?.trim() ?? "",
          fitState: element.dataset.fitState ?? null,
          fontStep: element.dataset.fontStep
            ? Number(element.dataset.fontStep)
            : null,
          textWidth: element.dataset.textWidth
            ? Number(element.dataset.textWidth)
            : null,
          availableWidth: element.dataset.availableWidth
            ? Number(element.dataset.availableWidth)
            : null,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          textBoundingWidth: rangeWidth(text),
          rect: rect(element),
        };
      };
      const fieldIssue = (product, kind, field, expectedText) => {
        if (!field) {
          return {
            productId: product.id,
            sku: product.sku,
            kind,
            reason: "missing-field",
            expected: expectedText,
          };
        }
        const actual = field.textContent?.trim() ?? "";
        if (actual !== expectedText) {
          return {
            productId: product.id,
            sku: product.sku,
            kind,
            reason: "text-mismatch",
            expected: expectedText,
            actual,
            geometry: autoFitInfo(field),
          };
        }
        if (field.dataset.fitState !== "fits") {
          return {
            productId: product.id,
            sku: product.sku,
            kind,
            reason: "autofit-overflow",
            expected: expectedText,
            actual,
            geometry: autoFitInfo(field),
          };
        }
        return null;
      };

      const labels = [...document.querySelectorAll(".label-page")];
      const measurements = [];
      const overflows = [];
      const fontFamilies = new Set();
      for (const [index, label] of labels.entries()) {
        const product = expectedRows[index];
        if (!product) {
          overflows.push({
            productId: null,
            kind: "unexpected-label",
            reason: "more-labels-than-catalog",
            index,
          });
          continue;
        }
        const nameField = label.querySelector('[data-testid="label-product-name"]');
        const skuField = label.querySelector('[data-testid="label-sku"]');
        const quantityField = label.querySelector('[data-testid="label-quantity"]');
        const payloadField = label.querySelector('[data-testid="label-qr-payload"]');
        const nameSpan = nameField?.querySelector("span");
        const computed = getComputedStyle(label);
        fontFamilies.add(computed.fontFamily);

        const seriesCaption = [...label.querySelectorAll("div")].find(
          (element) =>
            element.children.length === 0 &&
            element.textContent?.trim() === "NO. DE SERIE",
        );
        const seriesField = seriesCaption?.nextElementSibling;
        const seriesActual = seriesField?.textContent?.trim() ?? "";
        const seriesGeometry = seriesField
          ? {
              text: seriesActual,
              clientWidth: seriesField.clientWidth,
              scrollWidth: seriesField.scrollWidth,
              textBoundingWidth: rangeWidth(seriesField),
              rect: rect(seriesField),
              overflow:
                seriesField.scrollWidth > seriesField.clientWidth + 0.5 ||
                rangeWidth(seriesField) > seriesField.clientWidth + 0.5,
            }
          : null;
        if (!seriesGeometry) {
          overflows.push({
            productId: product.id,
            sku: product.sku,
            kind: "series",
            reason: "missing-field",
            expected: targetSeries,
          });
        } else if (seriesActual !== targetSeries) {
          overflows.push({
            productId: product.id,
            sku: product.sku,
            kind: "series",
            reason: "text-mismatch",
            expected: targetSeries,
            actual: seriesActual,
            geometry: seriesGeometry,
          });
        } else if (seriesGeometry.overflow) {
          overflows.push({
            productId: product.id,
            sku: product.sku,
            kind: "series",
            reason: "scroll-or-text-bounds-overflow",
            expected: targetSeries,
            actual: seriesActual,
            geometry: seriesGeometry,
          });
        }

        const fieldChecks = [
          ["product-name", nameField, product.productName],
          ["sku", skuField, product.sku],
          ["quantity", quantityField, product.quantity],
          ["qr-payload", payloadField, product.qrPayload],
        ];
        for (const [kind, field, expectedText] of fieldChecks) {
          const issue = fieldIssue(product, kind, field, expectedText);
          if (issue) overflows.push(issue);
        }

        const nameActual = nameSpan?.textContent ?? "";
        if (nameActual !== product.productName) {
          overflows.push({
            productId: product.id,
            sku: product.sku,
            kind: "product-name",
            reason: "full-product-color-mismatch",
            expected: product.productName,
            actual: nameActual,
          });
        }

        const qrSvg = label.querySelector("svg");
        const qrRect = rect(qrSvg);
        const qrMmError = qrRect
          ? Math.max(
              Math.abs(qrRect.widthMm - physical.expectedQrMm),
              Math.abs(qrRect.heightMm - physical.expectedQrMm),
            )
          : Number.POSITIVE_INFINITY;
        if (!qrSvg || qrMmError > physical.qrToleranceMm) {
          overflows.push({
            productId: product.id,
            sku: product.sku,
            kind: "qr-size",
            reason: qrSvg ? "qr-size-not-29mm" : "missing-qr",
            expectedMm: physical.expectedQrMm,
            actual: qrRect,
            toleranceMm: physical.qrToleranceMm,
          });
        }

        const labelRect = rect(label);
        if (
          !labelRect ||
          Math.abs(labelRect.widthMm - physical.expectedLabelWidthMm) >
            physical.labelToleranceMm ||
          Math.abs(labelRect.heightMm - physical.expectedLabelHeightMm) >
            physical.labelToleranceMm
        ) {
          overflows.push({
            productId: product.id,
            sku: product.sku,
            kind: "label-size",
            reason: "label-physical-size-not-100x70mm",
            expectedMm: {
              width: physical.expectedLabelWidthMm,
              height: physical.expectedLabelHeightMm,
            },
            actual: labelRect,
            toleranceMm: physical.labelToleranceMm,
          });
        }

        if (label.scrollWidth > label.clientWidth + 0.5) {
          overflows.push({
            productId: product.id,
            sku: product.sku,
            kind: "label-root",
            reason: "label-scroll-width-overflow",
            clientWidth: label.clientWidth,
            scrollWidth: label.scrollWidth,
          });
        }

        measurements.push({
          productId: product.id,
          sku: product.sku,
          productName: nameActual,
          expectedProductName: product.productName,
          series: seriesGeometry,
          productNameFit: autoFitInfo(nameField),
          skuFit: autoFitInfo(skuField),
          quantityFit: autoFitInfo(quantityField),
          qrPayloadFit: autoFitInfo(payloadField),
          qr: {
            rect: qrRect,
            widthAttribute: qrSvg?.getAttribute("width") ?? null,
            heightAttribute: qrSvg?.getAttribute("height") ?? null,
            viewBox: qrSvg?.getAttribute("viewBox") ?? null,
          },
          label: labelRect,
        });
      }

      return {
        targetSeries,
        labelCount: labels.length,
        measurements,
        overflows,
        fontFamilies: [...fontFamilies],
        printMedia: matchMedia("print").matches,
        bodyClass: document.body.className,
        fontsStatus: document.fonts?.status ?? "unavailable",
      };
    },
    {
      expectedRows: expected,
      targetSeries: series,
      physical: {
        mmPerPx,
        expectedLabelWidthMm: 100,
        expectedLabelHeightMm: 70,
        expectedQrMm: 29,
        labelToleranceMm: 0.35,
        qrToleranceMm: 0.35,
      },
    },
  );
}

async function decodeAllQrs(page, products, series) {
  const expected = products.map((product) => `${product.sku}-${series}`);
  const result = await page.evaluate(
    async (expectedPayloads) => {
      const svgs = [...document.querySelectorAll(".label-page svg")];
      const decoded = [];
      const mismatches = [];
      for (let index = 0; index < svgs.length; index++) {
        try {
          const value = await window.decodeLabelQr(svgs[index].outerHTML);
          decoded.push(value);
          if (value !== expectedPayloads[index]) {
            mismatches.push({
              index,
              expected: expectedPayloads[index],
              actual: value,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          decoded.push(null);
          mismatches.push({
            index,
            expected: expectedPayloads[index],
            actual: null,
            error: message,
          });
        }
      }
      return {
        attempted: svgs.length,
        decodedExact: decoded.filter(
          (value, index) => value === expectedPayloads[index],
        ).length,
        mismatches,
      };
    },
    expected,
  );
  return {
    ...result,
    expectedCount: products.length,
    series,
    decoder: "@zxing/browser BrowserQRCodeReader",
  };
}

function summarizeRun(run) {
  const byKind = {};
  for (const issue of run.overflows) {
    byKind[issue.kind] = (byKind[issue.kind] ?? 0) + 1;
  }
  const count = (predicate) => run.measurements.filter(predicate).length;
  const finite = (values) => values.filter(Number.isFinite);
  const seriesTextWidths = finite(
    run.measurements.map((measurement) => measurement.series?.textBoundingWidth),
  );
  const seriesClientWidths = finite(
    run.measurements.map((measurement) => measurement.series?.clientWidth),
  );
  return {
    targetSeries: run.targetSeries,
    catalogCount: run.labelCount,
    overflowCount: run.overflows.length,
    overflowsByKind: byKind,
    overflowList: run.overflows,
    fontFamilies: run.fontFamilies,
    printMedia: run.printMedia,
    bodyClass: run.bodyClass,
    fontsStatus: run.fontsStatus,
    conformanceCounts: {
      productNameFullColorExact: count(
        (measurement) =>
          measurement.productName ===
          measurement.expectedProductName,
      ),
      autoFit: {
        productNameMeasured: count(
          (measurement) => measurement.productNameFit?.fitState !== null,
        ),
        productNameFits: count(
          (measurement) => measurement.productNameFit?.fitState === "fits",
        ),
        skuMeasured: count(
          (measurement) => measurement.skuFit?.fitState !== null,
        ),
        skuFits: count(
          (measurement) => measurement.skuFit?.fitState === "fits",
        ),
        quantityMeasured: count(
          (measurement) => measurement.quantityFit?.fitState !== null,
        ),
        quantityFits: count(
          (measurement) => measurement.quantityFit?.fitState === "fits",
        ),
        qrPayloadMeasured: count(
          (measurement) => measurement.qrPayloadFit?.fitState !== null,
        ),
        qrPayloadFits: count(
          (measurement) => measurement.qrPayloadFit?.fitState === "fits",
        ),
      },
      series: {
        textExact: count(
          (measurement) => measurement.series?.text === run.targetSeries,
        ),
        scrollWidthAtMostClientWidth: count(
          (measurement) =>
            measurement.series &&
            measurement.series.scrollWidth <= measurement.series.clientWidth + 0.5,
        ),
        textBoundingAtMostClientWidth: count(
          (measurement) =>
            measurement.series &&
            measurement.series.textBoundingWidth <= measurement.series.clientWidth + 0.5,
        ),
        minClientWidth: seriesClientWidths.length
          ? Math.min(...seriesClientWidths)
          : null,
        maxTextBoundingWidth: seriesTextWidths.length
          ? Math.max(...seriesTextWidths)
          : null,
      },
      qrPhysicalSize29mm: count(
        (measurement) =>
          measurement.qr.rect &&
          Math.abs(measurement.qr.rect.widthMm - 29) <= 0.35 &&
          Math.abs(measurement.qr.rect.heightMm - 29) <= 0.35,
      ),
      labelPhysicalSize100x70mm: count(
        (measurement) =>
          measurement.label &&
          Math.abs(measurement.label.widthMm - 100) <= 0.35 &&
          Math.abs(measurement.label.heightMm - 70) <= 0.35,
      ),
    },
    representativeGeometry: run.measurements.slice(0, 3),
  };
}

function compareIssues(oldRun, newRun) {
  const oldKeys = new Set(oldRun.overflows.map(issueKey));
  const newKeys = new Set(newRun.overflows.map(issueKey));
  const introduced = newRun.overflows.filter((issue) => !oldKeys.has(issueKey(issue)));
  const preexisting = oldRun.overflows;
  return {
    preexisting7OverflowCount: preexisting.length,
    preexisting7OverflowList: preexisting,
    eightDigitOverflowCount: newRun.overflows.length,
    eightDigitOverflowList: newRun.overflows,
    introducedByEightDigitCount: introduced.length,
    introducedByEightDigitList: introduced,
  };
}

async function saveProblemScreenshots(page, run, prefix) {
  if (!run.overflows.length) return [];
  const saved = [];
  const seen = new Set();
  for (const issue of run.overflows) {
    if (issue.productId == null || seen.has(issue.productId)) continue;
    seen.add(issue.productId);
    const index = run.measurements.findIndex(
      (measurement) => measurement.productId === issue.productId,
    );
    if (index < 0) continue;
    const path = join(
      reportRoot,
      `${prefix}-product-${issue.productId}-${issue.kind}.jpg`,
    );
    await page.locator(".label-page").nth(index).screenshot({ path, type: "jpeg" });
    saved.push(path.replace(`${workspaceRoot}/`, ""));
  }
  return saved;
}

async function writeGateReports(database) {
  const dbReport = {
    report: "prompt-l/read-only-live-catalog-export",
    generatedBy: "scripts/src/prompt-l-label-fit-verifier.mjs",
    source: {
      connectionVariable: "DATABASE_URL",
      credentialsOmitted: true,
      apiServerStarted: false,
      apiServerImported: false,
      authUsersSessionsRead: false,
      transaction: "REPEATABLE READ READ ONLY",
    },
    identity: database.identity,
    sourceCounts: {
      rollos: database.inventorySummary.rollos,
      assignedSeries: database.inventorySummary.assigned_series,
      products: database.productSummary.count,
      priceHistory: database.priceSummary.count,
    },
    sourceHashes: {
      products: database.productSummary.ordered_canonical_row_hash,
      priceHistory: database.priceSummary.ordered_canonical_row_hash,
    },
    gate: database.gate,
  };
  await writeFile(
    join(reportRoot, "live-catalog-readonly-gate.json"),
    JSON.stringify(dbReport, null, 2) + "\n",
    "utf8",
  );
  return dbReport;
}

async function main() {
  await access(reportRoot);
  const database = await readDatabase();
  await writeGateReports(database);
  if (!database.gate.pass) {
    const blocked = {
      report: "prompt-l/full-catalog-label-fit",
      status: "BLOCKED_READONLY_SOURCE_GATE",
      reason: "The live catalog/rollos gate did not match the approved read-only source.",
      gate: database.gate,
    };
    await writeFile(
      join(reportRoot, "full-catalog-label-fit.json"),
      JSON.stringify(blocked, null, 2) + "\n",
      "utf8",
    );
    await writeFile(
      join(reportRoot, "full-catalog-label-fit.md"),
      [
        "# Prompt L full-catalog label fit",
        "",
        "**Status: BLOCKED_READONLY_SOURCE_GATE.** No browser render was started.",
        "",
        "The live source catalog or rollos gate differed from the approved read-only source. No production code or database mutation was attempted.",
        "",
        "```json",
        JSON.stringify(database.gate, null, 2),
        "```",
        "",
      ].join("\n"),
      "utf8",
    );
    fail("STOP: read-only source gate failed; no label render was attempted.");
  }

  const exportPayload = {
    report: "prompt-l/full-products-export",
    generatedBy: "scripts/src/prompt-l-label-fit-verifier.mjs",
    source: {
      connectionVariable: "DATABASE_URL",
      credentialsOmitted: true,
      transaction: "REPEATABLE READ READ ONLY",
      table: "public.productos",
      query: "SELECT * FROM public.productos ORDER BY id",
    },
    count: database.productRows.length,
    orderedCanonicalRowHash: database.productSummary.ordered_canonical_row_hash,
    products: jsonSafe(database.productRows),
  };
  await writeFile(
    join(reportRoot, "full-products-readonly-export.json"),
    JSON.stringify(exportPayload, null, 2) + "\n",
    "utf8",
  );

  const css = await readFile(cssPath, "utf8");
  const cssHash = createHash("sha256").update(css).digest("hex");
  const tempDir = await mkdtemp(join(appRoot, ".prompt-l-render-"));
  let browser;
  try {
    const bundles = await buildBrowserBundles(tempDir);
    const playwrightCorePath = await resolvePlaywrightCore();
    const playwright = await import(
      pathToFileURL(join(playwrightCorePath, "index.mjs")).href
    );
    const executablePath = await resolveBrowserExecutable();
    browser = await playwright.chromium.launch({
      executablePath,
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    await page.setContent(
      "<!doctype html><html><head><meta charset=\"utf-8\"><title>Prompt L isolated LabelPrint renderer</title></head><body><div id=\"root\"></div><div id=\"print-root\" class=\"print-only etiquetas-print\"></div></body></html>",
      { waitUntil: "load" },
    );
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundles.labelBundle });
    await page.addScriptTag({ content: bundles.decoderBundle });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.body.classList.add("printing-labels"));

    const products = database.productRows.map((row) => ({
      id: Number(row.id),
      sku: String(row.sku),
      tela: String(row.tela),
      color: String(row.color),
      unidad: String(row.unidad),
    }));

    const baseline7 = await inspectCatalog(page, products, "9999999");
    const baselineScreenshots = await saveProblemScreenshots(page, baseline7, "baseline-7");
    const candidate8Min = await inspectCatalog(page, products, "10000001");
    const candidateScreenshots = await saveProblemScreenshots(page, candidate8Min, "candidate-8-min");
    const candidate8Max = await inspectCatalog(page, products, "99999999");
    const candidateMaxScreenshots = await saveProblemScreenshots(page, candidate8Max, "candidate-8-max");
    const qrDecode = await decodeAllQrs(page, products, "99999999");

    const comparisonMin = compareIssues(baseline7, candidate8Min);
    const comparisonMax = compareIssues(baseline7, candidate8Max);
    const sourceGateStatus = "PASS_READONLY_SOURCE_GATE";
    const introducedOverflow =
      comparisonMin.introducedByEightDigitCount > 0 ||
      comparisonMax.introducedByEightDigitCount > 0;
    const qrPass =
      qrDecode.attempted === products.length &&
      qrDecode.decodedExact === products.length;
    const status = introducedOverflow
      ? "BLOCKED_STOP_8_DIGIT_INTRODUCED_OVERFLOW"
      : qrPass
        ? "PASS_RENDERED_CATALOG_GATE"
        : "BLOCKED_QR_DECODE_INCOMPLETE";

    const report = {
      report: "prompt-l/full-catalog-label-fit",
      status,
      stopGate: {
        sourceGateStatus,
        productionCodeChanged: false,
        databaseMutationAttempted: false,
        apiServerRestarted: false,
        authUsersSessionsAccessed: false,
      },
      source: {
        connectionVariable: "DATABASE_URL",
        credentialsOmitted: true,
        liveProductsCount: products.length,
        liveProductsHash: database.productSummary.ordered_canonical_row_hash,
        approvedProductsHash,
        livePricesCount: database.priceSummary.count,
        livePricesHash: database.priceSummary.ordered_canonical_row_hash,
        approvedPricesHash,
        liveRollosCount: database.inventorySummary.rollos,
        liveAssignedSeriesCount: database.inventorySummary.assigned_series,
      },
      render: {
        component: "artifacts/mariana-textil/src/components/label-print.tsx",
        logo: "artifacts/mariana-textil/src/assets/mariana-textil-logo-monochrome.png",
        stylesheet: "artifacts/mariana-textil/dist/public/assets/index-CTwFjwBL.css",
        stylesheetSha256: cssHash,
        browser: {
          engine: "Chromium",
          playwrightCoreVersion: playwrightCorePath.includes("1.55.0")
            ? "1.55.0"
            : "existing-playwright-core",
        },
        media: "print",
        bodyClass: "printing-labels",
        labelSizeMm: { width: 100, height: 70 },
        qrSizeMm: 29,
        qrErrorToleranceMm: 0.35,
        quantity,
        minimumFontSteps: {
          productNamePx: 14,
          skuPx: 6,
          quantityPx: 13,
          qrPayloadPx: 4,
        },
      },
      catalogCount: products.length,
      baseline7: summarizeRun(baseline7),
      candidate8Min: summarizeRun(candidate8Min),
      candidate8Max: summarizeRun(candidate8Max),
      comparison: {
        minSeries: comparisonMin,
        maxSeries: comparisonMax,
      },
      qrDecode,
      screenshots: [
        ...baselineScreenshots,
        ...candidateScreenshots,
        ...candidateMaxScreenshots,
      ],
      physicalScan: "PENDING: screen/DOM/ZXing verification does not accredit a physical printer, pistol, or phone-camera scan.",
    };
    const candidate8MaxSummary = report.candidate8Max;

    await writeFile(
      join(reportRoot, "full-catalog-label-fit.json"),
      JSON.stringify(report, null, 2) + "\n",
      "utf8",
    );

    const md = [
      "# Prompt L — Full-catalog LabelPrint stop-gate",
      "",
      `**Status: ${status}.**`,
      "",
      `- Live catalog: **${products.length} products**; products hash ${database.productSummary.ordered_canonical_row_hash} (approved ${approvedProductsHash}).`,
      `- Live price history: **${database.priceSummary.count} rows**; hash ${database.priceSummary.ordered_canonical_row_hash} (approved ${approvedPricesHash}).`,
      `- Live rollos: **${database.inventorySummary.rollos}**; assigned series: **${database.inventorySummary.assigned_series}**.`,
      "- Source gate: **PASS_READONLY_SOURCE_GATE**; export used the default `DATABASE_URL` in a `REPEATABLE READ READ ONLY` transaction.",
      "- API server was not imported, restarted, or used; no users or sessions were read.",
      "",
      "## Exact mounted renderer",
      "",
      "- Real component: `artifacts/mariana-textil/src/components/label-print.tsx`.",
      "- Real monochrome logo import and compiled application CSS were used; no lookalike CSS or logo was substituted.",
      "- Browser used `print` media plus `body.printing-labels`, after `document.fonts.ready`, two frames, `beforeprint`, and two more frames.",
      "- Label geometry target: 100 × 70 mm; QR target: 29 × 29 mm; quantity: `35.000`.",
      "",
      "## Full-catalog geometry",
      "",
      `- Seven-digit baseline (` + "`9999999`" + `): ${baseline7.labelCount}/${products.length} labels; overflows: **${baseline7.overflows.length}**.`,
      `- Eight-digit minimum (` + "`10000001`" + `): ${candidate8Min.labelCount}/${products.length} labels; overflows: **${candidate8Min.overflows.length}**.`,
      `- Eight-digit maximum (` + "`99999999`" + `): ${candidate8Max.labelCount}/${products.length} labels; overflows: **${candidate8Max.overflows.length}**.`,
      `- Introduced by eight digits (minimum): **${comparisonMin.introducedByEightDigitCount}**.`,
      `- Introduced by eight digits (maximum): **${comparisonMax.introducedByEightDigitCount}**.`,
      `- Eight-digit maximum full tela+color product text exact: **${candidate8MaxSummary.conformanceCounts.productNameFullColorExact}/${products.length}**.`,
      `- Eight-digit maximum AutoFit: product name **${candidate8MaxSummary.conformanceCounts.autoFit.productNameFits}/${products.length}**, SKU **${candidate8MaxSummary.conformanceCounts.autoFit.skuFits}/${products.length}**, quantity **${candidate8MaxSummary.conformanceCounts.autoFit.quantityFits}/${products.length}**, QR payload **${candidate8MaxSummary.conformanceCounts.autoFit.qrPayloadFits}/${products.length}**.`,
      `- Eight-digit maximum series exact: **${candidate8MaxSummary.conformanceCounts.series.textExact}/${products.length}**; scrollWidth ≤ clientWidth **${candidate8MaxSummary.conformanceCounts.series.scrollWidthAtMostClientWidth}/${products.length}**; text bounding width ≤ clientWidth **${candidate8MaxSummary.conformanceCounts.series.textBoundingAtMostClientWidth}/${products.length}**.`,
      `- Eight-digit maximum physical boxes: labels 100×70 mm **${candidate8MaxSummary.conformanceCounts.labelPhysicalSize100x70mm}/${products.length}**; QR 29×29 mm **${candidate8MaxSummary.conformanceCounts.qrPhysicalSize29mm}/${products.length}**.`,
      "",
      "Existing seven-digit overflow is reported as evidence and was not fixed here. Any eight-digit introduced overflow is a stop condition before production code or the authorized counter update.",
      "",
      "## QR proof",
      "",
      `- ZXing decoder: ${qrDecode.decoder}.`,
      `- Rendered eight-digit maximum SVGs decoded exactly: **${qrDecode.decodedExact}/${qrDecode.attempted}**.`,
      "- Expected payload for every row was exactly `SKU-SERIE`.",
      "",
      "## Physical limitation",
      "",
      "Physical printer output and scans with the warehouse pistol and phone camera remain **PENDING**; digital DOM geometry and ZXing decoding do not accredit a physical scan.",
      "",
      "Full JSON evidence is in `reports/prompt-l/full-catalog-label-fit.json`; the read-only product export is `reports/prompt-l/full-products-readonly-export.json`.",
      "",
    ].join("\n");
    await writeFile(join(reportRoot, "full-catalog-label-fit.md"), md, "utf8");
    console.log(
      JSON.stringify({
        status,
        catalogCount: products.length,
        baseline7Overflow: baseline7.overflows.length,
        candidate8MinOverflow: candidate8Min.overflows.length,
        candidate8MaxOverflow: candidate8Max.overflows.length,
        introducedMin: comparisonMin.introducedByEightDigitCount,
        introducedMax: comparisonMax.introducedByEightDigitCount,
        qrDecodedExact: `${qrDecode.decodedExact}/${qrDecode.attempted}`,
      }),
    );
  } finally {
    if (browser) await browser.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  try {
    await writeFile(
      join(reportRoot, "full-catalog-label-fit.md"),
      [
        "# Prompt L — Full-catalog LabelPrint stop-gate",
        "",
        "**Status: BLOCKED_VERIFIER_ERROR.**",
        "",
        "The isolated verifier stopped without production code or database mutation.",
        "",
        "```text",
        message,
        "```",
        "",
      ].join("\n"),
      "utf8",
    );
  } catch {
    // Preserve the original verifier error if report output itself is unavailable.
  }
  console.error(message);
  process.exitCode = 1;
});