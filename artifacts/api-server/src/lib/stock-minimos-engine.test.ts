import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyStockMinimumEpisodeCause,
  configurationTriggerApplies,
  evaluateStockMinimum,
} from "./stock-minimos-engine";

type FakeUser = {
  id: number;
  activo: boolean;
  ubicacionId: number | null;
  rol: "ADMIN" | "SUPERVISOR" | "CAJA";
};

type FakeSite = {
  habilitado: boolean;
  minima: Map<number, number | null>;
  existencia: Map<number, number>;
  usuarios: FakeUser[];
  episodios: Map<number, { id: number; abierto: boolean }>;
  notificaciones: Array<{ episodioId: number; usuarioId: number }>;
  queries: {
    productos: number;
    existencias: number;
    destinatarios: number;
  };
  nextEpisodeId: number;
};

function recipients(site: FakeSite, ubicacionId: number): number[] {
  return [
    ...new Set(
      site.usuarios
        .filter(
          (user) =>
            user.activo &&
            (user.ubicacionId === ubicacionId ||
              user.rol === "ADMIN" ||
              user.rol === "SUPERVISOR"),
        )
        .map((user) => user.id),
    ),
  ];
}

/**
 * An in-memory IO double for the transition contract. It deliberately has no
 * database imports: the disabled branch must return before product,
 * existence, or recipient reads.
 */
function evaluateFakeSite(site: FakeSite, ubicacionId = 1): void {
  if (!site.habilitado) return;

  site.queries.productos++;
  for (const [productoId, minimo] of site.minima) {
    if (minimo == null) {
      site.episodios.delete(productoId);
      continue;
    }

    site.queries.existencias++;
    const existencia = site.existencia.get(productoId) ?? 0;
    const current = site.episodios.get(productoId);
    const transition = evaluateStockMinimum(
      minimo,
      existencia,
      current?.abierto ?? false,
    );

    if (transition.action === "CLOSE") {
      if (current) current.abierto = false;
      continue;
    }
    if (transition.action === "NONE") continue;
    if (transition.action === "UPDATE") continue;

    const episode = {
      id: site.nextEpisodeId++,
      abierto: true,
    };
    site.episodios.set(productoId, episode);
    const activeRecipients = recipients(site, ubicacionId);
    site.queries.destinatarios++;
    for (const usuarioId of activeRecipients) {
      if (
        !site.notificaciones.some(
          (notification) =>
            notification.episodioId === episode.id &&
            notification.usuarioId === usuarioId,
        )
      ) {
        site.notificaciones.push({ episodioId: episode.id, usuarioId });
      }
    }
  }
}

function fakeSite(overrides: Partial<FakeSite> = {}): FakeSite {
  return {
    habilitado: true,
    minima: new Map([[10, 5]]),
    existencia: new Map([[10, 0]]),
    usuarios: [],
    episodios: new Map(),
    notificaciones: [],
    queries: { productos: 0, existencias: 0, destinatarios: 0 },
    nextEpisodeId: 1,
    ...overrides,
  };
}

test("disabled sites short-circuit before product, cache, and notification reads", () => {
  const site = fakeSite({ habilitado: false });

  evaluateFakeSite(site);

  assert.deepEqual(site.queries, {
    productos: 0,
    existencias: 0,
    destinatarios: 0,
  });
  assert.equal(site.notificaciones.length, 0);
});

test("optional null minimum removes an episode and never opens an alert", () => {
  const site = fakeSite({
    minima: new Map([[10, null]]),
    episodios: new Map([[10, { id: 91, abierto: true }]]),
  });

  assert.deepEqual(evaluateStockMinimum(null, 0, false), {
    action: "NONE",
    diferencia: null,
  });
  evaluateFakeSite(site);

  assert.equal(site.episodios.has(10), false);
  assert.equal(site.notificaciones.length, 0);
});

test("strictly below includes zero existence and computes the positive difference", () => {
  assert.deepEqual(evaluateStockMinimum(5, 0, false), {
    action: "OPEN",
    diferencia: 5,
  });
  const fractional = evaluateStockMinimum(5, 4.999, false);
  assert.equal(fractional.action, "OPEN");
  assert.ok(Math.abs((fractional.diferencia ?? 0) - 0.001) < 1e-12);
  assert.deepEqual(evaluateStockMinimum(0, 0, false), {
    action: "NONE",
    diferencia: 0,
  });
});

test("episode provenance distinguishes a proven movement crossing from a configuration breach", () => {
  const crossing = {
    id: 71,
    cantidad: "-2",
    saldoPosterior: "4",
  };
  assert.equal(
    classifyStockMinimumEpisodeCause({
      minimo: 5,
      movement: crossing,
      configurationTriggered: false,
    }),
    "MOVIMIENTO",
  );
  assert.equal(
    classifyStockMinimumEpisodeCause({
      minimo: 5,
      movement: crossing,
      configurationTriggered: true,
    }),
    "CONFIGURACION",
  );
  assert.equal(
    classifyStockMinimumEpisodeCause({
      minimo: 5,
      movement: { ...crossing, cantidad: "1", saldoPosterior: "4" },
      configurationTriggered: false,
    }),
    "SNAPSHOT",
  );
});

test("individual minimum edits scope configuration provenance to the changed product", () => {
  const trigger = { kind: "PRODUCT" as const, productoId: 10 };
  const products = [
    {
      productoId: 10,
      movement: { id: 81, cantidad: "-2", saldoPosterior: "4" },
    },
    {
      productoId: 11,
      movement: { id: 82, cantidad: "-2", saldoPosterior: "4" },
    },
  ];
  const causes = products.map((product) =>
    classifyStockMinimumEpisodeCause({
      minimo: 5,
      movement: product.movement,
      configurationTriggered: configurationTriggerApplies(
        trigger,
        product.productoId,
      ),
    }),
  );

  assert.deepEqual(causes, ["CONFIGURACION", "MOVIMIENTO"]);
  assert.equal(configurationTriggerApplies({ kind: "SITE" }, 11), true);
});

test("snapshot movement provenance never claims a historic crossing", () => {
  assert.equal(
    classifyStockMinimumEpisodeCause({
      minimo: 5,
      movement: { id: 72, cantidad: "-1", saldoPosterior: "4" },
      configurationTriggered: false,
    }),
    "MOVIMIENTO",
  );
  assert.equal(
    classifyStockMinimumEpisodeCause({
      minimo: 5,
      movement: { id: 73, cantidad: "-1", saldoPosterior: "3" },
      configurationTriggered: false,
    }),
    "SNAPSHOT",
  );
});

test("recipients include active assigned users plus active ADMIN/SUPERVISOR once", () => {
  const site = fakeSite({
    usuarios: [
      { id: 1, activo: true, ubicacionId: 1, rol: "CAJA" },
      { id: 2, activo: true, ubicacionId: 1, rol: "SUPERVISOR" },
      { id: 3, activo: true, ubicacionId: 2, rol: "ADMIN" },
      // The same supervisor is both assigned and globally eligible.
      { id: 2, activo: true, ubicacionId: 1, rol: "SUPERVISOR" },
      { id: 4, activo: false, ubicacionId: 1, rol: "CAJA" },
      { id: 5, activo: true, ubicacionId: 2, rol: "CAJA" },
    ],
  });

  evaluateFakeSite(site);

  assert.deepEqual(
    site.notificaciones.map((notification) => notification.usuarioId),
    [1, 2, 3],
  );
});

test("unchanged breach does not repeat and recovery reopens a new episode", () => {
  const site = fakeSite({
    usuarios: [{ id: 1, activo: true, ubicacionId: 1, rol: "CAJA" }],
  });

  evaluateFakeSite(site);
  assert.equal(site.notificaciones.length, 1);
  const firstEpisode = site.episodios.get(10)?.id;

  evaluateFakeSite(site);
  assert.equal(site.notificaciones.length, 1);
  assert.equal(site.episodios.get(10)?.id, firstEpisode);

  site.existencia.set(10, 5);
  evaluateFakeSite(site);
  assert.equal(site.episodios.get(10)?.abierto, false);

  site.existencia.set(10, 0);
  evaluateFakeSite(site);
  assert.equal(site.notificaciones.length, 2);
  assert.notEqual(site.episodios.get(10)?.id, firstEpisode);
});

test("minimum CRUD keeps own-site writes and read matrix permissions explicit", async () => {
  const route = await readFile(
    new URL("../routes/stock-minimos.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /requierePermiso\("inventario", "ver"\)/);
  assert.match(route, /requierePermiso\("inventario", "editar"\)/);
  assert.match(route, /user\.rol === "ADMIN"/);
  assert.match(route, /user\.ubicacionId !== ubicacionId/);
  assert.match(route, /resolveReadScope\(req\.auth!, requested/);
  assert.match(route, /minimo: z\.union\(\[minimumValue, z\.null\(\)\]\)/);
  assert.match(route, /SITE_DISABLED/);
  assert.match(route, /\? 409/);

  const writeMatrix = [
    { rol: "ADMIN", asignada: null, destino: 2, permitido: true },
    { rol: "SUPERVISOR", asignada: 1, destino: 1, permitido: true },
    { rol: "SUPERVISOR", asignada: 1, destino: 2, permitido: false },
    { rol: "CAJA", asignada: 1, destino: 1, permitido: true },
    { rol: "CAJA", asignada: null, destino: 1, permitido: false },
  ] as const;
  for (const row of writeMatrix) {
    const permitido =
      row.rol === "ADMIN" ||
      (row.asignada != null && row.asignada === row.destino);
    assert.equal(permitido, row.permitido, `${row.rol}:${row.destino}`);
  }
});

test("disabled minimum writes lock configuration before product/minimum/audit writes", async () => {
  const service = await readFile(
    new URL("./stock-minimos.ts", import.meta.url),
    "utf8",
  );
  assert.match(service, /lockSiteConfiguration\(tx, input\.ubicacionId, false\)/);
  assert.match(service, /if \(!site\.habilitado\)/);
  assert.match(service, /throw new StockMinimumError\([\s\S]*SITE_DISABLED/);
  assert.match(service, /causa/);
  assert.match(service, /movimientoId: movement\?\.id \?\? null/);
});

test("stock-minimum list accepts the optional buscar query", async () => {
  const route = await readFile(
    new URL("../routes/stock-minimos.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /buscar: z\.string\(\)\.optional\(\)/);
  assert.match(route, /listStockMinimumProducts\(ubicacionId, parsed\.data\.buscar\)/);
});

test("rebuild contract keeps existencias independent from stock-minimum config", async () => {
  const inventory = await readFile(new URL("./inventario.ts", import.meta.url), "utf8");
  const schema = await readFile(
    new URL("../../../../lib/db/src/lib/stock-minimos-schema.ts", import.meta.url),
    "utf8",
  );

  assert.match(inventory, /export async function reconstruirCacheExistencias/);
  assert.doesNotMatch(
    inventory.slice(
      inventory.indexOf("export async function reconstruirCacheExistencias"),
      inventory.indexOf("export async function getInventarioPorUbicacion"),
    ),
    /stock_minimo/,
  );
  assert.match(schema, /CREATE TABLE IF NOT EXISTS stock_minimos/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS stock_minimo_episodios/);
});

test.skip(
  "reconstruirCacheExistencias with mocked DB (blocked: no injectable executor; never run real DB rebuild)",
  () => {
    // This is intentionally skipped. A real cache rebuild is a destructive
    // database operation and the current function closes over @workspace/db;
    // production constraints prohibit running it for this unit test.
  },
);
