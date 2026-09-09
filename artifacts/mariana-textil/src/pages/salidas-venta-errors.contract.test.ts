import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("structured roll and delivery errors retain safe clickable ownership links", async () => {
  const errors = await readFile(new URL("../lib/api-error.ts", import.meta.url), "utf8");

  assert.match(errors, /data\.code === "ROLLO_BLOQUEADO"/);
  assert.match(errors, /data\.code === "SERIE_ENTREGA_INVALIDA"/);
  assert.match(errors, /item\.serieEscaneada/);
  assert.match(errors, /item\.razon/);
  assert.match(errors, /item\.documentoVenta/);
  assert.match(errors, /Abrir salida propietaria/);
  assert.match(errors, /Abrir documento/);
  assert.match(errors, /value\.startsWith\("\/api"\)/);
  assert.match(errors, /`\/salidas\/\$\{salidaId\}`/);
  assert.match(errors, /`\/tickets\/\$\{documentoId\}`/);
});

test("POS and salida scan/creation workflows render structured API details", async () => {
  const paths = [
    "./pos.tsx",
    "./salida-nueva.tsx",
    "../components/salida-venta-cliente-nueva.tsx",
    "../components/salida-mostrador.tsx",
    "../components/salidas-extraordinarias.tsx",
    "../components/recepcion-salidas.tsx",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /ApiErrorDetails/, `${path} must preserve structured errors`);
  }
});

test("ENTREGADA is present in salida maps, generated state filter, and closed-detail behavior", async () => {
  const list = await readFile(new URL("./salidas.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");

  assert.match(list, /ENTREGADA:\s*\{\s*label:\s*"Entregada"/);
  assert.match(list, /Object\.values\(EstadoSalida\)/);
  assert.match(detail, /ENTREGADA:\s*\{\s*label:\s*"Entregada"/);
  assert.match(detail, /salida\.estado === 'ENTREGADA'/);
  assert.match(detail, /salida\.estado !== "ENTREGADA"/);
});

test("linked cancellation explicitly invokes generated salida cancellation atomically", async () => {
  const detail = await readFile(new URL("./salida-detail.tsx", import.meta.url), "utf8");

  assert.match(detail, /useCancelarSalida\(\)/);
  assert.match(detail, /cancelMutation\.mutate\(\{\s*id,/);
  assert.match(detail, /operación es atómica/);
  assert.match(detail, /todas las salidas agrupadas vinculadas, no únicamente esta salida/);
  assert.match(detail, /Cancelar documento y todas sus salidas/);
});