import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const defect = process.argv.find(arg => arg.startsWith("--defect="))?.split("=")[1];
const sourceUrl = new URL("./lib/tarea4-remate-sale.ts", import.meta.url);
const posSource = readFileSync(new URL("./lib/pos.ts", import.meta.url), "utf8");
let source = readFileSync(sourceUrl, "utf8");
if (defect === "product-wide") {
  source = source.replace(
    "rolloIds.length === 0 ||\n    rolloIds.some(",
    "false && rolloIds.length === 0 ||\n    false && rolloIds.some(",
  );
}
if (defect === "physical-cost") {
  source = source.replace(
    "physicalById.get(id)!.costCents! > input.priceCents",
    "false",
  );
}
const javascript = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = { exports: {} };
new Function("module", "exports", javascript)(loaded, loaded.exports);
const {
  decideConsumedRemateSale,
  decideRemateSale,
  loadActiveRemateRollIds,
} = loaded.exports;

test("POS expande IDs escalares sin enviar un número como literal de arreglo", () => {
  assert.doesNotMatch(posSource, /ANY\\(\\$\\{ids\\}::int\\[\\]\\)/);
  assert.equal(
    posSource.split(
      "WHERE rollo_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})",
    ).length - 1,
    2,
  );
});

test("OFF conserva las dos conductas previas y no consulta esquema remate", async () => {
  let reads = 0;
  const active = await loadActiveRemateRollIds(false, [11], async () => {
    reads += 1;
    throw new Error("la tabla preparada no debe consultarse");
  });
  assert.equal(reads, 0);
  assert.deepEqual(
    decideRemateSale({
      released: false,
      priceCents: 900,
      costCents: 1000,
      rolloIds: [11],
      activeRollIds: active,
      legacyBlocksBelowCost: true,
    }),
    {
      allowed: false,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    },
  );
  assert.deepEqual(
    decideRemateSale({
      released: false,
      priceCents: 900,
      costCents: 1000,
      rolloIds: [],
      activeRollIds: active,
      legacyBlocksBelowCost: false,
    }),
    {
      allowed: true,
      remate: false,
      rolloIds: [],
      requiresPhysicalValidation: false,
    },
  );
  const consumedOff = await decideConsumedRemateSale(
    {
      released: false,
      priceCents: 900,
      movements: [{ rolloId: 11 }],
    },
    async () => {
      reads += 1;
      throw new Error("OFF no consulta costos físicos");
    },
    async () => {
      reads += 1;
      throw new Error("OFF no consulta marcas después del consumo FIFO");
    },
  );
  assert.equal(reads, 0);
  assert.equal(consumedOff.allowed, true);
  assert.equal(consumedOff.remate, false);
});

test("ON autoriza bajo costo solo por cada rollo activo leído del store", async () => {
  const dbStub = {
    reads: [],
    async activeRollIds(ids) {
      this.reads.push([...ids]);
      return ids.filter(id => id === 11 || id === 13);
    },
  };
  const active = await loadActiveRemateRollIds(
    true,
    [11, 12, 13, 999],
    ids => dbStub.activeRollIds(ids),
  );
  assert.deepEqual(dbStub.reads, [[11, 12, 13, 999]]);

  const base = {
    released: true,
    priceCents: 900,
    costCents: 1000,
    activeRollIds: active,
    legacyBlocksBelowCost: true,
  };
  assert.deepEqual(decideRemateSale({ ...base, rolloIds: [11] }), {
    allowed: true,
    remate: true,
    rolloIds: [11],
    requiresPhysicalValidation: false,
  });
  assert.equal(
    decideRemateSale({ ...base, rolloIds: [11, 12] }).allowed,
    false,
    "una fuente no marcada bloquea toda la línea metreada",
  );
  assert.deepEqual(decideRemateSale({ ...base, rolloIds: [13, 13] }), {
    allowed: true,
    remate: true,
    rolloIds: [13],
    requiresPhysicalValidation: false,
  });
});

test("BOLSA ON usa costos físicos: el promedio no oculta una fuente bajo costo", async () => {
  let stock = new Map([[31, 2], [32, 2]]);
  let reads = 0;
  async function fifoSale(activeIds) {
    const snapshot = new Map(stock);
    try {
      const preflight = decideRemateSale({
        released: true,
        priceCents: 900,
        // El promedio 850 queda debajo del precio, pero la caja 32 cuesta 1200.
        costCents: 850,
        rolloIds: [],
        activeRollIds: new Set(),
        legacyBlocksBelowCost: false,
        allowDeferredPhysicalSources: true,
      });
      assert.equal(preflight.allowed, true);
      assert.equal(preflight.remate, false);
      assert.equal(preflight.requiresPhysicalValidation, true);

      // Observable stand-in for the unchanged canonical FIFO consumer.
      const movements = [{ rolloId: 31 }, { rolloId: 32 }];
      stock.set(31, 0);
      stock.set(32, 1);
      const physical = await decideConsumedRemateSale(
        {
          released: true,
          priceCents: 900,
          movements,
        },
        async ids => ids.map(rolloId => ({
          rolloId,
          costCents: rolloId === 31 ? 500 : 1200,
        })),
        async ids => {
          reads += 1;
          return ids.filter(id => activeIds.has(id));
        },
      );
      if (!physical.allowed || !physical.remate) throw new Error("PRICE_BELOW_COST");
      return physical;
    } catch (error) {
      stock = snapshot;
      throw error;
    }
  }

  await assert.rejects(
    fifoSale(new Set([31])),
    /PRICE_BELOW_COST/,
    "marcar solo la caja barata no autoriza la caja cara",
  );
  assert.deepEqual([...stock], [[31, 2], [32, 2]]);
  const accepted = await fifoSale(new Set([32]));
  assert.equal(accepted.remate, true);
  assert.deepEqual(
    accepted.rolloIds,
    [32],
    "solo la fuente realmente vendida bajo su costo exige marca",
  );
  assert.deepEqual([...stock], [[31, 0], [32, 1]]);
  assert.equal(reads, 2);

  let unnecessaryMarkReads = 0;
  const ordinary = await decideConsumedRemateSale(
    {
      released: true,
      priceCents: 900,
      movements: [{ rolloId: 41 }, { rolloId: 42 }],
    },
    async ids => ids.map(rolloId => ({ rolloId, costCents: 800 })),
    async () => {
      unnecessaryMarkReads += 1;
      return [];
    },
  );
  assert.equal(ordinary.allowed, true);
  assert.equal(ordinary.remate, false);
  assert.equal(unnecessaryMarkReads, 0);
});

test("producto o payload no sustituyen una fuente física activa", () => {
  const activeRollIds = new Set([21]);
  const forgedProductPayload = {
    released: true,
    priceCents: 1,
    costCents: 1000,
    rolloIds: [],
    activeRollIds,
    legacyBlocksBelowCost: false,
    productoId: 21,
    remate: true,
  };
  assert.equal(decideRemateSale(forgedProductPayload).allowed, false);
  assert.equal(
    decideRemateSale({ ...forgedProductPayload, rolloIds: [22] }).allowed,
    false,
  );
});

test("precio no bajo costo no se etiqueta como remate", () => {
  for (const priceCents of [1000, 2000]) {
    assert.deepEqual(
      decideRemateSale({
        released: true,
        priceCents,
        costCents: 1000,
        rolloIds: [11],
        activeRollIds: new Set([11]),
        legacyBlocksBelowCost: true,
      }),
      {
        allowed: true,
        remate: false,
        rolloIds: [],
        requiresPhysicalValidation: false,
      },
    );
  }
});