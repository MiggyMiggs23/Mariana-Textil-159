import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GetAdminAlertasResponse } from "@workspace/api-zod";
import { loadRenderTestModule } from "../render-test-bundle";
import { formatDateOnlyMx } from "../lib/date-only";

process.env.TZ = "America/Mexico_City";

const apiClientStubDirectory = await mkdtemp(
  join(tmpdir(), "mariana-nota-render-"),
);
const apiClientStubPath = join(apiClientStubDirectory, "api-client-react.ts");
await writeFile(
  apiClientStubPath,
  `
let calendarDate = "2026-10-02";
export function setCalendarDate(value) {
  calendarDate = value;
}
const nota = () => ({
  fechaVencimiento: calendarDate,
  estadoNota: "PENDIENTE",
  saldoActual: "100.00",
  importeOriginal: "100.00",
  abonos: [],
});
export function useGetClienteNotaCredito() {
  return { data: nota(), isLoading: false };
}
export function getGetClienteNotaCreditoQueryKey() {
  return ["/api/clientes/1/tickets/1005/nota"];
}
export function useGetClientePagoDetalle() {
  return { data: undefined, isLoading: false };
}
export function getGetClientePagoDetalleQueryKey() {
  return ["/api/clientes/1/pagos/0"];
}
export function useGetCurrentUser() {
  return { data: undefined };
}
export function getGetCurrentUserQueryKey() {
  return ["/api/auth/me"];
}
export function useListLocations() {
  return { data: [], isLoading: false, isError: false, error: null };
}
export function getListLocationsQueryKey(params) {
  return ["/api/locations", ...(params ? [params] : [])];
}
export function useReversarClientePago() {
  return { mutate() {}, isPending: false };
}
`,
  "utf8",
);

let renderModule: {
  ClienteNotaCredito: React.ComponentType<{ clienteId: number; ticketId: number }>;
  setCalendarDate: (value: string) => void;
};
try {
  renderModule = await loadRenderTestModule(
    `
      import React from "react";
      import { ClienteNotaCredito as RealClienteNotaCredito } from ${JSON.stringify(
        new URL("./cliente-nota-credito.tsx", import.meta.url).pathname,
      )};
      import { LocationScopeProvider } from ${JSON.stringify(
        new URL("../lib/location-scope.tsx", import.meta.url).pathname,
      )};
      import { setCalendarDate } from "@workspace/api-client-react";
      export function ClienteNotaCredito(props) {
        return <LocationScopeProvider><RealClienteNotaCredito {...props} /></LocationScopeProvider>;
      }
      export { setCalendarDate };
    `,
    { moduleAliases: { "@workspace/api-client-react": apiClientStubPath } },
  );
} catch (error) {
  await rm(apiClientStubDirectory, { recursive: true, force: true });
  throw error;
}

test.after(async () => {
  await rm(apiClientStubDirectory, { recursive: true, force: true });
});

test("SSR renders generated calendar dates identically to production print output", () => {
  const cases = [
    ["2026-10-01", "01/10/2026"],
    ["2026-10-02", "02/10/2026"],
    ["2026-10-31", "31/10/2026"],
  ] as const;

  for (const [wireDate, expectedDate] of cases) {
    const generated = GetAdminAlertasResponse.parse({
      generatedAt: "2026-10-02T12:00:00.000Z",
      total: 1,
      documentosPendientes: [],
      creditos: [{
        movimientoId: 1005,
        ticketId: 1005,
        clienteId: 1,
        nombreCliente: "Cliente de prueba",
        nota: null,
        ticketFolio: 1005,
        importe: "100.00",
        fechaVencimiento: wireDate,
        estadoNota: "PENDIENTE",
        diasRestantes: 0,
      }],
      salidasEnTransito: [],
      ventasAutorizadasSinEntregar: [],
    });
    const parsedDate = generated.creditos[0].fechaVencimiento;
    assert.equal(typeof parsedDate, "string");
    assert.equal(JSON.stringify(parsedDate), `"${wireDate}"`);

    renderModule.setCalendarDate(parsedDate);
    const queryClient = new QueryClient();
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(renderModule.ClienteNotaCredito, {
          clienteId: 1,
          ticketId: 1005,
        }),
      ),
    );

    // formatDateOnlyMx is unchanged production print behavior. Rendering the
    // real component and comparing it to this independent expected value
    // catches a direct Date(calendar) conversion in the mounted consumer.
    const printDate = formatDateOnlyMx(parsedDate);
    assert.equal(printDate, expectedDate);
    assert.match(html, new RegExp(expectedDate));
  }
});