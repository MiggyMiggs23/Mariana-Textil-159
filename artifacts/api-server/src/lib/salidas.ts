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
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  auditoriaTable,
  notificacionesSistemaTable,
  productosTable,
  rollosTable,
  salidaFolioTable,
  salidaLineasTable,
  salidaRollosTable,
  salidasTable,
  ubicacionesTable,
  usuariosTable,
  type EstadoSalida,
} from "@workspace/db";
import {
  InventarioError,
  moverRollo,
  recibirTransferencia,
  type Tx,
} from "./inventario";

const SALIDA_FOLIO_ROW_ID = 1;

export type CrearSalidaInput = {
  origenId: number;
  destinoId: number;
  usuarioSolicitaId: number;
  uuidCliente: string;
  transportista?: string | null;
  observaciones?: string | null;
  rolloIds?: number[];
};

type EnviarSalidaInput = {
  salidaId: number;
  usuarioId: number;
  transportista: string;
  notaEnvio?: string | null;
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

async function reserveSalidaFolio(tx: Tx): Promise<number> {
  await tx
    .insert(salidaFolioTable)
    .values({ id: SALIDA_FOLIO_ROW_ID, ultimoFolio: 499 })
    .onConflictDoNothing();

  const [row] = await tx
    .select()
    .from(salidaFolioTable)
    .where(eq(salidaFolioTable.id, SALIDA_FOLIO_ROW_ID))
    .for("update");
  const next = row!.ultimoFolio + 1;
  await tx
    .update(salidaFolioTable)
    .set({ ultimoFolio: next })
    .where(eq(salidaFolioTable.id, SALIDA_FOLIO_ROW_ID));
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
  const locationIds = [salida.origenId, salida.destinoId];
  const userIds = [
    salida.usuarioSolicitaId,
    salida.usuarioEnviaId,
    salida.usuarioRecibeId,
    salida.usuarioCancelaId,
  ].filter((id): id is number => id != null);
  const locations = await database
    .select({ id: ubicacionesTable.id, nombre: ubicacionesTable.nombre })
    .from(ubicacionesTable)
    .where(inArray(ubicacionesTable.id, locationIds));
  const users = userIds.length
    ? await database
        .select({ id: usuariosTable.id, nombre: usuariosTable.nombre })
        .from(usuariosTable)
        .where(inArray(usuariosTable.id, userIds))
    : [];
  return {
    locations: new Map(locations.map((row) => [row.id, row.nombre])),
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
    folio: salida.folio,
    origenId: salida.origenId,
    destinoId: salida.destinoId,
    nombreOrigen: locations.get(salida.origenId) ?? "Ubicación eliminada",
    nombreDestino: locations.get(salida.destinoId) ?? "Ubicación eliminada",
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
    uuidCliente: salida.uuidCliente,
    createdAt: salida.createdAt.toISOString(),
    updatedAt:
      iso(salida.recibidaAt) ??
      iso(salida.enviadaAt) ??
      iso(salida.solicitadaAt) ??
      salida.createdAt.toISOString(),
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
      salida.estado === "RECIBIDA" && rollos.some((rollo) => !rollo.recibido),
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
  const folio = await reserveSalidaFolio(tx);
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
  requireState(salida, ["ARMANDO"], "enviar");
  if (!input.transportista.trim()) {
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
      justificacion: `Salida ${salida.folio} hacia ubicación ${salida.destinoId}.`,
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
      transportista: input.transportista.trim(),
      notaEnvio: input.notaEnvio?.trim() || null,
    })
    .where(eq(salidasTable.id, salida.id));
  return requireSalidaDetail(tx, salida.id);
}

export async function recibirSalida(tx: Tx, input: RecibirSalidaInput) {
  const salida = await getSalidaForUpdate(tx, input.salidaId);
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
      ubicacionDestinoId: salida.destinoId,
      usuarioId: input.usuarioId,
      justificacion: `Recepción de salida ${salida.folio}.`,
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
      titulo: `Salida ${salida.folio} reportada incompleta`,
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
  await tx
    .update(salidasTable)
    .set({
      estado: "CANCELADA",
      usuarioCancelaId: usuarioId,
      canceladaAt: new Date(),
      motivoCancelacion: motivo.trim(),
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
  folio?: number;
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

export async function listarSalidas(input: ListSalidasInput) {
  const conditions = [];
  if (input.estados?.length) conditions.push(inArray(salidasTable.estado, input.estados));
  if (input.folio) conditions.push(eq(salidasTable.folio, input.folio));
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
    const folio = Number(search);
    conditions.push(
      Number.isInteger(folio)
        ? or(eq(salidasTable.folio, folio), sql`EXISTS (SELECT 1 FROM salida_rollos sr JOIN rollos r ON r.id = sr.rollo_id WHERE sr.salida_id = ${salidasTable.id} AND r.serie ILIKE ${`%${search}%`})`)
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
