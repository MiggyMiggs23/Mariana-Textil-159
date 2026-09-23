#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(appRoot, "../..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const cssPath = resolve(option("--css", join(appRoot, "src/index.css")));
const outputRoot = resolve(
  option("--output", join(workspaceRoot, ".local/prompt-t-verification")),
);
const chromium = option("--chromium", "/repl/tools/bin/chromium");
const expectedPageCounts = [2, 3, 5];
const scenarios = [
  {
    id: "compacto",
    description: "nombres de producto compactos de una línea",
  },
  {
    id: "descripcion",
    description: "descripciones textiles reales que envuelven naturalmente",
  },
];
const workRoot = await mkdtemp(join(tmpdir(), "prompt-t-audit-print-"));
const harnessRoot = join(workRoot, "harness");
const distRoot = join(workRoot, "dist");

await mkdir(harnessRoot, { recursive: true });
await mkdir(outputRoot, { recursive: true });
await symlink(join(appRoot, "node_modules"), join(harnessRoot, "node_modules"));
await cp(cssPath, join(harnessRoot, "index.css"));

const componentPath = join(
  appRoot,
  "src/components/auditoria-inventario-print.tsx",
).replaceAll("\\", "/");
const reactPath = fileURLToPath(import.meta.resolve("react"));
const reactJsxRuntimePath = fileURLToPath(
  import.meta.resolve("react/jsx-runtime"),
);
const reactDomClientPath = fileURLToPath(
  import.meta.resolve("react-dom/client"),
);

await writeFile(
  join(harnessRoot, "index.html"),
  '<!doctype html><html><head><meta charset="UTF-8"></head><body class="print-auditoria-inventario"><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>',
);
await writeFile(
  join(harnessRoot, "entry.tsx"),
  `
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AuditoriaInventarioPrint } from ${JSON.stringify(componentPath)};

const count = Number(new URLSearchParams(location.search).get("rows") ?? "1");
const mode = new URLSearchParams(location.search).get("mode") ?? "compacto";
const resultados = Array.from({ length: count }, (_, index) => {
  const ordinal = String(index + 1).padStart(4, "0");
  return {
    serie: "SERIE" + ordinal,
    clasificacion: "CUADRO",
    rolloId: index + 1,
    producto: mode === "compacto"
      ? "Gabardina azul marino MARCA" + ordinal
      : "Lona impermeable para exterior color azul marino, acabado reforzado, lote MARCA" + ordinal,
    cantidad: "25.500",
    unidad: "METRO",
    ubicacionActualId: 1,
    ubicacionActual: "Tienda Mariana",
    pisoEsperadoId: null,
    pisoEsperado: null,
    pisoRealId: null,
    pisoReal: null,
    estadoActual: "DISPONIBLE",
    resolucion: "PENDIENTE",
    escaneadoAt: null,
  };
});

createRoot(document.getElementById("root")!).render(
  <AuditoriaInventarioPrint detail={{
    id: 917,
    folioFormateado: "AUD-00917",
    nombreUbicacion: "Tienda Mariana",
    estado: "CERRADA",
    abiertaAt: "2026-01-15T14:00:00.000Z",
    cerradaAt: "2026-01-15T15:05:00.000Z",
    totalSnapshot: count,
    totalEscaneados: count,
    cuadros: count,
    faltantes: 0,
    sobrantes: 0,
    malAcomodados: 0,
    resultados,
    participantes: [{
      usuarioId: 1,
      nombre: "Responsable de inventario",
      escaneos: count,
      primeroAt: "2026-01-15T14:00:00.000Z",
      ultimoAt: "2026-01-15T15:00:00.000Z",
    }],
  }} />,
);
`,
);

await build({
  configFile: false,
  root: harnessRoot,
  base: "./",
  logLevel: "error",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: join(appRoot, "src") },
      { find: /^react$/, replacement: reactPath },
      { find: /^react\/jsx-runtime$/, replacement: reactJsxRuntimePath },
      { find: /^react-dom\/client$/, replacement: reactDomClientPath },
    ],
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: distRoot,
    emptyOutDir: true,
    rollupOptions: { input: join(harnessRoot, "index.html") },
  },
});

function pdfPages(pdfPath) {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const match = /^Pages:\s+(\d+)$/m.exec(info);
  assert(match, `pdfinfo did not report pages for ${pdfPath}`);
  return Number(match[1]);
}

function printPdf(rows, pdfPath, mode) {
  const profile = join(workRoot, `profile-${mode}-${rows}-${Date.now()}`);
  execFileSync(
    chromium,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--allow-file-access-from-files",
      `--user-data-dir=${profile}`,
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      `file://${join(distRoot, "index.html")}?rows=${rows}&mode=${mode}`,
    ],
    { stdio: "ignore", timeout: 60_000 },
  );
}

async function locateFixtureSize(targetPages, lowerBound, mode) {
  let low = lowerBound;
  let high = 300;
  let lastMatch = null;
  while (low <= high) {
    const rows = Math.floor((low + high) / 2);
    const candidate = join(
      workRoot,
      `candidate-${mode}-${targetPages}-${rows}.pdf`,
    );
    printPdf(rows, candidate, mode);
    const pages = pdfPages(candidate);
    if (pages === targetPages) {
      if (lastMatch) await rm(lastMatch.candidate, { force: true });
      lastMatch = { rows, candidate };
      low = rows + 1;
    } else if (pages < targetPages) {
      await rm(candidate, { force: true });
      low = rows + 1;
    } else {
      await rm(candidate, { force: true });
      high = rows - 1;
    }
  }
  if (lastMatch) return lastMatch;
  throw new Error(`No ${mode} fixture produced ${targetPages} pages.`);
}

function pagesByEmbeddedMarker(bboxXml, pattern) {
  const result = new Map();
  const pages = [...bboxXml.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)];
  pages.forEach((page, pageIndex) => {
    for (const match of page[1].matchAll(pattern)) {
      const occurrences = result.get(match[0]) ?? [];
      occurrences.push(pageIndex + 1);
      result.set(match[0], occurrences);
    }
  });
  return result;
}

async function verifyPdf(pdfPath, rows, expectedPages) {
  assert.equal(pdfPages(pdfPath), expectedPages);
  const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
  });
  assert.equal(
    (text.match(/Mariana Textil · Auditoría de Inventario/g) ?? []).length,
    1,
    "the document header must occur exactly once",
  );

  const bboxPath = `${pdfPath}.bbox.html`;
  execFileSync("pdftotext", ["-bbox-layout", pdfPath, bboxPath]);
  const bbox = await readFile(bboxPath, "utf8");
  const seriesPages = pagesByEmbeddedMarker(bbox, /SERIE\d{4}/g);
  const markerPages = pagesByEmbeddedMarker(bbox, /MARCA\d{4}/g);

  for (let index = 1; index <= rows; index += 1) {
    const ordinal = String(index).padStart(4, "0");
    assert.deepEqual(
      seriesPages.get(`SERIE${ordinal}`),
      markerPages.get(`MARCA${ordinal}`),
      `row ${ordinal} was fragmented across a page edge`,
    );
    assert.equal(
      seriesPages.get(`SERIE${ordinal}`)?.length,
      1,
      `row ${ordinal} must occur exactly once`,
    );
  }

  const textPages = text.split("\f");
  const leftSignaturePage = textPages.findIndex((page) =>
    page.includes("Responsable de conteo"),
  );
  const rightSignaturePage = textPages.findIndex((page) =>
    page.includes("Autorización ADMIN"),
  );
  assert.notEqual(leftSignaturePage, -1, "left signature must be complete");
  assert.equal(
    rightSignaturePage,
    leftSignaturePage,
    "both complete signatures must stay on the same page",
  );

  const pageDimensions = [
    ...bbox.matchAll(
      /<page\b[^>]*width="([0-9.]+)" height="([0-9.]+)"/g,
    ),
  ];
  assert.equal(pageDimensions.length, expectedPages);
  for (const [, width, height] of pageDimensions) {
    assert(Math.abs(Number(width) - 612) < 1, "paper width must remain Letter");
    assert(Math.abs(Number(height) - 792) < 1, "paper height must remain Letter");
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  cssPath,
  componentPath,
  browser: execFileSync(chromium, ["--version"], { encoding: "utf8" }).trim(),
  cases: [],
};

try {
  for (const scenario of scenarios) {
    let lowerBound = 1;
    for (const targetPages of expectedPageCounts) {
      const found = await locateFixtureSize(
        targetPages,
        lowerBound,
        scenario.id,
      );
      const destination = join(
        outputRoot,
        `auditoria-${scenario.id}-${targetPages}-paginas-${found.rows}-renglones.pdf`,
      );
      await cp(found.candidate, destination);
      await verifyPdf(destination, found.rows, targetPages);
      report.cases.push({
        scenario: scenario.id,
        description: scenario.description,
        expectedPages: targetPages,
        rows: found.rows,
        pdf: destination,
        status: "PASS",
      });
      lowerBound = found.rows + 1;
    }
  }
  await writeFile(
    join(outputRoot, "auditoria-print-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await rm(workRoot, { recursive: true, force: true });
}