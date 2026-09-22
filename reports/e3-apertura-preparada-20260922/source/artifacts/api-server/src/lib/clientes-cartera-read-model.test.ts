import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { projectCreditLedger } from "./credit-allocation";
import {
  CarteraScopeError,
  loadClientesCartera,
  type CarteraReadDatabase,
} from "./clientes-cartera-read-model";
import {
  renderClientesCarteraPdf,
  renderClientesCarteraXlsx,
} from "./clientes-cartera-export";
import { resolveReadScope } from "../routes/inventario";

const auth = (overrides: Record<string, unknown> = {}) => ({
  sessionId: "readonly-test",
  location: null,
  user: {
    id: 1,
    rol: "ADMIN",
    alcanceConsulta: "TODAS",
    ubicacionId: null,
    ...overrides,
  },
}) as any;

const ledgers = new Map([
  [1, projectCreditLedger([
    {
      id: 101,
      ticketId: 1001,
      tipo: "VENTA_CREDITO" as const,
      importe: "100.00",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      fechaVencimiento: "2026-01-10",
      folio: 1,
    },
    {
      id: 102,
      ticketId: 1002,
      tipo: "VENTA_CREDITO" as const,
      importe: "50.00",
      createdAt: new Date("2026-01-02T12:00:00Z"),
      fechaVencimiento: "2026-01-12",
      folio: 2,
    },
    {
      id: 103,
      ticketId: null,
      tipo: "ABONO" as const,
      importe: "-50.00",
      createdAt: new Date("2026-01-03T12:00:00Z"),
    },
  ])],
  [2, projectCreditLedger([
    {
      id: 201,
      ticketId: null,
      tipo: "ABONO" as const,
      importe: "-999.99",
      createdAt: new Date("2026-01-01T12:00:00Z"),
    },
  ])],
  [99, projectCreditLedger([
    {
      id: 991,
      ticketId: 1991,
      tipo: "VENTA_CREDITO" as const,
      importe: "25.00",
      createdAt: new Date("2026-01-01T12:00:00Z"),
    },
  ])],
]);

function database(): CarteraReadDatabase {
  return {
    async query<T>(text: string, values: readonly unknown[] = []) {
      if (text.includes("FROM ubicaciones")) {
        const ids = (values[0] as number[] | undefined) ?? [];
        return {
          rows: ids
            .filter((id) => id === 1 || id === 2)
            .map((id) => ({ id, nombre: id === 1 ? "Sitio Norte" : "Sitio Sur" })) as T[],
        };
      }
      if (text.includes("DISTINCT m.id,m.cliente_id")) {
        const ids = (values[0] as number[] | undefined) ?? [];
        return {
          rows: (ids.includes(1)
            ? [{ id: 101, cliente_id: 1 }]
            : [])
            .concat(ids.includes(2) ? [{ id: 102, cliente_id: 1 }] : []) as T[],
        };
      }
      if (text.includes("FROM clientes")) {
        return {
          rows: [
            { id: 1, nombre: "Cliente Norte", es_sistema: false },
            { id: 2, nombre: "Cliente Favor", es_sistema: false },
            { id: 99, nombre: "Sistema", es_sistema: true },
          ].filter((row) => {
            const ids = values[0] as number[] | undefined;
            return ids == null || ids.includes(row.id);
          }) as T[],
        };
      }
      throw new Error(`Unexpected read-only query: ${text}`);
    },
  };
}

const dependencies = {
  database: database(),
  resolveReadScope,
  now: () => new Date("2026-01-20T12:00:00.000Z"),
  loadProjections: async (ids: number[]) =>
    new Map(ids.map((id) => [id, ledgers.get(id)!])),
};

test("global read preserves legacy active/system and nonzero-debt behavior", async () => {
  const result = await loadClientesCartera(auth(), {}, dependencies);
  assert.deepEqual(result.resumen, {
    totalClientes: 3,
    clientesConSaldo: 2,
    totalCartera: "125.00",
    totalVencido: "100.00",
  });
  assert.deepEqual(result.clientes.map(({ id, nombre, saldo, saldoAFavor }) => ({
    id, nombre, saldo, saldoAFavor,
  })), [
    { id: 1, nombre: "Cliente Norte", saldo: "100.00", saldoAFavor: "0.00" },
  ]);
  assert.equal(result.alcance.tipo, "GLOBAL");
  assert.equal(result.alcance.saldoAFavorDisponible, true);
});

test("scope guards reject conflicts, arrays, blanks, zero, and missing assignment", async () => {
  for (const query of [
    { ubicacionId: "1", ubicacionIds: "1,2" },
    { ubicacionId: ["1"] },
    { ubicacionIds: "" },
    { ubicacionIds: "1,,2" },
    { ubicacionIds: "0" },
  ]) {
    await assert.rejects(
      loadClientesCartera(auth(), query, dependencies),
      (error: unknown) => error instanceof CarteraScopeError && error.status === 400,
    );
  }
  await assert.rejects(
    loadClientesCartera(
      auth({ rol: "CAJA", alcanceConsulta: "TODAS", ubicacionId: null }),
      {},
      dependencies,
    ),
    (error: unknown) => error instanceof CarteraScopeError && error.status === 403,
  );
});

test("single and multi-site reads use actual resolver and reject outside/unknown sites", async () => {
  const own = await loadClientesCartera(
    auth({ rol: "CAJA", alcanceConsulta: "TODAS", ubicacionId: 1 }),
    { ubicacionId: "1" },
    dependencies,
  );
  assert.equal(own.alcance.tipo, "SITIOS");
  assert.deepEqual(own.alcance.ubicaciones.map(({ id }) => id), [1]);
  assert.equal(own.resumen.totalClientes, 1);
  assert.equal(own.clientes[0]?.saldo, "50.00");
  assert.equal(own.clientes[0]?.saldoAFavor, null);

  await assert.rejects(
    loadClientesCartera(
      auth({ rol: "CAJA", alcanceConsulta: "TODAS", ubicacionId: 1 }),
      { ubicacionIds: "1,2" },
      dependencies,
    ),
    (error: unknown) => error instanceof CarteraScopeError && error.status === 403,
  );
  const multi = await loadClientesCartera(
    auth(),
    { ubicacionIds: "1,2" },
    dependencies,
  );
  assert.deepEqual(multi.alcance.ubicaciones.map(({ id }) => id), [1, 2]);
  assert.equal(multi.clientes[0]?.saldo, "100.00");
  await assert.rejects(
    loadClientesCartera(auth(), { ubicacionId: "77" }, dependencies),
    (error: unknown) => error instanceof CarteraScopeError && error.status === 400,
  );
});

test("scoped JSON and real XLSX/PDF bytes contain no favor leak and mark attribution", async () => {
  const result = await loadClientesCartera(auth(), { ubicacionId: "1" }, dependencies);
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /999\.99/);
  assert.equal(result.alcance.saldoAFavorDisponible, false);
  assert.ok(result.clientes.every((client) => client.saldoAFavor === null));

  const xlsx = await renderClientesCarteraXlsx(result);
  assert.equal(xlsx.subarray(0, 2).toString("ascii"), "PK");
  const workbook = new ExcelJS.Workbook();
  const excelInput = xlsx as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelInput);
  const workbookText = workbook.worksheets
    .flatMap((sheet) => sheet.getSheetValues().flat())
    .map((value) => String(value ?? ""))
    .join("|");
  assert.match(workbookText, /No atribuible por sitio/);
  assert.doesNotMatch(workbookText, /999\.99/);

  const pdf = renderClientesCarteraPdf(result);
  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  const pdfText = pdf.toString("ascii");
  assert.match(pdfText, /No atribuible por sitio/);
  assert.doesNotMatch(pdfText, /999\.99/);
  assert.match(pdfText, /generado: 2026-01-20T12:00:00\.000Z/);
});