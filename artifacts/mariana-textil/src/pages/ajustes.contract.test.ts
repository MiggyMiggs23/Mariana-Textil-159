import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);

test("Ajustes integra la confirmación textual antes de enviar ajustes grandes", async () => {
  const ajustes = await readFile(
    new URL("artifacts/mariana-textil/src/pages/ajustes.tsx", root),
    "utf8",
  );

  assert.match(
    ajustes,
    /import\s*\{\s*ConfirmacionTextoExacto\s*\}\s*from\s*["']@\/components\/confirmacion-texto-exacto["']/,
  );
  assert.match(ajustes, /requiereConfirmacionAjuste\(/);
  assert.match(
    ajustes,
    /if\s*\(requiereConfirmacionAjuste\([\s\S]*?setConfirmacionAjusteAbierta\(true\);[\s\S]*?return;/,
  );
  assert.match(
    ajustes,
    /<ConfirmacionTextoExacto[\s\S]*?textoRequerido="AJUSTE"[\s\S]*?onConfirm=\{enviarAjuste\}/,
  );
});

test("Ajustes no envía la mutación antes de solicitar la confirmación", async () => {
  const ajustes = await readFile(
    new URL("artifacts/mariana-textil/src/pages/ajustes.tsx", root),
    "utf8",
  );
  const submit = ajustes.match(
    /const handleSubmitAjuste = \(\) => \{[\s\S]*?\n  \};\n\n  const handleRevisar/,
  )?.[0];

  assert.ok(submit, "handleSubmitAjuste debe existir");
  assert.match(
    submit,
    /setConfirmacionAjusteAbierta\(true\);\s*return;[\s\S]*?enviarAjuste\(\);/,
  );
  assert.doesNotMatch(submit, /ajustarRollo\.mutate/);
});