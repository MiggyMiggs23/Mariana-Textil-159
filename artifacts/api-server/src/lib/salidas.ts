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
  ajustarRollo,
  InventarioError,
  moverRollo,
  recibirTransferencia,
  type Tx,
} from "./inventario";

const SALIDA_FOLIO_ROW_ID = 1;
const ACTIVE_RESERVATION_STATES: EstadoSalida[] = [
  "PREPARADA",
  "ENVIADA",
  "RECIBIDA",
];
const CANCELLABLE_STATES: EstadoSalida[] = [
  "SOLICITADA",
  "ACEPTADA",
  "PREPARADA",
];

export type CrearSalidaInput = {
  origenId: number;
  destinoId: number;
  usuarioSolicitaId: number;
  uuidCliente: string;
  notaSolicitud?: string | null;
  lineas: Array<{
    productoId: number;
    cantidadSolicitada: string;
    rollosSolicitados?: number | null;
    nota?: string | null;
  }>;
};

export type PrepararSalidaInput = {
  salidaId: number;
  usuarioId: number;
  lineas: Array<{ lineaId: number; rolloIds: number[] }>;
};

export type EnviarSalidaInput = {
  salidaId: number;
  usuarioId: number;
  transportista: string;
  notaEnvio?: string | null;
};

export type RecibirSalidaInput = {
  salidaId: number;
  usuarioId: number;
  notaRecepcion?: string | null;
  rollos: Array<{
    rolloId: number;
    recibido: boolean;
    cantidadRecibida?: string | null;
    notaDiferencia?: string | null;
  }>;
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
  const [row] = await tx
    .select()
    .from(salidaFolioTable)
    .where(eq(salidaFolioTable.id, SALIDA_FOLIO_ROW_ID))
    .for("update");
  const next = (row?.ultimoFolio ?? 499) + 1;
  if (row) {
    await tx
      .update(salidaFolioTable)
      .set({ ultimoFolio: next })
      .where(eq(salidaFolioTable.id, SALIDA_FOLIO_ROW_ID));
  } else {
    await tx
      .insert(salidaFolioTable)
      .values({ id: SALIDA_FOLIO_ROW_ID, ultimoFolio: next });
  }
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
    salida.usuarioAceptaId,
    salida.usuarioPreparaId,
    salida.usuarioEnviaId,
    salida.usuarioRecibeId,
    salida.usuarioCierraId,
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
      })
      .from(salidaRollosTable)
      .innerJoin(rollosTable, eq(salidaRollosTable.rolloId, rollosTable.id))
      .where(eq(salidaRollosTable.salidaId, salida.id))
      .orderBy(salidaRollosTable.id),
  ]);

  const total = (field: "cantidadSolicitada" | "cantidadEnviada" | "cantidadRecibida") =>
    lineas.reduce((sum, linea) => sum + Number(linea[field]), 0).toFixed(3);
  const requestedById = salida.usuarioSolicitaId ?? 0;
  const accepted = salida.estado === "ACEPTADA" || [
    "PREPARADA",
    "ENVIADA",
    "RECIBIDA",
    "CERRADA",
  ].includes(salida.estado);
  const rejected = salida.estado === "RECHAZADA";
  const rollsPerLine = new Map<number, { sent: number; received: number }>();
  for (const rollo of rollos) {
    const current = rollsPerLine.get(rollo.lineaId) ?? { sent: 0, received: 0 };
    current.sent += 1;
    if (rollo.recibido) current.received += 1;
    rollsPerLine.set(rollo.lineaId, current);
  }

  return {
    id: salida.id,
    folio: salida.folio,
    origenId: salida.origenId,
    destinoId: salida.destinoId,
    nombreOrigen: locations.get(salida.origenId) ?? "Ubicación eliminada",
    nombreDestino: locations.get(salida.destinoId) ?? "Ubicación eliminada",
    estado: salida.estado,
    solicitadoPorId: requestedById,
    nombreSolicitadoPor: users.get(requestedById) ?? "Usuario eliminado",
    fechaSolicitud: iso(salida.solicitadaAt) ?? salida.createdAt.toISOString(),
    aceptadoPorId: accepted ? (salida.usuarioAceptaId ?? null) : null,
    nombreAceptadoPor: accepted && salida.usuarioAceptaId ? (users.get(salida.usuarioAceptaId) ?? null) : null,
    fechaAceptacion: accepted ? iso(salida.aceptadaAt) : null,
    rechazadoPorId: rejected ? (salida.usuarioAceptaId ?? null) : null,
    nombreRechazadoPor: rejected && salida.usuarioAceptaId ? (users.get(salida.usuarioAceptaId) ?? null) : null,
    fechaRechazo: rejected ? iso(salida.aceptadaAt) : null,
    preparadoPorId: salida.usuarioPreparaId ?? null,
    nombrePreparadoPor: salida.usuarioPreparaId ? (users.get(salida.usuarioPreparaId) ?? null) : null,
    fechaPreparacion: iso(salida.preparadaAt),
    enviadoPorId: salida.usuarioEnviaId ?? null,
    nombreEnviadoPor: salida.usuarioEnviaId ? (users.get(salida.usuarioEnviaId) ?? null) : null,
    fechaEnvio: iso(salida.enviadaAt),
    recibidoPorId: salida.usuarioRecibeId ?? null,
    nombreRecibidoPor: salida.usuarioRecibeId ? (users.get(salida.usuarioRecibeId) ?? null) : null,
    fechaRecepcion: iso(salida.recibidaAt),
    cerradoPorId: salida.usuarioCierraId ?? null,
    nombreCerradoPor: salida.usuarioCierraId ? (users.get(salida.usuarioCierraId) ?? null) : null,
    fechaCierre: iso(salida.cerradaAt),
    canceladoPorId: salida.usuarioCancelaId ?? null,
    nombreCanceladoPor: salida.usuarioCancelaId ? (users.get(salida.usuarioCancelaId) ?? null) : null,
    fechaCancelacion: iso(salida.canceladaAt),
    motivoRechazo: salida.motivoRechazo ?? null,
    motivoCancelacion: salida.motivoCancelacion ?? null,
    notaSolicitud: salida.notaSolicitud ?? null,
    notaEnvio: salida.notaEnvio ?? null,
    notaRecepcion: salida.notaRecepcion ?? null,
    transportista: salida.transportista ?? null,
    uuidCliente: salida.uuidCliente,
    createdAt: salida.createdAt.toISOString(),
    updatedAt:
      iso(salida.cerradaAt) ??
      iso(salida.recibidaAt) ??
      iso(salida.enviadaAt) ??
      iso(salida.preparadaAt) ??
      iso(salida.aceptadaAt) ??
      iso(salida.solicitadaAt) ??
      salida.createdAt.toISOString(),
    totalProductos: lineas.length,
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
  if (!input.lineas.length) {
    throw new InventarioError("La salida debe incluir al menos un producto.", "EMPTY_SALIDA");
  }
  const productIds = input.lineas.map((linea) => linea.productoId);
  if (new Set(productIds).size !== productIds.length) {
    throw new InventarioError("No se permiten productos duplicados.", "DUPLICATE_PRODUCT");
  }
  for (const linea of input.lineas) {
    if (!Number.isFinite(Number(linea.cantidadSolicitada)) || Number(linea.cantidadSolicitada) <= 0) {
      throw new InventarioError("La cantidad solicitada debe ser mayor a cero.", "INVALID_QUANTITY");
    }
  }

  const [locations, products] = await Promise.all([
    tx
      .select()
      .from(ubicacionesTable)
      .where(inArray(ubicacionesTable.id, [input.origenId, input.destinoId])),
    tx
      .select({ id: productosTable.id, activo: productosTable.activo })
      .from(productosTable)
      .where(inArray(productosTable.id, productIds)),
  ]);
  if (locations.length !== 2 || locations.some((location) => !location.activa || ["TRANSITO", "EXTERNO"].includes(location.tipo))) {
    throw new InventarioError("El origen o destino no es una ubicación operativa activa.", "INVALID_LOCATION");
  }
  if (products.length !== productIds.length || products.some((product) => !product.activo)) {
    throw new InventarioError("Todos los productos deben existir y estar activos.", "INVALID_PRODUCT");
  }

  const folio = await reserveSalidaFolio(tx);
  const [salida] = await tx
    .insert(salidasTable)
    .values({
      folio,
      origenId: input.origenId,
      destinoId: input.destinoId,
      usuarioSolicitaId: input.usuarioSolicitaId,
      notaSolicitud: input.notaSolicitud?.trim() || null,
      uuidCliente: input.uuidCliente,
      solicitadaAt: new Date(),
    })
    .returning({ id: salidasTable.id });
  await tx.insert(salidaLineasTable).values(
    input.lineas.map((linea) => ({
      salidaId: salida!.id,
      productoId: linea.productoId,
      cantidadSolicitada: Number(linea.cantidadSolicitada).toFixed(3),
      rollosSolicitados: linea.rollosSolicitados ?? null,
      nota: linea.nota?.trim() || null,
    })),
  );
  return requireSalidaDetail(tx, salida!.id);
}

export async function aceptarSalida(tx: Tx, salidaId: number, usuarioId: number) {
  const salida = await getSalidaForUpdate(tx, salidaId);
  requireState(salida, ["SOLICITADA"], "aceptar");
  await tx
    .update(salidasTable)
    .set({ estado: "ACEPTADA", usuarioAceptaId: usuarioId, aceptadaAt: new Date() })
    .where(eq(salidasTable.id, salidaId));
  return requireSalidaDetail(tx, salidaId);
}

export async function rechazarSalida(
  tx: Tx,
  salidaId: number,
  usuarioId: number,
  motivo: string,
) {
  const salida = await getSalidaForUpdate(tx, salidaId);
  requireState(salida, ["SOLICITADA"], "rechazar");
  if (motivo.trim().length < 10) {
    throw new InventarioError("El motivo de rechazo debe tener al menos 10 caracteres.", "REASON_REQUIRED");
  }
  await tx
    .update(salidasTable)
    .set({ estado: "RECHAZADA", usuarioAceptaId: usuarioId, aceptadaAt: new Date(), motivoRechazo: motivo.trim() })
    .where(eq(salidasTable.id, salidaId));
  return requireSalidaDetail(tx, salidaId);
}

export async function prepararSalida(tx: Tx, input: PrepararSalidaInput) {
  const salida = await getSalidaForUpdate(tx, input.salidaId);
  requireState(salida, ["ACEPTADA"], "preparar");
  const selected = input.lineas.flatMap((linea) =>
    linea.rolloIds.map((rolloId) => ({ lineaId: linea.lineaId, rolloId })),
  );
  if (!selected.length) {
    throw new InventarioError("Selecciona al menos un rollo para preparar.", "EMPTY_PREPARATION");
  }
  if (new Set(selected.map((item) => item.rolloId)).size !== selected.length) {
    throw new InventarioError("Un rollo no puede repetirse en la preparación.", "DUPLICATE_ROLL");
  }

  const lineas = await tx
    .select()
    .from(salidaLineasTable)
    .where(eq(salidaLineasTable.salidaId, salida.id));
  const lineMap = new Map(lineas.map((linea) => [linea.id, linea]));
  for (const item of selected) {
    if (!lineMap.has(item.lineaId)) {
      throw new InventarioError("La línea no pertenece a esta salida.", "LINE_MISMATCH");
    }
    await tx.execute(sql`SELECT pg_advisory_xact_lock(91017, ${item.rolloId})`);
  }

  const rolloIds = selected.map((item) => item.rolloId);
  const rollos = await tx
    .select()
    .from(rollosTable)
    .where(inArray(rollosTable.id, rolloIds))
    .for("update");
  if (rollos.length !== rolloIds.length) {
    throw new InventarioError("Uno de los rollos ya no existe.", "ROLLO_NOT_FOUND");
  }
  const rolloMap = new Map(rollos.map((rollo) => [rollo.id, rollo]));
  for (const item of selected) {
    const rollo = rolloMap.get(item.rolloId)!;
    const line = lineMap.get(item.lineaId)!;
    if (rollo.productoId !== line.productoId || rollo.ubicacionId !== salida.origenId || rollo.estado !== "DISPONIBLE") {
      throw new InventarioError("El rollo no está disponible para esta salida.", "ROLLO_UNAVAILABLE");
    }
  }

  const existingReservation = await tx
    .select({ rolloId: salidaRollosTable.rolloId })
    .from(salidaRollosTable)
    .innerJoin(salidasTable, eq(salidaRollosTable.salidaId, salidasTable.id))
    .where(
      and(
        inArray(salidaRollosTable.rolloId, rolloIds),
        inArray(salidasTable.estado, ACTIVE_RESERVATION_STATES),
      ),
    );
  if (existingReservation.length) {
    throw new InventarioError("Uno de los rollos ya está preparado para otra salida.", "ROLLO_RESERVED");
  }

  await tx.insert(salidaRollosTable).values(
    selected.map((item) => ({
      salidaId: salida.id,
      lineaId: item.lineaId,
      rolloId: item.rolloId,
      cantidadEnviada: rolloMap.get(item.rolloId)!.cantidadActual,
    })),
  );
  await tx
    .update(salidasTable)
    .set({ estado: "PREPARADA", usuarioPreparaId: input.usuarioId, preparadaAt: new Date() })
    .where(eq(salidasTable.id, salida.id));
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
  requireState(salida, ["PREPARADA"], "enviar");
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
      estado: "ENVIADA",
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
  requireState(salida, ["ENVIADA", "RECIBIDA"], "recibir");
  const salidaRollos = await tx
    .select()
    .from(salidaRollosTable)
    .where(eq(salidaRollosTable.salidaId, salida.id))
    .for("update");
  const byRolloId = new Map(salidaRollos.map((item) => [item.rolloId, item]));
  if (new Set(input.rollos.map((item) => item.rolloId)).size !== input.rollos.length) {
    throw new InventarioError("Un rollo no puede recibirse dos veces.", "DUPLICATE_ROLL");
  }
  if (salida.estado === "ENVIADA" && input.rollos.length !== salidaRollos.length) {
    throw new InventarioError("La recepción inicial debe confirmar todos los rollos enviados.", "INCOMPLETE_RECEIPT");
  }
  for (const item of input.rollos) {
    const salidaRollo = byRolloId.get(item.rolloId);
    if (!salidaRollo || salidaRollo.recibido) {
      throw new InventarioError("El rollo no está pendiente en esta salida.", "ROLLO_NOT_PENDING");
    }
    const note = item.notaDiferencia?.trim() || null;
    if (!item.recibido) {
      if (!note || note.length < 10) {
        throw new InventarioError("Un rollo no recibido requiere una nota de al menos 10 caracteres.", "DIFFERENCE_NOTE_REQUIRED");
      }
      await tx
        .update(salidaRollosTable)
        .set({ recibido: false, cantidadRecibida: null, notaDiferencia: note })
        .where(eq(salidaRollosTable.id, salidaRollo.id));
      continue;
    }
    const received = Number(item.cantidadRecibida);
    if (!Number.isFinite(received) || received <= 0) {
      throw new InventarioError("La cantidad recibida debe ser mayor a cero.", "INVALID_RECEIVED_QUANTITY");
    }
    const sent = Number(salidaRollo.cantidadEnviada);
    if (received !== sent && (!note || note.length < 10)) {
      throw new InventarioError("Toda diferencia requiere una nota de al menos 10 caracteres.", "DIFFERENCE_NOTE_REQUIRED");
    }
    await recibirTransferencia(tx, {
      rolloId: item.rolloId,
      ubicacionDestinoId: salida.destinoId,
      usuarioId: input.usuarioId,
      justificacion: `Recepción de salida ${salida.folio}.`,
      documentoTipo: "RECEPCION_SALIDA",
      documentoId: String(salida.id),
    });
    if (received !== sent) {
      await ajustarRollo(tx, {
        rolloId: item.rolloId,
        cantidadNueva: received.toFixed(3),
        justificacion: `Diferencia en recepción de salida ${salida.folio}: ${note}`,
        usuarioId: input.usuarioId,
        documentoTipo: "RECEPCION_SALIDA",
        documentoId: String(salida.id),
        revisado: true,
      });
    }
    await tx
      .update(salidaRollosTable)
      .set({
        recibido: true,
        cantidadRecibida: received.toFixed(3),
        notaDiferencia: note,
      })
      .where(eq(salidaRollosTable.id, salidaRollo.id));
  }
  await recomputeLineTotals(tx, salida.id);
  const firstReceipt = salida.estado === "ENVIADA";
  await tx
    .update(salidasTable)
    .set({
      estado: "RECIBIDA",
      ...(firstReceipt
        ? {
            usuarioRecibeId: input.usuarioId,
            recibidaAt: new Date(),
            notaRecepcion: input.notaRecepcion?.trim() || null,
          }
        : {}),
    })
    .where(eq(salidasTable.id, salida.id));
  return requireSalidaDetail(tx, salida.id);
}

export async function cerrarSalida(tx: Tx, salidaId: number, usuarioId: number) {
  const salida = await getSalidaForUpdate(tx, salidaId);
  requireState(salida, ["RECIBIDA"], "cerrar");
  const [pending] = await tx
    .select({ total: count() })
    .from(salidaRollosTable)
    .where(and(eq(salidaRollosTable.salidaId, salida.id), eq(salidaRollosTable.recibido, false)));
  if ((pending?.total ?? 0) > 0) {
    throw new InventarioError("No se puede cerrar: hay rollos que siguen en tránsito.", "PENDING_ROLLOS");
  }
  await tx
    .update(salidasTable)
    .set({ estado: "CERRADA", usuarioCierraId: usuarioId, cerradaAt: new Date() })
    .where(eq(salidasTable.id, salida.id));
  return requireSalidaDetail(tx, salida.id);
}

export async function cancelarSalida(
  tx: Tx,
  salidaId: number,
  usuarioId: number,
  motivo: string,
) {
  const salida = await getSalidaForUpdate(tx, salidaId);
  requireState(salida, CANCELLABLE_STATES, "cancelar");
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
  return requireSalidaDetail(tx, salida.id);
}

export type ListSalidasInput = {
  estados?: EstadoSalida[];
  folio?: number;
  origenId?: number;
  destinoId?: number;
  productoId?: number;
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

export async function countSalidasPendientes(visibleUbicacionId?: number | null) {
  const originStates: EstadoSalida[] = ["SOLICITADA", "ACEPTADA", "PREPARADA"];
  const destinationStates: EstadoSalida[] = ["ENVIADA", "RECIBIDA"];
  const conditions = visibleUbicacionId == null
    ? [or(inArray(salidasTable.estado, originStates), inArray(salidasTable.estado, destinationStates))]
    : [
        or(
          and(eq(salidasTable.origenId, visibleUbicacionId), inArray(salidasTable.estado, originStates)),
          and(eq(salidasTable.destinoId, visibleUbicacionId), inArray(salidasTable.estado, destinationStates)),
        ),
      ];
  const [row] = await db.select({ total: count() }).from(salidasTable).where(and(...conditions));
  return { total: row?.total ?? 0 };
}