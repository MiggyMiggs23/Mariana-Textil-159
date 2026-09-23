import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");

function source(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("Block 3 removes only retired transfer HTTP surfaces", () => {
  const inventarioRoutes = source("artifacts/api-server/src/routes/inventario.ts");
  const openApi = source("lib/api-spec/openapi.yaml");
  const client = source("lib/api-client-react/src/generated/api.ts");
  const zodBarrel = source("lib/api-zod/src/generated/types/index.ts");

  for (const retiredName of [
    '"/rollos/:id/mover"',
    '"/rollos/:id/recibir"',
    "/inventario/rollos/{id}/mover:",
    "/inventario/rollos/{id}/recibir:",
    "useMoverRollo",
    "useRecibirTransferencia",
    "MoverRolloInput",
    "RecibirTransferenciaInput",
    "RetiredTransferResponse",
    "RetiredTransferResponseCode",
  ]) {
    assert.equal(inventarioRoutes.includes(retiredName), false, `${retiredName} remains in routes`);
    assert.equal(openApi.includes(retiredName), false, `${retiredName} remains in OpenAPI`);
    assert.equal(client.includes(retiredName), false, `${retiredName} remains in generated client`);
    assert.equal(zodBarrel.includes(retiredName), false, `${retiredName} remains in generated Zod exports`);
  }
});

test("Block 3 retains active transfer equivalents and Salidas callers", () => {
  const inventario = source("artifacts/api-server/src/lib/inventario.ts");
  const salidas = source("artifacts/api-server/src/lib/salidas.ts");

  for (const requestedButAbsent of [
    "iniciarTransferencia",
    "confirmarTransferencia",
    "cancelarTransferencia",
    "transferenciaDirecta",
    "ajustarRolloEnTransito",
  ]) {
    assert.equal(inventario.includes(requestedButAbsent), false, `${requestedButAbsent} must not be introduced`);
  }

  for (const activeCoreFunction of [
    "transferirRolloInmediato",
    "moverRollo",
    "recibirTransferencia",
    "ajustarRollo",
  ]) {
    assert.match(inventario, new RegExp(`export async function ${activeCoreFunction}\\b`));
    assert.match(salidas, new RegExp(`\\b${activeCoreFunction}\\s*\\(`));
  }

  assert.match(inventario, /\["DISPONIBLE", "EN_TRANSITO"\]\.includes\(rollo\.estado\)/);
});

test("Block 3 leaves the Contenedores lifecycle and UI surfaces present", () => {
  const contenedores = source("artifacts/api-server/src/lib/contenedores.ts");
  const helpers = source("artifacts/api-server/src/lib/contenedores-helpers.ts");
  const routes = source("artifacts/api-server/src/routes/contenedores.ts");
  const indexUi = source("artifacts/mariana-textil/src/pages/contenedores/index.tsx");
  const detailUi = source("artifacts/mariana-textil/src/pages/contenedores/detail.tsx");

  assert.match(contenedores, /EN_TRANSITO/);
  assert.match(helpers, /canEditContenedor/);
  assert.match(routes, /contenedor/);
  assert.match(indexUi, /contenedor/i);
  assert.match(detailUi, /contenedor/i);
});