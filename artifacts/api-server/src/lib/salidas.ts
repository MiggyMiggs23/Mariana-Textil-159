/**
 * Salidas workflow. This module owns the document lifecycle only; every change
 * to rollos, movimientos or existencias is delegated to inventario.ts.
 */
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  auditoriaTable,
  movimientosTable,
  notificacionesSistemaTable,
  productosTable,
  rollosTable,
  salidaFolioTable,
  salidaLineasTable,
  salidaRollosTable,
  salidasTable,
  ubicacionesTable,
  usuariosTable,
  viajeSalidasTable,
  viajesTable,
  camionetasTable,
  choferesTable,
  type EstadoSalida,
} from "@workspace/db";
import {
  InventarioError,
  moverRollo,
  recibirTransferencia,
  salidaMostrador,
  type Tx,
} from "./inventario";

export type CrearSalidaInput = {
  origenId: number;
  destinoId: number;
  usuarioSolicitaId: number;
  uuidCliente: string;
  transportista?: string | null;
  observaciones?: string | null;
  rolloIds?: number[];
};

export type CrearSalidaMostradorInput = {
  origenId: number;
  usuarioId: number;
  uuidCliente: string;
  series: string[];
  observaciones?: string | null;
  ip: string;
};

async function getSalidaFolioFormateado(
  tx: Tx,
  salida: { origenId: number; folio: number },
): Promise<string> {
  const [origen] = await tx
    .select({ iniciales: ubicacionesTable.iniciales })
    .from(ubicacionesTable)
    .where(eq(ubicacionesTable.id, salida.origenId))
    .limit(1);
  return `${origen?.iniciales ?? ""}-${String(salida.folio).padStart(6, "0")}`;
}

type EnviarSalidaInput = {
  salidaId: number;
  usuarioId: number;
  transportista?: string | null;
  notaEnvio?: string | null;
};

export type AgregarRolloBorradorSalidaInput = {
  origenId: number;
  destinoId: number;
  usuarioId: number;
  uuidCliente: string;
  serie: string;
};

type RecibirSalidaInput = {
  salidaId: number;
  usuarioId: number;
  completa: boolean;
  nota?: string | null;
  ip: string;
};

type SalidaHeader = typeof salidasTable.$inferSelect;
type SalidaLinea = typeof salidaLineasTable.$inferSelect;
type SalidaRollo = typeof salidaRollosTable.$inferSelect;
type ReadDb = Pick<typeof db, "select">;

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function requireState(
  salida: SalidaHeader,
  allowed: EstadoSalida[],
  action: string,
): void {
  if (!allowed.includes(salida.estado)) {
    throw new InventarioError(
      `No se puede ${action} una salida en estado ${salida.estado}.`,
      "INVALID_SALIDA_STATE",
    );
  }
}

async function reserveSalidaFolio(tx: Tx, origenId: number): Promise<number> {
  await tx
    .insert(salidaFolioTable)
    .values({ ubicacionId: origenId, ultimoFolio: 0 })
    .onConflictDoNothing();

  const [row] = await tx
    .select()
    .from(salidaFolioTable)
    .where(eq(salidaFolioTable.ubicacionId, origenId))
    .for("update");
  const next = row!.ultimoFolio + 1;
  await tx
    .update(salidaFolioTable)
    .set({ ultimoFolio: next })
    .where(eq(salidaFolioTable.ubicacionId, origenId));
  return next;
}

async function getSalidaForUpdate(tx: Tx, salidaId: number): Promise<SalidaHeader> {
  const [salida] = await tx
    .select()
    .from(salidasTable)
    .where(eq(salidasTable.id, salidaId))
    .for("update")
    .limit(1);
  if (!salida) {
    throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
  }
  return salida;
}

async function getEntityMaps(database: ReadDb, salida: SalidaHeader) {
  const locationIds = [salida.origenId, salida.destinoId].filter(
    (id): id is number => id != null,
  );
  const userIds = [
    salida.usuarioSolicitaId,
    salida.usuarioEnviaId,
    salida.usuarioRecibeId,
    salida.usuarioCancelaId,
  ].filter((id): id is number => id != null);
  const locations = await database
    .select({
      id: ubicacionesTable.id,
      nombre: ubicacionesTable.nombre,
      iniciales: ubicacionesTable.iniciales,
    })
    .from(ubicacionesTable)
    .where(inArray(ubicacionesTable.id, locationIds));
  const users = userIds.length
    ? await database
        .select({ id: usuariosTable.id, nombre: usuariosTable.nombre })
        .from(usuariosTable)
        .where(inArray(usuariosTable.id, userIds))
    : [];
  return {
    locations: new Map(locations.map((row) => [row.id, row])),
    users: new Map(users.map((row) => [row.id, row.nombre])),
  };
}

export async function buildSalidaDetail(
  database: ReadDb,
  salidaId: number,
) {
  const [salida] = await database
    .select()
    .from(salidasTable)
    .where(eq(salidasTable.id, salidaId))
    .limit(1);
  if (!salida) return null;

  const [{ locations, users }, lineas, rollos] = await Promise.all([
    getEntityMaps(database, salida),
    database
      .select({
        id: salidaLineasTable.id,
        salidaId: salidaLineasTable.salidaId,
        productoId: salidaLineasTable.productoId,
        cantidadSolicitada: salidaLineasTable.cantidadSolicitada,
        cantidadEnviada: salidaLineasTable.cantidadEnviada,
        cantidadRecibida: salidaLineasTable.cantidadRecibida,
        rollosSolicitados: salidaLineasTable.rollosSolicitados,
        nota: salidaLineasTable.nota,
        sku: productosTable.sku,
        tela: productosTable.tela,
        color: productosTable.color,
        unidad: productosTable.unidad,
      })
      .from(salidaLineasTable)
      .innerJoin(productosTable, eq(salidaLineasTable.productoId, productosTable.id))
      .where(eq(salidaLineasTable.salidaId, salida.id))
      .orderBy(salidaLineasTable.id),
    database
      .select({
        id: salidaRollosTable.id,
        salidaId: salidaRollosTable.salidaId,
        lineaId: salidaRollosTable.lineaId,
        rolloId: salidaRollosTable.rolloId,
        cantidadEnviada: salidaRollosTable.cantidadEnviada,
        cantidadRecibida: salidaRollosTable.cantidadRecibida,
        recibido: salidaRollosTable.recibido,
        notaDiferencia: salidaRollosTable.notaDiferencia,
        serie: rollosTable.serie,
        estado: rollosTable.estado,
        cantidadActual: rollosTable.cantidadActual,
        productoId: productosTable.id,
        sku: productosTable.sku,
        tela: productosTable.tela,
        color: productosTable.color,
        unidad: productosTable.unidad,
      })
      .from(salidaRollosTable)
      .innerJoin(rollosTable, eq(salidaRollosTable.rolloId, rollosTable.id))
      .innerJoin(productosTable, eq(rollosTable.productoId, productosTable.id))
      .where(eq(salidaRollosTable.salidaId, salida.id))
      .orderBy(salidaRollosTable.id),
  ]);
  const [viaje] = await database.select({
    id: viajesTable.id, folio: viajesTable.folio, nombreCamioneta: camionetasTable.nombre,
    placasCamioneta: camionetasTable.placas, nombreChofer: choferesTable.nombreCompleto,
    telefonoChofer: choferesTable.telefono,
  }).from(viajeSalidasTable).innerJoin(viajesTable, eq(viajeSalidasTable.viajeId, viajesTable.id))
    .innerJoin(camionetasTable, eq(viajesTable.camionetaId, camionetasTable.id))
    .innerJoin(choferesTable, eq(viajesTable.choferId, choferesTable.id))
    .where(eq(viajeSalidasTable.salidaId, salidaId)).limit(1);

  const total = (field: "cantidadSolicitada" | "cantidadEnviada" | "cantidadRecibida") =>
    lineas.reduce((sum, linea) => sum + Number(linea[field]), 0).toFixed(3);
  const requestedById = salida.usuarioSolicitaId ?? 0;
  const rollsPerLine = new Map<number, { sent: number; received: number }>();
  for (const rollo of rollos) {
    const current = rollsPerLine.get(rollo.lineaId) ?? { sent: 0, received: 0 };
    current.sent += 1;
    if (rollo.recibido) current.received += 1;
    rollsPerLine.set(rollo.lineaId, current);
  }
  const totalRollos = rollos.length;
  const totalMetros = rollos
    .filter((rollo) => rollo.unidad === "METRO")
    .reduce((sum, rollo) => sum + Number(rollo.cantidadEnviada), 0)
    .toFixed(3);
  const totalKilos = rollos
    .filter((rollo) => rollo.unidad === "KILO")
    .reduce((sum, rollo) => sum + Number(rollo.cantidadEnviada), 0)
    .toFixed(3);

  return {
    id: salida.id,
    modalidad: salida.modalidad,
    folio: salida.folio,
    inicialesSitio: locations.get(salida.origenId)?.iniciales ?? "",
    folioFormateado: `${locations.get(salida.origenId)?.iniciales ?? ""}-${String(salida.folio).padStart(6, "0")}`,
    origenId: salida.origenId,
    destinoId: salida.destinoId ?? null,
    nombreOrigen: locations.get(salida.origenId)?.nombre ?? "Ubicación eliminada",
    nombreDestino:
      salida.modalidad === "MOSTRADOR"
        ? "Mostrador"
        : locations.get(salida.destinoId!)?.nombre ?? "Ubicación eliminada",
    estado: salida.estado,
    armadoPorId: requestedById,
    nombreArmadoPor: users.get(requestedById) ?? "Usuario eliminado",
    fechaArmado: iso(salida.solicitadaAt) ?? salida.createdAt.toISOString(),
    enviadoPorId: salida.usuarioEnviaId ?? null,
    nombreEnviadoPor: salida.usuarioEnviaId ? (users.get(salida.usuarioEnviaId) ?? null) : null,
    fechaEnvio: iso(salida.enviadaAt),
    recibidoPorId: salida.usuarioRecibeId ?? null,
    nombreRecibidoPor: salida.usuarioRecibeId ? (users.get(salida.usuarioRecibeId) ?? null) : null,
    fechaRecepcion: iso(salida.recibidaAt),
    canceladoPorId: salida.usuarioCancelaId ?? null,
    nombreCanceladoPor: salida.usuarioCancelaId ? (users.get(salida.usuarioCancelaId) ?? null) : null,
    fechaCancelacion: iso(salida.canceladaAt),
    motivoCancelacion: salida.motivoCancelacion ?? null,
    notaEnvio: salida.notaEnvio ?? null,
    notaRecepcion: salida.notaRecepcion ?? null,
    transportista: salida.transportista ?? null,
    viaje: viaje ?? null,
    transporteEfectivo: viaje ? `${viaje.nombreCamioneta} · ${viaje.placasCamioneta} · ${viaje.nombreChofer}` : salida.transportista ?? null,
    uuidCliente: salida.uuidCliente,
    createdAt: salida.createdAt.toISOString(),
    updatedAt: salida.actividadAt.toISOString(),
    totalProductos: lineas.length,
    totalRollos,
    totalMetros,
    totalKilos,
    usuarioId: salida.usuarioSolicitaId ?? null,
    nombreUsuario: users.get(salida.usuarioSolicitaId ?? 0) ?? null,
    observaciones: salida.notaSolicitud ?? null,
    totalCantidadSolicitada: total("cantidadSolicitada"),
    totalCantidadEnviada: total("cantidadEnviada"),
    totalCantidadRecibida: total("cantidadRecibida"),
    diferenciasPendientes:
      salida.modalidad === "TRASLADO" &&
      salida.estado === "RECIBIDA" &&
      rollos.some((rollo) => !rollo.recibido),
    lineas: lineas.map((linea) => ({
      id: linea.id,
      productoId: linea.productoId,
      skuProducto: linea.sku,
      telaProducto: linea.tela,
      colorProducto: linea.color,
      unidadProducto: linea.unidad,
      cantidadSolicitada: linea.cantidadSolicitada,
      cantidadEnviada: linea.cantidadEnviada,
      cantidadRecibida: linea.cantidadRecibida,
      rollosSolicitados: linea.rollosSolicitados ?? null,
      rollosEnviados: rollsPerLine.get(linea.id)?.sent ?? 0,
      rollosRecibidos: rollsPerLine.get(linea.id)?.received ?? 0,
      nota: linea.nota ?? null,
    })),
    rollos: rollos.map((rollo) => ({
      ...rollo,
      cantidadRecibida: rollo.cantidadRecibida ?? null,
      notaDiferencia: rollo.notaDiferencia ?? null,
      diferencia:
        rollo.cantidadRecibida == null
          ? null
          : (Number(rollo.cantidadRecibida) - Number(rollo.cantidadEnviada)).toFixed(3),
    })),
  };
}

async function requireSalidaDetail(database: ReadDb, salidaId: number) {
  const detail = await buildSalidaDetail(database, salidaId);
  if (!detail) {
    throw new InventarioError("Salida no encontrada.", "SALIDA_NOT_FOUND");
  }
  return detail;
}

export async function crearSalida(tx: Tx, input: CrearSalidaInput) {
  const rolloIds = input.rolloIds ?? [];
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`salida-borrador:${input.usuarioSolicitaId}:${input.origenId}`}, 0))`,
  );
  // Serialize retries for the same client UUID before the read/insert pair.
  // This makes concurrent duplicates return the first document instead of a
  // unique-constraint error.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.uuidCliente}, 0))`,
  );
  const [duplicate] = await tx
    .select({ id: salidasTable.id })
    .from(salidasTable)
    .where(eq(salidasTable.uuidCliente, input.uuidCliente))
    .limit(1);
  if (duplicate) return requireSalidaDetail(tx, duplicate.id);

  const [activeDraft] = await tx
    .select({ id: salidasTable.id })
    .from(salidasTable)
    .where(
      and(
        eq(salidasTable.estado, "ARMANDO"),
        eq(salidasTable.usuarioSolicitaId, input.usuarioSolicitaId),
        eq(salidasTable.origenId, input.origenId),
      ),
    )
    .limit(1);
  if (activeDraft) {
    throw new InventarioError(
      "Ya existe un borrador activo para este usuario y origen.",
      "DRAFT_ALREADY_EXISTS",
    );
  }

  if (input.origenId === input.destinoId) {
    throw new InventarioError("El origen y el destino deben ser diferentes.", "SAME_LOCATION");
  }
  if (!rolloIds.length) throw new InventarioError("La salida debe incluir al menos un rollo.", "EMPTY_SALIDA");
  if (new Set(rolloIds).size !== rolloIds.length) throw new InventarioError("Un rollo no puede repetirse.", "DUPLICATE_ROLL");

  const [locations, rollos] = await Promise.all([
    tx
      .select()
      .from(ubicacionesTable)
      .where(inArray(ubicacionesTable.id, [input.origenId, input.destinoId])),
    tx.select().from(rollosTable).where(inArray(rollosTable.id, rolloIds)).for("update"),
  ]);
  if (locations.length !== 2 || locations.some((location) => !location.activa || ["TRANSITO", "EXTERNO"].includes(location.tipo))) {
    throw new InventarioError("El origen o destino no es una ubicación operativa activa.", "INVALID_LOCATION");
  }
  if (rollos.length !== rolloIds.length) throw new InventarioError("Uno de los rollos no existe.", "ROLLO_NOT_FOUND");
  for (const rollo of rollos) {
    if (rollo.ubicacionId !== input.origenId) {
      throw new InventarioError(`El rollo ${rollo.serie} está en otra ubicación.`, "LOCATION_MISMATCH");
    }
    if (rollo.estado !== "DISPONIBLE") {
      throw new InventarioError(`El rollo ${rollo.serie} no está DISPONIBLE.`, "ROLLO_UNAVAILABLE");
    }
  }
  const reserved = await tx
    .select({ rolloId: salidaRollosTable.rolloId })
    .from(salidaRollosTable)
    .innerJoin(salidasTable, eq(salidaRollosTable.salidaId, salidasTable.id))
    .where(
      and(
        inArray(salidaRollosTable.rolloId, rolloIds),
        inArray(salidasTable.estado, ["ARMANDO", "EN_TRANSITO"]),
      ),
    )
    .limit(1);
  if (reserved.length) {
    throw new InventarioError("Uno de los rollos ya pertenece a una salida activa.", "ROLLO_RESERVED");
  }

  // Folio allocation is intentionally after every validation and row lock.
  const folio = await reserveSalidaFolio(tx, input.origenId);
  const [salida] = await tx
    .insert(salidasTable)
    .values({
      folio,
      origenId: input.origenId,
      destinoId: input.destinoId,
      usuarioSolicitaId: input.usuarioSolicitaId,
      estado: "ARMANDO",
      notaSolicitud: input.observaciones?.trim() || null,
      transportista: input.transportista?.trim() || null,
      uuidCliente: input.uuidCliente,
      solicitadaAt: new Date(),
    })
    .returning({ id: salidasTable.id });
  const groups = new Map<number, typeof rollos>();
  for (const rollo of rollos) groups.set(rollo.productoId, [...(groups.get(rollo.productoId) ?? []), rollo]);
  const lineas = await tx.insert(salidaLineasTable).values([...groups.entries()].map(([productoId, rs]) => ({
    salidaId: salida!.id, productoId,
    cantidadSolicitada: rs.reduce((n, r) => n + Number(r.cantidadActual), 0).toFixed(3),
    cantidadEnviada: "0",
    cantidadRecibida: "0",
    rollosSolicitados: rs.length,
  }))).returning();
  const lineByProduct = new Map(lineas.map((linea) => [linea.productoId, linea]));
  await tx.insert(salidaRollosTable).values(rollos.map((rollo) => ({
    salidaId: salida!.id, lineaId: lineByProduct.get(rollo.productoId)!.id, rolloId: rollo.id,
    cantidadEnviada: rollo.cantidadActual, cantidadRecibida: null, recibido: false,
  })));
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioSolicitaId, accion: "CREAR", entidad: "salidas", entidadId: String(salida!.id),
    datosDespues: { folio, origenId: input.origenId, destinoId: input.destinoId, rolloIds },
    ip: "desconocida",
  });
  return requireSalidaDetail(tx, salida!.id);
}

/**
 * Creates and completes a counter-exit atomically. It has no destination:
 * each roll leaves through the existing salidaMostrador primitive and remains
 * MOSTRADOR as a terminal state with zero remaining quantity.
 */
export async function crearSalidaMostrador(
  tx: Tx,
  input: CrearSalidaMostradorInput,
) {
  const series = input.series.map((serie) => serie.trim().toUpperCase());
  if (!series.length) {
    throw new InventarioError("La salida a mostrador debe incluir al menos un rollo.", "EMPTY_SALIDA");
  }
  if (series.some((serie) => !serie) || new Set(series).size !== series.length) {
    throw new InventarioError("Las series deben ser válidas y no pueden repetirse.", "DUPLICATE_ROLL");
  }

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.uuidCliente}, 0))`,
  );
  const [duplicate] = await tx
    .select({
      id: salidasTable.id,
      origenId: salidasTable.origenId,
      modalidad: salidasTable.modalidad,
      usuarioId: salidasTable.usuarioSolicitaId,
    })
    .from(salidasTable)
    .where(eq(salidasTable.uuidCliente, input.uuidCliente))
    .limit(1);
  if (duplicate) {
    if (
      duplicate.origenId !== input.origenId ||
      duplicate.modalidad !== "MOSTRADOR" ||
      duplicate.usuarioId !== input.usuarioId
    ) {
      throw new InventarioError(
        "El identificador de esta captura ya fue utilizado.",
        "UUID_ALREADY_USED",
      );
    }
    return requireSalidaDetail(tx, duplicate.id);
  }

  const [origen] = await tx
    .select()
    .from(ubicacionesTable)
    .where(eq(ubicacionesTable.id, input.origenId))
    .limit(1);
  if (!origen || !origen.activa || !["TIENDA", "BODEGA"].includes(origen.tipo)) {
    throw new InventarioError("El origen no es una ubicación operativa activa.", "INVALID_LOCATION");
  }

  const rollos = await tx
    .select()
    .from(rollosTable)
    .where(inArray(rollosTable.serie, series))
    .for("update");
  if (rollos.length !== series.length) {
    throw new InventarioError("Una de las series no existe.", "ROLLO_NOT_FOUND");
  }
  for (const rollo of rollos) {
    if (rollo.ubicacionId !== input.origenId) {
      throw new InventarioError(`El rollo ${rollo.serie} está en otra ubicación.`, "LOCATION_MISMATCH");
    }
    if (rollo.estado !== "DISPONIBLE") {
      throw new InventarioError(`El rollo ${rollo.serie} no está DISPONIBLE.`, "ROLLO_UNAVAILABLE");
    }
  }
  const [reservation] = await tx
    .select({ rolloId: salidaRollosTable.rolloId })
    .from(salidaRollosTable)
    .innerJoin(salidasTable, eq(salidaRollosTable.salidaId, salidasTable.id))
    .where(and(
      inArray(salidaRollosTable.rolloId, rollos.map((rollo) => rollo.id)),
      inArray(salidasTable.estado, ["ARMANDO", "EN_TRANSITO"]),
    ))
    .limit(1);
  if (reservation) {
    throw new InventarioError("Uno de los rollos ya pertenece a una salida activa.", "ROLLO_RESERVED");
  }

  const folio = await reserveSalidaFolio(tx, input.origenId);
  const now = new Date();
  const [salida] = await tx
    .insert(salidasTable)
    .values({
      folio,
      origenId: input.origenId,
      destinoId: null,
      modalidad: "MOSTRADOR",
      estado: "RECIBIDA",
      usuarioSolicitaId: input.usuarioId,
      usuarioEnviaId: input.usuarioId,
      solicitadaAt: now,
      enviadaAt: now,
      recibidaAt: now,
      notaSolicitud: input.observaciones?.trim() || null,
      uuidCliente: input.uuidCliente,
      actividadAt: now,
    })
    .returning({ id: salidasTable.id });

  const groups = new Map<number, typeof rollos>();
  for (const rollo of rollos) {
    groups.set(rollo.productoId, [...(groups.get(rollo.productoId) ?? []), rollo]);
  }
  const lineas = await tx
    .insert(salidaLineasTable)
    .values([...groups.entries()].map(([productoId, items]) => {
      const cantidad = items.reduce((sum, item) => sum + Number(item.cantidadActual), 0).toFixed(3);
      return {
        salidaId: salida!.id,
        productoId,
        cantidadSolicitada: cantidad,
        cantidadEnviada: cantidad,
        cantidadRecibida: "0",
        rollosSolicitados: items.length,
      };
    }))
    .returning();
  const lineByProduct = new Map(lineas.map((linea) => [linea.productoId, linea.id]));
  await tx.insert(salidaRollosTable).values(rollos.map((rollo) => ({
    salidaId: salida!.id,
    lineaId: lineByProduct.get(rollo.productoId)!,
    rolloId: rollo.id,
    cantidadEnviada: rollo.cantidadActual,
    cantidadRecibida: null,
    recibido: false,
  })));

  for (const rollo of rollos) {
    await salidaMostrador(tx, {
      rolloId: rollo.id,
      usuarioId: input.usuarioId,
      justificacion: `Salida a mostrador ${origen.iniciales}-${String(folio).padStart(6, "0")}.`,
      documentoTipo: "SALIDA",
      documentoId: String(salida!.id),
    });
  }
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "CREAR_MOSTRADOR",
    entidad: "salidas",
    entidadId: String(salida!.id),
    datosDespues: {
      modalidad: "MOSTRADOR",
      folio,
      sitioId: input.origenId,
      rolloIds: rollos.map((rollo) => rollo.id),
      series,
      fecha: now.toISOString(),
    },
    ip: input.ip,
  });
  return requireSalidaDetail(tx, salida!.id);
}

async function validateOperationalLocations(
  tx: Tx,
  origenId: number,
  destinoId: number,
): Promise<void> {
  if (origenId === destinoId) {
    throw new InventarioError(
      "El origen y el destino deben ser diferentes.",
      "SAME_LOCATION",
    );
  }
  const locations = await tx
    .select()
    .from(ubicacionesTable)
    .where(inArray(ubicacionesTable.id, [origenId, destinoId]));
  if (
    locations.length !== 2 ||
    locations.some(
      (location) =>
        !location.activa || ["TRANSITO", "EXTERNO"].includes(location.tipo),
    )
  ) {
    throw new InventarioError(
      "El origen o destino no es una ubicación operativa activa.",
      "INVALID_LOCATION",
    );
  }
}

export async function obtenerBorradorSalida(
  database: ReadDb,
  usuarioId: number,
  origenId: number,
) {
  const [draft] = await database
    .select({ id: salidasTable.id })
    .from(salidasTable)
    .where(
      and(
        eq(salidasTable.estado, "ARMANDO"),
        eq(salidasTable.usuarioSolicitaId, usuarioId),
        eq(salidasTable.origenId, origenId),
      ),
    )
    .orderBy(desc(salidasTable.actividadAt))
    .limit(1);
  return draft ? requireSalidaDetail(database, draft.id) : null;
}

async function recomputeDraftLine(
  tx: Tx,
  salidaId: number,
  lineaId: number,
): Promise<void> {
  const [totals] = await tx
    .select({
      cantidad:
        sql<string>`COALESCE(SUM(${salidaRollosTable.cantidadEnviada}), 0)::text`,
      rollos: count(),
    })
    .from(salidaRollosTable)
    .where(
      and(
        eq(salidaRollosTable.salidaId, salidaId),
        eq(salidaRollosTable.lineaId, lineaId),
      ),
    );
  if (!totals || totals.rollos === 0) {
    await tx
      .delete(salidaLineasTable)
      .where(
        and(
          eq(salidaLineasTable.id, lineaId),
          eq(salidaLineasTable.salidaId, salidaId),
        ),
      );
    return;
  }
  await tx
    .update(salidaLineasTable)
    .set({
      cantidadSolicitada: Number(totals.cantidad).toFixed(3),
      cantidadEnviada: "0",
      cantidadRecibida: "0",
      rollosSolicitados: totals.rollos,
    })
    .where(eq(salidaLineasTable.id, lineaId));
}

export async function agregarRolloBorradorSalida(
  tx: Tx,
  input: AgregarRolloBorradorSalidaInput,
) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`salida-borrador:${input.usuarioId}:${input.origenId}`}, 0))`,
  );
  await validateOperationalLocations(tx, input.origenId, input.destinoId);

  const [rollo] = await tx
    .select()
    .from(rollosTable)
    .where(eq(rollosTable.serie, input.serie))
    .for("update")
    .limit(1);
  if (!rollo) {
    throw new InventarioError("Serie no encontrada.", "ROLLO_NOT_FOUND");
  }
  if (rollo.ubicacionId !== input.origenId) {
    throw new InventarioError(
      `La serie ${rollo.serie} está en otra ubicación.`,
      "LOCATION_MISMATCH",
    );
  }
  if (rollo.estado !== "DISPONIBLE") {
    throw new InventarioError(
      `La serie ${rollo.serie} no está DISPONIBLE.`,
      "ROLLO_UNAVAILABLE",
    );
  }

  let [salida] = await tx
    .select()
    .from(salidasTable)
    .where(
      and(
        eq(salidasTable.estado, "ARMANDO"),
        eq(salidasTable.usuarioSolicitaId, input.usuarioId),
        eq(salidasTable.origenId, input.origenId),
      ),
    )
    .orderBy(desc(salidasTable.actividadAt))
    .for("update")
    .limit(1);

  if (salida && salida.destinoId !== input.destinoId) {
    throw new InventarioError(
      "El borrador activo pertenece a otro destino. Retómalo antes de escanear.",
      "DRAFT_DESTINATION_MISMATCH",
    );
  }

  if (salida) {
    const [sameAssociation] = await tx
      .select({ id: salidaRollosTable.id })
      .from(salidaRollosTable)
      .where(
        and(
          eq(salidaRollosTable.salidaId, salida.id),
          eq(salidaRollosTable.rolloId, rollo.id),
        ),
      )
      .limit(1);
    if (sameAssociation) {
      await tx
        .update(salidasTable)
        .set({ actividadAt: new Date() })
        .where(eq(salidasTable.id, salida.id));
      return requireSalidaDetail(tx, salida.id);
    }
  } else {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.uuidCliente}, 0))`,
    );
    const [duplicateUuid] = await tx
      .select({ id: salidasTable.id })
      .from(salidasTable)
      .where(eq(salidasTable.uuidCliente, input.uuidCliente))
      .limit(1);
    if (duplicateUuid) {
      throw new InventarioError(
        "El identificador de esta captura ya fue utilizado.",
        "UUID_ALREADY_USED",
      );
    }
  }

  const [reservation] = await tx
    .select({ salidaId: salidaRollosTable.salidaId })
    .from(salidaRollosTable)
    .innerJoin(salidasTable, eq(salidaRollosTable.salidaId, salidasTable.id))
    .where(
      and(
        eq(salidaRollosTable.rolloId, rollo.id),
        inArray(salidasTable.estado, ["ARMANDO", "EN_TRANSITO"]),
        ...(salida ? [ne(salidasTable.id, salida.id)] : []),
      ),
    )
    .limit(1);
  if (reservation) {
    throw new InventarioError(
      `El rollo ${rollo.serie} ya pertenece a otra salida activa.`,
      "ROLLO_RESERVED",
    );
  }

  if (!salida) {
    const folio = await reserveSalidaFolio(tx, input.origenId);
    const [created] = await tx
      .insert(salidasTable)
      .values({
        folio,
        origenId: input.origenId,
        destinoId: input.destinoId,
        usuarioSolicitaId: input.usuarioId,
        estado: "ARMANDO",
        uuidCliente: input.uuidCliente,
        solicitadaAt: new Date(),
        actividadAt: new Date(),
      })
      .returning();
    salida = created!;
    await tx.insert(auditoriaTable).values({
      usuarioId: input.usuarioId,
      accion: "CREAR",
      entidad: "salidas",
      entidadId: String(salida.id),
      datosDespues: {
        folio,
        origenId: input.origenId,
        destinoId: input.destinoId,
      },
      ip: "desconocida",
    });
  }

  let [linea] = await tx
    .select()
    .from(salidaLineasTable)
    .where(
      and(
        eq(salidaLineasTable.salidaId, salida.id),
        eq(salidaLineasTable.productoId, rollo.productoId),
      ),
    )
    .for("update")
    .limit(1);
  if (!linea) {
    [linea] = await tx
      .insert(salidaLineasTable)
      .values({
        salidaId: salida.id,
        productoId: rollo.productoId,
        cantidadSolicitada: "0",
        cantidadEnviada: "0",
        cantidadRecibida: "0",
        rollosSolicitados: 0,
      })
      .returning();
  }
  await tx.insert(salidaRollosTable).values({
    salidaId: salida.id,
    lineaId: linea!.id,
    rolloId: rollo.id,
    cantidadEnviada: rollo.cantidadActual,
    cantidadRecibida: null,
    recibido: false,
  });
  await recomputeDraftLine(tx, salida.id, linea!.id);
  await tx
    .update(salidasTable)
    .set({ actividadAt: new Date() })
    .where(eq(salidasTable.id, salida.id));
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "AGREGAR_ROLLO",
    entidad: "salidas",
    entidadId: String(salida.id),
    datosDespues: { rolloId: rollo.id, serie: rollo.serie },
    ip: "desconocida",
  });
  return requireSalidaDetail(tx, salida.id);
}

export async function quitarRolloBorradorSalida(
  tx: Tx,
  salidaId: number,
  rolloId: number,
  usuarioId: number,
) {
  const salida = await getSalidaForUpdate(tx, salidaId);
  requireState(salida, ["ARMANDO"], "modificar");
  if (salida.usuarioSolicitaId !== usuarioId) {
    throw new InventarioError(
      "Solo quien inició el borrador puede modificarlo.",
      "SALIDA_DRAFT_OWNER_REQUIRED",
    );
  }
  const [association] = await tx
    .select()
    .from(salidaRollosTable)
    .where(
      and(
        eq(salidaRollosTable.salidaId, salida.id),
        eq(salidaRollosTable.rolloId, rolloId),
      ),
    )
    .for("update")
    .limit(1);
  if (!association) {
    throw new InventarioError(
      "El rollo no pertenece a este borrador.",
      "ROLLO_NOT_IN_DRAFT",
    );
  }
  await tx
    .delete(salidaRollosTable)
    .where(eq(salidaRollosTable.id, association.id));
  await recomputeDraftLine(tx, salida.id, association.lineaId);
  await tx
    .update(salidasTable)
    .set({ actividadAt: new Date() })
    .where(eq(salidasTable.id, salida.id));
  await tx.insert(auditoriaTable).values({
    usuarioId,
    accion: "QUITAR_ROLLO",
    entidad: "salidas",
    entidadId: String(salida.id),
    datosAntes: { rolloId },
    ip: "desconocida",
  });
  return requireSalidaDetail(tx, salida.id);
}

async function recomputeLineTotals(tx: Tx, salidaId: number): Promise<void> {
  const lineas = await tx
    .select({ id: salidaLineasTable.id })
    .from(salidaLineasTable)
    .where(eq(salidaLineasTable.salidaId, salidaId));
  for (const linea of lineas) {
    const rows = await tx
      .select({
        enviada: sql<string>`COALESCE(SUM(${salidaRollosTable.cantidadEnviada}), 0)::text`,
        recibida: sql<string>`COALESCE(SUM(CASE WHEN ${salidaRollosTable.recibido} THEN ${salidaRollosTable.cantidadRecibida} ELSE 0 END), 0)::text`,
      })
      .from(salidaRollosTable)
      .where(eq(salidaRollosTable.lineaId, linea.id));
    await tx
      .update(salidaLineasTable)
      .set({ cantidadEnviada: rows[0]!.enviada, cantidadRecibida: rows[0]!.recibida })
      .where(eq(salidaLineasTable.id, linea.id));
  }
}

export async function enviarSalida(tx: Tx, input: EnviarSalidaInput) {
  const salida = await getSalidaForUpdate(tx, input.salidaId);
  const folioFormateado = await getSalidaFolioFormateado(tx, salida);
  requireState(salida, ["ARMANDO"], "enviar");
  if (salida.usuarioSolicitaId !== input.usuarioId) {
    throw new InventarioError(
      "Solo quien inició el borrador puede finalizarlo.",
      "SALIDA_DRAFT_OWNER_REQUIRED",
    );
  }
  const [viajeLink] = await tx
    .select({ viajeId: viajeSalidasTable.viajeId })
    .from(viajeSalidasTable)
    .where(eq(viajeSalidasTable.salidaId, salida.id))
    .limit(1);
  if (!viajeLink && !input.transportista?.trim()) {
    throw new InventarioError("El transportista es obligatorio.", "TRANSPORT_REQUIRED");
  }
  const [transito] = await tx
    .select({ id: ubicacionesTable.id })
    .from(ubicacionesTable)
    .where(and(eq(ubicacionesTable.tipo, "TRANSITO"), eq(ubicacionesTable.activa, true)))
    .limit(1);
  if (!transito) {
    throw new InventarioError("No existe una ubicación activa de En tránsito.", "TRANSIT_LOCATION_NOT_FOUND");
  }
  const rollos = await tx
    .select()
    .from(salidaRollosTable)
    .where(eq(salidaRollosTable.salidaId, salida.id))
    .for("update");
  if (!rollos.length) {
    throw new InventarioError("La salida no tiene rollos preparados.", "EMPTY_PREPARATION");
  }
  for (const item of rollos) {
    await moverRollo(tx, {
      rolloId: item.rolloId,
      ubicacionOrigenId: salida.origenId,
      ubicacionTransitoId: transito.id,
      usuarioId: input.usuarioId,
      justificacion: `Salida ${folioFormateado} hacia ubicación ${salida.destinoId}.`,
      documentoTipo: "SALIDA",
      documentoId: String(salida.id),
    });
  }
  await recomputeLineTotals(tx, salida.id);
  await tx
    .update(salidasTable)
    .set({
      estado: "EN_TRANSITO",
      usuarioEnviaId: input.usuarioId,
      enviadaAt: new Date(),
      transportista: viajeLink ? null : input.transportista!.trim(),
      notaEnvio: input.notaEnvio?.trim() || null,
      actividadAt: new Date(),
    })
    .where(eq(salidasTable.id, salida.id));
  return requireSalidaDetail(tx, salida.id);
}

export async function recibirSalida(tx: Tx, input: RecibirSalidaInput) {
  const salida = await getSalidaForUpdate(tx, input.salidaId);
  const folioFormateado = await getSalidaFolioFormateado(tx, salida);
  requireState(salida, ["EN_TRANSITO"], "recibir");
  const salidaRollos = await tx
    .select()
    .from(salidaRollosTable)
    .where(eq(salidaRollosTable.salidaId, salida.id))
    .for("update");
  if (!salidaRollos.length) {
    throw new InventarioError("La salida no tiene rollos enviados.", "ROLLO_NOT_PENDING");
  }
  const note = input.nota?.trim() || null;
  for (const salidaRollo of salidaRollos) {
    if (salidaRollo.recibido) {
      throw new InventarioError("El rollo no está pendiente en esta salida.", "ROLLO_NOT_PENDING");
    }
    await recibirTransferencia(tx, {
      rolloId: salidaRollo.rolloId,
      ubicacionDestinoId: salida.destinoId!,
      usuarioId: input.usuarioId,
      justificacion: `Recepción de salida ${folioFormateado}.`,
      documentoTipo: "RECEPCION_SALIDA",
      documentoId: String(salida.id),
    });
    await tx
      .update(salidaRollosTable)
      .set({
        recibido: true,
        cantidadRecibida: salidaRollo.cantidadEnviada,
        notaDiferencia: input.completa ? null : note,
      })
      .where(eq(salidaRollosTable.id, salidaRollo.id));
  }
  await recomputeLineTotals(tx, salida.id);
  await tx
    .update(salidasTable)
    .set({
      estado: "RECIBIDA",
      usuarioRecibeId: input.usuarioId,
      recibidaAt: new Date(),
      notaRecepcion: note,
      actividadAt: new Date(),
    })
    .where(eq(salidasTable.id, salida.id));
  await tx.insert(auditoriaTable).values({
    usuarioId: input.usuarioId,
    accion: "RECIBIR",
    entidad: "salidas",
    entidadId: String(salida.id),
    datosDespues: {
      folio: salida.folio,
      origenId: salida.origenId,
      destinoId: salida.destinoId,
      completa: input.completa,
      nota: note,
    },
    ip: input.ip,
  });
  if (!input.completa) {
    await tx.insert(notificacionesSistemaTable).values({
      tipo: "SALIDA_INCOMPLETA",
      titulo: `Salida ${folioFormateado} reportada incompleta`,
      mensaje: note
        ? `La recepción fue marcada incompleta. Nota: ${note}`
        : "La recepción fue marcada incompleta sin nota.",
      entidad: "salidas",
      entidadId: String(salida.id),
    });
  }
  return requireSalidaDetail(tx, salida.id);
}

export async function cancelarSalida(
  tx: Tx,
  salidaId: number,
  usuarioId: number,
  motivo: string,
) {
  const salida = await getSalidaForUpdate(tx, salidaId);
  requireState(salida, ["ARMANDO"], "cancelar");
  if (motivo.trim().length < 10) {
    throw new InventarioError("El motivo de cancelación debe tener al menos 10 caracteres.", "REASON_REQUIRED");
  }
  const [movement] = await tx
    .select({ id: movimientosTable.id })
    .from(movimientosTable)
    .where(
      and(
        eq(movimientosTable.documentoTipo, "SALIDA"),
        eq(movimientosTable.documentoId, String(salida.id)),
      ),
    )
    .limit(1);
  if (movement) {
    throw new InventarioError(
      "No se puede cancelar un borrador con movimientos de inventario.",
      "SALIDA_HAS_MOVEMENTS",
    );
  }
  await tx
    .update(salidasTable)
    .set({
      estado: "CANCELADA",
      usuarioCancelaId: usuarioId,
      canceladaAt: new Date(),
      motivoCancelacion: motivo.trim(),
      actividadAt: new Date(),
    })
    .where(eq(salidasTable.id, salida.id));
  await tx.insert(auditoriaTable).values({
    usuarioId, accion: "CANCELAR", entidad: "salidas", entidadId: String(salida.id),
    datosDespues: { motivo: motivo.trim() }, ip: "desconocida",
  });
  return requireSalidaDetail(tx, salida.id);
}

export type ListSalidasInput = {
  estados?: EstadoSalida[];
  folio?: string;
  origenId?: number;
  destinoId?: number;
  productoId?: number;
  usuarioId?: number;
  search?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  page: number;
  pageSize: number;
  visibleUbicacionId?: number | null;
};

// Borradores anteriores a esta ventana dejan de mostrarse por defecto, pero no se eliminan.
const SALIDA_DRAFT_VISIBILITY_WINDOW_HOURS = 24;

export async function listarSalidas(input: ListSalidasInput) {
  const conditions = [];
  if (!input.estados?.length) {
    const activeDraftCutoff = new Date(
      Date.now() - SALIDA_DRAFT_VISIBILITY_WINDOW_HOURS * 60 * 60 * 1000,
    );
    conditions.push(
      or(
        ne(salidasTable.estado, "ARMANDO"),
        gte(salidasTable.actividadAt, activeDraftCutoff),
      ),
    );
  }
  if (input.estados?.length) conditions.push(inArray(salidasTable.estado, input.estados));
  if (input.folio) {
    const folioMatch = input.folio.match(/^([A-Z]{2,3}-)?(\d+)$/i);
    if (folioMatch) {
      conditions.push(eq(salidasTable.folio, Number(folioMatch[2])));
      if (folioMatch[1]) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ubicaciones u
             WHERE u.id = ${salidasTable.origenId}
               AND u.iniciales = ${folioMatch[1].slice(0, -1).toUpperCase()}
          )`,
        );
      }
    }
  }
  if (input.origenId) conditions.push(eq(salidasTable.origenId, input.origenId));
  if (input.destinoId) conditions.push(eq(salidasTable.destinoId, input.destinoId));
  if (input.fechaDesde) conditions.push(gte(salidasTable.createdAt, input.fechaDesde));
  if (input.fechaHasta) conditions.push(lte(salidasTable.createdAt, input.fechaHasta));
  if (input.visibleUbicacionId != null) {
    conditions.push(or(eq(salidasTable.origenId, input.visibleUbicacionId), eq(salidasTable.destinoId, input.visibleUbicacionId)));
  }
  if (input.productoId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM salida_lineas sl WHERE sl.salida_id = ${salidasTable.id} AND sl.producto_id = ${input.productoId})`,
    );
  }
  if (input.usuarioId) conditions.push(eq(salidasTable.usuarioSolicitaId, input.usuarioId));
  if (input.search?.trim()) {
    const search = input.search.trim();
    const folioMatch = search.match(/^([A-Z]{2,3}-)?(\d+)$/i);
    const folio = folioMatch ? Number(folioMatch[2]) : Number.NaN;
    conditions.push(
      Number.isInteger(folio)
        ? or(
            and(
              eq(salidasTable.folio, folio),
              ...(folioMatch?.[1]
                ? [
                    sql`EXISTS (
                      SELECT 1 FROM ubicaciones u
                       WHERE u.id = ${salidasTable.origenId}
                         AND u.iniciales = ${folioMatch[1].slice(0, -1).toUpperCase()}
                    )`,
                  ]
                : []),
            ),
            sql`EXISTS (SELECT 1 FROM salida_rollos sr JOIN rollos r ON r.id = sr.rollo_id WHERE sr.salida_id = ${salidasTable.id} AND r.serie ILIKE ${`%${search}%`})`,
          )
        : sql`EXISTS (SELECT 1 FROM salida_rollos sr JOIN rollos r ON r.id = sr.rollo_id WHERE sr.salida_id = ${salidasTable.id} AND r.serie ILIKE ${`%${search}%`})`,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [totalRows, rows] = await Promise.all([
    db.select({ total: count() }).from(salidasTable).where(where),
    db
      .select({ id: salidasTable.id })
      .from(salidasTable)
      .where(where)
      .orderBy(desc(salidasTable.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
  ]);
  const items = await Promise.all(rows.map((row) => buildSalidaDetail(db, row.id)));
  return { items: items.filter((item): item is NonNullable<typeof item> => item != null), total: totalRows[0]?.total ?? 0, page: input.page, pageSize: input.pageSize };
}
