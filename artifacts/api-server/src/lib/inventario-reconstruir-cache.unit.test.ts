import assert from "node:assert/strict";
import test from "node:test";
import { db } from "@workspace/db";
import { reconstruirCacheExistencias } from "./inventario";

type QueryResult = { rows: Array<Record<string, unknown>> };
type FakeExecutor = {
  execute(query: unknown): Promise<QueryResult>;
};

type Scenario = {
  suppliedTx: FakeExecutor;
  innerTx: FakeExecutor;
  transactionCalls: number;
  transactionExecutors: FakeExecutor[];
  executeCalls: Array<{ executor: FakeExecutor; query: unknown }>;
  failAtExecute?: number;
  expectedError?: Error;
  rebuildError?: Error;
  committed: number;
  rolledBack: number;
};

let activeScenario: Scenario | undefined;

function active(): Scenario {
  assert.ok(activeScenario, "the test scenario must be active");
  return activeScenario;
}

function makeExecutor(): FakeExecutor {
  return {
    async execute(query) {
      const scenario = active();
      scenario.executeCalls.push({ executor: this, query });
      const executeNumber = scenario.executeCalls.length;
      if (scenario.failAtExecute === executeNumber && scenario.expectedError) {
        throw scenario.expectedError;
      }
      // The first execute is lockAllExistingInventoryPairs' key query. The
      // three advisory-lock executes follow it, and the rebuild SQL is last.
      if (executeNumber === 1) {
        return {
          rows: [
            { producto_id: "11", ubicacion_id: "4" },
            { producto_id: "2", ubicacion_id: "3" },
            { producto_id: "1", ubicacion_id: "3" },
            { producto_id: "11", ubicacion_id: "4" },
          ],
        };
      }
      if (executeNumber === 5 && scenario.rebuildError) {
        throw scenario.rebuildError;
      }
      return { rows: [] };
    },
  };
}

function makeScenario(): Scenario {
  const scenario = {
    suppliedTx: undefined as unknown as FakeExecutor,
    innerTx: undefined as unknown as FakeExecutor,
    transactionCalls: 0,
    transactionExecutors: [],
    executeCalls: [],
    committed: 0,
    rolledBack: 0,
  } satisfies Omit<
    Scenario,
    "failAtExecute" | "expectedError" | "rebuildError"
  >;
  scenario.suppliedTx = makeExecutor();
  scenario.innerTx = makeExecutor();
  return scenario;
}

type RebuildTx = Parameters<typeof reconstruirCacheExistencias>[0];

async function withScenario<T>(
  callback: (scenario: Scenario) => Promise<T>,
): Promise<T> {
  const previous = activeScenario;
  const scenario = makeScenario();
  activeScenario = scenario;
  const mutableDb = db as unknown as {
    transaction<T>(
      callback: (tx: FakeExecutor) => Promise<T>,
    ): Promise<T>;
  };
  const originalTransaction = mutableDb.transaction;
  mutableDb.transaction = async <Result>(
    transactionCallback: (tx: FakeExecutor) => Promise<Result>,
  ): Promise<Result> => {
    scenario.transactionCalls += 1;
    scenario.transactionExecutors.push(scenario.innerTx);
    try {
      const result = await transactionCallback(scenario.innerTx);
      scenario.committed += 1;
      return result;
    } catch (error) {
      scenario.rolledBack += 1;
      throw error;
    }
  };
  try {
    return await callback(scenario);
  } finally {
    mutableDb.transaction = originalTransaction;
    activeScenario = previous;
  }
}

function asRebuildTx(executor: FakeExecutor): RebuildTx {
  return executor as RebuildTx;
}

function assertAllCallsUse(scenario: Scenario, executor: FakeExecutor): void {
  assert.ok(
    scenario.executeCalls.every(({ executor: actual }) => actual === executor),
    "every SQL execution must use the supplied transaction",
  );
}

test("provided tx rebuilds through one executor without opening a transaction", async () => {
  await withScenario(async (scenario) => {
    await reconstruirCacheExistencias(asRebuildTx(scenario.suppliedTx));

    assert.equal(scenario.transactionCalls, 0);
    assert.equal(
      scenario.executeCalls.length,
      5,
      "the supplied transaction must execute the key query, three locks, and rebuild SQL",
    );
    assertAllCallsUse(scenario, scenario.suppliedTx);
  });
});

test("standalone rebuild opens exactly one transaction and uses its inner tx", async () => {
  await withScenario(async (scenario) => {
    await reconstruirCacheExistencias();

    assert.equal(scenario.transactionCalls, 1);
    assert.deepEqual(scenario.transactionExecutors, [scenario.innerTx]);
    assert.equal(scenario.committed, 1);
    assert.equal(scenario.rolledBack, 0);
    assertAllCallsUse(scenario, scenario.innerTx);
    assert.ok(
      scenario.executeCalls.length > 2,
      "the rebuild must execute the key query, lock queries, and rebuild SQL",
    );
  });
});

test("lock failures propagate unchanged without opening a nested transaction", async () => {
  await withScenario(async (scenario) => {
    const expected = new Error("lock failed");
    scenario.failAtExecute = 2;
    scenario.expectedError = expected;

    await assert.rejects(
      () => reconstruirCacheExistencias(asRebuildTx(scenario.suppliedTx)),
      (error: unknown) => error === expected,
    );

    assert.equal(scenario.transactionCalls, 0);
    assert.equal(scenario.executeCalls.length, 2);
    assertAllCallsUse(scenario, scenario.suppliedTx);
  });
});

test("rebuild SQL failures propagate unchanged through the supplied transaction", async () => {
  await withScenario(async (scenario) => {
    const expected = new Error("rebuild failed");
    scenario.rebuildError = expected;

    await assert.rejects(
      () => reconstruirCacheExistencias(asRebuildTx(scenario.suppliedTx)),
      (error: unknown) => error === expected,
    );

    assert.equal(scenario.transactionCalls, 0);
    assert.equal(scenario.executeCalls.length, 5);
    assertAllCallsUse(scenario, scenario.suppliedTx);
  });
});

test("standalone rebuild rolls back its one transaction when rebuild SQL fails", async () => {
  await withScenario(async (scenario) => {
    const expected = new Error("standalone rebuild failed");
    scenario.rebuildError = expected;

    await assert.rejects(
      () => reconstruirCacheExistencias(),
      (error: unknown) => error === expected,
    );

    assert.equal(scenario.transactionCalls, 1);
    assert.equal(scenario.committed, 0);
    assert.equal(scenario.rolledBack, 1);
    assertAllCallsUse(scenario, scenario.innerTx);
  });
});