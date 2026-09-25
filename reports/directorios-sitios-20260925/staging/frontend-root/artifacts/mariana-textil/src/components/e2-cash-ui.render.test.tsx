import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withBrowserFixture } from "../observable-test/browser";

test("the mounted cash breakdown exposes E2 evidence and preserved LEGACY context", async () => {
  await withBrowserFixture({
    entrySource: `
      import React from "react";
      import { CorteEfectivoDesglose } from ${JSON.stringify(new URL("./corte-efectivo-desglose.tsx", import.meta.url).pathname)};
      const e2 = {
        version: "E2" as const,
        fondoInicial: "100.00",
        cobrosTickets: "250.00",
        abonosFisicos: "75.00",
        cobrosRetenidos: "25.00",
        salidasFisicas: "50.00",
        efectivoEsperado: "400.00",
        documentos: [
          { origen: "TICKET", id: "41", folio: "F-9001", importe: "250.00", href: "/tickets/41",
            evidencia: { referencia: "REF-T-41", motivo: null, fecha: "2026-09-18T10:15:00.000Z", usuarioId: 5, proveedorId: null, usuarioNombre: "Ana Caja", proveedorNombre: null } },
          { origen: "TICKET", id: "42", folio: "F-9002", importe: "0.00", href: "https://example.invalid/tickets/42",
            evidencia: { referencia: "REF-T-42", motivo: null, fecha: "2026-09-18T10:20:00.000Z", usuarioId: 5, proveedorId: null, usuarioNombre: "Ana Caja", proveedorNombre: null } },
          { origen: "ABONO", id: "72", folio: "A-72", importe: "75.00", href: "/clientes/9?tab=estado&movimientoId=72",
            evidencia: { referencia: "TRANSFERENCIA 778", motivo: null, fecha: "2026-09-18T11:30:00.000Z", usuarioId: 8, proveedorId: null, usuarioNombre: "Luis Administración", proveedorNombre: null } },
          { origen: "SALIDA", id: "8", folio: null, importe: "50.00", href: null,
            evidencia: { referencia: "VALE INTERNO", motivo: "Compra urgente de material", fecha: "2026-09-18T12:00:00.000Z", usuarioId: 9, proveedorId: 22, usuarioNombre: "María Operadora", proveedorNombre: "Insumos del Centro" } },
        ],
      };
      const legacy = { ...e2, version: "LEGACY" as const, efectivoEsperado: "350.00", documentos: [] };
      export default function Fixture() {
        return <main><CorteEfectivoDesglose desglose={e2} /><CorteEfectivoDesglose desglose={legacy} /></main>;
      }
    `,
  }, async (page) => {
    await page.waitFor(`document.querySelectorAll('[data-testid="corte-efectivo-desglose"]').length === 2`);
    const observation = await page.evaluate<{
      text: string;
      hrefs: string[];
      legacyText: string;
    }>(`
      (() => ({
          text: document.body.textContent ?? "",
          hrefs: Array.from(document.querySelectorAll("a")).map((anchor) => anchor.getAttribute("href") ?? ""),
          legacyText: document.querySelector('[data-version="LEGACY"]')?.textContent ?? "",
      }))()
    `);

    assert.match(observation.text, /Fórmula E2/);
    assert.match(observation.text, /Abonos físicos de crédito/);
    assert.match(observation.text, /Cobros físicos retenidos/);
    assert.match(observation.text, /Cálculo histórico conservado/);
    assert.match(observation.text, /se conserva la fórmula anterior del corte cerrado/);
    assert.match(observation.legacyText, /Efectivo esperado conservado/);
    assert.doesNotMatch(observation.legacyText, /Abonos físicos de crédito|Cobros físicos retenidos/);
    assert.match(observation.text, /Referencia: TRANSFERENCIA 778/);
    assert.match(observation.text, /Motivo: Compra urgente de material/);
    assert.match(observation.text, /Fecha:/);
    assert.match(observation.text, /Registró: María Operadora/);
    assert.match(observation.text, /Proveedor: Insumos del Centro/);
    assert.doesNotMatch(observation.text, /Proveedor #?22|Usuario #?9/i);
    assert.deepEqual(observation.hrefs, [
      "/tickets/41",
      "/clientes/9?tab=estado&movimientoId=72",
    ], "only known internal document routes become links");
  });
});

test("the mounted inactive refund prepares both real source payloads against the selected current cash session without POST", async () => {
  const directory = await mkdtemp(join(tmpdir(), "e2-refund-ui-"));
  const apiMockPath = join(directory, "api-client-react.ts");
  try {
    for (const source of [
      { origen: "ABONO", abonoId: 72, cobroClave: null, folio: 9007, referencia: "REC-72" },
      { origen: "COBRO_RETENIDO", abonoId: null, cobroClave: "01890f2e-4e52-7e01-8000-000000000072", folio: null, referencia: "RET-72" },
    ] as const) {
      await writeFile(apiMockPath, `
        export const getGetCreditRefundOptionsQueryKey = (id) => ["/api/clientes", id, "devoluciones-credito/opciones"];
        export const useGetCreditRefundOptions = (_id, options) => {
          window.__refundQueryEnabled = options?.query?.enabled;
          return {
            data: {
              enabled: false,
              motivoInactivo: "Devolución física no disponible: pendiente de autorización de activación E2.",
              advertencia: "Referencias documentales; no acreditan elegibilidad.",
              candidatas: [${JSON.stringify({ ...source, importe: "125.50", sitioOrigenId: 1, sitioNombre: "Sitio original A" })}],
              sesiones: [{ id: 88, sitioOrigenId: 2, sitioNombre: "Caja actual B", abiertaAt: "2026-09-18T13:00:00.000Z" }],
            },
            isLoading: false, isError: false, error: null,
          };
        };
        export const useDevolverCreditoFisico = () => ({
          mutate(payload) {
            window.__refundMutations = (window.__refundMutations || 0) + 1;
            window.__refundMutationPayload = payload;
          },
        });
      `);

      await withBrowserFixture({
        entrySource: `
          import React from "react";
          import { DevolucionCreditoInactivaDialog } from ${JSON.stringify(new URL("./devolucion-credito-inactiva-dialog.tsx", import.meta.url).pathname)};
          window.__refundMutations = 0;
          export default function Fixture() {
            return <DevolucionCreditoInactivaDialog
              open
              onOpenChange={() => {}}
              clienteId={9}
              clienteNombre="Cliente observable"
              isAdmin
            />;
          }
        `,
        moduleAliases: {
          "@workspace/api-client-react": apiMockPath,
        },
      }, async (page) => {
        await page.waitFor(`document.querySelector('[data-testid="refund-source-select"]') !== null`);
        await page.evaluate(`(() => {
          const select = document.querySelector('[data-testid="refund-source-select"]');
          select.value = select.options[1].value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        })()`);
        await page.waitFor(`document.querySelector('[data-testid="refund-session-select"]') !== null`);
        await page.evaluate(`(() => {
          const select = document.querySelector('[data-testid="refund-session-select"]');
          select.value = select.options[1].value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        })()`);
        await page.waitFor(`document.querySelector("#devolucion-motivo") !== null`);
        await page.fill("#devolucion-motivo", "Devolución completa solicitada por el cliente");
        await page.waitFor(`document.querySelector('[data-testid="refund-review-button"]')?.disabled === false`);
        await page.evaluate(`document.querySelector('[data-testid="refund-review-button"]')?.click()`);
        await page.waitFor(`document.querySelector('[data-testid="devolucion-revision"]') !== null`);
        await page.evaluate(`document.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))`);
        await page.waitFor(`document.body.textContent?.includes("No se envió nada") || window.__refundMutations > 0`);

        const observation = await page.evaluate<{
          payload: Record<string, unknown>;
          disabled: boolean;
          queryEnabled: boolean;
          mutations: number;
          text: string;
        }>(`
          (() => {
            const review = document.querySelector('[data-testid="devolucion-revision"]');
            const confirm = Array.from(document.querySelectorAll("button"))
              .find((button) => button.textContent?.includes("Confirmar devolución"));
            if (!review || !confirm) throw new Error("Missing refund review");
            const payload = JSON.parse(review.getAttribute("data-prepared-payload"));
            return {
              payload,
              disabled: confirm.disabled,
              queryEnabled: window.__refundQueryEnabled,
              mutations: window.__refundMutations,
              text: document.body.textContent ?? "",
            };
          })()
        `);

        assert.equal(observation.queryEnabled, true);
        assert.equal(observation.disabled, true);
        assert.equal(observation.mutations, 0, "programmatic submit must return before generated mutate");
        const request = observation.payload.data as Record<string, unknown>;
        assert.equal(observation.payload.id, 9);
        assert.equal(request.origen, source.origen);
        assert.equal(request.abonoId ?? null, source.abonoId);
        assert.equal(request.cobroClave ?? null, source.cobroClave);
        assert.equal(request.importe, "125.50");
        assert.equal(request.sitioOrigenId, 2, "cash-output site comes from the selected current session");
        assert.equal(request.sesionCajaId, 88);
        assert.equal(request.motivo, "Devolución completa solicitada por el cliente");
        assert.match(String(request.operacionClave), /^[0-9a-f-]{36}$/i);
        assert.match(observation.text, /recibido en Sitio original A/);
        assert.match(observation.text, /Caja actual B · Sesión #88/);
        assert.match(observation.text, /ABIERTA hoy/);
        assert.match(observation.text, /No se envió nada/);
        assert.doesNotMatch(observation.text, /devolución (?:registrada|exitosa|completada)/i);
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});