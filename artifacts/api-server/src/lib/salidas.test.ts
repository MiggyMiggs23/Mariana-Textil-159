import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  ensureSalidasSchema,
  existenciasTable,
  movimientosTable,
  pool,
  productosTable,
  rollosTable,
  salidaLineasTable,
  salidaRollosTable,
  salidasTable,
  ubicacionesTable,
  usuariosTable,
} from "@workspace/db";
import { crearRollo, InventarioError } from "./inventario";
import {
  aceptarSalida,
  cancelarSalida,
  cerrarSalida,
  crearSalida,
  enviarSalida,
  prepararSalida,
  recibirSalida,
  rechazarSalida,
} from "./salidas";

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL) {
  throw new Error("Las pruebas de Salidas solo pueden ejecutarse con TEST_DATABASE_URL.");
}

const run = `SAL-${Date.now()}`;
const productoIds: number[] = [];
const ubicacionIds: number[] = [];
const rolloIds: number[] = [];
const salidaIds: number[] = [];

let usuarioId = 0;
let transitoId = 0;

before(async () => {
  await ensureSalidasSchema(pool);
  const [usuario] = await db
    .select({ id: usuariosTable.id })
    .from(usuariosTable)
    .where(eq(usuariosTable.activo, true))
    .limit(1);
  assert.ok(usuario, "La rama de prueba debe incluir al menos un usuario activo.");
  usuarioId = usuario.id;

  const [transito] = await db
    .select({ id: ubicacionesTable.id })
    .from(ubicacionesTable)
    .where(eq(ubicacionesTable.tipo, "TRANSITO"))
    .limit(1);
  assert.ok(transito, "La rama de prueba debe incluir la ubicación técnica de tránsito.");
  transitoId = transito.id;
});

async function fixture() {
  const suffix = `${run}-${productoIds.length + 1}`;
  const [producto] = await db
    .insert(productosTable)
    .values({
      sku: suffix,
      tela: `Tela ${suffix}`,
      color: "Azul",
      unidad: "METRO",
      precioSugerido: "100.00",
    })
    .returning();
  assert.ok(producto);
  productoIds.push(producto.id);

  const [origen, destino] = await db
    .insert(ubicacionesTable)
    .values([
      { nombre: `Origen ${suffix}`, tipo: "BODEGA" },
      { nombre: `Destino ${suffix}`, tipo: "TIENDA" },
    ])
    .returning();
  assert.ok(origen && destino);
  ubicacionIds.push(origen.id, destino.id);
  return { productoId: producto.id, origenId: origen.id, destinoId: destino.id };
}

async function rollo(productoId: number, ubicacionId: number, cantidad: string) {
  const result = await db.transaction((tx) =>
    crearRollo(tx, {
      productoId,
      ubicacionId,
      cantidadInicial: cantidad,
      costoUnitario: "40.00",
      usuarioId,
      estado: "DISPONIBLE",
    }),
  );
  rolloIds.push(result.rollo.id);
  return result.rollo;
}

async function solicitud(input: {
  productoId: number;
  origenId: number;
  destinoId: number;
  cantidad: string;
  uuidCliente?: string;
}) {
  const salida = await db.transaction((tx) =>
    crearSalida(tx, {
      uuidCliente: input.uuidCliente ?? randomUUID(),
      origenId: input.origenId,
      destinoId: input.destinoId,
      usuarioSolicitaId: usuarioId,
      lineas: [
        {
          productoId: input.productoId,
          cantidadSolicitada: input.cantidad,
          rollosSolicitados: null,
          nota: null,
        },
      ],
    }),
  );
  if (!salidaIds.includes(salida.id)) salidaIds.push(salida.id);
  return salida;
}

async function existencia(productoId: number, ubicacionId: number) {
  const [row] = await db
    .select({ total: existenciasTable.cantidadTotal })
    .from(existenciasTable)
    .where(
      and(
        eq(existenciasTable.productoId, productoId),
        eq(existenciasTable.ubicacionId, ubicacionId),
      ),
    )
    .limit(1);
  return Number(row?.total ?? 0);
}

async function assertCache(productoId: number, ubicacionIdsToCheck: number[]) {
  for (const ubicacionId of ubicacionIdsToCheck) {
    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(${movimientosTable.cantidad}), 0)::text` })
      .from(movimientosTable)
      .where(
        and(
          eq(movimientosTable.productoId, productoId),
          eq(movimientosTable.ubicacionId, ubicacionId),
        ),
      );
    assert.equal(
      Number(row?.total ?? 0),
      await existencia(productoId, ubicacionId),
      `El caché no coincide con kardex en ubicación ${ubicacionId}.`,
    );
  }
}

test("flujo 200 solicitado → 185 enviado/recibido/cerrado conserva inventario consolidado", async () => {
  const fx = await fixture();
  const rolls: Array<Awaited<ReturnType<typeof rollo>>> = [];
  for (const cantidad of ["40", "45", "50", "50"]) {
    rolls.push(await rollo(fx.productoId, fx.origenId, cantidad));
  }
  const uuidCliente = randomUUID();
  const [created, retry] = await Promise.all([
    solicitud({ ...fx, cantidad: "200", uuidCliente }),
    solicitud({ ...fx, cantidad: "200", uuidCliente }),
  ]);
  assert.equal(retry.id, created.id, "El UUID de cliente debe hacer idempotente la solicitud.");
  assert.ok(created.folio >= 500);

  const accepted = await db.transaction((tx) => aceptarSalida(tx, created.id, usuarioId));
  const lineId = accepted.lineas[0]!.id;
  await db.transaction((tx) =>
    prepararSalida(tx, {
      salidaId: created.id,
      usuarioId,
      lineas: [{ lineaId: lineId, rolloIds: rolls.map((item) => item.id) }],
    }),
  );
  const sent = await db.transaction((tx) =>
    enviarSalida(tx, {
      salidaId: created.id,
      usuarioId,
      transportista: "Unidad de prueba",
      notaEnvio: null,
    }),
  );
  assert.equal(sent.estado, "ENVIADA");
  assert.equal(sent.totalCantidadEnviada, "185.000");
  assert.equal(await existencia(fx.productoId, fx.origenId), 0);
  assert.equal(await existencia(fx.productoId, transitoId), 185);

  const received = await db.transaction((tx) =>
    recibirSalida(tx, {
      salidaId: created.id,
      usuarioId,
      notaRecepcion: null,
      rollos: rolls.map((item) => ({
        rolloId: item.id,
        recibido: true,
        cantidadRecibida: item.cantidadActual,
        notaDiferencia: null,
      })),
    }),
  );
  assert.equal(received.estado, "RECIBIDA");
  assert.equal(received.totalCantidadRecibida, "185.000");
  assert.equal(await existencia(fx.productoId, transitoId), 0);
  assert.equal(await existencia(fx.productoId, fx.destinoId), 185);

  const closed = await db.transaction((tx) => cerrarSalida(tx, created.id, usuarioId));
  assert.equal(closed.estado, "CERRADA");
  assert.equal(
    (await existencia(fx.productoId, fx.origenId)) +
      (await existencia(fx.productoId, transitoId)) +
      (await existencia(fx.productoId, fx.destinoId)),
    185,
  );
  await assertCache(fx.productoId, [fx.origenId, transitoId, fx.destinoId]);

  const documented = await db
    .select()
    .from(movimientosTable)
    .where(
      and(
        inArray(movimientosTable.rolloId, rolls.map((item) => item.id)),
        eq(movimientosTable.documentoId, String(created.id)),
      ),
    );
  assert.equal(documented.length, 16, "Cada rollo debe dejar cuatro movimientos documentados.");
  assert.deepEqual(
    [...new Set(documented.map((movement) => movement.documentoTipo))].sort(),
    ["RECEPCION_SALIDA", "SALIDA"],
  );
});

test("folios simultáneos son distintos", async () => {
  const fx = await fixture();
  const [first, second] = await Promise.all([
    solicitud({ ...fx, cantidad: "10" }),
    solicitud({ ...fx, cantidad: "11" }),
  ]);
  assert.notEqual(first.folio, second.folio);
});

test("dos salidas no pueden preparar simultáneamente el mismo rollo", async () => {
  const fx = await fixture();
  const selected = await rollo(fx.productoId, fx.origenId, "25");
  const [a, b] = await Promise.all([
    solicitud({ ...fx, cantidad: "25" }),
    solicitud({ ...fx, cantidad: "25" }),
  ]);
  const [acceptedA, acceptedB] = await Promise.all([
    db.transaction((tx) => aceptarSalida(tx, a.id, usuarioId)),
    db.transaction((tx) => aceptarSalida(tx, b.id, usuarioId)),
  ]);
  const results = await Promise.allSettled([
    db.transaction((tx) =>
      prepararSalida(tx, {
        salidaId: a.id,
        usuarioId,
        lineas: [{ lineaId: acceptedA.lineas[0]!.id, rolloIds: [selected.id] }],
      }),
    ),
    db.transaction((tx) =>
      prepararSalida(tx, {
        salidaId: b.id,
        usuarioId,
        lineas: [{ lineaId: acceptedB.lineas[0]!.id, rolloIds: [selected.id] }],
      }),
    ),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  const rejected = results.find((item) => item.status === "rejected");
  assert.ok(rejected?.status === "rejected");
  assert.ok(rejected.reason instanceof InventarioError);
  assert.equal(rejected.reason.code, "ROLLO_RESERVED");
});

test("diferencia de cantidad exige nota y genera ajuste documentado", async () => {
  const fx = await fixture();
  const selected = await rollo(fx.productoId, fx.origenId, "30");
  const created = await solicitud({ ...fx, cantidad: "30" });
  const accepted = await db.transaction((tx) => aceptarSalida(tx, created.id, usuarioId));
  await db.transaction((tx) =>
    prepararSalida(tx, {
      salidaId: created.id,
      usuarioId,
      lineas: [{ lineaId: accepted.lineas[0]!.id, rolloIds: [selected.id] }],
    }),
  );
  await db.transaction((tx) =>
    enviarSalida(tx, {
      salidaId: created.id,
      usuarioId,
      transportista: "Unidad de prueba",
      notaEnvio: null,
    }),
  );
  await assert.rejects(
    db.transaction((tx) =>
      recibirSalida(tx, {
        salidaId: created.id,
        usuarioId,
        notaRecepcion: null,
        rollos: [
          {
            rolloId: selected.id,
            recibido: true,
            cantidadRecibida: "28",
            notaDiferencia: "corta",
          },
        ],
      }),
    ),
    (error: unknown) => error instanceof InventarioError && error.code === "DIFFERENCE_NOTE_REQUIRED",
  );
  await db.transaction((tx) =>
    recibirSalida(tx, {
      salidaId: created.id,
      usuarioId,
      notaRecepcion: null,
      rollos: [
        {
          rolloId: selected.id,
          recibido: true,
          cantidadRecibida: "28",
          notaDiferencia: "Merma confirmada al medir el rollo",
        },
      ],
    }),
  );
  assert.equal(await existencia(fx.productoId, fx.destinoId), 28);
  const rollMovements = await db
    .select()
    .from(movimientosTable)
    .where(eq(movimientosTable.rolloId, selected.id));
  const adjustment = rollMovements.find(
    (movement) =>
      movement.tipo === "AJUSTE_NEGATIVO" &&
      movement.documentoTipo === "RECEPCION_SALIDA" &&
      movement.documentoId === String(created.id),
  );
  assert.ok(
    adjustment,
    `No se encontró ajuste documentado: ${JSON.stringify(
      rollMovements.map((movement) => ({
        tipo: movement.tipo,
        documentoTipo: movement.documentoTipo,
        documentoId: movement.documentoId,
      })),
    )}`,
  );
  assert.equal(adjustment.revisado, true);
  await assertCache(fx.productoId, [fx.origenId, transitoId, fx.destinoId]);
});

test("rollo no recibido permanece en tránsito, bloquea cierre y puede recibirse después", async () => {
  const fx = await fixture();
  const selected = await rollo(fx.productoId, fx.origenId, "20");
  const created = await solicitud({ ...fx, cantidad: "20" });
  const accepted = await db.transaction((tx) => aceptarSalida(tx, created.id, usuarioId));
  await db.transaction((tx) =>
    prepararSalida(tx, {
      salidaId: created.id,
      usuarioId,
      lineas: [{ lineaId: accepted.lineas[0]!.id, rolloIds: [selected.id] }],
    }),
  );
  await db.transaction((tx) =>
    enviarSalida(tx, {
      salidaId: created.id,
      usuarioId,
      transportista: "Unidad de prueba",
      notaEnvio: null,
    }),
  );
  await assert.rejects(
    db.transaction((tx) =>
      cancelarSalida(tx, created.id, usuarioId, "Cancelación posterior al envío"),
    ),
    (error: unknown) => error instanceof InventarioError && error.code === "INVALID_SALIDA_STATE",
  );
  await db.transaction((tx) =>
    recibirSalida(tx, {
      salidaId: created.id,
      usuarioId,
      notaRecepcion: null,
      rollos: [
        {
          rolloId: selected.id,
          recibido: false,
          cantidadRecibida: null,
          notaDiferencia: "No llegó en el transporte asignado",
        },
      ],
    }),
  );
  const [inTransit] = await db
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.id, selected.id));
  assert.equal(inTransit?.estado, "EN_TRANSITO");
  assert.equal(inTransit?.ubicacionId, transitoId);
  await assert.rejects(
    db.transaction((tx) => cerrarSalida(tx, created.id, usuarioId)),
    (error: unknown) => error instanceof InventarioError && error.code === "PENDING_ROLLOS",
  );
  await db.transaction((tx) =>
    recibirSalida(tx, {
      salidaId: created.id,
      usuarioId,
      notaRecepcion: null,
      rollos: [
        {
          rolloId: selected.id,
          recibido: true,
          cantidadRecibida: "20",
          notaDiferencia: null,
        },
      ],
    }),
  );
  const closed = await db.transaction((tx) => cerrarSalida(tx, created.id, usuarioId));
  assert.equal(closed.estado, "CERRADA");
});

test("saltos de estado y motivos insuficientes son rechazados", async () => {
  const fx = await fixture();
  const created = await solicitud({ ...fx, cantidad: "10" });
  await assert.rejects(
    db.transaction((tx) =>
      enviarSalida(tx, {
        salidaId: created.id,
        usuarioId,
        transportista: "Unidad",
        notaEnvio: null,
      }),
    ),
    (error: unknown) => error instanceof InventarioError && error.code === "INVALID_SALIDA_STATE",
  );
  await assert.rejects(
    db.transaction((tx) => rechazarSalida(tx, created.id, usuarioId, "corto")),
    (error: unknown) => error instanceof InventarioError && error.code === "REASON_REQUIRED",
  );
  await assert.rejects(
    db.transaction((tx) => cancelarSalida(tx, created.id, usuarioId, "corto")),
    (error: unknown) => error instanceof InventarioError && error.code === "REASON_REQUIRED",
  );
});

after(async () => {
  await db.transaction(async (tx) => {
    if (salidaIds.length > 0) {
      await tx.delete(salidaRollosTable).where(inArray(salidaRollosTable.salidaId, salidaIds));
      await tx.delete(salidaLineasTable).where(inArray(salidaLineasTable.salidaId, salidaIds));
      await tx.delete(salidasTable).where(inArray(salidasTable.id, salidaIds));
    }
    if (rolloIds.length > 0) {
      await tx.delete(movimientosTable).where(inArray(movimientosTable.rolloId, rolloIds));
      await tx.delete(rollosTable).where(inArray(rollosTable.id, rolloIds));
    }
    if (productoIds.length > 0) {
      await tx.delete(existenciasTable).where(inArray(existenciasTable.productoId, productoIds));
      await tx.delete(productosTable).where(inArray(productosTable.id, productoIds));
    }
    if (ubicacionIds.length > 0) {
      await tx.delete(ubicacionesTable).where(inArray(ubicacionesTable.id, ubicacionIds));
    }
  });
});