import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  GetClienteNotaCreditoResponse,
  GetClientePagoDetalleResponse,
} from "@workspace/api-zod";
import { withBrowserFixture } from "../observable-test/browser";

const root = new URL("../../../../", import.meta.url);

test("Block 4 functionality in ticket detail", async () => {
  const financeNotaFixtureDirectory = await mkdtemp(join(tmpdir(), "finance-nota-"));
  const financeNotaApiPath = join(financeNotaFixtureDirectory, "api-client-react.ts");
  const financeNotaQueryPath = join(financeNotaFixtureDirectory, "react-query.ts");
  const stateCases: ReadonlyArray<readonly [
    "PENDIENTE" | "ABONO_PARCIAL" | "PAGADA" | "CON_RETRASO",
    string,
    string | null,
    number,
    string,
  ]> = [
    ["PENDIENTE", "100.00", "2026-10-09", 0, "PENDIENTE"],
    ["ABONO_PARCIAL", "60.00", "2026-10-09", 0, "ABONO PARCIAL"],
    ["PAGADA", "0.00", "2026-10-09", 0, "PAGADA"],
    ["CON_RETRASO", "60.00", "2026-09-20", 12, "CON RETRASO"],
    ["PENDIENTE", "100.00", null, 0, "PENDIENTE"],
  ] as const;
  const createNota = (
    estadoNota: (typeof stateCases)[number][0],
    saldoActual: string,
    fechaVencimiento: string | null,
    diasVencidos: number,
  ) => GetClienteNotaCreditoResponse.parse({
    clienteId: 41,
    ticket: {
      id: 1005, folio: 5005, ubicacionId: 2, nombreUbicacion: "Sucursal", usuarioTerminalId: 7,
      nombreUsuarioTerminal: "Caja", clienteId: 41, nombreCliente: "Cliente observable",
      notaSinPrecios: false, direccionEntregaEfectiva: null, subtotal: "100.00", iva: "0.00",
      tasaIva: "0.00", total: "100.00", estado: "VENDIDO", cobrado: false, cobradoAt: null,
      usuarioCajaId: null, nombreUsuarioCaja: null, facturado: false, sesionCajaId: null,
      uuidCliente: "c8d07f44-bbd8-45c5-9394-3bb12ef2f604", createdAt: "2026-10-01T12:00:00.000Z",
      canceladoAt: null, canceladoPor: null, nombreUsuarioCancelacion: null, motivoCancelacion: null,
      autorizadoPor: 8, nombreUsuarioAutorizacion: "Responsable", esCredito: true,
      importeCredito: "100.00", diasPlazo: 30, fechaVencimiento, saldoPendiente: saldoActual,
      estadoNota, telefonoCliente: null, correoCliente: null, direccionCliente: null,
      documentoTipo: "NOTA", autorizacionEstado: "AUTORIZADA", nombreDestinatario: null,
      direccionEntregaSnapshot: null, convertidoANotaPorCobro: false, diasCreditoCliente: 30,
      viaje: null, salidas: [], lineas: [],
    },
    movimientoVentaId: 501, importeOriginal: "100.00", saldoActual, estado: saldoActual === "0.00" ? "PAGADA" : "PENDIENTE",
    estadoNota, fechaVencimiento, diasVencidos,
    abonos: estadoNota === "ABONO_PARCIAL" ? [{
      movimientoPagoId: 88, fecha: "2026-10-02T12:00:00.000Z", montoAplicado: "40.00",
      montoTotalAbono: "70.00", formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL",
      referencia: "REF-88", usuarioRegistrador: "Operadora", revertido: false,
    }] : [],
  });
  const payment = GetClientePagoDetalleResponse.parse({
    id: 88, clienteId: 41, fecha: "2026-10-02T12:00:00.000Z", montoTotalAbono: "70.00",
    formaPago: "TRANSFERENCIA", cuentaDestino: "CUENTA_FISCAL", referencia: "REF-88",
    usuarioRegistrador: "Operadora", aplicaciones: [{
      ticketId: 1005, folio: 5005, movimientoVentaId: 501, aplicado: "40.00",
      importeOriginal: "100.00", saldoActual: "60.00", resultado: "PARCIAL", estadoNota: "ABONO_PARCIAL",
    }],
  });
  try {
    for (const [estadoNota, saldo, vencimiento, dias, label] of stateCases) {
      const nota = createNota(estadoNota, saldo, vencimiento, dias);
      await writeFile(financeNotaApiPath, `
        export * from ${JSON.stringify("/home/runner/workspace/lib/api-client-react/src/index.ts")};
        const result = (data) => ({ data, isLoading: false });
        export const useGetClienteNotaCredito = () => result(${JSON.stringify(nota)});
        export const useGetClientePagoDetalle = () => result(${JSON.stringify(payment)});
        export const useGetCurrentUser = () => result({ rol: "ADMIN", permisos: [] });
        export const useReversarClientePago = () => ({ mutate() {}, isPending: false });
        export const getGetClienteNotaCreditoQueryKey = () => [];
        export const getGetClientePagoDetalleQueryKey = () => [];
      `);
      await writeFile(financeNotaQueryPath, `
        export * from "/home/runner/workspace/node_modules/.pnpm/@tanstack+react-query@5.101.4_react@19.1.0/node_modules/@tanstack/react-query/build/modern/index.js";
        export const useQueryClient = () => ({ invalidateQueries() {} });
      `);
      await withBrowserFixture({
        entrySource: `
          import React from "react";
          import { ClienteNotaCredito } from ${JSON.stringify(new URL("../components/cliente-nota-credito.tsx", import.meta.url).pathname)};
          export default function Fixture() { return <ClienteNotaCredito clienteId={41} ticketId={1005} />; }
        `,
        moduleAliases: {
          "@workspace/api-client-react": financeNotaApiPath,
          "@tanstack/react-query": financeNotaQueryPath,
        },
      }, async (page) => {
        await page.waitFor(`document.querySelector('[data-testid="status-nota-1005"]') !== null`);
        const statusAndFields = await page.evaluate<{
          badge: string; badgeHasAmount: boolean; balance: boolean; due: boolean; delay: boolean;
        }>(`
          (() => {
            const cardText = (title) => {
              const heading = Array.from(document.querySelectorAll("span"))
                .find((node) => node.textContent?.trim() === title);
              return heading?.parentElement?.parentElement?.parentElement?.textContent ?? "";
            };
            const badge = document.querySelector('[data-testid="status-nota-1005"]')?.textContent?.trim() ?? "";
            const balance = cardText("Saldo pendiente");
            const due = cardText("Vencimiento");
            return {
              badge, badgeHasAmount: /\\d/.test(badge),
              balance: balance.includes(${JSON.stringify(saldo)}),
              due: due.includes(${JSON.stringify(vencimiento ? vencimiento.split("-").reverse().join("/") : "No establecido")}),
              delay: due.includes(${JSON.stringify(`${dias} días de retraso`)}),
            };
          })()
        `);
        assert.equal(statusAndFields.badge, label, `${estadoNota} keeps its canonical badge label free of currency`);
        assert.equal(statusAndFields.badgeHasAmount, false, `${estadoNota} does not merge balance into the badge`);
        assert.equal(statusAndFields.balance, true, `${estadoNota} exposes its balance in the separate balance card`);
        assert.equal(statusAndFields.due, true, `${estadoNota} exposes its due day in the separate due-date card`);
        assert.equal(statusAndFields.delay, estadoNota === "CON_RETRASO", `${estadoNota} exposes overdue days only when overdue`);
        if (estadoNota === "ABONO_PARCIAL") {
          const historyRow = await page.evaluate<{
            fields: boolean; total: boolean; link: string | null;
          }>(`
            (() => {
              const row = document.querySelector("tbody tr")?.textContent ?? "";
              const link = document.querySelector('[data-testid="link-abono-movimiento-88"]');
              return {
                fields: row.includes("02/10/2026") && row.includes("40.00")
                  && row.includes("TRANSFERENCIA") && row.includes("REF-88") && row.includes("Operadora"),
                total: row.includes("70.00"),
                link: link?.getAttribute("href") ?? null,
              };
            })()
          `);
          assert.equal(historyRow.fields, true, "the abono history row exposes its date, applied amount, method, reference, and registrant");
          assert.equal(historyRow.total, true, "the abono history row keeps the total payment distinct from its applied amount");
          assert.equal(historyRow.link, "/clientes/41/movimientos/88", "the abono row links to its real movement");
          await page.evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Ver Reparto")?.click()`);
          await page.waitFor(`document.querySelector('[role="dialog"]') !== null`);
          const paymentDetail = await page.evaluate<boolean>(`
            (() => {
              const dialog = document.querySelector('[role="dialog"]')?.textContent ?? "";
              return dialog.includes("70.00") && dialog.includes("5005") && dialog.includes("40.00");
            })()
          `);
          assert.equal(paymentDetail, true, "an observed abono opens its inverse distribution detail");
        } else {
          const emptyHistory = await page.evaluate<boolean>(
            `document.body.textContent?.includes("No se han registrado abonos a esta nota.") === true`,
          );
          assert.equal(emptyHistory, true, `${estadoNota} safely presents an empty abono history`);
        }
      });
    }
  } finally {
    await rm(financeNotaFixtureDirectory, { recursive: true, force: true });
  }
});

test("Block 4 functionality in cobros", async () => {
  const cobros = await readFile(new URL("artifacts/mariana-textil/src/pages/cobros.tsx", root), "utf8");

  // El listado solo recibe el folio visible, no el ID interno que exige /tickets/:id.
  // Debe conservar texto en vez de fabricar un enlace muerto con el folio.
  assert.doesNotMatch(cobros, /<Link href=\{`\/tickets\/\$\{nota\.ticketFolio\}`\}/);
  assert.match(cobros, /\{nota\.ticketFolio\}/);
});

test("Nota keeps the 5.25mm root safe area and uses an inner ink frame", async () => {
  const ticketDetail = await readFile(new URL("artifacts/mariana-textil/src/pages/ticket-detail.tsx", root), "utf8");
  const notaPrint = ticketDetail.slice(
    ticketDetail.indexOf("{/* Nota Print Pages */}"),
    ticketDetail.indexOf("<Dialog open={cancelOpen}"),
  );

  assert.match(
    notaPrint,
    /credito-page-print w-\[148mm\] h-\[210mm\] p-\[5\.25mm\][\s\S]*overflow-visible/,
  );
  assert.match(
    notaPrint,
    /nota-page-frame relative[\s\S]*border border-gray-200 bg-white/,
  );
  assert.doesNotMatch(notaPrint, /credito-page-print bg-white/);
  assert.match(notaPrint, /Laser PDF validation: eight complete product rows/);
  assert.match(notaPrint, /ninth row starts the next sheet/);
  assert.match(notaPrint, /document-product-grid/);
  assert.match(notaPrint, /data-testid="note-legal-block"/);
  assert.match(notaPrint, /data-testid="note-signature-block"/);
});
