import { PassThrough } from "node:stream";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { loadRenderTestModule } from "../render-test-bundle";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiServerRoot = resolve(frontendRoot, "../api-server");
const workspaceRoot = resolve(frontendRoot, "../..");
const requireFromApiServer = createRequire(
  join(apiServerRoot, "package.json"),
);
const requireFromDbPackage = createRequire(
  join(workspaceRoot, "lib/db/package.json"),
);
const { Workbook } = requireFromApiServer("exceljs") as {
  Workbook: new () => {
    xlsx: { load(data: Buffer): Promise<void> };
    getWorksheet(id: number): {
      getRow(number: number): { values: unknown[] };
      getColumn(number: number): { values: unknown[] };
      rowCount: number;
    } | undefined;
  };
};

type ExportRouter = {
  stack: Array<{
    route?: {
      path: string;
      stack: Array<{ handle: ExportHandler }>;
    };
  }>;
};

type ExportHandler = (
  request: Record<string, unknown>,
  response: Record<string, unknown>,
  next: (error?: unknown) => void,
) => Promise<void> | void;

type RenderedExports = {
  buildAnaliticaClientesWorkbook: (
    rows: Array<Record<string, unknown>>,
    scope: Record<string, unknown>,
  ) => {
    xlsx: { write(stream: PassThrough): Promise<void> };
  };
  adminAnalyticsRouter: ExportRouter;
};

function rowValues(values: unknown[]) {
  // ExcelJS stores worksheet cells as one-based arrays.
  return values.slice(1);
}

function textFromPlainPdf(pdf: Buffer) {
  // The production corte exporter uses createTextPdf, whose visible text
  // streams are deliberately uncompressed. This reads the produced PDF bytes;
  // it does not duplicate any export labels as test expectations.
  return Array.from(
    pdf.toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g),
    (match) => match[1]!
      .replaceAll("\\(", "(")
      .replaceAll("\\)", ")")
      .replaceAll("\\\\", "\\"),
  ).join("\n");
}

function routeHandler(router: ExportRouter, path: string) {
  const route = router.stack.find((layer) => layer.route?.path === path)?.route;
  const handler = route?.stack.at(-1)?.handle;
  if (!handler) throw new Error(`No se encontró el handler de exportación ${path}.`);
  return handler;
}

async function invokeExport(
  handler: ExportHandler,
  params: Record<string, string>,
): Promise<Buffer> {
  const body = new PassThrough();
  const chunks: Buffer[] = [];
  body.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
  const finished = once(body, "finish");
  let forwardedError: unknown;
  let response: Record<string, unknown>;
  response = Object.assign(body, {
    type: () => response,
    attachment: () => response,
    setHeader: () => response,
    status: () => response,
    json: (value: unknown) => {
      body.end(Buffer.from(JSON.stringify(value)));
      return response;
    },
    send: (value: Buffer | string) => {
      body.end(value);
      return response;
    },
  }) as unknown as Record<string, unknown>;

  // This invokes only the selected business handler. It intentionally does not
  // run router authentication middleware, create a session, or create a user.
  await handler(
    {
      params,
      query: {},
      user: { id: 91, nombre: "Fixture de exportación", rol: "ADMIN" },
    },
    response,
    (error?: unknown) => { forwardedError = error; },
  );
  if (forwardedError) throw forwardedError;
  if (!body.writableEnded) {
    throw new Error("El handler de exportación no terminó la respuesta.");
  }
  await finished;
  return Buffer.concat(chunks);
}

async function loadFixtureExports(): Promise<RenderedExports> {
  const fixtureDirectory = await mkdtemp(
    join(frontendRoot, ".profit-export-output-"),
  );
  const dbFixture = join(fixtureDirectory, "db-fixture.ts");
  const locksFixture = join(fixtureDirectory, "locks-fixture.ts");
  try {
    await Promise.all([
      writeFile(
        dbFixture,
        `
          export * from ${JSON.stringify(join(workspaceRoot, "lib/db/src/schema/index.ts"))};

          const paidRows = [{
            ticketId: 501, folio: "501", formaPago: "EFECTIVO",
            importe: "1500", facturado: false, subtotal: "1500", iva: "0",
            total: "1500", estado: "VENDIDO",
          }];
          const session = {
            id: 77, ubicacionId: 1, nombreUbicacion: "Tienda fixture",
            usuarioId: 91, nombreUsuario: "Fixture de exportación",
            abiertaAt: new Date("2025-01-15T08:00:00.000Z"),
            cerradaAt: new Date("2025-01-15T18:00:00.000Z"),
            fechaOperativa: "2025-01-15", cerradaPorId: null,
            fondoInicial: "0", efectivoContado: "1500", estado: "CERRADA",
          };
          function fixtureRows(selection: Record<string, unknown>) {
            const keys = Object.keys(selection);
            if (keys.includes("nombreUbicacion") && keys.includes("fondoInicial")) return [session];
            if (keys.includes("formaPago") && keys.includes("ticketId")) return paidRows;
            return [];
          }
          function chain(rows: unknown[]) {
            const query = {
              from: () => query, innerJoin: () => query, leftJoin: () => query,
              where: () => query, limit: () => query, orderBy: () => query,
              groupBy: () => query,
              then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(rows).then(resolve, reject),
            };
            return query;
          }
          export const db = { select: (selection: Record<string, unknown>) => chain(fixtureRows(selection)) };
          export const pool = {
            query: async () => ({
              rows: [{ costo: "900", margen: "600", subtotal: "1500", excluidas: 0 }],
            }),
          };
        `,
        "utf8",
      ),
      writeFile(
        locksFixture,
        `
          export const ADVISORY_LOCK_NAMESPACES = {};
          export async function transactionAdvisoryLock() {}
        `,
        "utf8",
      ),
    ]);
    return await loadRenderTestModule(
      `
        import { buildAnaliticaClientesWorkbook } from "../../api-server/src/routes/clientes";
        import adminAnalyticsRouter from "../../api-server/src/routes/admin-analytics";
        export { buildAnaliticaClientesWorkbook, adminAnalyticsRouter };
      `,
      {
        moduleAliases: {
          "@workspace/db": dbFixture,
          "@workspace/db/advisory-locks": locksFixture,
          "@workspace/db/schema": join(workspaceRoot, "lib/db/src/schema/index.ts"),
        },
        externalModuleAliases: {
          // The renderer normally externalizes bare imports for frontend
          // packages. These are backend-only route dependencies, so resolve
          // them from the API package without touching its database module.
          // Keeping them external also preserves CommonJS dynamic requires
          // such as Express -> body-parser under the canonical ESM test runner.
          "express": requireFromApiServer.resolve("express"),
          "exceljs": requireFromApiServer.resolve("exceljs"),
          "drizzle-orm": requireFromApiServer.resolve("drizzle-orm"),
          "drizzle-orm/pg-core": requireFromApiServer.resolve("drizzle-orm/pg-core"),
          "drizzle-zod": requireFromDbPackage.resolve("drizzle-zod"),
          "pdfkit": requireFromApiServer.resolve("pdfkit"),
        },
      },
    ) as RenderedExports;
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
}

export async function readProfitExportOutput(): Promise<{
  customerHeaders: string[];
  customerRows: unknown[][];
  cutXlsxLabels: string[];
  cutPdfText: string;
}> {
  const {
    buildAnaliticaClientesWorkbook,
    adminAnalyticsRouter,
  } = await loadFixtureExports();

  const customerWorkbook = buildAnaliticaClientesWorkbook(
    [{
      cliente: "Cliente fixture",
      folio: 501,
      fecha: "2025-01-15T12:00:00.000Z",
      subtotal: "1500",
      tipo: "NORMAL",
      unidad: "METRO",
      cantidad: "6",
      margen: "600",
    }],
    {
      tipo: "GLOBAL",
      ubicaciones: [],
      generadoEn: "2025-01-15T12:00:00.000Z",
      saldoAFavorDisponible: true,
    },
  );
  const customerBytes = new PassThrough();
  const customerChunks: Buffer[] = [];
  customerBytes.on("data", (chunk: Buffer | string) =>
    customerChunks.push(Buffer.from(chunk)));
  const customerFinished = once(customerBytes, "finish");
  await customerWorkbook.xlsx.write(customerBytes);
  customerBytes.end();
  await customerFinished;

  const parsedCustomerWorkbook = new Workbook();
  await parsedCustomerWorkbook.xlsx.load(Buffer.concat(customerChunks));
  const customerSheet = parsedCustomerWorkbook.getWorksheet(1);
  if (!customerSheet) throw new Error("El XLSX de clientes no incluyó la hoja Analítica.");

  const [cutXlsx, cutPdf] = await Promise.all([
    invokeExport(
      routeHandler(adminAnalyticsRouter, "/admin/cortes/:id/export.xlsx"),
      { id: "77" },
    ),
    invokeExport(
      routeHandler(adminAnalyticsRouter, "/admin/cortes/:id/export.pdf"),
      { id: "77" },
    ),
  ]);
  const parsedCutWorkbook = new Workbook();
  await parsedCutWorkbook.xlsx.load(cutXlsx);
  const cutSheet = parsedCutWorkbook.getWorksheet(1);
  if (!cutSheet) throw new Error("El XLSX de corte no incluyó la hoja Corte.");

  return {
    customerHeaders: rowValues(customerSheet.getRow(1).values).map(String),
    customerRows: Array.from(
      { length: Math.max(0, customerSheet.rowCount - 1) },
      (_, index) => rowValues(customerSheet.getRow(index + 2).values),
    ),
    cutXlsxLabels: cutSheet.getColumn(1).values.slice(2).map(String),
    cutPdfText: textFromPlainPdf(cutPdf),
  };
}