import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));

test("legacy roll commit paths enforce customer-sale reservations", () => {
  const source = readFileSync(join(here, "salidas.ts"), "utf8");
  for (const marker of [
    "export async function crearSalida(",
    "export async function crearSalidaMostrador(",
    "export async function agregarRolloBorradorSalida(",
    "export async function crearEnviarSalidaVentaCliente(",
  ]) {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, marker);
    const end = source.indexOf("\nexport ", start + marker.length);
    const body = source.slice(start, end === -1 ? undefined : end);
    assert.match(body, /assertNoActiveVentaClienteReservation/);
  }
});

test("low-level extraordinary and counter primitives enforce reservations", () => {
  const source = readFileSync(join(here, "inventario.ts"), "utf8");
  for (const marker of ["export async function salidaMostrador(", "export async function crearSalidaExtraordinaria("]) {
    const start = source.indexOf(marker);
    const end = source.indexOf("\nexport ", start + marker.length);
    assert.match(source.slice(start, end === -1 ? undefined : end), /assertNoActiveVentaClienteReservation/);
  }
});
