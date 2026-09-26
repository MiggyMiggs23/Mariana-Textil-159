import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./entradas.tsx", import.meta.url), "utf8");

test("mantiene proveedor y bloquea el selector con líneas capturadas", () => {
  assert.match(source, /disabled=\{lineas\.length > 0\}/);
  assert.match(source, /data-testid="btn-change-entrada-provider"/);
  assert.match(source, /if \(!shouldPreserveProvider\(lineas\.length\)[\s\S]*?setProveedorId\("none"\)/);
  assert.match(source, /if \(shouldPreserveProvider\(lineas\.length\) && proveedorId !== provIdStr\)/);
  assert.match(source, /setLineas\(\[\]\);[\s\S]*?setProveedorId\("none"\);[\s\S]*?setContenedorId\("none"\)/);
});

test("valida de nuevo justo antes de la única mutación", () => {
  assert.match(source, /const validateBeforeSave = \([\s\S]*?\): boolean =>/);
  assert.match(source, /const handleSubmit = \(\) => \{[\s\S]*?validateBeforeSave\(\)[\s\S]*?setIsReviewOpen\(true\)/);
  assert.match(source, /const handleConfirmReview = async \(\) => \{[\s\S]*?validateBeforeSave\(freshContainers\)[\s\S]*?crearEntrada\.mutate/);
  assert.match(source, /submitLockRef\.current = true/);
  assert.match(source, /onPendingSearchChange=\{setHasPendingProductSearch\}/);
});

test("revalida disponibilidad fresca del contenedor antes de mutar", () => {
  assert.match(source, /refetch: refetchContenedoresDisponibles/);
  assert.match(source, /const freshResult = await refetchContenedoresDisponibles\(\)/);
  assert.match(source, /if \(freshResult\.error \|\| !freshResult\.data\)/);
  assert.match(source, /if \(!validateBeforeSave\(freshContainers\)\)/);
  assert.match(source, /submitLockRef\.current = true;\s*setIsSubmitting\(true\);\s*if \(contenedorId/);
});