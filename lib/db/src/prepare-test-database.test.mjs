import assert from "node:assert/strict";
import test from "node:test";
import { prepareTestDatabase } from "./prepare-test-database.mjs";

const completeEnvironment = {
  DATABASE_URL: "postgresql://application.example/development",
  TEST_DATABASE_URL: "postgresql://test.example/inventory_test",
  ADMIN_SEED_PASSWORD: "test-only-placeholder",
};

test("preparation aborts at seed and never reports success or runs initializers", async () => {
  const steps = [];
  const successes = [];

  await assert.rejects(
    prepareTestDatabase({
      environment: completeEnvironment,
      isolate: async () => "inventory_test",
      runStep(name) {
        steps.push(name);
        if (name === "ejecutar seed completo") {
          throw new Error("seed failed");
        }
      },
      reportSuccess(message) {
        successes.push(message);
      },
    }),
    /seed failed/,
  );

  assert.deepEqual(steps, [
    "aplicar schema vigente",
    "ejecutar seed completo",
  ]);
  assert.deepEqual(successes, []);
});

test("preparation reports success only after schema, seed and readiness", async () => {
  const events = [];
  await prepareTestDatabase({
    environment: completeEnvironment,
    isolate: async () => {
      events.push("isolation");
      return "inventory_test";
    },
    runStep(name) {
      events.push(name);
    },
    reportSuccess(message) {
      events.push(message);
    },
  });

  assert.deepEqual(events, [
    "isolation",
    "aplicar schema vigente",
    "ejecutar seed completo",
    "ejecutar inicializadores y comprobar readiness",
    "Base de pruebas preparada completamente: inventory_test.",
  ]);
});

test("preparation names every missing required variable before connecting", async () => {
  await assert.rejects(
    prepareTestDatabase({
      environment: {},
      isolate: async () => {
        throw new Error("must not connect");
      },
    }),
    /faltan variables requeridas: DATABASE_URL, TEST_DATABASE_URL, ADMIN_SEED_PASSWORD/,
  );
});